import { requireNativeModule } from "expo";

export type DoomguardMode = "guilt" | "block";

export type DoomguardStatus = {
  /** "Draw over other apps" permission granted. */
  overlay: boolean;
  /** Accessibility service toggled on in system settings. */
  accessibilityEnabled: boolean;
  /** Enabled AND the service has actually connected (i.e. working). */
  accessibilityRunning: boolean;
  /** Instagram Reels counted so far today. */
  todayCount: number;
  /** YouTube Shorts counted so far today. */
  todayShorts: number;
  /** Seconds spent on short-form players (reels + shorts) today. */
  todaySeconds: number;
  /** Current behavior: "guilt" counts reels, "block" bounces you out. */
  mode: DoomguardMode;
  /** User-set daily limit, in minutes. When crossed, surfaces turn red. */
  limitMinutes: number;
  /** Guilt mode: auto-block reels once the daily limit is hit. */
  blockAtLimit: boolean;
  /** No snooze / no switching back once blocked. */
  strictMode: boolean;
  /**
   * Strict is still enforced today, but the user asked to turn it off after
   * hitting the limit, so it will flip off at the next daily reset.
   */
  strictOffPending: boolean;
  /** Right now, a guilt user is over their limit and reels are being bounced. */
  autoBlocked: boolean;
  /** Highest streak milestone already celebrated (so the moment doesn't re-fire). */
  lastCelebratedStreakMilestone: number;
  /** Lifetime points value at which cat-unlock reveals were last shown. */
  lastPointsCelebrated: number;
};

export type DoomguardDay = {
  /** Local calendar day, "yyyy-mm-dd". */
  date: string;
  /** Seconds on short-form players (reels + shorts) that day. */
  seconds: number;
  /** Instagram Reels counted that day. */
  count: number;
  /** YouTube Shorts counted that day. */
  shorts: number;
  /** Daily limit in effect that day, in minutes. Absent on days archived before this shipped. */
  limitMinutes?: number;
};

type NativeModule = {
  getStatus(): DoomguardStatus;
  setMode(mode: DoomguardMode): void;
  setLimit(minutes: number): void;
  setBlockAtLimit(enabled: boolean): void;
  setStrict(enabled: boolean): void;
  getHistory(): DoomguardDay[];
  consumeOpenCats(): boolean;
  markStreakCelebrated(milestone: number): void;
  markPointsCelebrated(points: number): void;
};

// Lazily resolved so JS never crashes if the native module isn't present
// (e.g. running in a context without the dev build).
let nativeModule: NativeModule | null = null;
try {
  nativeModule = requireNativeModule<NativeModule>("Doomguard");
} catch {
  nativeModule = null;
}

export function getStatus(): DoomguardStatus | null {
  if (!nativeModule) return null;
  try {
    return nativeModule.getStatus();
  } catch {
    return null;
  }
}

export function setMode(mode: DoomguardMode): void {
  if (!nativeModule) return;
  try {
    nativeModule.setMode(mode);
  } catch {
    // no-op if the native module isn't available
  }
}

export function setLimit(minutes: number): void {
  if (!nativeModule) return;
  try {
    nativeModule.setLimit(minutes);
  } catch {
    // no-op if the native module isn't available
  }
}

export function setBlockAtLimit(enabled: boolean): void {
  if (!nativeModule) return;
  try {
    nativeModule.setBlockAtLimit(enabled);
  } catch {
    // no-op if the native module isn't available
  }
}

export function setStrict(enabled: boolean): void {
  if (!nativeModule) return;
  try {
    nativeModule.setStrict(enabled);
  } catch {
    // no-op if the native module isn't available
  }
}

export function getHistory(): DoomguardDay[] {
  if (!nativeModule) return [];
  try {
    return nativeModule.getHistory();
  } catch {
    return [];
  }
}

export function consumeOpenCats(): boolean {
  if (!nativeModule) return false;
  try {
    return nativeModule.consumeOpenCats();
  } catch {
    return false;
  }
}

export function markStreakCelebrated(milestone: number): void {
  if (!nativeModule) return;
  try {
    nativeModule.markStreakCelebrated(milestone);
  } catch {
    // no-op if the native module isn't available
  }
}

export function markPointsCelebrated(points: number): void {
  if (!nativeModule) return;
  try {
    nativeModule.markPointsCelebrated(points);
  } catch {
    // no-op if the native module isn't available
  }
}
