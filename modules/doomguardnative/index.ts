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
};

type NativeModule = {
  getStatus(): DoomguardStatus;
  setMode(mode: DoomguardMode): void;
};

// Lazily resolved so JS never crashes if the native module isn't present
// (e.g. running in a context without the dev build).
let nativeModule: NativeModule | null = null;
let loadError: string | null = null;
try {
  nativeModule = requireNativeModule<NativeModule>("Doomguard");
} catch (e) {
  nativeModule = null;
  loadError = e instanceof Error ? e.message : String(e);
}

/** TEMP debug: what the JS bridge actually sees. Remove once status works. */
export function getStatusDebug(): {
  moduleLoaded: boolean;
  loadError: string | null;
  raw: DoomguardStatus | null;
  callError: string | null;
} {
  if (!nativeModule) {
    return { moduleLoaded: false, loadError, raw: null, callError: null };
  }
  try {
    return { moduleLoaded: true, loadError: null, raw: nativeModule.getStatus(), callError: null };
  } catch (e) {
    return {
      moduleLoaded: true,
      loadError: null,
      raw: null,
      callError: e instanceof Error ? e.message : String(e),
    };
  }
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
