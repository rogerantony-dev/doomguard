import { pointsForLimit, nextRungBelow, LADDER, isCleanDay, lifetimePoints, streaks } from "./progress";
import type { DoomguardDay } from "../modules/doomguardnative";

const day = (date: string, seconds: number, limitMinutes?: number): DoomguardDay => ({
  date, seconds, count: 0, shorts: 0, ...(limitMinutes !== undefined ? { limitMinutes } : {}),
});

describe("pointsForLimit", () => {
  it("maps each ladder rung to its table value", () => {
    expect(pointsForLimit(120)).toBe(10);
    expect(pointsForLimit(90)).toBe(15);
    expect(pointsForLimit(60)).toBe(20);
    expect(pointsForLimit(45)).toBe(30);
    expect(pointsForLimit(30)).toBe(50);
    expect(pointsForLimit(15)).toBe(100);
  });
  it("falls back to round(1200/limit) off-table", () => {
    expect(pointsForLimit(20)).toBe(60); // round(1200/20)
    expect(pointsForLimit(240)).toBe(5); // round(1200/240)
  });
});

describe("nextRungBelow", () => {
  it("returns the next lower ladder value", () => {
    expect(nextRungBelow(60)).toBe(45);
    expect(nextRungBelow(120)).toBe(90);
    expect(nextRungBelow(30)).toBe(15);
  });
  it("returns null at or below the floor", () => {
    expect(nextRungBelow(15)).toBeNull();
    expect(nextRungBelow(10)).toBeNull();
  });
  it("returns the next lower rung for an off-ladder value", () => {
    expect(nextRungBelow(50)).toBe(45);
  });
});

describe("LADDER", () => {
  it("is the descending limit ladder", () => {
    expect(LADDER).toEqual([120, 90, 60, 45, 30, 15]);
  });
});

describe("isCleanDay", () => {
  it("is clean when seconds are at or under the day's own limit", () => {
    expect(isCleanDay(day("2026-07-01", 60 * 60, 60), 30)).toBe(true); // exactly at limit
    expect(isCleanDay(day("2026-07-01", 60 * 60 + 1, 60), 30)).toBe(false);
  });
  it("falls back to the current limit when the day has no recorded limit", () => {
    expect(isCleanDay(day("2026-07-01", 20 * 60), 30)).toBe(true);
    expect(isCleanDay(day("2026-07-01", 40 * 60), 30)).toBe(false);
  });
  it("treats a zero-activity day as clean", () => {
    expect(isCleanDay(day("2026-07-01", 0), 30)).toBe(true);
  });
});

describe("lifetimePoints", () => {
  it("sums points per clean day using each day's own limit", () => {
    const h = [day("2026-07-01", 10 * 60, 60), day("2026-07-02", 10 * 60, 30)];
    expect(lifetimePoints(h, 30)).toBe(20 + 50);
  });
  it("skips over-limit days", () => {
    const h = [day("2026-07-01", 90 * 60, 60), day("2026-07-02", 5 * 60, 30)];
    expect(lifetimePoints(h, 30)).toBe(50);
  });
});

describe("streaks", () => {
  it("counts consecutive clean days ending today", () => {
    const h = [day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30), day("2026-07-07", 5 * 60, 30)];
    expect(streaks(h, "2026-07-07", 30).current).toBe(3);
  });
  it("breaks the current streak on an over-limit day but keeps the best run", () => {
    const h = [
      day("2026-07-01", 5 * 60, 30), day("2026-07-02", 5 * 60, 30), day("2026-07-03", 5 * 60, 30),
      day("2026-07-04", 99 * 60, 30), // over -> breaks
      day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30),
    ];
    const s = streaks(h, "2026-07-06", 30);
    expect(s.current).toBe(2);
    expect(s.best).toBe(3);
  });
  it("counts an untracked/missing today as not-yet-broken (streak up to yesterday)", () => {
    const h = [day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30)];
    // today 07-07 has no record yet; the run through yesterday still stands.
    expect(streaks(h, "2026-07-07", 30).current).toBe(2);
  });
  it("breaks the current streak when a day in the middle is missing (gap = not clean)", () => {
    const h = [day("2026-07-04", 5 * 60, 30), day("2026-07-06", 5 * 60, 30), day("2026-07-07", 5 * 60, 30)];
    // 07-05 missing -> the run ending today is only 06,07.
    expect(streaks(h, "2026-07-07", 30).current).toBe(2);
  });
});
