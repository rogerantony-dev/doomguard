import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as IntentLauncher from "expo-intent-launcher";

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

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar style="light" />
      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
        <View className="grow gap-8 px-6 py-8">
        <View className="gap-2">
          <Text className="text-4xl font-bold text-white">Doomguard</Text>
          <Text className="text-base text-zinc-400">
            Counts the Reels you watch on Instagram each day. The total floats in
            a pill on top of the Reels feed and resets every morning.
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
            />

            <SetupStep
              index={2}
              title="Enable the accessibility service"
              body="Find “Doomguard Reel Counter” in the list and turn it on. This is how the app knows when you're watching Reels."
              action="Open accessibility settings"
              onPress={openAccessibilitySettings}
            />
          </View>
        )}

        <View className="mt-auto rounded-2xl bg-zinc-900 p-5">
          <Text className="text-sm leading-5 text-zinc-400">
            Once both are on, open Instagram and start scrolling Reels — the pill
            appears at the top. Doomguard only reads Instagram's screen, nothing
            else, and the count lives only on your device.
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
}: {
  index: number;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View className="gap-3 rounded-2xl bg-zinc-900 p-5">
      <View className="flex-row items-center gap-3">
        <View className="h-7 w-7 items-center justify-center rounded-full bg-white">
          <Text className="text-sm font-bold text-zinc-950">{index}</Text>
        </View>
        <Text className="flex-1 text-lg font-semibold text-white">{title}</Text>
      </View>
      <Text className="text-sm leading-5 text-zinc-400">{body}</Text>
      <Pressable
        onPress={onPress}
        className="items-center rounded-xl bg-white px-4 py-3 active:opacity-80"
      >
        <Text className="text-base font-semibold text-zinc-950">{action}</Text>
      </Pressable>
    </View>
  );
}
