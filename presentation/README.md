# Paperplain Sites presentation

This directory contains a Sites-compatible, static portfolio presentation of
Paperplain. It is deliberately separate from the live localhost demo in the
repository root.

The presentation includes only:

- copies of the three generated, fictional sample PDFs and their previews;
- Markdown captured from verified local OpenDataLoader PDF 2.5.1 runs;
- receipt data derived from those runs; and
- client-side sample selection and clipboard interaction.

It contains no upload route, converter process, Java runtime, visitor document
handling, account, app-owned authentication, persistence, database, storage
binding, secret, external connector, tunnel, proxy, or private-network link.
Its owner-only Sites deployment remains a static presentation and is not
connected to the separately prepared Render backend candidate.

## Validate

```bash
npm install
npm test
```

The build emits the Sites-compatible worker and static assets under `dist/`.
The tests render the built worker, check the static boundary copy, and verify
that the published PDF and preview copies are byte-identical to the repository's
canonical fixtures.

No software license has been selected for Paperplain. See the repository-root
`THIRD_PARTY_NOTICES.md` for OpenDataLoader PDF attribution.
