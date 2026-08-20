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

const idleMessage =
  "The selected fixture stays unchanged until you ask the server to convert it.";

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [liveResult, setLiveResult] = useState<LiveConversion | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [runMessage, setRunMessage] = useState(idleMessage);
  const [copyState, setCopyState] = useState("Copy Markdown");

  const selected = sampleData.find((sample) => sample.id === selectedId) ?? null;
  const workflowStep = liveResult ? 3 : selected ? 2 : 1;

  function chooseSample(id: string) {
    setSelectedId(id);
    setLiveResult(null);
    setRunState("idle");
    setRunMessage(idleMessage);
    setCopyState("Copy Markdown");
  }

  async function copyMarkdown() {
    if (!liveResult) return;

    try {
      await navigator.clipboard.writeText(liveResult.markdown);
      setCopyState("Copied to clipboard");
    } catch {
      setCopyState("Copy unavailable");
    }

    window.setTimeout(() => setCopyState("Copy Markdown"), 1800);
  }

  async function runPrivateConversion() {
    if (!selected) return;

    const sampleId = selected.id;
    setLiveResult(null);
    setCopyState("Copy Markdown");
    setRunState("running");
    setRunMessage(
      "A real server request is running. The managed converter may be waking from idle.",
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
            ? "The owner-authenticated Sites session was not accepted."
            : response.status === 403
              ? "The server refused this page origin."
              : response.status === 429
                ? "The converter is busy. Try this sample again shortly."
                : response.status === 503
                  ? "The private server route is not configured."
                  : "The converter did not return a result. Nothing has been substituted.";
        setRunState("error");
        setRunMessage(message);
        return;
      }

      setLiveResult(payload);
      setRunState("success");
      setRunMessage("Fresh Markdown returned from the real converter.");
    } catch {
      setRunState("error");
      setRunMessage(
        "The converter did not return a result. Nothing has been substituted.",
      );
    }
  }

  return (
    <div className="site-shell" data-tone={selected?.tone ?? "moss"} id="top">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Paperplain home">
          <span className="wordmark-mark" aria-hidden="true">
            P
          </span>
          <span>Paperplain</span>
        </a>
        <div className="candidate-status">
          <span className="status-dot" aria-hidden="true" />
          Owner-only integration
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">PDF → MARKDOWN / FIXED SAMPLE DEMO</p>
            <h1 id="hero-title">
              Choose the source.
              <span>Reveal the structure.</span>
            </h1>
            <p className="hero-intro">
              Select one fictional PDF, run the real server-side converter, then
              inspect and copy only the Markdown that comes back from that run.
            </p>
            <a className="primary-link" href="#sample-explorer">
              Start with a sample
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <aside className="hero-proof" aria-label="Demo contract">
            <p className="proof-label">THE WHOLE DEMO</p>
            <ol className="hero-flow">
              <li data-active={workflowStep === 1}>
                <span>01</span>
                <strong>Choose</strong>
                <p>Pick one known fixture.</p>
              </li>
              <li data-active={workflowStep === 2}>
                <span>02</span>
                <strong>Convert</strong>
                <p>Run one bounded server request.</p>
              </li>
              <li data-active={workflowStep === 3}>
                <span>03</span>
                <strong>Use</strong>
                <p>Inspect the receipt and copy Markdown.</p>
              </li>
            </ol>
            <p className="proof-boundary">
              No result is present before a successful conversion.
            </p>
          </aside>
        </section>

        <section
          className="explorer"
          id="sample-explorer"
          aria-labelledby="explorer-title"
        >
          <div className="section-heading explorer-heading">
            <div>
              <p className="eyebrow">01 / CHOOSE A SOURCE</p>
              <h2 id="explorer-title">Three fixtures. No preloaded answer.</h2>
            </div>
            <p className="section-note">
              Each card represents one allowlisted fictional PDF. Selecting a card
              reveals only its source preview and the action needed to convert it.
            </p>
          </div>

          <div className="sample-picker" aria-label="Fictional sample PDFs">
            {sampleData.map((sample, index) => {
              const isSelected = sample.id === selected?.id;
              return (
                <button
                  className="sample-button"
                  data-selected={isSelected}
                  key={sample.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="conversion-workspace"
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

          {!selected ? (
            <div className="workspace-empty" id="conversion-workspace">
              <span aria-hidden="true">01</span>
              <div>
                <p>WAITING FOR A SOURCE</p>
                <h3>Choose a fixture to begin.</h3>
                <span>
                  No PDF is loaded and no Markdown exists in this workspace yet.
                </span>
              </div>
            </div>
          ) : (
            <div className="sample-workspace" id="conversion-workspace">
              <article className="source-panel">
                <header className="panel-header">
                  <div>
                    <span className="panel-number">01</span>
                    <p>Selected source PDF</p>
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
                    Inspect source PDF
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </article>

              <article className="markdown-panel" data-state={runState}>
                <header className="panel-header markdown-header">
                  <div>
                    <span className="panel-number">02</span>
                    <p>Conversion result</p>
                  </div>
                  {liveResult ? (
                    <button type="button" onClick={copyMarkdown}>
                      {copyState}
                    </button>
                  ) : null}
                </header>

                {liveResult ? (
                  <>
                    <div className="conversion-success" role="status">
                      <span className="verified-mark" aria-hidden="true">
                        ✓
                      </span>
                      <div>
                        <strong>Live conversion complete</strong>
                        <p>{runMessage}</p>
                      </div>
                    </div>
                    <pre className="markdown-output">
                      <code>{liveResult.markdown}</code>
                    </pre>
                    <div className="run-receipt" aria-label="Live conversion receipt">
                      <div className="receipt-heading">
                        <p>SERVER RUN RECEIPT</p>
                        <span>{liveResult.run.elapsedMs.toLocaleString()} ms</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Engine</dt>
                          <dd>
                            {liveResult.run.engine} {liveResult.run.engineVersion}
                          </dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{liveResult.run.sourceBytes.toLocaleString()} bytes</dd>
                        </div>
                        <div>
                          <dt>Markdown</dt>
                          <dd>
                            {liveResult.run.markdownCharacters.toLocaleString()} chars
                          </dd>
                        </div>
                        <div>
                          <dt>Source SHA-256</dt>
                          <dd>{liveResult.run.sourceSha256}</dd>
                        </div>
                        <div>
                          <dt>Output SHA-256</dt>
                          <dd>{liveResult.run.outputSha256}</dd>
                        </div>
                      </dl>
                    </div>
                  </>
                ) : (
                  <div className="conversion-gate" data-state={runState}>
                    <div className="gate-index" aria-hidden="true">
                      {runState === "running" ? "···" : "02"}
                    </div>
                    <p className="gate-label">
                      {runState === "running"
                        ? "LIVE REQUEST IN PROGRESS"
                        : runState === "error"
                          ? "LIVE RUN FAILED"
                          : "READY FOR A REAL RUN"}
                    </p>
                    <h3>
                      {runState === "running"
                        ? `Converting ${selected.title}`
                        : runState === "error"
                          ? "No result was returned."
                          : "No Markdown yet."}
                    </h3>
                    <p className="gate-message" role="status" aria-live="polite">
                      {runMessage}
                    </p>
                    <button
                      type="button"
                      disabled={runState === "running"}
                      onClick={runPrivateConversion}
                    >
                      {runState === "running"
                        ? "Conversion running…"
                        : runState === "error"
                          ? "Try this conversion again"
                          : "Run private conversion"}
                    </button>
                    <small>
                      Only <code>{selected.id}</code> is sent. No visitor document is
                      uploaded.
                    </small>
                  </div>
                )}
              </article>
            </div>
          )}
        </section>

        <section className="truth-section" aria-labelledby="truth-title">
          <div className="truth-lead">
            <p className="eyebrow">THE BOUNDED PRODUCT</p>
            <h2 id="truth-title">One real request. One inspectable outcome.</h2>
            <p>
              The browser sends only the selected sample ID to the same-origin
              Sites route. That server route checks the owner session, signs the
              request, and calls the managed converter. The browser receives only
              the returned Markdown and run receipt.
            </p>
          </div>
          <div className="truth-columns">
            <div>
              <h3>What is here</h3>
              <ul>
                <li>Three fictional, generated PDF fixtures</li>
                <li>One fixed-corpus server conversion route</li>
                <li>Markdown revealed only after a successful run</li>
                <li>A copy action and an inspectable run receipt</li>
              </ul>
            </div>
            <div>
              <h3>What is not here</h3>
              <ul>
                <li>No uploads or visitor documents</li>
                <li>No preloaded or fallback conversion result</li>
                <li>No browser-visible signing secret</li>
                <li>No storage, accounts, or invented capabilities</li>
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
            The conversion engine used by this demo is{" "}
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
