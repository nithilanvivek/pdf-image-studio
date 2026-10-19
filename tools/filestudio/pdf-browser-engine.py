"""Browser adapter: reuse the server engine, substituting PDF.js for native PDFium.

Runs only inside a disposable Pyodide worker. Render one page at a time; the
original engine still supplies validation, PDF editing, Pillow codecs and ZIPs.
"""
import gc
import math
from js import render_page
from pdf_engine import *
from pdf_engine import (
    _reader, _safe_stem, _write_pdf, _unique_document_stem,
    _rendered_page_bytes, _normalize_page_widths,
    watermark_inputs,
)


class BrowserCapacityError(Exception):
    pass


def embedded_image_pixels(reader):
    """Inspect image headers, including nested forms, without decoding images."""
    visited = set()
    peak = 0
    def inspect(resources):
        nonlocal peak
        xobjects = resources.get("/XObject")
        if not xobjects:
            return
        for reference in xobjects.get_object().values():
            obj = reference.get_object()
            if id(obj) in visited:
                continue
            visited.add(id(obj))
            peak = max(peak, int(obj.get("/Width", 0)) * int(obj.get("/Height", 0)))
            if obj.get("/Resources"):
                inspect(obj["/Resources"])
    for page in reader.pages:
        inspect(page.get("/Resources", {}))
    return peak


