# Technical boundaries

## Fixed corpus

Every Paperplain mode accepts only these generated fictional fixtures:

- `field-brief`
- `studio-invoice`
- `block-bulletin`

There is no upload, visitor document, external document URL, arbitrary path,
OCR service, account system, database, persistent disk, or retained conversion
output.

## Local demo

The default Node service binds only to `127.0.0.1`. It invokes the pinned
OpenDataLoader PDF 2.5.1 Java engine with one engine thread and removes temporary
output after each response. `Start Paperplain.command` starts this service and
opens `http://127.0.0.1:4173`; it changes no network or sharing settings.

## Public Sites route

The public browser calls the same-origin Sites route with only a sample ID. The
route accepts an empty `POST /api/convert/<allowlisted-id>`, refuses cross-origin
requests, bodies, queries, and unknown IDs, then signs one outbound Render
request with a fresh timestamp and nonce. The signing secret remains in the
Sites server environment and is absent from client assets.

The route is intentionally anonymous. Same-origin checking is browser defense
in depth, not user authentication. The safe public capability is the fixed
corpus itself: visitors cannot supply content or choose another operation.

While the request is pending, the source preview uses a CSS scan over manually
identified fixture regions. It communicates waiting, not engine telemetry,
measured progress, or completed extraction. Markdown and its copy action appear
only after a valid fresh response.

## Render converter

The hosted image is API-only. It serves an empty `204` health endpoint and the
signed fixed-sample conversion route. It does not serve the UI, previews, PDFs,
or arbitrary files.

The backend:

- verifies the exact configured HTTPS origin and HMAC-SHA256 signature;
- accepts a short-lived timestamp and one-time nonce, rejecting replay;
- runs one conversion at a time and admits six conversions per minute per
  instance;
- gives the Java process one thread and a hard execution deadline;
- uses only ephemeral temporary files; and
- returns generic errors without filesystem, Java, or secret details.

The HMAC prevents direct callers from authorizing Render work. Public visitors
can intentionally reach the bounded Sites proxy, so the fixed corpus plus
backend concurrency and rate controls form the abuse ceiling. Horizontal
scaling would require a separately designed shared replay and rate-limit store.

## Deployment truth

Source, build, or a green isolated test does not prove hosted configuration or
end-to-end operation. A release claim requires a real public Sites request that
returns fresh Markdown from Render. Access, environment values, and deployment
state remain external configuration and must be read back before any status
claim.
