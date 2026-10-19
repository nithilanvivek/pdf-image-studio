# PDF + Image Studio

MIT open-source PDF and image tools by Nithilan Vivek. [Use or install the PWA](https://files.nithi.land/).

Merge, split, compress, resize, rasterise and watermark PDFs; convert, resize,
compress, crop, rotate, merge and watermark images; combine images with PDFs.
Open files or drag them into the app to see suitable actions. File-handler
integration and installation depend on the browser and operating system.

Compatible tasks run locally in a browser worker using self-hosted Python/WASM
and PDF.js. Conservative memory estimates, unsupported codecs and runtime errors
trigger server fallback. Those estimates cannot guarantee the browser has enough
free memory. The hosted server accepts up to 4 MB total per task; local Python
accepts up to 250 MB. Fallback may upload the selected files, including preview
requests. File contents are processed in memory and are not intentionally saved.
The service worker caches the application/runtime, never uploads or API results.
Offline processing becomes available after that cache has completed successfully.

## Run the browser edition

Node.js 22 or newer:

```sh
npm ci
npm start
```

Open http://127.0.0.1:4174/tools/filestudio/. This static preview runs browser
processing; it does not implement the Python fallback endpoint.

## Run with local Python

Use Python 3.13 in a virtual environment:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/serve_pdf_tool.py --open-browser
```

On Windows activate with `.venv\Scripts\activate`. The loopback launcher uses
native Python processing rather than browser WASM. For an optional macOS WebKit
window/build, install `requirements-build.txt`, run the launcher with `--desktop`,
or run `pyinstaller 'PDF + Image Studio.spec'`. That spec retains its historical
native bundle version 1.1; the web/PWA release is 1.0. No signed installers or
Store signing credentials are included.

## Develop and test

```sh
npm run build:file-studio-pwa
npx playwright install chromium --only-shell
npm test
python -m unittest discover -s tests -p 'test_*.py'
```

`lib/pdf_tool.py` and `lib/image_tool.py` are the processing sources of truth.
The build command refreshes their browser copies and the atomic offline cache.
Browser tests use Playwright's dedicated headless Chromium shell.

`api/pdf-tool.py` is the optional Vercel Python endpoint at `/api/pdf-tool`.
A dedicated-host deployment must map `/` to `tools/filestudio/index.html`,
`/manifest.webmanifest` to the production manifest, and allow the scoped worker
to control `/` via `Service-Worker-Allowed: /`. For a different hostname, update
the dedicated-host lists in `pwa.js` and `service-worker-template.js`, production
related-app URLs in the generator, and the canonical/metadata URLs before
regenerating. Preserve subdirectory assets. Review hosting limits and your own
privacy policy before enabling uploads. The path-scoped manifest is for local
or subdirectory previews; it does not install the entire containing website.

## License and provenance

[MIT](LICENSE) covers the author's original Studio code, documentation and app
assets. Third-party runtimes, fonts, codecs and libraries retain their own
licenses; see [VENDOR.md](tools/filestudio/VENDOR.md) and bundled notices.
`vendor/SHA256SUMS.json` records the bundled runtime checksums.

This is an app-only source snapshot exported from nithi.land on October 19,
2026, including AI-assisted implementation. It has a separate Git history.
The export omits unrelated website pages, private configuration/history,
telemetry injection, signing material, deployment workflows and user documents.
The shared title/greeting scripts are retained for offline shell compatibility.
