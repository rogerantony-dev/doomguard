/*
 * Preview harness: renders each Wilt screen as a fixed-size phone mockup so
 * the redesign can be screenshotted headlessly (no device needed). HTML/CSS here
 * mirrors the intended React Native styling 1:1 (NativeWind = Tailwind tokens),
 * so what you see is what the app will look like.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });

// --- Design tokens ----------------------------------------------------------
const T = {
  ink: "#08080A",
  ink2: "#0C0C10",
  panel: "#141419",
  panelHi: "#1B1B22",
  hairline: "rgba(244,241,234,0.09)",
  bone: "#F4F1EA",
  ash: "#9C9CA6",
  dim: "#5C5C66",
  ember: "#19E3FF",
  emberDeep: "#0BB6D6",
  amber: "#F5A524",
  toxic: "#3DDC84",
  toxicDeep: "#0F3A24",
};

const HEAD = `
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
<style>
:root{
  --ink:${T.ink}; --ink2:${T.ink2}; --panel:${T.panel}; --panelHi:${T.panelHi};
  --hair:${T.hairline}; --bone:${T.bone}; --ash:${T.ash}; --dim:${T.dim};
  --ember:${T.ember}; --emberDeep:${T.emberDeep}; --amber:${T.amber};
  --toxic:${T.toxic}; --toxicDeep:${T.toxicDeep};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#202024;display:flex;flex-wrap:wrap;gap:34px;padding:40px;
  font-family:"Space Grotesk",system-ui,sans-serif}
.phone{width:390px;height:844px;border-radius:46px;overflow:hidden;position:relative;
  background:var(--ink);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 10px #111114,0 0 0 12px #2a2a30;
  color:var(--bone)}
/* texture: ember halo + scanlines */
.phone::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:5;
  background:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0 2px,rgba(0,0,0,.16) 2px 3px)}
.glow{position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(120% 60% at 50% -8%, rgba(25,227,255,.20), transparent 60%)}
.glow.tox{background:radial-gradient(120% 60% at 50% -8%, rgba(61,220,132,.16), transparent 60%)}
.scr{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;
  padding:54px 22px 26px}
.cap{width:390px;text-align:center;margin-top:14px;color:#cfcfd6;
  font:600 13px "Space Mono",monospace;letter-spacing:.16em;text-transform:uppercase}

/* status strip */
.statusbar{display:flex;align-items:center;justify-content:space-between;
  font:700 11px "Space Mono",monospace;letter-spacing:.22em;color:var(--dim);
  text-transform:uppercase;padding-bottom:18px;border-bottom:1px solid var(--hair)}
.led{display:inline-flex;align-items:center;gap:8px}
.led b{width:8px;height:8px;border-radius:50%;background:var(--ember);
  box-shadow:0 0 10px 2px rgba(25,227,255,.7)}
.led.tox b{background:var(--toxic);box-shadow:0 0 10px 2px rgba(61,220,132,.6)}
.brandrow{margin-top:18px}
.wordmark{font:700 38px "Space Grotesk";letter-spacing:-.02em;line-height:1}
.wordmark .g{color:var(--ember)}
.subtag{margin-top:8px;color:var(--ash);font:400 14px "Space Grotesk";line-height:1.35}

/* generic instrument card */
.card{position:relative;background:linear-gradient(180deg,var(--panel),var(--ink2));
  border:1px solid var(--hair);border-radius:22px;padding:22px}
.card .tick{position:absolute;width:12px;height:12px;border:2px solid rgba(244,241,234,.22)}
.tick.tl{top:9px;left:9px;border-right:0;border-bottom:0}
.tick.tr{top:9px;right:9px;border-left:0;border-bottom:0}
.tick.bl{bottom:9px;left:9px;border-right:0;border-top:0}
.tick.br{bottom:9px;right:9px;border-left:0;border-top:0}
.label{font:700 11px "Space Mono",monospace;letter-spacing:.22em;text-transform:uppercase;color:var(--dim)}
.section{display:flex;align-items:center;gap:12px;color:var(--dim);
  font:700 11px "Space Mono",monospace;letter-spacing:.2em;text-transform:uppercase}
.section .line{flex:1;height:1px;background:var(--hair)}

