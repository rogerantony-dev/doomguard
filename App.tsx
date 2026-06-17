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

import { CatGallery } from "./components/CatGallery";
import { StopwatchGraphic } from "./components/StopwatchGraphic";
import {
  C,
  CatsButton,
  Glow,
  HazardStrip,
  Instrument,
  Label,
  Meter,
  Mono,
  Scanlines,
  SectionRule,
  StatusStrip,
} from "./components/console";
import {
  getStatus,
  getStatusDebug,
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
  const seconds = status?.todaySeconds ?? 0;
  const count = status?.todayCount ?? 0;
  const shorts = status?.todayShorts ?? 0;

  const blocking = allReady && mode === "block";
  const accent = blocking ? C.toxic : C.ember;

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

  return (
    <View className="flex-1 bg-ink">
      <Glow color={accent} />
      <Scanlines />
      <SafeAreaView className="flex-1">
        <StatusBar style="light" />
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="grow gap-7 px-5 py-5">
            <Header
              tone={blocking ? "toxic" : "ember"}
              tagline={
                !allReady
                  ? "Times the reels and shorts you watch each day."
                  : blocking
                    ? "Reels can't reach you."
                    : "Your daily scroll habit, on the clock."
              }
            />

            {Platform.OS !== "android" ? (
              <Instrument className="p-5">
                <Text className="text-base leading-6 text-ash">
                  The Reel counter is Android only. It relies on Android's overlay
                  and accessibility features. Install the Android build to use it.
                </Text>
              </Instrument>
            ) : allReady ? (
              <Dashboard
                mode={mode}
                seconds={seconds}
                count={count}
                shorts={shorts}
                onChangeMode={changeMode}
              />
            ) : (
              <Onboarding
                overlayDone={overlayDone}
                accessibilityDone={accessibilityDone}
              />
            )}

            <View className="mt-auto border-t border-bone/10 pt-4">
              <Text className="text-[12.5px] leading-5 text-dim">
                Doomguard only reads Instagram &amp; YouTube's screen,{" "}
                <Text className="font-semibold text-ash">nothing else</Text>, and
                your count lives only on this device.
              </Text>
            </View>

            {/* TEMP diagnostics — remove once status is trusted. */}
            <Diagnostics />
          </View>
        </ScrollView>
      </SafeAreaView>

      <PushThroughModal
        visible={confirmGuilt}
        onKeepBlocking={() => setConfirmGuilt(false)}
        onGiveIn={giveIn}
      />
    </View>
  );
}

function Header({
  tone,
  tagline,
}: {
  tone: "ember" | "toxic";
  tagline: string;
}) {
  return (
    <View className="gap-4">
      <StatusStrip label={tone === "toxic" ? "Block · Armed" : "Monitoring"} tone={tone} />
      <View>
        <Text
          className="text-[40px] font-extrabold text-bone"
          style={{ letterSpacing: -1, lineHeight: 42 }}
        >
          DOOM<Text className={tone === "toxic" ? "text-toxic" : "text-ember"}>GUARD</Text>
        </Text>
        <Text className="mt-1.5 text-[14px] text-ash">{tagline}</Text>
      </View>
    </View>
  );
}

function Dashboard({
  mode,
  seconds,
  count,
  shorts,
  onChangeMode,
}: {
  mode: DoomguardMode;
  seconds: number;
  count: number;
  shorts: number;
  onChangeMode: (mode: DoomguardMode) => void;
}) {
  const [catsOpen, setCatsOpen] = useState(false);
  const minutes = Math.floor(seconds / 60);
  const v = vibe(minutes);
  return (
    <View className="gap-6">
      {mode === "guilt" ? (
        <Instrument className="items-center gap-4 px-5 py-6">
          <Label style={{ alignSelf: "flex-start" }}>{"// TIME WASTED · TODAY"}</Label>
          <StopwatchGraphic
            intensity={rednessForMinutes(minutes)}
            minutes={minutes}
            size={170}
          />
          <View className="flex-row items-baseline gap-2.5">
            <Mono className="text-[72px] font-bold text-bone" style={{ lineHeight: 72 }}>
              {minutes}
            </Mono>
            <Text className="mb-2 text-[15px] text-ash">
              {minutes === 1 ? "min" : "mins"}{"\n"}doomscrolling
            </Text>
          </View>
          <Meter value={rednessForMinutes(minutes)} />
          <View className="mt-1 flex-row gap-2.5">
            <CountChip color="#E1306C" value={count} unit={count === 1 ? "reel" : "reels"} />
            <CountChip color="#FF0000" value={shorts} unit={shorts === 1 ? "short" : "shorts"} />
          </View>
          <View className="mt-1 items-center gap-1">
            <Text className="text-[21px] font-bold text-bone">{v.title}</Text>
            <Text className="text-center text-[13.5px] text-ash">{v.sub}</Text>
          </View>
        </Instrument>
      ) : (
        <Instrument className="items-center gap-4 px-5 py-7">
          <Label color={C.toxic} style={{ alignSelf: "flex-start" }}>
            {"// PERIMETER · ACTIVE"}
          </Label>
          <View
            className="h-24 w-24 items-center justify-center rounded-full border border-toxic/30"
            style={{ backgroundColor: "rgba(61,220,132,0.10)" }}
          >
            <Ionicons name="shield-checkmark" size={54} color={C.toxic} />
          </View>
          <Text className="text-[22px] font-bold text-bone">Block mode engaged</Text>
          <View className="flex-row items-baseline gap-2.5">
            <Mono className="text-[64px] font-bold text-toxic" style={{ lineHeight: 64 }}>
              {minutes}
            </Mono>
            <Text className="mb-2 text-[15px] text-ash">
              {minutes === 1 ? "min" : "mins"}{"\n"}logged today
            </Text>
          </View>
          <View className="mt-1 flex-row gap-2.5">
            <CountChip color="#E1306C" value={count} unit={count === 1 ? "reel" : "reels"} />
            <CountChip color="#FF0000" value={shorts} unit={shorts === 1 ? "short" : "shorts"} />
          </View>
          <Text className="max-w-[270px] text-center text-[13.5px] text-ash">
            Today's tally so far. New reels and shorts get bounced the instant
            they appear — so this stops climbing.
          </Text>
        </Instrument>
      )}

      <CatsButton onPress={() => setCatsOpen(true)} />

      <ModeSwitch mode={mode} onChangeMode={onChangeMode} />

      <CatGallery visible={catsOpen} onClose={() => setCatsOpen(false)} />
    </View>
  );
}

