/*
 * "Quiet" redesign preview — a minimal, low-noise direction for Unhook.
 * Near-monochrome, one typeface (Inter), generous whitespace, no rings/
 * gradients/heat scales/heavy cards. A single accent (green) appears only where
 * it carries meaning: system-on, blocked/safe, done, improving.
 *
 *   node design-previews/gen-quiet.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1500,3050 --virtual-time-budget=6000 \
 *     --screenshot=design-previews/out-quiet/board.png design-previews/out-quiet/board.html
 *
 * Real copy/data preserved 1:1 from the app; only the visual language changes.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out-quiet-dark");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C",        // near-black canvas (warm neutral)
  surface: "#1A1A18",   // subtle grouped fill (no border, no shadow)
  ink: "#F2F1EC",       // primary (warm off-white)
  ink2: "#9A9A92",      // secondary
  faint: "#62625B",     // tertiary / labels
  hair: "rgba(242,241,236,0.10)",
  accent: "#38C786",    // semantic only: on / safe / done / improving
  accentSoft: "rgba(56,199,134,0.14)",
};

const HEAD = `
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
:root{
  --bg:${T.bg}; --surface:${T.surface}; --ink:${T.ink}; --ink2:${T.ink2};
  --faint:${T.faint}; --hair:${T.hair}; --acc:${T.accent}; --accSoft:${T.accentSoft};
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#242422;font-family:"Inter",system-ui,sans-serif;color:var(--ink);
  -webkit-font-smoothing:antialiased}
.num{font-variant-numeric:tabular-nums;letter-spacing:-.02em}

.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;
  background:var(--bg);box-shadow:0 30px 70px rgba(40,40,36,.22),0 0 0 10px #16160f,0 0 0 12px #2c2c25}
.scr{position:relative;height:100%;display:flex;flex-direction:column;padding:62px 26px 28px}
.cap{width:390px;text-align:center;margin-top:16px;color:#b9b9b2;
  font:600 12.5px "Inter";letter-spacing:.13em;text-transform:uppercase}

/* top bar */
.topbar{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:9px;font:600 16px "Inter";letter-spacing:-.01em}
.brand .dot{width:7px;height:7px;border-radius:50%;background:var(--acc)}
.icon{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.kicker{font:600 12px "Inter";letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}

/* hero number */
.hero{margin-top:56px}
.bignum{font:600 96px "Inter";line-height:.86;letter-spacing:-.04em}
.bignum .u{font:500 28px "Inter";color:var(--faint);letter-spacing:-.01em;margin-left:6px}
.herolabel{font:400 16px "Inter";color:var(--ink2);margin-top:14px}
.counts{font:400 15px "Inter";color:var(--ink2);margin-top:6px}
.counts b{color:var(--ink);font-weight:600}

/* thin baseline track */
.track{height:3px;border-radius:2px;background:#262623;margin-top:34px;position:relative;overflow:hidden}
.track i{display:block;height:100%;background:var(--ink);border-radius:2px}
.track .m{position:absolute;top:-3px;bottom:-3px;width:1.5px;background:var(--faint)}

/* vibe line */
.vibe{margin-top:30px}
.vibe-t{font:600 20px "Inter";letter-spacing:-.01em}
.vibe-s{font:400 15px/1.45 "Inter";color:var(--ink2);margin-top:5px;max-width:280px}

/* buttons */
.actions{margin-top:auto;display:flex;flex-direction:column;gap:11px}
.btn{display:flex;align-items:center;justify-content:center;gap:9px;border-radius:15px;
  padding:16px;font:600 15.5px "Inter"}
.btn.primary{background:var(--ink);color:var(--bg)}
.btn.subtle{background:var(--surface);color:var(--ink)}
.btn.ghost{background:transparent;color:var(--faint);font-weight:500}
.btn.acc{background:var(--acc);color:#fff}

/* row link */
.rowlink{display:flex;align-items:center;justify-content:space-between;padding:17px 2px;
  border-top:1px solid var(--hair);font:500 15.5px "Inter"}
.rowlink .r{color:var(--faint)}

/* mode segmented */
.mode{margin-top:30px}
.seg{display:flex;background:var(--surface);border-radius:14px;padding:4px;gap:4px}
.seg .o{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;
  padding:12px;font:600 14.5px "Inter";color:var(--ink2)}
.seg .o.on{background:#2C2C29;color:var(--ink);box-shadow:none}
.seg .o.on.safe{background:var(--acc);color:#fff;box-shadow:none}
.modehint{font:400 13.5px/1.4 "Inter";color:var(--ink2);margin-top:12px}

/* footnote */
.foot{font:400 12.5px/1.5 "Inter";color:var(--faint);margin-top:24px}
.foot b{color:var(--ink2);font-weight:500}

/* block state */
.blockmark{margin-top:64px;display:flex;flex-direction:column;gap:18px}
.checkc{width:64px;height:64px;border-radius:50%;background:var(--accSoft);
  display:flex;align-items:center;justify-content:center}
.blocktitle{font:600 30px "Inter";letter-spacing:-.02em}
.blocksub{font:400 15px/1.45 "Inter";color:var(--ink2);max-width:290px}
.kbig{font:600 15px "Inter"}

/* onboarding steps */
.steps{margin-top:48px;display:flex;flex-direction:column}
.step{display:flex;gap:16px;padding:26px 0;border-top:1px solid var(--hair)}
.step:last-child{border-bottom:1px solid var(--hair)}
.stepn{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--hair);flex:none;
  display:flex;align-items:center;justify-content:center;font:600 13px "Inter";color:var(--ink2);margin-top:1px}
.stepn.done{background:var(--acc);border-color:var(--acc);color:#fff}
.step h3{font:600 16.5px "Inter"}
.step p{font:400 13.5px/1.5 "Inter";color:var(--ink2);margin-top:7px}
.step .link{font:600 14px "Inter";color:var(--ink);margin-top:13px;display:inline-flex;align-items:center;gap:6px}
.step .ok{font:600 13px "Inter";color:var(--acc);margin-top:13px;display:inline-flex;align-items:center;gap:6px}

/* history */
.h-title{font:600 26px "Inter";letter-spacing:-.02em;margin-top:4px}
.statrow{display:flex;margin-top:30px}
.stat{flex:1}
.stat+.stat{border-left:1px solid var(--hair);padding-left:18px}
.stat .k{font:600 11px "Inter";letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}
.stat .v{font:600 26px "Inter";letter-spacing:-.02em;margin-top:8px}
.busiest{font:400 13.5px "Inter";color:var(--ink2);margin-top:24px}
.busiest b{color:var(--ink);font-weight:600}
.chart{display:flex;align-items:flex-end;gap:12px;height:160px;margin-top:14px}
.bar{flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;height:100%;justify-content:flex-end}
.bar .col{width:54%;border-radius:3px;background:var(--ink);min-height:3px}
.bar.dim .col{background:#3A3A35}
.bar .d{font:500 11.5px "Inter";color:var(--faint)}
.note{font:400 12.5px/1.5 "Inter";color:var(--faint);margin-top:30px;padding-top:20px;border-top:1px solid var(--hair)}

/* overlay / modal */
.reelbg{position:absolute;inset:0;background:radial-gradient(120% 80% at 30% 20%,#23202c 0%,#0b0b0e 60%)}
.scrim{position:absolute;inset:0;background:rgba(8,8,10,.55);display:flex;align-items:flex-end;padding:18px}
.sheet{width:100%;background:#1A1A18;border:1px solid rgba(242,241,236,0.08);border-radius:28px;padding:26px;display:flex;flex-direction:column;gap:18px}
.sheet .catpic{width:64px;height:64px;border-radius:18px;object-fit:cover}
.sheet h4{font:600 24px "Inter";letter-spacing:-.02em}
.sheet p{font:400 14.5px/1.5 "Inter";color:var(--ink2);margin-top:8px}
.sheet .ovk{font:600 12px "Inter";letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}

/* gallery */
.galhead{display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:26px}
.grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:20px}
</style>`;

const gear = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.6 1.6 1.6 0 01-3.2 0 1.6 1.6 0 00-2.7-.6l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 004.6 15a1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1A1.6 1.6 0 004.6 9a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.1a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/></svg>`;
const back = () => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M15 18l-6-6 6-6"/></svg>`;
const chev = () => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg>`;
const closeI = () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const check = (c, s) => `<svg width="${s||16}" height="${s||16}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.4"><path d="M5 12l5 5L20 6"/></svg>`;
const swIcon = (c) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const shIcon = (c) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/></svg>`;
const CAT = "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=240&q=70";

const FOOT = `<div class="foot">Unhook only reads Instagram &amp; YouTube's screen, <b>nothing else</b>. Your count lives only on this device.</div>`;
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));

function modeSwitch(active, hint) {
  return `<div class="mode">
    <div class="seg">
      <div class="o ${active==="guilt"?"on":""}">${swIcon(active==="guilt"?T.ink:T.ink2)}Guilt</div>
      <div class="o safe ${active==="block"?"on":""}">${shIcon(active==="block"?"#fff":T.ink2)}Block</div>
    </div>
    <div class="modehint">${hint}</div>
  </div>`;
}

const screens = {};

function dashboard({ minutes, reels, shorts, vibeT, vibeS }) {
  const frac = clamp((minutes - 10) / 40, 0.03, 1);
  return `
<div class="scr">
  <div class="topbar">
    <div class="brand"><span class="dot"></span>Unhook</div>
    <span class="icon">${gear()}</span>
  </div>

  <div class="hero">
    <div class="kicker">Time wasted · today</div>
    <div class="bignum num" style="margin-top:18px">${minutes}<span class="u">min</span></div>
    <div class="herolabel">doomscrolling so far</div>
    <div class="counts"><b class="num">${reels}</b> reels &nbsp;·&nbsp; <b class="num">${shorts}</b> shorts</div>
    <div class="track"><i style="width:${Math.round(frac*100)}%"></i><span class="m" style="left:75%"></span></div>
  </div>

  <div class="vibe">
    <div class="vibe-t">${vibeT}</div>
    <div class="vibe-s">${vibeS}</div>
  </div>

  ${modeSwitch("guilt", "Guilt — watch all you want, the clock keeps time.")}

  <div class="actions">
    <div class="btn subtle">Cats, not reels</div>
    <div class="rowlink">View history <span class="r">${chev()}</span></div>
  </div>
</div>`;
}

screens.guilt = dashboard({ minutes:23, reels:14, shorts:7, vibeT:"Time's slipping.", vibeS:"That's a real chunk of today. Stretch?" });
screens.guiltHeavy = dashboard({ minutes:95, reels:61, shorts:28, vibeT:"Where'd the day go?", vibeS:"Over an hour scrolling. Outside. Now." });

screens.block = `
<div class="scr">
  <div class="topbar">
    <div class="brand"><span class="dot"></span>Unhook</div>
    <span class="icon">${gear()}</span>
  </div>

  <div class="blockmark">
    <div class="checkc">${shIcon(T.accent)}</div>
    <div>
      <div class="kicker">Block · armed</div>
      <div class="blocktitle" style="margin-top:12px">Reels can't reach you.</div>
      <div class="blocksub" style="margin-top:10px">New reels and shorts get bounced the instant they appear — so today's tally stops climbing.</div>
    </div>
    <div class="counts" style="margin-top:6px"><b class="num">14</b> reels &nbsp;·&nbsp; <b class="num">7</b> shorts <span style="color:var(--faint)">logged today</span></div>
  </div>

  ${modeSwitch("block", "Block — Unhook backs you out of every reel and short.")}

  <div class="actions">
    <div class="btn subtle">Cats, not reels</div>
    <div class="rowlink">View history <span class="r">${chev()}</span></div>
  </div>
</div>`;

screens.onboarding = `
<div class="scr">
  <div class="topbar">
    <div class="brand"><span class="dot"></span>Unhook</div>
  </div>
  <div style="margin-top:40px">
    <div class="kicker">Setup · 1 of 2</div>
    <div class="blocktitle" style="margin-top:14px;font-size:27px">Two quick permissions.</div>
    <div class="blocksub" style="margin-top:10px">Unhook times the reels and shorts you watch each day.</div>
  </div>

  <div class="steps">
    <div class="step">
      <span class="stepn done">${check("#fff",15)}</span>
      <div>
        <h3>Allow drawing over apps</h3>
        <p>Lets the counter float on top of Instagram.</p>
        <span class="ok">${check(T.accent,14)} Enabled</span>
      </div>
    </div>
    <div class="step">
      <span class="stepn">2</span>
      <div>
        <h3>Enable the accessibility service</h3>
        <p>Find “Unhook Reel Counter” in the list and turn it on. This is how the app knows when you're watching Reels.</p>
        <span class="link">Open accessibility settings ${chev()}</span>
      </div>
    </div>
  </div>

  ${FOOT}
</div>`;

const week = [
  { d:"M", m:18, dim:false }, { d:"T", m:42 }, { d:"W", m:9 }, { d:"T", m:67 },
  { d:"F", m:95 }, { d:"S", m:51 }, { d:"S", m:23 },
];
const maxM = 100;
screens.history = `
<div class="scr">
  <div class="topbar">
    <span class="icon" style="margin-left:-8px">${back()}</span>
    <span></span>
  </div>
  <div class="h-title">History</div>

  <div class="seg" style="margin-top:22px">
    <div class="o on">7 days</div><div class="o">30 days</div><div class="o">All</div>
  </div>
  <div class="seg" style="margin-top:10px">
    <div class="o on">Time</div><div class="o">Count</div>
  </div>

  <div class="statrow">
    <div class="stat"><div class="k">Total</div><div class="v num">5h 5m</div></div>
    <div class="stat"><div class="k">Daily avg</div><div class="v num">44m</div></div>
    <div class="stat"><div class="k">Trend</div><div class="v num" style="color:var(--acc)">−18%</div></div>
  </div>
  <div class="busiest">Busiest day &nbsp;<b>Jun 27</b> · 1h 35m</div>

  <div class="chart">
    ${week.map((x) => `<div class="bar ${x.m<15?"dim":""}"><div class="col" style="height:${Math.max(Math.round(x.m/maxM*100),3)}%"></div><div class="d">${x.d}</div></div>`).join("")}
  </div>

  <div class="note">History starts the day you updated the app. It fills in one day at a time and lives only on this device.</div>
</div>`;

screens.nudge = `
<div class="reelbg"></div>
<div class="scrim">
  <div class="sheet">
    <div style="display:flex;align-items:center;gap:14px">
      <img class="catpic" src="https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=200&q=70"/>
      <div class="ovk">30 min today</div>
    </div>
    <div><h4>Half an hour, gone.</h4>
      <p>That's a real chunk of your day, disappeared into the feed.</p></div>
    <div class="btn primary">Watch a cat instead</div>
    <div class="btn ghost">I know, keep scrolling</div>
  </div>
</div>`;

screens.modal = `
<div class="scr" style="filter:blur(3px);opacity:.5">
  <div class="topbar"><div class="brand"><span class="dot"></span>Unhook</div></div>
  <div class="blockmark"><div class="checkc"></div><div class="blocktitle">Reels can't reach you.</div></div>
</div>
<div class="scrim">
  <div class="sheet">
    <div class="ovk">Leaving block mode</div>
    <div><h4>Going soft already?</h4>
      <p>You're in Block mode and the reels can't touch you. Switch back and you're choosing to feed the addiction. Why not just push through?</p></div>
    <div class="btn acc">Keep blocking</div>
    <div class="btn ghost">I'll give in</div>
  </div>
</div>`;

const cats = [
  "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=520&q=70",
  "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=520&q=70",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=520&q=70",
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=520&q=70",
];
screens.cats = `
<div class="scr">
  <div class="galhead">
    <div><div class="h-title" style="margin-top:0">Cats, not reels</div>
      <div class="blocksub" style="margin-top:8px">Rest your eyes on something better.</div></div>
    <span class="icon">${closeI()}</span>
  </div>
  <div class="grid">${cats.map((c)=>`<img src="${c}"/>`).join("")}</div>
</div>`;

const order = ["onboarding", "guilt", "guiltHeavy", "block", "history", "nudge", "modal", "cats"];
const captions = {
  onboarding:"Onboarding", guilt:"Dashboard — Guilt", guiltHeavy:"Dashboard — Guilt (heavy)",
  block:"Block mode", history:"History", nudge:"In-the-moment nudge", modal:"Push-through modal", cats:"Cats, not reels",
};

for (const name of order) {
  const html = `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px;background:#242422">
    <div class="phone">${screens[name]}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, `${name}.html`), html);
}
const board = `<!doctype html><html><head>${HEAD}</head>
<body style="display:flex;flex-wrap:wrap;gap:30px 34px;padding:48px;align-items:flex-start;justify-content:center;background:#242422">
${order.map((n)=>`<div style="display:flex;flex-direction:column;align-items:center">
  <div class="phone">${screens[n]}</div><div class="cap">${captions[n]}</div></div>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(OUT, "board.html"), board);
console.log("Wrote", order.length + 1, "files to", OUT);
