# Paperplain Sites presentation

This directory contains the public, Sites-compatible Paperplain portfolio demo.
It is separate from the localhost UI and the Render converter in the repository
root.

The visitor journey is intentionally narrow:

1. choose one of three generated fictional PDFs;
2. inspect its source preview;
3. request a real server conversion;
4. wait without seeing a fabricated result; and
5. inspect and copy only the Markdown returned by that run.

The same-origin route is public but capability-bounded. It accepts only an empty
`POST` for one of the three fixed sample IDs. It accepts no upload, body, visitor
document, arbitrary path, or remote URL. The route signs a short-lived request
to Render using server-only configuration; neither the Render origin nor the
signing secret is shipped in browser assets.

The CSS scan shown while a request is pending is a waiting visualization over
the known fixture layout, not measured conversion progress. A failed request
reveals no stored or fallback Markdown.

## Server configuration

- `PAPERPLAIN_RENDER_ORIGIN` — the exact `https://…onrender.com` service origin,
  with no path or trailing slash.
- `PAPERPLAIN_REQUEST_SECRET` — the same exact 64-character lowercase
  hexadecimal secret stored in Render.

Do not put either value in browser code, source control, URLs, or client storage.
When either value is absent or malformed, the route returns `503` without
contacting Render.

## Validate

```bash
npm install
npm test
```

The focused tests prove the empty initial state, absence of captured output and
server configuration in client assets, anonymous same-origin HMAC
interoperability with the Render verifier, and refusal of off-contract requests.

No software license has been selected for Paperplain. See the repository-root
`THIRD_PARTY_NOTICES.md` for OpenDataLoader PDF attribution.
