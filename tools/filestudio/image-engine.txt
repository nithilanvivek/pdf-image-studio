"""Pillow operations shared by PDF + Image Studio's browser worker and Python API."""
from io import BytesIO
import json
import math
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image, ImageOps, ImageDraw, ImageFont, ImageColor


FORMATS = {"png": ("PNG", "image/png"), "jpg": ("JPEG", "image/jpeg"),
           "webp": ("WEBP", "image/webp"), "tiff": ("TIFF", "image/tiff"),
           "bmp": ("BMP", "image/bmp"), "gif": ("GIF", "image/gif")}


def _integer(fields, name, default, minimum, maximum):
    from .pdf_tool import PdfToolError
    try:
        value = int(fields.get(name) or default)
    except (TypeError, ValueError) as exc:
        raise PdfToolError(f"Enter a valid {name.replace('_', ' ')}.") from exc
    if not minimum <= value <= maximum:
        raise PdfToolError(f"{name.replace('_', ' ').capitalize()} must be between {minimum} and {maximum}.")
    return value


def _colour(value):
    from .pdf_tool import PdfToolError
    try:
        return ImageColor.getcolor(value, "RGBA")
    except (ValueError, TypeError) as exc:
        raise PdfToolError("Choose a valid colour.") from exc


def image_task_geometry(operation, files, fields, pixel_limit=None):
    """Read frame sizes before allocating decoded images or output canvases."""
    from .pdf_tool import PdfToolError, MAX_FILES, MAX_RENDER_PIXELS
    if not 1 <= len(files) <= MAX_FILES:
        raise PdfToolError("Choose between 1 and 100 images.")
    sizes = []
    for upload in files:
        try:
            with Image.open(BytesIO(upload.data)) as source:
                for index in range(getattr(source, "n_frames", 1)):
                    if len(sizes) >= 500:
                        raise PdfToolError("Choose no more than 500 image frames per task.")
                    source.seek(index)
                    w, h = source.size
                    if pixel_limit is not None and w * h > pixel_limit:
                        raise MemoryError("This image exceeds the browser memory budget.")
                    if source.getexif().get(274, 1) in {5, 6, 7, 8}:
                        w, h = h, w
                    sizes.append((w, h))
        except (OSError, ValueError, Image.DecompressionBombError) as exc:
            raise PdfToolError(f"{upload.name} is not a supported, readable image.") from exc
    pixels = sum(w * h for w, h in sizes)
    if pixels > MAX_RENDER_PIXELS:
        raise PdfToolError("These images contain too many pixels. Process smaller groups.")
    peak = max(w * h for w, h in sizes)
    output_pixels = pixels
    if operation == "image-resize":
        w = _integer(fields, "width", 1600, 1, 32768)
        h = _integer(fields, "height", 1200, 1, 32768)
        peak = max(peak, w * h)
        output_pixels = w * h * len(sizes)
    elif operation == "image-border":
        border = _integer(fields, "border_width", 20, 0, 2000)
        output_pixels = sum((w + 2 * border) * (h + 2 * border) for w, h in sizes)
        peak = max(peak, max((w + 2 * border) * (h + 2 * border) for w, h in sizes))
    elif operation == "image-merge":
        layout = fields.get("layout", "vertical")
        if layout not in {"vertical", "horizontal", "grid"}:
            raise PdfToolError("Choose a vertical, horizontal, or grid layout.")
        gap = _integer(fields, "gap", 0, 0, 500)
        cell_w = _integer(fields, "cell_width", 800, 32, 8192)
        cell_h = _integer(fields, "cell_height", 600, 32, 8192)
        columns = (1 if layout == "vertical" else len(sizes) if layout == "horizontal"
                   else min(len(sizes), _integer(fields, "columns", 2, 1, 20)))
        rows = math.ceil(len(sizes) / columns)
        merged_size = (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap)
        if max(merged_size) > 65535:
            raise PdfToolError("The merged image would be too wide or tall. Use smaller cells or a grid.")
        output_pixels = merged_size[0] * merged_size[1]
        peak = max(peak, output_pixels)
    if max(peak, output_pixels) > MAX_RENDER_PIXELS:
        raise PdfToolError("The requested output has too many pixels. Choose smaller dimensions.")
    return sizes, peak, output_pixels


