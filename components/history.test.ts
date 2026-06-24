import { buildView, fromDayIndex, toDayIndex } from "./history";
import type { DoomguardDay } from "../modules/doomguardnative";

const day = (date: string, seconds: number, count = 0, shorts = 0): DoomguardDay => ({
  date,
  seconds,
  count,
  shorts,
});

describe("day index round-trip", () => {
  it("round-trips a date through the integer index", () => {
    expect(fromDayIndex(toDayIndex("2026-06-24"))).toBe("2026-06-24");
  });

  it("treats adjacent days as consecutive indices", () => {
    expect(toDayIndex("2026-06-24") - toDayIndex("2026-06-23")).toBe(1);
  });

  it("crosses month boundaries correctly", () => {
    expect(fromDayIndex(toDayIndex("2026-01-31") + 1)).toBe("2026-02-01");
  });
});

describe("buildView 7d", () => {
  const history = [day("2026-06-24", 600, 5, 2), day("2026-06-22", 120, 1, 0)];

  it("produces exactly 7 contiguous days ending today, zero-filling gaps", () => {
    const view = buildView(history, "7d", "2026-06-24");
    expect(view.series).toHaveLength(7);
    expect(view.series[0].date).toBe("2026-06-18");
    expect(view.series[6].date).toBe("2026-06-24");
    // 06-23 had no activity -> zero-filled
    expect(view.series[5]).toEqual({ date: "2026-06-23", seconds: 0, count: 0, shorts: 0 });
  });

  it("sums totals across the window", () => {
    const view = buildView(history, "7d", "2026-06-24");
    expect(view.totalSeconds).toBe(720);
    expect(view.totalCount).toBe(6);
    expect(view.totalShorts).toBe(2);
  });

  it("counts covered days from the first recorded day, not the full window", () => {
    // earliest data is 2026-06-22, so only 3 days (22, 23, 24) have been tracked.
    const view = buildView(history, "7d", "2026-06-24");
    expect(view.coveredDays).toBe(3);
  });

  it("clamps covered days to the window when data predates it", () => {
    // data on 2026-06-15 is older than the 7d window start (2026-06-18).
    const withOld = [...history, day("2026-06-15", 300, 0, 0)];
    const view = buildView(withOld, "7d", "2026-06-24");
    expect(view.coveredDays).toBe(7);
  });

  it("computes the previous equal-length window total", () => {
    // previous 7d window is 2026-06-11..2026-06-17
    const withPrev = [...history, day("2026-06-15", 300, 0, 0)];
    const view = buildView(withPrev, "7d", "2026-06-24");
    expect(view.prevTotalSeconds).toBe(300);
    expect(view.prevTotalCount).toBe(0);
  });

  it("treats a single tracked day as a one-day average", () => {
    const view = buildView([day("2026-06-24", 5400, 0, 0)], "7d", "2026-06-24");
    expect(view.coveredDays).toBe(1);
    expect(view.totalSeconds).toBe(5400);
  });
});

describe("buildView all", () => {
  it("spans from the earliest history date through today with no prev window", () => {
    const view = buildView([day("2026-06-20", 60)], "all", "2026-06-24");
    expect(view.series[0].date).toBe("2026-06-20");
    expect(view.series[view.series.length - 1].date).toBe("2026-06-24");
    expect(view.series).toHaveLength(5);
    expect(view.coveredDays).toBe(5);
    expect(view.prevTotalSeconds).toBeNull();
  });

  it("falls back to a single today bar when history is empty", () => {
    const view = buildView([], "all", "2026-06-24");
    expect(view.series).toEqual([{ date: "2026-06-24", seconds: 0, count: 0, shorts: 0 }]);
    expect(view.totalSeconds).toBe(0);
    expect(view.coveredDays).toBe(1);
  });
});
