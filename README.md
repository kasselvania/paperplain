# Paperplain

Paperplain is a small, independent PDF-to-Markdown integration demo. It keeps
the product boundary intentionally narrow: three generated fictional PDFs, one
server-side transform, and inspectable Markdown output. There is no upload
route and no path for visitor documents.

Paperplain does **not** implement the PDF conversion engine. It uses the
converter shipped by
[`@opendataloader/pdf`](https://www.npmjs.com/package/@opendataloader/pdf), the
Node package from the
[OpenDataLoader PDF project](https://github.com/opendataloader-project/opendataloader-pdf).
The pinned 2.5.1 package and its upstream repository identify OpenDataLoader PDF
as Apache-2.0 licensed. Paperplain is an independent demo and is not affiliated
with, sponsored by, or endorsed by OpenDataLoader PDF or its maintainers. See
[`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for exact attribution.

## What is in this repository

- A localhost demo that previews and converts the three fixed samples.
- An owner-only static Sites presentation with captured, verified output. It is
  still not a live converter.
- A Docker and Render Blueprint candidate for a separately deployed,
  authenticated fixed-sample conversion API.

The Render candidate is source preparation only. This repository does not prove
that a Render service exists or that the Sites presentation is connected to it.

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

The suite checks both runtime modes. It exercises the localhost surface and
converts all three PDFs through the actual Java engine. Hosted-mode tests cover
the fixed corpus, exact-origin CORS, signed-request expiry, nonce replay
rejection, empty-body contract, concurrency, rate limiting, health response,
and Render configuration.

## Architecture

- `server.mjs` keeps local and hosted exposure rules separate.
- `lib/samples.mjs` is the single source of truth for the three permitted PDFs.
- `lib/converter.mjs` runs the packaged OpenDataLoader PDF JAR with a hard
  deadline and one engine thread, then deletes its temporary output.
- `lib/request-auth.mjs` verifies the hosted request signature and one-time
  nonce.
- `public/` contains the dependency-free localhost interface and generated
  fixtures.
- `presentation/` is the separate static Sites portfolio surface.
- `Dockerfile` contains only the hosted server, allowlist, samples, production
  dependencies, Node, and Java.
- `render.yaml` describes one manually deployed free-tier Docker web service.

OpenDataLoader PDF 2.5.1 runs in ordinary local-processing mode. Its packaged
Node integration starts a Java process; the bounded runner here invokes that
same packaged JAR directly so it can enforce a hard process timeout.

## Static Sites presentation

`presentation/` lets a visitor browse the three fixtures and inspect Markdown
captured from verified local conversions. It has no upload control, conversion
route, Java process, visitor document handling, persistence, secret, or private
network link. Its current owner-only deployment remains a static presentation;
the Render candidate does not change that fact.

## Render deployment candidate

The hosted image is API-only. It binds to `0.0.0.0:$PORT` because Render routes
web-service traffic to that listener, but it exposes only:

- `GET /healthz`, returning an empty `204` response; and
- `POST /api/convert/<sample-id>` for one of the three server-side allowlisted
  sample IDs.

Hosted mode does not serve the local UI, sample manifest, PDFs, previews, or any
arbitrary file path. The conversion request accepts no body. There is still no
upload, visitor document, remote URL, OCR service, database, persistent disk,
or account system.

### Required Render environment variables

The repository names these variables but commits no values:

- `PAPERPLAIN_ALLOWED_ORIGIN` — the exact HTTPS origin of the private Sites
  presentation, with no path or trailing slash.
- `PAPERPLAIN_REQUEST_SECRET` — exactly 64 lowercase hexadecimal characters
  encoding 32 random bytes, stored as a Render secret and shared verbatim only
  with a future trusted server-side signer. Do not add quotes, spaces, or line
  breaks.

`PORT` is supplied by Render. The image selects hosted mode itself. The service
refuses to start if either required value is missing or malformed.

### Signed request contract

Every hosted conversion request must provide:

- `Origin`
- `X-Paperplain-Timestamp` — current Unix time in seconds
- `X-Paperplain-Nonce` — 22 to 64 URL-safe random characters
- `X-Paperplain-Signature` — `v1=` followed by a lowercase HMAC-SHA256 digest

The HMAC input is the following newline-delimited canonical string:

```text
v1
<timestamp>
<nonce>
POST
/api/convert/<sample-id>
<exact allowed origin>
<SHA-256 of the empty request body>
```

The signing helper validates that exact 64-character lowercase hexadecimal
format, decodes it to the original 32-byte key, and then computes the HMAC.

The backend accepts a timestamp for 60 seconds, allows at most 10 seconds of
future clock skew, and remembers accepted nonces in memory for the window. A
nonce cannot be used twice. This design assumes the free tier's single service
instance; scaling to multiple instances would require a separately designed
shared replay store.

The exact origin check is defense in depth, not authentication: non-browser
clients can forge an `Origin` header. The HMAC is the authorization boundary.

### Important Sites boundary

The signing secret must never appear in browser JavaScript, a public bundle, a
URL, or client storage. Therefore the current static Sites page cannot call the
Render conversion route directly. A later release would need a separately
approved server-side Sites route or another trusted server-side signer holding
the same secret. Until that exists and is deployed, the Sites page must continue
to say that its outputs are captured and the live converter is not hosted in
the preview.

### Resource and data controls

- One conversion may run at a time; additional concurrent work receives `429`.
- At most six authenticated conversions are admitted per minute per instance.
- The Java process receives one engine thread and a 60-second hard deadline.
- The container caps Node's old-space heap and the Java heap for Render's
  512 MB free instance.
- Conversion files are created only under the ephemeral temporary directory and
  removed after each request.
- The container runs as the unprivileged `node` user and includes no local UI,
  build tools, presentation, tests, or development corpus generator.
- Health and hosted error responses expose no Java version, filesystem path,
  secret state, stack trace, or converter diagnostic.

Render documents that free web services have 512 MB RAM and 0.1 CPU, spin down
after 15 idle minutes, and use an ephemeral filesystem. The next request after
idle can take about a minute to wake. This candidate treats those properties as
demo constraints, not performance claims. See Render's official
[free-tier](https://render.com/docs/free),
[Docker](https://render.com/docs/docker),
[web-service](https://render.com/docs/web-services), and
[health-check](https://render.com/docs/health-checks) documentation.

## Render dashboard handoff

Nothing in this section has been performed by the repository preparation.

1. Create or sign in to the intended Render account yourself.
2. Choose **New → Blueprint**, connect the public `kasselvania/paperplain`
   repository, and select the root `render.yaml`.
3. Confirm the Blueprint contains exactly one free Docker web service named
   `paperplain-converter`, with auto-deploy disabled, `/healthz` as its health
   check, and no disk, database, custom domain, or additional service.
4. Enter `PAPERPLAIN_ALLOWED_ORIGIN` as the exact private Sites origin.
5. On this Mac, generate 32 random bytes as exactly 64 lowercase hexadecimal
   characters and copy them without a trailing line break:

   ```bash
   openssl rand -hex 32 | tr -d '\n' | pbcopy
   ```

   Paste the clipboard contents verbatim into `PAPERPLAIN_REQUEST_SECRET` and
   retain the same value in an appropriate secret manager for a future trusted
   signer. The pasted value must match `^[0-9a-f]{64}$`: no quotes, spaces, or
   line breaks. Do not put it in GitHub or the Sites client bundle.
6. Choose the desired region, review the public `onrender.com` exposure, then
   explicitly apply the Blueprint when ready. Applying it creates and deploys a
   live public backend.
7. After deployment, confirm `/healthz` returns `204` and an unsigned conversion
   request returns `401`. A successful conversion should wait until the trusted
   server-side signer is separately implemented and reviewed.

Render supports secret placeholders with `sync: false`; its official
[environment-variable documentation](https://render.com/docs/configure-environment-variables)
describes how the dashboard collects those values during initial Blueprint
creation.

## Regenerate the fictional corpus

The included PDFs and preview images are generated entirely from local vector
shapes and fictional copy:

```bash
python3 -m pip install -r requirements-dev.txt
python3 scripts/generate_samples.py
```

Preview rendering also requires Poppler's `pdftoppm` command.

## Paperplain license status

No software license has been selected for Paperplain. The Apache-2.0 license
identified by the pinned dependency applies to OpenDataLoader PDF; it does not
automatically license the independent Paperplain source.
