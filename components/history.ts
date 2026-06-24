import type { DoomguardDay } from "../modules/doomguardnative";

export type HistoryRange = "7d" | "30d" | "all";

export type HistoryView = {
  /** Contiguous, ascending, zero-filled days ending at `today`. */
  series: DoomguardDay[];
  totalSeconds: number;
  totalCount: number;
  totalShorts: number;
  /** Totals for the equal-length window immediately before; null for "all". */
  prevTotalSeconds: number | null;
  prevTotalCount: number | null;
};

const MS_PER_DAY = 86_400_000;

/** "yyyy-mm-dd" -> integer day index (UTC midnight, so arithmetic is DST-proof). */
export function toDayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** integer day index -> "yyyy-mm-dd". */
export function fromDayIndex(index: number): string {
  const dt = new Date(index * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Contiguous zero-filled days from startIndex..endIndex inclusive. */
function fill(byDate: Map<string, DoomguardDay>, startIndex: number, endIndex: number): DoomguardDay[] {
  const out: DoomguardDay[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const date = fromDayIndex(i);
    out.push(byDate.get(date) ?? { date, seconds: 0, count: 0, shorts: 0 });
  }
  return out;
}

export function buildView(history: DoomguardDay[], range: HistoryRange, today: string): HistoryView {
  const byDate = new Map<string, DoomguardDay>();
  for (const d of history) byDate.set(d.date, d);

  const todayIndex = toDayIndex(today);
  let startIndex: number;
  let prevStart: number | null = null;
  let prevEnd: number | null = null;

  if (range === "all") {
    let earliest = todayIndex;
    for (const d of history) earliest = Math.min(earliest, toDayIndex(d.date));
    startIndex = earliest;
  } else {
    const span = range === "7d" ? 7 : 30;
    startIndex = todayIndex - (span - 1);
    prevEnd = startIndex - 1;
    prevStart = prevEnd - (span - 1);
  }

  const series = fill(byDate, startIndex, todayIndex);

  let totalSeconds = 0;
  let totalCount = 0;
  let totalShorts = 0;
  for (const d of series) {
    totalSeconds += d.seconds;
    totalCount += d.count;
    totalShorts += d.shorts;
  }

  let prevTotalSeconds: number | null = null;
  let prevTotalCount: number | null = null;
  if (prevStart != null && prevEnd != null) {
    const prev = fill(byDate, prevStart, prevEnd);
    prevTotalSeconds = prev.reduce((s, d) => s + d.seconds, 0);
    prevTotalCount = prev.reduce((s, d) => s + d.count + d.shorts, 0);
  }

  return { series, totalSeconds, totalCount, totalShorts, prevTotalSeconds, prevTotalCount };
}
