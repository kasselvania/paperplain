import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { ConversionTimeoutError } from "../lib/converter.mjs";
import {
  AUTH_HEADERS,
  canonicalHostedRequest,
  signHostedRequest,
  validateRequestSecret,
} from "../lib/request-auth.mjs";
import { createDemoServer, resolveRuntimeConfig } from "../server.mjs";

const ALLOWED_ORIGIN = "https://paperplain.example";
const REQUEST_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const NOW_SECONDS = 1_800_000_000;
const NOW_MS = NOW_SECONDS * 1_000;

function nonce(index) {
  return `nonce-${String(index).padStart(16, "0")}`;
}

function signedHeaders(
  pathname,
  {
    origin = ALLOWED_ORIGIN,
    secret = REQUEST_SECRET,
    timestamp = NOW_SECONDS,
    requestNonce = nonce(1),
  } = {},
) {
  return {
    Origin: origin,
    [AUTH_HEADERS.timestamp]: String(timestamp),
    [AUTH_HEADERS.nonce]: requestNonce,
    [AUTH_HEADERS.signature]: signHostedRequest({
      secret,
      timestamp,
      nonce: requestNonce,
      method: "POST",
      pathname,
      origin,
    }),
  };
}

function fakeResult(sample) {
  return {
    sampleId: sample.id,
    markdown: `# ${sample.title}`,
    run: {
      engine: "OpenDataLoader PDF",
      engineVersion: "2.5.1",
      mode: "local",
      elapsedMs: 1,
      sourceBytes: 1,
      markdownCharacters: sample.title.length + 2,
      sourceSha256: "000000000000",
      outputSha256: "111111111111",
    },
  };
}

