/* Browser-first routing. Estimates are deliberately conservative: browsers do not
   expose an exact, portable measure of remaining memory. No allocation probes. */
(() => {
  const MB = 1024 * 1024;
  const hosted = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(location.hostname);
  const serverLimit = (hosted ? 4 : 250) * MB;
  const native = !!document.querySelector('meta[name="pdf-studio-runtime"][content="python"]');
  let queue = Promise.resolve();

  function browserBudget() {
    if (native) return { reason: "Using the app’s local Python engine" };
    if (typeof Worker !== "function" || typeof WebAssembly !== "object" || typeof Blob.prototype.arrayBuffer !== "function") {
      return { reason: "This browser does not support local processing" };
    }
    const ram = navigator.deviceMemory;
    if (ram && ram < 2) return { reason: "This device has limited memory" };
    let bytes = ram ? Math.min(768 * MB, ram * 1024 * MB * 0.12) : 256 * MB;
    const heap = performance.memory;
    if (heap?.jsHeapSizeLimit > 0) {
      bytes = Math.min(bytes, Math.max(0, heap.jsHeapSizeLimit - heap.usedJSHeapSize) * 0.45);
    }
    return { bytes: Math.floor(bytes), reason: "The browser memory estimate is too low for this task" };
  }

  function runBrowser(operation, files, fields, budget, progress, signal) {
    return new Promise((resolve, reject) => {
      const worker = new Worker("/tools/filestudio/pdf-browser-worker.js");
      let timer;
      const finish = (callback, value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        worker.terminate();
        callback(value);
      };
      const abort = () => finish(reject, new DOMException("Processing cancelled", "AbortError"));
      signal?.addEventListener("abort", abort, { once: true });
      // Bound initialization and processing separately. A crashed or stalled
      // worker cannot leave the interface waiting forever.
      const armTimer = (milliseconds) => {
        clearTimeout(timer);
        timer = setTimeout(() => finish(reject, new Error("Browser processing timed out")), milliseconds);
      };
      armTimer(45000);
      worker.onerror = event => {
        event.preventDefault();
        finish(reject, new Error("Browser processing could not start"));
      };
      worker.onmessageerror = () => finish(reject, new Error("Browser result unavailable"));
      worker.onmessage = ({ data }) => {
        if (data.stage) {
          progress(data.stage);
          if (data.stage.startsWith("Processing on")) armTimer(120000);
        } else if (data.error) {
          const error = new Error(data.error.message);
          error.validation = data.error.validation;
          finish(reject, error);
        } else if (data.result) finish(resolve, data.result);
      };
      worker.postMessage({ operation, files, fields, budget });
    });
  }

  async function process(payload, progress, signal) {
    signal?.throwIfAborted();
    const files = payload.getAll("files");
    const operation = payload.get("operation");
    const total = files.reduce((sum, file) => sum + file.size, 0);
    const fields = Object.fromEntries([...payload].filter(([key]) => key !== "files"));
    const budget = browserBudget();
    let reason = budget.reason;
    const raster = ["preview-page", "flatten", "pdf-tiff", "pdf-image"].includes(operation) || (operation === "split" && fields.split_format !== "pdf");
    if (raster && typeof OffscreenCanvas !== "function") reason = "This browser cannot render PDF pages locally";
    else if (operation === "pdf-tiff" && ["jpeg", "tiff_deflate"].includes(fields.tiff_compression)) reason = "This TIFF compression needs the server’s image encoder";
    else if (budget.bytes && 96 * MB + total * 14 < budget.bytes) {
      try {
        const result = await runBrowser(operation, files, fields, budget.bytes, progress, signal);
        return new Response(new Blob([result.bytes], { type: result.type }), {
          headers: {
            "Content-Type": result.type,
            "Content-Disposition": `attachment; filename="${result.name}"`,
            "X-Page-Count": String(result.pages),
            "X-Pdf-Processing": "browser",
          },
        });
      } catch (error) {
        if (error.validation || error.name === "AbortError") throw error;
        reason = "Browser processing could not complete within this device’s limits";
      }
    }
    signal?.throwIfAborted();
    if (hosted && !navigator.onLine) throw new Error("Browser processing is unavailable for this task. Connect to the internet to use server processing.");
    // Leave room for multipart headers underneath Vercel's request-body limit.
    if (total > serverLimit) throw new Error(`Browser processing is unavailable for this task, and the ${hosted ? "hosted server accepts up to 4 MB" : "local server accepts up to 250 MB"}. Try smaller files or use the PDF + Image Studio desktop app.`);
    progress(native ? "Processing on your device with Python…" : `Processing on the server · ${reason.toLowerCase()}…`);
    const response = await fetch("/api/pdf-tool", { method: "POST", body: payload, signal });
    if (response.status === 413) throw new Error("The server upload limit was exceeded. Try smaller files or use the PDF + Image Studio desktop app.");
    const headers = new Headers(response.headers);
    headers.set("X-Pdf-Processing", native ? "desktop" : "server");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  window.PdfStudioProcessing = {
    request(payload, progress = () => {}, { signal } = {}) {
      // A single worker at a time, including previews, keeps memory bounded.
      const task = queue.then(() => process(payload, progress, signal));
      queue = task.catch(() => {});
      return task;
    },
  };
})();
