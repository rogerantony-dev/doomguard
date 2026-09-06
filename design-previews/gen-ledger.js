/*
 * Alternative direction: "Doomscroll Receipt". Wasted time rendered as an
 * itemized thermal-printer bill — a cream receipt slip on black, dashed tear
 * edges, oxblood stamps, a barcode. Guilt made literal. Screenshot-only concept
 * so the user can compare it against the Hazard Console direction.
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out-ledger");
fs.mkdirSync(OUT, { recursive: true });

const HEAD = `
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&display=swap" rel="stylesheet" />
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#202024;font-family:"JetBrains Mono",monospace}
.phone{width:390px;height:844px;border-radius:46px;overflow:hidden;position:relative;
  background:#0A0A0B;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 10px #111114,0 0 0 12px #2a2a30;color:#ECE7DB}
.phone::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:6;
  background:radial-gradient(120% 50% at 50% 0%,rgba(176,18,14,.16),transparent 55%)}
.scr{position:relative;z-index:2;height:100%;padding:46px 26px 26px;display:flex;flex-direction:column}
.cap{width:390px;text-align:center;margin-top:14px;color:#cfcfd6;font:600 13px "JetBrains Mono";letter-spacing:.16em;text-transform:uppercase}

/* brand line at top of phone (not the slip) */
.topbar{display:flex;justify-content:space-between;align-items:center;color:#6a6a60;
  font:700 11px "JetBrains Mono";letter-spacing:.2em;text-transform:uppercase;margin-bottom:18px}
