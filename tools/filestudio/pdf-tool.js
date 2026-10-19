(() => {
  const operations = {
    "merge-pdf": {
      title: "Merge PDF files",
      eyebrow: "Combine documents",
      description: "Put several PDFs into one clean document. Arrange them in exactly the order you need.",
      accept: "application/pdf,.pdf",
      multiple: true,
      dropTitle: "Drop your PDFs here",
      dropCopy: "or choose files from your device",
      choose: "Choose PDF files",
      action: "Merge PDFs",
      output: "merged",
      extension: ".pdf",
      minimum: 2,
      limits: "Up to 100 files · 250 MB total · 500 pages"
    },
    split: {
      title: "Split every PDF page",
      eyebrow: "Separate documents",
      description: "Export each page as its own PDF, TIFF, PNG or JPEG. Every result is clearly numbered and packed into one ZIP.",
      accept: "application/pdf,.pdf",
      multiple: true,
      dropTitle: "Drop your PDFs here",
      dropCopy: "each page will become a separate file",
      choose: "Choose PDF files",
      action: "Split pages",
      output: "split-pages",
      extension: ".zip",
      minimum: 1,
      limits: "Up to 100 files · 250 MB total · 500 pages"
    },
    "images-pdf": {
      title: "Turn images into a PDF",
      eyebrow: "Build a document",
      description: "Combine PNG, JPEG, WebP, TIFF, BMP and GIF images into a single PDF, including every frame in a multi-frame file.",
      accept: "image/tiff,image/jpeg,image/png,.tif,.tiff,.jpg,.jpeg,.png",
      multiple: true,
      dropTitle: "Drop your images here",
      dropCopy: "PNG, JPEG, WebP, TIFF, BMP and GIF are supported",
      choose: "Choose images",
      action: "Create PDF",
      output: "images",
      extension: ".pdf",
      minimum: 1,
      limits: "Up to 100 files · 250 MB total · 500 output pages"
    },
    resize: {
      title: "Resize PDF pages",
      eyebrow: "Set exact dimensions",
      description: "Fit every page into a chosen width and height. Content keeps its proportions and any extra space becomes blank margins.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "set the new page dimensions in the next step",
      choose: "Choose a PDF",
      action: "Resize PDF",
      output: "resized",
      extension: ".pdf",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 500 pages"
    },
    "standardize-width": {
      title: "Standardize PDF page width",
      eyebrow: "Match every page",
      description: "Give every page the same width by resizing each page proportionally. Heights adjust naturally, with no stretching or cropping.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "all pages will be matched to the widest page",
      choose: "Choose a PDF",
      action: "Standardize width",
      output: "standardized",
      extension: ".pdf",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 500 pages",
      explainer: {
        title: "Resizes proportionally - never stretches",
        copy: "The widest page is used as the common target width.",
        points: [
          "Narrower pages are enlarged uniformly, so width and height stay in proportion.",
          "Page content is not cropped, squeezed, or stretched.",
          "Text, vectors, images, links, and other PDF content remain PDF objects."
        ]
      }
    },
    flatten: {
      title: "Flatten/Rasterize and Sanitize PDF",
      eyebrow: "Remove fonts and layers",
      description: "Rebuild every page as a lossless image so embedded fonts, editable objects and document metadata cannot break during later editing.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "the visible pages will be rebuilt without font resources",
      choose: "Choose a PDF",
      action: "Flatten/Rasterize PDF",
      output: "flattened",
      extension: ".pdf",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 500 pages",
      explainer: {
        title: "Creates a picture-only, sanitized PDF",
        copy: "Each page is rendered losslessly and rebuilt without the hidden structures that commonly cause editing problems.",
        points: [
          "Removes embedded fonts, selectable text, editable layers, forms, links, annotations, attachments, scripts, and document metadata.",
          "Preserves the visible page appearance and proportions at the resolution you select.",
          "Makes all output pages the same width without stretching them.",
          "Text will no longer be searchable, selectable, or directly editable."
        ]
      }
    },
    "embed-link": {
      title: "Embed clickable links",
      eyebrow: "Make areas interactive",
      description: "Add multiple clickable rectangles across any pages and give each area its own web URL without changing the page artwork.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "then draw every area that should open a link",
      choose: "Choose a PDF",
      action: "Embed links",
      output: "linked",
      extension: ".pdf",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 500 pages"
    },
    watermark: {
      title: "Watermark PDFs and images",
      shortTitle: "Watermark",
      eyebrow: "Mark your files",
      description: "Add text or an image watermark to PDFs and images, with adjustable direction, size and opacity. Batches download as a ZIP; images are saved as PNG.",
      types: ["pdf", "image"],
      accept: `application/pdf,.pdf,${window.FileStudioTools.imageAccept}`,
      multiple: true,
      dropTitle: "Drop PDFs and images here",
      dropCopy: "the watermark will be added to every page or image frame",
      choose: "Choose PDFs and images",
      action: "Add watermark",
      output: "watermarked",
      extension: ".pdf",
      minimum: 1,
      limits: "Up to 100 files · 250 MB total · 500 pages or frames"
    },
    compress: {
      title: "Compress a PDF",
      eyebrow: "Reduce file size",
      description: "Re-encode large images and clean duplicate objects while preserving text, links and readable pages.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "choose how much to reduce it in the next step",
      choose: "Choose a PDF",
      action: "Compress PDF",
      output: "compressed",
      extension: ".pdf",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 500 pages"
    },
    "pdf-tiff": {
      title: "Convert PDF to TIFF",
      eyebrow: "Make one image file",
      description: "Render every PDF page into one multi-page TIFF for archiving, scanning workflows or document systems.",
      accept: "application/pdf,.pdf",
      multiple: false,
      dropTitle: "Drop one PDF here",
      dropCopy: "all pages will become one multi-page TIFF",
      choose: "Choose a PDF",
      action: "Create TIFF",
      output: "document",
      extension: ".tiff",
      minimum: 1,
      limits: "One PDF · 250 MB maximum · 250 pages"
    }
  };

  Object.assign(operations, window.FileStudioTools.operations);
  for (const [id, config] of Object.entries(operations)) {
    config.types ||= ["images-pdf", "pdf-tiff", "split"].includes(id) ? ["pdf", "image"] : ["pdf"];
  }
  operations["images-pdf"].accept = window.FileStudioTools.imageAccept;

  const root = document;
  const form = root.querySelector("[data-tool-form]");
  const fileInput = root.querySelector("[data-file-input]");
  const dropZone = root.querySelector("[data-drop-zone]");
  const fileList = root.querySelector("[data-file-list]");
  const fileSection = root.querySelector("[data-file-section]");
  const optionsCard = root.querySelector("[data-options-card]");
  const actions = root.querySelector("[data-actions]");
  const status = root.querySelector("[data-status]");
  const processButton = root.querySelector("[data-process]");
  const resultCard = root.querySelector("[data-result]");
  const downloadLink = root.querySelector("[data-download]");
  let operation = "merge-pdf";
  let files = [];
  let resultUrl = "";
  let previewUrl = "";
  let previewRequestId = 0;
  let previewController;
  let watermarkImageUrl = "";
  let watermarkPlacement = null;
  let watermarkCurrentBox = null;
  let watermarkPreviewReady = false;
  let watermarkDrag = null;
  let watermarkLogoController;
  let watermarkSourceSize = { width: 1, height: 1 };
  let linkPreviewUrl = "";
  let linkPreviewRequestId = 0;
  let linkPreviewController;
  let linkRectangle = null;
  let linkAreas = [];
  let editingLinkIndex = -1;
  let linkDragStart = null;
  let draggedIndex = -1;
  let processing = false;
  let pendingOpenedFiles = [];
  const isHosted = !["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
  const maxUploadBytes = 250 * 1024 * 1024;

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function extensionOf(file) {
    const extension = file.name.split(".").pop() || "file";
    return extension.slice(0, 5).toUpperCase();
  }

  function isAccepted(file) {
    const name = file.name.toLowerCase();
    const image = /\.(tif|tiff|jpe?g|png|webp|gif|bmp)$/.test(name) || /^image\/(png|jpeg|webp|tiff|gif|bmp)$/.test(file.type);
    if (["combine-files", "watermark"].includes(operation)) return image || name.endsWith(".pdf") || file.type === "application/pdf";
    if (operation === "images-pdf" || operation.startsWith("image-")) return image;
    return name.endsWith(".pdf") || file.type === "application/pdf";
  }

  function clearResult() {
    resultCard.hidden = true;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = "";
    downloadLink.removeAttribute("href");
  }

  function clearWatermarkPreview() {
    previewController?.abort();
    previewRequestId += 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    watermarkPreviewReady = false;
    root.querySelector("[data-watermark-selection]").hidden = true;
    const image = root.querySelector("[data-preview-image]");
    image.hidden = true;
    image.removeAttribute("src");
    root.querySelector("[data-preview-state]").textContent = "Choose a PDF or image to preview";
  }

  const clampWatermark = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

  function watermarkArtwork() {
    const imageMode = root.querySelector("[data-watermark-type]").value === "image";
    const logo = root.querySelector("[data-preview-logo]");
    const text = root.querySelector("[data-watermark-text]").value.trim() || "WATERMARK";
    const angle = { diagonal: 45, horizontal: 0, vertical: 90 }[root.querySelector('[data-watermark-direction]:checked')?.value || "diagonal"];
    const font = Number(root.querySelector("[data-font-size]").value);
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = `700 ${font}px Arial`;
    const metrics = measure.measureText(text);
    const width = imageMode ? logo.naturalWidth || 1 : Math.max(1, metrics.width);
    const height = imageMode ? logo.naturalHeight || 1 : Math.max(1, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || font);
    const cosine = Math.abs(Math.cos(angle * Math.PI / 180));
    const sine = Math.abs(Math.sin(angle * Math.PI / 180));
    return { imageMode, logo, text, angle, font, width, height, rotatedWidth: width * cosine + height * sine, rotatedHeight: width * sine + height * cosine };
  }

  function defaultWatermarkBox(artwork) {
    const { width, height } = watermarkSourceSize;
    let scale;
    if (artwork.imageMode) {
      const percent = Number(root.querySelector("[data-watermark-width]").value) / 100;
      scale = Math.min(width * percent / artwork.rotatedWidth, height * percent / artwork.rotatedHeight);
    } else {
      scale = Math.min(1, width * .82 / artwork.width);
    }
    const w = Math.min(.95, artwork.rotatedWidth * scale / width);
    const h = Math.min(.95, artwork.rotatedHeight * scale / height);
    const position = root.querySelector("[data-watermark-position]").value;
    return { x: (1 - w) / 2, y: position === "top" ? .05 : position === "bottom" ? .95 - h : (1 - h) / 2, width: w, height: h };
  }

  function fitWatermarkBox(box) {
    const width = clampWatermark(box.width, .01, 1);
    const height = clampWatermark(box.height, .01, 1);
    return { x: clampWatermark(box.x, 0, 1 - width), y: clampWatermark(box.y, 0, 1 - height), width, height };
  }

  function saveWatermarkBox(box) {
    watermarkPlacement = fitWatermarkBox(box);
    root.querySelector("[data-watermark-box]").value = JSON.stringify(watermarkPlacement);
    root.querySelector("[data-watermark-position]").value = "custom";
    updateWatermarkOverlay();
  }

  function updateWatermarkOverlay() {
    const artwork = watermarkArtwork();
    const overlay = root.querySelector("[data-preview-watermark]");
    const selection = root.querySelector("[data-watermark-selection]");
    const canvas = root.querySelector("[data-watermark-canvas]");
    selection.hidden = !watermarkPreviewReady || (artwork.imageMode && (!watermarkImageUrl || !artwork.logo.complete || !artwork.logo.naturalWidth));
    overlay.textContent = artwork.text;
    overlay.hidden = artwork.imageMode;
    artwork.logo.hidden = !artwork.imageMode || !watermarkImageUrl;
    const box = fitWatermarkBox(watermarkPlacement || defaultWatermarkBox(artwork));
    watermarkCurrentBox = box;
    for (const [key, value] of Object.entries({ left: box.x, top: box.y, width: box.width, height: box.height })) selection.style[key] = `${value * 100}%`;
    const opacity = String(Number(root.querySelector("[data-opacity]").value) / 100);
    overlay.style.opacity = artwork.logo.style.opacity = opacity;
    overlay.style.color = root.querySelector("[data-watermark-colour]").value;
    const scale = Math.min(canvas.clientWidth * box.width / artwork.rotatedWidth, canvas.clientHeight * box.height / artwork.rotatedHeight);
    overlay.style.fontSize = `${artwork.font * scale}px`;
    overlay.style.width = `${artwork.width * scale}px`;
    overlay.style.height = `${artwork.height * scale}px`;
    overlay.style.lineHeight = `${artwork.height * scale}px`;
    overlay.style.transform = `translate(-50%, -50%) rotate(${-artwork.angle}deg)`;
    artwork.logo.style.width = `${artwork.width * scale}px`;
    artwork.logo.style.height = `${artwork.height * scale}px`;
    artwork.logo.style.transform = overlay.style.transform;
  }

  function resizeWatermarkFromControl() {
    if (watermarkPlacement) {
      const next = defaultWatermarkBox(watermarkArtwork());
      next.x = watermarkPlacement.x + (watermarkPlacement.width - next.width) / 2;
      next.y = watermarkPlacement.y + (watermarkPlacement.height - next.height) / 2;
      saveWatermarkBox(next);
    } else updateWatermarkOverlay();
  }

  function initializeWatermarkPlacement() {
    const canvas = root.querySelector("[data-watermark-canvas]");
    const selection = root.querySelector("[data-watermark-selection]");
    selection.addEventListener("pointerdown", event => {
      const handle = event.target.closest("[data-watermark-move], [data-watermark-resize]");
      if (!handle || handle.disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      handle.focus({ preventScroll: true });
      handle.setPointerCapture(event.pointerId);
      watermarkDrag = { id: event.pointerId, handle, resize: handle.hasAttribute("data-watermark-resize"), startX: event.clientX, startY: event.clientY, box: { ...watermarkCurrentBox }, bounds: canvas.getBoundingClientRect() };
    });
    selection.addEventListener("pointermove", event => {
      if (!watermarkDrag || watermarkDrag.id !== event.pointerId) return;
      const { box, bounds } = watermarkDrag;
      const dx = (event.clientX - watermarkDrag.startX) / bounds.width;
      const dy = (event.clientY - watermarkDrag.startY) / bounds.height;
      if (watermarkDrag.resize) {
        // Project onto the original diagonal to preserve the artwork's proportions.
        const w = box.width * bounds.width, h = box.height * bounds.height;
        const factor = clampWatermark(1 + ((event.clientX - watermarkDrag.startX) * w + (event.clientY - watermarkDrag.startY) * h) / (w * w + h * h), Math.max(.01 / box.width, .01 / box.height), Math.min((1 - box.x) / box.width, (1 - box.y) / box.height));
        saveWatermarkBox({ ...box, width: box.width * factor, height: box.height * factor });
      } else saveWatermarkBox({ ...box, x: box.x + dx, y: box.y + dy });
    });
    const finish = event => {
      if (watermarkDrag?.id !== event.pointerId) return;
      const { handle } = watermarkDrag;
      watermarkDrag = null;
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    selection.addEventListener("pointerup", finish);
    selection.addEventListener("pointercancel", finish);
    selection.addEventListener("lostpointercapture", finish);
    selection.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) || event.target.disabled) return;
      event.preventDefault();
      const box = { ...watermarkCurrentBox };
      const step = event.shiftKey ? .05 : .01;
      if (event.target.hasAttribute("data-watermark-resize")) {
        const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1;
        const factor = clampWatermark(1 + direction * step / box.width, Math.max(.01 / box.width, .01 / box.height), Math.min((1 - box.x) / box.width, (1 - box.y) / box.height));
        saveWatermarkBox({ ...box, width: box.width * factor, height: box.height * factor });
      } else saveWatermarkBox({ ...box, x: box.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), y: box.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0) });
    });
    if (window.ResizeObserver) new ResizeObserver(updateWatermarkOverlay).observe(canvas);
    else window.addEventListener("resize", updateWatermarkOverlay);
  }

  async function watermarkImagePreview(file, signal) {
    const payload = new FormData();
    payload.append("operation", "image-preview");
    payload.append("files", file, file.name);
    const response = await window.PdfStudioProcessing.request(payload, undefined, { signal });
    if (!response.ok) throw new Error("Image preview unavailable");
    return response.blob();
  }

  function updateWatermarkControls() {
    const imageMode = root.querySelector("[data-watermark-type]").value === "image";
    for (const [selector, visible] of [["[data-watermark-image-field]", imageMode], ["[data-watermark-text-field]", !imageMode]]) {
      root.querySelectorAll(selector).forEach(field => {
        field.hidden = !visible;
        field.querySelectorAll("input").forEach(control => { control.disabled = operation !== "watermark" || !visible; });
      });
    }
    root.querySelector("[data-watermark-file]").required = imageMode;
    root.querySelector("[data-watermark-text]").required = !imageMode;
    updateWatermarkOverlay();
  }

  async function loadWatermarkPreview() {
    if (operation !== "watermark" || !files[0]) {
      clearWatermarkPreview();
      return;
    }
    const requestId = ++previewRequestId;
    watermarkPreviewReady = false;
    root.querySelector("[data-watermark-selection]").hidden = true;
    previewController?.abort();
    previewController = new AbortController();
    const image = root.querySelector("[data-preview-image]");
    const previewState = root.querySelector("[data-preview-state]");
    const sourceIsPdf = files[0].type === "application/pdf" || /\.pdf$/i.test(files[0].name);
    const ready = () => {
      if (requestId !== previewRequestId) return;
      image.hidden = false;
      watermarkPreviewReady = true;
      const canvas = root.querySelector("[data-watermark-canvas]");
      canvas.style.width = `min(100%, ${30 * image.naturalWidth / image.naturalHeight}rem)`;
      watermarkSourceSize = { width: image.naturalWidth * (sourceIsPdf ? 72 / 96 : 1), height: image.naturalHeight * (sourceIsPdf ? 72 / 96 : 1) };
      previewState.textContent = sourceIsPdf ? "First page · drag to position" : "First image · drag to position";
      updateWatermarkOverlay();
    };
    if (!sourceIsPdf) {
      const source = files[0];
      let converted = false;
      image.onload = ready;
      const convert = async () => {
        if (requestId !== previewRequestId) return;
        if (converted) { image.hidden = true; previewState.textContent = "Preview unavailable for this image format"; return; }
        converted = true;
        previewState.textContent = "Rendering first image…";
        try {
          const blob = await watermarkImagePreview(source, previewController.signal);
          if (requestId !== previewRequestId) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          previewUrl = URL.createObjectURL(blob);
          image.src = previewUrl;
        } catch {
          if (requestId === previewRequestId) previewState.textContent = "Preview unavailable for this image format";
        }
      };
      image.onerror = convert;
      if (/\.(gif|tiff?)$/i.test(source.name) || /image\/(gif|tiff)/.test(source.type)) await convert();
      else {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(source);
        image.src = previewUrl;
      }
      return;
    }
    image.onerror = null;
    image.hidden = true;
    previewState.textContent = "Rendering first page…";
    const payload = new FormData();
    payload.append("operation", "preview-page");
    payload.append("files", files[0], files[0].name);
    try {
      const response = await window.PdfStudioProcessing.request(payload, undefined, { signal: previewController.signal });
      if (!response.ok) throw new Error("Preview unavailable");
      const blob = await response.blob();
      if (requestId !== previewRequestId) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
      image.onload = ready;
      image.src = previewUrl;
    } catch {
      if (requestId === previewRequestId) previewState.textContent = "Preview could not be rendered";
    }
  }

  function positionLinkRectangle(element, rectangle) {
    element.style.left = `${rectangle.x * 100}%`;
    element.style.top = `${rectangle.y * 100}%`;
    element.style.width = `${rectangle.width * 100}%`;
    element.style.height = `${rectangle.height * 100}%`;
  }

  function showLinkSelection() {
    const selection = root.querySelector("[data-link-selection]");
    if (!linkRectangle) {
      selection.hidden = true;
      return;
    }
    selection.hidden = false;
    positionLinkRectangle(selection, linkRectangle);
    root.querySelector("[data-link-coordinates]").textContent = `Selected area · ${(linkRectangle.width * 100).toFixed(1)}% × ${(linkRectangle.height * 100).toFixed(1)}% of page`;
  }

  function clearLinkSelection({ clearUrl = false, clearEditing = true } = {}) {
    linkRectangle = null;
    linkDragStart = null;
    if (clearEditing) editingLinkIndex = -1;
    root.querySelector("[data-link-selection]").hidden = true;
    root.querySelector("[data-link-coordinates]").textContent = "No new area selected yet.";
    if (clearUrl) root.querySelector("[data-link-url]").value = "";
    root.querySelector("[data-add-link-area]").textContent = "Add link area";
  }

  function renderLinkAreas() {
    const canvas = root.querySelector("[data-link-canvas]");
    canvas.querySelectorAll("[data-saved-link-area]").forEach((element) => element.remove());
    const selectedPage = Number(root.querySelector("[data-link-page]").value || 1);
    linkAreas.forEach((area, index) => {
      if (area.page !== selectedPage) return;
      const overlay = document.createElement("button");
      overlay.type = "button";
      overlay.className = "link-editor__saved-area";
      overlay.dataset.savedLinkArea = String(index);
      overlay.setAttribute("aria-label", `Edit link area ${index + 1}`);
      positionLinkRectangle(overlay, area);
      const number = document.createElement("span");
      number.textContent = String(index + 1);
      overlay.append(number);
      overlay.addEventListener("pointerdown", (event) => event.stopPropagation());
      canvas.append(overlay);
    });

    const list = root.querySelector("[data-link-area-list]");
    list.replaceChildren(...linkAreas.map((area, index) => {
      const item = document.createElement("li");
      item.className = "link-area-item";
      item.dataset.linkAreaItem = String(index);
      const number = document.createElement("span");
      number.className = "link-area-item__number";
      number.textContent = String(index + 1);
      const copy = document.createElement("span");
      copy.className = "link-area-item__copy";
      const page = document.createElement("strong");
      page.textContent = `Page ${area.page}`;
      const url = document.createElement("small");
      url.textContent = area.url;
      copy.append(page, url);
      const actions = document.createElement("span");
      actions.className = "link-area-item__actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.editLinkArea = String(index);
      edit.textContent = "Edit";
      edit.setAttribute("aria-label", `Edit link area ${index + 1}`);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.removeLinkArea = String(index);
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove link area ${index + 1}`);
      actions.append(edit, remove);
      item.append(number, copy, actions);
      return item;
    }));
    root.querySelector("[data-link-area-count]").textContent = `${linkAreas.length} ${linkAreas.length === 1 ? "area" : "areas"}`;
    root.querySelector("[data-link-area-empty]").hidden = linkAreas.length > 0;
    root.querySelector("[data-link-areas]").value = JSON.stringify(linkAreas);
  }

  function clearLinkPreview() {
    linkPreviewController?.abort();
    linkPreviewRequestId += 1;
    if (linkPreviewUrl) URL.revokeObjectURL(linkPreviewUrl);
    linkPreviewUrl = "";
    const canvas = root.querySelector("[data-link-canvas]");
    const image = root.querySelector("[data-link-preview-image]");
    canvas.hidden = true;
    image.removeAttribute("src");
    root.querySelector("[data-link-preview-state]").textContent = "Choose a PDF to begin";
    linkAreas = [];
    clearLinkSelection({ clearUrl: true });
    renderLinkAreas();
  }

  function populateLinkPages(pageCount, selectedPage) {
    const select = root.querySelector("[data-link-page]");
    const expectedCount = Math.max(1, Number(pageCount) || 1);
    if (select.options.length !== expectedCount) {
      select.replaceChildren(...Array.from({ length: expectedCount }, (_, index) => {
        const option = document.createElement("option");
        option.value = String(index + 1);
        option.textContent = `Page ${index + 1}`;
        return option;
      }));
    }
    select.value = String(Math.min(Math.max(1, Number(selectedPage) || 1), expectedCount));
  }

  async function loadLinkPreview(pageNumber = 1, preserveDraft = false) {
    if (operation !== "embed-link" || !files[0]) {
      clearLinkPreview();
      return;
    }
    const requestId = ++linkPreviewRequestId;
    linkPreviewController?.abort();
    linkPreviewController = new AbortController();
    const canvas = root.querySelector("[data-link-canvas]");
    const image = root.querySelector("[data-link-preview-image]");
    const previewState = root.querySelector("[data-link-preview-state]");
    canvas.hidden = true;
    if (!preserveDraft) clearLinkSelection();
    previewState.textContent = `Rendering page ${pageNumber}…`;
    const payload = new FormData();
    payload.append("operation", "preview-page");
    payload.append("preview_page", String(pageNumber));
    payload.append("files", files[0], files[0].name);
    try {
      const response = await window.PdfStudioProcessing.request(payload, undefined, { signal: linkPreviewController.signal });
      if (!response.ok) throw new Error("Preview unavailable");
      const blob = await response.blob();
      if (requestId !== linkPreviewRequestId) return;
      populateLinkPages(response.headers.get("x-page-count"), pageNumber);
      if (linkPreviewUrl) URL.revokeObjectURL(linkPreviewUrl);
      linkPreviewUrl = URL.createObjectURL(blob);
      image.onload = () => {
        if (requestId !== linkPreviewRequestId) return;
        canvas.hidden = false;
        renderLinkAreas();
        showLinkSelection();
        previewState.textContent = `Page ${pageNumber} · draw another area`;
      };
      image.src = linkPreviewUrl;
    } catch {
      if (requestId === linkPreviewRequestId) previewState.textContent = "Page preview could not be rendered";
    }
  }

  function normalizedPointer(event) {
    const bounds = root.querySelector("[data-link-canvas]").getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function drawLinkRectangle(start, end, commit = false) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    const selection = root.querySelector("[data-link-selection]");
    selection.hidden = false;
    positionLinkRectangle(selection, { x, y, width, height });
    if (!commit) return;
    linkRectangle = { x, y, width, height };
    root.querySelector("[data-link-coordinates]").textContent = `Selected area · ${(width * 100).toFixed(1)}% × ${(height * 100).toFixed(1)}% of page`;
  }

  function linkAreaFromDraft() {
    const input = root.querySelector("[data-link-url]");
    const linkUrl = input.value.trim();
    let parsedUrl;
    try { parsedUrl = new URL(linkUrl); } catch { parsedUrl = null; }
    if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
      status.textContent = "Enter a complete http:// or https:// URL for this area.";
      input.focus();
      return null;
    }
    if (!linkRectangle || linkRectangle.width < 0.005 || linkRectangle.height < 0.005) {
      status.textContent = "Drag a larger rectangle for this link area.";
      return null;
    }
    return {
      page: Number(root.querySelector("[data-link-page]").value),
      url: linkUrl,
      ...linkRectangle
    };
  }

  function saveLinkArea() {
    const area = linkAreaFromDraft();
    if (!area) return;
    if (editingLinkIndex >= 0) linkAreas[editingLinkIndex] = area;
    else if (linkAreas.length >= 100) {
      status.textContent = "A document can contain at most 100 new link areas per task.";
      return;
    } else linkAreas.push(area);
    const savedCount = linkAreas.length;
    clearLinkSelection({ clearUrl: true });
    renderLinkAreas();
    status.textContent = `${savedCount} ${savedCount === 1 ? "link area" : "link areas"} ready.`;
  }

  function editLinkArea(index) {
    const area = linkAreas[index];
    if (!area) return;
    editingLinkIndex = index;
    linkRectangle = { x: area.x, y: area.y, width: area.width, height: area.height };
    root.querySelector("[data-link-url]").value = area.url;
    root.querySelector("[data-link-page]").value = String(area.page);
    root.querySelector("[data-add-link-area]").textContent = "Update link area";
    loadLinkPreview(area.page, true);
  }

  function removeLinkArea(index) {
    if (!linkAreas[index]) return;
    linkAreas.splice(index, 1);
    if (editingLinkIndex === index) clearLinkSelection({ clearUrl: true });
    else if (editingLinkIndex > index) editingLinkIndex -= 1;
    renderLinkAreas();
    status.textContent = linkAreas.length ? `${linkAreas.length} link ${linkAreas.length === 1 ? "area" : "areas"} ready.` : "Add at least one link area.";
  }

  function renderFiles() {
    fileList.replaceChildren();
    files.forEach((file, index) => {
      const item = document.createElement("li");
      item.className = "file-item";
      item.draggable = files.length > 1;
      item.dataset.index = String(index);
      item.innerHTML = `
        <span class="file-item__type" aria-hidden="true">${extensionOf(file)}</span>
        <span class="file-item__copy"><strong></strong><small>${formatBytes(file.size)}</small></span>
        <span class="file-item__actions">
          <button class="icon-button" type="button" data-move="up" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-button" type="button" data-move="down" ${index === files.length - 1 ? "disabled" : ""}>↓</button>
          <button class="icon-button" type="button" data-remove>×</button>
        </span>`;
      item.querySelector("strong").textContent = file.name;
      item.querySelector('[data-move="up"]').setAttribute("aria-label", `Move ${file.name} up`);
      item.querySelector('[data-move="down"]').setAttribute("aria-label", `Move ${file.name} down`);
      item.querySelector("[data-remove]").setAttribute("aria-label", `Remove ${file.name}`);
      fileList.append(item);
    });

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    root.querySelector("[data-file-summary]").textContent = files.length
      ? `${files.length} ${files.length === 1 ? "file" : "files"} · ${formatBytes(totalSize)}`
      : "0 files";
    root.querySelector("[data-reorder-hint]").hidden = files.length < 2;
    const hasFiles = files.length > 0;
    fileSection.hidden = !hasFiles;
    optionsCard.hidden = !hasFiles;
    actions.hidden = !hasFiles;
    dropZone.hidden = hasFiles;
    status.textContent = "";
    clearResult();
    updateOutputExtension();
    if (operation === "watermark" && hasFiles) loadWatermarkPreview();
    else clearWatermarkPreview();
    if (operation === "embed-link" && hasFiles) loadLinkPreview(1);
    else clearLinkPreview();
  }

  function addFiles(incoming) {
    const valid = Array.from(incoming).filter(isAccepted);
    if (!valid.length) {
      status.textContent = operation === "images-pdf"
        ? "Choose TIFF, JPEG or PNG image files."
        : "Choose a PDF file."
      return;
    }
    if (operations[operation].multiple) files = [...files, ...valid].slice(0, 100);
    else {
      files = valid.slice(0, 1);
      if (operation === "embed-link") linkAreas = [];
    }
    if (files.reduce((sum, file) => sum + file.size, 0) > maxUploadBytes) {
      files = [];
      const limit = "250 MB limit";
      status.textContent = `That selection is over the ${limit}. Choose smaller files.`;
      renderFiles();
      status.textContent = `That selection is over the ${limit}. Choose smaller files.`;
      return;
    }
    renderFiles();
  }

  function setOperation(nextOperation) {
    operation = nextOperation;
    watermarkPlacement = null;
    root.querySelector("[data-watermark-box]").value = "";
    if (root.querySelector("[data-watermark-position]").value === "custom") root.querySelector("[data-watermark-position]").value = "center";
    files = [];
    fileInput.value = "";
    const config = operations[operation];
    root.querySelectorAll("[data-operation]").forEach((button) => {
      const active = button.dataset.operation === operation;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    root.querySelector("[data-title]").textContent = config.title;
    root.querySelector("[data-step-label]").textContent = config.eyebrow;
    root.querySelector("[data-description]").textContent = config.description;
    root.querySelector("[data-drop-title]").textContent = config.dropTitle;
    root.querySelector("[data-drop-copy]").textContent = config.dropCopy;
    root.querySelector("[data-choose-files]").textContent = config.choose;
    root.querySelector("[data-process-label]").textContent = config.action;
    root.querySelector("[data-limits]").textContent = config.limits;
    root.querySelector("[data-hosted-note]").hidden = !isHosted;
    root.querySelector("[data-output-name]").value = config.output;
    root.querySelector("[data-output-extension]").textContent = config.extension;
    const explainer = root.querySelector("[data-operation-explainer]");
    explainer.hidden = !config.explainer;
    if (config.explainer) {
      root.querySelector("[data-explainer-title]").textContent = config.explainer.title;
      root.querySelector("[data-explainer-copy]").textContent = config.explainer.copy;
      const points = root.querySelector("[data-explainer-points]");
      points.replaceChildren(...config.explainer.points.map((point) => {
        const item = document.createElement("li");
        item.textContent = point;
        return item;
      }));
    }
    fileInput.accept = config.accept;
    fileInput.multiple = config.multiple;
    root.querySelectorAll("[data-options]").forEach((section) => {
      section.hidden = section.dataset.options !== operation;
      section.querySelectorAll("input, select").forEach(control => { control.disabled = section.hidden; });
    });
    updateWatermarkControls();
    renderFiles();
    updateOutputExtension();
  }

  function updateOutputExtension() {
    if (operation === "watermark") {
      root.querySelector("[data-output-extension]").textContent = files.length > 1 ? ".zip" : files[0] && !/\.pdf$/i.test(files[0].name) && files[0].type !== "application/pdf" ? ".png" : ".pdf";
      return;
    }
    const format = root.querySelector(`[data-options="${operation}"] [name="image_format"]`)?.value;
    if (format) root.querySelector("[data-output-extension]").textContent = `.${format}${files.length > 1 && operation.startsWith("image-") && operation !== "image-merge" ? " / .zip for batches" : ""}`;
  }
  form.addEventListener("change", updateOutputExtension);

  function moveFile(from, to) {
    if (from < 0 || to < 0 || from >= files.length || to >= files.length || from === to) return;
    const [file] = files.splice(from, 1);
    files.splice(to, 0, file);
    renderFiles();
  }

  root.querySelectorAll("[data-operation]").forEach((button) => {
    button.addEventListener("click", () => setOperation(button.dataset.operation));
  });
  root.querySelectorAll("[data-choose-files], [data-add-more]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      fileInput.click();
    });
  });
  dropZone.addEventListener("click", () => fileInput.click());
  ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  }));
  dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
  fileInput.addEventListener("change", () => addFiles(fileInput.files));

  fileList.addEventListener("click", (event) => {
    const item = event.target.closest(".file-item");
    if (!item) return;
    const index = Number(item.dataset.index);
    if (event.target.closest("[data-remove]")) {
      files.splice(index, 1);
      renderFiles();
    } else if (event.target.closest('[data-move="up"]')) moveFile(index, index - 1);
    else if (event.target.closest('[data-move="down"]')) moveFile(index, index + 1);
  });
  fileList.addEventListener("dragstart", (event) => {
    const item = event.target.closest(".file-item");
    if (!item) return;
    draggedIndex = Number(item.dataset.index);
    item.classList.add("is-dragging");
  });
  fileList.addEventListener("dragover", (event) => event.preventDefault());
  fileList.addEventListener("drop", (event) => {
    event.preventDefault();
    const item = event.target.closest(".file-item");
    if (item) moveFile(draggedIndex, Number(item.dataset.index));
  });
  fileList.addEventListener("dragend", () => {
    draggedIndex = -1;
    fileList.querySelectorAll(".is-dragging").forEach((item) => item.classList.remove("is-dragging"));
  });

  root.querySelector("[data-quality]").addEventListener("input", (event) => {
    root.querySelector("[data-quality-output]").textContent = `${event.target.value}%`;
  });
  root.querySelector("[data-opacity]").addEventListener("input", (event) => {
    root.querySelector("[data-opacity-output]").textContent = `${event.target.value}%`;
    updateWatermarkOverlay();
  });
  root.querySelector("[data-font-size]").addEventListener("input", (event) => {
    root.querySelector("[data-size-output]").textContent = event.target.value;
    resizeWatermarkFromControl();
  });
  root.querySelector("[data-watermark-text]").addEventListener("input", updateWatermarkOverlay);
  root.querySelector("[data-watermark-type]").addEventListener("change", updateWatermarkControls);
  root.querySelector("[data-watermark-width]").addEventListener("input", resizeWatermarkFromControl);
  root.querySelector("[data-watermark-colour]").addEventListener("input", updateWatermarkOverlay);
  root.querySelector("[data-watermark-position]").addEventListener("change", () => {
    watermarkPlacement = null;
    root.querySelector("[data-watermark-box]").value = "";
    updateWatermarkOverlay();
  });
  root.querySelector("[data-watermark-file]").addEventListener("change", async event => {
    watermarkLogoController?.abort();
    const controller = watermarkLogoController = new AbortController();
    if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
    watermarkImageUrl = "";
    const file = event.target.files[0];
    const logo = root.querySelector("[data-preview-logo]");
    logo.onload = updateWatermarkOverlay;
    let converted = false;
    const convert = async () => {
      if (!file || controller.signal.aborted || converted) return;
      converted = true;
      try {
        const blob = await watermarkImagePreview(file, controller.signal);
        if (controller.signal.aborted) return;
        if (watermarkImageUrl) URL.revokeObjectURL(watermarkImageUrl);
        watermarkImageUrl = URL.createObjectURL(blob);
        logo.src = watermarkImageUrl;
      } catch {
        if (!controller.signal.aborted) status.textContent = "The watermark image could not be previewed. Try a PNG or JPEG.";
      }
    };
    logo.onerror = convert;
    if (file && (/\.(gif|tiff?)$/i.test(file.name) || /image\/(gif|tiff)/.test(file.type))) await convert();
    else if (file) {
      watermarkImageUrl = URL.createObjectURL(file);
      logo.src = watermarkImageUrl;
    }
    updateWatermarkOverlay();
  });
  root.querySelectorAll("[data-watermark-direction]").forEach((control) => {
    control.addEventListener("change", updateWatermarkOverlay);
  });
  root.querySelector("[data-link-page]").addEventListener("change", (event) => {
    loadLinkPreview(Number(event.target.value));
  });
  root.querySelector("[data-add-link-area]").addEventListener("click", saveLinkArea);
  root.querySelector("[data-link-area-list]").addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-link-area]");
    const remove = event.target.closest("[data-remove-link-area]");
    if (edit) editLinkArea(Number(edit.dataset.editLinkArea));
    else if (remove) removeLinkArea(Number(remove.dataset.removeLinkArea));
  });
  const linkCanvas = root.querySelector("[data-link-canvas]");
  linkCanvas.addEventListener("click", (event) => {
    const savedArea = event.target.closest("[data-saved-link-area]");
    if (savedArea) editLinkArea(Number(savedArea.dataset.savedLinkArea));
  });
  linkCanvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    linkDragStart = normalizedPointer(event);
    drawLinkRectangle(linkDragStart, linkDragStart);
    try { linkCanvas.setPointerCapture(event.pointerId); } catch { /* Drag still works inside the page. */ }
  });
  linkCanvas.addEventListener("pointermove", (event) => {
    if (!linkDragStart) return;
    drawLinkRectangle(linkDragStart, normalizedPointer(event));
  });
  function finishLinkDrag(event) {
    if (!linkDragStart) return;
    const start = linkDragStart;
    linkDragStart = null;
    drawLinkRectangle(start, normalizedPointer(event), true);
  }
  linkCanvas.addEventListener("pointerup", finishLinkDrag);
  linkCanvas.addEventListener("pointercancel", () => {
    linkDragStart = null;
    clearLinkSelection();
  });
  const pagePresets = {
    a4: { width: 210, height: 297, unit: "mm" },
    letter: { width: 8.5, height: 11, unit: "in" },
    legal: { width: 8.5, height: 14, unit: "in" },
    a3: { width: 297, height: 420, unit: "mm" }
  };
  const pagePreset = root.querySelector("[data-page-preset]");
  const pageWidth = root.querySelector("[data-page-width]");
  const pageHeight = root.querySelector("[data-page-height]");
  const pageUnit = root.querySelector("[data-page-unit]");
  pagePreset.addEventListener("change", () => {
    const preset = pagePresets[pagePreset.value];
    if (!preset) return;
    pageWidth.value = String(preset.width);
    pageHeight.value = String(preset.height);
    pageUnit.value = preset.unit;
  });
  [pageWidth, pageHeight, pageUnit].forEach((control) => {
    control.addEventListener("input", () => { pagePreset.value = "custom"; });
    control.addEventListener("change", () => { pagePreset.value = "custom"; });
  });
  const splitFormat = root.querySelector("[data-split-format]");
  function updateSplitOptions() {
    const format = splitFormat.value;
    root.querySelectorAll("[data-split-image-option]").forEach((field) => {
      field.hidden = format === "pdf";
    });
    root.querySelectorAll("[data-split-jpeg-option]").forEach((field) => {
      field.hidden = format !== "jpg";
    });
  }
  splitFormat.addEventListener("change", updateSplitOptions);
  root.querySelector("[data-split-quality]").addEventListener("input", (event) => {
    root.querySelector("[data-split-quality-output]").textContent = `${event.target.value}%`;
  });
  root.querySelector("[data-reset]").addEventListener("click", () => setOperation(operation));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = operations[operation];
    if (files.length < config.minimum) {
      status.textContent = config.minimum === 2 ? "Choose at least two PDFs to merge." : "Choose a file to continue.";
      return;
    }
    if (operation === "pdf-tiff" && !root.querySelector("[data-tiff-compression]").value) {
      status.textContent = "Choose LZW, Deflate, or JPEG compression to continue.";
      root.querySelector("[data-tiff-compression]").focus();
      return;
    }
    if (operation === "embed-link") {
      if (linkRectangle || root.querySelector("[data-link-url]").value.trim()) {
        status.textContent = editingLinkIndex >= 0
          ? "Click Update link area before creating the PDF."
          : "Click Add link area before creating the PDF.";
        return;
      }
      if (!linkAreas.length) {
        status.textContent = "Add at least one clickable link area.";
        return;
      }
    }

    const payload = new FormData();
    payload.append("operation", operation);
    files.forEach((file) => payload.append("files", file, file.name));
    const activeOptions = root.querySelector(`[data-options="${operation}"]`);
    activeOptions?.querySelectorAll("input, select").forEach((control) => {
      if (control.disabled || control.type === "file" || !control.name) return;
      if ((control.type === "radio" || control.type === "checkbox") && !control.checked) return;
      const value = control.name === "opacity" ? String(Number(control.value) / 100) : control.value;
      payload.append(control.name, value);
    });
    if (operation === "watermark" && !root.querySelector("[data-watermark-selection]").hidden && watermarkCurrentBox) {
      payload.set("watermark_box", JSON.stringify(watermarkCurrentBox));
    }
    if (operation === "watermark" && root.querySelector("[data-watermark-type]").value === "image") {
      const logo = root.querySelector("[data-watermark-file]").files[0];
      if (!logo) { status.textContent = "Choose a watermark image."; return; }
      payload.append("watermark_file_index", String(files.length));
      payload.append("files", logo, logo.name);
    }
    payload.append("output_name", root.querySelector("[data-output-name]").value);

    processing = true;
    // Keep the selected task and inputs stable while a result is being created.
    const controls = [...root.querySelectorAll("button, input, select")].map(control => [control, control.disabled]);
    controls.forEach(([control]) => { control.disabled = true; });
    processButton.disabled = true;
    processButton.classList.add("is-processing");
    status.textContent = "Processing your file…";
    clearResult();
    try {
      const response = await window.PdfStudioProcessing.request(payload, (message) => { status.textContent = message; });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "The document could not be processed.");
      }
      const blob = await response.blob();
      resultUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const matchedName = disposition.match(/filename="?([^";]+)"?/i);
      const filename = matchedName?.[1] || `${payload.get("output_name")}${config.extension}`;
      downloadLink.href = resultUrl;
      downloadLink.download = filename;
      const pages = response.headers.get("x-page-count");
      const inputBytes = files.reduce((sum, file) => sum + file.size, 0);
      const itemLabel = operation === "image-merge" ? "source image" : operation.startsWith("image-") ? "image" : "page";
      root.querySelector("[data-result-meta]").textContent = `${filename} · ${formatBytes(blob.size)}${pages ? ` · ${pages} ${itemLabel}${pages === "1" ? "" : "s"}` : ""}${operation === "compress" ? ` · was ${formatBytes(inputBytes)}` : ""}`;
      resultCard.hidden = false;
      const mode = response.headers.get("x-pdf-processing");
      status.textContent = mode === "browser" ? "Processed on your device · no files uploaded." : mode === "desktop" ? "Processed on your device with Python." : "Processed on the server.";
      resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      status.textContent = error.message || "The document could not be processed.";
    } finally {
      processing = false;
      controls.forEach(([control, disabled]) => { control.disabled = disabled; });
      processButton.classList.remove("is-processing");
      if (pendingOpenedFiles.length) {
        const opened = pendingOpenedFiles;
        pendingOpenedFiles = [];
        offerOpenedFiles(opened);
      }
    }
  });

  function initializeTaskFilters() {
    root.querySelectorAll("[data-task-filter]").forEach(control => control.addEventListener("change", applyTaskFilters));
    applyTaskFilters();
  }

  function applyTaskFilters() {
    const enabled = Object.fromEntries([...root.querySelectorAll("[data-task-filter]")].map(control => [control.dataset.taskFilter, control.checked]));
    const visible = [];
    root.querySelectorAll("[data-operation]").forEach(button => {
      const show = operations[button.dataset.operation].types.some(type => enabled[type]);
      button.hidden = !show;
      if (show) visible.push(button.dataset.operation);
    });
    root.querySelector("[data-filter-empty]").hidden = !!visible.length;
    root.querySelectorAll("[data-open-task]").forEach(button => { button.hidden = !operations[button.dataset.openTask].types.some(type => enabled[type]); });
    root.querySelector("[data-workspace-content]").hidden = !visible.length;
    if (visible.length && !visible.includes(operation)) setOperation(visible[0]);
  }

  function initializeFileOpening() {
    const picker = root.querySelector("[data-open-input]");
    root.querySelector("[data-open-files]").addEventListener("click", () => picker.click());
    picker.addEventListener("change", () => {
      offerOpenedFiles([...picker.files]);
      picker.value = "";
    });
    root.querySelector("[data-dismiss-opened]").addEventListener("click", () => {
      root.querySelector("[data-opened-files]").hidden = true;
      root.querySelector("[data-opened-tasks]").replaceChildren();
    });
    window.FileStudioOpenFiles = offerOpenedFiles;
    if (window.launchQueue?.setConsumer) window.launchQueue.setConsumer(async launch => {
      if (!launch.files?.length) return;
      try {
        const opened = await Promise.all(launch.files.map(handle => handle.getFile()));
        offerOpenedFiles(opened);
      } catch {
        status.textContent = "The operating system could not provide those files. Use Open files to choose them again.";
      }
    });
    root.addEventListener("dragover", event => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    });
    root.addEventListener("drop", event => {
      if (!event.dataTransfer?.files.length || event.target.closest("[data-drop-zone], [data-watermark-file]")) return;
      event.preventDefault();
      offerOpenedFiles([...event.dataTransfer.files]);
    });
  }

  function offerOpenedFiles(incoming) {
    if (processing) { pendingOpenedFiles.push(...incoming); return; }
    const pdfs = incoming.filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
    const images = incoming.filter(file => /\.(png|jpe?g|webp|tiff?|gif|bmp)$/i.test(file.name) || /^image\/(png|jpeg|webp|tiff|gif|bmp)$/.test(file.type));
    const accepted = incoming.filter(file => pdfs.includes(file) || images.includes(file));
    const choices = root.querySelector("[data-opened-tasks]");
    choices.replaceChildren();
    root.querySelector("[data-opened-files]").hidden = false;
    root.querySelector("[data-opened-summary]").textContent = `${pdfs.length} PDF${pdfs.length === 1 ? "" : "s"} · ${images.length} image${images.length === 1 ? "" : "s"}${incoming.length > accepted.length ? ` · ${incoming.length - accepted.length} unsupported files skipped` : ""}`;
    root.querySelector("[data-opened-names]").replaceChildren(...incoming.map(file => {
      const item = document.createElement("li");
      item.textContent = file.name;
      return item;
    }));
    root.querySelector("[data-opened-note]").textContent = accepted.length ? "Choose a task below. Nothing is processed or uploaded until you choose its action." : "Open a PDF, PNG, JPEG, WebP, TIFF, BMP or GIF.";
    for (const [id, config] of Object.entries(operations)) {
      let selected;
      if (["combine-files", "watermark"].includes(id)) selected = accepted;
      else if (id === "images-pdf" || id.startsWith("image-")) selected = images;
      else selected = pdfs;
      if (selected.length < config.minimum || (!config.multiple && selected.length > 1)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.openTask = id;
      button.className = "header-button";
      button.textContent = `${config.shortTitle || config.action}${pdfs.length && images.length && !["combine-files", "watermark"].includes(id) ? ` (${selected.length} ${selected === images ? "images" : "PDFs"})` : ""}`;
      button.addEventListener("click", () => {
        // A chosen file action enables its relevant filters so the selected task
        // is visible even if the sidebar had previously hidden it.
        root.querySelectorAll("[data-task-filter]").forEach(control => {
          if (config.types.includes(control.dataset.taskFilter)) control.checked = true;
        });
        applyTaskFilters();
        setOperation(id);
        addFiles(selected);
        root.querySelector("[data-opened-note]").textContent = `${selected.length} file${selected.length === 1 ? "" : "s"} selected for ${config.shortTitle || config.action}. Other task choices stay available here.`;
      });
      choices.append(button);
    }
    applyTaskFilters();
    root.querySelector("[data-opened-files]").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  initializeWatermarkPlacement();
  updateSplitOptions();
  updateWatermarkOverlay();
  setOperation(operation);
  initializeTaskFilters();
  initializeFileOpening();
})();