function CountChip({
  color,
  value,
  unit,
}: {
  color: string;
  value: number;
  unit: string;
}) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-full border border-bone/10 bg-[#16161C] px-4 py-2">
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Mono className="text-[15px] font-bold text-bone">{value}</Mono>
      <Text className="text-[12px] text-ash">{unit}</Text>
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
      <SectionRule>MODE</SectionRule>
      <View className="flex-row gap-1.5 rounded-2xl border border-bone/10 bg-ink2 p-1.5">
        <ModeOption
          active={mode === "guilt"}
          icon="stopwatch"
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
      <Text className="px-1 text-[13px] text-ash">
        {mode === "guilt"
          ? "Guilt. Watch all you want — the clock keeps time."
          : "Block (pro). Doomguard backs you out of every reel and short."}
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
  const activeBg = accent ? "bg-toxic" : "bg-bone";
  const activeText = accent ? "text-toxicdeep" : "text-ink";
  const iconColor = active ? (accent ? C.toxicdeep : C.ink) : C.ash;
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3 ${
        active ? activeBg : ""
      }`}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text
        className={`text-[15px] font-bold ${active ? activeText : "text-ash"}`}
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
      <View className="flex-1 items-center justify-center bg-black/75 px-7">
        <Instrument className="w-full gap-5 p-6">
          <View
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(245,165,36,0.15)" }}
          >
            <Ionicons name="flame" size={30} color={C.amber} />
          </View>
          <View className="gap-2">
            <Text className="text-[23px] font-bold text-bone">
              Going soft already?
            </Text>
            <Text className="text-[14.5px] leading-6 text-ash">
              You're in Block mode and the reels can't touch you. Switch back and
              you're choosing to feed the addiction. Why not just push through?
            </Text>
          </View>
          <HazardStrip />
          <View className="gap-3">
            <Pressable
              onPress={onKeepBlocking}
              className="items-center rounded-xl bg-toxic px-4 py-3.5 active:opacity-80"
            >
              <Text className="text-[15px] font-bold text-toxicdeep">
                Keep blocking 🛡️
              </Text>
            </Pressable>
            <Pressable
              onPress={onGiveIn}
              className="items-center rounded-xl px-4 py-2 active:opacity-60"
            >
              <Text className="text-[15px] font-medium text-dim">
                I'll give in 😔
              </Text>
            </Pressable>
          </View>
        </Instrument>
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
    <View className="gap-4">
      <HazardStrip />
      <SectionRule>{`SETUP · ${armed} OF 2 ARMED`}</SectionRule>

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
      className={`relative gap-3 overflow-hidden rounded-[20px] border p-5 ${
        done ? "border-toxic/40" : "border-bone/10"
      }`}
      style={{ backgroundColor: done ? "rgba(15,58,36,0.45)" : C.panel }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            done ? "bg-toxic" : "bg-bone"
          }`}
        >
          {done ? (
            <Ionicons name="checkmark" size={18} color={C.toxicdeep} />
          ) : (
            <Mono className="text-sm font-bold text-ink">{index}</Mono>
          )}
        </View>
        <Text className="flex-1 text-[17px] font-bold text-bone">{title}</Text>
      </View>
      <Text className="text-[13.5px] leading-5 text-ash">{body}</Text>
      {done ? (
        <View className="flex-row items-center justify-center gap-2 rounded-xl px-4 py-3"
          style={{ backgroundColor: "rgba(61,220,132,0.14)" }}>
          <Ionicons name="checkmark-circle" size={18} color={C.toxic} />
          <Label color={C.toxic}>Enabled</Label>
        </View>
      ) : (
        <Pressable
          onPress={onPress}
          className="items-center rounded-xl bg-bone px-4 py-3 active:opacity-80"
        >
          <Text className="text-[15px] font-bold text-ink">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Diagnostics() {
  return (
    <View className="gap-2 rounded-[14px] border border-amber/30 p-4"
      style={{ backgroundColor: "rgba(245,165,36,0.06)" }}>
      <Label color={C.amber}>{"// DIAGNOSTICS"}</Label>
      <Mono className="text-[11px] leading-4 text-amber/90">
        {JSON.stringify(getStatusDebug(), null, 2)}
      </Mono>
    </View>
  );
}
