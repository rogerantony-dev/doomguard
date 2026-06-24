export type NudgeEvent = "entry" | "tick";

export type NudgeState = {
  mode: "guilt" | "block";
  event: NudgeEvent;
  nowMs: number;
  /** Local hour 0–23. */
  hour: number;
  /** 0=Sun … 6=Sat. */
  weekday: number;
  seconds: number;
  prevSeconds: number;
  count: number;
  prevCount: number;
  sitting: number;
  prevSitting: number;
  yesterdaySeconds: number;
  firedToday: readonly string[];
  lastNudgeAt: number;
};

export const COOLDOWN_MS = 20 * 60 * 1000;

/** Highest first. */
export const TIME_THRESHOLDS: { key: string; at: number }[] = [
  { key: "time120", at: 7200 },
  { key: "time90", at: 5400 },
  { key: "time60", at: 3600 },
  { key: "time45", at: 2700 },
  { key: "time30", at: 1800 },
  { key: "time15", at: 900 },
];

export const COUNT_THRESHOLDS: { key: string; at: number }[] = [
  { key: "count100", at: 100 },
  { key: "count50", at: 50 },
  { key: "count25", at: 25 },
];

const crossed = (prev: number, cur: number, at: number): boolean => prev < at && cur >= at;

/** Candidate keys in priority order whose condition is currently met. */
function candidates(s: NudgeState): string[] {
  const out: string[] = [];

  if (s.event === "entry") {
    const isWeekday = s.weekday >= 1 && s.weekday <= 5;
    if (s.hour < 5) out.push("latenight");
    else if (s.hour < 10) out.push("morning");
    else if (isWeekday && s.hour < 17) out.push("workhours");
  } else {
    if (crossed(s.prevSitting, s.sitting, 900)) out.push("sitting");
    for (const t of TIME_THRESHOLDS) if (crossed(s.prevSeconds, s.seconds, t.at)) out.push(t.key);
    for (const c of COUNT_THRESHOLDS) if (crossed(s.prevCount, s.count, c.at)) out.push(c.key);
    if (s.yesterdaySeconds > 0 && crossed(s.prevSeconds, s.seconds, s.yesterdaySeconds + 1))
      out.push("vsyesterday");
  }

  if (s.event === "entry") {
    if (s.yesterdaySeconds > 0 && s.yesterdaySeconds < 900) out.push("cleanday");
    out.push("weekly");
  }

  return out;
}

export function pickNudge(s: NudgeState): string | null {
  if (s.mode !== "guilt") return null;
  if (s.nowMs - s.lastNudgeAt < COOLDOWN_MS) return null;
  const fired = new Set(s.firedToday);
  for (const key of candidates(s)) {
    if (!fired.has(key)) return key;
  }
  return null;
}
