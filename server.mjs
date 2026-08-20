import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ConversionTimeoutError,
  DEFAULT_CONVERSION_TIMEOUT_MS,
  ENGINE_VERSION,
  convertSample,
} from "./lib/converter.mjs";
import {
  AUTH_HEADERS,
  createHostedRequestVerifier,
  normalizeAllowedOrigin,
  validateRequestSecret,
} from "./lib/request-auth.mjs";
import { publicSample, samples, samplesById } from "./lib/samples.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = join(ROOT, "public");
const LOCAL_MODE = "local";
const HOSTED_MODE = "hosted";
const MAX_ACTIVE_CONVERSIONS = 1;
const MAX_CONVERSIONS_PER_MINUTE = 6;
const SERVER_SOCKET_TIMEOUT_MS = DEFAULT_CONVERSION_TIMEOUT_MS + 5_000;
const HOSTED_ALLOWED_HEADERS = [
  AUTH_HEADERS.timestamp,
  AUTH_HEADERS.nonce,
  AUTH_HEADERS.signature,
].join(", ");

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function applyHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
}

function applyHostedCors(response, allowedOrigin) {
  response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  response.setHeader("Vary", "Origin");
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendHealth(response) {
  response.writeHead(204, {
    "Cache-Control": "no-store",
    "Content-Length": "0",
  });
  response.end();
}

function requestHasBody(request) {
  const contentLength = request.headers["content-length"];
  const transferEncoding = request.headers["transfer-encoding"];

  if (transferEncoding !== undefined || Array.isArray(contentLength)) return true;
  if (contentLength === undefined) return false;
  return !/^\d+$/.test(contentLength) || Number(contentLength) !== 0;
}

function createRateLimiter({ now, limit, windowMs }) {
  const admittedAt = [];

  return function admit() {
    const current = now();
    const cutoff = current - windowMs;
    while (admittedAt.length > 0 && admittedAt[0] <= cutoff) admittedAt.shift();
    if (admittedAt.length >= limit) return false;
    admittedAt.push(current);
    return true;
  };
}

async function serveStatic(request, response, url) {
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    sendJson(response, 400, { error: "Malformed path." });
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(PUBLIC_ROOT, relativePath);
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    const contents = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Content-Length": contents.byteLength,
      "Cache-Control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

function validateMode(mode) {
  if (mode !== LOCAL_MODE && mode !== HOSTED_MODE) {
    throw new Error("PAPERPLAIN_MODE must be either local or hosted.");
  }
  return mode;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 through 65535.");
  }
  return port;
}

export function resolveRuntimeConfig(env = process.env) {
  const mode = validateMode(env.PAPERPLAIN_MODE ?? LOCAL_MODE);
  const port = parsePort(env.PORT ?? "4173");

  if (mode === LOCAL_MODE) {
    return { mode, port, host: "127.0.0.1" };
  }

  return {
    mode,
    port,
    host: "0.0.0.0",
    allowedOrigin: normalizeAllowedOrigin(env.PAPERPLAIN_ALLOWED_ORIGIN),
    requestSecret: validateRequestSecret(env.PAPERPLAIN_REQUEST_SECRET),
  };
}

export function createDemoServer({
  mode = LOCAL_MODE,
  allowedOrigin,
  requestSecret,
  now = Date.now,
  conversionRunner = convertSample,
  conversionTimeoutMs = DEFAULT_CONVERSION_TIMEOUT_MS,
  logger = console,
} = {}) {
  validateMode(mode);

  const hostedVerifier =
    mode === HOSTED_MODE
      ? createHostedRequestVerifier({
          allowedOrigin,
          secret: requestSecret,
          now,
        })
      : null;
  const normalizedOrigin =
    mode === HOSTED_MODE ? normalizeAllowedOrigin(allowedOrigin) : null;
  const admitHostedConversion = createRateLimiter({
    now,
    limit: MAX_CONVERSIONS_PER_MINUTE,
    windowMs: 60_000,
  });
  let activeConversions = 0;

  const server = createServer(async (request, response) => {
    applyHeaders(response);
    const url = new URL(request.url ?? "/", "http://paperplain.invalid");

    if (
      request.method === "GET" &&
      url.pathname === "/healthz" &&
      url.search === ""
    ) {
      sendHealth(response);
      return;
    }

    const conversionMatch =
      url.search === "" ? url.pathname.match(/^\/api\/convert\/([a-z0-9-]+)$/) : null;

    if (mode === HOSTED_MODE) {
      const requestOrigin = request.headers.origin;

      if (request.method === "OPTIONS" && conversionMatch) {
        if (requestOrigin !== normalizedOrigin) {
          sendJson(response, 403, { error: "Forbidden." });
          return;
        }
        applyHostedCors(response, normalizedOrigin);
        response.writeHead(204, {
          "Access-Control-Allow-Headers": HOSTED_ALLOWED_HEADERS,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Max-Age": "300",
          "Cache-Control": "no-store",
          "Content-Length": "0",
        });
        response.end();
        return;
      }

      if (request.method === "POST" && conversionMatch) {
        if (requestOrigin === normalizedOrigin) {
          applyHostedCors(response, normalizedOrigin);
        }

        if (requestHasBody(request)) {
          response.setHeader("Connection", "close");
          request.resume();
          sendJson(response, 413, { error: "Request body not accepted." });
          return;
        }

        const auth = hostedVerifier({
          headers: request.headers,
          method: request.method,
          pathname: url.pathname,
        });
        if (!auth.ok) {
          sendJson(response, auth.status, {
            error: auth.status === 403 ? "Forbidden." : "Unauthorized.",
          });
          return;
        }

        const sample = samplesById.get(conversionMatch[1]);
        if (!sample) {
          sendJson(response, 404, { error: "Not found." });
          return;
        }
        if (activeConversions >= MAX_ACTIVE_CONVERSIONS) {
          sendJson(response, 429, { error: "Converter busy." });
          return;
        }
        if (!admitHostedConversion()) {
          sendJson(response, 429, { error: "Rate limit reached." });
          return;
        }

        activeConversions += 1;
        try {
          const result = await conversionRunner(sample, {
            timeoutMs: conversionTimeoutMs,
          });
          sendJson(response, 200, result);
        } catch (error) {
          const timedOut = error instanceof ConversionTimeoutError;
          logger.error("Hosted sample conversion failed.", {
            sampleId: sample.id,
            kind: timedOut ? "timeout" : "execution",
          });
          sendJson(response, timedOut ? 504 : 500, {
            error: timedOut ? "Conversion timed out." : "Conversion failed.",
          });
        } finally {
          activeConversions -= 1;
        }
        return;
      }

      sendJson(response, 404, { error: "Not found." });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/samples") {
      sendJson(response, 200, {
        samples: samples.map(publicSample),
        boundary: "Only the generated sample corpus can be converted.",
        engine: {
          name: "OpenDataLoader PDF",
          version: ENGINE_VERSION,
          mode: "local",
        },
      });
      return;
    }

    if (request.method === "POST" && conversionMatch) {
      const sample = samplesById.get(conversionMatch[1]);
      if (!sample) {
        sendJson(response, 404, { error: "That sample is not in the fixed corpus." });
        return;
      }
      if (activeConversions >= MAX_ACTIVE_CONVERSIONS) {
        sendJson(response, 429, { error: "A sample conversion is already running." });
        return;
      }

      activeConversions += 1;
      try {
        sendJson(
          response,
          200,
          await conversionRunner(sample, { timeoutMs: conversionTimeoutMs }),
        );
      } catch (error) {
        logger.error("Local sample conversion failed.", {
          sampleId: sample.id,
          kind: error instanceof ConversionTimeoutError ? "timeout" : "execution",
        });
        sendJson(response, error instanceof ConversionTimeoutError ? 504 : 500, {
          error: "The local converter could not complete this sample.",
          hint: "Confirm Java 11 or newer is available to the Node process.",
        });
      } finally {
        activeConversions -= 1;
      }
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response, url);
      return;
    }

    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { error: "Method not allowed." });
  });

  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.timeout = SERVER_SOCKET_TIMEOUT_MS;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;

  return server;
}

export function startDemoServer({ env = process.env } = {}) {
  const runtime = resolveRuntimeConfig(env);
  const server = createDemoServer(runtime);
  server.listen(runtime.port, runtime.host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : runtime.port;
    if (runtime.mode === LOCAL_MODE) {
      console.log(`Paperplain is ready at http://127.0.0.1:${port}`);
    } else {
      console.log(`Paperplain hosted service is ready on port ${port}.`);
    }
  });
  return server;
}

function installGracefulShutdown(server) {
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), SERVER_SOCKET_TIMEOUT_MS).unref();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  installGracefulShutdown(startDemoServer());
}
