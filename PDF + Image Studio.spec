# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

project_root = Path(SPECPATH)

analysis = Analysis(
    [str(project_root / "scripts" / "serve_pdf_tool.py")],
    pathex=[str(project_root)],
    binaries=[],
    datas=[
        (str(project_root / "api" / "pdf-tool.py"), "api"),
        (str(project_root / "lib" / "__init__.py"), "lib"),
        (str(project_root / "lib" / "pdf_tool.py"), "lib"),
        (str(project_root / "lib" / "image_tool.py"), "lib"),
        (str(project_root / "tools" / "filestudio"), "tools/filestudio"),
        (str(project_root / "favicon.ico"), "."),
        (str(project_root / "favicon.svg"), "."),
        (str(project_root / "assets/icons/pdf-studio-app-icon.svg"), "assets/icons"),
    ],
    hiddenimports=[
        "lib.pdf_tool",
        "pypdfium2",
        "webview",
        "webview.platforms.cocoa",
        "objc",
        "Cocoa",
        "Quartz",
        "WebKit",
        "Security",
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=[
        "clr",
        "gi",
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
        "webview.platforms.edgechromium",
        "webview.platforms.gtk",
        "webview.platforms.qt",
        "webview.platforms.winforms",
    ],
    noarchive=False,
)

python_archive = PYZ(analysis.pure)

executable = EXE(
    python_archive,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="PDF + Image Studio",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# The desktop app uses its bundled native Python engine; omit browser WASM assets.
analysis.datas = [item for item in analysis.datas if not item[0].startswith("tools/filestudio/vendor/")]

collected = COLLECT(
    executable,
    analysis.binaries,
    analysis.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="PDF + Image Studio",
)

app = BUNDLE(
    collected,
    name="PDF + Image Studio.app",
    icon=str(project_root / "assets" / "icons" / "pdf-studio-app-icon.png"),
    bundle_identifier="land.nithi.pdfstudio",
    version="1.1",
)
