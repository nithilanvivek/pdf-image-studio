const { expect, test } = require("@playwright/test");
const path = require("node:path");
let server;
let siteUrl;

// A real PDF with text, a non-square page and a valid xref table.
function pdf(width = 200, height = 300, text = "Browser PDF") {
  const stream = `BT /F1 16 Tf 20 50 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}


test.beforeAll(async () => {
  const { createStaticServer } = await import("../scripts/static-server.mjs");
  server = createStaticServer(path.join(__dirname, ".."));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  siteUrl = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

async function browserTask(page, operation, fields = {}, documents = [pdf()]) {
  return page.evaluate(async ({ operation, fields, documents }) => {
    const data = new FormData();
    data.set("operation", operation);
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    documents.forEach((bytes, index) => data.append("files", new File([new Uint8Array(bytes)], `source-${index}.${bytes[0] === 37 ? "pdf" : "png"}`, { type: bytes[0] === 37 ? "application/pdf" : "image/png" })));
    const response = await window.PdfStudioProcessing.request(data);
    const blob = await response.blob();
    return { mode: response.headers.get("x-pdf-processing"), pages: response.headers.get("x-page-count"), type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())], name: response.headers.get("content-disposition") };
  }, { operation, fields, documents: documents.map(bytes => [...bytes]) });
}

test("real PDF processing stays in the browser, including rendered previews", async ({ page }) => {
  test.setTimeout(180000);
  let uploads = 0;
  await page.route("**/api/pdf-tool", route => { uploads++; return route.abort(); });
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const result = await browserTask(page, "merge-pdf", {}, [pdf(), pdf(300, 200, "Second")]);
  expect(result.mode).toBe("browser");
  expect(result.pages).toBe("2");
  expect(Buffer.from(result.bytes).subarray(0, 5).toString()).toBe("%PDF-");
  const preview = await browserTask(page, "preview-page");
  expect(preview.mode).toBe("browser");
  expect(preview.type).toBe("image/png");
  expect(preview.bytes.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const rendered = await page.evaluate(async bytes => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    bitmap.close();
    return { width: canvas.width, hasInk: pixels.some((value, index) => index % 4 !== 3 && value < 100) };
  }, preview.bytes);
  expect(rendered.width).toBe(267);
  expect(rendered.hasInk).toBe(true);
  expect(uploads).toBe(0);
});

test("editing, rasterization, image conversion and LZW TIFF run locally", async ({ page }) => {
  test.setTimeout(240000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  for (const [operation, fields, type] of [
    ["standardize-width", {}, "application/pdf"],
    ["resize", { page_width: "210", page_height: "297", page_unit: "mm" }, "application/pdf"],
    ["watermark", { watermark_text: "DRAFT" }, "application/pdf"],
    ["embed-link", { link_areas: JSON.stringify([{ page: 1, url: "https://example.com", x: .1, y: .1, width: .4, height: .2 }]) }, "application/pdf"],
    ["compress", {}, "application/pdf"],
    ["flatten", { flatten_dpi: "150" }, "application/pdf"],
    ["split", { split_format: "pdf" }, "application/zip"],
    ["split", { split_format: "png", split_dpi: "72" }, "application/zip"],
    ["split", { split_format: "jpg", split_dpi: "72" }, "application/zip"],
    ["split", { split_format: "tiff", split_dpi: "72" }, "application/zip"],
    ["pdf-tiff", { tiff_compression: "tiff_lzw", dpi: "72", tiff_color: "grayscale" }, "image/tiff"],
  ]) {
    const result = await browserTask(page, operation, fields);
    expect(result.mode, operation + JSON.stringify(fields)).toBe("browser");
    expect(result.type).toBe(type);
    expect(result.bytes.length).toBeGreaterThan(100);
    if (operation === "pdf-tiff") {
      // Exercise Pillow's multi-frame TIFF decoder and images-to-PDF on its output.
      const converted = await browserTask(page, "images-pdf", {}, [Buffer.from(result.bytes)]);
      expect(converted.mode).toBe("browser");
      expect(converted.type).toBe("application/pdf");
    }
  }
});

for (const scenario of ["unsupported", "low-memory", "crashed-worker", "large-page", "unsupported-codec"]) {
  test(`server fallback: ${scenario}`, async ({ page }) => {
    test.setTimeout(90000);
    let uploads = 0;
    await page.route("**/api/pdf-tool", route => {
      uploads++;
      return route.fulfill({ contentType: "application/pdf", headers: { "X-Page-Count": "1" }, body: pdf() });
    });
    if (scenario === "unsupported") await page.addInitScript(() => { window.Worker = undefined; });
    if (scenario === "low-memory") await page.addInitScript(() => Object.defineProperty(navigator, "deviceMemory", { value: .5 }));
    if (scenario === "crashed-worker") await page.route("**/pdf-browser-worker.js", route => route.abort());
    await page.goto(`${siteUrl}/tools/filestudio/`);
    const result = await browserTask(page, scenario === "large-page" ? "flatten" : scenario === "unsupported-codec" ? "pdf-tiff" : "standardize-width", scenario === "unsupported-codec" ? { tiff_compression: "jpeg" } : {}, [pdf(scenario === "large-page" ? 10000 : 200, 300)]);
    expect(result.mode).toBe("server");
    expect(uploads).toBe(1);
  });
}

test("invalid input reports an error without silently uploading it", async ({ page }) => {
  test.setTimeout(90000);
  let uploads = 0;
  await page.route("**/api/pdf-tool", route => { uploads++; return route.abort(); });
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const message = await browserTask(page, "watermark", { watermark_text: "" }).then(() => "", error => error.message);
  expect(message).toContain("Enter the watermark text");
  expect(uploads).toBe(0);
});

test("the interface uses the app icon and reports where the document was processed", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  await expect(page.locator(".studio-brand__mark")).toHaveAttribute("src", /^\/tools\/filestudio\/icons\/icon\.svg(?:\?v=\d+)?$/);
  await page.locator("[data-file-input]").setInputFiles([
    { name: "one.pdf", mimeType: "application/pdf", buffer: pdf() },
    { name: "two.pdf", mimeType: "application/pdf", buffer: pdf(300, 200) },
  ]);
  await page.getByRole("button", { name: "Merge PDFs" }).click();
  await expect(page.locator("[data-result]")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-status]")).toContainText("no files uploaded");
});

async function imageBytes(page) {
  return Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80; canvas.height = 40;
    const context = canvas.getContext("2d");
    context.fillStyle = "red"; context.fillRect(0, 0, 80, 40);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }));
}

test("every image task and supported image output format works locally", async ({ page }) => {
  test.setTimeout(180000);
  let uploads = 0;
  await page.route("**/api/pdf-tool", route => { uploads++; return route.abort(); });
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const image = await imageBytes(page);
  for (const [operation, fields] of [
    ["image-compress", { image_format: "jpg" }],
    ["image-resize", { width: "100", height: "100", fit: "contain" }],
    ["image-crop", { crop_left: "25", crop_right: "75" }],
    ["image-rotate", { rotation: "90", flip: "horizontal" }],
    ["image-merge", { layout: "grid", cell_width: "100", cell_height: "100" }],
    ["image-text", { text: "Hello", text_size: "12" }],
    ["image-watermark", { text: "DRAFT", text_size: "12" }],
    ["image-border", { border_width: "10" }],
    ...["png", "jpg", "webp", "tiff", "bmp", "gif"].map(image_format => ["image-convert", { image_format }]),
  ]) {
    const result = await browserTask(page, operation, fields, [image]);
    expect(result.mode, operation + JSON.stringify(fields)).toBe("browser");
    expect(result.bytes.length).toBeGreaterThan(50);
  }
  const batch = await browserTask(page, "image-resize", { width: "40", height: "20" }, [image, image]);
  expect(batch.type).toBe("application/zip");
  expect(batch.bytes.slice(0, 2)).toEqual([80, 75]);
  const combined = await browserTask(page, "combine-files", {}, [pdf(), image]);
  expect(combined.mode).toBe("browser");
  expect(combined.pages).toBe("2");
  expect(uploads).toBe(0);
});

test("one watermark tool accepts PDFs, images and mixed batches with a logo", async ({ page }) => {
  test.setTimeout(180000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  await expect(page.locator('[data-operation="image-watermark"]')).toHaveCount(0);
  await expect(page.locator(".studio-footer [data-hosted-note]")).toHaveCount(1);
  await expect(page.locator("[data-drop-zone] [data-hosted-note]")).toHaveCount(0);
  const picture = await imageBytes(page);
  for (const documents of [[pdf()], [picture], [pdf(), picture]]) {
    const result = await browserTask(page, "watermark", {
      watermark_type: "image", watermark_file_index: String(documents.length),
      watermark_width: "40", orientation: "horizontal", opacity: ".5",
    }, [...documents, picture]);
    expect(result.mode).toBe("browser");
    expect(result.type).toBe(documents.length > 1 ? "application/zip" : documents[0][0] === 37 ? "application/pdf" : "image/png");
    expect(result.pages).toBe(String(documents.length));
  }
  await page.locator('[data-operation="watermark"]').click();
  await page.locator("[data-file-input]").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: picture });
  await page.locator("[data-watermark-type]").selectOption("image");
  await expect(page.locator("[data-watermark-text]")).toBeHidden();
  await page.locator("[data-watermark-file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: picture });
  await expect(page.locator("[data-preview-logo]")).toBeVisible();
  await page.locator("[data-process]").click();
  await expect(page.locator("[data-result]")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-output-extension]")).toHaveText(".png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.FileStudioOpenFiles([new File(["pdf"], "A very long filename " + "x".repeat(100) + ".pdf", { type: "application/pdf" })]));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("[data-dismiss-opened]").click();
});

test("dragging and resizing a watermark changes the downloaded image", async ({ page }) => {
  test.setTimeout(120000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const makeImage = async (width, height, colour) => Buffer.from(await page.evaluate(async ({ width, height, colour }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = colour; context.fillRect(0, 0, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    return [...new Uint8Array(await blob.arrayBuffer())];
  }, { width, height, colour }));
  await page.locator('[data-operation="watermark"]').click();
  await page.locator("[data-file-input]").setInputFiles({ name: "white.png", mimeType: "image/png", buffer: await makeImage(320, 200, "white") });
  await page.locator("[data-watermark-type]").selectOption("image");
  await page.locator('[data-watermark-direction][value="horizontal"]').check({ force: true });
  await page.locator("[data-watermark-file]").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await makeImage(40, 20, "red") });
  const move = page.getByRole("button", { name: "Move watermark", exact: true });
  const resize = page.getByRole("button", { name: "Resize watermark", exact: true });
  await expect(move).toBeVisible();
  await move.scrollIntoViewIfNeeded();
  const initial = await move.boundingBox();
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.mouse.down();
  await page.mouse.move(initial.x + initial.width / 2 - 35, initial.y + initial.height / 2 - 20, { steps: 6 });
  await page.mouse.up();
  const moved = JSON.parse(await page.locator("[data-watermark-box]").inputValue());
  const handle = await resize.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 35, handle.y + handle.height / 2 + 18, { steps: 6 });
  await page.mouse.up();
  const box = JSON.parse(await page.locator("[data-watermark-box]").inputValue());
  expect(box.width).toBeGreaterThan(moved.width);
  expect(box.x).toBeCloseTo(moved.x, 5);
  await expect(page.locator("[data-watermark-position]")).toHaveValue("custom");
  await page.locator("[data-process]").click();
  await expect(page.locator("[data-result]")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-status]")).toContainText("Processed on your device");
  const bounds = await page.evaluate(async () => {
    const blob = await (await fetch(document.querySelector("[data-download]").href)).blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 1] < 250) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
    }
    bitmap.close();
    return { left, top, width: right - left, height: bottom - top };
  });
  expect(Math.abs(bounds.left - box.x * 320)).toBeLessThan(2);
  expect(Math.abs(bounds.top - box.y * 200)).toBeLessThan(2);
  expect(Math.abs(bounds.width - box.width * 320)).toBeLessThan(2);
  expect(Math.abs(bounds.height - box.height * 200)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await move.focus();
  await page.keyboard.press("ArrowRight");
  const keyboardBox = JSON.parse(await page.locator("[data-watermark-box]").inputValue());
  expect(keyboardBox.x).toBeCloseTo(box.x + .01, 5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await move.scrollIntoViewIfNeeded();
  const touchBox = await move.boundingBox();
  const touch = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2, id: 1 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] });
  await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...touch, x: touch.x + 12, y: touch.y + 8 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  const touched = JSON.parse(await page.locator("[data-watermark-box]").inputValue());
  expect(touched.x).toBeGreaterThan(keyboardBox.x);
  await session.detach();
  await page.locator("[data-watermark-type]").selectOption("text");
  await page.locator("[data-watermark-text]").fill("DRAFT");
  await expect(move).toBeVisible();
  await resize.focus();
  await page.keyboard.press("ArrowRight");
  const textBox = JSON.parse(await page.locator("[data-watermark-box]").inputValue());
  expect(textBox.width).toBeGreaterThan(touched.width);
  await page.locator("[data-process]").click();
  await expect(page.locator("[data-result]")).toBeVisible({ timeout: 60000 });
  await expect(page.locator("[data-status]")).toContainText("Processed on your device");
  for (const kind of ["text", "image"]) {
    const documents = kind === "image" ? [pdf(), await makeImage(40, 20, "red")] : [pdf()];
    const result = await browserTask(page, "watermark", { watermark_type: kind, watermark_file_index: "1",
      watermark_text: "DRAFT", watermark_position: "custom", watermark_box: JSON.stringify(textBox) }, documents);
    expect(result.mode).toBe("browser");
    expect(result.type).toBe("application/pdf");
  }
});

test("single-page PDF to image rejects a multi-page PDF without an upload", async ({ page }) => {
  test.setTimeout(90000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  for (const image_format of ["png", "jpg", "tiff"]) {
    const result = await browserTask(page, "pdf-image", { image_format, image_dpi: "72" });
    expect(result.mode).toBe("browser");
    expect(result.type).toBe({ png: "image/png", jpg: "image/jpeg", tiff: "image/tiff" }[image_format]);
  }
  const merged = await browserTask(page, "merge-pdf", {}, [pdf(), pdf()]);
  const message = await browserTask(page, "pdf-image", {}, [Buffer.from(merged.bytes)]).then(() => "", error => error.message);
  expect(message).toContain("single-page PDF");
});

test("image options work through the form and download the chosen format", async ({ page }) => {
  test.setTimeout(60000);
  await page.route("**/api/pdf-tool", route => route.abort());
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const image = await imageBytes(page);
  await page.locator('[data-operation="image-resize"]').click();
  await page.locator("[data-file-input]").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: image });
  const options = page.locator('[data-options="image-resize"]');
  await options.locator('[name="width"]').fill("40");
  await options.locator('[name="height"]').fill("20");
  await options.locator('[name="image_format"]').selectOption("webp");
  await expect(page.locator("[data-output-extension]")).toHaveText(".webp");
  await page.locator("[data-process]").click();
  await expect(page.locator("[data-result]")).toBeVisible({ timeout: 45000 });
  await expect(page.locator("[data-download]")).toHaveAttribute("download", "resize.webp");
  await expect(page.locator("[data-status]")).toContainText("no files uploaded");
});

test("task toggles use OR for tasks involving both PDFs and images", async ({ page }) => {
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const image = page.getByRole("switch", { name: "Involves image" });
  const pdfFilter = page.getByRole("switch", { name: "Involves pdf" });
  await expect(image).toBeChecked(); await expect(pdfFilter).toBeChecked();
  await pdfFilter.uncheck();
  await expect(page.locator('[data-operation="merge-pdf"]')).toBeHidden();
  await expect(page.locator('[data-operation="images-pdf"]')).toBeVisible();
  await expect(page.locator('[data-operation="pdf-image"]')).toBeVisible();
  await expect(page.locator('[data-operation="image-compress"]')).toBeVisible();
  await image.uncheck();
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator("[data-filter-empty]")).toBeVisible();
  await pdfFilter.check();
  await expect(page.locator('[data-operation="image-compress"]')).toBeHidden();
  await expect(page.locator('[data-operation="pdf-image"]')).toBeVisible();
  await expect(page.locator('[data-operation="merge-pdf"]')).toBeVisible();
});

test("OS file opening offers suitable tasks for one PDF, multiple PDFs, images and mixed files", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, "launchQueue", { configurable: true, value: { setConsumer(consumer) { window.testLaunchConsumer = consumer; } } }); });
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const image = await imageBytes(page);
  async function launch(files) {
    await page.evaluate(async files => {
      await window.testLaunchConsumer({ files: files.map(item => ({ getFile: async () => new File([new Uint8Array(item.bytes)], item.name, { type: item.type }) })) });
    }, files);
  }
  const one = { name: "one.pdf", type: "application/pdf", bytes: [...pdf()] };
  const picture = { name: "picture.png", type: "image/png", bytes: [...image] };
  const choices = page.locator("[data-opened-tasks]");
  await launch([one]);
  await expect(page.locator("[data-opened-names] li")).toHaveText(["one.pdf"]);
  await expect(choices.getByRole("button", { name: "PDF to image" })).toBeVisible();
  await expect(choices.getByRole("button", { name: "Merge PDFs" })).toHaveCount(0);
  await launch([one, { ...one, name: "two.pdf" }]);
  await expect(page.locator("[data-opened-names] li")).toHaveText(["one.pdf", "two.pdf"]);
  await expect(choices.getByRole("button", { name: "Merge PDFs" })).toBeVisible();
  await expect(choices.getByRole("button", { name: "PDF to image" })).toHaveCount(0);
  await launch([picture]);
  await expect(choices.getByRole("button", { name: "Compress images" })).toBeVisible();
  await launch([one, picture]);
  await expect(page.locator("[data-opened-names] li")).toHaveText(["one.pdf", "picture.png"]);
  await expect(choices.getByRole("button", { name: "Watermark", exact: true })).toBeVisible();
  await expect(choices.getByRole("button", { name: "Combine PDFs & images" })).toBeVisible();
  await choices.getByRole("button", { name: "Combine PDFs & images" }).click();
  await expect(page.locator("[data-file-summary]")).toContainText("2 files");
});

test("install identity and offline processing belong only to this studio", async ({ page, context }) => {
  test.setTimeout(90000);
  await page.goto(`${siteUrl}/tools/filestudio/`);
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel="manifest"]').href)).json());
  expect(manifest.name).toBe("PDF + Image Studio");
  expect(manifest.short_name).toBe("PDF + Image Studio");
  expect(manifest.scope).toBe("/tools/filestudio/");
  expect(manifest.start_url).toBe("/tools/filestudio/");
  expect(manifest.file_handlers[0].accept["application/pdf"]).toEqual([".pdf"]);
  await expect(page).toHaveTitle(/PDF \+ Image Studio/);
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active.scriptURL.endsWith("/tools/filestudio/service-worker.js")) throw new Error("Wrong service worker");
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
  });
  const image = await imageBytes(page);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const result = await browserTask(page, "image-resize", { width: "40", height: "20" }, [image]);
  expect(result.mode).toBe("browser");
  const keys = await page.evaluate(async () => {
    const all = [];
    for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) all.push(request.url);
    return all;
  });
  expect(keys.every(url => new URL(url).pathname.startsWith("/tools/filestudio/"))).toBe(true);
  expect(keys.some(url => url.includes("/api/") || url.includes("source-"))).toBe(false);
});

test("old PDF and image URLs redirect to the studio", async ({ page }) => {
  for (const route of ["/tools/pdf/", "/tools/images/", "/tools/pdf", "/tools/images"]) {
    await page.goto(siteUrl + route);
    await expect(page).toHaveURL(siteUrl + "/tools/filestudio/");
    await expect(page).toHaveTitle(/PDF \+ Image Studio/);
  }
});

test("oversized hosted fallback gives an actionable error without uploading", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  let uploads = 0;
  try {
    await page.addInitScript(() => { window.Worker = undefined; });
    await page.route("https://studio.test/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/pdf-tool") { uploads++; return route.abort(); }
      const response = await page.request.get(siteUrl + url.pathname);
      return route.fulfill({ response });
    });
    await page.goto("https://studio.test/tools/filestudio/");
    const message = await page.evaluate(async () => {
      const data = new FormData();
      data.set("operation", "standardize-width");
      data.append("files", new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.pdf"));
      try { await window.PdfStudioProcessing.request(data); return ""; } catch (error) { return error.message; }
    });
    expect(message).toContain("4 MB");
    expect(message).toContain("desktop app");
    expect(uploads).toBe(0);
  } finally {
    await context.close();
  }
});
