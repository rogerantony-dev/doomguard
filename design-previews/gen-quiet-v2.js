/*
 * "Quiet v2" — visual-forward dashboard. Less text; the hero is a growing wall
 * of wasted-minute blocks (warm amber = time burned) so the magnitude hits you
 * before you read a word. Green stays reserved for the safe/Block state.
 *
 *   node design-previews/gen-quiet-v2.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1340,1040 --virtual-time-budget=4000 \
 *     --screenshot=design-previews/out-quiet-v2/board.png design-previews/out-quiet-v2/board.html
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out-quiet-v2");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C", surface: "#1A1A18", panelhi: "#2C2C29",
  ink: "#F2F1EC", ink2: "#9A9A92", faint: "#62625B",
  hair: "rgba(242,241,236,0.10)",
  waste: "#E0913C", wasteDim: "rgba(224,145,60,0.30)", // guilt / time burned
  green: "#38C786", greenSoft: "rgba(56,199,134,0.14)", // safe / block
};

const HEAD = `
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#242422;font-family:"Inter",system-ui,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.04em}
.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;background:${T.bg};
  box-shadow:0 30px 70px rgba(40,40,36,.3),0 0 0 10px #16160f,0 0 0 12px #2c2c25}
.scr{position:relative;height:100%;display:flex;flex-direction:column;padding:62px 26px 30px}
.cap{width:390px;text-align:center;margin-top:16px;color:#b9b9b2;font:600 12.5px Inter;letter-spacing:.13em;text-transform:uppercase}
.brand{display:flex;align-items:center;gap:9px;font:600 16px Inter}
.brand .dot{width:7px;height:7px;border-radius:50%;background:${T.green}}
.kicker{font:600 12px Inter;letter-spacing:.11em;text-transform:uppercase;color:${T.faint}}

.bignum{font:600 92px Inter;line-height:.84}
.bignum .u{font:500 22px Inter;color:${T.faint};letter-spacing:0;margin-left:8px}

/* the wall of wasted minutes — a daily-budget container that fills, then overflows red */
.wall{display:flex;flex-wrap:wrap;gap:5px;margin-top:22px}
.wall i{width:16px;height:16px;border-radius:3px}
.wall i.e{background:transparent;box-shadow:inset 0 0 0 1px rgba(224,145,60,.20)}
.wall i.f{background:${T.waste}}
.wall i.o{background:#D2542F}
.budget{font:600 11px Inter;letter-spacing:.08em;text-transform:uppercase;color:${T.faint};margin-top:12px}

.cation{font:600 22px Inter;letter-spacing:-.02em;margin-top:26px}
.counts{display:flex;gap:18px;margin-top:12px;font:500 14px Inter;color:${T.ink2}}
.counts b{color:${T.ink};font-weight:600}
.counts .c{display:flex;align-items:center;gap:7px}
.counts .sq{width:9px;height:9px;border-radius:2px}

.seg{display:flex;background:${T.surface};border-radius:14px;padding:4px;gap:4px;margin-top:26px}
.seg .o{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:13px;font:600 14.5px Inter;color:${T.ink2}}
.seg .o.on{background:${T.panelhi};color:${T.ink}}
.seg .o.on.safe{background:${T.green};color:${T.bg}}

.tray{margin-top:auto;display:flex;gap:11px;padding-top:22px}
.tray .b{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;background:${T.surface};border-radius:15px;padding:16px;font:600 15px Inter;color:${T.ink}}

/* top row + limit chip */
.toprow{display:flex;align-items:center;justify-content:space-between}
.limitchip{display:flex;align-items:center;gap:6px;background:${T.surface};border-radius:999px;
  padding:8px 13px;font:600 12.5px Inter;color:${T.ink2}}
.limitchip b{color:${T.ink};font-weight:600}
.limitchip .cv{font-size:11px;color:${T.faint}}

/* bottom sheet picker */
.scrim{position:absolute;inset:0;background:rgba(8,8,10,.6);display:flex;align-items:flex-end;padding:14px}
.sheet{width:100%;background:${T.surface};border:1px solid ${T.hair};border-radius:26px;padding:24px}
.sheettitle{font:600 21px Inter;letter-spacing:-.01em}
.sheetsub{font:400 14px Inter;color:${T.ink2};margin-top:7px}
.optgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:20px}
.opt2{display:flex;align-items:center;justify-content:center;background:${T.bg};border:1px solid ${T.hair};
  border-radius:14px;padding:16px 0;font:600 16px Inter;color:${T.ink}}
.opt2.sel{background:rgba(224,145,60,0.14);border-color:${T.waste};color:${T.waste}}
.sheetdone{margin-top:18px;text-align:center;background:${T.ink};color:${T.bg};border-radius:15px;padding:15px;font:600 15px Inter}

