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
  }

  async function runConversion() {
    if (!selected) return;

    const sampleId = selected.id;
    setLiveResult(null);
    setCopyState("Copy Markdown");
    setRunState("running");
    setRunMessage(
      "Request sent. Waiting for the hosted converter. Markdown will appear only after the real request succeeds.",
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
          response.status === 403
            ? "The server refused this page origin."
            : response.status === 429
              ? "The converter is busy. Try this sample again shortly."
              : response.status === 503
                ? "The hosted converter is not configured."
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
          <span className="wordmark-stamp" aria-hidden="true">
            P
          </span>
          <span className="wordmark-name">
            Paperplain
            <small>Fixed-sample demonstration</small>
          </span>
        </a>
        <div className="demo-status">
          <span className="status-dot" aria-hidden="true" />
          Public fixed-sample demo
        </div>
      </header>

      <main>
        {/* ---------------- hero ---------------- */}
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">PDF → MARKDOWN / FIXED-SAMPLE DEMO</p>
            <h1 id="hero-title">
              <span className="hero-paper">Paper in.</span>
              <span className="hero-plain">plain out.</span>
            </h1>
            <p className="hero-intro">
              Pick one specimen from the collection below. The server converts
              that exact document — nothing else — and the Markdown appears only
              after the real request returns, with a receipt you can inspect and
              copy.
            </p>
            <a className="primary-link" href="#collection">
              Open the collection
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <aside className="proof-card" aria-label="Demo contract">
            <p className="proof-heading">THE WHOLE DEMO</p>
            <ol className="proof-ledger">
              <li data-active={workflowStep === 1}>
                <span>01</span>
                <strong>Choose</strong>
                <p>Pick one known fixture.</p>
              </li>
              <li data-active={workflowStep === 2}>
                <span>02</span>
                <strong>Convert</strong>
                <p>One bounded server request.</p>
              </li>
              <li data-active={workflowStep === 3}>
                <span>03</span>
                <strong>Use</strong>
                <p>Inspect the receipt, copy Markdown.</p>
              </li>
            </ol>
            <p className="proof-fineprint">
              No result exists in this page before a successful conversion.
            </p>
          </aside>
        </section>

        {/* ---------------- seam between paper world and plain world ---------------- */}
        <div className="seam" aria-hidden="true">
          <span className="seam-edge seam-paper">PAPER</span>
          <span className="seam-beam" />
          <span className="seam-edge seam-plain">PLAIN</span>
        </div>

        {/* ---------------- specimen drawer ---------------- */}
        <section className="drawer" id="collection" aria-labelledby="drawer-title">
          <div className="section-head drawer-head">
            <div>
              <p className="eyebrow">01 / THE COLLECTION</p>
              <h2 id="drawer-title">Three fixtures. No preloaded answer.</h2>
            </div>
            <p className="section-note">
              Each plate is one allowlisted fictional PDF from the fixed corpus.
              Selecting it reveals its source preview and the single action this
              demo permits.
            </p>
          </div>

          <div className="specimen-row" aria-label="Fictional sample PDFs">
            {sampleData.map((sample, index) => {
              const isSelected = sample.id === selected?.id;
              return (
                <button
                  className="specimen-plate"
                  data-selected={isSelected}
                  data-tone={sample.tone}
                  key={sample.id}
                  type="button"
                  aria-pressed={isSelected}
                  aria-controls="conversion-bench"
                  disabled={runState === "running"}
                  onClick={() => chooseSample(sample.id)}
                >
                  <span className="plate-tone" aria-hidden="true" />
                  <span className="plate-top">
                    <span className="plate-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="plate-mark" aria-hidden="true">
                      {isSelected ? "—" : "+"}
                    </span>
                  </span>
                  <span className="plate-copy">
                    <small>{sample.eyebrow}</small>
                    <strong>{sample.title}</strong>
                    <span>{sample.layout}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {!selected ? (
            <div className="bench-empty" id="conversion-bench">
              <span className="bench-empty-glyph" aria-hidden="true">
                ¶
              </span>
              <div>
                <p>WAITING FOR A SOURCE</p>
                <h3>Choose a fixture to begin.</h3>
                <span>
                  No PDF is loaded and no Markdown exists in this workspace yet.
                </span>
              </div>
            </div>
          ) : (
            <div className="bench" id="conversion-bench">
              {/* -------- source under glass -------- */}
              <article className="source-plate">
                <header className="panel-head source-panel-head">
                  <div>
                    <span className="panel-no">01</span>
                    <p>Selected source PDF</p>
                  </div>
                  <span className="panel-meta">{selected.layout}</span>
                </header>
                <div className="glass-frame" aria-busy={runState === "running"}>
                  <div className="source-doc" data-sample={selected.id}>
                    <img
                      src={selected.previewUrl}
                      alt={`Rendered first page of ${selected.title}`}
                    />
                    {runState === "running" ? (
                      <div className="scan-visual" aria-hidden="true">
                        {Array.from({ length: 6 }, (_, index) => (
                          <span className={`scan-region region-${index + 1}`} key={index} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <footer className="source-caption">
                  <div>
                    <p>{selected.eyebrow}</p>
                    <h3>{selected.title}</h3>
                    <span>{selected.description}</span>
                  </div>
                  <a href={selected.pdfUrl} target="_blank" rel="noreferrer">
                    Inspect source PDF
                    <span aria-hidden="true">↗</span>
                  </a>
                </footer>
              </article>

              {/* -------- the ledger -------- */}
              <article
                className="ledger"
                data-state={runState}
                aria-busy={runState === "running"}
              >
                <header className="panel-head ledger-head">
                  <div>
                    <span className="panel-no">02</span>
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
                    <div className="ledger-banner" role="status">
                      <span className="banner-mark" aria-hidden="true">
                        ✓
                      </span>
                      <div>
                        <strong>Fresh run complete</strong>
                        <p>{runMessage}</p>
                      </div>
                    </div>
                    <pre className="markdown-output">
                      <code>{liveResult.markdown}</code>
                    </pre>
                    <div className="receipt" aria-label="Run receipt">
                      <span className="fresh-stamp" aria-hidden="true">
                        FRESH RUN ✓
                      </span>
                      <div className="receipt-rule">
                        <p>SERVER RUN RECEIPT</p>
                        <span>
                          {liveResult.run.elapsedMs.toLocaleString()} ms
                        </span>
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
                  <div className="gate" data-state={runState}>
                    <span className="gate-no" aria-hidden="true">
                      02
                    </span>
                    <p className="gate-label">
                      {runState === "running"
                        ? "REQUEST SENT"
                        : runState === "error"
                          ? "LIVE RUN FAILED"
                          : "READY FOR A REAL RUN"}
                    </p>
                    <h3>
                      {runState === "running"
                        ? "Waiting for fresh Markdown."
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
                      onClick={runConversion}
                    >
                      {runState === "running"
                        ? "Waiting for result…"
                        : runState === "error"
                          ? "Try this conversion again"
                          : "Run demo conversion"}
                    </button>
                    <small>
                      {runState === "running" ? (
                        "The scan is a waiting visualization, not measured progress."
                      ) : (
                        <>
                          Only <code>{selected.id}</code> is sent. No visitor
                          document is uploaded.
                        </>
                      )}
                    </small>
                  </div>
                )}
              </article>
            </div>
          )}
        </section>

        {/* ---------------- provenance ---------------- */}
        <section className="provenance" aria-labelledby="provenance-title">
          <div className="prov-lead">
            <p className="eyebrow">THE BOUNDED PRODUCT</p>
            <h2 id="provenance-title">
              One real request.
              <br />
              One inspectable outcome.
            </h2>
            <p>
              The browser sends only the selected sample ID to the same-origin
              route. That route checks the fixed allowlist, signs one short-lived
              request, and calls the managed converter. What returns is the
              Markdown and a receipt — nothing stored, nothing invented.
            </p>
          </div>
          <div className="prov-columns">
            <div>
              <h3>In the archive</h3>
              <ul>
                <li>Three fictional, generated PDF fixtures</li>
                <li>One fixed-corpus server conversion route</li>
                <li>Markdown revealed only after a successful run</li>
                <li>A copy action and an inspectable run receipt</li>
              </ul>
            </div>
            <div>
              <h3>Never in the archive</h3>
              <ul>
                <li>No uploads or visitor documents</li>
                <li>No preloaded or fallback conversion result</li>
                <li>No browser-visible signing secret</li>
                <li>No storage, accounts, or invented capabilities</li>
              </ul>
            </div>
          </div>
          <p className="benchmark-note">
            Powered by{" "}
            <a
              href="https://github.com/opendataloader-project/opendataloader-pdf#extraction-benchmarks"
              target="_blank"
              rel="noreferrer"
            >
              OpenDataLoader PDF
            </a>
            . The upstream project reports 0.015 seconds per page in its fast
            local benchmark—more than 1,000 pages per minute under those benchmark
            conditions. This hosted demo runs one fixed sample at a time and may
            take longer while the demo server wakes.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-brand">
          <span className="wordmark-stamp" aria-hidden="true">
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
