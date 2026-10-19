from __future__ import annotations

import unittest
from io import BytesIO
from zipfile import ZipFile

from PIL import Image
from pypdf import PdfReader
from reportlab.pdfgen import canvas

from lib.pdf_tool import (
    PdfToolError,
    UploadedFile,
    compress_pdf,
    embed_link,
    embed_links,
    flatten_pdf,
    images_to_pdf,
    merge_pdfs,
    pdf_to_tiff,
    preview_first_page,
    resize_pdf,
    split_pdfs,
    standardize_pdf_width,
    watermark_pdf,
)


def make_pdf(label: str, pages: int = 1, page_size: tuple[int, int] = (320, 420)) -> bytes:
    output = BytesIO()
    document = canvas.Canvas(output, pagesize=page_size)
    for index in range(pages):
        document.setFont("Helvetica", 18)
        document.drawString(42, 340, f"{label} {index + 1}")
        document.showPage()
    document.save()
    return output.getvalue()


def make_mixed_pdf() -> bytes:
    output = BytesIO()
    document = canvas.Canvas(output, pagesize=(320, 420))
    document.drawString(42, 340, "Narrow page")
    document.showPage()
    document.setPageSize((640, 400))
    document.drawString(42, 320, "Wide page")
    document.showPage()
    document.save()
    return output.getvalue()


def make_image(format_name: str, color: tuple[int, int, int], size: tuple[int, int] = (180, 120)) -> bytes:
    output = BytesIO()
    Image.new("RGB", size, color).save(output, format=format_name)
    return output.getvalue()


def make_multipage_tiff() -> bytes:
    output = BytesIO()
    first = Image.new("RGB", (180, 240), (245, 245, 245))
    second = Image.new("RGB", (360, 120), (40, 90, 180))
    try:
        first.save(output, format="TIFF", save_all=True, append_images=[second], compression="tiff_lzw")
        return output.getvalue()
    finally:
        first.close()
        second.close()


