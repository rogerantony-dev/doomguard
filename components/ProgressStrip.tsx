import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./console";

/**
 * Slim positive-reinforcement strip: current streak + banked points, with
 * today's not-yet-banked points alongside so the number never seems to shrink.
 */
export function ProgressStrip({
  streak,
  best,
  points,
  pendingPoints,
  onPress,
}: {
  streak: number;
  best: number;
  points: number;
  pendingPoints: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mt-4 flex-row items-center justify-between rounded-2xl bg-panel px-4 py-3 active:opacity-80"
    >
      <View className="flex-row items-center gap-2">
        <Ionicons name="flame" size={17} color={C.toxic} />
        <Text className="text-[15px] font-semibold text-bone">
          {streak}
          <Text className="font-medium text-ash">{streak === 1 ? " day clean" : " days clean"}</Text>
        </Text>
        {best > streak ? <Text className="text-[12.5px] text-dim">best {best}</Text> : null}
      </View>
      <Text className="text-[14px] font-medium text-ash">
        <Text className="font-semibold text-bone">{points.toLocaleString()}</Text> pts
        {pendingPoints > 0 ? <Text className="text-dim">  +{pendingPoints} today</Text> : null}
      </Text>
    </Pressable>
  );
}
