/*
 * "Clarity" redesign preview — a calm, premium, editorial LIGHT direction for
 * Wilt (counterpoint to the shipped dark "Hazard Console" theme).
 *
 * Emits fixed-size phone mockups so the whole app can be screenshotted headlessly:
 *   node design-previews/gen-clarity.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1480,2000 --virtual-time-budget=6000 \
 *     --screenshot=design-previews/out-clarity/board.png \
 *     design-previews/out-clarity/board.html
 *
 * Real copy/data is preserved 1:1 from App.tsx / HistoryScreen.tsx / the nudge
 * overlay, so only the visual language changes.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out-clarity");
fs.mkdirSync(OUT, { recursive: true });

// --- Design tokens ----------------------------------------------------------
// 60 = warm paper canvas · 30 = ink · 10 = marigold signal (heats to terracotta).
const T = {
  paper: "#F4F0E8",     // app canvas (warm off-white)
  card: "#FFFFFF",      // raised surfaces
  cardSoft: "#FBF8F2",  // recessed / secondary surfaces
  ink: "#1B1712",       // primary text / dark elements
  ink2: "#5E564B",      // secondary text
  faint: "#9C9488",     // tertiary / labels
  hairline: "rgba(27,23,18,0.08)",
  hairline2: "rgba(27,23,18,0.14)",
  // signal scale (calm -> warning -> alarm)
  sage: "#4F9E72",
  marigold: "#E2913C",
  marigoldDeep: "#C9772A",
  terracotta: "#D2542F",
  // "secured / block" identity
  green: "#1E7A57",
  greenSoft: "#E2EFE7",
  // brand source-of-truth dots
  igPink: "#E1306C",
  ytRed: "#FF2D2D",
};

const HEAD = `
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root{
  --paper:${T.paper}; --card:${T.card}; --cardSoft:${T.cardSoft};
  --ink:${T.ink}; --ink2:${T.ink2}; --faint:${T.faint};
  --hair:${T.hairline}; --hair2:${T.hairline2};
  --sage:${T.sage}; --marigold:${T.marigold}; --marigoldDeep:${T.marigoldDeep};
  --terra:${T.terracotta}; --green:${T.green}; --greenSoft:${T.greenSoft};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#dcd7cc;font-family:"Inter",system-ui,sans-serif;color:var(--ink)}
.serif{font-family:"Instrument Serif",Georgia,serif;font-weight:400;letter-spacing:.01em}

.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;
  background:var(--paper);
  box-shadow:0 40px 90px rgba(54,46,34,.35),0 0 0 11px #15120e,0 0 0 13px #34302a}
/* soft warm wash from the top */
.phone::before{content:"";position:absolute;left:0;right:0;top:0;height:280px;pointer-events:none;z-index:0;
  background:radial-gradient(120% 100% at 50% -20%, rgba(226,145,60,.14), transparent 62%)}
.phone.secured::before{background:radial-gradient(120% 100% at 50% -20%, rgba(30,122,87,.14), transparent 62%)}
.scr{position:relative;z-index:2;height:100%;display:flex;flex-direction:column;
  padding:60px 22px 26px}

/* board caption */
.cap{width:390px;text-align:center;margin-top:16px;color:#4a443b;
  font:600 12.5px "Inter";letter-spacing:.14em;text-transform:uppercase}

/* ---- top bar ---- */
.topbar{display:flex;align-items:center;justify-content:space-between}
.pillstatus{display:inline-flex;align-items:center;gap:8px;background:var(--card);
  border:1px solid var(--hair);border-radius:999px;padding:7px 13px 7px 11px;
  font:600 11.5px "Inter";letter-spacing:.04em;color:var(--ink2);
  box-shadow:0 1px 2px rgba(54,46,34,.05)}
.pillstatus b{width:8px;height:8px;border-radius:50%;background:var(--marigold);
  box-shadow:0 0 0 4px rgba(226,145,60,.16)}
.pillstatus.sec b{background:var(--green);box-shadow:0 0 0 4px rgba(30,122,87,.16)}
.iconbtn{width:40px;height:40px;border-radius:50%;background:var(--card);border:1px solid var(--hair);
  display:flex;align-items:center;justify-content:center;color:var(--ink2);
  box-shadow:0 1px 2px rgba(54,46,34,.05)}

