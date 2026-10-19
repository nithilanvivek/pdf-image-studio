// Keep the browser's Python engine identical to the server's implementation.
import { readFileSync, writeFileSync } from "node:fs";
for (const [input, output] of [["pdf_tool.py", "pdf-engine.txt"], ["image_tool.py", "image-engine.txt"]]) {
  const source = readFileSync(new URL(`../lib/${input}`, import.meta.url));
  const destination = new URL(`../tools/filestudio/${output}`, import.meta.url);
  if (process.argv.includes("--check")) {
    if (!source.equals(readFileSync(destination))) throw new Error("Run npm run sync:pdf-browser-engine");
  } else writeFileSync(destination, source);
}