.topbar .red{color:#FF4438}

/* the receipt slip */
.slip{background:#ECE7DB;color:#16140F;padding:26px 24px 20px;position:relative;
  box-shadow:0 18px 50px rgba(0,0,0,.55);
  background-image:repeating-linear-gradient(0deg,rgba(0,0,0,0) 0 26px,rgba(0,0,0,.025) 26px 27px)}
/* torn edges */
.slip::before,.slip::after{content:"";position:absolute;left:0;right:0;height:12px;
  background:repeating-linear-gradient(135deg,#ECE7DB 0 9px,transparent 9px 18px),
            repeating-linear-gradient(45deg,#ECE7DB 0 9px,transparent 9px 18px);
  background-size:18px 12px}
.slip::before{top:-11px}
.slip::after{bottom:-11px;transform:scaleY(-1)}

.r-center{text-align:center}
.r-brand{font:800 26px "JetBrains Mono";letter-spacing:.04em}
.r-reg{font-size:12px;vertical-align:super}
.r-sub{font:500 11px "JetBrains Mono";letter-spacing:.28em;text-transform:uppercase;color:#5b554a;margin-top:5px}
.r-meta{font:500 11px "JetBrains Mono";color:#6a6357;margin-top:10px;display:flex;justify-content:space-between}
.dash{border:0;border-top:2px dashed #16140F;opacity:.55;margin:14px 0}
.dot{border:0;border-top:2px dotted #16140F;opacity:.4;margin:12px 0}

.row{display:flex;justify-content:space-between;align-items:baseline;font:500 14px "JetBrains Mono";margin:9px 0}
.row .desc{letter-spacing:.02em}
.row .qty{color:#7a7264;font-size:12px}
.row .amt{font-weight:700;font-variant-numeric:tabular-nums}

.total{display:flex;justify-content:space-between;align-items:baseline;margin-top:6px}
.total .t-l{font:800 16px "JetBrains Mono";letter-spacing:.04em}
.total .t-r{font:800 34px "JetBrains Mono";font-variant-numeric:tabular-nums}

.stamp{position:absolute;left:20px;top:150px;transform:rotate(-12deg);
  border:3px solid #B0120E;color:#B0120E;border-radius:8px;padding:6px 12px 5px;
  font:800 17px "JetBrains Mono";letter-spacing:.06em;opacity:.82;
  box-shadow:inset 0 0 0 2px rgba(176,18,14,.25)}
.stamp.ok{border-color:#1C7A45;color:#1C7A45;box-shadow:inset 0 0 0 2px rgba(28,122,69,.25)}

.barcode{height:48px;margin-top:14px;
  background:repeating-linear-gradient(90deg,#16140F 0 2px,transparent 2px 4px,#16140F 4px 7px,transparent 7px 9px,#16140F 9px 10px,transparent 10px 14px)}
.barnum{text-align:center;font:600 12px "JetBrains Mono";letter-spacing:.4em;margin-top:6px;color:#16140F}
.note{text-align:center;font:500 11px "JetBrains Mono";letter-spacing:.12em;color:#5b554a;margin-top:14px;text-transform:uppercase}

/* checkbox lines for onboarding slip */
.chk{display:flex;gap:12px;align-items:flex-start;margin:14px 0;font:500 13px "JetBrains Mono"}
.box{width:20px;height:20px;border:2px solid #16140F;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-weight:800}
.box.on{background:#16140F;color:#ECE7DB}
.chk small{display:block;color:#6a6357;font-weight:400;margin-top:3px;line-height:1.4}

/* footer action area under slip (in app chrome, dark) */
.actions{margin-top:auto;display:flex;flex-direction:column;gap:12px;padding-top:22px}
.btn{text-align:center;padding:15px;border-radius:6px;font:700 13px "JetBrains Mono";letter-spacing:.14em;text-transform:uppercase}
.btn.pay{background:#FF4438;color:#160604}
.btn.line{border:1px solid #2a2a2e;color:#9a9488}
.switch{display:flex;border:1px solid #26241f;border-radius:6px;overflow:hidden;margin-top:2px}
.opt{flex:1;text-align:center;padding:13px;font:700 12px "JetBrains Mono";letter-spacing:.14em;text-transform:uppercase;color:#7a7468}
.opt.on{background:#ECE7DB;color:#16140F}
.opt.onblk{background:#2BD46F;color:#06231a}
</style>`;

const topbar = (armed) => `<div class="topbar"><span><span class="red">●</span> WILT</span><span>${armed}</span></div>`;
const barcode = `<div class="barcode"></div><div class="barnum">DG 00 23 14 07</div>`;

const screens = {};

screens.guilt = `
<div class="scr">
  ${topbar("RECEIPT #0617")}
  <div class="slip">
    <div class="stamp">PAST DUE</div>
    <div class="r-center">
      <div class="r-brand">WILT<span class="r-reg">®</span></div>
      <div class="r-sub">Daily Doom Receipt</div>
    </div>
    <div class="r-meta"><span>TUE 17 JUN</span><span>TERMINAL · LOCAL</span></div>
    <hr class="dash"/>
    <div class="row"><span class="desc">TIME WASTED</span><span class="amt">23:00</span></div>
    <div class="row"><span class="desc">REELS <span class="qty">@ ig</span></span><span class="amt">×14</span></div>
    <div class="row"><span class="desc">SHORTS <span class="qty">@ yt</span></span><span class="amt">×07</span></div>
    <hr class="dot"/>
    <div class="row"><span class="desc">SUBTOTAL / DAY</span><span class="amt">23 MIN</span></div>
    <div class="row"><span class="desc">REGRET</span><span class="amt">INCLUDED</span></div>
    <hr class="dash"/>
    <div class="total"><span class="t-l">TOTAL</span><span class="t-r">23<span style="font-size:15px"> MIN</span></span></div>
    ${barcode}
    <div class="note">*** time's slipping — go touch grass ***</div>
  </div>
  <div class="actions">
    <div class="switch"><div class="opt on">Guilt</div><div class="opt">Block</div></div>
    <div class="btn line">▸ Cats, not reels</div>
  </div>
</div>`;

screens.block = `
<div class="scr">
  ${topbar("RECEIPT #0617")}
  <div class="slip">
    <div class="stamp ok">VOID</div>
    <div class="r-center">
      <div class="r-brand">WILT<span class="r-reg">®</span></div>
      <div class="r-sub">Daily Doom Receipt</div>
    </div>
    <div class="r-meta"><span>TUE 17 JUN</span><span>TERMINAL · LOCAL</span></div>
    <hr class="dash"/>
    <div class="row"><span class="desc">TIME WASTED</span><span class="amt">00:00</span></div>
    <div class="row"><span class="desc">REELS BOUNCED</span><span class="amt">ALL</span></div>
    <div class="row"><span class="desc">SHORTS BOUNCED</span><span class="amt">ALL</span></div>
    <hr class="dot"/>
    <div class="total"><span class="t-l">TOTAL DUE</span><span class="t-r" style="color:#1C7A45">0<span style="font-size:15px"> MIN</span></span></div>
    <div class="note" style="color:#1C7A45">*** block mode engaged · perimeter active ***</div>
    ${barcode}
  </div>
  <div class="actions">
    <div class="switch"><div class="opt">Guilt</div><div class="opt onblk">Block</div></div>
    <div class="btn line">▸ Cats, not reels</div>
  </div>
</div>`;

screens.onboarding = `
<div class="scr">
  ${topbar("ACTIVATION")}
  <div class="slip">
    <div class="r-center">
      <div class="r-brand">WILT<span class="r-reg">®</span></div>
      <div class="r-sub">Activation Slip · 1/2</div>
    </div>
    <hr class="dash"/>
    <div class="chk"><span class="box on">✓</span><span>ALLOW DRAWING OVER APPS
      <small>Lets the counter pill float on top of Instagram.</small></span></div>
    <hr class="dot"/>
    <div class="chk"><span class="box">2</span><span>ENABLE ACCESSIBILITY SERVICE
      <small>Find "Wilt Reel Counter" in the list and switch it on. This is how the app knows when you're watching reels.</small></span></div>
    <hr class="dash"/>
    <div class="note">*** arm both to start the meter ***</div>
    ${barcode}
  </div>
  <div class="actions">
    <div class="btn pay">Open accessibility settings</div>
    <div class="btn line">Privacy · reads IG &amp; YT only · on-device</div>
  </div>
</div>`;

const order = ["onboarding", "guilt", "block"];
const captions = { onboarding: "Onboarding slip", guilt: "Dashboard — Guilt (the bill)", block: "Dashboard — Block (void)" };

for (const n of order) {
  fs.writeFileSync(path.join(OUT, `${n}.html`),
    `<!doctype html><html><head>${HEAD}</head><body style="padding:0"><div class="phone">${screens[n]}</div></body></html>`);
}
const board = `<!doctype html><html><head>${HEAD}</head>
<body style="display:flex;gap:30px;padding:46px;align-items:flex-start">
${order.map((n) => `<div style="display:flex;flex-direction:column;align-items:center">
  <div class="phone">${screens[n]}</div><div class="cap">${captions[n]}</div></div>`).join("")}
</body></html>`;
fs.writeFileSync(path.join(OUT, "board.html"), board);
console.log("Wrote ledger previews:", order.length + 1);
