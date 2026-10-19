"""Refresh the pinned, self-hosted Pyodide runtime (no downloads during a build)."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1] / "tools/filestudio/vendor/pyodide"
BASE = "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"


def download(name):
    data = urlopen(BASE + name, timeout=90).read()
    (ROOT / name).write_bytes(data)
    return data


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    lock = json.loads(download("pyodide-lock.json"))
    names = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip"]
    # Pillow contains libtiff and JPEG support; micropip installs our pure-Python wheels.
    for package in ("pillow", "micropip"):
        names.append(lock["packages"][package]["file_name"])
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(download, names))
    for package in ("pillow", "micropip"):
        entry = lock["packages"][package]
        assert hashlib.sha256((ROOT / entry["file_name"]).read_bytes()).hexdigest() == entry["sha256"]
    print("Vendored Pyodide 0.29.3 with Pillow and micropip")
