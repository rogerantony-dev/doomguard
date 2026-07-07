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
