import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as IntentLauncher from "expo-intent-launcher";

import { EyeGraphic } from "./components/EyeGraphic";
import {
  getStatus,
  setMode,
  type DoomguardMode,
  type DoomguardStatus,
} from "./modules/doomguardnative";
import "./global.css";

const ANDROID_PACKAGE = "com.rogerantony.doomguard";

function openAccessibilitySettings() {
  IntentLauncher.startActivityAsync(
    "android.settings.ACCESSIBILITY_SETTINGS"
  ).catch(() => {});
}

function openOverlaySettings() {
  IntentLauncher.startActivityAsync(
    "android.settings.action.MANAGE_OVERLAY_PERMISSION",
    { data: `package:${ANDROID_PACKAGE}` }
  ).catch(() => {
    IntentLauncher.startActivityAsync(
      "android.settings.action.MANAGE_OVERLAY_PERMISSION"
    ).catch(() => {});
  });
}

/** Matches the native overlay curve: calm under 50, fully red by ~200. */
function rednessFor(count: number): number {
  return Math.min(1, Math.max(0, (count - 50) / 150));
}

function vibe(count: number): { title: string; sub: string } {
  if (count === 0)
    return { title: "Eyes clear.", sub: "Not a single reel today. Look at you." };
  if (count < 15)
    return { title: "Fresh eyes.", sub: "A few reels in — willpower intact." };
  if (count < 40)
    return { title: "Getting comfy…", sub: "The scroll is starting to pull." };
  if (count < 80)
    return { title: "Eyes glazing over.", sub: "That's a lot of reels. Stretch?" };
  if (count < 150)
    return { title: "Bloodshot.", sub: "Seriously — go touch some grass." };
  return { title: "Send help.", sub: "Your eyes are screaming. Outside. Now." };
}

/** Runs once on mount; the returned cleanup runs on unmount. */
function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

export default function App() {
  const [status, setStatus] = useState<DoomguardStatus | null>(() => getStatus());
  const [confirmGuilt, setConfirmGuilt] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => setStatus(getStatus()), []);

  // Poll status for a few seconds after coming to the foreground. The
  // accessibility service writes its "connected" heartbeat a beat after you
  // flip the toggle, so a single read on resume can miss it and the setup
  // would look incomplete until the next app switch. We stop early once both
  // permissions are live (so the tick lands and onboarding hands off to home).
  const syncStatus = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    let attempts = 0;
    const tick = () => {
      const next = getStatus();
      setStatus(next);
      const ready = next?.overlay === true && next?.accessibilityRunning === true;
      if (ready || (attempts += 1) >= 8) {
        pollRef.current = null;
        return;
      }
      pollRef.current = setTimeout(tick, 500);
    };
    tick();
  }, []);

  useMountEffect(() => {
    syncStatus();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncStatus();
    });
    return () => {
      subscription.remove();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  });

  const overlayDone = status?.overlay === true;
  const accessibilityDone = status?.accessibilityRunning === true;
  const allReady = overlayDone && accessibilityDone;
  const mode: DoomguardMode = status?.mode ?? "guilt";
  const count = status?.todayCount ?? 0;

  const changeMode = useCallback(
    (next: DoomguardMode) => {
      if (next === mode) return;
      // Leaving Block mode is the moment of weakness — make them confirm.
      if (mode === "block" && next === "guilt") {
        setConfirmGuilt(true);
        return;
      }
      setMode(next);
      refresh();
    },
    [mode, refresh]
  );

  const giveIn = useCallback(() => {
    setMode("guilt");
    setConfirmGuilt(false);
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar style="light" />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="grow gap-8 px-6 py-8">
          <View className="gap-2">
            <Text className="text-4xl font-bold text-white">Doomguard</Text>
            <Text className="text-base text-zinc-400">
              {allReady
                ? "Your daily reel habit, staring back at you."
                : "Counts the Reels you watch on Instagram each day."}
            </Text>
          </View>

          {Platform.OS !== "android" ? (
            <View className="rounded-2xl bg-zinc-900 p-5">
              <Text className="text-base text-zinc-300">
                The Reel counter is Android-only — it relies on Android's overlay
                and accessibility features. Install the Android build to use it.
              </Text>
            </View>
          ) : allReady ? (
            <Dashboard mode={mode} count={count} onChangeMode={changeMode} />
          ) : (
            <Onboarding
              overlayDone={overlayDone}
              accessibilityDone={accessibilityDone}
            />
          )}

          <View className="mt-auto rounded-2xl bg-zinc-900 p-5">
            <Text className="text-sm leading-5 text-zinc-400">
              Doomguard only reads Instagram's screen, nothing else, and your
              count lives only on this device.
            </Text>
          </View>
        </View>
      </ScrollView>

      <PushThroughModal
        visible={confirmGuilt}
        onKeepBlocking={() => setConfirmGuilt(false)}
        onGiveIn={giveIn}
      />
    </SafeAreaView>
  );
}

