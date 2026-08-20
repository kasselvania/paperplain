const AUTH_HEADERS = Object.freeze({
  timestamp: "x-paperplain-timestamp",
  nonce: "x-paperplain-nonce",
  signature: "x-paperplain-signature",
});

const AUTH_VERSION = "v1";
const EMPTY_BODY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const FIXED_SAMPLE_IDS = new Set([
  "field-brief",
  "studio-invoice",
  "block-bulletin",
]);
const REQUEST_SECRET_PATTERN = /^[a-f0-9]{64}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;
const HASH_PATTERN = /^[a-f0-9]{12}$/;
const MAX_MARKDOWN_CHARACTERS = 100_000;
const WAKE_TIMEOUT_MS = 75_000;
const CONVERSION_TIMEOUT_MS = 65_000;

function json(body, status, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function isRedirectStatus(status) {
  return status >= 300 && status <= 399;
}

function hasAuthenticatedSitesUser(request) {
  return Boolean(
    request.headers.get("oai-authenticated-user-id") &&
      request.headers.get("oai-authenticated-user-email"),
  );
}

async function hasRequestPayload(request) {
  if (request.body === null) return false;

  const reader = request.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return false;
      if ((value?.byteLength ?? 0) > 0) return true;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function normalizeRenderOrigin(value) {
  if (typeof value !== "string") return null;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.origin !== value ||
    url.hostname === "onrender.com" ||
    !url.hostname.endsWith(".onrender.com")
  ) {
    return null;
  }

  return url.origin;
}

function readServerConfig(env) {
  const renderOrigin = normalizeRenderOrigin(env.PAPERPLAIN_RENDER_ORIGIN);
  const requestSecret = env.PAPERPLAIN_REQUEST_SECRET;

  if (
    !renderOrigin ||
    typeof requestSecret !== "string" ||
    !REQUEST_SECRET_PATTERN.test(requestSecret)
  ) {
    return null;
  }

  return { renderOrigin, requestSecret };
}

function sampleIdFromPath(pathname) {
  const prefix = "/api/convert/";
  if (!pathname.startsWith(prefix)) return null;

  const sampleId = pathname.slice(prefix.length);
  return FIXED_SAMPLE_IDS.has(sampleId) ? sampleId : null;
}

function canonicalRequest({ timestamp, nonce, pathname, origin }) {
  return [
    AUTH_VERSION,
    String(timestamp),
    nonce,
    "POST",
    pathname,
    origin,
    EMPTY_BODY_SHA256,
  ].join("\n");
}

function bytesFromHex(value) {
  return Uint8Array.from(
    value.match(/.{2}/g) ?? [],
    (pair) => Number.parseInt(pair, 16),
  );
}

async function signRequest(secret, canonical, webCrypto) {
  const key = await webCrypto.subtle.importKey(
    "raw",
    bytesFromHex(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await webCrypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonical),
  );

  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function fetchWithDeadline(fetcher, input, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function safeUpstreamResult(value, sampleId) {
  if (
    !value ||
    typeof value !== "object" ||
    value.sampleId !== sampleId ||
    typeof value.markdown !== "string" ||
    value.markdown.length === 0 ||
    value.markdown.length > MAX_MARKDOWN_CHARACTERS ||
    !value.run ||
    typeof value.run !== "object"
  ) {
    return null;
  }

  const run = value.run;
  if (
    run.engine !== "OpenDataLoader PDF" ||
    typeof run.engineVersion !== "string" ||
    run.mode !== "local" ||
    !Number.isInteger(run.elapsedMs) ||
    run.elapsedMs < 0 ||
    !Number.isInteger(run.sourceBytes) ||
    run.sourceBytes < 1 ||
    run.markdownCharacters !== value.markdown.length ||
    !HASH_PATTERN.test(run.sourceSha256) ||
    !HASH_PATTERN.test(run.outputSha256)
  ) {
    return null;
  }

  return {
    sampleId,
    markdown: value.markdown,
    run: {
      engine: run.engine,
      engineVersion: run.engineVersion,
      mode: run.mode,
      elapsedMs: run.elapsedMs,
      sourceBytes: run.sourceBytes,
      markdownCharacters: run.markdownCharacters,
      sourceSha256: run.sourceSha256,
      outputSha256: run.outputSha256,
    },
  };
}

export async function handlePrivateConversionRequest(
  request,
  env,
  runtime = {},
) {
  if (!hasAuthenticatedSitesUser(request)) {
    return json({ error: "Authentication required." }, 401);
  }

  const url = new URL(request.url);
  if (request.headers.get("origin") !== url.origin) {
    return json({ error: "Request origin refused." }, 403);
  }

  if (request.method !== "POST") {
    return json(
      { error: "Method not allowed." },
      405,
      { Allow: "POST" },
    );
  }

  if (url.search || url.hash) {
    return json({ error: "Invalid conversion request." }, 400);
  }

  const sampleId = sampleIdFromPath(url.pathname);
  if (!sampleId) {
    return json({ error: "Sample not found." }, 404);
  }

  if (await hasRequestPayload(request)) {
    return json({ error: "Request body refused." }, 400);
  }

  const config = readServerConfig(env);
  if (!config) {
    return json({ error: "Private conversion is not configured." }, 503);
  }

  const fetcher = runtime.fetch ?? globalThis.fetch;
  const now = runtime.now ?? Date.now;
  const randomUUID =
    runtime.randomUUID ?? globalThis.crypto.randomUUID.bind(globalThis.crypto);
  const webCrypto = runtime.crypto ?? globalThis.crypto;

  try {
    const health = await fetchWithDeadline(
      fetcher,
      config.renderOrigin + "/healthz",
      {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "manual",
      },
      WAKE_TIMEOUT_MS,
    );
    if (health.status !== 204) {
      return json({ error: "Private conversion is unavailable." }, 502);
    }

    const pathname = "/api/convert/" + sampleId;
    const timestamp = Math.floor(now() / 1_000);
    const nonce = randomUUID().replaceAll("-", "");
    if (!NONCE_PATTERN.test(nonce)) {
      return json({ error: "Private conversion is unavailable." }, 503);
    }

    const canonical = canonicalRequest({
      timestamp,
      nonce,
      pathname,
      origin: url.origin,
    });
    const digest = await signRequest(config.requestSecret, canonical, webCrypto);
    const upstream = await fetchWithDeadline(
      fetcher,
      config.renderOrigin + pathname,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Origin: url.origin,
          [AUTH_HEADERS.timestamp]: String(timestamp),
          [AUTH_HEADERS.nonce]: nonce,
          [AUTH_HEADERS.signature]: AUTH_VERSION + "=" + digest,
        },
        redirect: "manual",
      },
      CONVERSION_TIMEOUT_MS,
    );

    if (isRedirectStatus(upstream.status)) {
      return json({ error: "Private conversion is unavailable." }, 502);
    }
    if (upstream.status === 429) {
      return json({ error: "Private converter is busy." }, 429);
    }
    if (!upstream.ok) {
      return json({ error: "Private conversion is unavailable." }, 502);
    }

    const text = await upstream.text();
    if (text.length > MAX_MARKDOWN_CHARACTERS * 2) {
      return json({ error: "Private conversion is unavailable." }, 502);
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: "Private conversion is unavailable." }, 502);
    }

    const result = safeUpstreamResult(parsed, sampleId);
    return result
      ? json(result, 200)
      : json({ error: "Private conversion is unavailable." }, 502);
  } catch {
    return json({ error: "Private conversion is unavailable." }, 502);
  }
}
