import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { after, before, test } from "node:test";

import { createDemoServer, resolveRuntimeConfig } from "../server.mjs";

let server;
let baseUrl;

before(async () => {
  server = createDemoServer();
  await new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    server.once("error", onError);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("the public page exposes the bounded demo without an upload control", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /Convert this sample/);
  assert.match(html, /Fixed sample corpus/);
  assert.doesNotMatch(html, /type=["']file["']/i);
});

test("the manifest publishes three generated fixtures and no server paths", async () => {
  const response = await fetch(`${baseUrl}/api/samples`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.samples.length, 3);
  assert.equal(payload.engine.version, "2.5.1");
  assert.ok(payload.samples.every((sample) => sample.pdfUrl.startsWith("/samples/")));
  assert.doesNotMatch(JSON.stringify(payload), /Users\/|Documents\/Codex/);
});

test("unknown corpus IDs are refused", async () => {
  const response = await fetch(`${baseUrl}/api/convert/private-document`, {
    method: "POST",
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.match(payload.error, /not in the fixed corpus/i);
});

test("the macOS launcher is executable and preserves the localhost boundary", async () => {
  const launcherUrl = new URL("../Start Paperplain.command", import.meta.url);
  const serverUrl = new URL("../server.mjs", import.meta.url);
  const [launcher, launcherStat, serverSource] = await Promise.all([
    readFile(launcherUrl, "utf8"),
    stat(launcherUrl),
    readFile(serverUrl, "utf8"),
  ]);

  assert.ok(launcherStat.mode & 0o111);
  assert.match(launcher, /http:\/\/127\.0\.0\.1/);
  assert.match(launcher, /\/usr\/bin\/open/);
  assert.doesNotMatch(launcher, /0\.0\.0\.0/);
  assert.match(serverSource, /host: "127\.0\.0\.1"/);
  assert.equal(resolveRuntimeConfig({}).host, "127.0.0.1");
});

test("every fixture completes a real local conversion", async () => {
  const manifestResponse = await fetch(`${baseUrl}/api/samples`);
  const { samples } = await manifestResponse.json();

  for (const sample of samples) {
    const response = await fetch(`${baseUrl}/api/convert/${sample.id}`, {
      method: "POST",
    });
    const payload = await response.json();

    assert.equal(response.status, 200, `${sample.id}: ${payload.error ?? "unknown error"}`);
    assert.equal(payload.sampleId, sample.id);
    assert.equal(payload.run.engine, "OpenDataLoader PDF");
    assert.equal(payload.run.engineVersion, "2.5.1");
    assert.equal(payload.run.mode, "local");
    assert.ok(payload.run.elapsedMs >= 0);
    assert.ok(payload.run.sourceBytes > 1_000);
    assert.ok(payload.run.markdownCharacters > 100);
    assert.match(payload.run.sourceSha256, /^[a-f0-9]{12}$/);
    assert.match(payload.markdown, /#/);
  }
});
