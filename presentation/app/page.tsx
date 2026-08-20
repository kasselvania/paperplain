"use client";

/* The generated fixture previews are intentionally shown without image optimization. */
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";

import sampleData from "./sample-data.json";

type Sample = (typeof sampleData)[number];

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
  const selected = sampleData.find((sample) => sample.id === selectedId) ?? sampleData[0];

  async function copyMarkdown(sample: Sample) {
    try {
      await navigator.clipboard.writeText(sample.markdown);
      setCopyState("Copied to clipboard");
    } catch {
      setCopyState("Copy unavailable");
    }

    window.setTimeout(() => setCopyState("Copy captured Markdown"), 1800);
  }

  function chooseSample(id: string) {
    setSelectedId(id);
    setCopyState("Copy captured Markdown");
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
          Static review candidate
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">PDF → MARKDOWN / VERIFIED STATIC PRESENTATION</p>
            <h1 id="hero-title">
              Known documents in.
              <span>Clear context out.</span>
            </h1>
            <p className="hero-intro">
              Paperplain shows how a curated PDF set can become structured,
              inspectable Markdown—useful as context for AI and coding assistants.
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
              Three PDFs. Three layouts. Three outputs captured from real local
              conversion runs.
            </p>
            <div className="boundary-stamp">
              <span>LIVE CONVERTER</span>
              <strong>NOT HOSTED HERE</strong>
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
              <p className="eyebrow">CAPTURED SAMPLE EXPLORER</p>
              <h2 id="explorer-title">Inspect the source and every returned line.</h2>
            </div>
            <p className="section-note">
              Selecting a sample changes only the static content shown on this page.
              No request is sent to a converter.
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
                  <p>Captured Markdown</p>
                </div>
                <button type="button" onClick={() => copyMarkdown(selected)}>
                  {copyState}
                </button>
              </header>
              <div className="markdown-note">
                <span className="verified-mark" aria-hidden="true">
                  ✓
                </span>
                Displayed verbatim from a verified local OpenDataLoader PDF 2.5.1 run.
              </div>
              <pre className="markdown-output">
                <code>{selected.markdown}</code>
              </pre>
              <div className="run-receipt" aria-label="Static capture receipt">
                <div className="receipt-heading">
                  <p>STATIC CAPTURE RECEIPT</p>
                  <span>Not a live run</span>
                </div>
                <dl>
                  <div>
                    <dt>Engine</dt>
                    <dd>
                      {selected.receipt.engine} {selected.receipt.engineVersion}
                    </dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{selected.receipt.sourceBytes.toLocaleString()} bytes</dd>
                  </div>
                  <div>
                    <dt>Markdown</dt>
                    <dd>{selected.receipt.markdownCharacters.toLocaleString()} characters</dd>
                  </div>
                  <div>
                    <dt>Source SHA-256</dt>
                    <dd>{selected.receipt.sourceSha256}</dd>
                  </div>
                  <div>
                    <dt>Output SHA-256</dt>
                    <dd>{selected.receipt.outputSha256}</dd>
                  </div>
                </dl>
              </div>
            </article>
          </div>
        </section>

        <section className="truth-section" aria-labelledby="truth-title">
          <div className="truth-lead">
            <p className="eyebrow">PROOF, NOT PROMISE</p>
            <h2 id="truth-title">The live converter is not hosted in this preview.</h2>
            <p>
              This page demonstrates the Paperplain interaction, the fixed sample
              corpus, and outputs produced by the real local integration. It does not
              represent a production conversion service.
            </p>
          </div>
          <div className="truth-columns">
            <div>
              <h3>What is here</h3>
              <ul>
                <li>Three fictional, generated PDFs</li>
                <li>Pre-rendered page previews</li>
                <li>Captured Markdown and verification hashes</li>
                <li>A static, interactive portfolio presentation</li>
              </ul>
            </div>
            <div>
              <h3>What is not here</h3>
              <ul>
                <li>No uploads or visitor documents</li>
                <li>No converter process or Java runtime</li>
                <li>No accounts, storage, database, or secrets</li>
                <li>No proxy, tunnel, or private-network connection</li>
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
