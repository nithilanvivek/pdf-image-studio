const { expect, test } = require("@playwright/test");
const path = require("node:path");

let server;
let siteUrl;

test.beforeAll(async () => {
  const { createStaticServer } = await import("../scripts/static-server.mjs");
  server = createStaticServer(path.join(__dirname, ".."));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  siteUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// These tests exercise the server contract with placeholder uploads. Real browser
// processing, valid PDFs and automatic fallback are covered in pdf-browser.spec.js.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.Worker = undefined; });
});

test("PDF + Image Studio exposes all document tasks and relevant options", async ({ page }) => {
  await page.route("**/api/pdf-tool", (route) => route.fulfill({
    status: 200,
    contentType: "image/svg+xml",
    headers: { "X-Page-Count": "3" },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="white"/><rect x="40" y="50" width="320" height="200" fill="#eee"/></svg>'
  }));
  await page.goto(`${siteUrl}/tools/filestudio/`);
  await expect(page).toHaveTitle(/PDF \+ Image Studio/);
  await expect(page.getByText("Powered by Python")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Merge PDF files" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Merge PDFs/ })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: /Split pages/ }).click();
  await expect(page.getByRole("heading", { name: "Split every PDF page" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "chapters.pdf", mimeType: "application/pdf", buffer: Buffer.from("chapters")
  });
  await expect(page.getByLabel("Each page as")).toHaveValue("pdf");
  await expect(page.locator("[data-output-extension]")).toHaveText(".zip");
  await page.getByLabel("Each page as").selectOption("png");
  await expect(page.locator('[data-options="split"] select[name="split_dpi"]')).toBeVisible();
  await page.getByLabel("Each page as").selectOption("jpg");
  await expect(page.locator("[data-split-quality]")).toBeVisible();

  await page.getByRole("tab", { name: /Resize PDF/ }).click();
  await expect(page.getByRole("heading", { name: "Resize PDF pages" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "poster.pdf", mimeType: "application/pdf", buffer: Buffer.from("poster")
  });
  await page.locator("[data-page-preset]").selectOption("letter");
  await expect(page.locator("[data-page-width]")).toHaveValue("8.5");
  await expect(page.locator("[data-page-height]")).toHaveValue("11");
  await expect(page.locator("[data-page-unit]")).toHaveValue("in");

  await page.getByRole("tab", { name: /Standardize width/ }).click();
  await expect(page.getByRole("heading", { name: "Standardize PDF page width" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resizes proportionally - never stretches" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "mixed-pages.pdf", mimeType: "application/pdf", buffer: Buffer.from("mixed-pages")
  });
  await expect(page.locator('[data-options="standardize-width"]')).toContainText("widest page becomes the target");
  await expect(page.getByRole("button", { name: "Standardize width" })).toBeVisible();

  await page.getByRole("tab", { name: /Flatten\/Rasterize/ }).click();
  await expect(page.getByRole("heading", { name: "Flatten/Rasterize and Sanitize PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creates a picture-only, sanitized PDF" })).toBeVisible();
  await expect(page.locator("[data-operation-explainer]")).toContainText("Text will no longer be searchable");
  await page.locator("[data-file-input]").setInputFiles({
    name: "font-heavy.pdf", mimeType: "application/pdf", buffer: Buffer.from("font-heavy")
  });
  await expect(page.getByLabel("Raster resolution")).toHaveValue("300");
  await expect(page.locator('[data-options="flatten"]')).toContainText("Embedded fonts, selectable text");
  await expect(page.getByRole("button", { name: "Flatten/Rasterize PDF" })).toBeVisible();

  await page.getByRole("tab", { name: /Embed links/ }).click();
  await expect(page.getByRole("heading", { name: "Embed clickable links" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "brochure.pdf", mimeType: "application/pdf", buffer: Buffer.from("brochure")
  });
  await expect(page.locator("[data-link-preview-image]")).toBeVisible();
  await expect(page.locator("[data-link-page] option")).toHaveCount(3);
  await page.locator("[data-link-page]").selectOption("2");
  await expect(page.locator("[data-link-preview-state]")).toContainText("Page 2");
  const linkCanvas = page.locator("[data-link-canvas]");
  await expect(linkCanvas).toBeVisible();
  const linkBox = await linkCanvas.boundingBox();
  await linkCanvas.dispatchEvent("pointerdown", { pointerId: 1, clientX: linkBox.x + 80, clientY: linkBox.y + 70 });
  await linkCanvas.dispatchEvent("pointermove", { pointerId: 1, clientX: linkBox.x + 250, clientY: linkBox.y + 170 });
  await linkCanvas.dispatchEvent("pointerup", { pointerId: 1, clientX: linkBox.x + 250, clientY: linkBox.y + 170 });
  await expect(page.locator("[data-link-selection]")).toBeVisible();
  await page.locator("[data-link-url]").fill("https://example.com/details");
  await page.getByRole("button", { name: "Add link area" }).click();
  await expect(page.locator("[data-link-area-list] .link-area-item")).toHaveCount(1);
  await expect(page.locator("[data-link-area-count]")).toHaveText("1 area");

  await page.locator("[data-link-page]").selectOption("3");
  await expect(page.locator("[data-link-preview-state]")).toContainText("Page 3");
  const secondBox = await linkCanvas.boundingBox();
  await linkCanvas.dispatchEvent("pointerdown", { pointerId: 2, clientX: secondBox.x + 35, clientY: secondBox.y + 30 });
  await linkCanvas.dispatchEvent("pointermove", { pointerId: 2, clientX: secondBox.x + 150, clientY: secondBox.y + 95 });
  await linkCanvas.dispatchEvent("pointerup", { pointerId: 2, clientX: secondBox.x + 150, clientY: secondBox.y + 95 });
  await page.locator("[data-link-url]").fill("https://example.com/contact");
  await page.getByRole("button", { name: "Add link area" }).click();
  await expect(page.locator("[data-link-area-list] .link-area-item")).toHaveCount(2);
  await expect(page.locator("[data-link-area-count]")).toHaveText("2 areas");
  await expect(page.locator("[data-link-areas]")).toHaveValue(/example\.com\/details.*example\.com\/contact/);
  await expect(page.getByRole("button", { name: "Embed links" })).toBeVisible();

  await page.locator('[data-operation="watermark"]').click();
  await expect(page.getByRole("heading", { name: "Watermark PDFs and images" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "draft.pdf", mimeType: "application/pdf", buffer: Buffer.from("draft")
  });
  await expect(page.locator("[data-opacity]")).toBeVisible();
  await expect(page.getByLabel("Diagonal")).toBeChecked();
  await expect(page.locator("[data-preview-image]")).toBeVisible();
  await page.locator("[data-watermark-text]").fill("DRAFT");
  await page.locator('[data-watermark-direction][value="horizontal"]').setChecked(true, { force: true });
  await expect(page.locator("[data-preview-watermark]")).toHaveText("DRAFT");
  await expect(page.locator("[data-preview-watermark]")).toHaveAttribute("style", /rotate\(0deg\)/);

  await page.getByRole("tab", { name: /PDF to TIFF/ }).click();
  await expect(page.getByRole("heading", { name: "Convert PDF to TIFF" })).toBeVisible();
  await page.locator("[data-file-input]").setInputFiles({
    name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from("scan")
  });
  await expect(page.locator('[data-options="pdf-tiff"] select[name="dpi"]')).toHaveValue("150");
  await expect(page.locator("[data-tiff-compression]")).toHaveValue("");
  await expect(page.getByLabel("TIFF compression guide")).toContainText("LZW");
  await expect(page.getByLabel("TIFF compression guide")).toContainText("Deflate");
  await expect(page.getByLabel("TIFF compression guide")).toContainText("JPEG");
  await page.locator("[data-tiff-compression]").selectOption("jpeg");
  await expect(page.locator('[data-options="pdf-tiff"] select[name="tiff_color"]')).toHaveValue("color");
});

test("files can be selected, reordered, processed and downloaded", async ({ page }) => {
  await page.route("**/api/pdf-tool", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": 'attachment; filename="joined-notes.pdf"',
        "X-Page-Count": "2"
      },
      body: "%PDF-1.4\n%%EOF"
    });
  });
  await page.goto(`${siteUrl}/tools/filestudio/`);
  await page.locator("[data-file-input]").setInputFiles([
    { name: "chapter-one.pdf", mimeType: "application/pdf", buffer: Buffer.from("one") },
    { name: "chapter-two.pdf", mimeType: "application/pdf", buffer: Buffer.from("two") }
  ]);

  await expect(page.locator("[data-file-summary]")).toContainText("2 files");
  await expect(page.locator(".file-item").first()).toContainText("chapter-one.pdf");
  await page.getByRole("button", { name: "Move chapter-two.pdf up" }).click();
  await expect(page.locator(".file-item").first()).toContainText("chapter-two.pdf");

  await page.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(page.getByRole("heading", { name: "Your file is finished" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" })).toHaveAttribute("download", "joined-notes.pdf");
  await expect(page.locator("[data-result-meta]")).toContainText("2 pages");
});
