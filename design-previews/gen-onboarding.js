/*
 * "Quiet" onboarding flow mock — a 5-screen first-run that sells the features
 * before asking for permissions. Welcome -> Time it -> Block it -> Nudge -> Setup.
 *
 *   node design-previews/gen-onboarding.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=2160,1040 --virtual-time-budget=5000 \
 *     --screenshot=design-previews/out-onboarding/board.png design-previews/out-onboarding/board.html
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out-onboarding");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C", surface: "#1A1A18", panelhi: "#2C2C29",
  ink: "#F2F1EC", ink2: "#9A9A92", faint: "#62625B", hair: "rgba(242,241,236,0.10)",
  waste: "#E0913C", over: "#D2542F", green: "#38C786", greenSoft: "rgba(56,199,134,0.14)",
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
.scr{position:relative;height:100%;display:flex;flex-direction:column;padding:62px 26px 30px}

.head{display:flex;align-items:center;justify-content:space-between;height:24px}
.brand{display:flex;align-items:center;gap:9px;font:600 15px Inter}
.brand .dot{width:7px;height:7px;border-radius:50%;background:${T.green}}
.skip{font:600 13px Inter;color:${T.faint}}

.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;text-align:center}
.art{display:flex;flex-direction:column;align-items:center;justify-content:center}
.htitle{font:600 30px Inter;letter-spacing:-.02em;line-height:1.1}
.hsub{font:400 15px/1.5 Inter;color:${T.ink2};max-width:300px;margin-top:12px}

.foot{display:flex;flex-direction:column;gap:22px}
.dots{display:flex;gap:7px;justify-content:center}
.dot{width:7px;height:7px;border-radius:50%;background:${T.panelhi}}
.dot.on{width:22px;border-radius:4px;background:${T.ink}}
.cta{background:${T.ink};color:${T.bg};border-radius:16px;padding:17px;text-align:center;font:600 16px Inter}

/* mini waste wall */
.wall{display:flex;flex-wrap:wrap;gap:5px;width:230px;justify-content:center}
.wall i{width:15px;height:15px;border-radius:3px}
.wall i.e{box-shadow:inset 0 0 0 1px rgba(224,145,60,.20)}
.wall i.f{background:${T.waste}}
.bignum{font:600 60px Inter}
.budget{font:600 11px Inter;letter-spacing:.05em;text-transform:uppercase;color:${T.waste};margin-top:12px}

/* shield */
.shield{width:96px;height:96px;border-radius:50%;background:${T.greenSoft};display:flex;align-items:center;justify-content:center}
.toggle{display:flex;background:${T.surface};border-radius:14px;padding:4px;gap:4px;width:230px;margin-top:22px}
.toggle .o{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:11px;padding:11px;font:600 14px Inter;color:${T.ink2}}
.toggle .o.on{background:${T.green};color:${T.bg}}

/* mini nudge card */
.nudge{width:250px;background:${T.surface};border:1px solid ${T.hair};border-radius:22px;padding:16px;box-shadow:0 20px 44px rgba(0,0,0,.4);text-align:left}
.nudge img{width:100%;height:104px;object-fit:cover;border-radius:14px;display:block}
.nudge .tag{display:inline-block;margin-top:12px;font:600 9.5px Inter;letter-spacing:.09em;text-transform:uppercase;color:${T.waste};background:rgba(224,145,60,.14);border-radius:999px;padding:4px 9px}
.nudge h5{font:600 18px Inter;letter-spacing:-.01em;margin-top:9px}
.nudge .b{display:block;text-align:center;border-radius:12px;padding:11px;margin-top:12px;font:600 13px Inter;background:${T.ink};color:${T.bg}}
.nudge .g{display:block;text-align:center;color:${T.faint};font:500 12.5px Inter;padding:7px 0 2px}

