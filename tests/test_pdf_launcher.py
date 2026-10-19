from __future__ import annotations

import errno
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from scripts import serve_pdf_tool


class PdfLauncherTests(unittest.TestCase):
    def test_uses_pyinstaller_resource_directory_when_frozen(self):
        with patch.object(sys, "frozen", True, create=True), patch.object(
            sys, "_MEIPASS", "/tmp/pdf-studio-bundle", create=True
        ):
            self.assertEqual(serve_pdf_tool.resource_root(), Path("/tmp/pdf-studio-bundle"))

    def test_falls_back_to_an_available_port_when_requested_port_is_busy(self):
        fallback_server = Mock()
        busy = OSError(errno.EADDRINUSE, "Address already in use")
        with patch.object(
            serve_pdf_tool,
            "ThreadingHTTPServer",
            side_effect=[busy, fallback_server],
        ) as server_factory:
            result = serve_pdf_tool.create_server(4175)

        self.assertIs(result, fallback_server)
        self.assertEqual(
            server_factory.call_args_list,
            [
                unittest.mock.call(("127.0.0.1", 4175), serve_pdf_tool.LocalPdfToolHandler),
                unittest.mock.call(("127.0.0.1", 0), serve_pdf_tool.LocalPdfToolHandler),
            ],
        )

    def test_starts_browser_timer(self):
        timer = Mock()
        with patch.object(serve_pdf_tool.threading, "Timer", return_value=timer) as timer_factory:
            serve_pdf_tool.open_interface("http://127.0.0.1:5000")

        timer_factory.assert_called_once()
        timer.start.assert_called_once_with()

    def test_native_window_runs_server_and_enables_downloads(self):
        server = Mock()
        server_thread = Mock()
        webview = Mock()
        webview.settings = {}
        with patch.object(
            serve_pdf_tool.importlib, "import_module", return_value=webview
        ) as import_module, patch.object(
            serve_pdf_tool, "serve_in_background", return_value=server_thread
        ):
            serve_pdf_tool.run_desktop_window(server, "http://127.0.0.1:4175")

        import_module.assert_called_once_with("webview")
        self.assertTrue(webview.settings["ALLOW_DOWNLOADS"])
        self.assertTrue(webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"])
        webview.create_window.assert_called_once_with(
            "PDF + Image Studio",
            "http://127.0.0.1:4175",
            width=1320,
            height=860,
            min_size=(960, 640),
            background_color="#f7f5f0",
        )
        webview.start.assert_called_once_with()
        server.shutdown.assert_called_once_with()
        server.server_close.assert_called_once_with()
        server_thread.join.assert_called_once_with(timeout=2)


if __name__ == "__main__":
    unittest.main()
