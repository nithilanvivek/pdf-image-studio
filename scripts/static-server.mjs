import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve, relative, extname } from "node:path";

const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain" };
export function createStaticServer(rootDirectory = process.cwd()) {
  const root = resolve(rootDirectory);
  return createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      if (pathname === "/" || /^\/tools\/(?:pdf|images)\/?$/.test(pathname)) { res.writeHead(302, { Location: "/tools/filestudio/" }); res.end(); return; }
      // Serve app assets only, never arbitrary repository or hidden files.
      if (!/^\/(tools\/filestudio\/|src\/(tab-title|devtools-greeting)\.js$)/.test(pathname) ||
          pathname.split("/").some(part => part.startsWith("."))) { res.writeHead(404); res.end(); return; }
      let file = resolve(root, "." + pathname);
      if (relative(root, file).startsWith("..")) throw new Error("Outside root");
      if (statSync(file).isDirectory()) file = resolve(file, "index.html");
      const size = statSync(file).size;
      res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream",
        "Content-Length": size, "Cache-Control": "no-cache" });
      createReadStream(file).pipe(res);
    } catch { res.writeHead(404); res.end(); }
  });
}