async function startHostedServer(t, overrides = {}) {
  const server = createDemoServer({
    mode: "hosted",
    allowedOrigin: ALLOWED_ORIGIN,
    requestSecret: REQUEST_SECRET,
    now: () => NOW_MS,
    conversionRunner: async (sample) => fakeResult(sample),
    logger: { error() {} },
    ...overrides,
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("the documented Render secret is exactly 32 hex-decoded bytes", () => {
  assert.equal(REQUEST_SECRET.length, 64);
  assert.match(REQUEST_SECRET, /^[0-9a-f]{64}$/);
  assert.equal(validateRequestSecret(REQUEST_SECRET), REQUEST_SECRET);

  for (const invalid of [
    REQUEST_SECRET.slice(1),
    REQUEST_SECRET.toUpperCase(),
    `${REQUEST_SECRET}\n`,
    ` ${REQUEST_SECRET}`,
  ]) {
    assert.throws(
      () => validateRequestSecret(invalid),
      /exactly 64 lowercase hexadecimal characters/,
    );
  }

  const request = {
    secret: REQUEST_SECRET,
    timestamp: NOW_SECONDS,
    nonce: nonce(1),
    method: "POST",
    pathname: "/api/convert/field-brief",
    origin: ALLOWED_ORIGIN,
  };
  const expected = createHmac(
    "sha256",
    Buffer.from(REQUEST_SECRET, "hex"),
  )
    .update(canonicalHostedRequest(request))
    .digest("hex");

  assert.equal(signHostedRequest(request), `v1=${expected}`);
});

test("runtime configuration is localhost by default and fail-closed in hosted mode", () => {
  assert.deepEqual(resolveRuntimeConfig({}), {
    mode: "local",
    port: 4173,
    host: "127.0.0.1",
  });
  assert.throws(
    () => resolveRuntimeConfig({ PAPERPLAIN_MODE: "hosted", PORT: "10000" }),
    /PAPERPLAIN_ALLOWED_ORIGIN/,
  );
  assert.throws(
    () =>
      resolveRuntimeConfig({
        PAPERPLAIN_MODE: "hosted",
        PORT: "10000",
        PAPERPLAIN_ALLOWED_ORIGIN: `${ALLOWED_ORIGIN}/`,
        PAPERPLAIN_REQUEST_SECRET: REQUEST_SECRET,
      }),
    /without a path or trailing slash/,
  );

  const hosted = resolveRuntimeConfig({
    PAPERPLAIN_MODE: "hosted",
    PORT: "10000",
    PAPERPLAIN_ALLOWED_ORIGIN: ALLOWED_ORIGIN,
    PAPERPLAIN_REQUEST_SECRET: REQUEST_SECRET,
  });
  assert.equal(hosted.host, "0.0.0.0");
  assert.equal(hosted.port, 10000);
});

test("hosted mode exposes only an opaque health response and the conversion route", async (t) => {
  const baseUrl = await startHostedServer(t);

  const health = await fetch(`${baseUrl}/healthz`);
  assert.equal(health.status, 204);
  assert.equal(await health.text(), "");

  const [root, manifest, fixture] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/api/samples`),
    fetch(`${baseUrl}/samples/alder-creek-field-brief.pdf`),
  ]);
  assert.equal(root.status, 404);
  assert.equal(manifest.status, 404);
  assert.equal(fixture.status, 404);
});

test("hosted CORS accepts only the configured exact origin", async (t) => {
  const baseUrl = await startHostedServer(t);
  const pathname = "/api/convert/field-brief";

  const allowed = await fetch(`${baseUrl}${pathname}`, {
    method: "OPTIONS",
    headers: {
      Origin: ALLOWED_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": Object.values(AUTH_HEADERS).join(","),
    },
  });
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  assert.equal(allowed.headers.get("vary"), "Origin");

  const refused = await fetch(`${baseUrl}${pathname}`, {
    method: "OPTIONS",
    headers: { Origin: "https://not-paperplain.example" },
  });
  assert.equal(refused.status, 403);
  assert.equal(refused.headers.get("access-control-allow-origin"), null);

  const wrongOrigin = "https://not-paperplain.example";
  const refusedPost = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, {
      origin: wrongOrigin,
      requestNonce: nonce(21),
    }),
  });
  assert.equal(refusedPost.status, 403);
  assert.equal(refusedPost.headers.get("access-control-allow-origin"), null);
});

test("hosted conversion requires a current signature and rejects replay", async (t) => {
  const baseUrl = await startHostedServer(t);
  const pathname = "/api/convert/field-brief";

  const unsigned = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.equal(unsigned.status, 401);

  const headers = signedHeaders(pathname, { requestNonce: nonce(2) });
  const accepted = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  assert.equal((await accepted.json()).sampleId, "field-brief");

  const replayed = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
  });
  assert.equal(replayed.status, 401);

  const stale = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, {
      requestNonce: nonce(3),
      timestamp: NOW_SECONDS - 61,
    }),
  });
  assert.equal(stale.status, 401);
});

test("authentication is checked before the fixed-corpus allowlist", async (t) => {
  const baseUrl = await startHostedServer(t);
  const pathname = "/api/convert/private-document";

  const unsigned = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { Origin: ALLOWED_ORIGIN },
  });
  assert.equal(unsigned.status, 401);

  const signed = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, { requestNonce: nonce(4) }),
  });
  assert.equal(signed.status, 404);
  assert.deepEqual(await signed.json(), { error: "Not found." });
});

test("hosted conversion accepts no request body", async (t) => {
  const baseUrl = await startHostedServer(t);
  const pathname = "/api/convert/field-brief";
  const headers = signedHeaders(pathname, { requestNonce: nonce(5) });

  const bodyRequest = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(bodyRequest.status, 413);

  const emptyRequest = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers,
  });
  assert.equal(emptyRequest.status, 200);
});

test("hosted conversion admits one process at a time", async (t) => {
  let releaseFirst;
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const release = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  let calls = 0;

  const baseUrl = await startHostedServer(t, {
    conversionRunner: async (sample) => {
      calls += 1;
      if (calls === 1) {
        markStarted();
        await release;
      }
      return fakeResult(sample);
    },
  });
  const pathname = "/api/convert/field-brief";

  const first = fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, { requestNonce: nonce(6) }),
  });
  await started;

  const second = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, { requestNonce: nonce(7) }),
  });
  assert.equal(second.status, 429);

  releaseFirst();
  assert.equal((await first).status, 200);
  assert.equal(calls, 1);
});

test("hosted conversion is capped at six admitted runs per minute", async (t) => {
  const baseUrl = await startHostedServer(t);
  const pathname = "/api/convert/field-brief";

  for (let index = 10; index < 16; index += 1) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: "POST",
      headers: signedHeaders(pathname, { requestNonce: nonce(index) }),
    });
    assert.equal(response.status, 200);
  }

  const limited = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, { requestNonce: nonce(16) }),
  });
  assert.equal(limited.status, 429);
});

test("hosted timeout errors remain generic", async (t) => {
  const baseUrl = await startHostedServer(t, {
    conversionRunner: async () => {
      throw new ConversionTimeoutError();
    },
  });
  const pathname = "/api/convert/field-brief";

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: signedHeaders(pathname, { requestNonce: nonce(20) }),
  });
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: "Conversion timed out." });
});

test("the Render blueprint is manual, secret-free, and uses the bounded image", async () => {
  const [dockerfile, dockerignore, envExample, blueprint] = await Promise.all([
    readFile(new URL("../Dockerfile", import.meta.url), "utf8"),
    readFile(new URL("../.dockerignore", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../render.yaml", import.meta.url), "utf8"),
  ]);

  assert.match(dockerfile, /openjdk-17-jre-headless/);
  assert.match(dockerfile, /COPY --chown=node:node public\/samples/);
  assert.doesNotMatch(dockerfile, /COPY\s+\.\s+\./);
  assert.match(dockerfile, /USER node/);
  assert.match(dockerfile, /PAPERPLAIN_MODE=hosted/);
  assert.match(dockerfile, /PORT=10000/);

  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^presentation$/m);
  assert.equal(
    envExample,
    "# Required only by the hosted container. Leave secrets out of source control.\n" +
      "# Secret format: exactly 64 lowercase hex characters; no whitespace.\n" +
      "PAPERPLAIN_ALLOWED_ORIGIN=\n" +
      "PAPERPLAIN_REQUEST_SECRET=\n",
  );

  assert.match(blueprint, /runtime: docker/);
  assert.match(blueprint, /plan: free/);
  assert.match(blueprint, /healthCheckPath: \/healthz/);
  assert.match(blueprint, /autoDeployTrigger: off/);
  assert.doesNotMatch(blueprint, /maxShutdownDelaySeconds/);
  assert.equal((blueprint.match(/sync: false/g) ?? []).length, 2);
  assert.doesNotMatch(blueprint, /PAPERPLAIN_REQUEST_SECRET:\s*\S+/);
});