/* hazard chevron strip */
.hazard{height:8px;border-radius:4px;
  background:repeating-linear-gradient(-45deg,var(--amber) 0 10px,#1a1406 10px 20px);opacity:.85}

/* big number readout */
.readout{display:flex;align-items:baseline;gap:10px;justify-content:center}
.readout .n{font:700 78px "Space Mono",monospace;line-height:.9;color:var(--bone);
  text-shadow:0 0 24px rgba(25,227,255,.30)}
.readout .u{font:400 15px "Space Grotesk";color:var(--ash)}
.meter{height:10px;border-radius:6px;background:#1c1c22;overflow:hidden;border:1px solid var(--hair);position:relative}
.meter i{display:block;height:100%;background:linear-gradient(90deg,#9BF7FF,var(--ember),var(--emberDeep))}
.meter .redline{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ash);opacity:.5}
.vibe-t{font:600 21px "Space Grotesk";text-align:center}
.vibe-s{font:400 13.5px "Space Grotesk";color:var(--ash);text-align:center;line-height:1.4}

/* ticker chips */
.chips{display:flex;gap:10px;justify-content:center}
.chip{display:flex;align-items:center;gap:9px;background:#16161c;border:1px solid var(--hair);
  border-radius:999px;padding:9px 15px;font:700 15px "Space Mono",monospace}
.chip .dot{width:9px;height:9px;border-radius:50%}
.chip small{color:var(--ash);font:400 12px "Space Grotesk";letter-spacing:.02em}

/* buttons */
.btn{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:16px;
  padding:16px;font:700 15px "Space Grotesk";letter-spacing:.01em}
.btn.cats{background:#7C3AED;border:none;color:#fff;font-weight:800;letter-spacing:.06em}
.btn.cats .lead{width:9px;height:9px;border-radius:50%;background:#fff;opacity:.95}
.btn.primary{background:linear-gradient(180deg,#48e58c,var(--toxic));color:#04140b}
.btn.ghost{color:var(--dim);font-weight:500}

/* mode switch */
.switch{display:flex;background:var(--ink2);border:1px solid var(--hair);border-radius:16px;padding:6px;gap:6px}
.opt{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;
  padding:13px;font:600 15px "Space Grotesk";color:var(--ash)}
.opt.on-guilt{background:var(--bone);color:#0a0a0c}
.opt.on-block{background:linear-gradient(180deg,#48e58c,var(--toxic));color:#04140b}
.opt .gi{width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.55}

/* setup step */
.step{position:relative;display:flex;flex-direction:column;gap:12px;background:linear-gradient(180deg,var(--panel),var(--ink2));
  border:1px solid var(--hair);border-radius:20px;padding:20px}
.step.done{border-color:rgba(61,220,132,.4);background:linear-gradient(180deg,rgba(15,58,36,.55),rgba(8,20,12,.4))}
.step .top{display:flex;align-items:center;gap:13px}
.badge{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font:700 14px "Space Mono",monospace;background:var(--bone);color:#0a0a0c}
.badge.ok{background:var(--toxic);color:#04140b}
.step h3{font:600 17px "Space Grotesk";flex:1}
.step p{font:400 13.5px "Space Grotesk";color:var(--ash);line-height:1.45}
.step .act{margin-top:2px;text-align:center;border-radius:13px;padding:13px;font:600 15px "Space Grotesk"}
.act.go{background:var(--bone);color:#0a0a0c}
.act.enabled{background:rgba(61,220,132,.14);color:var(--toxic);
  font:700 13px "Space Mono",monospace;letter-spacing:.16em;text-transform:uppercase}

/* footnote */
.foot{margin-top:auto;font:400 12.5px "Space Grotesk";color:var(--dim);line-height:1.5;
  border-top:1px solid var(--hair);padding-top:16px}
.foot b{color:var(--ash);font-weight:600}

/* shield */
.shield{width:118px;height:118px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle,rgba(61,220,132,.18),rgba(61,220,132,.04));border:1px solid rgba(61,220,132,.3)}
.shield svg{filter:drop-shadow(0 0 14px rgba(61,220,132,.5))}

/* modal */
.scrim{position:absolute;inset:0;z-index:8;background:rgba(4,4,6,.74);display:flex;align-items:center;justify-content:center;padding:26px}
.sheet{width:100%;background:linear-gradient(180deg,var(--panel),var(--ink2));border:1px solid var(--hair);
  border-radius:26px;padding:24px;display:flex;flex-direction:column;gap:18px;position:relative}
.flameicon{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle,rgba(245,165,36,.22),transparent)}

/* gallery */
.galhead{display:flex;justify-content:space-between;align-items:flex-start}
.x{width:38px;height:38px;border-radius:50%;background:#16161c;border:1px solid var(--hair);
  display:flex;align-items:center;justify-content:center;color:var(--ash);font:400 20px "Space Grotesk"}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:18px;border:1px solid var(--hair)}
</style>`;

// --- Stopwatch SVG (mirrors components/StopwatchGraphic.tsx) -----------------
function stopwatch(minutes, size) {
  const t = Math.min(1, Math.max(0, (minutes - 10) / 40));
  const brk = Math.min(1, Math.max(0, (minutes - 60) / 60));
  const angle = ((minutes % 60) / 60) * 360;
  const mix = (a, b, k) => Math.round(a + (b - a) * k);
  const lerp = (f, c, k) => `rgb(${mix(f[0], c[0], k)},${mix(f[1], c[1], k)},${mix(f[2], c[2], k)})`;
  const ring = lerp([150, 162, 173], [25, 227, 255], t);
  const face = lerp([238, 240, 243], [198, 246, 255], t);
  const hand = lerp([44, 48, 56], [11, 160, 190], t);
  const CX = 50, CY = 54, R = 34;
  const pt = (d, dist) => [CX + dist * Math.sin((d * Math.PI) / 180), CY - dist * Math.cos((d * Math.PI) / 180)];
  const bend = brk * 42;
  const tail = pt(angle + 180, 0.22 * R), midp = pt(angle, 0.42 * R), tip = pt(angle + bend, 0.8 * R);
  const ticks = Array.from({ length: 12 }, (_, i) => i * 30).map((deg) => {
    const major = deg % 90 === 0;
    const [x1, y1] = pt(deg, major ? 26 : 28.5);
    const [x2, y2] = pt(deg, 31);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join("");
  // Cracks spider out as it shatters past 60 min (mirrors StopwatchGraphic.tsx).
  const CRACKS = [
    { d: "M53,45 L51,55 L54,65 L50,77", at: 0.0 },
    { d: "M53,45 L45,42 L39,38 L31,37", at: 0.04 },
    { d: "M53,45 L61,47 L69,49 L77,51", at: 0.2 },
    { d: "M53,45 L46,53 L41,61 L33,67", at: 0.36 },
    { d: "M53,45 L59,55 L62,64 L69,71", at: 0.52 },
    { d: "M39,38 L46,53 L41,61", at: 0.64 },
    { d: "M61,47 L59,55 L62,64", at: 0.76 },
  ];
  const cracks = CRACKS.map((c) => {
    const op = Math.min(1, Math.max(0, (brk - c.at) / 0.12));
    if (op <= 0) return "";
    return `<g opacity="${op}"><path d="${c.d}" stroke="rgb(12,12,16)" stroke-width="2.2"/><path d="${c.d}" stroke="rgb(232,236,242)" stroke-width="0.7" opacity="0.7"/></g>`;
  }).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
    ${t > 0 ? `<circle cx="${CX}" cy="${CY}" r="44" fill="rgba(25,227,255,${0.22 * t})"/>` : ""}
    <g transform="rotate(${brk * 14} 50 11)"><path d="M45.5,6 h9 a2.5,2.5 0 0 1 2.5,2.5 v6.5 h-14 v-6.5 a2.5,2.5 0 0 1 2.5,-2.5 z" fill="${ring}"/></g>
    <line x1="72" y1="20" x2="80" y2="12" stroke="${ring}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="${face}"/>
    <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${ring}" stroke-width="5"/>
    <g stroke="${ring}" stroke-width="2" stroke-linecap="round">${ticks}</g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">${cracks}</g>
    <path d="M${tail[0]},${tail[1]} L${CX},${CY} L${midp[0]},${midp[1]} L${tip[0]},${tip[1]}" fill="none" stroke="${hand}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${CX}" cy="${CY}" r="4.5" fill="${hand}"/>
  </svg>`;
}

function statusbar(text, tox) {
  return `<div class="statusbar"><span class="led ${tox ? "tox" : ""}"><b></b>${tox ? "Block · Armed" : "Monitoring"}</span><span>DG-01 · LOCAL</span></div>`;
}

// --- Screens ----------------------------------------------------------------
const screens = {};

screens.guilt = `
<div class="glow"></div>
<div class="scr">
  ${statusbar("MONITORING")}
  <div class="brandrow"><div class="wordmark">DOOM<span class="g">GUARD</span></div>
    <div class="subtag">Your daily scroll habit, on the clock.</div></div>

  <div class="card" style="margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:16px">
    <span class="tick tl"></span><span class="tick tr"></span><span class="tick bl"></span><span class="tick br"></span>
    <div class="label" style="align-self:flex-start">// TIME WASTED · TODAY</div>
    ${stopwatch(23, 150)}
    <div class="readout"><span class="n">23</span><span class="u">mins<br>doomscrolling</span></div>
    <div class="meter" style="width:100%"><i style="width:34%"></i><span class="redline" style="left:75%"></span></div>
    <div class="chips">
      <div class="chip"><span class="dot" style="background:#E1306C"></span>14 <small>reels</small></div>
      <div class="chip"><span class="dot" style="background:#FF0000"></span>7 <small>shorts</small></div>
    </div>
    <div style="margin-top:2px"><div class="vibe-t">Time's slipping.</div>
      <div class="vibe-s">That's a real chunk of today. Stretch?</div></div>
  </div>

  <div class="btn cats" style="margin-top:18px"><span class="lead"></span>CATS, NOT REELS</div>

  <div style="margin-top:18px;display:flex;flex-direction:column;gap:12px">
    <div class="section"><span>MODE</span><span class="line"></span></div>
    <div class="switch">
      <div class="opt on-guilt"><span class="gi"></span>Guilt</div>
      <div class="opt"><span class="gi"></span>Block</div>
    </div>
  </div>

  <div class="foot">Wilt only reads Instagram &amp; YouTube's screen, <b>nothing else</b>, and your count lives only on this device.</div>
</div>`;

screens.block = `
<div class="glow tox"></div>
<div class="scr">
  ${statusbar("", true)}
  <div class="brandrow"><div class="wordmark">DOOM<span class="g" style="color:var(--toxic)">GUARD</span></div>
    <div class="subtag">Reels can't reach you.</div></div>

  <div class="card" style="margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:30px;padding-bottom:30px">
    <span class="tick tl"></span><span class="tick tr"></span><span class="tick bl"></span><span class="tick br"></span>
    <div class="label" style="align-self:flex-start;color:var(--toxic)">// PERIMETER · ACTIVE</div>
    <div class="shield"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${T.toxic}" stroke-width="1.8"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V5z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg></div>
    <div class="vibe-t" style="font-size:22px">Block mode engaged</div>
    <div class="readout"><span class="n" style="color:var(--toxic);text-shadow:0 0 24px rgba(61,220,132,.3)">0</span><span class="u">reels got<br>through today</span></div>
    <div class="vibe-s" style="max-width:240px">Reels and shorts get bounced the instant they appear. Nothing to count — you're not watching any.</div>
  </div>

  <div class="btn cats" style="margin-top:18px"><span class="lead"></span>CATS, NOT REELS</div>

  <div style="margin-top:18px;display:flex;flex-direction:column;gap:12px">
    <div class="section"><span>MODE</span><span class="line"></span></div>
    <div class="switch">
      <div class="opt"><span class="gi"></span>Guilt</div>
      <div class="opt on-block"><span class="gi"></span>Block</div>
    </div>
  </div>
  <div class="foot">Block mode backs you out of every reel and short the moment it loads.</div>
</div>`;

screens.onboarding = `
<div class="glow"></div>
<div class="scr">
  ${statusbar("MONITORING")}
  <div class="brandrow"><div class="wordmark">DOOM<span class="g">GUARD</span></div>
    <div class="subtag">Times the reels and shorts you watch each day.</div></div>

  <div class="hazard" style="margin-top:22px"></div>
  <div class="section" style="margin-top:18px"><span>SETUP · 1 OF 2 ARMED</span><span class="line"></span></div>

  <div class="step done" style="margin-top:16px">
    <div class="top"><span class="badge ok"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#04140b" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></span>
      <h3>Allow drawing over apps</h3></div>
    <p>Lets the counter pill float on top of Instagram.</p>
    <div class="act enabled">✓ Enabled</div>
  </div>

  <div class="step" style="margin-top:14px">
    <div class="top"><span class="badge">2</span><h3>Enable the accessibility service</h3></div>
    <p>Find "Wilt Reel Counter" in the list and turn it on. This is how the app knows when you're watching Reels.</p>
    <div class="act go">Open accessibility settings</div>
  </div>

  <div class="foot">Wilt only reads Instagram &amp; YouTube's screen, <b>nothing else</b>, and your count lives only on this device.</div>
</div>`;

screens.modal = `
<div class="glow"></div>
<div class="scr" style="filter:blur(1px);opacity:.5">
  ${statusbar("", true)}
  <div class="brandrow"><div class="wordmark">DOOM<span class="g" style="color:var(--toxic)">GUARD</span></div></div>
  <div class="card" style="margin-top:22px;height:300px"></div>
</div>
<div class="scrim">
  <div class="sheet">
    <span class="tick tl"></span><span class="tick tr"></span>
    <div class="flameicon"><svg width="30" height="30" viewBox="0 0 24 24" fill="${T.amber}"><path d="M12 2c1 3-2 4-2 7a2 2 0 104 0c2 2 3 4 3 6a5 5 0 11-10 0c0-4 4-6 5-13z"/></svg></div>
    <div><div style="font:700 23px 'Space Grotesk'">Going soft already?</div>
      <p style="margin-top:8px;font:400 14.5px 'Space Grotesk';color:var(--ash);line-height:1.5">You're in Block mode and the reels can't touch you. Switch back and you're choosing to feed the addiction. Why not just push through?</p></div>
    <div class="hazard"></div>
    <div class="btn primary">Keep blocking 🛡</div>
    <div class="btn ghost">I'll give in 😔</div>
  </div>
</div>`;

screens.cats = `
<div class="scr" style="padding:54px 20px 20px">
  <div class="galhead"><div><div style="font:700 24px 'Space Grotesk'">Cats, not reels</div>
    <div class="subtag" style="margin-top:4px">Rest your eyes on something better.</div></div>
    <div class="x">✕</div></div>
  <div class="grid">
    <img src="https://i.pinimg.com/736x/c0/78/08/c078082c4423cda6216a7b4627c6eb52.jpg"/>
    <img src="https://media.tenor.com/zCTU9e8SmVMAAAAM/1000-yard-stare-cat-meme.gif"/>
    <img src="https://cdn-useast1.kapwing.com/static/templates/crying-cat-meme-template-full-719a53dc.webp"/>
    <img src="https://media.tenor.com/47qpxBq_Tw0AAAAe/cat-cat-meme.png"/>
  </div>
</div>`;

// Heavy-usage state: the design's full dynamic range — cracked watch, redlined
// meter, alarm-red everything. Same markup as `guilt` with worse numbers.
screens.guiltHeavy = `
<div class="glow"></div>
<div class="scr">
  ${statusbar("MONITORING")}
  <div class="brandrow"><div class="wordmark">DOOM<span class="g">GUARD</span></div>
    <div class="subtag">Your daily scroll habit, on the clock.</div></div>

  <div class="card" style="margin-top:22px;display:flex;flex-direction:column;align-items:center;gap:16px;border-color:rgba(25,227,255,.35)">
    <span class="tick tl"></span><span class="tick tr"></span><span class="tick bl"></span><span class="tick br"></span>
    <div class="label" style="align-self:flex-start;color:var(--ember)">// TIME WASTED · TODAY · ALARM</div>
    ${stopwatch(95, 150)}
    <div class="readout"><span class="n" style="color:#d4f7ff">95</span><span class="u">mins<br>doomscrolling</span></div>
    <div class="meter" style="width:100%"><i style="width:100%"></i><span class="redline" style="left:75%"></span></div>
    <div class="chips">
      <div class="chip"><span class="dot" style="background:#E1306C"></span>61 <small>reels</small></div>
      <div class="chip"><span class="dot" style="background:#FF0000"></span>28 <small>shorts</small></div>
    </div>
    <div style="margin-top:2px"><div class="vibe-t" style="color:#5fe0ff">Where'd the day go?</div>
      <div class="vibe-s">Over an hour scrolling. Outside. Now.</div></div>
  </div>

  <div class="btn cats" style="margin-top:18px"><span class="lead"></span>CATS, NOT REELS</div>
  <div style="margin-top:18px;display:flex;flex-direction:column;gap:12px">
    <div class="section"><span>MODE</span><span class="line"></span></div>
    <div class="switch"><div class="opt on-guilt"><span class="gi"></span>Guilt</div><div class="opt"><span class="gi"></span>Block</div></div>
  </div>
</div>`;

// --- Emit -------------------------------------------------------------------
const order = ["onboarding", "guilt", "guiltHeavy", "block", "modal", "cats"];
const captions = {
  onboarding: "Onboarding / Setup",
  guilt: "Dashboard — Guilt (light)",
  guiltHeavy: "Dashboard — Guilt (redlined)",
  block: "Dashboard — Block mode",
  modal: "Push-through modal",
  cats: "Cats, not reels",
};

for (const name of order) {
  const html = `<!doctype html><html><head>${HEAD}</head><body style="padding:0;background:#202024">
    <div class="phone">${screens[name]}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
}

// Board: all phones in a row with captions, fixed size for deterministic shot.
const board = `<!doctype html><html><head>${HEAD}</head>
<body style="padding:46px;gap:30px;align-items:flex-start;background:#202024">
${order.map((n) => `<div style="display:flex;flex-direction:column;align-items:center">
  <div class="phone" style="transform:scale(.92);transform-origin:top">${screens[n]}</div>
  <div class="cap">${captions[n]}</div></div>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(OUT, "board.html"), board);

console.log("Wrote", order.length + 1, "files to", OUT);
