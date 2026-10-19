/* A fresh worker per task releases the complete WASM heap on completion/failure. */
const base = new URL("./", self.location.href).href;
const documents = [];
let pdfjs;
let pixelBudget = 0;

class WorkerCanvasFactory {
  create(width, height) {
    if (width <= 0 || height <= 0 || width * height * 24 > pixelBudget) throw new Error("Browser canvas capacity exceeded");
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, context: canvas.getContext("2d", { willReadFrequently: true }) };
  }
  reset(target, width, height) {
    if (width <= 0 || height <= 0 || width * height * 24 > pixelBudget) throw new Error("Browser canvas capacity exceeded");
    target.canvas.width = width;
    target.canvas.height = height;
  }
  destroy(target) {
    target.canvas.width = target.canvas.height = 0;
    target.canvas = target.context = null;
  }
}

async function renderer() {
  if (!pdfjs) {
    pdfjs = await import(`${base}vendor/pdfjs/pdf.js`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${base}vendor/pdfjs/pdf.worker.js`;
  }
  return pdfjs;
}

self.document_sizes = async () => {
  const sizes = [];
  for (const document of documents) {
    const pages = [];
    for (let index = 1; index <= document.numPages; index++) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: 1 });
      pages.push([viewport.width, viewport.height]);
      page.cleanup();
    }
    sizes.push(pages);
  }
  return sizes;
};

self.render_page = async (fileIndex, pageIndex, scale) => {
  const page = await documents[fileIndex].getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const width = Math.ceil(viewport.width);
  const height = Math.ceil(viewport.height);
  if (width * height * 24 > pixelBudget || width > 16384 || height > 16384) {
    page.cleanup();
    throw new Error("Browser canvas capacity exceeded");
  }
  const canvas = new OffscreenCanvas(width, height);
  try {
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Browser canvas unavailable");
    await page.render({ canvasContext: context, viewport, background: "white" }).promise;
    return { width, height, pixels: context.getImageData(0, 0, width, height).data };
  } finally {
    canvas.width = canvas.height = 0;
    page.cleanup();
  }
};

self.onmessage = async ({ data: { operation, files, fields, budget } }) => {
  let pyodide;
  try {
    pixelBudget = budget - 96 * 1024 * 1024;
    self.postMessage({ stage: "Preparing browser processing…" });
    importScripts(`${base}vendor/pyodide/pyodide.js`);
    pyodide = await loadPyodide({ indexURL: `${base}vendor/pyodide/` });
    await pyodide.loadPackage(["micropip", "pillow"]);
    await pyodide.runPythonAsync(`
import micropip
await micropip.install([
    ${JSON.stringify(`${base}vendor/python/pypdf-6.10.0-py3-none-any.whl`)},
    ${JSON.stringify(`${base}vendor/python/charset_normalizer-3.4.4-py3-none-any.whl`)},
    ${JSON.stringify(`${base}vendor/python/reportlab-4.4.9-py3-none-any.whl`)}
], deps=False)
`);
    pyodide.FS.mkdirTree("/home/pyodide/lib");
    pyodide.FS.writeFile("/home/pyodide/lib/__init__.py", "");
    for (const [url, destination] of [["pdf-engine.txt", "/home/pyodide/pdf_engine.py"], ["image-engine.txt", "/home/pyodide/lib/image_tool.py"], ["pdf-browser-engine.py", "/home/pyodide/pdf_browser_engine.py"]]) {
      const response = await fetch(base + url);
      if (!response.ok) throw new Error("Browser engine unavailable");
      pyodide.FS.writeFile(destination, await response.text());
    }
    const fileNames = [];
    for (let index = 0; index < files.length; index++) {
      const path = `/tmp/input-${index}`;
      pyodide.FS.writeFile(path, new Uint8Array(await files[index].arrayBuffer()));
      fileNames.push({ path, name: files[index].name });
    }
    pyodide.globals.set("task_operation", operation);
    pyodide.globals.set("task_fields_json", JSON.stringify(fields));
    pyodide.globals.set("task_files_json", JSON.stringify(fileNames));
    pyodide.globals.set("task_budget", budget);
    // Run memory checks before opening PDF.js documents or allocating canvases.
    await pyodide.runPythonAsync(`
import json
import sys
from pathlib import Path
import pdf_engine
sys.modules["lib.pdf_tool"] = pdf_engine
from pdf_browser_engine import browser_process, prepare_browser_task, BrowserCapacityError
from pdf_engine import UploadedFile, PdfToolError
task_uploads = [UploadedFile(item["name"], Path(item["path"]).read_bytes()) for item in json.loads(task_files_json)]
task_fields = json.loads(task_fields_json)
prepare_browser_task(task_operation, task_uploads, task_fields, task_budget)
`);
    const raster = ["flatten", "pdf-tiff", "preview-page", "pdf-image"].includes(operation) || (operation === "split" && fields.split_format !== "pdf");
    if (raster) {
      const library = await renderer();
      for (const file of files) {
        const task = library.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
          cMapUrl: `${base}vendor/pdfjs/cmaps/`, cMapPacked: true,
          standardFontDataUrl: `${base}vendor/pdfjs/standard_fonts/`,
          wasmUrl: `${base}vendor/pdfjs/wasm/`,
          isEvalSupported: false,
          useWorkerFetch: true,
          CanvasFactory: WorkerCanvasFactory,
          disableFontFace: true,
          useSystemFonts: false,
        });
        documents.push(await task.promise);
      }
    }
    self.postMessage({ stage: "Processing on your device · files stay in this browser…" });
    await pyodide.runPythonAsync(`
task_result = await browser_process(task_operation, task_uploads, task_fields, task_budget)
Path("/tmp/result").write_bytes(task_result.data)
`);
    const metadata = pyodide.runPython("json.dumps({'name': task_result.name, 'type': task_result.content_type, 'pages': task_result.page_count})");
    const bytes = pyodide.FS.readFile("/tmp/result");
    self.postMessage({ result: { ...JSON.parse(metadata), bytes } }, [bytes.buffer]);
  } catch (error) {
    let validation = false;
    let message = "Browser processing unavailable";
    if (pyodide) {
      try {
        const detail = pyodide.runPython(`
import sys
_error = sys.last_exc
json.dumps({"validation": isinstance(_error, PdfToolError), "message": str(_error)})
`);
        ({ validation, message } = JSON.parse(detail));
      } catch { /* Runtime, renderer and memory failures use the server fallback. */ }
    }
    self.postMessage({ error: { validation, message } });
  } finally {
    await Promise.allSettled(documents.map(document => document.destroy()));
    self.close();
  }
};
