/*
 * "Auto-block at limit" flow mock. Four moments:
 *   1. Limit-reached alert (fires over the reel the instant you cross the limit)
 *   2. Auto-blocked dashboard (blocked for the rest of the day)
 *   3. Limit sheet with the new toggles (auto-block + strict)
 *   4. Switch-back escape (reversible, with friction)
 *
 *   node design-previews/gen-autoblock.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1840,1040 --virtual-time-budget=5000 \
 *     --screenshot=design-previews/out-autoblock/board.png design-previews/out-autoblock/board.html
 */
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "out-autoblock");
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
.reel{position:absolute;inset:0;background:radial-gradient(120% 80% at 30% 18%,#2b2740 0%,#0c0c10 62%),linear-gradient(180deg,#161620,#05050a)}

.brand{display:flex;align-items:center;gap:9px;font:600 16px Inter}
.brand .dot{width:7px;height:7px;border-radius:50%;background:${T.green}}
.limitchip{display:flex;align-items:center;gap:6px;background:${T.surface};border-radius:999px;padding:8px 13px;font:600 12.5px Inter;color:${T.ink2}}
.limitchip b{color:${T.ink};font-weight:600}
.toprow{display:flex;align-items:center;justify-content:space-between}

/* scrim + card (alert) */
.scrim{position:absolute;inset:0;background:rgba(8,8,10,.68);display:flex;align-items:center;justify-content:center;padding:24px;z-index:3}
.scrim.bottom{align-items:flex-end;padding:14px}
.card{width:100%;background:${T.surface};border:1px solid ${T.hair};border-radius:26px;padding:24px;box-shadow:0 30px 70px rgba(0,0,0,.5)}
.shieldc{width:64px;height:64px;border-radius:50%;background:${T.greenSoft};display:flex;align-items:center;justify-content:center}
.tag{display:inline-block;font:600 10.5px Inter;letter-spacing:.09em;text-transform:uppercase;color:${T.waste};background:rgba(224,145,60,.14);border-radius:999px;padding:5px 11px}
.card h4{font:600 25px Inter;letter-spacing:-.02em;margin-top:14px}
.card p{font:400 14.5px/1.5 Inter;color:${T.ink2};margin-top:9px}
.btn{display:block;text-align:center;border-radius:15px;padding:15px;margin-top:14px;font:600 15px Inter}
.btn.green{background:${T.green};color:${T.bg}}
.btn.ghost{color:${T.faint};font-weight:500;padding:9px}

/* dashboard (auto-blocked) */
.shieldbig{width:80px;height:80px;border-radius:50%;background:${T.greenSoft};display:flex;align-items:center;justify-content:center;margin-top:64px}
.kick{font:600 12px Inter;letter-spacing:.11em;text-transform:uppercase;color:${T.green};margin-top:24px}
.dtitle{font:600 32px Inter;letter-spacing:-.02em;margin-top:12px}
.dsub{font:400 15px/1.5 Inter;color:${T.ink2};margin-top:10px;max-width:300px}
.statline{display:flex;align-items:baseline;gap:12px;margin-top:24px}
.statline .n{font:600 34px Inter;color:${T.waste}}
.statline .l{font:400 14px Inter;color:${T.ink2}}
.reset{font:600 11px Inter;letter-spacing:.05em;text-transform:uppercase;color:${T.faint};margin-top:10px}
.seg{display:flex;background:${T.surface};border-radius:14px;padding:4px;gap:4px;margin-top:auto}
.seg .o{flex:1;display:flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:13px;font:600 14.5px Inter;color:${T.ink2}}
.seg .o.on{background:${T.green};color:${T.bg}}
.tray{display:flex;gap:11px;margin-top:12px}
.tray .b{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;background:${T.surface};border-radius:15px;padding:15px;font:600 15px Inter;color:${T.ink}}
.lock{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font:500 13px Inter;color:${T.faint}}

/* limit sheet */
.sheet{width:100%;background:${T.surface};border:1px solid ${T.hair};border-radius:26px;padding:24px}
.sheet h3{font:600 21px Inter;letter-spacing:-.01em}
.sheet .ssub{font:400 14px Inter;color:${T.ink2};margin-top:7px}
.optgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:18px}
.opt2{display:flex;align-items:center;justify-content:center;background:${T.bg};border:1px solid ${T.hair};border-radius:14px;padding:15px 0;font:600 16px Inter;color:${T.ink}}
.opt2.sel{background:rgba(224,145,60,0.14);border-color:${T.waste};color:${T.waste}}
.trow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 0;border-top:1px solid ${T.hair}}
.trow:first-of-type{margin-top:8px}
.trow h6{font:600 15px Inter}
.trow p{font:400 12.5px/1.4 Inter;color:${T.ink2};margin-top:3px;max-width:230px}
.sw{width:46px;height:27px;border-radius:999px;background:#3a3a35;position:relative;flex:none}
.sw.on{background:${T.green}}
.sw i{position:absolute;top:3px;left:3px;width:21px;height:21px;border-radius:50%;background:#fff;transition:none}
.sw.on i{left:22px}
.done{display:block;text-align:center;background:${T.ink};color:${T.bg};border-radius:15px;padding:15px;margin-top:20px;font:600 15px Inter}
.lockpill{display:flex;align-items:center;justify-content:center;gap:9px;background:${T.surface};border-radius:15px;padding:16px;font:600 14.5px Inter;color:${T.ink2};margin-top:auto}
.tray2{display:flex;gap:11px;margin-top:12px}
.tray2 .b{flex:1;display:flex;align-items:center;justify-content:center;gap:9px;background:${T.surface};border-radius:15px;padding:15px;font:600 15px Inter;color:${T.ink}}
.cover{position:absolute;inset:0;z-index:3;background:rgba(5,5,7,.93);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}
.lockbig{width:74px;height:74px;border-radius:50%;background:rgba(154,154,146,.12);display:flex;align-items:center;justify-content:center}
.ctitle{font:600 28px Inter;letter-spacing:-.02em;margin-top:22px}
.csub{font:400 15px/1.5 Inter;color:${T.ink2};margin-top:11px;max-width:280px}
.clock2{font:600 11px Inter;letter-spacing:.08em;text-transform:uppercase;color:${T.faint};margin-top:20px;display:flex;align-items:center;gap:7px}
</style>`;

const shield = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.7"><path d="M12 3l7 3v5c0 4.4-3 7.4-7 8-4-.6-7-3.6-7-8V6z"/><path d="M8.5 12l2.5 2.5 5-5.5"/></svg>`;
const sw = (c) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="1.9"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg>`;
const paw = (c) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${c}"><circle cx="6" cy="11" r="2.4"/><circle cx="11" cy="7.5" r="2.4"/><circle cx="17" cy="9.5" r="2.4"/><path d="M8 17c0-3 2.5-4.5 4.5-4.5S17 14 17 17s-2 3-4.5 3S8 20 8 17z"/></svg>`;
const chart = (c) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>`;
const lockI = (c, s = 14) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`;

const alert = `<div class="reel"></div>
<div class="scrim"><div class="card" style="text-align:center;display:flex;flex-direction:column;align-items:center">
  <div class="shieldc">${shield(T.green, 34)}</div>
  <span class="tag" style="margin-top:16px">60 min today</span>
  <h4>That's your limit.</h4>
  <p>You've spent an hour on reels today. Doomguard's putting the wall up. Reels are blocked until midnight.</p>
  <span class="btn green" style="align-self:stretch">Okay</span>
  <span class="btn ghost">Give me 5 more minutes</span>
</div></div>`;

const dashboard = `<div class="scr">
  <div class="toprow"><div class="brand"><span class="dot"></span>Doomguard</div>
    <div class="limitchip">Limit <b>1h</b> <span style="font-size:11px;color:${T.faint}">▾</span></div></div>
  <div class="shieldbig">${shield(T.green, 40)}</div>
  <div class="kick">Limit reached · blocked</div>
  <div class="dtitle">Walled off<br>till midnight.</div>
  <div class="dsub">You hit your 1h limit today. Every reel and short gets bounced for the rest of the day.</div>
  <div class="statline"><span class="n num">1h 04m</span><span class="l">wasted today</span></div>
  <div class="lockpill">${lockI(T.ink2)} Blocked · unlocks at midnight</div>
  <div class="tray2"><div class="b">${paw(T.ink)}Cats</div><div class="b">${chart(T.ink)}History</div></div>
</div>`;

const sheet = `<div class="scr" style="filter:blur(2px);opacity:.4">
  <div class="toprow"><div class="brand"><span class="dot"></span>Doomguard</div></div>
  <div class="shieldbig">${shield(T.green,40)}</div><div class="dtitle">Walled off.</div>
</div>
<div class="scrim bottom"><div class="sheet">
  <h3>Daily limit</h3>
  <div class="ssub">Cross it and Doomguard blocks the reels.</div>
  <div class="optgrid">
    ${[["15m",0],["30m",0],["45m",0],["1h",1],["1h 30",0],["2h",0]].map(([l,s])=>`<div class="opt2 ${s?"sel":""}">${l}</div>`).join("")}
  </div>
  <div class="trow"><div><h6>Block at limit</h6><p>Wall reels off once you hit your limit. Snooze 5 min at a time if you must.</p></div><div class="sw on"><i></i></div></div>
  <div class="trow"><div><h6 style="display:flex;align-items:center;gap:7px">Strict mode ${lockI(T.faint)}</h6><p>No snooze. Reels stay locked until midnight.</p></div><div class="sw"><i></i></div></div>
  <div class="done">Done</div>
</div></div>`;

const strictCover = `<div class="reel"></div>
<div class="cover">
  <div class="lockbig">${lockI(T.ink2, 30)}</div>
  <div class="ctitle">Locked till midnight.</div>
  <div class="csub">You hit your 1h limit and Strict mode is on. No snooze today, that's it for reels.</div>
  <div class="clock2">${lockI(T.faint)} Unlocks in 3h 48m</div>
</div>`;

const screens = { alert, dashboard, sheet, strictCover };
const order = ["alert", "dashboard", "sheet", "strictCover"];
const caps = { alert:"1 · Limit reached", dashboard:"2 · Auto-blocked", sheet:"3 · Settings", strictCover:"4 · Strict: locked" };

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="display:flex;justify-content:center;padding:40px"><div class="phone">${screens[n]}</div></body></html>`);
}
fs.writeFileSync(path.join(OUT, "board.html"),
  `<!doctype html><html><head>${HEAD}</head><body style="display:flex;gap:30px 32px;padding:44px;justify-content:center;align-items:flex-start;flex-wrap:wrap">
${order.map((n)=>`<div style="display:flex;flex-direction:column;align-items:center"><div class="phone">${screens[n]}</div><div class="cap">${caps[n]}</div></div>`).join("")}
</body></html>`);
console.log("Wrote", order.length + 1, "files to", OUT);
