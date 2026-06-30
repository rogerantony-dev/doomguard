import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
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

import { CatGallery } from "./components/CatGallery";
import { HistoryScreen } from "./components/HistoryScreen";
import { Brand, C, Kicker, Track } from "./components/console";
import {
  consumeOpenCats,
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

/** Matches the native pill curve: calm under ~10 min, fully red by ~50. */
function rednessForMinutes(minutes: number): number {
  return Math.min(1, Math.max(0, (minutes - 10) / 40));
}

function vibe(minutes: number): { title: string; sub: string } {
  if (minutes < 1)
    return { title: "Clock's clean.", sub: "No time wasted yet today. Look at you." };
  if (minutes < 5)
    return { title: "Just a peek.", sub: "A couple minutes in. Willpower intact." };
  if (minutes < 15)
    return { title: "Clock's ticking.", sub: "The scroll is starting to pull." };
  if (minutes < 30)
    return { title: "Time's slipping.", sub: "That's a real chunk of today. Stretch?" };
  if (minutes < 60)
    return { title: "Deep in it.", sub: "Most of an hour, gone. Go touch grass." };
  if (minutes < 120)
    return { title: "Where'd the day go?", sub: "Over an hour scrolling. Outside. Now." };
  return {
    title: "Bruh.",
    sub: "2+ hours scrolling. What are you even doing with your life?",
  };
}

/** Runs once on mount; the returned cleanup runs on unmount. */
function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

export default function App() {
  const [status, setStatus] = useState<DoomguardStatus | null>(() => getStatus());
  const [confirmGuilt, setConfirmGuilt] = useState(false);
  const [screen, setScreen] = useState<"home" | "history">("home");
  const [catsOpen, setCatsOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Read the latest screen from a ref so the back-handler subscribes once
  // (mount-only) rather than re-subscribing on every navigation.
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const refresh = useCallback(() => setStatus(getStatus()), []);

  // The accessibility service sets an openCats flag when "Watch a cat instead"
  // is tapped on a nudge; consume it on resume and open the gallery.
  const checkOpenCats = useCallback(() => {
    if (consumeOpenCats()) setCatsOpen(true);
  }, []);

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
    checkOpenCats();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncStatus();
        checkOpenCats();
      }
    });
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screenRef.current === "history") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => {
      subscription.remove();
      backSub.remove();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  });

  const overlayDone = status?.overlay === true;
  const accessibilityDone = status?.accessibilityRunning === true;
  const allReady = overlayDone && accessibilityDone;
  const mode: DoomguardMode = status?.mode ?? "guilt";
  const seconds = status?.todaySeconds ?? 0;
  const count = status?.todayCount ?? 0;
  const shorts = status?.todayShorts ?? 0;

  const changeMode = useCallback(
    (next: DoomguardMode) => {
      if (next === mode) return;
      // Leaving Block mode is the moment of weakness, so make them confirm.
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

  if (screen === "history") {
    return <HistoryScreen onBack={() => setScreen("home")} />;
  }

  return (
    <View className="flex-1 bg-ink">
      <SafeAreaView className="flex-1">
        <StatusBar style="light" />
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="grow px-6 pb-7 pt-4">
            <Brand on={allReady} />

            {Platform.OS !== "android" ? (
              <View className="mt-10 rounded-3xl bg-panel p-6">
                <Text className="text-[15px] leading-6 text-ash">
                  The Reel counter is Android only. It relies on Android's overlay
                  and accessibility features. Install the Android build to use it.
                </Text>
              </View>
            ) : allReady ? (
              <Dashboard
                mode={mode}
                seconds={seconds}
                count={count}
                shorts={shorts}
                onChangeMode={changeMode}
                onOpenHistory={() => setScreen("history")}
                onOpenCats={() => setCatsOpen(true)}
              />
            ) : (
              <Onboarding
                overlayDone={overlayDone}
                accessibilityDone={accessibilityDone}
              />
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      <PushThroughModal
        visible={confirmGuilt}
        onKeepBlocking={() => setConfirmGuilt(false)}
        onGiveIn={giveIn}
      />

      <CatGallery visible={catsOpen} onClose={() => setCatsOpen(false)} />
    </View>
  );
}

const PRIVACY = (
  <Text className="text-[12.5px] leading-5 text-dim">
    Doomguard only reads Instagram &amp; YouTube's screen,{" "}
    <Text className="font-medium text-ash">nothing else</Text>. Your count lives
    only on this device.
  </Text>
);

function Dashboard({
  mode,
  seconds,
  count,
  shorts,
  onChangeMode,
  onOpenHistory,
  onOpenCats,
}: {
  mode: DoomguardMode;
  seconds: number;
  count: number;
  shorts: number;
  onChangeMode: (mode: DoomguardMode) => void;
  onOpenHistory: () => void;
  onOpenCats: () => void;
}) {
  const minutes = Math.floor(seconds / 60);
  const v = vibe(minutes);

  return (
    <View className="grow">
      {mode === "guilt" ? (
        <View className="mt-12">
          <Kicker>Time wasted · today</Kicker>
          <View className="mt-4 flex-row items-end">
            <Text
              className="font-semibold text-bone"
              style={{ fontSize: 84, lineHeight: 84, letterSpacing: -3, fontVariant: ["tabular-nums"] }}
            >
              {minutes}
            </Text>
            <Text className="mb-3 ml-2 font-medium text-dim" style={{ fontSize: 26 }}>
              min
            </Text>
          </View>
          <Text className="mt-3 text-[16px] text-ash">doomscrolling so far</Text>
          <Counts count={count} shorts={shorts} />
          <View className="mt-8">
            <Track value={rednessForMinutes(minutes)} />
          </View>
          <View className="mt-7">
            <Text className="text-[20px] font-semibold text-bone">{v.title}</Text>
            <Text className="mt-1.5 text-[15px] leading-snug text-ash">{v.sub}</Text>
          </View>
        </View>
      ) : (
        <View className="mt-14">
          <View
            className="h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(56,199,134,0.14)" }}
          >
            <Ionicons name="shield-checkmark" size={30} color={C.toxic} />
          </View>
          <View className="mt-5">
            <Kicker color={C.toxic}>Block · armed</Kicker>
            <Text className="mt-3 text-[30px] font-semibold text-bone" style={{ letterSpacing: -0.5 }}>
              Reels can't reach you.
            </Text>
            <Text className="mt-2.5 text-[15px] leading-snug text-ash">
              New reels and shorts get bounced the instant they appear — so
              today's tally stops climbing.
            </Text>
          </View>
          <Counts count={count} shorts={shorts} suffix="logged today" />
        </View>
      )}

      <View className="mt-8">
        <ModeSwitch mode={mode} onChangeMode={onChangeMode} />
      </View>

      <View className="mt-auto pt-8">
        <Pressable
          onPress={onOpenCats}
          className="items-center rounded-2xl bg-panel py-4 active:opacity-80"
        >
          <Text className="text-[15.5px] font-semibold text-bone">Cats, not reels</Text>
        </Pressable>
        <Pressable
          onPress={onOpenHistory}
          className="mt-3 flex-row items-center justify-between border-t border-bone/10 px-0.5 py-4 active:opacity-60"
        >
          <Text className="text-[15.5px] font-medium text-bone">View history</Text>
          <Ionicons name="chevron-forward" size={18} color={C.dim} />
        </Pressable>
        <View className="mt-4">{PRIVACY}</View>
      </View>
    </View>
  );
}

function Counts({
  count,
  shorts,
  suffix,
}: {
  count: number;
  shorts: number;
  suffix?: string;
}) {
  return (
    <Text className="mt-1.5 text-[15px] text-ash">
      <Text className="font-semibold text-bone">{count}</Text>{" "}
      {count === 1 ? "reel" : "reels"}
      {"   ·   "}
      <Text className="font-semibold text-bone">{shorts}</Text>{" "}
      {shorts === 1 ? "short" : "shorts"}
      {suffix ? <Text className="text-dim">{`  ${suffix}`}</Text> : null}
    </Text>
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
      <View className="flex-row gap-1 rounded-2xl bg-panel p-1">
        <ModeOption
          active={mode === "guilt"}
          icon="stopwatch-outline"
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
      <Text className="px-0.5 text-[13.5px] leading-snug text-ash">
        {mode === "guilt"
          ? "Guilt — watch all you want, the clock keeps time."
          : "Block — Doomguard backs you out of every reel and short."}
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
  const activeBg = accent ? "bg-toxic" : "bg-panelhi";
  const iconColor = active ? (accent ? C.ink : C.bone) : C.ash;
  const textClass = active ? (accent ? "text-ink" : "text-bone") : "text-ash";
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
        active ? activeBg : ""
      }`}
    >
      <Ionicons name={icon} size={17} color={iconColor} />
      <Text className={`text-[14.5px] font-semibold ${textClass}`}>{label}</Text>
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
      <View className="flex-1 justify-end bg-black/60 p-4">
        <View className="gap-5 rounded-[28px] bg-panel p-6">
          <View className="gap-2">
            <Kicker>Leaving block mode</Kicker>
            <Text className="text-[24px] font-semibold text-bone" style={{ letterSpacing: -0.4 }}>
              Going soft already?
            </Text>
            <Text className="text-[14.5px] leading-6 text-ash">
              You're in Block mode and the reels can't touch you. Switch back and
              you're choosing to feed the addiction. Why not just push through?
            </Text>
          </View>
          <View className="gap-2.5">
            <Pressable
              onPress={onKeepBlocking}
              className="items-center rounded-2xl bg-toxic py-4 active:opacity-80"
            >
              <Text className="text-[15.5px] font-semibold text-ink">Keep blocking</Text>
            </Pressable>
            <Pressable
              onPress={onGiveIn}
              className="items-center rounded-2xl py-3 active:opacity-60"
            >
              <Text className="text-[15px] font-medium text-dim">I'll give in</Text>
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
  const armed = (overlayDone ? 1 : 0) + (accessibilityDone ? 1 : 0);
  return (
    <View className="grow">
      <View className="mt-9">
        <Kicker>{`Setup · ${armed} of 2`}</Kicker>
        <Text className="mt-3.5 text-[27px] font-semibold text-bone" style={{ letterSpacing: -0.5 }}>
          Two quick permissions.
        </Text>
        <Text className="mt-2.5 text-[15px] leading-snug text-ash">
          Doomguard times the reels and shorts you watch each day.
        </Text>
      </View>

      <View className="mt-9">
        <SetupStep
          index={1}
          title="Allow drawing over apps"
          body="Lets the counter float on top of Instagram."
          action="Open overlay permission"
          onPress={openOverlaySettings}
          done={overlayDone}
          first
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

      <View className="mt-auto pt-8">{PRIVACY}</View>
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
  first,
}: {
  index: number;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  done: boolean;
  first?: boolean;
}) {
  return (
    <View
      className={`flex-row gap-4 border-b border-bone/10 py-6 ${first ? "border-t" : ""}`}
    >
      <View
        className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full ${
          done ? "bg-toxic" : "border border-bone/15"
        }`}
      >
        {done ? (
          <Ionicons name="checkmark" size={16} color={C.ink} />
        ) : (
          <Text className="text-[13px] font-semibold text-ash">{index}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-[16.5px] font-semibold text-bone">{title}</Text>
        <Text className="mt-1.5 text-[13.5px] leading-5 text-ash">{body}</Text>
        {done ? (
          <View className="mt-3 flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={16} color={C.toxic} />
            <Text className="text-[13px] font-semibold text-toxic">Enabled</Text>
          </View>
        ) : (
          <Pressable
            onPress={onPress}
            className="mt-3 flex-row items-center gap-1.5 active:opacity-60"
          >
            <Text className="text-[14px] font-semibold text-bone">{action}</Text>
            <Ionicons name="chevron-forward" size={15} color={C.bone} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
