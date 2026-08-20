# Paperplain Sites presentation

This directory contains a Sites-compatible, owner-only integration candidate
for Paperplain. It is deliberately separate from the localhost demo and the
Render backend candidate in the repository root.

The presentation includes only:

- copies of the three generated, fictional sample PDFs and their previews;
- Markdown captured from verified local OpenDataLoader PDF 2.5.1 runs;
- receipt data derived from those runs;
- client-side sample selection and clipboard interaction; and
- one server-side route for a fresh conversion of the selected fixed sample.

The route accepts no upload, body, visitor document, arbitrary path, or remote
document URL. It requires the platform-authenticated Sites user headers and an
exact same-origin request. The existing custom owner-only Sites access policy is
the owner-authorization boundary; this shape must not be deployed if that
policy becomes shared or public.

The signing secret and Render origin are runtime-only server configuration.
They are absent from source and client assets. When either is absent or
malformed, the route returns a generic `503` without contacting Render. Sites
still contains no converter process, Java runtime, app-owned authentication,
persistence, database, storage binding, tunnel, or private-network link.

The currently deployed owner-only Sites version remains the earlier static
presentation. This source candidate has not been configured, saved as a Sites
version, or deployed.

## Manual configuration boundary

Before a later private deployment, the owner must set these values in the
existing Sites project's production environment:

- `PAPERPLAIN_RENDER_ORIGIN` — the exact `https://…onrender.com` service origin,
  with no path or trailing slash.
- `PAPERPLAIN_REQUEST_SECRET` — the same exact 64-character lowercase
  hexadecimal value stored in Render, marked as a Sites secret.

Do not put either value in browser code. Do not commit, transmit, or ask Codex
to handle the secret. Keep access custom owner-only.

## Validate

```bash
npm install
npm test
```

The build emits the Sites-compatible worker and static assets under `dist/`.
The tests render the built worker, exercise authentication and input denials,
verify HMAC interoperability with the Render verifier, scan client assets for
server configuration, and confirm the published PDF and preview copies remain
byte-identical to the canonical fixtures.

No software license has been selected for Paperplain. See the repository-root
`THIRD_PARTY_NOTICES.md` for OpenDataLoader PDF attribution.
