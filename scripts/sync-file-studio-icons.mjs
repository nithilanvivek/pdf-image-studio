import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// The owner supplied this final Mac-rendered PNG, including its original shading.
// Reuse it exactly; do not redraw it or add outlines inside the cream tile.
const master = readFileSync(new URL('../assets/icons/pdf-studio-mac-original.png', import.meta.url));
const dataUrl = 'data:image/png;base64,' + master.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="PDF + Image Studio app icon"><image width="1024" height="1024" href="${dataUrl}"/></svg>\n`;
for (const path of ['assets/icons/pdf-studio-app-icon.svg', 'tools/filestudio/icons/icon.svg']) {
  writeFileSync(new URL('../' + path, import.meta.url), svg);
}
writeFileSync(new URL('../assets/icons/pdf-studio-app-icon.png', import.meta.url), master);

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const [filename, size, maskable] of [
    ['icon-180.png', 180, false], ['icon-192.png', 192, false],
    ['icon-512.png', 512, false], ['icon-1024.png', 1024, false],
    ['maskable-512.png', 512, true], ['maskable-1024.png', 1024, true],
    ['apple-touch-icon.png', 180, true]
  ]) {
    const png = await page.evaluate(async ({ dataUrl, size, maskable }) => {
      const original = new Image(); original.src = dataUrl; await original.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const context = canvas.getContext('2d');
      if (maskable) {
        context.fillStyle = '#f2ece2'; context.fillRect(0, 0, size, size);
        // The master includes a Mac rounded tile at x/y=100..924, plus outer
        // transparency/shadow. A maskable OS icon must fill its canvas: drawing
        // the entire pre-rounded master with padding produces a second tile.
        // Crop only that outer margin; retain the original page, n and shading.
        context.drawImage(original, 100, 100, 824, 824, 0, 0, size, size);
      } else {
        context.drawImage(original, 0, 0, size, size);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    }, { dataUrl, size, maskable });
    writeFileSync(new URL('../tools/filestudio/icons/' + filename, import.meta.url), Buffer.from(png, 'base64'));
  }
} finally { await browser.close(); }
console.log('Studio icons exported from the original PDF Studio Mac artwork.');
