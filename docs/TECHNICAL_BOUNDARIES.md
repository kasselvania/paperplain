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

## Static Sites presentation

The separate `presentation/` surface contains copies of the three canonical
fictional PDFs, their pre-rendered page images, and Markdown plus receipt data
captured from verified local runs. Its sample selector and clipboard action
operate only on bundled content.

The current Sites deployment is owner-only and remains static. It has no upload,
visitor document path, converter process, Java runtime, conversion API,
database, storage binding, secret, proxy, tunnel, or private-LAN connection.
The Render preparation does not change its access or make its conversion action
live.

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
authorization boundary and must remain in server-side secret stores.

## Static-browser gap

A static browser page cannot safely hold the Render signing secret. The current
Sites presentation therefore cannot call this backend directly. A separate,
explicitly authorized release would need a trusted server-side signing route,
secret configuration on both sides, and validation of the complete request
path. Until then, the presentation must remain honest about showing captured
outputs rather than a live conversion.

The in-memory nonce store fits the single-instance free-tier candidate. It is
not authority for horizontal scaling: multiple instances would require a shared
replay store and a new persistence/security decision.

## Still excluded

- Arbitrary PDF upload or visitor documents
- External document URLs or network retrieval
- OCR, hybrid/AI enrichment, accounts, billing, or durable jobs
- Database, persistent disk, object storage, or retained conversion output
- Home-lab, LAN, router, Tailscale, VPN, tunnel, proxy, DNS, or custom domain
- Client-side secrets or direct static-browser signing
- Any claim that this repository preparation is a live Render deployment

The next boundary is a user-controlled Render dashboard decision. A later Sites
integration remains a separate source, secret, review, and deployment decision.