/* pill + widget row for "everywhere" hint */
.everywhere{display:flex;gap:12px;margin-top:20px}
.mini{background:${T.surface};border:1px solid ${T.hair};border-radius:14px;padding:11px 13px;display:flex;align-items:center;gap:9px;font:600 12.5px Inter;color:${T.ink2}}
.mini .rd{width:16px;height:16px;border-radius:50%;border:3px solid ${T.waste};border-right-color:transparent;transform:rotate(-45deg)}

/* setup steps */
.setuphead{text-align:left;width:100%}
.setuptitle{font:600 27px Inter;letter-spacing:-.02em}
.setupsub{font:400 14px/1.5 Inter;color:${T.ink2};margin-top:10px}
.steps{width:100%;margin-top:8px}
.step{display:flex;gap:15px;padding:22px 0;border-top:1px solid ${T.hair}}
.step:last-child{border-bottom:1px solid ${T.hair}}
.stepn{width:26px;height:26px;border-radius:50%;border:1.5px solid ${T.hair};flex:none;display:flex;align-items:center;justify-content:center;font:600 13px Inter;color:${T.ink2};margin-top:1px}
.stepn.done{background:${T.green};border-color:${T.green};color:${T.bg}}
.step h4{font:600 16px Inter}
.step p{font:400 13px/1.45 Inter;color:${T.ink2};margin-top:6px}
.step .ok{font:600 12.5px Inter;color:${T.green};margin-top:11px}
.step .go{display:inline-block;font:600 13.5px Inter;color:${T.ink};margin-top:11px}

