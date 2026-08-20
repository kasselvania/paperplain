import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { createHostedRequestVerifier } from "../../lib/request-auth.mjs";
import { handlePrivateConversionRequest } from "../lib/private-conversion.mjs";

const root = new URL("../../", import.meta.url);
const presentationRoot = new URL("../", import.meta.url);
const SITE_ORIGIN = "https://paperplain.example";
const TEST_ONLY_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

async function render(pathname = "/", options = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const headers = new Headers(options.headers);
  if (!headers.has("accept")) headers.set("accept", "text/html");

  return worker.fetch(
    new Request(SITE_ORIGIN + pathname, {
      method: options.method ?? "GET",
      headers,
      body: options.body,
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      ...options.env,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function collectTextAssets(directory) {
  const chunks = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) {
      chunks.push(await collectTextAssets(child));
    } else if (/[.](?:css|html|js|json|map|txt)$/.test(entry.name)) {
      chunks.push(await readFile(child, "utf8"));
    }
  }
  return chunks.join("\n");
}

test("server-renders the Paperplain private integration candidate", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Paperplain — Verified PDF-to-Markdown samples<\/title>/i);
  assert.match(html, /Private integration candidate/);
  assert.match(html, /Known documents in\./);
  assert.match(html, /Explore a verified sample/);
  assert.match(html, /Run private conversion/);
  assert.match(html, /browser never receives the signing secret/i);
  assert.match(html, /No uploads or visitor documents/);
  assert.doesNotMatch(html, /codex-preview|type=["']file["']|Convert now/i);
});

test("contains all three captured outputs and verification receipts", async () => {
  const captures = JSON.parse(
    await readFile(new URL("../app/sample-data.json", import.meta.url), "utf8"),
  );

  assert.equal(captures.length, 3);
  assert.deepEqual(
    captures.map((sample) => sample.id),
    ["field-brief", "studio-invoice", "block-bulletin"],
  );
  assert.ok(captures.every((sample) => sample.receipt.engine === "OpenDataLoader PDF"));
  assert.ok(captures.every((sample) => sample.receipt.engineVersion === "2.5.1"));
  assert.ok(captures.every((sample) => sample.receipt.mode === "captured local run"));
  assert.ok(captures.every((sample) => sample.markdown.length > 800));
  assert.ok(captures.every((sample) => /^[a-f0-9]{12}$/.test(sample.receipt.sourceSha256)));
  assert.ok(captures.every((sample) => /^[a-f0-9]{12}$/.test(sample.receipt.outputSha256)));
});

test("presentation fixtures are byte-identical to the canonical corpus", async () => {
  const paths = [
    "public/favicon.png",
    "public/previews/alder-creek-field-brief-1.png",
    "public/previews/copper-and-pine-invoice-1.png",
    "public/previews/juniper-block-bulletin-1.png",
    "public/samples/alder-creek-field-brief.pdf",
    "public/samples/copper-and-pine-invoice.pdf",
    "public/samples/juniper-block-bulletin.pdf",
  ];

  for (const path of paths) {
    const [canonical, presentation] = await Promise.all([
      readFile(new URL(path, root)),
      readFile(new URL(path, presentationRoot)),
    ]);
    assert.equal(digest(presentation), digest(canonical), path);
  }
});

test("the built Sites route denies unauthenticated, cross-origin, and unconfigured calls", async () => {
  const configuredEnv = {
    PAPERPLAIN_RENDER_ORIGIN: "https://paperplain-converter.onrender.com",
    PAPERPLAIN_REQUEST_SECRET: TEST_ONLY_SECRET,
  };
  const authenticatedHeaders = {
    Origin: SITE_ORIGIN,
    "oai-authenticated-user-id": "owner-test-user",
    "oai-authenticated-user-email": "owner@example.test",
  };

  const unauthenticated = await render("/api/convert/field-brief", {
    method: "POST",
    headers: { Origin: SITE_ORIGIN },
    env: configuredEnv,
  });
  assert.equal(unauthenticated.status, 401);

  const crossOrigin = await render("/api/convert/field-brief", {
    method: "POST",
    headers: {
      ...authenticatedHeaders,
      Origin: "https://not-paperplain.example",
    },
    env: configuredEnv,
  });
  assert.equal(crossOrigin.status, 403);

  const unconfigured = await render("/api/convert/field-brief", {
    method: "POST",
    headers: authenticatedHeaders,
  });
  assert.equal(unconfigured.status, 503);
  assert.deepEqual(await unconfigured.json(), {
    error: "Private conversion is not configured.",
  });
});

test("the Sites signer accepts Cloudflare's empty body and interoperates with Render", async () => {
  const renderOrigin = "https://paperplain-converter.onrender.com";
  const now = 1_800_000_000_000;
  const markdown = "# Fresh field brief";
  const outbound = [];

  const fetcher = async (input, init) => {
    const request = new Request(input, init);
    outbound.push(request);
    const url = new URL(request.url);

    if (url.pathname === "/healthz") {
      assert.equal(request.method, "GET");
      return new Response(null, { status: 204 });
    }

    assert.equal(url.pathname, "/api/convert/field-brief");
    assert.equal(request.method, "POST");
    assert.equal(request.headers.get("origin"), SITE_ORIGIN);
    assert.equal(await request.text(), "");

    const verifier = createHostedRequestVerifier({
      allowedOrigin: SITE_ORIGIN,
      secret: TEST_ONLY_SECRET,
      now: () => now,
    });
    assert.deepEqual(
      verifier({
        headers: request.headers,
        method: request.method,
        pathname: url.pathname,
      }),
      { ok: true, status: 200 },
    );

    return Response.json({
      sampleId: "field-brief",
      markdown,
      run: {
        engine: "OpenDataLoader PDF",
        engineVersion: "2.5.1",
        mode: "local",
        elapsedMs: 913,
        sourceBytes: 3841,
        markdownCharacters: markdown.length,
        sourceSha256: "12d85460aa68",
        outputSha256: "4d9f80c4ba21",
      },
    });
  };

  const response = await handlePrivateConversionRequest(
    new Request(SITE_ORIGIN + "/api/convert/field-brief", {
      method: "POST",
      headers: {
        Origin: SITE_ORIGIN,
        "Content-Length": "0",
        "oai-authenticated-user-id": "owner-test-user",
        "oai-authenticated-user-email": "owner@example.test",
      },
      body: "",
    }),
    {
      PAPERPLAIN_RENDER_ORIGIN: renderOrigin,
      PAPERPLAIN_REQUEST_SECRET: TEST_ONLY_SECRET,
    },
    {
      fetch: fetcher,
      now: () => now,
      randomUUID: () => "12345678-1234-1234-1234-123456789abc",
      crypto: globalThis.crypto,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).markdown, markdown);
  assert.deepEqual(
    outbound.map((request) => new URL(request.url).pathname),
    ["/healthz", "/api/convert/field-brief"],
  );
});

test("invalid samples and request bodies never reach Render", async () => {
  let outboundCalls = 0;
  const runtime = {
    fetch: async () => {
      outboundCalls += 1;
      throw new Error("unexpected outbound request");
    },
  };
  const env = {
    PAPERPLAIN_RENDER_ORIGIN: "https://paperplain-converter.onrender.com",
    PAPERPLAIN_REQUEST_SECRET: TEST_ONLY_SECRET,
  };
  const headers = {
    Origin: SITE_ORIGIN,
    "oai-authenticated-user-id": "owner-test-user",
    "oai-authenticated-user-email": "owner@example.test",
  };

  const unknown = await handlePrivateConversionRequest(
    new Request(SITE_ORIGIN + "/api/convert/not-a-sample", {
      method: "POST",
      headers,
    }),
    env,
    runtime,
  );
  assert.equal(unknown.status, 404);

  const withBody = await handlePrivateConversionRequest(
    new Request(SITE_ORIGIN + "/api/convert/field-brief", {
      method: "POST",
      headers: { ...headers, "Content-Length": "0" },
      body: "not accepted",
    }),
    env,
    runtime,
  );
  assert.equal(withBody.status, 400);
  assert.equal(outboundCalls, 0);
});

test("client assets contain the same-origin action but no server configuration", async () => {
  const clientAssets = await collectTextAssets(
    new URL("../dist/client/", import.meta.url),
  );

  assert.match(clientAssets, /api\/convert/);
  assert.doesNotMatch(
    clientAssets,
    /PAPERPLAIN_REQUEST_SECRET|PAPERPLAIN_RENDER_ORIGIN|onrender[.]com/,
  );
  assert.doesNotMatch(clientAssets, new RegExp(TEST_ONLY_SECRET));
});

test("source keeps the private route fixed-corpus, server-only, and storage-free", async () => {
  const [page, packageJson, hosting, worker, privateRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/private-conversion.mjs", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${worker}\n${privateRoute}`;
  const packageConfig = JSON.parse(packageJson);
  const hostingConfig = JSON.parse(hosting);

  assert.equal(packageConfig.dependencies?.["@opendataloader/pdf"], undefined);
  assert.equal(hostingConfig.d1 ?? null, null);
  assert.equal(hostingConfig.r2 ?? null, null);
  assert.doesNotMatch(source, /@opendataloader\/pdf|type=["']file["']|formData|D1Database|R2Bucket/i);
  assert.doesNotMatch(source, /192\.168\.|100\.[0-9]+\.|tailscale[.]com|proxy_pass/i);
  assert.doesNotMatch(source, /https:\/\/[a-z0-9-]+[.]onrender[.]com/i);
  assert.match(
    privateRoute,
    /"field-brief",\s*"studio-invoice",\s*"block-bulletin"/s,
  );
  assert.doesNotMatch(
    source,
    /api[_-]?key\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|bearer\s+[a-z0-9._-]{12,}/i,
  );
});
