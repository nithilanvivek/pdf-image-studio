/* Task definitions and option controls shared by the sidebar and file-open flow. */
(() => {
  const imageAccept = "image/png,image/jpeg,image/webp,image/tiff,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp";
  const field = (label, control, help = "") => `<label class="field-group"><span>${label}</span>${control}${help ? `<small>${help}</small>` : ""}</label>`;
  const number = (name, value, min, max) => `<input type="number" name="${name}" value="${value}" min="${min}" max="${max}" required>`;
  const select = (name, options) => `<select name="${name}">${options.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select>`;
  const formats = [["png", "PNG · Lossless, transparency"], ["jpg", "JPEG · Compact photos"], ["webp", "WebP · Compact, transparency"], ["tiff", "TIFF · Lossless"], ["bmp", "BMP"], ["gif", "GIF · 256 colours"]];
  const definitions = {
    "image-compress": ["Compress images", "Reduce image file size", "Re-encode photos at your chosen quality, or optimize PNGs losslessly. An already optimized image may not become smaller."],
    "image-resize": ["Resize images", "Set image dimensions", "Fit, fill or stretch images to exact pixel dimensions. Fit preserves proportions and adds background padding."],
    "image-crop": ["Crop images", "Keep the area you need", "Set the crop edges as percentages of each image. The same crop works across a batch of different image sizes."],
    "image-rotate": ["Rotate & flip", "Change image orientation", "Rotate clockwise or flip horizontally or vertically. All frames in a multi-frame file are processed."],
    "image-convert": ["Convert images", "Change image format", "Convert PNG, JPEG, WebP, TIFF, BMP and GIF. Multi-frame inputs become separately numbered images."],
    "image-merge": ["Merge images", "Collages & stitched images", "Arrange images vertically, horizontally or in a grid. Each image fits proportionally inside its cell; change the cell sizes and spacing below."],
    "image-text": ["Add text to images", "Caption your images", "Add a centered caption at the top, middle or bottom of each image."],
    "image-border": ["Add image borders", "Frame your images", "Add an even border in your chosen colour without cropping the original image."],
  };
  const options = {
    "image-resize": field("Width (pixels)", number("width", 1600, 1, 32768)) + field("Height (pixels)", number("height", 1200, 1, 32768)) + field("Fitting", select("fit", [["contain", "Fit with padding"], ["cover", "Fill and crop"], ["stretch", "Stretch to dimensions"]])),
    "image-crop": [["Left edge (%)", "crop_left", 0, 0, 99], ["Top edge (%)", "crop_top", 0, 0, 99], ["Right edge (%)", "crop_right", 100, 1, 100], ["Bottom edge (%)", "crop_bottom", 100, 1, 100]].map(([label, name, value, min, max]) => field(label, number(name, value, min, max))).join(""),
    "image-rotate": field("Clockwise rotation", select("rotation", [["90", "90°"], ["180", "180°"], ["270", "270°"], ["0", "No rotation"]])) + field("Flip", select("flip", [["none", "No flip"], ["horizontal", "Horizontal"], ["vertical", "Vertical"]])),
    "image-merge": field("Layout", select("layout", [["vertical", "Vertical stitch"], ["horizontal", "Horizontal stitch"], ["grid", "Grid collage"]])) + field("Cell width (pixels)", number("cell_width", 800, 32, 8192)) + field("Cell height (pixels)", number("cell_height", 600, 32, 8192)) + field("Grid columns", number("columns", 2, 1, 20)) + field("Spacing (pixels)", number("gap", 0, 0, 500)),
    "image-border": field("Border width (pixels)", number("border_width", 20, 0, 2000)) + field("Border colour", '<input type="color" name="border_color" value="#ffffff">'),
  };
  options["image-text"] = field("Text", '<input type="text" name="text" maxlength="200" placeholder="Your text" required>') + field("Text size (pixels)", number("text_size", 48, 8, 1000)) + field("Text colour", '<input type="color" name="text_color" value="#111111">') + field("Text opacity (%)", number("text_opacity", 100, 1, 100)) + field("Text position", select("text_position", [["center", "Center"], ["top", "Top"], ["bottom", "Bottom"]]));
  const operations = {};
  for (const [id, [action, title, description]] of Object.entries(definitions)) {
    operations[id] = { title, description, eyebrow: action, action, shortTitle: action, types: ["image"], accept: imageAccept, multiple: true, dropTitle: "Drop your images here", dropCopy: "PNG, JPEG, WebP, TIFF, BMP and GIF", choose: "Choose images", output: id.replace("image-", ""), extension: id === "image-compress" ? ".jpg" : ".png", minimum: 1, limits: "Up to 100 files · 250 MB total · 500 frames" };
    const section = document.createElement("div");
    section.className = "option-grid";
    section.dataset.options = id;
    section.hidden = true;
    const orderedFormats = id === "image-compress" ? [formats[1], ...formats.filter(([fmt]) => fmt !== "jpg")] : formats;
    section.innerHTML = (options[id] || "") + field("Output image format", select("image_format", orderedFormats)) + field("JPEG / WebP quality (%)", number("image_quality", 80, 1, 100), "PNG and TIFF use lossless compression.") + field("Background colour", '<input type="color" name="background" value="#ffffff">', "Used for padding and JPEG/BMP transparency.") + '<p class="option-note field-group--wide">One image downloads directly. Batches and all frames from TIFF/GIF files download as a ZIP. Original files stay unchanged; EXIF and other source metadata are omitted.</p>';
    document.querySelector("[data-options-card]").append(section);
  }
  operations["pdf-image"] = { title: "Single-page PDF to image", shortTitle: "PDF to image", eyebrow: "Export one page", description: "Turn a single-page PDF into PNG, JPEG or TIFF. Multi-page PDFs are rejected; use Split pages to export those.", types: ["pdf", "image"], accept: "application/pdf,.pdf", multiple: false, dropTitle: "Drop one single-page PDF here", dropCopy: "PNG, JPEG or TIFF output", choose: "Choose a PDF", action: "Create image", output: "page", extension: ".png", minimum: 1, limits: "One single-page PDF · 250 MB maximum" };
  operations["combine-files"] = { title: "Combine PDFs and images", shortTitle: "Combine PDFs & images", eyebrow: "Bring your files together", description: "Arrange PDFs and supported images in any order and combine them into one PDF, including every TIFF or GIF frame.", types: ["pdf", "image"], accept: `application/pdf,.pdf,${imageAccept}`, multiple: true, dropTitle: "Drop PDFs and images here", dropCopy: "Arrange them in the order you want", choose: "Choose PDFs and images", action: "Combine files", output: "combined", extension: ".pdf", minimum: 2, limits: "Up to 100 files · 250 MB total · 500 pages" };
  const section = document.createElement("div");
  section.className = "option-grid";
  section.dataset.options = "pdf-image";
  section.hidden = true;
  section.innerHTML = field("Output image format", select("image_format", formats.filter(([fmt]) => ["png", "jpg", "tiff"].includes(fmt)))) + field("Image resolution", select("image_dpi", [["150", "150 DPI"], ["72", "72 DPI"], ["96", "96 DPI"], ["200", "200 DPI"], ["300", "300 DPI"]])) + field("JPEG quality (%)", number("image_quality", 88, 45, 95));
  document.querySelector("[data-options-card]").append(section);
  for (const [id, config] of Object.entries(operations)) {
    const button = document.createElement("button");
    button.className = "tool-tab";
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.dataset.operation = id;
    button.innerHTML = '<span class="tool-tab__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4zM4 16l5-5 3 3 2-2 6 6M15 9h.01"/></svg></span><span><strong></strong><small></small></span>';
    button.querySelector("strong").textContent = config.shortTitle;
    button.querySelector("small").textContent = config.types.length === 2 ? "PDFs & images" : "Image tools";
    document.querySelector(".tool-tabs").append(button);
  }
  window.FileStudioTools = { operations, imageAccept };
})();
