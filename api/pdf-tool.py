"""Vercel Python function for the PDF + Image Studio web interface."""

from __future__ import annotations

import json
import os
import sys
from email.parser import BytesParser
from email.policy import default
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from lib.pdf_tool import PdfToolError, UploadedFile, process  # noqa: E402


MAX_REQUEST_BYTES = 250 * 1024 * 1024


def parse_multipart(content_type: str, body: bytes) -> tuple[list[UploadedFile], dict[str, str]]:
    message = BytesParser(policy=default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii") + body
    )
    if not message.is_multipart():
        raise PdfToolError("The upload must use multipart form data.")

    files: list[UploadedFile] = []
    fields: dict[str, str] = {}
    for part in message.iter_parts():
        field_name = part.get_param("name", header="content-disposition")
        if not field_name:
            continue
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b""
        if filename:
            files.append(UploadedFile(Path(filename).name, payload))
        else:
            fields[field_name] = payload.decode("utf-8", errors="replace")
    return files, fields


def same_origin(headers) -> bool:
    origin = headers.get("Origin")
    host = headers.get("Host")
    if not origin or not host:
        return False
    return origin.removeprefix("https://").removeprefix("http://").split("/", 1)[0] == host


class handler(BaseHTTPRequestHandler):
    def _json(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "private, no-store, max-age=0")
        self.send_header("X-Robots-Tag", "noindex, nofollow, noarchive")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        if os.getenv("VERCEL") and not same_origin(self.headers):
            self._json(403, {"error": "Request origin was not accepted."})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._json(413, {"error": "Local uploads are limited to 250 MB per task."})
            return

        try:
            body = self.rfile.read(content_length)
            files, fields = parse_multipart(self.headers.get("Content-Type", ""), body)
            result = process(fields.get("operation", ""), files, fields)
        except PdfToolError as exc:
            self._json(400, {"error": str(exc)})
            return
        except (TypeError, ValueError):
            self._json(400, {"error": "One of the selected options is invalid."})
            return
        except MemoryError:
            self._json(413, {"error": "This task needs more memory than is available. Try fewer files at once."})
            return
        except Exception:
            self._json(500, {"error": "The document could not be processed. Try a smaller file."})
            return

        self.send_response(200)
        self.send_header("Content-Type", result.content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{result.name}"')
        self.send_header("Cache-Control", "private, no-store, max-age=0")
        self.send_header("X-Page-Count", str(result.page_count))
        self.send_header("Content-Length", str(len(result.data)))
        self.end_headers()
        self.wfile.write(result.data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Allow", "POST, OPTIONS")
        self.end_headers()
