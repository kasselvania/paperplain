# Technical boundaries

## Local demo

Paperplain's original boundary remains available and unchanged in purpose:

- The default Node service binds only to `127.0.0.1`.
- The conversion route accepts a sample ID from one server-side allowlist.
- The allowlist contains exactly the three fictional PDFs committed in
  `public/samples/`.
- OpenDataLoader PDF 2.5.1 performs ordinary local processing through its
  packaged Java engine.
- Per-run temporary conversion output is removed after the response is built.
- There are no uploads, visitor documents, external document URLs, databases,
  tunnels, or non-local listeners in this mode.

`Start Paperplain.command` starts that same service, waits for its localhost
health, and opens `http://127.0.0.1:4173`. It does not change firewall, router,
sharing, or network settings.

## Sites presentation

The separate `presentation/` surface contains copies of the three canonical
fictional PDFs, their pre-rendered page images, and Markdown plus receipt data
captured from verified local runs. Its sample selector and clipboard action
operate only on bundled content.

The current Sites deployment is owner-only and remains the earlier static
version. The candidate source adds one same-origin conversion route, but it is
not configured, saved as a Sites version, or deployed by this work. Sites still
contains no upload, visitor document path, converter process, Java runtime,
database, storage binding, tunnel, or private-LAN connection.

## Prepared Render candidate — not deployed here

The repository now includes a bounded Docker image and `render.yaml` for one
free-tier Render web service. Preparing and pushing these files does not create
a Render account, service, public URL, deployment, or Sites connection.

The hosted image contains only the server modules, production dependency, Java
runtime, allowlist, and three fictional PDF fixtures. Hosted mode serves an
empty `204` health endpoint and the authenticated conversion route. It does not
serve the local UI, sample manifest, previews, PDFs, presentation, or arbitrary
paths.

The hosted route:

- accepts only `POST /api/convert/<allowlisted-id>` with an empty body;
- requires the exact configured HTTPS origin;
- requires a 60-second HMAC-SHA256 request signature and one-time nonce;
- remembers accepted nonces in memory to reject replay;
- runs one conversion at a time and admits six conversions per minute;
- caps each Java process at one thread and a 60-second execution deadline; and
- returns generic errors without engine diagnostics or environment details.

The origin header is not treated as authentication. The signature secret is the
authorization boundary and must remain in server-side secret stores. Its
environment representation is exactly 64 lowercase hexadecimal characters;
the signer and verifier decode that representation to the same 32-byte HMAC
key.

## Private Sites signer candidate

A static browser page cannot safely hold the Render signing secret. The
candidate worker keeps it in Sites server environment only and intercepts
`POST /api/convert/<allowlisted-id>` before the application router. It requires
both platform-authenticated user headers and the exact same-origin `Origin`,
rejects every body and non-allowlisted ID, and returns `503` without contacting
Render when either server variable is missing or malformed.

The worker calls `GET /healthz` before generating the signed request so a Render
free-tier cold start does not consume the backend's 60-second authentication
window. It then signs the empty-body request with a fresh timestamp and nonce,
refuses redirects, bounds both requests with deadlines, and sanitizes the
upstream result before returning it to the browser.

The authenticated-user headers establish a signed-in Sites user. Owner
authorization additionally depends on the Sites access policy remaining custom
owner-only with exactly one allowed account and no groups or external visitors.
A shared or public policy invalidates this release shape.

The in-memory nonce store fits the single-instance free-tier candidate. It is
not authority for horizontal scaling: multiple instances would require a shared
replay store and a new persistence/security decision.

## Still excluded

- Arbitrary PDF upload or visitor documents
- External document URLs or network retrieval
- OCR, hybrid/AI enrichment, accounts, billing, or durable jobs
- Database, persistent disk, object storage, or retained conversion output
- Home-lab, LAN, router, Tailscale, VPN, tunnel, proxy, DNS, or custom domain
- Client-side secrets, direct browser-to-Render calls, or static-browser signing
- Any claim that this source candidate is a deployed Sites-to-Render release

The next boundary is manual configuration of the matching secret and exact
Render origin in the existing private Sites project. Saving and deploying a
Sites version remains a separate, explicitly authorized decision.
