/*
 * "Quiet" onboarding mock — the 4-screen first-run flow:
 *   1. Intro (Kit-Cat clock)  2. Presence (nudge + pill)
 *   3. How it works (mode + limit)  4. Permissions
 * Writes each screen, a board, and an interactive prototype.
 *
 *   node design-previews/gen-onboarding.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1340,1960 --virtual-time-budget=7000 \
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
const FUR = "#2A2A27", FACE = "#201F1D";
const C = { bone: "#F2F1EC", ash: "#9A9A92", dim: "#62625B", ink: "#0D0D0C" };
const AMBER = "#E0913C";

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
.brand .bdot{width:7px;height:7px;border-radius:50%;background:${T.green}}
.skip{font:600 13px Inter;color:${T.faint}}
.hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;text-align:center}
.art{display:flex;flex-direction:column;align-items:center;justify-content:center}
.htitle{font:600 30px Inter;letter-spacing:-.02em;line-height:1.1}
.hsub{font:400 15px/1.5 Inter;color:${T.ink2};max-width:320px;margin-top:12px}
.foot{display:flex;flex-direction:column;gap:22px}
.dots{display:flex;gap:7px;justify-content:center}
.dot{width:7px;height:7px;border-radius:50%;background:${T.panelhi}}
.dot.on{width:22px;border-radius:4px;background:${T.ink}}
.cta{background:${T.ink};color:${T.bg};border-radius:16px;padding:17px;text-align:center;font:600 16px Inter}
.readout{margin-top:14px;font:700 13px Inter;letter-spacing:1.2px;font-variant-numeric:tabular-nums}
.subcap{font:600 11px Inter;letter-spacing:.05em;text-transform:uppercase;color:${T.faint};margin-top:7px}
.modes{display:flex;background:${T.surface};border-radius:14px;padding:4px;gap:4px;width:250px;margin-top:26px}
.modes .o{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:11px;padding:11px;font:600 14px Inter;color:${T.ink2}}
/* nudge card */
.nudge{width:250px;background:${T.surface};border:1px solid ${T.hair};border-radius:22px;padding:16px;box-shadow:0 20px 44px rgba(0,0,0,.4);text-align:left}
.nudge img{width:100%;height:104px;object-fit:cover;border-radius:14px;display:block}
.nudge .tag{display:inline-block;margin-top:12px;font:600 9.5px Inter;letter-spacing:.09em;text-transform:uppercase;color:${T.waste};background:rgba(224,145,60,.14);border-radius:999px;padding:4px 9px}
.nudge h5{font:600 18px Inter;letter-spacing:-.01em;margin-top:9px}
.nudge .b{display:block;text-align:center;border-radius:12px;padding:11px;margin-top:12px;font:600 13px Inter;background:${T.ink};color:${T.bg}}
.nudge .g{display:block;text-align:center;color:${T.faint};font:500 12.5px Inter;padding:7px 0 2px}
/* widget + pill */
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
/* mode + limit (combined "how it works") */
.opts{display:flex;flex-direction:column;gap:11px;margin-top:20px}
.opt{display:flex;align-items:flex-start;gap:14px;padding:15px;border-radius:18px;border:1.5px solid ${T.hair};background:${T.surface}}
.opt.selg{border-color:${T.waste};background:rgba(224,145,60,.08)}
.opt .ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.opt .ic.g{background:rgba(224,145,60,.14)}
.opt .ic.b{background:rgba(56,199,134,.14)}
.opt h5{font:600 16px Inter}
.opt p{font:400 12.5px/1.4 Inter;color:${T.ink2};margin-top:3px}
.opt .rad{width:20px;height:20px;border-radius:50%;border:2px solid ${T.hair};flex:none;margin-top:2px;display:flex;align-items:center;justify-content:center}
.opt.selg .rad{border-color:${T.waste}}
.opt.selg .rad::after{content:"";width:10px;height:10px;border-radius:50%;background:${T.waste}}
.limhead{font:600 11px Inter;letter-spacing:.08em;text-transform:uppercase;color:${T.faint};margin:20px 0 0}
.optgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:11px}
.o2{display:flex;align-items:center;justify-content:center;background:${T.bg};border:1px solid ${T.hair};border-radius:13px;padding:12px 0;font:600 15px Inter;color:${T.ink}}
.o2.sel{background:rgba(224,145,60,0.14);border-color:${T.waste};color:${T.waste}}
.trow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid ${T.hair}}
.trow:first-of-type{margin-top:16px}
.trow h6{font:600 14.5px Inter}
.trow p{font:400 12px/1.4 Inter;color:${T.ink2};margin-top:3px;max-width:225px}
.sw{width:44px;height:26px;border-radius:999px;background:#3a3a35;position:relative;flex:none}
.sw.on{background:${T.green}}
.sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff}
.sw.on i{left:21px}
</style>`;

const swSvg = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const shieldSvg = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const check = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg>`;
function ring(frac, color, track) {
  const R = 40, Circ = 2 * Math.PI * R, off = Circ * (1 - Math.min(frac, 1));
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${track}" stroke-width="13"/>
    <circle cx="50" cy="50" r="${R}" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${Circ}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/></svg>`;
}
// Faithful still render of components/KitCatClock.tsx (centred/rest pose).
function catClock(color) {
  return `<svg width="158" height="192" viewBox="0 0 150 182">
    <path d="M50 30 L42 6 L70 26 Z" fill="${FUR}"/>
    <path d="M100 30 L108 6 L80 26 Z" fill="${FUR}"/>
    <circle cx="75" cy="46" r="32" fill="${FUR}"/>
    <ellipse cx="64" cy="42" rx="6" ry="8" fill="${C.bone}"/>
    <ellipse cx="86" cy="42" rx="6" ry="8" fill="${C.bone}"/>
    <circle cx="64" cy="44" r="2.6" fill="${C.ink}"/>
    <circle cx="86" cy="44" r="2.6" fill="${C.ink}"/>
    <path d="M71 58 L79 58 L75 62 Z" fill="${color}"/>
    <path d="M60 84 L75 74 L90 84 L75 90 Z" fill="${color}"/>
    <circle cx="75" cy="132" r="40" fill="${FACE}" stroke="${C.ash}" stroke-width="2.5"/>
    <line x1="75" y1="98" x2="75" y2="104" stroke="${C.dim}" stroke-width="2" stroke-linecap="round"/>
    <line x1="109" y1="132" x2="103" y2="132" stroke="${C.dim}" stroke-width="2" stroke-linecap="round"/>
    <line x1="75" y1="166" x2="75" y2="160" stroke="${C.dim}" stroke-width="2" stroke-linecap="round"/>
    <line x1="41" y1="132" x2="47" y2="132" stroke="${C.dim}" stroke-width="2" stroke-linecap="round"/>
    <line x1="75" y1="132" x2="75" y2="110" stroke="${C.bone}" stroke-width="3" stroke-linecap="round"/>
    <line x1="75" y1="132" x2="92" y2="139" stroke="${C.bone}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="75" cy="132" r="3.5" fill="${color}"/>
    <path d="M112 120 q24 8 20 44" stroke="${FUR}" stroke-width="7" stroke-linecap="round" fill="none"/>
  </svg>`;
}

const TOTAL = 4;
function dots(active) {
  return `<div class="dots">${Array.from({length: TOTAL}).map((_,i)=>`<span class="dot ${i===active?"on":""}"></span>`).join("")}</div>`;
}
function frame(idx, brandRight, hero, cta) {
  return `<div class="scr">
    <div class="head"><div class="brand"><span class="bdot"></span>Wilt</div>${brandRight}</div>
    <div class="hero">${hero}</div>
    <div class="foot">${dots(idx)}<div class="cta">${cta}</div></div>
  </div>`;
}
const skip = `<span class="skip">Skip</span>`;

const combined = frame(0, skip, `
  <div class="art">
    ${catClock(AMBER)}
    <div class="readout"><span style="color:${AMBER}">12 MIN</span><span style="color:${T.faint}"> LEFT</span></div>
    <div class="subcap">of your 30-min daily limit</div>
  </div>
  <div><div class="htitle">Your scroll,<br>on the clock.</div>
    <div class="hsub">Wilt puts your Reels and Shorts time on a clock that runs down as you scroll, and reddens when it's nearly gone. Or block them cold.</div></div>
`, "Get started");

const presence = frame(1, skip, `
  <div class="art">
    <div class="nudge">
      <img src="https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=420&q=70"/>
      <span class="tag">30 min today</span>
      <h5>Half an hour, gone.</h5>
      <span class="b">Watch a cat instead</span>
      <span class="g">Keep scrolling</span>
    </div>
    <div class="mpill"><span class="r">${ring(0.24, T.waste, "rgba(224,145,60,0.26)")}</span><span class="l">23 min scrolling</span></div>
  </div>
  <div><div class="htitle">Always with you.</div>
    <div class="hsub">A floating timer and home-screen widget keep the time in sight. And when you're spiraling, Wilt interrupts with a cat to watch instead of the feed.</div></div>
`, "Next");

const swBig = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const shBig = (c) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.8"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const lock = (c) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`;

const howItWorks = `<div class="scr">
  <div class="head"><div class="brand"><span class="bdot"></span>Wilt</div>${skip}</div>
  <div style="flex:1;display:flex;flex-direction:column;padding-top:6px">
    <div class="setuptitle">How should it work?</div>
    <div class="setupsub">Pick one. You can change it anytime.</div>
    <div class="opts">
      <div class="opt selg">
        <div class="ic g">${swBig(T.waste)}</div>
        <div style="flex:1"><h5>Guilt</h5><p>Time your scrolling. Block the reels once you hit a daily limit you set.</p></div>
        <div class="rad"></div>
      </div>
      <div class="opt">
        <div class="ic b">${shBig(T.green)}</div>
        <div style="flex:1"><h5>Block</h5><p>Wall off every reel and short, all day, from the moment you open the app.</p></div>
        <div class="rad"></div>
      </div>
    </div>
    <div class="limhead">Daily limit</div>
    <div class="optgrid">
      ${[["15m",0],["30m",1],["45m",0],["1h",0],["1h 30",0],["2h",0]].map(([l,s])=>`<div class="o2 ${s?"sel":""}">${l}</div>`).join("")}
    </div>
  </div>
  <div class="foot">${dots(2)}<div class="cta">Continue</div></div>
</div>`;

const setup = `<div class="scr">
  <div class="head"><div class="brand"><span class="bdot" style="background:${T.faint}"></span>Wilt</div></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">
    <div class="setuphead">
      <div class="setuptitle">Two quick permissions.</div>
      <div class="setupsub">This is how Wilt sees Reels and floats the timer. It only reads Instagram and YouTube, nothing else, and your data stays on this device.</div>
    </div>
    <div class="steps">
      <div class="step"><span class="stepn done">${check(T.bg)}</span>
        <div><h4>Draw over other apps</h4><p>Lets the timer float on top of Instagram.</p><div class="ok">✓ Enabled</div></div></div>
      <div class="step"><span class="stepn">2</span>
        <div><h4>Accessibility service</h4><p>Find “Wilt Reel Counter” and turn it on. This is how it knows when you're watching Reels.</p><div class="go">Open settings ›</div></div></div>
    </div>
  </div>
  <div class="foot">${dots(3)}<div class="cta" style="opacity:.5">Finish setup</div></div>
</div>`;

const screens = { combined, presence, howItWorks, setup };
const order = ["combined", "presence", "howItWorks", "setup"];
const caps = { combined:"1 · Intro", presence:"2 · Presence", howItWorks:"3 · How it works", setup:"4 · Permissions" };

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;gap:30px 30px;padding:44px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
${order.map((n)=>`<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);

// Single interactive route: one phone, all screens, Next/Skip/swipe/arrow-keys.
const track = order.map((n)=>`<div class="slide">${screens[n]}</div>`).join("");
fs.writeFileSync(path.join(OUT, "prototype.html"),
`<!doctype html><html><head>${HEAD}
<style>
.stage{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:40px}
.phone{cursor:grab}
.track{display:flex;height:100%;transition:transform .38s cubic-bezier(.4,0,.2,1)}
.slide{width:390px;height:100%;flex:none}
.hint{color:#7d7d76;font:600 12px Inter;letter-spacing:.08em;text-transform:uppercase}
.skip,.cta{cursor:pointer}
</style></head>
<body><div class="stage">
  <div class="phone"><div class="track" id="track">${track}</div></div>
  <div class="hint">Tap Next, swipe, or use ← → keys</div>
</div>
<script>
  var i=0, n=${order.length}, track=document.getElementById('track');
  function go(x){ i=Math.max(0,Math.min(n-1,x)); track.style.transform='translateX('+(-390*i)+'px)'; }
  document.querySelectorAll('.slide').forEach(function(s,idx){
    var cta=s.querySelector('.cta'); if(cta) cta.addEventListener('click',function(){ go(idx+1); });
    var sk=s.querySelector('.skip'); if(sk) sk.addEventListener('click',function(){ go(n-1); });
  });
  var sx=null, ph=document.querySelector('.phone');
  ph.addEventListener('pointerdown',function(e){ sx=e.clientX; });
  window.addEventListener('pointerup',function(e){ if(sx==null)return; var dx=e.clientX-sx; if(dx<-45)go(i+1); else if(dx>45)go(i-1); sx=null; });
  window.addEventListener('keydown',function(e){ if(e.key==='ArrowRight')go(i+1); if(e.key==='ArrowLeft')go(i-1); });
</script></body></html>`);
console.log("Wrote", order.length + 2, "files to", OUT);