function Dashboard({
  mode,
  count,
  onChangeMode,
}: {
  mode: DoomguardMode;
  count: number;
  onChangeMode: (mode: DoomguardMode) => void;
}) {
  const v = vibe(count);
  return (
    <View className="gap-7">
      {mode === "guilt" ? (
        <View className="items-center gap-3 rounded-3xl bg-zinc-900 px-6 py-8">
          <EyeGraphic intensity={rednessFor(count)} size={240} />
          <View className="flex-row items-end gap-2">
            <Text className="text-6xl font-bold text-white">{count}</Text>
            <Text className="mb-2 text-lg text-zinc-400">
              {count === 1 ? "reel" : "reels"} today
            </Text>
          </View>
          <Text className="text-xl font-semibold text-white">{v.title}</Text>
          <Text className="text-center text-sm text-zinc-400">{v.sub}</Text>
        </View>
      ) : (
        <View className="items-center gap-4 rounded-3xl bg-zinc-900 px-6 py-10">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-emerald-500/15">
            <Ionicons name="shield-checkmark" size={68} color="#34d399" />
          </View>
          <Text className="text-xl font-semibold text-white">Block mode is on</Text>
          <Text className="text-center text-sm text-zinc-400">
            Reels get bounced the moment they appear. Nothing to count — you're
            not watching any.
          </Text>
        </View>
      )}

      <ModeSwitch mode={mode} onChangeMode={onChangeMode} />
    </View>
  );
}

function ModeSwitch({
  mode,
  onChangeMode,
}: {
  mode: DoomguardMode;
  onChangeMode: (mode: DoomguardMode) => void;
}) {
  return (
    <View className="gap-3">
      <Text className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Mode
      </Text>
      <View className="flex-row rounded-2xl bg-zinc-900 p-1.5">
        <ModeOption
          active={mode === "guilt"}
          icon="eye"
          label="Guilt"
          onPress={() => onChangeMode("guilt")}
        />
        <ModeOption
          active={mode === "block"}
          icon="shield-checkmark"
          label="Block"
          accent
          onPress={() => onChangeMode("block")}
        />
      </View>
      <Text className="px-1 text-sm text-zinc-400">
        {mode === "guilt"
          ? "Guilt — watch all you want, the eye keeps score."
          : "Block (pro) — Doomguard backs you out of every reel."}
      </Text>
    </View>
  );
}

function ModeOption({
  active,
  icon,
  label,
  accent,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: boolean;
  onPress: () => void;
}) {
  const activeBg = accent ? "bg-emerald-500" : "bg-white";
  const activeText = accent ? "text-white" : "text-zinc-950";
  const iconColor = active ? (accent ? "#ffffff" : "#09090b") : "#a1a1aa";
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
        active ? activeBg : ""
      }`}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text
        className={`text-base font-semibold ${
          active ? activeText : "text-zinc-400"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PushThroughModal({
  visible,
  onKeepBlocking,
  onGiveIn,
}: {
  visible: boolean;
  onKeepBlocking: () => void;
  onGiveIn: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepBlocking}
    >
      <View className="flex-1 items-center justify-center bg-black/70 px-8">
        <View className="w-full gap-5 rounded-3xl bg-zinc-900 p-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-amber-500/15">
            <Ionicons name="flame" size={30} color="#f59e0b" />
          </View>
          <View className="gap-2">
            <Text className="text-2xl font-bold text-white">
              Going soft already?
            </Text>
            <Text className="text-base leading-6 text-zinc-400">
              You're in Block mode — the reels can't touch you. Switch back and
              you're choosing to feed the addiction. Why not just push through?
            </Text>
          </View>
          <View className="gap-3">
            <Pressable
              onPress={onKeepBlocking}
              className="items-center rounded-xl bg-emerald-500 px-4 py-3.5 active:opacity-80"
            >
              <Text className="text-base font-bold text-white">
                Keep blocking 🛡️
              </Text>
            </Pressable>
            <Pressable
              onPress={onGiveIn}
              className="items-center rounded-xl px-4 py-2 active:opacity-60"
            >
              <Text className="text-base font-medium text-zinc-500">
                I'll give in 😔
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Onboarding({
  overlayDone,
  accessibilityDone,
}: {
  overlayDone: boolean;
  accessibilityDone: boolean;
}) {
  return (
    <View className="gap-4">
      <Text className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        One-time setup
      </Text>

      <SetupStep
        index={1}
        title="Allow drawing over apps"
        body="Lets the counter pill float on top of Instagram."
        action="Open overlay permission"
        onPress={openOverlaySettings}
        done={overlayDone}
      />

      <SetupStep
        index={2}
        title="Enable the accessibility service"
        body="Find “Doomguard Reel Counter” in the list and turn it on. This is how the app knows when you're watching Reels."
        action="Open accessibility settings"
        onPress={openAccessibilitySettings}
        done={accessibilityDone}
      />
    </View>
  );
}

function SetupStep({
  index,
  title,
  body,
  action,
  onPress,
  done,
}: {
  index: number;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  done: boolean;
}) {
  return (
    <View
      className={`gap-3 rounded-2xl border p-5 ${
        done
          ? "border-emerald-500/40 bg-emerald-950/30"
          : "border-transparent bg-zinc-900"
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            done ? "bg-emerald-500" : "bg-white"
          }`}
        >
          {done ? (
            <Ionicons name="checkmark" size={18} color="#ffffff" />
          ) : (
            <Text className="text-sm font-bold text-zinc-950">{index}</Text>
          )}
        </View>
        <Text className="flex-1 text-lg font-semibold text-white">{title}</Text>
      </View>
      <Text className="text-sm leading-5 text-zinc-400">{body}</Text>
      {done ? (
        <View className="flex-row items-center justify-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3">
          <Ionicons name="checkmark-circle" size={18} color="#34d399" />
          <Text className="text-base font-semibold text-emerald-400">
            Enabled
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          className="items-center rounded-xl bg-white px-4 py-3 active:opacity-80"
        >
          <Text className="text-base font-semibold text-zinc-950">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
