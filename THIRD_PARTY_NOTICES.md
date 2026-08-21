# Third-party notices

## OpenDataLoader PDF

Paperplain uses `@opendataloader/pdf` version 2.5.1 as its PDF conversion
engine. Paperplain does not include modified OpenDataLoader PDF source and does
not claim authorship of the converter.

- Project: https://github.com/opendataloader-project/opendataloader-pdf
- Node package: https://www.npmjs.com/package/@opendataloader/pdf
- Upstream license: Apache License 2.0
- Upstream license text:
  https://github.com/opendataloader-project/opendataloader-pdf/blob/main/LICENSE
- Upstream notice: OpenDataLoader PDF - Copyright 2025-2026 Hancom, Inc.

The installed package also carries its own `LICENSE`, `NOTICE`, and third-party
license material. OpenDataLoader PDF is a dependency used by this demo;
Paperplain is not affiliated with, sponsored by, or endorsed by OpenDataLoader
PDF or its maintainers.

The Sites presentation requests conversion through Paperplain's bounded
server-side route. OpenDataLoader PDF and its Java process run in the separate
converter service; they are not bundled into browser or Sites client assets.

This notice records third-party attribution. It does not select or grant a
license for the independent Paperplain source.
