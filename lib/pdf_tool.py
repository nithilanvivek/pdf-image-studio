"""Core document operations for the nithi.land PDF tool.

The functions in this module accept in-memory uploads and return an in-memory
result. This keeps the web endpoint stateless and also makes the operations
straightforward to test or reuse from a desktop wrapper.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from io import BytesIO
from typing import Sequence
from urllib.parse import urlparse
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.errors import PdfReadError
from pypdf.generic import NameObject, RectangleObject
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics


MAX_FILES = 100
MAX_PDF_PAGES = 500
MAX_TIFF_PAGES = 250
MAX_RENDER_PIXELS = 500_000_000
MAX_LINK_AREAS = 100


class PdfToolError(ValueError):
    """An input or operation error that is safe to show to the user."""


@dataclass(frozen=True)
class UploadedFile:
    name: str
    data: bytes


@dataclass(frozen=True)
class ProcessedFile:
    name: str
    content_type: str
    data: bytes
    page_count: int


def _reader(upload: UploadedFile) -> PdfReader:
    try:
        reader = PdfReader(BytesIO(upload.data), strict=False)
    except (PdfReadError, OSError, ValueError) as exc:
        raise PdfToolError(f"{upload.name} is not a readable PDF.") from exc

    if reader.is_encrypted:
        try:
            unlocked = reader.decrypt("")
        except Exception as exc:  # pypdf raises different errors by encryption type
            raise PdfToolError(f"{upload.name} is password protected.") from exc
        if not unlocked:
            raise PdfToolError(f"{upload.name} is password protected.")
    return reader


def _write_pdf(writer: PdfWriter) -> bytes:
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def _normalize_page_widths(writer: PdfWriter) -> None:
    """Give every page one width using uniform, aspect-ratio-safe scaling."""
    if not writer.pages:
        return
    for page in writer.pages:
        if page.rotation:
            page.transfer_rotation_to_content()
    target_width = max(float(page.mediabox.width) for page in writer.pages)
    for page in writer.pages:
        current_width = float(page.mediabox.width)
        if current_width and abs(current_width - target_width) > 0.01:
            page.scale_by(target_width / current_width)


def _safe_stem(value: str, fallback: str) -> str:
    cleaned = "".join(character for character in value.strip() if character.isalnum() or character in "-_ ")
    return cleaned.strip().replace(" ", "-")[:80] or fallback


def merge_pdfs(files: Sequence[UploadedFile], output_name: str = "merged") -> ProcessedFile:
    if len(files) < 2:
        raise PdfToolError("Choose at least two PDF files to merge.")
    if len(files) > MAX_FILES:
        raise PdfToolError(f"Choose no more than {MAX_FILES} files at once.")

    writer = PdfWriter()
    pages = 0
    for upload in files:
        reader = _reader(upload)
        pages += len(reader.pages)
        if pages > MAX_PDF_PAGES:
            raise PdfToolError(f"The combined document cannot exceed {MAX_PDF_PAGES} pages.")
        writer.append(reader, import_outline=True)

    _normalize_page_widths(writer)

    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    return ProcessedFile(f"{_safe_stem(output_name, 'merged')}.pdf", "application/pdf", _write_pdf(writer), pages)


def standardize_pdf_width(
    upload: UploadedFile,
    output_name: str = "standardized",
) -> ProcessedFile:
    """Scale every page uniformly to the widest page without stretching."""
    reader = _reader(upload)
    if not reader.pages:
        raise PdfToolError("The PDF has no pages.")
    if len(reader.pages) > MAX_PDF_PAGES:
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")

    writer = PdfWriter(clone_from=reader)
    _normalize_page_widths(writer)
    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    return ProcessedFile(
        f"{_safe_stem(output_name, 'standardized')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        len(writer.pages),
    )


def _flatten_image(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image)
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGB", rgba.size, "white")
        background.paste(rgba, mask=rgba.getchannel("A"))
        return background
    return image.convert("RGB")


def images_to_pdf(
    files: Sequence[UploadedFile],
    output_name: str = "images",
    quality: int = 90,
) -> ProcessedFile:
    if not files:
        raise PdfToolError("Choose at least one TIFF, JPEG, or PNG image.")
    if len(files) > MAX_FILES:
        raise PdfToolError(f"Choose no more than {MAX_FILES} files at once.")
    quality = max(45, min(int(quality), 95))

    writer = PdfWriter()
    page_count = 0
    total_pixels = 0
    for upload in files:
        try:
            source = Image.open(BytesIO(upload.data))
        except (Image.DecompressionBombError, OSError, ValueError) as exc:
            raise PdfToolError(f"{upload.name} is not a readable TIFF, JPEG, or PNG image.") from exc
        try:
            frame_count = getattr(source, "n_frames", 1)
            for frame_index in range(frame_count):
                page_count += 1
                if page_count > MAX_PDF_PAGES:
                    raise PdfToolError(f"The output cannot exceed {MAX_PDF_PAGES} pages.")
                try:
                    source.seek(frame_index)
                    width, height = source.size
                    total_pixels += width * height
                    if total_pixels > MAX_RENDER_PIXELS:
                        raise PdfToolError(
                            "The selected images contain too many pixels for one task. "
                            "Convert them in smaller groups without reducing their resolution."
                        )
                    page = _flatten_image(source)
                    try:
                        # Build and import one PDF page at a time. This keeps only one
                        # decoded TIFF frame in memory instead of retaining every page.
                        page_pdf = BytesIO()
                        page.save(
                            page_pdf,
                            format="PDF",
                            resolution=150,
                            quality=quality,
                            optimize=True,
                        )
                        page_pdf.seek(0)
                        writer.add_page(PdfReader(page_pdf).pages[0])
                    finally:
                        page.close()
                except PdfToolError:
                    raise
                except (Image.DecompressionBombError, OSError, ValueError) as exc:
                    raise PdfToolError(
                        f"Page {frame_index + 1} of {upload.name} could not be decoded. "
                        "The image may be incomplete or use an unsupported TIFF encoding."
                    ) from exc
        finally:
            source.close()

    _normalize_page_widths(writer)
    writer.add_metadata({
        "/Title": "Image collection",
        "/Author": "nithi.land PDF + Image Studio",
        "/Producer": "nithi.land PDF + Image Studio",
    })
    return ProcessedFile(
        f"{_safe_stem(output_name, 'images')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        page_count,
    )


def _watermark_page(width: float, height: float, text: str, angle: int, opacity: float, font_size: int,
                    colour=(.16, .18, .22), position="center", box=None) -> PdfReader:
    buffer = BytesIO()
    layer = canvas.Canvas(buffer, pagesize=(width, height))
    layer.saveState()
    if hasattr(layer, "setFillAlpha"):
        layer.setFillAlpha(opacity)
    layer.setFillColorRGB(*colour)
    layer.setFont("Helvetica-Bold", font_size)
    if box:
        layer.translate(width * (box["x"] + box["width"] / 2), height * (1 - box["y"] - box["height"] / 2))
        ascent, descent = pdfmetrics.getAscentDescent("Helvetica-Bold", font_size)
        text_width = layer.stringWidth(text, "Helvetica-Bold", font_size)
        sine, cosine = abs(math.sin(math.radians(angle))), abs(math.cos(math.radians(angle)))
        rotated_width = text_width * cosine + (ascent - descent) * sine
        rotated_height = text_width * sine + (ascent - descent) * cosine
        scale = min(width * box["width"] / max(1, rotated_width), height * box["height"] / max(1, rotated_height))
        layer.scale(scale, scale)
        layer.rotate(angle)
        layer.drawCentredString(0, -(ascent + descent) / 2, text)
        layer.restoreState()
        layer.save()
        return PdfReader(BytesIO(buffer.getvalue()))
    layer.translate(width / 2, height * {"center": .5, "top": .9, "bottom": .1}[position])
    layer.rotate(angle)
    max_width = max(width, height) * 0.82
    measured = layer.stringWidth(text, "Helvetica-Bold", font_size)
    if measured > max_width and measured:
        layer.scale(max_width / measured, max_width / measured)
    layer.drawCentredString(0, -font_size * 0.34, text)
    layer.restoreState()
    layer.save()
    buffer.seek(0)
    return PdfReader(buffer)


def watermark_pdf(
    upload: UploadedFile,
    text: str,
    orientation: str = "diagonal",
    opacity: float = 0.2,
    font_size: int = 54,
    output_name: str = "watermarked",
    image: Image.Image | None = None,
    image_width: int = 40,
    colour: str = "#292e38",
    position: str = "center",
    box: dict | None = None,
) -> ProcessedFile:
    text = text.strip()
    if image is None and not text:
        raise PdfToolError("Enter the watermark text.")
    if len(text) > 120:
        raise PdfToolError("Watermark text must be 120 characters or fewer.")
    angles = {"horizontal": 0, "diagonal": 45, "vertical": 90}
    if orientation not in angles:
        raise PdfToolError("Choose a valid watermark direction.")
    opacity = max(0.05, min(float(opacity), 0.9))
    font_size = max(12, min(int(font_size), 144))
    from lib.image_tool import _colour
    rgb = tuple(value / 255 for value in _colour(colour)[:3])
    if position not in {"center", "top", "bottom"} and not (position == "custom" and box):
        raise PdfToolError("Choose a valid watermark position.")

    reader = _reader(upload)
    if len(reader.pages) > MAX_PDF_PAGES:
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")
    writer = PdfWriter(clone_from=reader)
    for page in writer.pages:
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)
        if page.rotation:
            page.transfer_rotation_to_content()
            width, height = float(page.mediabox.width), float(page.mediabox.height)
        if box:
            width, height = float(page.cropbox.width), float(page.cropbox.height)
        if image is None:
            watermark = _watermark_page(width, height, text, angles[orientation], opacity, font_size, rgb, position, box)
        else:
            from lib.image_tool import watermark_graphic, watermark_origin
            graphic = watermark_graphic(image, (width, height), angles[orientation], opacity, image_width, box)
            try:
                buffer = BytesIO()
                layer = canvas.Canvas(buffer, pagesize=(width, height))
                y = (height - graphic.height) / 2
                if position == "top":
                    y = height * .95 - graphic.height
                elif position == "bottom":
                    y = height * .05
                x = (width - graphic.width) / 2 + float(page.mediabox.left)
                y += float(page.mediabox.bottom)
                if box:
                    x, top = watermark_origin((width, height), graphic.size, box=box)
                    y = height - top - graphic.height
                layer.drawImage(ImageReader(graphic), x, y, mask="auto")
                layer.save()
                watermark = PdfReader(BytesIO(buffer.getvalue()))
            finally:
                graphic.close()
        if box:
            page.merge_transformed_page(watermark.pages[0], Transformation().translate(float(page.cropbox.left), float(page.cropbox.bottom)), over=True)
        else:
            page.merge_page(watermark.pages[0], over=True)
    _normalize_page_widths(writer)
    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    return ProcessedFile(
        f"{_safe_stem(output_name, 'watermarked')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        len(reader.pages),
    )


def _resize_for_compression(image: Image.Image, max_dimension: int) -> Image.Image:
    converted = _flatten_image(image)
    if max(converted.size) <= max_dimension:
        return converted
    converted.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    return converted


def compress_pdf(
    upload: UploadedFile,
    strength: str = "balanced",
    output_name: str = "compressed",
) -> ProcessedFile:
    presets = {
        "light": (2400, 86, 6),
        "balanced": (1800, 72, 8),
        "strong": (1280, 58, 9),
    }
    if strength not in presets:
        raise PdfToolError("Choose a valid compression level.")
    max_dimension, jpeg_quality, stream_level = presets[strength]
    reader = _reader(upload)
    if len(reader.pages) > MAX_PDF_PAGES:
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")

    writer = PdfWriter(clone_from=reader)
    for page in writer.pages:
        # Re-encode embedded images when pypdf exposes a replaceable image object.
        # Unsupported image filters are left untouched instead of failing the job.
        for embedded in list(page.images):
            source_image = None
            replacement = None
            try:
                source_image = embedded.image
                replacement = _resize_for_compression(source_image, max_dimension)
                embedded.replace(replacement, quality=jpeg_quality, optimize=True)
            except Exception:
                pass
            finally:
                if replacement is not None:
                    replacement.close()
                if source_image is not None:
                    source_image.close()
        try:
            page.compress_content_streams(level=stream_level)
        except Exception:
            pass
    if hasattr(writer, "compress_identical_objects"):
        writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    _normalize_page_widths(writer)
    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    result = _write_pdf(writer)
    # Compression can be neutral or slightly larger for already optimized PDFs.
    # Return the valid rewrite rather than silently returning a differently named original.
    return ProcessedFile(
        f"{_safe_stem(output_name, 'compressed')}.pdf",
        "application/pdf",
        result,
        len(reader.pages),
    )


def resize_pdf(
    upload: UploadedFile,
    width: float,
    height: float,
    unit: str = "mm",
    output_name: str = "resized",
) -> ProcessedFile:
    unit_factors = {
        "mm": 72 / 25.4,
        "cm": 72 / 2.54,
        "in": 72,
        "pt": 1,
    }
    if unit not in unit_factors:
        raise PdfToolError("Choose millimetres, centimetres, inches, or points.")
    try:
        target_width = float(width) * unit_factors[unit]
        target_height = float(height) * unit_factors[unit]
    except (TypeError, ValueError) as exc:
        raise PdfToolError("Enter a valid page width and height.") from exc
    if not 36 <= target_width <= 14_400 or not 36 <= target_height <= 14_400:
        raise PdfToolError("Page dimensions must be between 0.5 and 200 inches.")

    reader = _reader(upload)
    if len(reader.pages) > MAX_PDF_PAGES:
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")
    writer = PdfWriter()
    for source_page in reader.pages:
        if source_page.rotation:
            source_page.transfer_rotation_to_content()
        source_width = float(source_page.mediabox.width)
        source_height = float(source_page.mediabox.height)
        if not source_width or not source_height:
            raise PdfToolError("The PDF contains a page with invalid dimensions.")

        scale = min(target_width / source_width, target_height / source_height)
        rendered_width = source_width * scale
        rendered_height = source_height * scale
        offset_x = (target_width - rendered_width) / 2 - float(source_page.mediabox.left) * scale
        offset_y = (target_height - rendered_height) / 2 - float(source_page.mediabox.bottom) * scale
        target_page = writer.add_blank_page(width=target_width, height=target_height)
        target_page.merge_transformed_page(
            source_page,
            Transformation().scale(scale).translate(offset_x, offset_y),
            over=True,
            expand=False,
        )

    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    return ProcessedFile(
        f"{_safe_stem(output_name, 'resized')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        len(reader.pages),
    )


def _validate_link_area(area: dict, page_count: int) -> tuple[int, str, float, float, float, float]:
    if not isinstance(area, dict):
        raise PdfToolError("Each link area must include a page, URL, and rectangle.")
    url = str(area.get("url", "")).strip()
    parsed_url = urlparse(url.strip())
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise PdfToolError("Enter a complete http:// or https:// URL.")
    if len(url) > 2_048:
        raise PdfToolError("The URL is too long.")
    try:
        page_number = int(area.get("page", 0))
        x, y, width, height = map(
            float,
            (area.get("x"), area.get("y"), area.get("width"), area.get("height")),
        )
    except (TypeError, ValueError) as exc:
        raise PdfToolError("Draw a valid rectangular link area.") from exc
    if not 1 <= page_number <= page_count:
        raise PdfToolError("Choose a valid PDF page.")
    if not all(0 <= value <= 1 for value in (x, y, width, height)):
        raise PdfToolError("The link area must stay inside the page.")
    if width < 0.005 or height < 0.005 or x + width > 1.000001 or y + height > 1.000001:
        raise PdfToolError("Draw a larger link area entirely inside the page.")
    return page_number, url, x, y, width, height


def embed_links(
    upload: UploadedFile,
    areas: list[dict],
    output_name: str = "linked",
) -> ProcessedFile:
    if not isinstance(areas, list) or not areas:
        raise PdfToolError("Add at least one clickable link area.")
    if len(areas) > MAX_LINK_AREAS:
        raise PdfToolError(f"A document can contain at most {MAX_LINK_AREAS} new link areas per task.")

    reader = _reader(upload)
    if len(reader.pages) > MAX_PDF_PAGES:
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")
    validated_areas = [_validate_link_area(area, len(reader.pages)) for area in areas]
    writer = PdfWriter(clone_from=reader)
    _normalize_page_widths(writer)
    for page_number, url, x, y, width, height in validated_areas:
        target = writer.pages[page_number - 1]
        page_width = float(target.mediabox.width)
        page_height = float(target.mediabox.height)
        left = float(target.mediabox.left) + x * page_width
        right = float(target.mediabox.left) + (x + width) * page_width
        # Browser preview coordinates start at the top-left; PDF coordinates
        # start at the bottom-left.
        bottom = float(target.mediabox.bottom) + (1 - y - height) * page_height
        top = float(target.mediabox.bottom) + (1 - y) * page_height
        writer.add_uri(
            page_number - 1,
            url,
            RectangleObject((left, bottom, right, top)),
            border=[0, 0, 0],
        )
    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
    return ProcessedFile(
        f"{_safe_stem(output_name, 'linked')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        len(writer.pages),
    )


def embed_link(
    upload: UploadedFile,
    page_number: int,
    url: str,
    x: float,
    y: float,
    width: float,
    height: float,
    output_name: str = "linked",
) -> ProcessedFile:
    """Backward-compatible single-area wrapper around :func:`embed_links`."""
    return embed_links(
        upload,
        [{"page": page_number, "url": url, "x": x, "y": y, "width": width, "height": height}],
        output_name,
    )


def flatten_pdf(
    upload: UploadedFile,
    dpi: int = 300,
    output_name: str = "flattened",
) -> ProcessedFile:
    """Rebuild a PDF from lossless page images with no font or text resources."""
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise PdfToolError("PDF flattening is unavailable on this server.") from exc
    dpi = max(150, min(int(dpi), 600))
    try:
        document = pdfium.PdfDocument(upload.data)
    except Exception as exc:
        raise PdfToolError(f"{upload.name} is not a readable PDF.") from exc
    page_count = len(document)
    if not page_count:
        document.close()
        raise PdfToolError("The PDF has no pages.")
    if page_count > MAX_PDF_PAGES:
        document.close()
        raise PdfToolError(f"The document cannot exceed {MAX_PDF_PAGES} pages.")

    writer = PdfWriter()
    page_sizes: list[tuple[float, float]] = []
    for page_index in range(page_count):
        measured_page = document[page_index]
        page_sizes.append(measured_page.get_size())
        measured_page.close()
    target_width = max(width for width, _height in page_sizes)
    total_pixels = 0
    try:
        for page_index in range(page_count):
            page = document[page_index]
            source_width, source_height = page_sizes[page_index]
            width_factor = target_width / source_width
            output_width = target_width
            output_height = source_height * width_factor
            render_scale = dpi / 72 * width_factor
            total_pixels += round(source_width * render_scale) * round(source_height * render_scale)
            if total_pixels > MAX_RENDER_PIXELS:
                page.close()
                raise PdfToolError("This DPI would create too many image pixels. Try a lower DPI.")
            bitmap = page.render(scale=render_scale)
            image = bitmap.to_pil().convert("RGB")
            try:
                page_pdf = BytesIO()
                image_page = canvas.Canvas(
                    page_pdf,
                    pagesize=(output_width, output_height),
                    pageCompression=1,
                    invariant=1,
                )
                image_page.drawInlineImage(image, 0, 0, width=output_width, height=output_height)
                image_page.showPage()
                image_page.save()
                rebuilt_page = PdfReader(BytesIO(page_pdf.getvalue())).pages[0]
                resources = rebuilt_page.get("/Resources")
                if resources is not None:
                    resource_dictionary = resources.get_object()
                    resource_dictionary.pop(NameObject("/Font"), None)
                    procset = resource_dictionary.get("/ProcSet")
                    if procset is not None:
                        while NameObject("/Text") in procset:
                            procset.remove(NameObject("/Text"))
                rebuilt_page.pop(NameObject("/Annots"), None)
                writer.add_page(rebuilt_page)
            finally:
                image.close()
                bitmap.close()
                page.close()
    finally:
        document.close()

    # A fresh writer avoids carrying document-info, XMP, form, attachment,
    # JavaScript, outline, annotation, and font dictionaries from the source.
    writer.metadata = None
    return ProcessedFile(
        f"{_safe_stem(output_name, 'flattened')}.pdf",
        "application/pdf",
        _write_pdf(writer),
        page_count,
    )


def pdf_to_tiff(
    upload: UploadedFile,
    dpi: int = 150,
    compression: str = "tiff_lzw",
    color_mode: str = "color",
    output_name: str = "document",
) -> ProcessedFile:
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise PdfToolError("PDF-to-TIFF rendering is unavailable on this server.") from exc

    dpi = max(72, min(int(dpi), 300))
    allowed_compression = {"tiff_lzw", "tiff_deflate", "jpeg"}
    if compression not in allowed_compression:
        raise PdfToolError("Choose a valid TIFF compression format.")
    if color_mode not in {"color", "grayscale"}:
        raise PdfToolError("Choose color or grayscale TIFF output.")

    try:
        document = pdfium.PdfDocument(upload.data)
    except Exception as exc:
        raise PdfToolError(f"{upload.name} is not a readable PDF.") from exc
    page_count = len(document)
    if not page_count:
        document.close()
        raise PdfToolError("The PDF has no pages.")
    if page_count > MAX_TIFF_PAGES:
        document.close()
        raise PdfToolError(f"TIFF conversion is limited to {MAX_TIFF_PAGES} pages.")

    scale = dpi / 72
    rendered: list[Image.Image] = []
    total_pixels = 0
    try:
        for page_index in range(page_count):
            page = document[page_index]
            width, height = page.get_size()
            total_pixels += round(width * scale) * round(height * scale)
            if total_pixels > MAX_RENDER_PIXELS:
                raise PdfToolError("The selected DPI would create an image that is too large. Try a lower DPI.")
            bitmap = page.render(scale=scale)
            rendered.append(bitmap.to_pil().convert("L" if color_mode == "grayscale" else "RGB"))
            bitmap.close()
            page.close()

        output = BytesIO()
        save_options = {"compression": compression, "dpi": (dpi, dpi)}
        if compression == "jpeg":
            save_options["quality"] = 82
        rendered[0].save(
            output,
            format="TIFF",
            save_all=True,
            append_images=rendered[1:],
            **save_options,
        )
        return ProcessedFile(
            f"{_safe_stem(output_name, 'document')}.tiff",
            "image/tiff",
            output.getvalue(),
            page_count,
        )
    finally:
        document.close()
        for image in rendered:
            image.close()


def preview_first_page(upload: UploadedFile, dpi: int = 96, page_number: int = 1) -> ProcessedFile:
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        raise PdfToolError("PDF preview rendering is unavailable on this server.") from exc
    dpi = max(72, min(int(dpi), 120))
    try:
        document = pdfium.PdfDocument(upload.data)
    except Exception as exc:
        raise PdfToolError(f"{upload.name} is not a readable PDF.") from exc
    if not len(document):
        document.close()
        raise PdfToolError("The PDF has no pages.")
    if not 1 <= int(page_number) <= len(document):
        document.close()
        raise PdfToolError("Choose a valid PDF page to preview.")
    page = document[int(page_number) - 1]
    bitmap = page.render(scale=dpi / 72)
    image = bitmap.to_pil().convert("RGB")
    try:
        output = BytesIO()
        image.save(output, format="PNG", optimize=True)
        return ProcessedFile(f"page-{int(page_number)}-preview.png", "image/png", output.getvalue(), len(document))
    finally:
        image.close()
        bitmap.close()
        page.close()
        document.close()


def _unique_document_stem(name: str, used: dict[str, int]) -> str:
    stem = _safe_stem(name.rsplit(".", 1)[0], "document")
    used[stem] = used.get(stem, 0) + 1
    return stem if used[stem] == 1 else f"{stem}-{used[stem]}"


def _rendered_page_bytes(image: Image.Image, output_format: str, dpi: int, quality: int) -> bytes:
    output = BytesIO()
    if output_format == "png":
        image.save(output, format="PNG", optimize=True, dpi=(dpi, dpi))
    elif output_format == "jpg":
        image.save(output, format="JPEG", quality=quality, optimize=True, progressive=True, dpi=(dpi, dpi))
    else:
        image.save(output, format="TIFF", compression="tiff_lzw", dpi=(dpi, dpi))
    return output.getvalue()


def split_pdfs(
    files: Sequence[UploadedFile],
    output_format: str = "pdf",
    dpi: int = 150,
    quality: int = 88,
    output_name: str = "split-pages",
) -> ProcessedFile:
    if not files:
        raise PdfToolError("Choose at least one PDF to split.")
    if len(files) > MAX_FILES:
        raise PdfToolError(f"Choose no more than {MAX_FILES} files at once.")
    if output_format not in {"pdf", "tiff", "png", "jpg"}:
        raise PdfToolError("Choose PDF, TIFF, PNG, or JPEG for the split pages.")
    dpi = max(72, min(int(dpi), 300))
    quality = max(45, min(int(quality), 95))

    try:
        import pypdfium2 as pdfium
    except ImportError as exc:
        if output_format != "pdf":
            raise PdfToolError("Image page rendering is unavailable on this server.") from exc
        pdfium = None

    output = BytesIO()
    page_total = 0
    total_pixels = 0
    used_stems: dict[str, int] = {}
    extension = "tiff" if output_format == "tiff" else output_format

    with ZipFile(output, mode="w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for upload in files:
            reader = _reader(upload)
            page_total += len(reader.pages)
            if page_total > MAX_PDF_PAGES:
                raise PdfToolError(f"Split output cannot exceed {MAX_PDF_PAGES} pages.")
            document_stem = _unique_document_stem(upload.name, used_stems)

            if output_format == "pdf":
                for page_index, page in enumerate(reader.pages, start=1):
                    writer = PdfWriter()
                    writer.add_page(page)
                    writer.add_metadata({"/Producer": "nithi.land PDF + Image Studio"})
                    archive.writestr(
                        f"{document_stem}-page-{page_index:04d}.pdf",
                        _write_pdf(writer),
                    )
                continue

            try:
                document = pdfium.PdfDocument(upload.data)
            except Exception as exc:
                raise PdfToolError(f"{upload.name} is not a readable PDF.") from exc
            try:
                scale = dpi / 72
                for page_index in range(len(document)):
                    page = document[page_index]
                    width, height = page.get_size()
                    total_pixels += round(width * scale) * round(height * scale)
                    if total_pixels > MAX_RENDER_PIXELS:
                        raise PdfToolError("The selected DPI would create too many image pixels. Try a lower DPI.")
                    bitmap = page.render(scale=scale)
                    image = bitmap.to_pil().convert("RGB")
                    try:
                        archive.writestr(
                            f"{document_stem}-page-{page_index + 1:04d}.{extension}",
                            _rendered_page_bytes(image, output_format, dpi, quality),
                        )
                    finally:
                        image.close()
                        bitmap.close()
                        page.close()
            finally:
                document.close()

    return ProcessedFile(
        f"{_safe_stem(output_name, 'split-pages')}.zip",
        "application/zip",
        output.getvalue(),
        page_total,
    )


def pdf_to_image(upload: UploadedFile, output_format: str = "png", dpi: int = 150,
                 quality: int = 88, output_name: str = "page") -> ProcessedFile:
    if len(_reader(upload).pages) != 1:
        raise PdfToolError("PDF to image requires a single-page PDF. Use Split pages for a multi-page PDF.")
    if output_format not in {"png", "jpg", "tiff"}:
        raise PdfToolError("Choose PNG, JPEG, or TIFF output.")
    result = split_pdfs([upload], output_format, dpi, quality)
    with ZipFile(BytesIO(result.data)) as archive:
        data = archive.read(archive.namelist()[0])
    content_types = {"png": "image/png", "jpg": "image/jpeg", "tiff": "image/tiff"}
    return ProcessedFile(f"{_safe_stem(output_name, 'page')}.{output_format}", content_types[output_format], data, 1)


def combine_documents(files: Sequence[UploadedFile], output_name: str = "combined") -> ProcessedFile:
    if not 2 <= len(files) <= MAX_FILES:
        raise PdfToolError("Choose between 2 and 100 PDFs or images to combine.")
    converted = []
    for upload in files:
        if upload.name.lower().endswith(".pdf") or b"%PDF-" in upload.data[:1024]:
            converted.append(upload)
        else:
            result = images_to_pdf([upload])
            converted.append(UploadedFile(f"{upload.name}.pdf", result.data))
    return merge_pdfs(converted, output_name)


def watermark_inputs(files, fields):
    if fields.get("watermark_type", "text") == "text":
        return list(files), None
    if fields.get("watermark_type") != "image":
        raise PdfToolError("Choose a text or image watermark.")
    try:
        index = int(fields.get("watermark_file_index", "-1"))
    except ValueError as exc:
        raise PdfToolError("Choose a watermark image.") from exc
    if index != len(files) - 1 or index < 1:
        raise PdfToolError("Choose a watermark image.")
    return list(files[:index]), files[index]


def watermark_files(files, fields):
    from lib.image_tool import load_watermark_image, process_images, _integer, watermark_box
    targets, logo_upload = watermark_inputs(files, fields)
    if not 1 <= len(targets) <= MAX_FILES:
        raise PdfToolError("Choose between 1 and 100 PDFs or images.")
    angle = {"horizontal": 0, "diagonal": 45, "vertical": 90}.get(fields.get("orientation", "diagonal"))
    if angle is None:
        raise PdfToolError("Choose a valid watermark direction.")
    opacity = max(.05, min(float(fields.get("opacity", ".2")), .9))
    width = _integer(fields, "watermark_width", 40, 5, 90)
    position = fields.get("watermark_position", "center")
    placement = watermark_box(fields)
    if position not in {"center", "top", "bottom"} and not (position == "custom" and placement):
        raise PdfToolError("Choose a valid watermark position.")
    logo = load_watermark_image(logo_upload) if logo_upload else None
    used, results, count = {}, [], 0
    output_name = _safe_stem(fields.get("output_name", ""), "watermarked")
    try:
        for upload in targets:
            stem = _unique_document_stem(upload.name, used)
            if upload.name.lower().endswith(".pdf") or b"%PDF-" in upload.data[:1024]:
                result = watermark_pdf(upload, fields.get("watermark_text", ""), fields.get("orientation", "diagonal"),
                                       opacity, int(fields.get("font_size", "54")), stem, logo, width,
                                       fields.get("text_color", "#292e38"), position, placement)
            else:
                image_fields = {**fields, "output_name": stem, "text": fields.get("watermark_text", ""),
                                "text_size": fields.get("font_size", "54"), "text_opacity": str(round(opacity * 100)),
                                "text_position": position, "watermark_angle": str(angle), "opacity": str(opacity)}
                result = process_images("image-watermark", [upload], image_fields, watermark=logo)
            count += result.page_count
            if count > MAX_PDF_PAGES:
                raise PdfToolError("Choose no more than 500 pages or image frames per task.")
            results.append(result)
    finally:
        if logo is not None:
            logo.close()
    if len(results) == 1:
        result = results[0]
        return ProcessedFile(f"{output_name}.{result.name.rsplit('.', 1)[-1]}", result.content_type, result.data, count)
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for result in results:
            archive.writestr(result.name, result.data)
    return ProcessedFile(f"{output_name}.zip", "application/zip", output.getvalue(), count)


def process(operation: str, files: Sequence[UploadedFile], fields: dict[str, str]) -> ProcessedFile:
    if not files:
        raise PdfToolError("Choose a file to continue.")
    if operation.startswith("image-"):
        from lib.image_tool import process_images
        return process_images(operation, files, fields)
    output_name = fields.get("output_name", "")
    if operation == "combine-files":
        return combine_documents(files, output_name or "combined")
    if operation == "pdf-image":
        if len(files) != 1:
            raise PdfToolError("Choose exactly one single-page PDF.")
        return pdf_to_image(files[0], fields.get("image_format", "png"), int(fields.get("image_dpi", "150")),
                            int(fields.get("image_quality", "88")), output_name or "page")
    if operation == "merge-pdf":
        return merge_pdfs(files, output_name or "merged")
    if operation == "images-pdf":
        return images_to_pdf(files, output_name or "images", int(fields.get("quality", "90")))
    if operation == "watermark":
        return watermark_files(files, fields)
    if operation == "compress":
        return compress_pdf(files[0], fields.get("strength", "balanced"), output_name or "compressed")
    if operation == "resize":
        return resize_pdf(
            files[0],
            float(fields.get("page_width", "210")),
            float(fields.get("page_height", "297")),
            fields.get("page_unit", "mm"),
            output_name or "resized",
        )
    if operation == "standardize-width":
        return standardize_pdf_width(files[0], output_name or "standardized")
    if operation == "flatten":
        return flatten_pdf(
            files[0],
            int(fields.get("flatten_dpi", "300")),
            output_name or "flattened",
        )
    if operation == "embed-link":
        serialized_areas = fields.get("link_areas", "")
        if serialized_areas:
            try:
                link_areas = json.loads(serialized_areas)
            except json.JSONDecodeError as exc:
                raise PdfToolError("The saved link areas are invalid. Add them again.") from exc
            return embed_links(files[0], link_areas, output_name or "linked")
        return embed_link(
            files[0],
            int(fields.get("link_page", "1")),
            fields.get("link_url", ""),
            float(fields.get("link_x", "-1")),
            float(fields.get("link_y", "-1")),
            float(fields.get("link_width", "0")),
            float(fields.get("link_height", "0")),
            output_name or "linked",
        )
    if operation == "pdf-tiff":
        return pdf_to_tiff(
            files[0],
            int(fields.get("dpi", "150")),
            fields.get("tiff_compression", ""),
            fields.get("tiff_color", "color"),
            output_name or "document",
        )
    if operation == "preview-page":
        return preview_first_page(files[0], page_number=int(fields.get("preview_page", "1")))
    if operation == "split":
        return split_pdfs(
            files,
            fields.get("split_format", "pdf"),
            int(fields.get("split_dpi", "150")),
            int(fields.get("split_quality", "88")),
            output_name or "split-pages",
        )
    raise PdfToolError("Choose a valid PDF task.")
