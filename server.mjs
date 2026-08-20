import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { convert } from "@opendataloader/pdf";

import { publicSample, samples, samplesById } from "./lib/samples.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_ROOT = join(ROOT, "public");
const ENGINE_VERSION = "2.5.1";
const MAX_ACTIVE_CONVERSIONS = 1;

let activeConversions = 0;

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
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join("; "),
  );
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

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

async function convertSample(sample) {
  const inputPath = join(PUBLIC_ROOT, "samples", sample.fileName);
  const outputDirectory = await mkdtemp(join(tmpdir(), "paperplain-"));
  const startedAt = performance.now();

  try {
    await convert([inputPath], {
      outputDir: outputDirectory,
      format: "markdown",
      imageOutput: "off",
      quiet: true,
    });

    const outputPath = join(
      outputDirectory,
      `${basename(sample.fileName, extname(sample.fileName))}.md`,
    );
    const [source, markdown] = await Promise.all([
      readFile(inputPath),
      readFile(outputPath, "utf8"),
    ]);
    const elapsedMs = Math.round(performance.now() - startedAt);

    return {
      sampleId: sample.id,
      markdown,
      run: {
        engine: "OpenDataLoader PDF",
        engineVersion: ENGINE_VERSION,
        mode: "local",
        elapsedMs,
        sourceBytes: source.byteLength,
        markdownCharacters: markdown.length,
        sourceSha256: digest(source),
        outputSha256: digest(markdown),
      },
    };
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
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

export function createDemoServer() {
  return createServer(async (request, response) => {
    applyHeaders(response);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

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

    const conversionMatch = url.pathname.match(/^\/api\/convert\/([a-z0-9-]+)$/);
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
        sendJson(response, 200, await convertSample(sample));
      } catch (error) {
        console.error("Sample conversion failed:", error);
        sendJson(response, 500, {
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
}

export function startDemoServer({ port = Number(process.env.PORT ?? 4173) } = {}) {
  const server = createDemoServer();
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const resolvedPort = typeof address === "object" && address ? address.port : port;
    console.log(`Paperplain is ready at http://127.0.0.1:${resolvedPort}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startDemoServer();
}
