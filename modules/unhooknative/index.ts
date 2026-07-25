import { requireNativeModule } from "expo";

export type UnhookMode = "guilt" | "block";

export type UnhookStatus = {
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
  mode: UnhookMode;
  /** User-set daily limit, in minutes. When crossed, surfaces turn red. */
  limitMinutes: number;
  /** Right now, a guilt user is over their limit and reels are being bounced. */
  autoBlocked: boolean;
  /** Highest streak milestone already celebrated (so the moment doesn't re-fire). */
  lastCelebratedStreakMilestone: number;
  /** Lifetime points value at which cat-unlock reveals were last shown. */
  lastPointsCelebrated: number;
};

export type UnhookDay = {
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
  getStatus(): UnhookStatus;
  setMode(mode: UnhookMode): void;
  setLimit(minutes: number): void;
  getHistory(): UnhookDay[];
  consumeOpenCats(): boolean;
  markStreakCelebrated(milestone: number): void;
  markPointsCelebrated(points: number): void;
};

// Lazily resolved so JS never crashes if the native module isn't present
// (e.g. running in a context without the dev build).
let nativeModule: NativeModule | null = null;
try {
  nativeModule = requireNativeModule<NativeModule>("Unhook");
} catch {
  nativeModule = null;
}

export function getStatus(): UnhookStatus | null {
  if (!nativeModule) return null;
  try {
    return nativeModule.getStatus();
  } catch {
    return null;
  }
}

export function setMode(mode: UnhookMode): void {
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

export function getHistory(): UnhookDay[] {
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
