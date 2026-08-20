import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_VERSION = "v1";
export const AUTH_HEADERS = Object.freeze({
  timestamp: "x-paperplain-timestamp",
  nonce: "x-paperplain-nonce",
  signature: "x-paperplain-signature",
});

export const DEFAULT_AUTH_WINDOW_SECONDS = 60;
export const DEFAULT_FUTURE_SKEW_SECONDS = 10;

const EMPTY_BODY_SHA256 = createHash("sha256").update("").digest("hex");
const NONCE_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;
const SIGNATURE_PATTERN = /^v1=([a-f0-9]{64})$/;
const TIMESTAMP_PATTERN = /^\d{10}$/;

function headerValue(headers, name) {
  const value =
    typeof headers?.get === "function" ? headers.get(name) : headers?.[name];
  return Array.isArray(value) ? undefined : value;
}

export function normalizeAllowedOrigin(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("PAPERPLAIN_ALLOWED_ORIGIN is required in hosted mode.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PAPERPLAIN_ALLOWED_ORIGIN must be an absolute HTTPS origin.");
  }

  if (url.protocol !== "https:" || url.origin !== value) {
    throw new Error(
      "PAPERPLAIN_ALLOWED_ORIGIN must be an exact HTTPS origin without a path or trailing slash.",
    );
  }

  return url.origin;
}

export function validateRequestSecret(secret) {
  if (
    typeof secret !== "string" ||
    secret !== secret.trim() ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error(
      "PAPERPLAIN_REQUEST_SECRET must be at least 32 bytes with no surrounding whitespace.",
    );
  }

  return secret;
}

export function canonicalHostedRequest({
  timestamp,
  nonce,
  method,
  pathname,
  origin,
}) {
  return [
    AUTH_VERSION,
    String(timestamp),
    nonce,
    method.toUpperCase(),
    pathname,
    origin,
    EMPTY_BODY_SHA256,
  ].join("\n");
}

export function signHostedRequest({
  secret,
  timestamp,
  nonce,
  method = "POST",
  pathname,
  origin,
}) {
  validateRequestSecret(secret);
  const canonical = canonicalHostedRequest({
    timestamp,
    nonce,
    method,
    pathname,
    origin,
  });
  const signature = createHmac("sha256", secret).update(canonical).digest("hex");
  return `${AUTH_VERSION}=${signature}`;
}

export function createHostedRequestVerifier({
  allowedOrigin,
  secret,
  now = Date.now,
  maxAgeSeconds = DEFAULT_AUTH_WINDOW_SECONDS,
  futureSkewSeconds = DEFAULT_FUTURE_SKEW_SECONDS,
  maxRememberedNonces = 256,
}) {
  const normalizedOrigin = normalizeAllowedOrigin(allowedOrigin);
  const validatedSecret = validateRequestSecret(secret);
  const seenNonces = new Map();

  function reject(status) {
    return { ok: false, status };
  }

  return function verifyHostedRequest({ headers, method, pathname }) {
    const origin = headerValue(headers, "origin");
    if (origin !== normalizedOrigin) return reject(403);

    const timestamp = headerValue(headers, AUTH_HEADERS.timestamp);
    const nonce = headerValue(headers, AUTH_HEADERS.nonce);
    const suppliedSignature = headerValue(headers, AUTH_HEADERS.signature);

    if (
      typeof timestamp !== "string" ||
      !TIMESTAMP_PATTERN.test(timestamp) ||
      typeof nonce !== "string" ||
      !NONCE_PATTERN.test(nonce) ||
      typeof suppliedSignature !== "string"
    ) {
      return reject(401);
    }

    const nowSeconds = Math.floor(now() / 1000);
    const requestSeconds = Number(timestamp);
    if (
      requestSeconds < nowSeconds - maxAgeSeconds ||
      requestSeconds > nowSeconds + futureSkewSeconds
    ) {
      return reject(401);
    }

    for (const [rememberedNonce, rememberedAt] of seenNonces) {
      if (rememberedAt < nowSeconds - maxAgeSeconds) {
        seenNonces.delete(rememberedNonce);
      }
    }

    if (seenNonces.has(nonce) || seenNonces.size >= maxRememberedNonces) {
      return reject(401);
    }

    const match = suppliedSignature.match(SIGNATURE_PATTERN);
    const supplied = match ? Buffer.from(match[1], "hex") : Buffer.alloc(32);
    const expectedHex = signHostedRequest({
      secret: validatedSecret,
      timestamp,
      nonce,
      method,
      pathname,
      origin,
    }).slice(`${AUTH_VERSION}=`.length);
    const expected = Buffer.from(expectedHex, "hex");

    if (!match || !timingSafeEqual(supplied, expected)) return reject(401);

    seenNonces.set(nonce, requestSeconds);
    return { ok: true, status: 200 };
  };
}
