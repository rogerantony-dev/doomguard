/*
 * New onboarding step: choose Guilt or Block up front.
 *   1. Choose mode (Guilt selected here)
 *   2. Guilt options (limit + block-at-limit + strict) — shown only if Guilt.
 * If Block is chosen, Strict defaults ON and screen 2 is skipped.
 *
 *   node design-previews/gen-onboarding-mode.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=980,1040 --virtual-time-budget=4000 \
 *     --screenshot=design-previews/out-onboarding-mode/board.png design-previews/out-onboarding-mode/board.html
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out-onboarding-mode");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C", surface: "#1A1A18", panelhi: "#2C2C29",
  ink: "#F2F1EC", ink2: "#9A9A92", faint: "#62625B", hair: "rgba(242,241,236,0.10)",
  waste: "#E0913C", green: "#38C786",
};

const HEAD = `
<meta charset="utf-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#242422;font-family:"Inter",system-ui,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased}
.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;background:${T.bg};
  box-shadow:0 30px 70px rgba(40,40,36,.3),0 0 0 10px #16160f,0 0 0 12px #2c2c25}
.cap{width:390px;text-align:center;margin-top:16px;color:#b9b9b2;font:600 12.5px Inter;letter-spacing:.13em;text-transform:uppercase}
.scr{position:relative;height:100%;display:flex;flex-direction:column;padding:62px 26px 30px}
.head{display:flex;align-items:center;justify-content:space-between;height:24px}
.brand{display:flex;align-items:center;gap:9px;font:600 15px Inter}
.brand .dot{width:7px;height:7px;border-radius:50%;background:${T.faint}}
.htitle{font:600 28px Inter;letter-spacing:-.02em;margin-top:34px}
.hsub{font:400 15px/1.5 Inter;color:${T.ink2};margin-top:10px}

.opts{display:flex;flex-direction:column;gap:14px;margin-top:30px}
.opt{display:flex;align-items:flex-start;gap:15px;padding:20px;border-radius:20px;border:1.5px solid ${T.hair};background:${T.surface}}
.opt.selg{border-color:${T.waste};background:rgba(224,145,60,.08)}
.opt.selb{border-color:${T.green};background:rgba(56,199,134,.08)}
.opt .ic{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;flex:none}
.opt .ic.g{background:rgba(224,145,60,.14)}
.opt .ic.b{background:rgba(56,199,134,.14)}
.opt h5{font:600 17px Inter}
.opt p{font:400 13px/1.4 Inter;color:${T.ink2};margin-top:4px}
.opt .rad{width:22px;height:22px;border-radius:50%;border:2px solid ${T.hair};flex:none;margin-top:2px;display:flex;align-items:center;justify-content:center}
.opt.selg .rad{border-color:${T.waste}}
.opt.selg .rad::after{content:"";width:11px;height:11px;border-radius:50%;background:${T.waste}}
.opt.selb .rad{border-color:${T.green}}
.opt.selb .rad::after{content:"";width:11px;height:11px;border-radius:50%;background:${T.green}}

.cta{background:${T.ink};color:${T.bg};border-radius:16px;padding:17px;text-align:center;font:600 16px Inter;margin-top:auto}
.note{font:400 12.5px/1.4 Inter;color:${T.faint};margin-top:14px;text-align:center}

/* guilt options */
.optgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:22px}
.o2{display:flex;align-items:center;justify-content:center;background:${T.bg};border:1px solid ${T.hair};border-radius:14px;padding:15px 0;font:600 16px Inter;color:${T.ink}}
.o2.sel{background:rgba(224,145,60,0.14);border-color:${T.waste};color:${T.waste}}
.trow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 0;border-top:1px solid ${T.hair}}
.trow:first-of-type{margin-top:14px}
.trow h6{font:600 15px Inter}
.trow p{font:400 12.5px/1.4 Inter;color:${T.ink2};margin-top:3px;max-width:220px}
.sw{width:46px;height:27px;border-radius:999px;background:#3a3a35;position:relative;flex:none}
.sw.on{background:${T.green}}
.sw i{position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff}
.sw.on i{left:22px}
</style>`;

const sw = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const sh = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const lock = (c) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`;
const brand = `<div class="head"><div class="brand"><span class="dot"></span>Unhook</div></div>`;

const choose = `<div class="scr">
  ${brand}
  <div class="htitle">How should it work?</div>
  <div class="hsub">Pick one. You can change it anytime.</div>
  <div class="opts">
    <div class="opt selg">
      <div class="ic g">${sw(T.waste)}</div>
      <div style="flex:1"><h5>Guilt</h5><p>Time your scrolling. Block the reels once you hit a daily limit you set.</p></div>
      <div class="rad"></div>
    </div>
    <div class="opt">
      <div class="ic b">${sh(T.green)}</div>
      <div style="flex:1"><h5>Block</h5><p>Wall off every reel and short, all day. The strict option.</p></div>
      <div class="rad"></div>
    </div>
  </div>
  <div class="cta">Continue</div>
</div>`;

const guiltOptions = `<div class="scr">
  ${brand}
  <div class="htitle">Set your limit.</div>
  <div class="hsub">Unhook blocks the reels once you cross it.</div>
  <div class="optgrid">
    ${[["15m",0],["30m",0],["45m",0],["1h",1],["1h 30",0],["2h",0]].map(([l,s])=>`<div class="o2 ${s?"sel":""}">${l}</div>`).join("")}
  </div>
  <div class="trow"><div><h6>Block at limit</h6><p>Wall reels off once you hit it. Snooze 5 min at a time if you must.</p></div><div class="sw on"><i></i></div></div>
  <div class="trow"><div><h6 style="display:flex;align-items:center;gap:7px">Strict mode ${lock(T.faint)}</h6><p>No snooze. Locked until midnight.</p></div><div class="sw"><i></i></div></div>
  <div class="cta">Continue</div>
</div>`;

const screens = { choose, guiltOptions };
const order = ["choose", "guiltOptions"];
const caps = { choose:"Choose mode", guiltOptions:"Guilt · options" };

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;gap:32px;padding:44px;justify-content:center;align-items:flex-start">
${order.map((n)=>`<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);
console.log("Wrote", order.length + 1, "files to", OUT);
