import { requireNativeModule } from "expo";

export type DoomguardStatus = {
  /** "Draw over other apps" permission granted. */
  overlay: boolean;
  /** Accessibility service toggled on in system settings. */
  accessibilityEnabled: boolean;
  /** Enabled AND the service has actually connected (i.e. working). */
  accessibilityRunning: boolean;
  /** Reels counted so far today. */
  todayCount: number;
};

type NativeModule = {
  getStatus(): DoomguardStatus;
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