def _frames(files):
    from .pdf_tool import _unique_document_stem
    used = {}
    for upload in files:
        stem = _unique_document_stem(upload.name, used)
        with Image.open(BytesIO(upload.data)) as source:
            count = getattr(source, "n_frames", 1)
            for index in range(count):
                source.seek(index)
                image = ImageOps.exif_transpose(source).convert("RGBA")
                image.info.clear()
                yield f"{stem}{f'-frame-{index + 1:04d}' if count > 1 else ''}", image


def _encode(image, fmt, quality, background):
    buffer = BytesIO()
    converted = image
    options = {}
    if fmt in {"jpg", "bmp"}:
        converted = Image.new("RGB", image.size, background[:3])
        converted.paste(image, mask=image.getchannel("A"))
    if fmt == "jpg":
        options = {"quality": quality, "optimize": True, "progressive": True}
    elif fmt == "webp":
        options = {"quality": quality, "method": 4}
    elif fmt == "png":
        options = {"optimize": True}
    elif fmt == "tiff":
        options = {"compression": "tiff_lzw"}
    try:
        converted.save(buffer, format=FORMATS[fmt][0], **options)
        return buffer.getvalue()
    finally:
        if converted is not image:
            converted.close()


def load_watermark_image(upload):
    from .pdf_tool import PdfToolError, MAX_RENDER_PIXELS
    try:
        with Image.open(BytesIO(upload.data)) as source:
            if source.width * source.height > MAX_RENDER_PIXELS:
                raise PdfToolError("The watermark image has too many pixels. Choose a smaller image.")
            return ImageOps.exif_transpose(source).convert("RGBA")
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise PdfToolError("Choose a supported, readable watermark image.") from exc


def watermark_box(fields):
    """Normalized bounds in the visible page/image, with a top-left origin."""
    from .pdf_tool import PdfToolError
    raw = fields.get("watermark_box", "")
    if not raw:
        return None
    try:
        box = json.loads(raw)
        box = {key: float(box[key]) for key in ("x", "y", "width", "height")}
        if (not all(math.isfinite(value) for value in box.values()) or
                min(box["x"], box["y"]) < 0 or min(box["width"], box["height"]) <= 0 or
                box["x"] + box["width"] > 1.000001 or box["y"] + box["height"] > 1.000001):
            raise ValueError()
        return box
    except (TypeError, ValueError, KeyError) as exc:
        raise PdfToolError("The watermark placement is invalid. Move or resize it again.") from exc


def watermark_origin(size, graphic_size, position="center", box=None):
    if box:
        return (round(size[0] * (box["x"] + box["width"] / 2) - graphic_size[0] / 2),
                round(size[1] * (box["y"] + box["height"] / 2) - graphic_size[1] / 2))
    y = (size[1] - graphic_size[1]) / 2
    if position == "top":
        y = size[1] * .05
    elif position == "bottom":
        y = size[1] * .95 - graphic_size[1]
    return round((size[0] - graphic_size[0]) / 2), round(y)


def watermark_graphic(source, size, angle, opacity, percent, box=None):
    """Fit rotated artwork inside its destination bounds, retaining alpha."""
    rotated = source.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    try:
        bounds = (size[0] * box["width"], size[1] * box["height"]) if box else (size[0] * percent / 100, size[1] * percent / 100)
        graphic = ImageOps.contain(rotated, tuple(max(1, round(value)) for value in bounds), Image.Resampling.LANCZOS)
        alpha = graphic.getchannel("A").point(lambda value: round(value * opacity))
        graphic.putalpha(alpha)
        alpha.close()
        return graphic
    finally:
        rotated.close()


