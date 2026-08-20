import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const ENGINE_VERSION = "2.5.1";
export const DEFAULT_CONVERSION_TIMEOUT_MS = 60_000;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = join(ROOT, "public");
const require = createRequire(import.meta.url);
const packageEntry = require.resolve("@opendataloader/pdf");
const engineJar = resolve(
  dirname(packageEntry),
  "..",
  "lib",
  "opendataloader-pdf-cli.jar",
);
const MAX_DIAGNOSTIC_BYTES = 4_096;

function digest(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function appendDiagnostic(current, chunk) {
  const combined = `${current}${chunk.toString("utf8")}`;
  return combined.slice(-MAX_DIAGNOSTIC_BYTES);
}

export class ConversionTimeoutError extends Error {
  constructor() {
    super("The converter exceeded its execution deadline.");
    this.name = "ConversionTimeoutError";
  }
}

export class ConversionExecutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConversionExecutionError";
  }
}

async function executeEngine(inputPath, outputDirectory, timeoutMs) {
  const args = [
    "-Djava.awt.headless=true",
    "-Dapple.awt.UIElement=true",
    "-jar",
    engineJar,
    inputPath,
    "--output-dir",
    outputDirectory,
    "--format",
    "markdown",
    "--image-output",
    "off",
    "--threads",
    "1",
    "--quiet",
  ];

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn("java", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let diagnostic = "";
    let timedOut = false;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    timeout.unref();

    child.stderr.on("data", (chunk) => {
      diagnostic = appendDiagnostic(diagnostic, chunk);
    });

    child.once("error", (error) => {
      finish(
        rejectPromise,
        new ConversionExecutionError(
          error.code === "ENOENT"
            ? "The Java runtime is unavailable."
            : "The converter process could not start.",
        ),
      );
    });

    child.once("close", (code) => {
      if (timedOut) {
        finish(rejectPromise, new ConversionTimeoutError());
        return;
      }
      if (code !== 0) {
        const suffix = diagnostic.trim() ? ` ${diagnostic.trim()}` : "";
        finish(
          rejectPromise,
          new ConversionExecutionError(`The converter exited unsuccessfully.${suffix}`),
        );
        return;
      }
      finish(resolvePromise);
    });
  });
}

export async function convertSample(
  sample,
  { timeoutMs = DEFAULT_CONVERSION_TIMEOUT_MS } = {},
) {
  const inputPath = join(PUBLIC_ROOT, "samples", sample.fileName);
  const outputDirectory = await mkdtemp(join(tmpdir(), "paperplain-"));
  const startedAt = performance.now();

  try {
    await executeEngine(inputPath, outputDirectory, timeoutMs);

    const outputPath = join(
      outputDirectory,
      `${basename(sample.fileName, extname(sample.fileName))}.md`,
    );
    const [source, markdown] = await Promise.all([
      readFile(inputPath),
      readFile(outputPath, "utf8"),
    ]);

    return {
      sampleId: sample.id,
      markdown,
      run: {
        engine: "OpenDataLoader PDF",
        engineVersion: ENGINE_VERSION,
        mode: "local",
        elapsedMs: Math.round(performance.now() - startedAt),
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
