import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const presentationRoot = new URL("../", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
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

test("server-renders the static Paperplain presentation", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Paperplain — Verified PDF-to-Markdown samples<\/title>/i);
  assert.match(html, /Static review candidate/);
  assert.match(html, /Known documents in\./);
  assert.match(html, /Explore a verified sample/);
  assert.match(html, /live converter is not hosted in this preview/i);
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

test("source contains no hosted conversion, upload, storage, or private-network path", async () => {
  const [page, packageJson, hosting, worker] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${worker}`;
  const packageConfig = JSON.parse(packageJson);
  const hostingConfig = JSON.parse(hosting);

  assert.equal(packageConfig.dependencies?.["@opendataloader/pdf"], undefined);
  assert.equal(hostingConfig.d1 ?? null, null);
  assert.equal(hostingConfig.r2 ?? null, null);
  assert.doesNotMatch(source, /@opendataloader\/pdf|type=["']file["']|formData|D1Database|R2Bucket/i);
  assert.doesNotMatch(source, /192\.168\.|100\.[0-9]+\.|tailscale[.]com|proxy_pass/i);
  assert.doesNotMatch(
    source,
    /api[_-]?key\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY|password\s*[:=]|bearer\s+[a-z0-9._-]{12,}/i,
  );
});
