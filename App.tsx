import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import "./global.css";

type Mode = "block" | "guilt";

export default function App() {
  const [mode, setMode] = useState<Mode>("block");

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <StatusBar style="light" />
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <View className="items-center gap-2">
          <Text className="text-4xl font-bold text-white">Doomguard</Text>
          <Text className="text-base text-zinc-400">Stop the scroll.</Text>
        </View>

        <View className="w-full rounded-2xl bg-zinc-900 p-6">
          <Text className="text-center text-lg font-medium text-white">
            {mode === "block"
              ? "Block mode — scrolling is off."
              : "Guilt mode — scroll, and you'll feel it."}
          </Text>
        </View>

        <View className="w-full flex-row gap-3">
          <ModeButton
            label="Block"
            active={mode === "block"}
            onPress={() => setMode("block")}
          />
          <ModeButton
            label="Guilt"
            active={mode === "guilt"}
            onPress={() => setMode("guilt")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center rounded-xl px-4 py-3 ${
        active ? "bg-white" : "bg-zinc-800"
      }`}
    >
      <Text
        className={`text-base font-semibold ${
          active ? "text-zinc-950" : "text-zinc-300"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
