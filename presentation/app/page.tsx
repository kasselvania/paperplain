"use client";

/* The generated fixture previews are intentionally shown without image optimization. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

import sampleData from "./sample-data.json";

type LiveConversion = {
  sampleId: string;
  markdown: string;
  run: {
    engine: string;
    engineVersion: string;
    mode: string;
    elapsedMs: number;
    sourceBytes: number;
    markdownCharacters: number;
    sourceSha256: string;
    outputSha256: string;
  };
};
type RunState = "idle" | "running" | "success" | "error";

const valueSteps = [
  {
    number: "01",
    title: "Curate the source",
    copy: "Start with a small, known set of documents whose rights and purpose are clear.",
  },
  {
    number: "02",
    title: "Expose the structure",
    copy: "Turn headings, tables, labels, and reading order into Markdown that can be inspected line by line.",
  },
  {
    number: "03",
    title: "Bring useful context",
    copy: "Use the resulting text as transparent context for AI and coding assistants instead of an opaque attachment.",
  },
];

export default function Home() {
  const [selectedId, setSelectedId] = useState(sampleData[0].id);
  const [copyState, setCopyState] = useState("Copy captured Markdown");
  const [liveResult, setLiveResult] = useState<LiveConversion | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runMessage, setRunMessage] = useState(
    "Runs only for the selected fixed sample through the private Sites route.",
  );
  const selected = sampleData.find((sample) => sample.id === selectedId) ?? sampleData[0];
  const hasLiveResult = liveResult?.sampleId === selected.id;
  const displayedMarkdown = hasLiveResult ? liveResult.markdown : selected.markdown;
  const displayedReceipt = hasLiveResult ? liveResult.run : selected.receipt;

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(displayedMarkdown);
      setCopyState("Copied to clipboard");
    } catch {
      setCopyState("Copy unavailable");
    }

    window.setTimeout(
      () =>
        setCopyState(
          hasLiveResult ? "Copy fresh Markdown" : "Copy captured Markdown",
        ),
      1800,
    );
  }

  function chooseSample(id: string) {
    setSelectedId(id);
    setLiveResult(null);
    setRunState("idle");
    setRunMessage(
      "Runs only for the selected fixed sample through the private Sites route.",
    );
    setCopyState("Copy captured Markdown");
  }

  async function runPrivateConversion() {
    const sampleId = selected.id;
    setLiveResult(null);
    setCopyState("Copy captured Markdown");
    setRunState("running");
    setRunMessage(
      "Waking the bounded converter, then issuing a short-lived signed request…",
    );

    try {
      const response = await fetch(
        "/api/convert/" + encodeURIComponent(sampleId),
        {
          method: "POST",
          headers: { Accept: "application/json" },
          credentials: "same-origin",
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | LiveConversion
        | null;

      if (
        !response.ok ||
        !payload ||
        payload.sampleId !== sampleId ||
        typeof payload.markdown !== "string"
      ) {
        const message =
          response.status === 401
            ? "An authenticated private Sites session is required."
            : response.status === 403
              ? "The private request was refused from this page."
              : response.status === 429
                ? "The converter is busy. Try again shortly."
                : response.status === 503
                  ? "The private Sites route is not configured yet."
                  : "The private conversion is temporarily unavailable.";
        setRunState("error");
        setRunMessage(message);
        return;
      }

      setLiveResult(payload);
      setRunState("success");
      setRunMessage(
        "Fresh Markdown returned through the owner-only server route.",
      );
      setCopyState("Copy fresh Markdown");
    } catch {
      setRunState("error");
      setRunMessage("The private conversion is temporarily unavailable.");
    }
  }

  return (
    <div className="site-shell" data-tone={selected.tone} id="top">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Paperplain home">
          <span className="wordmark-mark" aria-hidden="true">
            P
          </span>
          <span>Paperplain</span>
        </a>
        <div className="candidate-status">
          <span className="status-dot" aria-hidden="true" />
          Private integration candidate
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">PDF → MARKDOWN / OWNER-ONLY INTEGRATION</p>
            <h1 id="hero-title">
              Known documents in.
              <span>Clear context out.</span>
            </h1>
            <p className="hero-intro">
              Paperplain turns a curated PDF set into structured, inspectable
              Markdown while keeping its signing key and converter call on the
              server.
            </p>
            <a className="primary-link" href="#sample-explorer">
              Explore a verified sample
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <aside className="hero-proof" aria-label="Presentation boundary">
            <div className="proof-index" aria-hidden="true">
              03
            </div>
            <p className="proof-label">FIXED FICTIONAL DOCUMENTS</p>
            <p>
              Three PDFs. Three layouts. A captured baseline plus one bounded
              private route for a fresh conversion.
            </p>
            <div className="boundary-stamp">
              <span>SERVER-SIDE PATH</span>
              <strong>OWNER-ONLY</strong>
            </div>
          </aside>
        </section>

        <section className="value-path" aria-labelledby="value-title">
          <div className="section-heading compact">
            <p className="eyebrow">WHY THIS SHAPE WORKS</p>
            <h2 id="value-title">From document to usable context.</h2>
          </div>
          <ol className="value-steps">
            {valueSteps.map((step) => (
              <li key={step.number}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="explorer" id="sample-explorer" aria-labelledby="explorer-title">
          <div className="section-heading explorer-heading">
            <div>
              <p className="eyebrow">FIXED SAMPLE EXPLORER</p>
              <h2 id="explorer-title">Inspect the baseline, then request a fresh run.</h2>
            </div>
            <p className="section-note">
              Browsing stays static. The explicit private action sends only the
              selected allowlisted sample ID through the owner-authenticated Sites
              route.
            </p>
          </div>

          <div className="sample-picker" aria-label="Verified samples">
            {sampleData.map((sample, index) => {
              const isSelected = sample.id === selected.id;
              return (
                <button
                  className="sample-button"
                  data-selected={isSelected}
                  key={sample.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="sample-output"
                  disabled={runState === "running"}
                  onClick={() => chooseSample(sample.id)}
                >
                  <span className="sample-button-index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="sample-button-copy">
                    <small>{sample.eyebrow}</small>
                    <strong>{sample.title}</strong>
                    <span>{sample.layout}</span>
                  </span>
                  <span className="sample-button-mark" aria-hidden="true">
                    {isSelected ? "—" : "+"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sample-workspace" id="sample-output">
            <article className="source-panel">
              <header className="panel-header">
                <div>
                  <span className="panel-number">01</span>
                  <p>Fictional source PDF</p>
                </div>
                <span className="panel-meta">{selected.layout}</span>
              </header>
              <div className="source-frame">
                <img
                  src={selected.previewUrl}
                  alt={`Rendered first page of ${selected.title}`}
                />
              </div>
              <div className="source-caption">
                <div>
                  <p>{selected.eyebrow}</p>
                  <h3>{selected.title}</h3>
                  <span>{selected.description}</span>
                </div>
                <a href={selected.pdfUrl} target="_blank" rel="noreferrer">
                  Open fixture PDF
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </article>

            <article className="markdown-panel">
              <header className="panel-header markdown-header">
                <div>
                  <span className="panel-number">02</span>
                  <p>{hasLiveResult ? "Fresh Markdown" : "Captured Markdown"}</p>
                </div>
                <button type="button" onClick={copyMarkdown}>
                  {copyState}
                </button>
              </header>
              <div className="private-run-bar" data-state={runState}>
                <div>
                  <span>OWNER-ONLY SERVER ACTION</span>
                  <p role="status" aria-live="polite">
                    {runMessage}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={runState === "running"}
                  onClick={runPrivateConversion}
                >
                  {runState === "running"
                    ? "Conversion running…"
                    : "Run private conversion"}
                </button>
              </div>
              <div className="markdown-note">
                <span className="verified-mark" aria-hidden="true">
                  ✓
                </span>
                {hasLiveResult
                  ? "Returned from a fresh, signed OpenDataLoader PDF run."
                  : "Displayed verbatim from a verified local OpenDataLoader PDF 2.5.1 run."}
              </div>
              <pre className="markdown-output">
                <code>{displayedMarkdown}</code>
              </pre>
              <div
                className="run-receipt"
                aria-label={
                  hasLiveResult ? "Fresh private run receipt" : "Static capture receipt"
                }
              >
                <div className="receipt-heading">
                  <p>
                    {hasLiveResult
                      ? "PRIVATE SERVER RUN RECEIPT"
                      : "STATIC CAPTURE RECEIPT"}
                  </p>
                  <span>
                    {hasLiveResult
                      ? liveResult.run.elapsedMs.toLocaleString() + " ms"
                      : "Not a live run"}
                  </span>
                </div>
                <dl>
                  <div>
                    <dt>Engine</dt>
                    <dd>
                      {displayedReceipt.engine} {displayedReceipt.engineVersion}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{displayedReceipt.sourceBytes.toLocaleString()} bytes</dd>
                  </div>
                  <div>
                    <dt>Markdown</dt>
                    <dd>
                      {displayedReceipt.markdownCharacters.toLocaleString()} characters
                    </dd>
                  </div>
                  <div>
                    <dt>Source SHA-256</dt>
                    <dd>{displayedReceipt.sourceSha256}</dd>
                  </div>
                  <div>
                    <dt>Output SHA-256</dt>
                    <dd>{displayedReceipt.outputSha256}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>
        </section>

        <section className="truth-section" aria-labelledby="truth-title">
          <div className="truth-lead">
            <p className="eyebrow">PROOF, NOT PROMISE</p>
            <h2 id="truth-title">The browser never receives the signing secret.</h2>
            <p>
              Browsing uses the captured baseline. A fresh run sends only one fixed
              sample ID to a same-origin Sites route, where the owner session is
              checked before the Render request is signed server-side.
            </p>
          </div>
          <div className="truth-columns">
            <div>
              <h3>What is here</h3>
              <ul>
                <li>Three fictional, generated PDFs</li>
                <li>Pre-rendered page previews</li>
                <li>Captured Markdown and verification hashes</li>
                <li>One owner-only, fixed-sample server action</li>
              </ul>
            </div>
            <div>
              <h3>What is not here</h3>
              <ul>
                <li>No uploads or visitor documents</li>
                <li>No Java runtime or converter in Sites</li>
                <li>No browser-visible secret or direct Render call</li>
                <li>No storage, database, tunnel, or private-network link</li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="wordmark-mark" aria-hidden="true">
            P
          </span>
          <div>
            <strong>Paperplain</strong>
            <p>A small, independent PDF-to-Markdown integration demo.</p>
          </div>
        </div>
        <div className="footer-attribution">
          <p>
            Sample outputs were produced locally with{" "}
            <a
              href="https://github.com/opendataloader-project/opendataloader-pdf"
              target="_blank"
              rel="noreferrer"
            >
              OpenDataLoader PDF
            </a>
            . Paperplain is not affiliated with, sponsored by, or endorsed by the
            upstream project or its maintainers.
          </p>
          <a
            className="source-link"
            href="https://github.com/kasselvania/paperplain"
            target="_blank"
            rel="noreferrer"
          >
            View source and notices ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
