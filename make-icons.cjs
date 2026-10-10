// Draws Orient's app icons (public/icons/*.png) from the same mark as public/icon.svg.
//   ORIENT_PLAYWRIGHT=<folder> node make-icons.cjs
// "any" icons keep the rounded square; the maskable and Apple icons are full-bleed with the mark inside the safe zone,
// because the phone applies its own mask or rounding.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.ORIENT_PLAYWRIGHT || 'playwright');
const out = path.join(__dirname, 'public', 'icons');

// the mark, drawn in a 64 x 64 box (same strokes as icon.svg)
const mark = '<path d="M18 46 42 22M22 20h22v22" fill="none" stroke="#e8f0dc" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="44" r="5" fill="#ec8959"/>';
const rounded = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#183f39"/>' + mark + '</svg>';
// full-bleed: the mark is scaled to 70% and centred, so a circular mask never clips it
const bleed = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#183f39"/><g transform="translate(9.6 9.6) scale(0.7)">' + mark + '</g></svg>';

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [file, size, svg, transparent] of [['icon-192.png', 192, rounded, true], ['icon-512.png', 512, rounded, true], ['maskable-512.png', 512, bleed, false], ['apple-touch-icon.png', 180, bleed, false]]) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent('<html><body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" style="display:block" ') + '</body></html>');
      await page.screenshot({ path: path.join(out, file), omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
      await page.close(); console.log('wrote public/icons/' + file);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
