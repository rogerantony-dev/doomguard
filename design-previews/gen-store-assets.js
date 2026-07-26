#!/usr/bin/env node
/**
 * Generates the Play Store listing graphics.
 *
 *   node design-previews/gen-store-assets.js
 *
 * Writes to design-previews/out-store/:
 *   play-icon-512.png       512x512   the listing icon Play shows in search/detail
 *   feature-graphic.png    1024x500   the banner at the top of the listing
 *
 * Both are built from the same mark as gen-icon.js so the store listing and the
 * launcher icon cannot drift apart. Play rejects alpha in either of these, so
 * both render on an opaque background.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(__dirname, 'out-store');

// palette, mirroring tailwind.config.js
const DEEP = '#2E9466';
const INK = '#141413';
const CANVAS = '#0D0D0C';
const BONE = '#F2F1EC';
const ASH = '#9A9A92';

// --- the mark, identical geometry to gen-icon.js -------------------------
const HEAD =
  'M 46 30 C 63 30, 74 42, 74 56 C 74 71, 62 82, 46 82 ' +
  'C 30 82, 18 71, 18 56 C 18 42, 29 30, 46 30 Z';
const EAR_L = 'M 26 42 L 31 20 L 44 36 Z';
const EAR_R = 'M 66 42 L 61 20 L 48 36 Z';
const HOOK = 'M 0 0 C 19 -2, 28 8, 28 17 C 28 26, 20 30, 14 26';
const SOFTEN = 3.4;
const CAT_CENTER = { x: 46, y: 51 };

/** Cat centred on the canvas, hook hanging right. Matches gen-icon.js. */
function mark({ tile, body }) {
  const t = `translate(${50 - CAT_CENTER.x} ${50 - CAT_CENTER.y}) scale(1)`;
  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" fill="${tile}"/>
    <g transform="${t}">
      <g transform="translate(72 62) scale(0.4)">
        <path d="${HOOK}" fill="none" stroke="${body}" stroke-width="11"
              stroke-linecap="round" stroke-linejoin="round"/>
      </g>
      <path d="${EAR_L}" fill="${body}" stroke="${body}" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
      <path d="${EAR_R}" fill="${body}" stroke="${body}" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
      <path d="${HEAD}"  fill="${body}" stroke="${body}" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
      <circle cx="35" cy="53" r="4.6" fill="${tile}"/>
      <circle cx="57" cy="53" r="4.6" fill="${tile}"/>
    </g>
  </svg>`;
}

const FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

const TARGETS = [
  {
    name: 'play-icon-512',
    w: 512,
    h: 512,
    // Play masks this itself, so ship it square and full-bleed.
    html: `<style>html,body{margin:0;padding:0}svg{display:block;width:512px;height:512px}</style>
${mark({ tile: DEEP, body: INK })}`,
  },
  {
    name: 'feature-graphic',
    w: 1024,
    h: 500,
    /*
     * Play crops this banner differently across surfaces and can overlay a play
     * button dead centre, so the mark and type sit left-of-centre with generous
     * margins and nothing important near an edge.
     */
    html: `<style>
  html,body { margin:0; padding:0; }
  .wrap {
    width:1024px; height:500px; background:${CANVAS};
    display:flex; align-items:center; gap:56px; padding:0 88px;
    box-sizing:border-box; font-family:${FONT};
  }
  .tile { width:196px; height:196px; border-radius:44px; overflow:hidden; flex:none; }
  .tile svg { width:196px; height:196px; }
  h1 {
    margin:0; font-size:76px; line-height:1; font-weight:700;
    letter-spacing:-2px; color:${BONE};
  }
  p { margin:18px 0 0; font-size:29px; line-height:1.32; color:${ASH}; max-width:520px; }
  .accent { color:${DEEP}; }
</style>
<div class="wrap">
  <div class="tile">${mark({ tile: DEEP, body: INK })}</div>
  <div>
    <h1>Unhook</h1>
    <p>Your Reels and Shorts, <span class="accent">on the clock</span>. Time them, or wall them off.</p>
  </div>
</div>`,
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const t of TARGETS) {
  const htmlPath = path.join(OUT, `${t.name}.html`);
  const outPath = path.join(OUT, `${t.name}.png`);
  fs.writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8">${t.html}`);

  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${t.w},${t.h}`,
      '--virtual-time-budget=4000',
      `--screenshot=${outPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );
  console.log(`${t.name}  ${t.w}x${t.h}  ->  ${path.relative(path.join(__dirname, '..'), outPath)}`);
}

console.log('\nUpload both in Play Console > Store listing > Graphics.');