class PdfToolTests(unittest.TestCase):
    def test_merges_pdfs_in_order(self):
        result = merge_pdfs([
            UploadedFile("first.pdf", make_pdf("First", 2)),
            UploadedFile("second.pdf", make_pdf("Second")),
        ])
        reader = PdfReader(BytesIO(result.data))
        self.assertEqual(len(reader.pages), 3)
        self.assertIn("First 1", reader.pages[0].extract_text())
        self.assertIn("Second 1", reader.pages[2].extract_text())

    def test_merge_normalizes_width_without_stretching(self):
        result = merge_pdfs([
            UploadedFile("narrow.pdf", make_pdf("Narrow", page_size=(320, 420))),
            UploadedFile("wide.pdf", make_pdf("Wide", page_size=(640, 400))),
        ])
        pages = PdfReader(BytesIO(result.data)).pages
        self.assertEqual([float(page.mediabox.width) for page in pages], [640, 640])
        self.assertEqual(float(pages[0].mediabox.height), 840)
        self.assertEqual(float(pages[1].mediabox.height), 400)

    def test_requires_two_pdfs_for_merge(self):
        with self.assertRaisesRegex(PdfToolError, "at least two"):
            merge_pdfs([UploadedFile("one.pdf", make_pdf("One"))])

    def test_converts_mixed_images_to_pdf(self):
        result = images_to_pdf([
            UploadedFile("red.png", make_image("PNG", (220, 30, 40))),
            UploadedFile("blue.jpg", make_image("JPEG", (20, 70, 220), size=(360, 100))),
        ])
        pages = PdfReader(BytesIO(result.data)).pages
        self.assertEqual(len(pages), 2)
        self.assertEqual(float(pages[0].mediabox.width), float(pages[1].mediabox.width))

    def test_converts_each_multipage_tiff_frame_and_standardizes_width(self):
        result = images_to_pdf([UploadedFile("scan.tiff", make_multipage_tiff())], quality=92)
        pages = PdfReader(BytesIO(result.data)).pages
        self.assertEqual(result.page_count, 2)
        self.assertEqual(len(pages), 2)
        self.assertEqual(float(pages[0].mediabox.width), float(pages[1].mediabox.width))

    def test_standardizes_pdf_width_without_stretching(self):
        result = standardize_pdf_width(UploadedFile("mixed.pdf", make_mixed_pdf()))
        pages = PdfReader(BytesIO(result.data)).pages
        self.assertEqual([float(page.mediabox.width) for page in pages], [640, 640])
        self.assertEqual([float(page.mediabox.height) for page in pages], [840, 400])
        self.assertIn("Narrow page", pages[0].extract_text())
        self.assertIn("Wide page", pages[1].extract_text())

    def test_adds_watermark_to_every_page(self):
        result = watermark_pdf(
            UploadedFile("source.pdf", make_mixed_pdf()),
            "DRAFT",
            orientation="diagonal",
            opacity=0.25,
        )
        reader = PdfReader(BytesIO(result.data))
        self.assertEqual(len(reader.pages), 2)
        self.assertIn("DRAFT", reader.pages[0].extract_text())
        self.assertIn("Wide page", reader.pages[1].extract_text())
        self.assertEqual(float(reader.pages[0].mediabox.width), float(reader.pages[1].mediabox.width))

    def test_compression_returns_readable_pdf(self):
        result = compress_pdf(UploadedFile("source.pdf", make_mixed_pdf()), "balanced")
        pages = PdfReader(BytesIO(result.data)).pages
        self.assertEqual(len(pages), 2)
        self.assertEqual(float(pages[0].mediabox.width), float(pages[1].mediabox.width))

    def test_resizes_pages_to_exact_dimensions_with_proportional_fit(self):
        result = resize_pdf(UploadedFile("source.pdf", make_mixed_pdf()), 210, 297, "mm")
        pages = PdfReader(BytesIO(result.data)).pages
        expected_width = 210 * 72 / 25.4
        expected_height = 297 * 72 / 25.4
        self.assertEqual(len(pages), 2)
        for page in pages:
            self.assertAlmostEqual(float(page.mediabox.width), expected_width, places=3)
            self.assertAlmostEqual(float(page.mediabox.height), expected_height, places=3)
        self.assertIn("Narrow page", pages[0].extract_text())
        self.assertIn("Wide page", pages[1].extract_text())

    def test_flattens_fonts_text_and_metadata_to_lossless_page_images(self):
        source_data = make_mixed_pdf()
        source_reader = PdfReader(BytesIO(source_data))
        self.assertTrue(source_reader.pages[0]["/Resources"].get_object().get("/Font"))
        result = flatten_pdf(UploadedFile("source.pdf", source_data), dpi=150)
        reader = PdfReader(BytesIO(result.data))
        self.assertEqual(len(reader.pages), 2)
        self.assertIsNone(reader.metadata)
        self.assertNotIn("/AcroForm", reader.trailer["/Root"])
        self.assertEqual(float(reader.pages[0].mediabox.width), float(reader.pages[1].mediabox.width))
        for page in reader.pages:
            resources = page["/Resources"].get_object()
            self.assertNotIn("/Font", resources)
            self.assertNotIn("/Text", resources.get("/ProcSet", []))
            self.assertNotIn("/Annots", page)
            self.assertEqual(page.extract_text(), "")
            embedded_image = list(page.images)[0].image
            effective_dpi = embedded_image.width / (float(page.mediabox.width) / 72)
            self.assertAlmostEqual(effective_dpi, 150, delta=0.5)
            embedded_image.close()

    def test_embeds_an_invisible_uri_annotation_on_the_selected_page(self):
        source = UploadedFile("source.pdf", make_mixed_pdf())
        result = embed_link(source, 2, "https://example.com/article", 0.25, 0.2, 0.5, 0.3)
        reader = PdfReader(BytesIO(result.data))
        self.assertNotIn("/Annots", reader.pages[0])
        annotation = reader.pages[1]["/Annots"][0].get_object()
        self.assertEqual(annotation["/Subtype"], "/Link")
        self.assertEqual(annotation["/A"]["/URI"], "https://example.com/article")
        self.assertEqual([float(value) for value in annotation["/Rect"]], [160, 200, 480, 320])
        self.assertIn("Wide page", reader.pages[1].extract_text())

    def test_embeds_multiple_uri_areas_across_pages(self):
        source = UploadedFile("source.pdf", make_mixed_pdf())
        result = embed_links(source, [
            {"page": 1, "url": "https://example.com/one", "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2},
            {"page": 1, "url": "https://example.com/two", "x": 0.5, "y": 0.5, "width": 0.25, "height": 0.15},
            {"page": 2, "url": "https://example.com/three", "x": 0.2, "y": 0.3, "width": 0.4, "height": 0.2},
        ])
        reader = PdfReader(BytesIO(result.data))
        first_page_links = [item.get_object() for item in reader.pages[0]["/Annots"]]
        second_page_links = [item.get_object() for item in reader.pages[1]["/Annots"]]
        self.assertEqual(len(first_page_links), 2)
        self.assertEqual(len(second_page_links), 1)
        self.assertEqual(first_page_links[0]["/A"]["/URI"], "https://example.com/one")
        self.assertEqual(first_page_links[1]["/A"]["/URI"], "https://example.com/two")
        self.assertEqual(second_page_links[0]["/A"]["/URI"], "https://example.com/three")

    def test_rejects_empty_or_excessive_link_area_lists(self):
        source = UploadedFile("source.pdf", make_mixed_pdf())
        with self.assertRaisesRegex(PdfToolError, "at least one"):
            embed_links(source, [])
        area = {"page": 1, "url": "https://example.com", "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.2}
        with self.assertRaisesRegex(PdfToolError, "at most 100"):
            embed_links(source, [area] * 101)

    def test_rejects_invalid_link_urls_and_previews_selected_pages(self):
        source = UploadedFile("source.pdf", make_mixed_pdf())
        with self.assertRaisesRegex(PdfToolError, "complete http"):
            embed_link(source, 1, "javascript:alert(1)", 0.1, 0.1, 0.2, 0.2)
        preview = preview_first_page(source, dpi=72, page_number=2)
        image = Image.open(BytesIO(preview.data))
        self.assertEqual(preview.page_count, 2)
        self.assertEqual(image.size, (640, 400))
        image.close()

    def test_converts_pdf_to_single_multipage_tiff(self):
        result = pdf_to_tiff(UploadedFile("source.pdf", make_pdf("Raster", 2)), dpi=72)
        image = Image.open(BytesIO(result.data))
        self.assertEqual(getattr(image, "n_frames", 1), 2)
        self.assertEqual(result.content_type, "image/tiff")
        image.close()

    def test_grayscale_tiff_and_first_page_preview(self):
        source = UploadedFile("source.pdf", make_pdf("Preview"))
        tiff = pdf_to_tiff(source, dpi=72, compression="jpeg", color_mode="grayscale")
        image = Image.open(BytesIO(tiff.data))
        self.assertEqual(image.mode, "L")
        image.close()
        preview = preview_first_page(source, dpi=72)
        preview_image = Image.open(BytesIO(preview.data))
        self.assertEqual(preview_image.format, "PNG")
        self.assertEqual(preview.page_count, 1)
        preview_image.close()

    def test_splits_each_page_to_an_individual_pdf_in_a_zip(self):
        result = split_pdfs([UploadedFile("source.pdf", make_pdf("Split", 2))], "pdf")
        self.assertEqual(result.content_type, "application/zip")
        with ZipFile(BytesIO(result.data)) as archive:
            self.assertEqual(archive.namelist(), ["source-page-0001.pdf", "source-page-0002.pdf"])
            first_page = PdfReader(BytesIO(archive.read("source-page-0001.pdf")))
            self.assertEqual(len(first_page.pages), 1)
            self.assertIn("Split 1", first_page.pages[0].extract_text())

    def test_splits_pages_to_each_supported_image_format(self):
        source = UploadedFile("scan.pdf", make_pdf("Raster"))
        for output_format, extension, expected_format in (
            ("tiff", "tiff", "TIFF"),
            ("png", "png", "PNG"),
            ("jpg", "jpg", "JPEG"),
        ):
            with self.subTest(output_format=output_format):
                result = split_pdfs([source], output_format, dpi=72)
                with ZipFile(BytesIO(result.data)) as archive:
                    name = f"scan-page-0001.{extension}"
                    image = Image.open(BytesIO(archive.read(name)))
                    self.assertEqual(image.format, expected_format)
                    image.close()


if __name__ == "__main__":
    unittest.main()
