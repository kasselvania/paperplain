# Paperplain

Paperplain is a small, independent PDF-to-Markdown integration demo. Its entire
product boundary is three generated fictional PDFs, one server-side transform,
and fresh inspectable Markdown. There is no upload route and no path for visitor
documents.

Live demonstration: [paperplain.peterkassel.com](https://paperplain.peterkassel.com/)

Paperplain does **not** implement the PDF conversion engine. It uses
[`@opendataloader/pdf`](https://www.npmjs.com/package/@opendataloader/pdf) from
the [OpenDataLoader PDF project](https://github.com/opendataloader-project/opendataloader-pdf).
The pinned 2.5.1 package and upstream repository identify that dependency as
Apache-2.0 licensed. Paperplain is not affiliated with, sponsored by, or
endorsed by OpenDataLoader PDF or its maintainers. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution.

## The demo contract

1. The page opens with no selected PDF and no Markdown result.
2. A visitor chooses one of three fictional fixtures and inspects its source.
3. One explicit action requests a real server conversion.
4. A CSS scan communicates waiting without claiming measured progress.
5. Fresh Markdown, a run receipt, and the copy action appear only after success.
6. Failure reveals no captured or substitute output.

The public server route accepts only one of these IDs:

- `field-brief`
- `studio-invoice`
- `block-bulletin`

It accepts no body, PDF, URL, filename, or arbitrary visitor content. There is
no persistence, database, storage bucket, account system, OCR service, hybrid
processing, home-lab connection, tunnel, proxy, or direct browser-to-Render
request.

## Architecture

- `presentation/` contains the public Sites portfolio and server-side signer.
- `server.mjs` provides separate localhost and hosted converter modes.
- `lib/samples.mjs` is the converter's fixed-corpus allowlist.
- `lib/converter.mjs` runs the packaged OpenDataLoader PDF Java engine with a
  hard deadline and removes temporary output.
- `lib/request-auth.mjs` verifies the hosted HMAC, timestamp, and nonce.
- `Dockerfile` and `render.yaml` describe the bounded Render converter.
- `public/` contains the dependency-free localhost UI and generated fixtures.

The Sites route keeps the signing secret server-side, wakes the Render service,
and signs an empty fixed-sample request. Render verifies the signature and
returns a sanitized result. Browser assets contain neither the secret nor the
Render origin.

## Public safety boundary

The Sites action is intentionally anonymous so a potential client can run the
demo without an account. Same-origin checking is defense in depth, not user
authentication: a non-browser caller can forge an `Origin` header.

The capability is safe because it is narrow. A public caller can request only
conversion of the three committed fictional fixtures. Render permits one active
conversion and six admitted conversions per minute per instance, rejects nonce
replay, uses ephemeral temporary files, and returns generic errors. The HMAC
prevents direct callers from authorizing work at Render.

This single-instance design is not authority for horizontal scaling. Scaling
would require a separately designed shared replay and rate-limit store.

## Performance context

OpenDataLoader PDF's published extraction table reports `0.015 s/page` for its
fast local mode—more than 1,000 pages per minute under those benchmark
conditions. This is an upstream benchmark, not an independently measured
Paperplain result. The hosted portfolio demo runs one fixed sample at a time and
can take longer while its managed service wakes. Upstream also recommends
batching because each conversion invocation starts a JVM process.

See the upstream
[extraction benchmark](https://github.com/opendataloader-project/opendataloader-pdf#extraction-benchmarks).

## Run locally on macOS

Requirements:

- Node.js 22.13 or newer
- Java 11 or newer

Install dependencies once:

```bash
npm install
```

Then double-click `Start Paperplain.command` in Finder. It starts the service at
`http://127.0.0.1:4173` and opens the default browser. Keep the Terminal window
open; press Control-C to stop it. Opening `public/index.html` directly cannot
start Node or Java and is not a working substitute.

The equivalent Terminal command is:

```bash
npm start
```

## Hosted configuration

Render requires:

- `PAPERPLAIN_ALLOWED_ORIGIN` — the exact public Sites HTTPS origin, with no
  path or trailing slash.
- `PAPERPLAIN_REQUEST_SECRET` — exactly 64 lowercase hexadecimal characters
  encoding 32 random bytes.

Sites requires:

- `PAPERPLAIN_RENDER_ORIGIN` — the exact `https://…onrender.com` service origin,
  with no path or trailing slash.
- `PAPERPLAIN_REQUEST_SECRET` — the exact same secret stored in Render.

Secret values must remain in the two server environments. Do not put them in a
URL, browser code, client storage, logs, or source control.

## Verify

The converter and Sites presentation are intentionally tested separately:

```bash
npm test
cd presentation && npm test
```

The presentation suite is limited to the contract's high-value boundaries:
empty initial state and clean client assets, anonymous HMAC interoperability,
and refusal of off-contract requests. A green build is not proof of hosted
operation; that claim requires a real Sites-to-Render conversion.

## Regenerate the fictional corpus

The included PDFs and previews are generated from local vector shapes and
fictional copy:

```bash
python3 -m pip install -r requirements-dev.txt
python3 scripts/generate_samples.py
```

Preview rendering also requires Poppler's `pdftoppm` command.

## Paperplain license status

No software license has been selected for Paperplain. The Apache-2.0 license
identified above applies to OpenDataLoader PDF; it does not automatically
license the independent Paperplain source.
