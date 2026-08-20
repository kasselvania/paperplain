# Technical boundaries

## Implemented now

Paperplain's current boundary is deliberately local and fixed:

- The Node service binds only to `127.0.0.1`.
- The conversion route accepts a sample ID from one server-side allowlist.
- The allowlist contains exactly the three fictional PDFs committed in
  `public/samples/`.
- `@opendataloader/pdf` 2.5.1 performs ordinary local conversion through its
  Java process.
- Per-run temporary conversion output is removed after the response is built.
- There are no accounts, uploads, visitor documents, external document URLs,
  databases, tunnels, or non-local listeners.

`Start Paperplain.command` starts that same service, waits for its localhost
manifest, and opens `http://127.0.0.1:4173` in the default browser. It does not
change firewall, router, sharing, or network settings.

## Deferred phase 1: isolated LAN-only proof

A future first networking experiment would run the converter in an isolated
container and make it reachable only on a deliberately bounded LAN. That work
has not started. It requires separate authorization and observable proof of the
listener, container, and network boundary.

## Deferred phase 2: security and threat-model review

The review must cover the exact phase-1 implementation rather than an imagined
deployment. At minimum it should examine route allowlisting, process spawning,
resource exhaustion, dependency and update handling, logs, browser-origin
assumptions, container escape, LAN trust assumptions, shutdown, and recovery.

## Deferred phase 3: private or published path

Only after the LAN proof and its review should a separately authorized decision
choose whether any private or published path is appropriate. A live converter
needs a Java-capable host.

ChatGPT Sites is not presumed to have direct access to a private LAN. Connecting
a hosted interface to a private converter would create a separate network
boundary with new authentication, authorization, availability, and threat-model
requirements. No such bridge is designed or implemented here.