def prepare_browser_task(operation, uploads, fields, budget):
    """Inspect headers/page geometry before decoding images or rasterizing pages."""
    baseline = 96 * 1024 * 1024
    estimate = baseline + sum(len(upload.data) for upload in uploads) * 14
    watermark_pixels = 0
    if operation == "watermark":
        uploads, logo = watermark_inputs(uploads, fields)
        if logo:
            try:
                with Image.open(BytesIO(logo.data)) as image:
                    watermark_pixels = image.width * image.height
            except (OSError, ValueError, Image.DecompressionBombError) as exc:
                raise PdfToolError("Choose a supported, readable watermark image.") from exc
            estimate += watermark_pixels * 32
            if estimate > budget:
                raise BrowserCapacityError("The watermark image exceeds the browser memory budget.")
    if operation.startswith("image-"):
        from lib.image_tool import image_task_geometry
        sizes, peak, output = image_task_geometry(operation, uploads, fields, max(0, (budget - estimate) // 32))
        if estimate + peak * 24 + output * 8 > budget:
            raise BrowserCapacityError("This image task needs more memory than the browser budget.")
        return
    page_count = 0
    peak_pixels = watermark_pixels
    retained_pixels = 0
    raster = operation in {"flatten", "pdf-tiff", "preview-page", "pdf-image"} or (
        operation == "split" and fields.get("split_format", "pdf") != "pdf"
    )
    for upload in uploads:
        if operation == "images-pdf" or (operation in {"combine-files", "watermark"} and not upload.name.lower().endswith(".pdf") and b"%PDF-" not in upload.data[:1024]):
            with Image.open(BytesIO(upload.data)) as image:
                count = getattr(image, "n_frames", 1)
                if count > MAX_PDF_PAGES:
                    raise PdfToolError("The output cannot exceed 500 pages.")
                for index in range(count):
                    image.seek(index)
                    pixels = image.width * image.height
                    if estimate + pixels * 32 > budget:
                        raise BrowserCapacityError("This image exceeds the browser memory budget.")
                    peak_pixels = max(peak_pixels, pixels)
                    retained_pixels += pixels
                page_count += count
        else:
            reader = _reader(upload)
            if raster or operation == "compress":
                peak_pixels = max(peak_pixels, embedded_image_pixels(reader))
            if operation == "pdf-image" and (len(uploads) != 1 or len(reader.pages) != 1):
                raise PdfToolError("PDF to image requires a single-page PDF. Use Split pages for a multi-page PDF.")
            page_count += len(reader.pages)
            if raster:
                pages = list(reader.pages)
                sizes = [(float(page.cropbox.width), float(page.cropbox.height)) for page in pages]
                sizes = [(h, w) if page.rotation % 180 else (w, h) for page, (w, h) in zip(pages, sizes)]
                if operation == "preview-page":
                    number = int(fields.get("preview_page", "1"))
                    if not 1 <= number <= len(sizes):
                        raise PdfToolError("Choose a valid PDF page to preview.")
                    sizes = [sizes[number - 1]]
                dpi = 96 if operation == "preview-page" else int(fields.get(
                    "flatten_dpi" if operation == "flatten" else "split_dpi" if operation == "split" else "image_dpi" if operation == "pdf-image" else "dpi",
                    "300" if operation == "flatten" else "150",
                ))
                dpi = max(150 if operation == "flatten" else 72, min(dpi, 600 if operation == "flatten" else 300))
                widest = max((w for w, h in sizes), default=0)
                for width, height in sizes:
                    scale = dpi / 72 * (widest / width if operation == "flatten" else 1)
                    pixels = math.ceil(width * scale) * math.ceil(height * scale)
                    peak_pixels = max(peak_pixels, pixels)
                    retained_pixels += pixels
    if page_count > (MAX_TIFF_PAGES if operation == "pdf-tiff" else MAX_PDF_PAGES) and operation != "preview-page":
        raise PdfToolError("The task exceeds the allowed page count.")
    # RGBA canvas, Pillow conversion, codec scratch buffers, plus retained output.
    estimate += peak_pixels * 24 + retained_pixels * (8 if operation == "pdf-tiff" else 4)
    estimate += page_count * 128 * 1024
    if retained_pixels > MAX_RENDER_PIXELS or estimate > budget:
        raise BrowserCapacityError("This document needs more memory than the browser budget.")


async def rendered_image(file_index, page_index, scale):
    frame = await render_page(file_index, page_index, scale)
    image = Image.frombytes("RGBA", (frame.width, frame.height), frame.pixels.to_py()).convert("RGB")
    return image


async def browser_process(operation, uploads, fields, budget):
    prepare_browser_task(operation, uploads, fields, budget)
    raster = operation in {"flatten", "pdf-tiff", "preview-page", "pdf-image"} or (
        operation == "split" and fields.get("split_format", "pdf") != "pdf"
    )
    if not raster:
        return process(operation, uploads, fields)

    # PDF.js provides actual display geometry, including CropBox and rotation.
    from js import document_sizes
    sizes = (await document_sizes()).to_py()
    output_name = fields.get("output_name", "")
    if operation == "pdf-image":
        fmt = fields.get("image_format", "png")
        if fmt not in {"png", "jpg", "tiff"}:
            raise PdfToolError("Choose PNG, JPEG, or TIFF output.")
        dpi = max(72, min(int(fields.get("image_dpi", "150")), 300))
        quality = max(45, min(int(fields.get("image_quality", "88")), 95))
        image = await rendered_image(0, 0, dpi / 72)
        try:
            return ProcessedFile(f"{_safe_stem(output_name, 'page')}.{fmt}",
                                 {"png": "image/png", "jpg": "image/jpeg", "tiff": "image/tiff"}[fmt],
                                 _rendered_page_bytes(image, fmt, dpi, quality), 1)
        finally:
            image.close()
    if operation == "preview-page":
        number = int(fields.get("preview_page", "1"))
        image = await rendered_image(0, number - 1, 96 / 72)
        try:
            output = BytesIO()
            image.save(output, format="PNG")
            return ProcessedFile(f"page-{number}-preview.png", "image/png", output.getvalue(), len(sizes[0]))
        finally:
            image.close()

    output = BytesIO()
    rendered = []
    writer = PdfWriter() if operation == "flatten" else None
    archive = ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) if operation == "split" else None
    used = {}
    try:
        for file_index, document in enumerate(sizes):
            stem = _unique_document_stem(uploads[file_index].name, used)
            widest = max(width for width, height in document)
            dpi = max(150 if operation == "flatten" else 72, min(int(fields.get(
                "flatten_dpi" if operation == "flatten" else "split_dpi" if operation == "split" else "dpi",
                "300" if operation == "flatten" else "150",
            )), 600 if operation == "flatten" else 300))
            for page_index, (width, height) in enumerate(document):
                factor = widest / width if operation == "flatten" else 1
                image = await rendered_image(file_index, page_index, dpi / 72 * factor)
                try:
                    if operation == "flatten":
                        page_pdf = BytesIO()
                        layer = canvas.Canvas(page_pdf, pagesize=(width * factor, height * factor), pageCompression=1, invariant=1)
                        layer.drawInlineImage(image, 0, 0, width=width * factor, height=height * factor)
                        layer.showPage()
                        layer.save()
                        page = PdfReader(BytesIO(page_pdf.getvalue())).pages[0]
                        resources = page["/Resources"]
                        resources.pop(NameObject("/Font"), None)
                        procset = resources.get("/ProcSet", [])
                        while NameObject("/Text") in procset:
                            procset.remove(NameObject("/Text"))
                        writer.add_page(page)
                    elif operation == "split":
                        fmt = fields.get("split_format", "png")
                        quality = max(45, min(int(fields.get("split_quality", "88")), 95))
                        archive.writestr(f"{stem}-page-{page_index + 1:04d}.{fmt}", _rendered_page_bytes(image, fmt, dpi, quality))
                    else:
                        mode = fields.get("tiff_color", "color")
                        if mode not in {"color", "grayscale"}:
                            raise PdfToolError("Choose color or grayscale TIFF output.")
                        rendered.append(image.convert("L" if mode == "grayscale" else "RGB"))
                finally:
                    image.close()
                gc.collect()
        count = sum(map(len, sizes))
        if writer:
            writer.metadata = None
            return ProcessedFile(f"{_safe_stem(output_name, 'flattened')}.pdf", "application/pdf", _write_pdf(writer), count)
        if archive:
            archive.close()
            return ProcessedFile(f"{_safe_stem(output_name, 'split-pages')}.zip", "application/zip", output.getvalue(), count)
        compression = fields.get("tiff_compression", "")
        if compression not in {"tiff_lzw", "tiff_deflate", "jpeg"}:
            raise PdfToolError("Choose a valid TIFF compression format.")
        options = {"compression": compression, "dpi": (dpi, dpi)}
        if compression == "jpeg":
            options["quality"] = 82
        rendered[0].save(output, format="TIFF", save_all=True, append_images=rendered[1:], **options)
        return ProcessedFile(f"{_safe_stem(output_name, 'document')}.tiff", "image/tiff", output.getvalue(), count)
    finally:
        if archive:
            archive.close()
        for image in rendered:
            image.close()
