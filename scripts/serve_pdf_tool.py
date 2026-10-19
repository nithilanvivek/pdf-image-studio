#!/usr/bin/env python3
"""Run PDF + Image Studio locally without serverless upload limits.

Usage:
    python3 scripts/serve_pdf_tool.py --port 4175
    python3 scripts/serve_pdf_tool.py --desktop
    python3 scripts/serve_pdf_tool.py --open-browser
"""

from __future__ import annotations

import argparse
import errno
import importlib
import importlib.util
import mimetypes
import sys
import threading
import webbrowser
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


DEFAULT_PORT = 4175
IS_FROZEN = bool(getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"))


def resource_root() -> Path:
    if bool(getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS")):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parents[1]


ROOT = resource_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

spec = importlib.util.spec_from_file_location("pdf_tool_api", ROOT / "api" / "pdf-tool.py")
api_module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(api_module)


class LocalPdfToolHandler(api_module.handler):
    def do_GET(self) -> None:
        requested = urlparse(self.path).path
        routes = {
            "/": ROOT / "tools" / "filestudio" / "index.html",
            "/tools/filestudio": ROOT / "tools" / "filestudio" / "index.html",
            "/tools/filestudio/": ROOT / "tools" / "filestudio" / "index.html",
            "/tools/filestudio/pdf-tool.css": ROOT / "tools" / "filestudio" / "pdf-tool.css",
            "/tools/filestudio/pdf-tool.js": ROOT / "tools" / "filestudio" / "pdf-tool.js",
            "/tools/filestudio/pdf-processing.js": ROOT / "tools" / "filestudio" / "pdf-processing.js",
            "/tools/filestudio/file-studio-tools.js": ROOT / "tools/filestudio/file-studio-tools.js",
            "/tools/filestudio/pwa.js": ROOT / "tools/filestudio/pwa.js",
            "/tools/filestudio/manifest.webmanifest": ROOT / "tools/filestudio/manifest.webmanifest",
            "/tools/filestudio/icons/icon.svg": ROOT / "tools/filestudio/icons/icon.svg",
            "/assets/icons/pdf-studio-app-icon.svg": ROOT / "assets/icons/pdf-studio-app-icon.svg",
            "/favicon.ico": ROOT / "favicon.ico",
            "/favicon.svg": ROOT / "favicon.svg",
        }
        path = routes.get(requested)
        if path is None or not path.is_file():
            self.send_error(404, "Not found")
            return
        content = path.read_bytes()
        if path.name == "index.html":
            content = content.replace(b"</head>", b'<meta name="pdf-studio-runtime" content="python"></head>')
        content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in {"application/javascript", "image/svg+xml"}:
            content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


def create_server(port: int) -> ThreadingHTTPServer:
    """Bind the requested port, or choose a free one when it is occupied."""
    try:
        return ThreadingHTTPServer(("127.0.0.1", port), LocalPdfToolHandler)
    except OSError as exc:
        address_in_use = exc.errno == errno.EADDRINUSE or getattr(exc, "winerror", None) == 10048
        if not address_in_use:
            raise
        return ThreadingHTTPServer(("127.0.0.1", 0), LocalPdfToolHandler)


def open_interface(url: str) -> None:
    """Open the local interface after the server has started accepting requests."""
    threading.Timer(0.35, lambda: webbrowser.open(url, new=1, autoraise=True)).start()


def serve_in_background(server: ThreadingHTTPServer) -> threading.Thread:
    """Run the local API while the macOS window owns the main thread."""
    thread = threading.Thread(
        target=server.serve_forever,
        name="pdf-studio-server",
        daemon=True,
    )
    thread.start()
    return thread


def run_desktop_window(server: ThreadingHTTPServer, url: str) -> None:
    """Display PDF + Image Studio in a native WebKit window."""
    try:
        webview = importlib.import_module("webview")
    except ImportError as exc:
        raise RuntimeError(
            "Desktop mode requires pywebview. Install the build requirements first."
        ) from exc

    webview.settings["ALLOW_DOWNLOADS"] = True
    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
    server_thread = serve_in_background(server)
    try:
        webview.create_window(
            "PDF + Image Studio",
            url,
            width=1320,
            height=860,
            min_size=(960, 640),
            background_color="#f7f5f0",
        )
        webview.start()
    finally:
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run nithi.land PDF + Image Studio locally")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    launch_group = parser.add_mutually_exclusive_group()
    launch_group.add_argument("--desktop", action="store_true", help="open PDF + Image Studio in a native desktop window")
    launch_group.add_argument("--open-browser", action="store_true", help="open PDF + Image Studio in the default browser")
    launch_group.add_argument("--no-browser", action="store_true", help="run only the local server")
    args = parser.parse_args()
    server = create_server(args.port)
    actual_port = int(server.server_address[1])
    url = f"http://127.0.0.1:{actual_port}"
    print(f"PDF + Image Studio running at {url}")
    desktop_mode = args.desktop or (IS_FROZEN and not args.open_browser and not args.no_browser)
    if desktop_mode:
        run_desktop_window(server, url)
        return
    if args.open_browser:
        open_interface(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
