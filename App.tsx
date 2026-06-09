import { useCallback, useEffect, useState } from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as IntentLauncher from "expo-intent-launcher";

import { getStatus, type DoomguardStatus } from "./modules/doomguardnative";
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
    // Fallback to the generic overlay list if the direct deep-link is unsupported.
    IntentLauncher.startActivityAsync(
      "android.settings.action.MANAGE_OVERLAY_PERMISSION"
    ).catch(() => {});
  });
}

/** Runs once on mount; the returned cleanup runs on unmount. */
function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

export default function App() {
  const [status, setStatus] = useState<DoomguardStatus | null>(() => getStatus());

  const refresh = useCallback(() => setStatus(getStatus()), []);

  useMountEffect(() => {
    refresh();
    // Re-check whenever the app comes back to the foreground — e.g. after the
    // user toggles a permission in Settings and returns.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  });

  const overlayDone = status?.overlay === true;
  const accessibilityDone = status?.accessibilityRunning === true;
  const allReady = overlayDone && accessibilityDone;

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar style="light" />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="grow gap-8 px-6 py-8">
          <View className="gap-2">
            <Text className="text-4xl font-bold text-white">Doomguard</Text>
            <Text className="text-base text-zinc-400">
              Counts the Reels you watch on Instagram each day. The total floats
              in a pill on top of the Reels feed and resets every morning.
            </Text>
          </View>

          {Platform.OS !== "android" ? (
            <View className="rounded-2xl bg-zinc-900 p-5">
              <Text className="text-base text-zinc-300">
                The Reel counter is Android-only — it relies on Android's overlay
                and accessibility features. Install the Android build to use it.
              </Text>
            </View>
          ) : (
            <>
              {allReady && (
                <View className="rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-5">
                  <Text className="text-sm font-medium text-emerald-400">
                    All set — tracking is on.
                  </Text>
                  <Text className="mt-1 text-3xl font-bold text-white">
                    {status?.todayCount ?? 0}{" "}
                    {status?.todayCount === 1 ? "reel" : "reels"} today
                  </Text>
                </View>
              )}

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
            </>
          )}

          <View className="mt-auto rounded-2xl bg-zinc-900 p-5">
            <Text className="text-sm leading-5 text-zinc-400">
              Open Instagram and start scrolling Reels — a pill appears at the top
              with an eye that grows bloodshot the more you watch (calm under 50,
              fully red as the day's count climbs). Doomguard only reads
              Instagram's screen, nothing else, and the count lives only on your
              device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
        done ? "border-emerald-500/40 bg-emerald-950/30" : "border-transparent bg-zinc-900"
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View
          className={`h-7 w-7 items-center justify-center rounded-full ${
            done ? "bg-emerald-500" : "bg-white"
          }`}
        >
          <Text
            className={`text-sm font-bold ${done ? "text-white" : "text-zinc-950"}`}
          >
            {done ? "✓" : index}
          </Text>
        </View>
        <Text className="flex-1 text-lg font-semibold text-white">{title}</Text>
      </View>
      <Text className="text-sm leading-5 text-zinc-400">{body}</Text>
      {done ? (
        <View className="items-center rounded-xl bg-emerald-500/15 px-4 py-3">
          <Text className="text-base font-semibold text-emerald-400">
            ✓ Enabled
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
