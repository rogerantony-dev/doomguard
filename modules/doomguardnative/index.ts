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
  /** User-set daily limit, in minutes — when crossed, surfaces turn red. */
  limitMinutes: number;
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
};

type NativeModule = {
  getStatus(): DoomguardStatus;
  setMode(mode: DoomguardMode): void;
  setLimit(minutes: number): void;
  getHistory(): DoomguardDay[];
  consumeOpenCats(): boolean;
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
