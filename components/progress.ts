import type { DoomguardDay } from "../modules/doomguardnative";
import { toDayIndex } from "./history";

export const LADDER = [120, 90, 60, 45, 30, 15] as const;

const POINTS_TABLE: Record<number, number> = {
  120: 10,
  90: 15,
  60: 20,
  45: 30,
  30: 50,
  15: 100,
};

/** Points earned for one clean day at the given limit. Lower limit, more points. */
export function pointsForLimit(limitMinutes: number): number {
  return POINTS_TABLE[limitMinutes] ?? Math.round(1200 / limitMinutes);
}

/** The next tighter rung below `limitMinutes`, or null at/below the 15-min floor. */
export function nextRungBelow(limitMinutes: number): number | null {
  const lower = LADDER.filter((r) => r < limitMinutes);
  return lower.length ? Math.max(...lower) : null;
}

/** A day is clean when its short-form seconds are at or under that day's limit. */
export function isCleanDay(day: DoomguardDay, currentLimit: number): boolean {
  const limit = day.limitMinutes ?? currentLimit;
  return day.seconds <= limit * 60;
}

/** Lifetime points: sum over clean days of that day's rate. */
export function lifetimePoints(history: DoomguardDay[], currentLimit: number): number {
  let total = 0;
  for (const d of history) {
    if (isCleanDay(d, currentLimit)) {
      total += pointsForLimit(d.limitMinutes ?? currentLimit);
    }
  }
  return total;
}

/**
 * Current streak (consecutive clean days ending at/just before `today`) and the
 * best contiguous clean run in history. "Contiguous" = adjacent calendar days;
 * a missing day is a gap that ends a run. A missing `today` does not break the
 * run (the day isn't over yet) so we count back from the latest recorded day.
 */
export function streaks(
  history: DoomguardDay[],
  today: string,
  currentLimit: number
): { current: number; best: number } {
  const clean = new Map<number, boolean>();
  for (const d of history) clean.set(toDayIndex(d.date), isCleanDay(d, currentLimit));

  // Best: longest run of consecutive clean day-indices.
  const indices = [...clean.keys()].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const i of indices) {
    if (!clean.get(i)) { run = 0; prev = i; continue; }
    run = prev !== null && i === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = i;
  }

  // Current: count back from today; if today has no record, start at yesterday.
  const todayIdx = toDayIndex(today);
  let cursor = clean.has(todayIdx) ? todayIdx : todayIdx - 1;
  let current = 0;
  while (clean.get(cursor) === true) {
    current += 1;
    cursor -= 1;
  }
  return { current, best };
}
