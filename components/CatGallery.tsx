import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { CATS } from "./cats";
import { C, Glow, Label } from "./console";

const GAP = 12;
const PAGE_PADDING = 20;

/** A full-screen gallery of cat pictures: a healthier thing to scroll than reels. */
export function CatGallery({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const tile = (width - PAGE_PADDING * 2 - GAP) / 2;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-ink">
        <Glow color={C.toxic} />
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
          <View className="gap-1">
            <Label color={C.toxic}>{"// REST MODE"}</Label>
            <Text className="text-2xl font-bold text-bone">Cats, not reels</Text>
            <Text className="text-sm text-ash">
              Rest your eyes on something better.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full border border-bone/10 bg-[#16161C] active:opacity-70"
          >
            <Ionicons name="close" size={22} color={C.ash} />
          </Pressable>
        </View>

        {CATS.length === 0 ? (
          <View className="flex-1 items-center justify-center px-10">
            <Text className="text-6xl">🐱</Text>
            <Text className="mt-4 text-center text-base text-ash">
              No cats yet. Add some pictures and they'll show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: PAGE_PADDING, gap: GAP }}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}
            >
              {CATS.map((src, i) => (
                <Image
                  key={i}
                  source={src}
                  style={{ width: tile, height: tile, borderRadius: 18 }}
                  resizeMode="cover"
                />
              ))}
            </View>
          </ScrollView>
        )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
