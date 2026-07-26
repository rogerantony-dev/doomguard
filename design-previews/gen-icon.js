#!/usr/bin/env node
/**
 * Generates the Unhook app icon assets from a single SVG source of truth.
 *
 *   node design-previews/gen-icon.js
 *
 * Writes:
 *   assets/icon.png                      1024  flat, full-bleed (iOS + Expo)
 *   assets/android-icon-foreground.png   1024  glyph inside the adaptive safe zone
 *   assets/android-icon-monochrome.png   1024  tintable silhouette, transparent
 *   assets/favicon.png                     48  web
 *
 * The mark: ink cat on deep green. Rounded head with cheeks and a chin, soft ears
 * sat on top, eyes as cut-outs, and a tail curling into a fish hook (the "unhook").
 * No rasteriser is installed on this machine, so we render through headless Chrome,
 * the same way the other design-previews scripts do.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out-icon');
const ASSETS = path.join(ROOT, 'assets');

// --- palette (mirrors tailwind.config.js) --------------------------------
const DEEP = '#2E9466'; // tile / background
const INK = '#141413'; // the cat

// --- geometry, on a 100-unit grid ----------------------------------------
const HEAD =
  'M 46 30 C 63 30, 74 42, 74 56 C 74 71, 62 82, 46 82 ' +
  'C 30 82, 18 71, 18 56 C 18 42, 29 30, 46 30 Z';
const EAR_L = 'M 26 42 L 31 20 L 44 36 Z';
const EAR_R = 'M 66 42 L 61 20 L 48 36 Z';
const HOOK = 'M 0 0 C 19 -2, 28 8, 28 17 C 28 26, 20 30, 14 26';
const HOOK_SCALE = 0.4; // small: the hook is an accent, not a second mass
const HOOK_AT = `translate(72 62) scale(${HOOK_SCALE})`;
const HOOK_W = 11; // pre-scale, so the hook scales uniformly with its stroke
const SOFTEN = 3.4; // same-colour stroke that rounds every corner
const EYE = { y: 53, r: 4.6, dx: 11, cx: 46 };

/**
 * Centre of the CAT (head + ears incl. stroke spread) — deliberately not the
 * centre of the whole glyph. Centring the full bounding box counts the tail as
 * mass and shoves the head off to the left; the cat reads centred only when the
 * cat itself is what gets centred, with the hook hanging off the right.
 */
const CAT_CENTER = { x: 46, y: 51 };

/**
 * Distance from CAT_CENTER to the furthest painted point, which is the tip of
 * the hook at roughly (85.4, 67). Ear tips are the runner-up at ~34.4.
 */
const GLYPH_RADIUS = 42.6;

/**
 * Adaptive icons are a 108dp canvas that the launcher masks down to a 72dp
 * circle, so anything beyond r=33.3 (in our 100-unit space) is genuinely cut,
 * and the always-safe 66dp zone is r=30.6. 32 splits them.
 */
const SAFE_RADIUS = 32;

/**
 * The mark as a mask: white where the cat is, black where the eyes cut through.
 * Painting a single rect through this mask gives us one code path for the solid
 * icon, the adaptive foreground, and the tintable monochrome.
 */
function maskBody(transform) {
  return `
      <rect x="-100" y="-100" width="300" height="300" fill="#000"/>
      <g transform="${transform}">
        <g transform="${HOOK_AT}">
          <path d="${HOOK}" fill="none" stroke="#fff" stroke-width="${HOOK_W}"
                stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <path d="${EAR_L}" fill="#fff" stroke="#fff" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
        <path d="${EAR_R}" fill="#fff" stroke="#fff" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
        <path d="${HEAD}" fill="#fff" stroke="#fff" stroke-width="${SOFTEN}" stroke-linejoin="round"/>
        <circle cx="${EYE.cx - EYE.dx}" cy="${EYE.y}" r="${EYE.r}" fill="#000"/>
        <circle cx="${EYE.cx + EYE.dx}" cy="${EYE.y}" r="${EYE.r}" fill="#000"/>
      </g>`;
}

/**
 * Put the cat's centre on the canvas centre and scale about that point. At
 * scale 1 this is just the recentring shift, which is what the full-bleed icon
 * wants; the adaptive assets pass a scale that pulls the hook inside the mask.
 */
function placeTransform(scale = 1) {
  const tx = 50 - scale * CAT_CENTER.x;
  const ty = 50 - scale * CAT_CENTER.y;
  return `translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(4)})`;
}

/** Largest scale that keeps every painted point inside the launcher's mask. */
const SAFE_SCALE = SAFE_RADIUS / GLYPH_RADIUS;

function svg({ bg, glyph, transform = placeTransform(1) }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">${maskBody(transform)}
  </mask></defs>
  ${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}
  <rect width="100" height="100" fill="${glyph}" mask="url(#m)"/>
</svg>`;
}

// --- the four assets ------------------------------------------------------
const TARGETS = [
  {
    name: 'icon',
    out: path.join(ASSETS, 'icon.png'),
    size: 1024,
    transparent: false,
    // Full-bleed, no mask to dodge, so the mark sits at native scale.
    svg: svg({ bg: DEEP, glyph: INK }),
  },
  {
    name: 'android-icon-foreground',
    out: path.join(ASSETS, 'android-icon-foreground.png'),
    size: 1024,
    transparent: true,
    // No background: app.json paints adaptiveIcon.backgroundColor behind it.
    svg: svg({ bg: null, glyph: INK, transform: placeTransform(SAFE_SCALE) }),
  },
  {
    name: 'android-icon-monochrome',
    out: path.join(ASSETS, 'android-icon-monochrome.png'),
    size: 1024,
    transparent: true,
    // Android discards this colour and applies the user's theme tint; the eye
    // cut-outs stay transparent so the themed background reads through them.
    svg: svg({ bg: null, glyph: '#FFFFFF', transform: placeTransform(SAFE_SCALE) }),
  },
  {
    name: 'favicon',
    out: path.join(ASSETS, 'favicon.png'),
    size: 48,
    transparent: false,
    svg: svg({ bg: DEEP, glyph: INK }),
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const t of TARGETS) {
  const svgPath = path.join(OUT, `${t.name}.svg`);
  const htmlPath = path.join(OUT, `${t.name}.html`);
  fs.writeFileSync(svgPath, t.svg);

  // Chrome screenshots the viewport, so the page is exactly one icon wide.
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><meta charset="utf-8">
<style>
  html,body { margin:0; padding:0; background:transparent; }
  svg { display:block; width:${t.size}px; height:${t.size}px; }
</style>
${t.svg}`
  );

  const args = [
    '--headless=new',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${t.size},${t.size}`,
    '--virtual-time-budget=4000',
    `--screenshot=${t.out}`,
  ];
  if (t.transparent) args.push('--default-background-color=00000000');
  args.push(`file://${htmlPath}`);

  execFileSync(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  console.log(`${t.name}  ${t.size}x${t.size}  ->  ${path.relative(ROOT, t.out)}`);
}

console.log('\nSources in design-previews/out-icon/. Background colour for the');
console.log(`adaptive icon must stay ${DEEP} in app.json.`);
