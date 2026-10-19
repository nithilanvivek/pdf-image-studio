import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { posix } from "node:path";
const root = new URL("../tools/filestudio/", import.meta.url);
const productionManifest = JSON.parse(readFileSync(new URL("manifest.webmanifest", root)));
Object.assign(productionManifest, { id: "/", start_url: "/", scope: "/" });
productionManifest.icons.forEach(icon => { icon.src = `/tools/filestudio/${icon.src}`; });
productionManifest.file_handlers.forEach(handler => { handler.action = "/"; });
productionManifest.related_applications = [{ platform: "webapp", url: "https://files.nithi.land/tools/filestudio/manifest.webmanifest", id: "https://files.nithi.land/" }];
const manifestSource = JSON.stringify(productionManifest, null, 2) + "\n";
const manifestDestination = new URL("manifest-production.webmanifest", root);
if (process.argv.includes("--check")) {
  if (readFileSync(manifestDestination, "utf8") !== manifestSource) throw new Error("Run npm run build:file-studio-pwa");
} else writeFileSync(manifestDestination, manifestSource);
function files(directory = "") {
  return readdirSync(new URL(directory || ".", root), { withFileTypes: true }).flatMap(entry => {
    const name = posix.join(directory, entry.name);
    // Store packaging metadata is not part of the browser's offline application.
    if (entry.name.startsWith(".") || ["__pycache__", "windows", "service-worker.js", "service-worker-template.js", "VENDOR.md"].includes(entry.name)) return [];
    return entry.isDirectory() ? files(name) : [name];
  });
}
const assets = files().sort();
const hash = createHash("sha256");
for (const name of assets) hash.update(name).update(readFileSync(new URL(name, root)));
const template = readFileSync(new URL("service-worker-template.js", root), "utf8");
hash.update(template);
const source = template.replace('"__VERSION__"', JSON.stringify(hash.digest("hex").slice(0, 16)))
  .replace("__ASSETS__", JSON.stringify(["/tools/filestudio/", ...assets.map(name => `/tools/filestudio/${name}`)], null, 2));
const destination = new URL("service-worker.js", root);
if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== source) throw new Error("Run npm run build:file-studio-pwa");
} else writeFileSync(destination, source);
console.log(`PDF + Image Studio offline shell: ${assets.length + 1} static assets; no user files.`);
