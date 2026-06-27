import { pickNudge, COOLDOWN_MS, type NudgeState } from "./nudges";

const base: NudgeState = {
  mode: "guilt",
  event: "tick",
  nowMs: 10_000_000,
  hour: 12,
  weekday: 3, // Wednesday
  seconds: 0,
  prevSeconds: 0,
  count: 0,
  prevCount: 0,
  sitting: 0,
  prevSitting: 0,
  yesterdaySeconds: 0,
  firedToday: [],
  lastNudgeAt: 0,
};

describe("guards", () => {
  it("never fires in block mode", () => {
    expect(pickNudge({ ...base, mode: "block", event: "entry", hour: 2 })).toBeNull();
  });

  it("suppresses non-time triggers inside the cooldown window", () => {
    const s = { ...base, event: "tick" as const, prevCount: 24, count: 25, nowMs: 100, lastNudgeAt: 100 - (COOLDOWN_MS - 1) };
    expect(pickNudge(s)).toBeNull();
  });

  it("lets reel-time milestones bypass the cooldown", () => {
    const s = { ...base, event: "tick" as const, prevSeconds: 899, seconds: 901, nowMs: 100, lastNudgeAt: 100 - (COOLDOWN_MS - 1) };
    expect(pickNudge(s)).toBe("time15");
  });

  it("allows a count milestone once the cooldown has lapsed", () => {
    const s = { ...base, event: "tick" as const, prevCount: 24, count: 25, nowMs: COOLDOWN_MS + 100, lastNudgeAt: 0 };
    expect(pickNudge(s)).toBe("count25");
  });
});

describe("time-of-day (entry, HARD)", () => {
  it("fires latenight before 5am", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 2 })).toBe("latenight");
  });
  it("fires morning at 09:59 but not 10:00", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 9 })).toBe("morning");
    expect(pickNudge({ ...base, event: "entry", hour: 10 })).toBe("workhours");
  });
  it("workhours only on weekdays", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 11, weekday: 0 })).toBe("weekly");
  });
  it("does not fire time-of-day on a tick event", () => {
    expect(pickNudge({ ...base, event: "tick", hour: 2 })).toBeNull();
  });
});

describe("threshold crossing (tick)", () => {
  it("fires time3 at three minutes", () => {
    expect(pickNudge({ ...base, prevSeconds: 179, seconds: 180 })).toBe("time3");
  });
  it("has no reel-time milestone past 99 minutes", () => {
    // 99 min (5940s) is the last; crossing beyond it triggers nothing.
    expect(pickNudge({ ...base, prevSeconds: 5941, seconds: 6200 })).toBeNull();
  });
  it("fires time30 exactly when crossing 1800", () => {
    expect(pickNudge({ ...base, prevSeconds: 1799, seconds: 1800 })).toBe("time30");
  });
  it("does not re-fire once already past the threshold", () => {
    expect(pickNudge({ ...base, prevSeconds: 1800, seconds: 1801 })).toBeNull();
  });
  it("fires the highest threshold crossed", () => {
    expect(pickNudge({ ...base, prevSeconds: 3500, seconds: 3700 })).toBe("time60");
  });
  it("fires count50 crossing 50 swipes", () => {
    expect(pickNudge({ ...base, prevCount: 49, count: 50 })).toBe("count50");
  });
  it("fires sitting at 15 continuous minutes", () => {
    expect(pickNudge({ ...base, prevSitting: 899, sitting: 900 })).toBe("sitting");
  });
  it("fires vsyesterday when passing yesterday's total", () => {
    expect(pickNudge({ ...base, yesterdaySeconds: 1000, prevSeconds: 1000, seconds: 1010 })).toBe("vsyesterday");
  });
});

describe("priority + once-per-day", () => {
  it("prefers sitting over a time milestone in the same tick", () => {
    const s = { ...base, prevSitting: 899, sitting: 900, prevSeconds: 899, seconds: 900 };
    expect(pickNudge(s)).toBe("sitting");
  });
  it("skips an already-fired trigger and falls through", () => {
    const s = { ...base, prevSitting: 899, sitting: 900, prevSeconds: 899, seconds: 900, firedToday: ["sitting"] };
    expect(pickNudge(s)).toBe("time15");
  });
  // hour 20 = evening, so no time-of-day trigger competes with these.
  it("prefers cleanday over weekly on entry", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 20, yesterdaySeconds: 300 })).toBe("cleanday");
  });
  it("weekly when yesterday wasn't clean", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 20, yesterdaySeconds: 5000 })).toBe("weekly");
  });
  it("no cleanday when there is no yesterday data", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 20, yesterdaySeconds: 0 })).toBe("weekly");
  });
});
