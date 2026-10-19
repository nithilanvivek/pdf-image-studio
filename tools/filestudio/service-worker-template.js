/* PDF + Image Studio only. Never cache uploads, API responses or output files. */
const PREFIX = "pdf-image-studio-";
const CACHE = PREFIX + "__VERSION__";
const DEDICATED = ["files.nithi.land", "files.localhost"].includes(self.location.hostname);
const RETIRED = ["nithi.land", "www.nithi.land", "pdfimage.nithi.land"].includes(self.location.hostname);
const ASSETS = __ASSETS__.filter(url => !DEDICATED || url !== "/tools/filestudio/index.html")
  .map(url => DEDICATED && url === "/tools/filestudio/" ? "/" : url);
if (DEDICATED) ASSETS.push("/src/tab-title.js", "/src/devtools-greeting.js");
const ALLOWED = new Set(ASSETS);
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    if (RETIRED) { await self.skipWaiting(); return; }
    try {
      const cache = await caches.open(CACHE);
      // Bounded batches avoid starting hundreds of parallel runtime downloads.
      for (let index = 0; index < ASSETS.length; index += 12) {
        await cache.addAll(ASSETS.slice(index, index + 12).map(url => new Request(url, { cache: "reload" })));
      }
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && (RETIRED || name !== CACHE)).map(name => caches.delete(name)));
    await self.clients.claim();
    for (const client of await self.clients.matchAll()) client.postMessage({ type: RETIRED ? "STUDIO_MOVED" : "STUDIO_OFFLINE_READY", url: "https://files.nithi.land/" });
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (RETIRED) return;
  if (request.method !== "GET" || url.origin !== self.location.origin || !ALLOWED.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // A versioned, atomic shell keeps Python, JS and WASM releases together.
    const saved = await cache.match(url.pathname);
    return saved || fetch(request);
  })());
});