/* ---- wordmark ---- */
.brand{margin-top:22px}
.kicker{font:600 11px "Inter";letter-spacing:.22em;text-transform:uppercase;color:var(--faint)}
.wordmark{font-size:34px;line-height:1.04;letter-spacing:-.01em;margin-top:7px;color:var(--ink)}
.wordmark .g{font-style:italic;color:var(--marigold)}
.secured .wordmark .g{color:var(--green)}
.subtag{margin-top:9px;color:var(--ink2);font:400 14.5px/1.4 "Inter";max-width:300px}

/* ---- card ---- */
.card{position:relative;background:var(--card);border:1px solid var(--hair);
  border-radius:30px;padding:26px;box-shadow:0 18px 40px rgba(54,46,34,.10),0 2px 6px rgba(54,46,34,.05)}
.label{font:600 11px "Inter";letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}

/* ---- hero ring ---- */
.hero{display:flex;flex-direction:column;align-items:center;gap:20px;margin-top:22px}
.ringwrap{position:relative;width:200px;height:200px}
.ringwrap .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.bignum{font-size:84px;line-height:.8;letter-spacing:-.01em}
.bigunit{font:500 13px "Inter";letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:8px}

/* meter */
.meter{width:100%;height:9px;border-radius:6px;background:#ece6da;position:relative;overflow:visible}
.meter i{display:block;height:100%;border-radius:6px}
.meter .red{position:absolute;top:-4px;bottom:-4px;width:2px;border-radius:2px;background:var(--ink2);opacity:.35}

/* count chips */
.chips{display:flex;gap:10px}
.chip{display:flex;align-items:center;gap:9px;background:var(--cardSoft);border:1px solid var(--hair);
  border-radius:999px;padding:9px 15px}
.chip .dot{width:9px;height:9px;border-radius:50%}
.chip .v{font:700 15px "Inter";color:var(--ink)}
.chip small{color:var(--ink2);font:500 12.5px "Inter"}

/* vibe */
.vibe-t{font-size:27px;line-height:1.05;text-align:center;color:var(--ink)}
.vibe-s{font:400 14px/1.4 "Inter";color:var(--ink2);text-align:center;max-width:260px}

/* ---- buttons ---- */
.btn{display:flex;align-items:center;justify-content:center;gap:10px;border-radius:18px;
  padding:17px;font:600 15.5px "Inter";letter-spacing:.01em}
.btn.primary{background:var(--marigold);color:#2a1a08;
  box-shadow:0 10px 22px rgba(226,145,60,.32),inset 0 1px 0 rgba(255,255,255,.4)}
.btn.green{background:var(--green);color:#eafff5;
  box-shadow:0 10px 22px rgba(30,122,87,.30),inset 0 1px 0 rgba(255,255,255,.18)}
.btn.cats{background:#FFFFFF;border:1px solid var(--hair2);color:var(--ink);
  box-shadow:0 8px 20px rgba(54,46,34,.08)}
.btn.cats .av{width:26px;height:26px;border-radius:50%;object-fit:cover;margin-right:2px;
  border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}
.btn.outline{background:transparent;border:1px solid var(--hair2);color:var(--ink)}
.btn.ghost{background:transparent;color:var(--faint);font-weight:500}

/* ---- mode switch ---- */
.section{display:flex;align-items:center;gap:14px;color:var(--faint);
  font:600 11px "Inter";letter-spacing:.18em;text-transform:uppercase}
.section .line{flex:1;height:1px;background:var(--hair2)}
.switch{display:flex;background:#ece6da;border-radius:18px;padding:5px;gap:5px}
.opt{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;border-radius:14px;
  padding:14px;font:600 15px "Inter";color:var(--ink2)}
.opt.on{background:#fff;color:var(--ink);box-shadow:0 2px 6px rgba(54,46,34,.12)}
.opt.on.block{background:var(--green);color:#eafff5;box-shadow:0 6px 14px rgba(30,122,87,.28)}
.hint{font:400 13px/1.4 "Inter";color:var(--ink2);padding:0 2px}

/* ---- footnote ---- */
.foot{margin-top:auto;font:400 12.5px/1.5 "Inter";color:var(--faint);
  border-top:1px solid var(--hair);padding-top:16px}
.foot b{color:var(--ink2);font-weight:600}

/* ---- setup steps ---- */
.steps{display:flex;flex-direction:column;gap:14px;margin-top:20px}
.step{background:var(--card);border:1px solid var(--hair);border-radius:24px;padding:22px;
  box-shadow:0 10px 26px rgba(54,46,34,.07)}
.step.done{background:var(--greenSoft);border-color:rgba(30,122,87,.22);box-shadow:none}
.step .top{display:flex;align-items:center;gap:13px}
.badge{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font:700 14px "Inter";background:var(--ink);color:var(--paper);flex:none}
.badge.ok{background:var(--green);color:#fff}
.step h3{font:600 17px "Inter";flex:1;color:var(--ink)}
.step p{font:400 13.5px/1.5 "Inter";color:var(--ink2);margin-top:11px}
.step .act{margin-top:16px;text-align:center;border-radius:14px;padding:14px;
  background:var(--ink);color:var(--paper);font:600 14.5px "Inter"}
.step .act.enabled{background:transparent;color:var(--green);font:700 12px "Inter";
  letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:8px}
.progress{display:flex;gap:8px;margin-top:18px}
.progress span{flex:1;height:5px;border-radius:3px;background:var(--hair2)}
.progress span.on{background:var(--green)}

/* ---- history ---- */
.h-head{display:flex;align-items:center;gap:12px;margin-top:4px}
.h-title{font-size:30px;line-height:1;color:var(--ink)}
.seg{display:flex;background:#ece6da;border-radius:16px;padding:5px;gap:5px;margin-top:18px}
.seg .s{flex:1;text-align:center;border-radius:11px;padding:10px;font:600 13.5px "Inter";color:var(--ink2)}
.seg .s.on{background:#fff;color:var(--ink);box-shadow:0 2px 6px rgba(54,46,34,.1)}
.stats{display:flex;gap:12px;margin-top:16px}
.stat{flex:1;background:var(--card);border:1px solid var(--hair);border-radius:20px;padding:16px 14px;
  box-shadow:0 8px 20px rgba(54,46,34,.06)}
.stat .k{font:600 10.5px "Inter";letter-spacing:.1em;text-transform:uppercase;color:var(--faint)}
.stat .v{font-size:30px;line-height:1;margin-top:8px}
.busiest{font:400 13px "Inter";color:var(--ink2);margin-top:14px;padding:0 2px}
.busiest b{color:var(--ink);font-weight:600}
.chart{display:flex;align-items:flex-end;gap:10px;height:184px;margin-top:18px;padding:0 2px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:9px;height:100%;justify-content:flex-end}
.bar .col{width:62%;border-radius:6px 6px 3px 3px;min-height:3px}
.bar .d{font:500 11px "Inter";color:var(--faint)}
.legend{display:flex;justify-content:center;gap:22px;margin-top:16px}
.legend span{display:flex;align-items:center;gap:8px;font:500 12.5px "Inter";color:var(--ink2)}
.legend i{width:9px;height:9px;border-radius:50%}

/* ---- overlay / modal (over a reel) ---- */
.reelbg{position:absolute;inset:0;z-index:1;
  background:radial-gradient(120% 80% at 30% 20%,#2c2740 0%,#0c0c10 60%),linear-gradient(180deg,#161620,#05050a)}
.scrim{position:absolute;inset:0;z-index:6;background:rgba(12,9,6,.62);
  display:flex;align-items:center;justify-content:center;padding:24px}
.sheet{width:100%;background:var(--card);border-radius:28px;padding:22px;display:flex;flex-direction:column;gap:16px;
  box-shadow:0 30px 70px rgba(0,0,0,.5)}
.sheet .catpic{width:100%;height:150px;object-fit:cover;border-radius:18px}
.sheet .ov-label{align-self:flex-start;font:600 10.5px "Inter";letter-spacing:.12em;text-transform:uppercase;
  color:var(--marigoldDeep);background:rgba(226,145,60,.14);border-radius:999px;padding:5px 11px}
.sheet h4{font-size:28px;line-height:1.02;color:var(--ink)}
.sheet p{font:400 14px/1.45 "Inter";color:var(--ink2)}
.warnicon{width:54px;height:54px;border-radius:16px;display:flex;align-items:center;justify-content:center;
  background:rgba(226,145,60,.14)}

/* ---- gallery ---- */
.galhead{display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:22px;border:1px solid var(--hair)}
</style>`;

// --- helpers ----------------------------------------------------------------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const redness = (m) => clamp((m - 10) / 40, 0, 1);

function mix(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
// sage (calm) -> marigold (warning) -> terracotta (alarm)
function heat(t) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? mix(T.sage, T.marigold, t / 0.5) : mix(T.marigold, T.terracotta, (t - 0.5) / 0.5);
}

/** Progress ring: an arc that fills + heats with intensity, big serif value inside. */
function ring(intensity, value, unit, color) {
  const R = 86, C = 2 * Math.PI * R, frac = clamp(intensity, 0, 1);
  const off = C * (1 - frac);
  const col = color || heat(intensity);
  return `<div class="ringwrap">
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="#ece6da" stroke-width="11"/>
      <circle cx="100" cy="100" r="${R}" fill="none" stroke="${col}" stroke-width="11"
        stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}"
        transform="rotate(-90 100 100)"/>
    </svg>
    <div class="center"><div class="serif bignum" style="color:${col}">${value}</div>
      <div class="bigunit">${unit}</div></div>
  </div>`;
}

function topbar(secured, withBack) {
  const status = secured
    ? `<span class="pillstatus sec"><b></b>Block · Armed</span>`
    : `<span class="pillstatus"><b></b>Monitoring</span>`;
  const right = `<span class="iconbtn">${gear()}</span>`;
  return `<div class="topbar">${status}${right}</div>`;
}
const gear = () => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.6 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.6l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004.6 15a1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>`;
const back = () => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;
const CAT = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=200&q=70";

function chips(reels, shorts) {
  return `<div class="chips">
    <div class="chip"><span class="dot" style="background:${T.igPink}"></span><span class="v">${reels}</span><small>reels</small></div>
    <div class="chip"><span class="dot" style="background:${T.ytRed}"></span><span class="v">${shorts}</span><small>shorts</small></div>
  </div>`;
}
function modeSwitch(active, hint) {
  return `<div style="display:flex;flex-direction:column;gap:13px">
    <div class="section"><span>Mode</span><span class="line"></span></div>
    <div class="switch">
      <div class="opt ${active === "guilt" ? "on" : ""}">${stopwatchIcon(active === "guilt" ? T.ink : T.ink2)}Guilt</div>
      <div class="opt block ${active === "block" ? "on" : ""}">${shieldIcon(active === "block" ? "#eafff5" : T.ink2)}Block</div>
    </div>
    <div class="hint">${hint}</div>
  </div>`;
}
const stopwatchIcon = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6M12 5V2"/></svg>`;
const shieldIcon = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M9 12l2 2 4-4"/></svg>`;
const catsBtn = `<div class="btn cats"><img class="av" src="${CAT}"/>Cats, not reels</div>`;
const footPrivacy = `<div class="foot">Wilt only reads Instagram &amp; YouTube's screen, <b>nothing else</b>, and your count lives only on this device.</div>`;

// --- Screens ----------------------------------------------------------------
const screens = {};

function dashboard({ minutes, reels, shorts, vibeT, vibeS }) {
  const t = redness(minutes);
  return `
<div class="scr">
  ${topbar(false)}
  <div class="brand">
    <div class="kicker">Today</div>
    <div class="serif wordmark">Doom<span class="g">guard</span></div>
    <div class="subtag">Your daily scroll habit, on the clock.</div>
  </div>

  <div class="card hero" style="margin-top:22px">
    <div class="label" style="align-self:flex-start">Time wasted · today</div>
    ${ring(t, minutes, minutes === 1 ? "minute" : "minutes")}
    <div class="meter"><i style="width:${Math.round(clamp(t,0.04,1)*100)}%;background:linear-gradient(90deg,${T.sage},${heat(t)})"></i><span class="red" style="left:75%"></span></div>
    ${chips(reels, shorts)}
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:2px">
      <div class="serif vibe-t">${vibeT}</div>
      <div class="vibe-s">${vibeS}</div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:13px;margin-top:18px">
    ${catsBtn}
    <div class="btn outline">${barIcon()}View history</div>
  </div>

  <div style="margin-top:20px">${modeSwitch("guilt", "Guilt. Watch all you want — the clock keeps time.")}</div>
  ${footPrivacy}
</div>`;
}
const barIcon = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`;

screens.guilt = dashboard({
  minutes: 23, reels: 14, shorts: 7,
  vibeT: "Time's slipping.", vibeS: "That's a real chunk of today. Stretch?",
});

screens.guiltHeavy = dashboard({
  minutes: 95, reels: 61, shorts: 28,
  vibeT: "Where'd the day go?", vibeS: "Over an hour scrolling. Outside. Now.",
});

screens.block = `
<div class="scr">
  ${topbar(true)}
  <div class="brand">
    <div class="kicker">Secured</div>
    <div class="serif wordmark">Doom<span class="g">guard</span></div>
    <div class="subtag">Reels can't reach you.</div>
  </div>

  <div class="card hero" style="margin-top:22px;padding-top:30px;padding-bottom:30px">
    <div class="label" style="align-self:flex-start;color:${T.green}">Perimeter · active</div>
    <div class="ringwrap">
      <svg width="200" height="200" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="86" fill="none" stroke="${T.greenSoft}" stroke-width="11"/>
        <circle cx="100" cy="100" r="86" fill="none" stroke="${T.green}" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${2*Math.PI*86}" stroke-dashoffset="0" transform="rotate(-90 100 100)"/>
      </svg>
      <div class="center">
        <svg width="58" height="58" viewBox="0 0 24 24" fill="none" stroke="${T.green}" stroke-width="1.7"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>
      </div>
    </div>
    <div class="serif vibe-t" style="font-size:29px">Block mode engaged</div>
    <div class="vibe-s" style="max-width:268px">Reels and shorts get bounced the instant they appear — so today's tally stops climbing.</div>
    ${chips(14, 7)}
  </div>

  <div style="display:flex;flex-direction:column;gap:13px;margin-top:18px">
    ${catsBtn}
    <div class="btn outline">${barIcon()}View history</div>
  </div>

  <div style="margin-top:20px">${modeSwitch("block", "Block (pro). Wilt backs you out of every reel and short.")}</div>
  ${footPrivacy}
</div>`;

screens.onboarding = `
<div class="scr">
  ${topbar(false)}
  <div class="brand">
    <div class="kicker">Setup · 1 of 2 armed</div>
    <div class="serif wordmark">Doom<span class="g">guard</span></div>
    <div class="subtag">Times the reels and shorts you watch each day.</div>
  </div>
  <div class="progress"><span class="on"></span><span></span></div>

  <div class="steps">
    <div class="step done">
      <div class="top"><span class="badge ok"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 12l5 5L20 6"/></svg></span>
        <h3>Allow drawing over apps</h3></div>
      <p>Lets the counter pill float on top of Instagram.</p>
      <div class="act enabled"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${T.green}" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>Enabled</div>
    </div>
    <div class="step">
      <div class="top"><span class="badge">2</span><h3>Enable the accessibility service</h3></div>
      <p>Find “Wilt Reel Counter” in the list and turn it on. This is how the app knows when you're watching Reels.</p>
      <div class="act">Open accessibility settings</div>
    </div>
  </div>
  ${footPrivacy}
</div>`;

// History — bars use the same heat scale; sample week of minutes.
const week = [
  { d: "M", m: 18 }, { d: "T", m: 42 }, { d: "W", m: 9 }, { d: "T", m: 67 },
  { d: "F", m: 95 }, { d: "S", m: 51 }, { d: "S", m: 23 },
];
const maxM = 100;
screens.history = `
<div class="scr" style="padding-top:54px">
  <div class="h-head">
    <span class="iconbtn">${back()}</span>
    <div class="serif h-title">History</div>
  </div>

  <div class="seg"><div class="s on">7 days</div><div class="s">30 days</div><div class="s">All</div></div>
  <div class="seg" style="margin-top:12px"><div class="s on">Time</div><div class="s">Count</div></div>

  <div class="stats">
    <div class="stat"><div class="k">Total</div><div class="serif v">5h 5m</div></div>
    <div class="stat"><div class="k">Daily avg</div><div class="serif v">44m</div></div>
    <div class="stat"><div class="k">Trend</div><div class="serif v" style="color:${T.green}">−18%</div></div>
  </div>
  <div class="busiest">Busiest day: <b>2026-06-27</b> · 1h 35m</div>

  <div class="card" style="margin-top:18px;padding:22px 18px">
    <div class="label">Minutes per day</div>
    <div class="chart">
      ${week.map((x) => {
        const h = Math.round((x.m / maxM) * 100);
        return `<div class="bar"><div class="col" style="height:${Math.max(h,3)}%;background:${heat(redness(x.m))}"></div><div class="d">${x.d}</div></div>`;
      }).join("")}
    </div>
    <div style="text-align:center;font:400 12px 'Inter';color:var(--faint);margin-top:6px">Reels + shorts combined — they share one timer.</div>
  </div>

  <div class="section" style="margin-top:22px"><span>Note</span><span class="line"></span></div>
  <div style="font:400 12.5px/1.5 'Inter';color:var(--faint);margin-top:12px;padding:0 2px">History starts the day you updated the app — earlier days weren't recorded. It fills in one day at a time and lives only on this device.</div>
</div>`;

// Nudge overlay — floats over a reel (the in-the-moment intervention).
screens.nudge = `
<div class="reelbg"></div>
<div class="scrim">
  <div class="sheet">
    <span class="ov-label">// 30 min today</span>
    <img class="catpic" src="https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=520&q=70"/>
    <div><div class="serif" style="font-size:28px;line-height:1.02">Half an hour, gone.</div>
      <p style="margin-top:9px">That's a real chunk of your day, disappeared into the feed.</p></div>
    <div class="btn primary">Watch a cat instead</div>
    <div class="btn ghost">I know, keep scrolling</div>
  </div>
</div>`;

// Push-through modal — leaving Block mode.
screens.modal = `
<div class="scr" style="filter:blur(2px);opacity:.45">
  ${topbar(true)}
  <div class="brand"><div class="serif wordmark">Doom<span class="g">guard</span></div></div>
  <div class="card" style="margin-top:22px;height:320px"></div>
</div>
<div class="scrim">
  <div class="sheet">
    <div class="warnicon"><svg width="28" height="28" viewBox="0 0 24 24" fill="${T.marigold}"><path d="M12 2c1 3-2 4-2 7a2 2 0 104 0c2 2 3 4 3 6a5 5 0 11-10 0c0-4 4-6 5-13z"/></svg></div>
    <div><div class="serif" style="font-size:30px;line-height:1.02">Going soft already?</div>
      <p style="margin-top:10px">You're in Block mode and the reels can't touch you. Switch back and you're choosing to feed the addiction. Why not just push through?</p></div>
    <div class="btn green">Keep blocking</div>
    <div class="btn ghost">I'll give in</div>
  </div>
</div>`;

// Cats gallery
const cats = [
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=520&q=70",
  "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=520&q=70",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=520&q=70",
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=520&q=70",
];
screens.cats = `
<div class="scr" style="padding-top:54px">
  <div class="galhead">
    <div><div class="serif" style="font-size:30px;line-height:1">Cats, not reels</div>
      <div class="subtag" style="margin-top:6px">Rest your eyes on something better.</div></div>
    <span class="iconbtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
  </div>
  <div class="grid">${cats.map((c) => `<img src="${c}"/>`).join("")}</div>
</div>`;

// --- Emit -------------------------------------------------------------------
const order = ["onboarding", "guilt", "guiltHeavy", "block", "history", "nudge", "modal", "cats"];
const captions = {
  onboarding: "Onboarding / Setup",
  guilt: "Dashboard — Guilt (calm)",
  guiltHeavy: "Dashboard — Guilt (heavy)",
  block: "Dashboard — Block mode",
  history: "History",
  nudge: "In-the-moment nudge",
  modal: "Push-through modal",
  cats: "Cats, not reels",
};
const secured = new Set(["block", "modal"]);

for (const name of order) {
  const cls = secured.has(name) ? "phone secured" : "phone";
  const html = `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px;background:#dcd7cc">
    <div class="${cls}">${screens[name]}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
}

const board = `<!doctype html><html><head>${HEAD}</head>
<body style="display:flex;flex-wrap:wrap;gap:30px 34px;padding:48px;align-items:flex-start;justify-content:center;background:#dcd7cc">
${order.map((n) => `<div style="display:flex;flex-direction:column;align-items:center">
  <div class="${secured.has(n) ? "phone secured" : "phone"}">${screens[n]}</div>
  <div class="cap">${captions[n]}</div></div>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(OUT, "board.html"), board);

console.log("Wrote", order.length + 1, "files to", OUT);
