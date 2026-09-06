/*
 * "Quiet" native surfaces preview — the pieces that don't live in the React app:
 * the floating timer pill (budget ring), the home-screen widget, and the nudge
 * popup. Pill + widget mirror what's shipped; the nudge is a redesign proposal.
 *
 *   node design-previews/gen-quiet-surfaces.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1760,1040 --virtual-time-budget=4000 \
 *     --screenshot=design-previews/out-quiet-surfaces/board.png \
 *     design-previews/out-quiet-surfaces/board.html
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out-quiet-surfaces");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C", surface: "#1A1A18", ink: "#F2F1EC", ink2: "#9A9A92", faint: "#62625B",
  hair: "rgba(242,241,236,0.10)",
  waste: "#E0913C", over: "#D2542F", green: "#38C786",
  wasteTrack: "rgba(224,145,60,0.26)", overTrack: "rgba(210,84,47,0.26)", greenTrack: "rgba(56,199,134,0.26)",
};

const HEAD = `
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#242422;font-family:"Inter",system-ui,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;background:${T.bg};
  box-shadow:0 30px 70px rgba(40,40,36,.3),0 0 0 10px #16160f,0 0 0 12px #2c2c25}
.cap{width:390px;text-align:center;margin-top:16px;color:#b9b9b2;font:600 12.5px Inter;letter-spacing:.13em;text-transform:uppercase}

/* a reel playing underneath */
.reel{position:absolute;inset:0;background:radial-gradient(120% 80% at 30% 18%,#2b2740 0%,#0c0c10 62%),linear-gradient(180deg,#161620,#05050a)}
.reel::after{content:"reel";position:absolute;left:22px;bottom:26px;font:700 12px Inter;letter-spacing:.2em;text-transform:uppercase;color:#3a3a44}

/* floating pill */
.pillwrap{position:absolute;top:54px;left:0;right:0;display:flex;justify-content:center}
.pill{display:inline-flex;align-items:center;gap:11px;background:rgba(26,26,24,.95);
  border:1px solid ${T.hair};border-radius:22px;padding:10px 18px 10px 14px;
  box-shadow:0 8px 22px rgba(0,0,0,.45)}
.pill .ring{width:26px;height:26px;display:block}
.pill .lbl{font:700 15px Inter;letter-spacing:.01em}

/* home screen for the widget */
.home{position:absolute;inset:0;background:
  radial-gradient(90% 60% at 50% 0%, #20202a 0%, transparent 55%),
  linear-gradient(180deg,#121218 0%,#0a0a0e 100%)}
.clock{position:absolute;top:84px;left:0;right:0;text-align:center;color:#e9e9ee}
.clock .t{font:300 64px Inter;letter-spacing:-.02em}
.clock .d{font:500 15px Inter;color:#b8b8c2;margin-top:2px}
.widgetwrap{position:absolute;top:250px;left:24px;right:24px}
.widget{background:linear-gradient(180deg,#1A1A18,#141413);border:1px solid ${T.hair};border-radius:26px;padding:20px}
.widget .brand{font:700 11px Inter;letter-spacing:.16em;color:${T.ink2}}
.widget .timerow{display:flex;align-items:baseline;gap:9px;margin-top:8px}
.widget .time{font:700 36px Inter}
.widget .wt{font:400 13px Inter;color:${T.ink2}}
.widget .lim{font:700 11px Inter;letter-spacing:.04em;margin-top:6px}
.widget .counts{display:flex;gap:18px;margin-top:14px;font:400 14px Inter;color:${T.ink2}}
.dock{position:absolute;bottom:38px;left:0;right:0;display:flex;justify-content:center;gap:22px}
.dock i{width:54px;height:54px;border-radius:15px;background:rgba(255,255,255,.08);display:block}

/* nudge popup */
.scrim{position:absolute;inset:0;background:rgba(8,8,10,.66);display:flex;align-items:center;justify-content:center;padding:24px}
.card{width:100%;background:${T.surface};border:1px solid ${T.hair};border-radius:26px;padding:20px;
  box-shadow:0 30px 70px rgba(0,0,0,.5)}
.card .cat{width:100%;height:150px;object-fit:cover;border-radius:16px;display:block}
.card .tag{display:inline-block;margin-top:16px;font:600 10.5px Inter;letter-spacing:.1em;text-transform:uppercase;
  color:${T.waste};background:rgba(224,145,60,.14);border-radius:999px;padding:5px 11px}
.card h4{font:600 24px Inter;letter-spacing:-.02em;margin-top:12px}
.card p{font:400 14.5px/1.5 Inter;color:${T.ink2};margin-top:8px}
.card .btn{display:block;text-align:center;border-radius:15px;padding:15px;margin-top:14px;font:600 15px Inter}
.card .btn.primary{background:${T.ink};color:${T.bg}}
.card .btn.ghost{color:${T.faint};font-weight:500;padding:10px}
</style>`;

function ring(frac, color, track, full) {
  const R = 40, C = 2 * Math.PI * R;
  const sweep = full ? 1 : Math.min(Math.max(frac, 0), 1);
  const off = C * (1 - sweep);
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${track}" stroke-width="13"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/>
  </svg>`;
}

function pillScreen(svg, label, labelColor) {
  return `<div class="reel"></div>
  <div class="pillwrap"><div class="pill"><span class="ring">${svg}</span>
    <span class="lbl" style="color:${labelColor}">${label}</span></div></div>`;
}

function widgetScreen(over) {
  const c = over ? T.over : T.waste;
  const time = over ? "1h 35m" : "23m";
  const lim = over ? "35 min over your 60-min limit" : "37 min left of your 60-min limit";
  return `<div class="home">
    <div class="clock"><div class="t num">9:41</div><div class="d">Monday, June 30</div></div>
    <div class="widgetwrap"><div class="widget">
      <div class="brand">WILT</div>
      <div class="timerow"><span class="time num" style="color:${c}">${time}</span><span class="wt">wasted today</span></div>
      <div class="lim" style="color:${c}">${lim}</div>
      <div class="counts"><span>${over ? 88 : 14} reels</span><span>${over ? 31 : 7} shorts</span></div>
    </div></div>
    <div class="dock"><i></i><i></i><i></i><i></i></div>
  </div>`;
}

const nudge = `<div class="reel"></div>
<div class="scrim"><div class="card">
  <img class="cat" src="https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=520&q=70"/>
  <span class="tag">30 min today</span>
  <h4>Half an hour, gone.</h4>
  <p>That's a real chunk of your day, disappeared into the feed.</p>
  <span class="btn primary">Watch a cat instead</span>
  <span class="btn ghost">I know, keep scrolling</span>
</div></div>`;

const screens = {
  pillUnder: pillScreen(ring(0.38, T.waste, T.wasteTrack), "23 min scrolling", "#FFFFFF"),
  pillOver: pillScreen(ring(1, T.over, T.overTrack, true), "1h 35m scrolling", "#FFFFFF"),
  pillBlock: pillScreen(ring(1, T.green, T.greenTrack, true), "Blocked", T.green),
  widgetUnder: widgetScreen(false),
  widgetOver: widgetScreen(true),
  nudge,
};
const order = ["pillUnder", "pillOver", "pillBlock", "widgetUnder", "widgetOver", "nudge"];
const caps = {
  pillUnder: "Pill — under limit", pillOver: "Pill — over limit", pillBlock: "Pill — block mode",
  widgetUnder: "Widget — under limit", widgetOver: "Widget — over limit", nudge: "Nudge popup (proposal)",
};

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;flex-wrap:wrap;gap:30px 34px;padding:48px;justify-content:center;align-items:flex-start">
${order.map((n) => `<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);
console.log("Wrote", order.length + 1, "files to", OUT);
