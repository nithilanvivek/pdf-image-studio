# PDF + Image Studio browser runtime

These dependencies are self-hosted. Processing does not contact a CDN, PyPI, or
another service. The studio's scoped service worker caches the runtime for offline
use; it never caches uploaded files or API responses.

| Dependency | Version | Source / license |
| --- | --- | --- |
| Pyodide | 0.29.3 | https://github.com/pyodide/pyodide/tree/0.29.3 — MPL-2.0; notice in vendor/pyodide/LICENSE |
| CPython | 3.13.2 | https://github.com/python/cpython/tree/v3.13.2 — PSF; vendor/pyodide/PYTHON-LICENSE |
| Pillow | 11.3.0 | Pyodide wheel; HPND and bundled codec notices inside the wheel |
| micropip | 0.11.0 | Pyodide wheel; MPL-2.0 notice inside the wheel |
| pypdf | 6.10.0 | https://pypi.org/project/pypdf/6.10.0/ — BSD-3-Clause notice inside wheel |
| ReportLab | 4.4.9 | https://pypi.org/project/reportlab/4.4.9/ — BSD notice inside wheel |
| charset-normalizer | 3.4.4 | https://pypi.org/project/charset-normalizer/3.4.4/ — MIT notice inside wheel |
| PDF.js | 6.4.299 | https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz — Apache-2.0, with font/codec notices in vendor/pdfjs |

`vendor/SHA256SUMS.json` records the checked-in vendor files. To refresh Pyodide,
run `python3 scripts/vendor-pdf-browser.py` from the repository root. For the pure
Python wheels, use `pip download --only-binary=:all: --no-deps --platform any
--python-version 313` with the exact versions above. PDF.js uses the npm archive's
`build/pdf.mjs` and `build/pdf.worker.mjs` renamed to `.js` for the site's static
MIME handling, plus its `cmaps`, `standard_fonts`, `wasm` and license directories.

After a dependency update, refresh the checksums and run
`npm run build:file-studio-pwa`, then the Python and headless browser tests.

The bundled browser TIFF codec supports LZW output. Deflate and JPEG TIFF output
route to the native Python server. Unsupported input encodings, runtime failures,
memory estimates above the device budget, or timeouts also trigger that fallback.
Browser estimates are conservative, not an exact measurement of available memory.

The native desktop launcher retains its local Python/PDFium engine and does not
include the browser WASM assets. Existing archived desktop binaries are historical
releases and are not rebuilt by this web/PWA change.