def process_images(operation, files, fields, watermark=None):
    from .pdf_tool import PdfToolError, ProcessedFile, _safe_stem
    sizes, peak, output_pixels = image_task_geometry(operation, files, fields)
    fmt = fields.get("image_format", "jpg" if operation == "image-compress" else "png")
    if fmt not in FORMATS:
        raise PdfToolError("Choose PNG, JPEG, WebP, TIFF, BMP, or GIF output.")
    quality = _integer(fields, "image_quality", 80, 1, 100)
    background = _colour(fields.get("background", "#ffffff"))
    output_name = _safe_stem(fields.get("output_name", ""), "images")
    results = []
    placement = watermark_box(fields) if operation == "image-watermark" else None
    if operation == "image-merge":
        layout = fields.get("layout", "vertical")
        gap = _integer(fields, "gap", 0, 0, 500)
        cell_w = _integer(fields, "cell_width", 800, 32, 8192)
        cell_h = _integer(fields, "cell_height", 600, 32, 8192)
        columns = 1 if layout == "vertical" else len(sizes) if layout == "horizontal" else min(len(sizes), _integer(fields, "columns", 2, 1, 20))
        rows = math.ceil(len(sizes) / columns)
        canvas = Image.new("RGBA", (columns * cell_w + (columns + 1) * gap, rows * cell_h + (rows + 1) * gap), background)
        try:
            for index, (stem, image) in enumerate(_frames(files)):
                try:
                    fitted = ImageOps.contain(image, (cell_w, cell_h), Image.Resampling.LANCZOS)
                    try:
                        x = gap + (index % columns) * (cell_w + gap) + (cell_w - fitted.width) // 2
                        y = gap + (index // columns) * (cell_h + gap) + (cell_h - fitted.height) // 2
                        canvas.alpha_composite(fitted, (x, y))
                    finally:
                        fitted.close()
                finally:
                    image.close()
            data = _encode(canvas, fmt, quality, background)
            return ProcessedFile(f"{output_name}.{fmt}", FORMATS[fmt][1], data, len(sizes))
        finally:
            canvas.close()
    for stem, original in _frames(files):
        image = original
        try:
            if operation == "image-preview":
                return ProcessedFile("preview.png", "image/png", _encode(image, "png", 80, background), 1)
            if operation == "image-resize":
                size = (_integer(fields, "width", 1600, 1, 32768), _integer(fields, "height", 1200, 1, 32768))
                fit = fields.get("fit", "contain")
                if fit == "contain":
                    fitted = ImageOps.contain(image, size, Image.Resampling.LANCZOS)
                    image = Image.new("RGBA", size, background)
                    image.alpha_composite(fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2))
                    fitted.close()
                elif fit == "cover":
                    image = ImageOps.fit(image, size, Image.Resampling.LANCZOS)
                elif fit == "stretch":
                    image = image.resize(size, Image.Resampling.LANCZOS)
                else:
                    raise PdfToolError("Choose fit, fill/crop, or stretch.")
            elif operation == "image-crop":
                left = _integer(fields, "crop_left", 0, 0, 99)
                top = _integer(fields, "crop_top", 0, 0, 99)
                right = _integer(fields, "crop_right", 100, 1, 100)
                bottom = _integer(fields, "crop_bottom", 100, 1, 100)
                if left >= right or top >= bottom:
                    raise PdfToolError("The crop must have a positive width and height.")
                box = (int(image.width * left / 100), int(image.height * top / 100), max(1, int(image.width * right / 100)), max(1, int(image.height * bottom / 100)))
                if box[0] >= box[2] or box[1] >= box[3]:
                    raise PdfToolError("The crop area is too small for this image.")
                image = image.crop(box)
            elif operation == "image-rotate":
                rotation = fields.get("rotation", "90")
                if rotation not in {"0", "90", "180", "270"}:
                    raise PdfToolError("Choose a valid rotation.")
                image = image.rotate(-int(rotation), expand=True)
                flip = fields.get("flip", "none")
                if flip not in {"none", "horizontal", "vertical"}:
                    raise PdfToolError("Choose a valid flip direction.")
                if flip != "none":
                    flipped = ImageOps.mirror(image) if flip == "horizontal" else ImageOps.flip(image)
                    image.close()
                    image = flipped
            elif operation == "image-border":
                image = ImageOps.expand(image, _integer(fields, "border_width", 20, 0, 2000), _colour(fields.get("border_color", "#ffffff")))
            elif operation in {"image-text", "image-watermark"}:
                if watermark is not None:
                    graphic = watermark_graphic(watermark, image.size, int(fields.get("watermark_angle", "0")),
                                                float(fields.get("opacity", ".2")),
                                                _integer(fields, "watermark_width", 40, 5, 90), placement)
                    try:
                        image.alpha_composite(graphic, watermark_origin(image.size, graphic.size, fields.get("text_position", "center"), placement))
                    finally:
                        graphic.close()
                    results.append((f"{stem}.{fmt}", _encode(image, fmt, quality, background)))
                    continue
                text = fields.get("text", "").strip()
                if not text or len(text) > 200:
                    raise PdfToolError("Enter between 1 and 200 characters of text.")
                size = _integer(fields, "text_size", 48, 8, 1000)
                opacity = _integer(fields, "text_opacity", 35 if operation == "image-watermark" else 100, 1, 100)
                if placement:
                    # Size the glyph raster for the output box before allocating it.
                    font = ImageFont.load_default(size=64)
                    bounds = font.getbbox(text)
                    w, h = max(1, bounds[2] - bounds[0]), max(1, bounds[3] - bounds[1])
                    angle = math.radians(int(fields.get("watermark_angle", "0")))
                    sine, cosine = abs(math.sin(angle)), abs(math.cos(angle))
                    scale = min(image.width * placement["width"] / (w * cosine + h * sine),
                                image.height * placement["height"] / (w * sine + h * cosine))
                    font = ImageFont.load_default(size=max(1, round(64 * scale)))
                    bounds = font.getbbox(text)
                    tile = Image.new("RGBA", (max(1, bounds[2] - bounds[0]), max(1, bounds[3] - bounds[1])))
                    try:
                        ImageDraw.Draw(tile).text((-bounds[0], -bounds[1]), text, font=font,
                                                 fill=_colour(fields.get("text_color", "#111111")))
                        graphic = watermark_graphic(tile, image.size, int(fields.get("watermark_angle", "0")), opacity / 100, 40, placement)
                        try:
                            image.alpha_composite(graphic, watermark_origin(image.size, graphic.size, box=placement))
                        finally:
                            graphic.close()
                    finally:
                        tile.close()
                    results.append((f"{stem}.{fmt}", _encode(image, fmt, quality, background)))
                    continue
                layer = Image.new("RGBA", image.size)
                try:
                    draw = ImageDraw.Draw(layer)
                    font = ImageFont.load_default(size=size)
                    box = draw.textbbox((0, 0), text, font=font)
                    if box[2] - box[0] > image.width * .9:
                        font = ImageFont.load_default(size=max(1, int(size * image.width * .9 / (box[2] - box[0]))))
                        box = draw.textbbox((0, 0), text, font=font)
                    position = fields.get("text_position", "center")
                    if position not in {"center", "top", "bottom"}:
                        raise PdfToolError("Choose a valid text position.")
                    x = (image.width - (box[2] - box[0])) / 2 - box[0]
                    y = (image.height - (box[3] - box[1])) / 2 - box[1]
                    if position == "top":
                        y = image.height * .05 - box[1]
                    elif position == "bottom":
                        y = image.height * .95 - box[3]
                    colour = _colour(fields.get("text_color", "#111111"))
                    draw.text((x, y), text, font=font, fill=(*colour[:3], round(255 * opacity / 100)))
                    angle = int(fields.get("watermark_angle", "0"))
                    if angle:
                        rotated = layer.rotate(angle, resample=Image.Resampling.BICUBIC,
                                               center=(image.width / 2, y + (box[1] + box[3]) / 2))
                        layer.close()
                        layer = rotated
                    image = Image.alpha_composite(image, layer)
                finally:
                    layer.close()
            elif operation not in {"image-compress", "image-convert"}:
                raise PdfToolError("Choose a valid image task.")
            results.append((f"{stem}.{fmt}", _encode(image, fmt, quality, background)))
        finally:
            if image is not original:
                image.close()
            original.close()
    if len(results) == 1:
        return ProcessedFile(f"{output_name}.{fmt}", FORMATS[fmt][1], results[0][1], 1)
    output = BytesIO()
    with ZipFile(output, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in results:
            archive.writestr(name, data)
    return ProcessedFile(f"{output_name}.zip", "application/zip", output.getvalue(), len(results))
