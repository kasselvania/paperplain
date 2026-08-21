import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { createHostedRequestVerifier } from "../../lib/request-auth.mjs";
import { handleConversionRequest } from "../lib/conversion-route.mjs";

const SITE_ORIGIN = "https://paperplain.example";
const TEST_ONLY_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CONFIGURED_ENV = {
  PAPERPLAIN_RENDER_ORIGIN: "https://paperplain-converter.onrender.com",
  PAPERPLAIN_REQUEST_SECRET: TEST_ONLY_SECRET,
};

async function render(pathname = "/", options = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(SITE_ORIGIN + pathname, {
      method: options.method ?? "GET",
      headers: options.headers,
      body: options.body,
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      ...options.env,
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
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

test("public demo starts empty and ships no result or server secret", async () => {
  const [response, samples, clientAssets] = await Promise.all([
    render(),
    readFile(new URL("../app/sample-data.json", import.meta.url), "utf8").then(JSON.parse),
    collectTextAssets(new URL("../dist/client/", import.meta.url)),
  ]);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Public fixed-sample demo/i);
  assert.match(html, /Choose a fixture to begin\./i);
  assert.match(html, /No PDF is loaded and no Markdown exists/i);
  assert.doesNotMatch(html, /Owner-only|SERVER RUN RECEIPT|Live conversion complete/i);

  assert.deepEqual(
    samples.map(({ id }) => id),
    ["field-brief", "studio-invoice", "block-bulletin"],
  );
  assert.ok(samples.every((sample) => !sample.markdown && !sample.receipt));

  assert.match(clientAssets, /api\/convert/);
  assert.doesNotMatch(
    clientAssets,
    /PAPERPLAIN_REQUEST_SECRET|PAPERPLAIN_RENDER_ORIGIN|onrender[.]com/,
  );
  assert.doesNotMatch(clientAssets, new RegExp(TEST_ONLY_SECRET));
  assert.doesNotMatch(
    clientAssets,
    /ALDER CREEK \/ FIELD NOTE|Subtotal \$2,300|The library cart returns|type=["']file["']/i,
  );
});

test("anonymous same-origin route signs one fixed sample for Render", async () => {
  const now = 1_800_000_000_000;
  const markdown = "# Fresh field brief";
  const outbound = [];

  const response = await handleConversionRequest(
    new Request(SITE_ORIGIN + "/api/convert/field-brief", {
      method: "POST",
      headers: { Origin: SITE_ORIGIN },
    }),
    CONFIGURED_ENV,
    {
      now: () => now,
      randomUUID: () => "12345678-1234-1234-1234-123456789abc",
      crypto: globalThis.crypto,
      fetch: async (input, init) => {
        const request = new Request(input, init);
        outbound.push(request);
        const url = new URL(request.url);

        if (url.pathname === "/healthz") return new Response(null, { status: 204 });

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
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).markdown, markdown);
  assert.deepEqual(
    outbound.map((request) => new URL(request.url).pathname),
    ["/healthz", "/api/convert/field-brief"],
  );
});

test("off-contract public requests are refused before Render", async () => {
  let outboundCalls = 0;
  const runtime = {
    fetch: async () => {
      outboundCalls += 1;
    },
  };

  const unconfiguredPublicRoute = await render("/api/convert/field-brief", {
    method: "POST",
    headers: { Origin: SITE_ORIGIN },
  });
  assert.equal(unconfiguredPublicRoute.status, 503);
  assert.deepEqual(await unconfiguredPublicRoute.json(), {
    error: "Conversion is not configured.",
  });

  const cases = [
    [
      new Request(SITE_ORIGIN + "/api/convert/field-brief", {
        method: "POST",
        headers: { Origin: "https://elsewhere.example" },
      }),
      CONFIGURED_ENV,
      403,
    ],
    [
      new Request(SITE_ORIGIN + "/api/convert/not-a-sample", {
        method: "POST",
        headers: { Origin: SITE_ORIGIN },
      }),
      CONFIGURED_ENV,
      404,
    ],
    [
      new Request(SITE_ORIGIN + "/api/convert/field-brief", {
        method: "POST",
        headers: { Origin: SITE_ORIGIN },
        body: "visitor content",
      }),
      CONFIGURED_ENV,
      400,
    ],
  ];

  for (const [request, env, status] of cases) {
    assert.equal((await handleConversionRequest(request, env, runtime)).status, status);
  }
  assert.equal(outboundCalls, 0);
});
