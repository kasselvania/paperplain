# Paperplain

Paperplain is a small, independent PDF-to-Markdown integration demo. It lets a
visitor inspect three fictional sample PDFs, run a real server-side conversion
for one selected sample, and examine the raw Markdown plus a compact run
receipt.

Paperplain does **not** implement the PDF conversion engine. It uses
[`@opendataloader/pdf`](https://www.npmjs.com/package/@opendataloader/pdf), the
Node wrapper published by the
[OpenDataLoader PDF project](https://github.com/opendataloader-project/opendataloader-pdf).
The pinned 2.5.1 package and its upstream repository identify OpenDataLoader PDF
as Apache-2.0 licensed. Paperplain is an independent demo and is not affiliated
with, sponsored by, or endorsed by OpenDataLoader PDF or its maintainers. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for exact attribution.

## What the demo does

- Previews three generated, fictional PDFs with visibly different layouts.
- Converts only those allowlisted samples on the local server.
- Shows the returned Markdown without hiding the raw result.
- Reports the source hash, source size, elapsed time, and Markdown size for each
  completed run.
- Binds the service to `127.0.0.1` only.

There is no upload route, visitor document handling, account system,
persistence layer, OCR service, or external document URL.

## Run locally on macOS

Requirements:

- Node.js 22.13 or newer
- Java 11 or newer

Install dependencies once:

```bash
npm install
```

Then double-click `Start Paperplain.command` in Finder. It starts the service at
`http://127.0.0.1:4173`, waits for the local endpoint to become ready, and opens
the default browser. Keep the Terminal window open; press Control-C or close the
window to stop Paperplain.

The launcher starts Node and the converter's Java process. A bare HTML file
cannot do that, so opening `public/index.html` directly is not a working
substitute.

The equivalent Terminal command is:

```bash
npm start
```

## Verify

```bash
npm test
```

The test suite exercises the fixed-corpus boundary and converts every included
PDF through the actual local OpenDataLoader engine.

## Architecture

- `server.mjs` serves the site and exposes one allowlisted conversion route.
- `lib/samples.mjs` is the single source of truth for the three permitted PDFs.
- `public/` contains the dependency-free interface and generated fixtures.
- `Start Paperplain.command` is a localhost-only macOS convenience launcher.
- `tests/` covers the public surface, rejected sample IDs, launcher boundary,
  and real conversions.

OpenDataLoader PDF 2.5.1 is used in ordinary local mode. Its Node wrapper starts
a Java process, so this backend needs a Java-capable host. This repository does
not pretend that browser-only or edge hosting can perform the live conversion.

## Regenerate the fictional corpus

The included PDFs and preview images are generated entirely from local vector
shapes and fictional copy:

```bash
python3 -m pip install -r requirements-dev.txt
python3 scripts/generate_samples.py
```

Preview rendering also requires Poppler's `pdftoppm` command.

## Deliberately deferred

Any networked version is a separate project, in this order:

1. Prove a LAN-only service inside an isolated container.
2. Perform a security and threat-model review of that exact boundary.
3. Make a separately authorized decision about any private or published path.

ChatGPT Sites is not assumed to reach a private LAN. Any bridge between a hosted
front end and a private converter would be a new network and security boundary
that must be designed and validated separately. Paperplain currently includes
no container, VPN, tunnel, router, home-lab, hosted service, or public endpoint.
See [`docs/TECHNICAL_BOUNDARIES.md`](docs/TECHNICAL_BOUNDARIES.md).

## Paperplain license status

No software license has been selected for Paperplain. The Apache-2.0 license
identified by the pinned dependency applies to OpenDataLoader PDF; it does not
automatically license the independent Paperplain source.
