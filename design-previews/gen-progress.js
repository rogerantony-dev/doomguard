/*
 * Progression & rewards preview — the new positive-reinforcement surfaces on
 * top of the "Quiet" look. Three phone frames:
 *   1. Home: the ProgressStrip (streak + points) under the header, above the
 *      existing guilt hero.
 *   2. The MilestoneModal streak moment with the level-down offer.
 *   3. The Cats gallery with unlocked + locked ("Unlock at N pts") tiles.
 *
 *   node design-previews/gen-progress.js
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --force-device-scale-factor=2 --window-size=1330,1000 --virtual-time-budget=6000 \
 *     --screenshot=design-previews/out-progress/board.png design-previews/out-progress/board.html
 */
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "out-progress");
fs.mkdirSync(OUT, { recursive: true });

const T = {
  bg: "#0D0D0C",
  panel: "#1A1A18",
  ink: "#F2F1EC",
  ink2: "#9A9A92",
  faint: "#62625B",
  hair: "rgba(242,241,236,0.10)",
  acc: "#38C786",
  accSoft: "rgba(56,199,134,0.14)",
  waste: "#E0913C",
  over: "#D2542F",
};

const CATS = [
  "https://i.pinimg.com/736x/c0/78/08/c078082c4423cda6216a7b4627c6eb52.jpg",
  "https://media.tenor.com/zCTU9e8SmVMAAAAM/1000-yard-stare-cat-meme.gif",
];

// A wall of wasted minutes: filled amber up to `mins`, empty cells to `limit`.
function wasteWall(mins, limit) {
  let cells = "";
  for (let i = 0; i < limit; i++) {
    const fill = i < mins ? T.waste : "transparent";
    const border = i < mins ? "none" : `1px solid rgba(224,145,60,0.20)`;
    cells += `<span style="width:16px;height:16px;border-radius:3px;background:${fill};border:${border}"></span>`;
  }
  return `<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:22px">${cells}</div>`;
}

const strip = `
  <div style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;
    background:${T.panel};border-radius:16px;padding:12px 16px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="color:${T.acc};font-size:16px">&#128293;</span>
      <span style="font:600 15px Inter;color:${T.ink}">5<span style="font-weight:500;color:${T.ink2}"> days clean</span></span>
      <span style="font:400 12.5px Inter;color:${T.faint}">best 8</span>
    </div>
    <div style="font:500 14px Inter;color:${T.ink2}"><span style="font-weight:600;color:${T.ink}">1,240</span> pts</div>
  </div>`;

const homeScreen = `
  <div class="scr">
    <div class="topbar">
      <div class="brand"><span class="dot"></span>Doomguard</div>
      <div style="background:${T.panel};border-radius:999px;padding:8px 14px;font:500 12.5px Inter;color:${T.ink2}">
        Limit <span style="font-weight:600;color:${T.ink}">1h</span> &#9662;</div>
    </div>
    ${strip}
    <div style="margin-top:38px;display:flex;align-items:baseline">
      <div class="num" style="font:600 88px Inter;line-height:86px;color:${T.waste}">42</div>
      <div style="margin-left:10px;font:500 21px Inter;color:${T.faint}">min wasted today</div>
    </div>
    ${wasteWall(42, 60)}
    <div style="margin-top:12px;font:600 12px Inter;letter-spacing:.06em;color:${T.waste};text-transform:uppercase">18 min left of your 60-min limit</div>
    <div style="margin-top:24px;font:600 22px Inter;color:${T.ink};letter-spacing:-.01em">Time's slipping.</div>
  </div>`;

const milestoneScreen = `
  <div class="scr" style="justify-content:flex-end;background:rgba(0,0,0,0.55)">
    <div style="background:${T.panel};border-radius:28px;padding:24px;display:flex;flex-direction:column;gap:20px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="width:64px;height:64px;border-radius:50%;background:${T.accSoft};display:flex;align-items:center;justify-content:center;font-size:30px;color:${T.acc}">&#128293;</div>
        <div style="font:600 12px Inter;letter-spacing:.12em;text-transform:uppercase;color:${T.acc};margin-top:8px">Streak milestone</div>
        <div style="font:600 26px Inter;color:${T.ink};letter-spacing:-.02em">7 days clean.</div>
        <div style="font:400 14.5px Inter;line-height:1.5;color:${T.ink2}">A full week under your limit. That is a real habit forming.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font:400 14.5px Inter;line-height:1.5;color:${T.ink}">Ready for less? Drop your limit from 1h to 45m and earn more per clean day.</div>
        <div style="background:${T.acc};border-radius:16px;padding:15px;text-align:center;font:600 15.5px Inter;color:${T.bg}">Lower to 45m</div>
        <div style="border-radius:16px;padding:12px;text-align:center;font:500 15px Inter;color:${T.faint}">Keep 1h for now</div>
      </div>
    </div>
  </div>`;

const tile = (inner, extra = "") =>
  `<div style="width:154px;height:154px;border-radius:18px;overflow:hidden;${extra}">${inner}</div>`;
const lockedTile = (pts) =>
  tile(
    `<div style="width:100%;height:100%;background:${T.panel};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
      <span style="font-size:20px;color:${T.faint}">&#128274;</span>
      <span style="font:500 12.5px Inter;color:${T.ink2}">Unlock at ${pts} pts</span></div>`
  );

const catsScreen = `
  <div class="scr" style="padding:36px 20px 28px">
    <div style="font:600 26px Inter;color:${T.ink};letter-spacing:-.02em">Cats, not reels</div>
    <div style="font:400 14px Inter;color:${T.ink2};margin-top:6px">Rest your eyes on something better.</div>
    <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:22px">
      ${tile(`<img src="${CATS[0]}" style="width:100%;height:100%;object-fit:cover"/>`)}
      ${tile(`<img src="${CATS[1]}" style="width:100%;height:100%;object-fit:cover"/>`)}
      ${lockedTile(150)}
      ${lockedTile(400)}
    </div>
  </div>`;

const frame = (screen, cap) =>
  `<div><div class="phone">${screen}</div><div class="cap">${cap}</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#242422;font-family:Inter,system-ui,sans-serif;color:${T.ink};-webkit-font-smoothing:antialiased;padding:40px}
.num{font-variant-numeric:tabular-nums}
.board{display:flex;gap:40px;justify-content:center}
.phone{width:390px;height:844px;border-radius:48px;overflow:hidden;position:relative;background:${T.bg};
  box-shadow:0 30px 70px rgba(40,40,36,.22),0 0 0 10px #16160f,0 0 0 12px #2c2c25}
.scr{position:relative;height:100%;display:flex;flex-direction:column;padding:62px 26px 28px}
.cap{width:390px;text-align:center;margin-top:16px;color:#b9b9b2;font:600 12.5px Inter;letter-spacing:.13em;text-transform:uppercase}
.topbar{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:9px;font:600 16px Inter}
.brand .dot{width:7px;height:7px;border-radius:50%;background:${T.acc}}
</style></head>
<body><div class="board">
  ${frame(homeScreen, "Home &middot; streak + points strip")}
  ${frame(milestoneScreen, "7-day milestone &middot; level-down offer")}
  ${frame(catsScreen, "Cats &middot; unlocked + locked")}
</div></body></html>`;

fs.writeFileSync(path.join(OUT, "board.html"), html);
console.log("wrote", path.join(OUT, "board.html"));