/* mini widget + pill for the "everywhere" screen */
.mwidget{width:250px;background:linear-gradient(180deg,#1A1A18,#141413);border:1px solid ${T.hair};border-radius:20px;padding:18px;text-align:left}
.mwbrand{font:700 10px Inter;letter-spacing:.16em;color:${T.ink2}}
.mwtime{margin-top:7px;font:700 30px Inter}
.mwtime .mwt{font:400 12px Inter;color:${T.ink2};letter-spacing:0}
.mwlim{font:700 10px Inter;letter-spacing:.04em;color:${T.waste};margin-top:5px}
.mwcounts{font:400 13px Inter;color:${T.ink2};margin-top:11px}
.mpill{display:inline-flex;align-items:center;gap:10px;background:rgba(26,26,24,.96);border:1px solid ${T.hair};
  border-radius:20px;padding:9px 16px 9px 12px;margin-top:16px;box-shadow:0 8px 20px rgba(0,0,0,.4)}
.mpill .r{width:24px;height:24px;display:block}
.mpill .l{font:700 14px Inter;color:#fff}
</style>`;

const shieldSvg = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const swSvg = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const check = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg>`;
function ring(frac, color, track) {
  const R = 40, C = 2 * Math.PI * R, off = C * (1 - Math.min(frac, 1));
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${track}" stroke-width="13"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/></svg>`;
}

function wall(fill, total) {
  let s = "";
  for (let i = 0; i < total; i++) s += `<i class="${i < fill ? "f" : "e"}"></i>`;
  return `<div class="wall">${s}</div>`;
}
function dots(active) {
  return `<div class="dots">${[0,1,2,3,4,5].map((i)=>`<span class="dot ${i===active?"on":""}"></span>`).join("")}</div>`;
}
function frame(idx, brandRight, hero, cta) {
  return `<div class="scr">
    <div class="head"><div class="brand"><span class="dot"></span>Doomguard</div>${brandRight}</div>
    <div class="hero">${hero}</div>
    <div class="foot">${dots(idx)}<div class="cta">${cta}</div></div>
  </div>`;
}
const skip = `<span class="skip">Skip</span>`;

const welcome = frame(0, "", `
  <div class="art">${wall(28, 48)}</div>
  <div><div class="htitle">Your scroll,<br>on the clock.</div>
    <div class="hsub">Doomguard times the Reels and Shorts eating your day, and helps you stop.</div></div>
`, "Get started");

const timeIt = frame(1, skip, `
  <div class="art">
    <div class="bignum num" style="color:${T.waste}">23<span style="font-size:20px;color:${T.faint}"> min</span></div>
    <div style="margin-top:18px">${wall(23, 60)}</div>
    <div class="budget">37 min left of your 60-min limit</div>
  </div>
  <div><div class="htitle">See it stack up.</div>
    <div class="hsub">Every wasted minute fills a daily limit you set. Cross it and it turns red.</div></div>
`, "Next");

const blockIt = frame(2, skip, `
  <div class="art">
    <div class="shield">${shieldSvg(T.green, 44)}</div>
    <div class="toggle"><div class="o">${swSvg(T.ink2)}Guilt</div><div class="o on">${shieldSvg(T.bg,15)}Block</div></div>
  </div>
  <div><div class="htitle">Or block it cold.</div>
    <div class="hsub">Block mode backs you out of every reel and short the instant it appears.</div></div>
`, "Next");

const nudgeIt = frame(3, skip, `
  <div class="art">
    <div class="nudge">
      <img src="https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=420&q=70"/>
      <span class="tag">30 min today</span>
      <h5>Half an hour, gone.</h5>
      <span class="b">Watch a cat instead</span>
      <span class="g">Keep scrolling</span>
    </div>
  </div>
  <div><div class="htitle">A nudge to look away.</div>
    <div class="hsub">Spiraling? Doomguard interrupts with a nudge, and a cat to watch instead of the feed.</div></div>
`, "Next");

const everywhere = frame(4, skip, `
  <div class="art">
    <div class="mwidget">
      <div class="mwbrand">DOOMGUARD</div>
      <div class="mwtime"><span style="color:${T.waste}">23m</span> <span class="mwt">wasted today</span></div>
      <div class="mwlim">37 min left of your limit</div>
      <div class="mwcounts">14 reels &nbsp;&nbsp; 7 shorts</div>
    </div>
    <div class="mpill"><span class="r">${ring(0.38, T.waste, "rgba(224,145,60,0.26)")}</span><span class="l">23 min scrolling</span></div>
  </div>
  <div><div class="htitle">Always in sight.</div>
    <div class="hsub">A floating timer while you scroll, and a home-screen widget, so the damage is never hidden.</div></div>
`, "Next");

const setup = `<div class="scr">
  <div class="head"><div class="brand"><span class="dot" style="background:${T.faint}"></span>Doomguard</div></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div class="setuphead">
      <div class="setuptitle">Two quick permissions.</div>
      <div class="setupsub">This is how Doomguard sees Reels and floats the timer. It only reads Instagram and YouTube, nothing else, and your data stays on this device.</div>
    </div>
    <div class="steps">
      <div class="step"><span class="stepn done">${check(T.bg)}</span>
        <div><h4>Draw over other apps</h4><p>Lets the timer float on top of Instagram.</p><div class="ok">✓ Enabled</div></div></div>
      <div class="step"><span class="stepn">2</span>
        <div><h4>Accessibility service</h4><p>Find “Doomguard Reel Counter” and turn it on. This is how it knows when you're watching Reels.</p><div class="go">Open settings ›</div></div></div>
    </div>
  </div>
  <div class="foot">${dots(5)}<div class="cta" style="opacity:.5">Finish setup</div></div>
</div>`;

const screens = { welcome, timeIt, blockIt, nudgeIt, everywhere, setup };
const order = ["welcome", "timeIt", "blockIt", "nudgeIt", "everywhere", "setup"];
const caps = { welcome:"1 · Welcome", timeIt:"2 · Time it", blockIt:"3 · Block it", nudgeIt:"4 · Nudge it", everywhere:"5 · Everywhere", setup:"6 · Setup" };

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;gap:30px 30px;padding:44px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
${order.map((n)=>`<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);
console.log("Wrote", order.length + 1, "files to", OUT);
