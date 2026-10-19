import unittest
from io import BytesIO
import json
from zipfile import ZipFile
from PIL import Image, ImageChops
from pypdf import PdfReader
from lib.pdf_tool import PdfToolError, UploadedFile, process
from test_pdf_tool import make_pdf


def image_file(name="picture.png", size=(80, 40), colour=(255, 0, 0, 255)):
    output = BytesIO()
    Image.new("RGBA", size, colour).save(output, "PNG")
    return UploadedFile(name, output.getvalue())


class ImageToolTests(unittest.TestCase):
    def task(self, operation, fields=None, files=None):
        return process(operation, files or [image_file()], fields or {})

    def test_all_conversion_formats_and_alpha(self):
        for fmt in ["png", "jpg", "webp", "tiff", "bmp", "gif"]:
            with self.subTest(fmt=fmt):
                result = self.task("image-convert", {"image_format": fmt}, [image_file(colour=(255, 0, 0, 0))])
                with Image.open(BytesIO(result.data)) as image:
                    self.assertEqual(image.size, (80, 40))
                    if fmt in {"jpg", "bmp"}:
                        self.assertGreater(min(image.convert("RGB").getpixel((0, 0))), 245)
                    if fmt in {"png", "webp", "tiff"}:
                        self.assertEqual(image.convert("RGBA").getpixel((0, 0))[3], 0)

    def test_fit_fill_and_stretch(self):
        for fit in ["contain", "cover", "stretch"]:
            result = self.task("image-resize", {"width": "100", "height": "100", "fit": fit})
            with Image.open(BytesIO(result.data)) as image:
                self.assertEqual(image.size, (100, 100))
                self.assertEqual(image.convert("RGB").getpixel((0, 0)), (255, 255, 255) if fit == "contain" else (255, 0, 0))

    def test_crop_rotate_flip_border_and_text(self):
        for operation, options, size in [
            ("image-crop", {"crop_left": "25", "crop_right": "75"}, (40, 40)),
            ("image-rotate", {"rotation": "90", "flip": "horizontal"}, (40, 80)),
            ("image-border", {"border_width": "10"}, (100, 60)),
            ("image-text", {"text": "Hello", "text_size": "12"}, (80, 40)),
            ("image-watermark", {"text": "DRAFT", "text_size": "12"}, (80, 40)),
        ]:
            result = self.task(operation, options)
            with Image.open(BytesIO(result.data)) as image:
                self.assertEqual(image.size, size)
                if operation in {"image-text", "image-watermark"}:
                    self.assertNotEqual(image.convert("RGB").tobytes(), Image.new("RGB", size, "red").tobytes())

    def test_collage_geometry_and_file_order(self):
        for layout, size in [("vertical", (42, 70)), ("horizontal", (82, 36)), ("grid", (82, 36))]:
            result = self.task("image-merge", {"layout": layout, "cell_width": "38", "cell_height": "32", "gap": "2"}, [image_file(), image_file("blue.png", colour=(0, 0, 255, 255))])
            with Image.open(BytesIO(result.data)) as image:
                self.assertEqual(image.size, size)
                self.assertEqual(image.convert("RGB").getpixel((20, 16)), (255, 0, 0))
                self.assertEqual(image.convert("RGB").getpixel((20, 50) if layout == "vertical" else (60, 16)), (0, 0, 255))

    def test_duplicate_names_batch_and_multiframe_tiff(self):
        result = self.task("image-convert", files=[image_file(), image_file()])
        with ZipFile(BytesIO(result.data)) as archive:
            self.assertEqual(archive.namelist(), ["picture.png", "picture-2.png"])
        source = BytesIO()
        Image.new("RGB", (32, 32), "red").save(source, "TIFF", save_all=True, append_images=[Image.new("RGB", (32, 32), "blue")])
        result = self.task("image-convert", files=[UploadedFile("frames.tiff", source.getvalue())])
        with ZipFile(BytesIO(result.data)) as archive:
            self.assertEqual(archive.namelist(), ["frames-frame-0001.png", "frames-frame-0002.png"])

    def test_invalid_and_oversized_options(self):
        for operation, fields in [("image-crop", {"crop_left": "80", "crop_right": "20"}), ("image-resize", {"width": "32768", "height": "32768"}), ("image-text", {"text": ""}), ("image-convert", {"image_format": "svg"})]:
            with self.subTest(operation=operation), self.assertRaises(PdfToolError):
                self.task(operation, fields)

    def test_single_page_pdf_image_and_multi_page_error(self):
        for fmt in ["png", "jpg", "tiff"]:
            result = process("pdf-image", [UploadedFile("one.pdf", make_pdf("One"))], {"image_format": fmt, "image_dpi": "72"})
            with Image.open(BytesIO(result.data)) as image:
                self.assertEqual(image.size, (320, 420))
        with self.assertRaisesRegex(PdfToolError, "single-page"):
            process("pdf-image", [UploadedFile("two.pdf", make_pdf("Two", pages=2))], {})

    def test_mixed_pdf_image_combination(self):
        result = process("combine-files", [UploadedFile("one.pdf", make_pdf("One")), image_file()], {})
        pdf = PdfReader(BytesIO(result.data))
        self.assertEqual(len(pdf.pages), 2)
        self.assertIn("One", pdf.pages[0].extract_text())
        self.assertEqual(float(pdf.pages[0].mediabox.width), float(pdf.pages[1].mediabox.width))

    def test_one_watermark_task_handles_mixed_files_with_text_or_logo(self):
        document = UploadedFile("document.pdf", make_pdf("Original", pages=2))
        picture = image_file("photo.png", colour=(255, 255, 255, 255))
        logo = image_file("logo.png", size=(20, 20), colour=(255, 0, 0, 128))
        for kind in ["text", "image"]:
            fields = {"watermark_type": kind, "watermark_text": "DRAFT", "orientation": "horizontal",
                      "opacity": ".5", "watermark_width": "50", "font_size": "12"}
            uploads = [document, picture]
            if kind == "image":
                fields["watermark_file_index"] = "2"
                uploads.append(logo)
            result = process("watermark", uploads, fields)
            self.assertEqual(result.page_count, 3)
            with ZipFile(BytesIO(result.data)) as archive:
                self.assertEqual(archive.namelist(), ["document.pdf", "photo.png"])
                reader = PdfReader(BytesIO(archive.read("document.pdf")))
                self.assertEqual(len(reader.pages), 2)
                for page in reader.pages:
                    self.assertIn("Original", page.extract_text())
                    if kind == "text":
                        self.assertIn("DRAFT", page.extract_text())
                    else:
                        self.assertTrue(page.images)
                        self.assertIn("/SMask", next(iter(page.images)).indirect_reference.get_object())
                with Image.open(BytesIO(archive.read("photo.png"))) as image:
                    self.assertEqual(image.size, picture_size := (80, 40))
                    self.assertNotEqual(image.convert("RGB").tobytes(), Image.new("RGB", picture_size, "white").tobytes())
                    if kind == "image":
                        self.assertEqual(image.convert("RGB").getpixel((40, 20)), (255, 191, 191))
                        self.assertEqual(image.convert("RGB").getpixel((0, 0)), (255, 255, 255))

    def test_logo_is_required_and_is_not_treated_as_a_source_file(self):
        for files, fields in [
            ([image_file()], {"watermark_type": "image"}),
            ([image_file(), image_file()], {"watermark_type": "image", "watermark_file_index": "0"}),
            ([image_file(), UploadedFile("bad.png", b"broken")], {"watermark_type": "image", "watermark_file_index": "1"}),
        ]:
            with self.assertRaises(PdfToolError):
                process("watermark", files, fields)

    def test_rotated_text_stays_at_its_chosen_image_position(self):
        for position in ["top", "bottom"]:
            result = process("watermark", [image_file(size=(200, 200), colour=(255, 255, 255, 255))],
                             {"watermark_text": "DRAFT", "font_size": "24", "watermark_position": position})
            with Image.open(BytesIO(result.data)) as image:
                bounds = ImageChops.difference(image.convert("RGB"), Image.new("RGB", (200, 200), "white")).getbbox()
                self.assertAlmostEqual((bounds[0] + bounds[2]) / 2, 100, delta=10)
                self.assertLess(bounds[3], 100) if position == "top" else self.assertGreater(bounds[1], 100)

    def test_custom_watermark_bounds_match_images_and_cropped_rotated_pdfs(self):
        import pypdfium2 as pdfium
        from pypdf import PdfWriter
        from pypdf.generic import RectangleObject
        from reportlab.pdfgen import canvas
        blank = BytesIO()
        page = canvas.Canvas(blank, pagesize=(320, 420))
        page.showPage()
        page.save()
        writer = PdfWriter(clone_from=PdfReader(BytesIO(blank.getvalue())))
        writer.pages[0].cropbox = RectangleObject([40, 50, 280, 350])
        writer.pages[0].rotate(90)
        cropped = BytesIO()
        writer.write(cropped)
        sources = [image_file(size=(320, 200), colour=(255, 255, 255, 255)),
                   UploadedFile("blank.pdf", blank.getvalue()), UploadedFile("cropped.pdf", cropped.getvalue())]
        box = {"x": .65, "y": .1, "width": .25, "height": .2}
        for source in sources:
            for kind in ["text", "image"]:
                for direction in ["horizontal", "diagonal"]:
                    fields = {"watermark_type": kind, "watermark_text": "DRAFT", "watermark_position": "custom",
                              "watermark_box": json.dumps(box), "orientation": direction}
                    files = [source]
                    if kind == "image":
                        files.append(image_file("logo.png", size=(40, 20)))
                        fields["watermark_file_index"] = "1"
                    result = process("watermark", files, fields)
                    if result.content_type == "application/pdf":
                        document = pdfium.PdfDocument(result.data)
                        pdf_page = document[0]
                        bitmap = pdf_page.render(scale=1)
                        image = bitmap.to_pil().convert("RGB")
                        bitmap.close()
                        pdf_page.close()
                        document.close()
                    else:
                        image = Image.open(BytesIO(result.data)).convert("RGB")
                    try:
                        bounds = ImageChops.difference(image, Image.new("RGB", image.size, "white")).getbbox()
                        self.assertIsNotNone(bounds)
                        self.assertGreaterEqual(bounds[0], image.width * box["x"] - 2)
                        self.assertGreaterEqual(bounds[1], image.height * box["y"] - 2)
                        self.assertLessEqual(bounds[2], image.width * (box["x"] + box["width"]) + 2)
                        self.assertLessEqual(bounds[3], image.height * (box["y"] + box["height"]) + 2)
                    finally:
                        image.close()

    def test_invalid_custom_watermark_bounds_are_rejected(self):
        for box in ["broken", json.dumps({"x": float("nan"), "y": 0, "width": .2, "height": .2}),
                    json.dumps({"x": .9, "y": 0, "width": .2, "height": .2}),
                    json.dumps({"x": 0, "y": 0, "width": 0, "height": .2})]:
            with self.assertRaisesRegex(PdfToolError, "placement is invalid"):
                process("watermark", [image_file()], {"watermark_text": "DRAFT", "watermark_box": box})

    def test_image_previews_use_the_first_gif_or_tiff_frame(self):
        for fmt in ["GIF", "TIFF"]:
            output = BytesIO()
            Image.new("RGB", (32, 20), "red").save(output, fmt, save_all=True, append_images=[Image.new("RGB", (32, 20), "blue")])
            result = process("image-preview", [UploadedFile("frames." + fmt.lower(), output.getvalue())], {})
            self.assertEqual(result.content_type, "image/png")
            with Image.open(BytesIO(result.data)) as image:
                self.assertEqual(image.size, (32, 20))
                self.assertEqual(image.convert("RGB").getpixel((10, 10)), (255, 0, 0))


if __name__ == "__main__":
    unittest.main()
