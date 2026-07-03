import { useRef } from "react";
import {
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { CATS } from "./cats";
import { C } from "./console";

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
  const { width, height: screenH } = useWindowDimensions();
  const tile = (width - PAGE_PADDING * 2 - GAP) / 2;

  const dismissRef = useRef(screenH);
  dismissRef.current = screenH;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const translateY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 130 || g.vy > 0.8) {
          Animated.timing(translateY, {
            toValue: dismissRef.current,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            closeRef.current();
            translateY.setValue(0);
          });
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Animated.View style={{ flex: 1, transform: [{ translateY }] }} className="bg-ink">
        <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
        <View {...pan.panHandlers} className="px-6 pt-2">
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: C.panelhi,
            }}
          />
          <View className="mt-3 flex-row items-start justify-between">
            <View className="flex-1 gap-1.5">
              <Text className="text-[26px] font-semibold text-bone" style={{ letterSpacing: -0.6 }}>
                Cats, not reels
              </Text>
              <Text className="text-[14px] text-ash">
                Rest your eyes on something better.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-panel active:opacity-70"
            >
              <Ionicons name="close" size={22} color={C.ash} />
            </Pressable>
          </View>
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
      </Animated.View>
    </Modal>
  );
}