/* block / safe */
.shieldc{width:72px;height:72px;border-radius:50%;background:${T.greenSoft};display:flex;align-items:center;justify-content:center;margin-top:70px}
.safetitle{font:600 32px Inter;letter-spacing:-.02em;margin-top:24px}
.safesub{font:400 15px/1.45 Inter;color:${T.ink2};margin-top:10px;max-width:280px}
.savedrow{display:flex;align-items:baseline;gap:10px;margin-top:26px}
.savedrow .n{font:600 40px Inter;color:${T.green}}
.savedrow .l{font:400 14px Inter;color:${T.ink2}}
</style>`;

const sq = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const sh = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const paw = (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${c}"><circle cx="6" cy="11" r="2.4"/><circle cx="11" cy="7.5" r="2.4"/><circle cx="17" cy="9.5" r="2.4"/><path d="M8 17c0-3 2.5-4.5 4.5-4.5S17 14 17 17s-2 3-4.5 3S8 20 8 17z"/></svg>`;
const chart = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`;

const BUDGET = 60; // daily limit, in minutes — the container size

function wall(minutes) {
  // budget cells fill amber; minutes past the limit overflow as red cells
  const cells = [];
  for (let i = 0; i < BUDGET; i++) cells.push(`<i class="${i < minutes ? "f" : "e"}"></i>`);
  for (let i = BUDGET; i < minutes; i++) cells.push(`<i class="o"></i>`);
  return `<div class="wall">${cells.join("")}</div>`;
}

function guilt(minutes, reels, shorts, caption) {
  const over = minutes > BUDGET;
  const numColor = over ? "#D2542F" : T.waste;
  const budgetLabel = over
    ? `${minutes - BUDGET} min over your ${BUDGET}-min limit`
    : `${BUDGET - minutes} min left of your ${BUDGET}-min limit`;
  return `<div class="scr">
    <div class="toprow">
      <div class="brand"><span class="dot"></span>Wilt</div>
      <div class="limitchip">Limit <b>${BUDGET}m</b> <span class="cv">▾</span></div>
    </div>
    <div style="margin-top:40px">
      <div class="bignum num" style="color:${numColor}">${minutes}<span class="u">min wasted today</span></div>
    </div>
    ${wall(minutes)}
    <div class="budget">${budgetLabel}</div>
    <div class="cation">${caption}</div>
    <div class="counts">
      <span class="c"><span class="sq" style="background:${T.waste}"></span><b>${reels}</b> reels</span>
      <span class="c"><span class="sq" style="background:${T.wasteDim}"></span><b>${shorts}</b> shorts</span>
    </div>
    <div class="seg"><div class="o on">${sq(T.ink)}Guilt</div><div class="o safe">${sh(T.ink2)}Block</div></div>
    <div class="tray">
      <div class="b">${paw(T.ink)}Cats</div>
      <div class="b">${chart(T.ink)}History</div>
    </div>
  </div>`;
}

const block = `<div class="scr">
  <div class="brand"><span class="dot"></span>Wilt</div>
  <div class="shieldc">${sh(T.green)}</div>
  <div class="safetitle">Reels can't<br>reach you.</div>
  <div class="safesub">Every reel and short gets bounced the second it appears.</div>
  <div class="savedrow"><span class="n num">14</span><span class="l">reels stopped today</span></div>
  <div class="seg" style="margin-top:30px"><div class="o">${sq(T.ink2)}Guilt</div><div class="o on safe">${sh(T.bg)}Block</div></div>
  <div class="tray">
    <div class="b">${paw(T.ink)}Cats</div>
    <div class="b">${chart(T.ink)}History</div>
  </div>
</div>`;

const LIMITS = [
  { v: 15, l: "15m" }, { v: 30, l: "30m" }, { v: 45, l: "45m" },
  { v: 60, l: "1h" }, { v: 90, l: "1h 30" }, { v: 120, l: "2h" },
];
const limitSheet = `
<div class="scr" style="filter:blur(2px);opacity:.45">
  <div class="toprow"><div class="brand"><span class="dot"></span>Wilt</div>
    <div class="limitchip">Limit <b>${BUDGET}m</b> <span class="cv">▾</span></div></div>
  <div style="margin-top:40px"><div class="bignum num" style="color:${T.waste}">23<span class="u">min wasted today</span></div></div>
  ${wall(23)}
</div>
<div class="scrim">
  <div class="sheet">
    <div class="sheettitle">Daily limit</div>
    <div class="sheetsub">Cross it and the wall, pill, and widget turn red.</div>
    <div class="optgrid">
      ${LIMITS.map((o) => `<div class="opt2 ${o.v === BUDGET ? "sel" : ""}">${o.l}</div>`).join("")}
    </div>
    <div class="sheetdone">Done</div>
  </div>
</div>`;

const screens = {
  guiltLight: guilt(23, 14, 7, "Time's slipping."),
  guiltHeavy: guilt(95, 61, 28, "Way past your limit."),
  block,
  limitSheet,
};
const order = ["guiltLight", "guiltHeavy", "limitSheet", "block"];
const caps = {
  guiltLight: "Guilt — 23 min", guiltHeavy: "Guilt — 95 min",
  limitSheet: "Set daily limit", block: "Block mode",
};

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;gap:34px;padding:48px;justify-content:center;align-items:flex-start">
${order.map((n) => `<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);
console.log("Wrote", order.length + 1, "files to", OUT);
