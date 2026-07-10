// Colour + tone for the "time left" readout, shared by the Kit-Cat clock and its
// test. Keeps the palette semantics the rest of the app uses: green means plenty
// left, amber means the budget is running down, red is reserved for over the limit.

export const TL_GREEN = "#38C786";
export const TL_AMBER = "#E0913C";
export const TL_OVER = "#D2542F";

export type TimeLeftTone = "ok" | "warn" | "over";

export type TimeLeftState = {
  /** Whole minutes still available today, floored at 0. */
  minutesLeft: number;
  color: string;
  tone: TimeLeftTone;
};

/**
 * Derive the readout state from minutes used against the daily limit.
 * - over the limit (nothing left) -> red
 * - half the budget or less remaining -> amber (running down)
 * - more than half remaining -> green (plenty)
 */
export function timeLeftState(usedMinutes: number, limitMinutes: number): TimeLeftState {
  const limit = Math.max(1, limitMinutes);
  const minutesLeft = Math.max(0, Math.round(limit - usedMinutes));
  const fraction = minutesLeft / limit;

  if (minutesLeft <= 0) return { minutesLeft, color: TL_OVER, tone: "over" };
  if (fraction <= 0.5) return { minutesLeft, color: TL_AMBER, tone: "warn" };
  return { minutesLeft, color: TL_GREEN, tone: "ok" };
}
