import { type ReactNode, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as IntentLauncher from "expo-intent-launcher";

import { C } from "./console";
import { CATS } from "./cats";

const ANDROID_PACKAGE = "com.rogerantony.doomguard";
const WASTE = "#E0913C";
const PAGES = 6;

function openAccessibilitySettings() {
  IntentLauncher.startActivityAsync("android.settings.ACCESSIBILITY_SETTINGS").catch(() => {});
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

/**
 * First-run flow: a swipeable, 6-page tour that sells the features before asking
 * for the two permissions. Shows only while setup is incomplete; once both
 * permissions are live the app swaps this out for the dashboard automatically.
 */
export function OnboardingFlow({
  overlayDone,
  accessibilityDone,
}: {
  overlayDone: boolean;
  accessibilityDone: boolean;
}) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [height, setHeight] = useState(0);
  const ref = useRef<ScrollView>(null);

  const goTo = (i: number) => {
    const c = Math.max(0, Math.min(PAGES - 1, i));
    ref.current?.scrollTo({ x: c * width, animated: true });
    setPage(c);
  };

  return (
    <View className="flex-1" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {FEATURES.map((f, i) => (
          <View key={i} style={{ width, height }} className="px-6 pb-3 pt-3">
            <Header index={i} onSkip={() => goTo(PAGES - 1)} />
            <View className="flex-1 items-center justify-center">
              {f.art}
              <View className="mt-9 items-center">
                <Text
                  className="text-center text-[30px] font-semibold text-bone"
                  style={{ letterSpacing: -0.6, lineHeight: 34 }}
                >
                  {f.title}
                </Text>
                <Text
                  className="mt-3 text-center text-[15px] leading-relaxed text-ash"
                  style={{ maxWidth: 300 }}
                >
                  {f.sub}
                </Text>
              </View>
            </View>
            <View className="gap-5">
              <Dots active={i} />
              <Primary label={f.cta} onPress={() => goTo(i + 1)} />
            </View>
          </View>
        ))}

        <View style={{ width, height }} className="px-6 pb-3 pt-3">
          <Header index={PAGES - 1} onSkip={() => {}} />
          <View className="flex-1 justify-center">
            <Text
              className="text-[27px] font-semibold text-bone"
              style={{ letterSpacing: -0.5 }}
            >
              Two quick permissions.
            </Text>
            <Text className="mt-2.5 text-[14px] leading-relaxed text-ash">
              This is how Doomguard sees Reels and floats the timer. It only reads
              Instagram and YouTube, nothing else, and your data stays on this
              device.
            </Text>
            <View className="mt-6">
              <Step
                index={1}
                done={overlayDone}
                title="Draw over other apps"
                body="Lets the timer float on top of Instagram."
                action="Open overlay permission"
                onPress={openOverlaySettings}
                first
              />
              <Step
                index={2}
                done={accessibilityDone}
                title="Enable the accessibility service"
                body="Find “Doomguard Reel Counter” in the list and turn it on. This is how it knows when you're watching Reels."
                action="Open accessibility settings"
                onPress={openAccessibilitySettings}
              />
            </View>
          </View>
          <View className="gap-5 pb-1">
            <Dots active={PAGES - 1} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const FEATURES: { art: ReactNode; title: string; sub: string; cta: string }[] = [
  {
    art: <MiniWall fill={28} total={48} />,
    title: "Your scroll,\non the clock.",
    sub: "Doomguard times the Reels and Shorts eating your day, and helps you stop.",
    cta: "Get started",
  },
  {
    art: <TimeArt />,
    title: "See it stack up.",
    sub: "Every wasted minute fills a daily limit you set. Cross it and it turns red.",
    cta: "Next",
  },
  {
    art: <BlockArt />,
    title: "Or block it cold.",
    sub: "Block mode backs you out of every reel and short the instant it appears.",
    cta: "Next",
  },
  {
    art: <NudgeArt />,
    title: "A nudge to look away.",
    sub: "Spiraling? Doomguard interrupts with a nudge, and a cat to watch instead of the feed.",
    cta: "Next",
  },
  {
    art: <EverywhereArt />,
    title: "Always in sight.",
    sub: "A floating timer while you scroll, and a home-screen widget, so the damage is never hidden.",
    cta: "Next",
  },
];

function Header({ index, onSkip }: { index: number; onSkip: () => void }) {
  const dim = index === PAGES - 1;
  const canSkip = index >= 1 && index <= 4;
  return (
    <View className="h-8 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2.5">
        <View
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dim ? C.dim : C.toxic }}
        />
        <Text className="text-[15px] font-semibold text-bone">Doomguard</Text>
      </View>
      {canSkip ? (
        <Pressable onPress={onSkip} hitSlop={12} className="active:opacity-60">
          <Text className="text-[13px] font-semibold text-dim">Skip</Text>
        </Pressable>
      ) : (
        <View style={{ width: 30 }} />
      )}
    </View>
  );
}

function Dots({ active }: { active: number }) {
  return (
    <View className="flex-row justify-center gap-1.5">
      {Array.from({ length: PAGES }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 7,
            borderRadius: 4,
            width: i === active ? 22 : 7,
            backgroundColor: i === active ? C.bone : C.panelhi,
          }}
        />
      ))}
    </View>
  );
}

function Primary({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center rounded-2xl bg-bone py-4 active:opacity-80"
    >
      <Text className="text-[16px] font-semibold text-ink">{label}</Text>
    </Pressable>
  );
}

function MiniWall({ fill, total }: { fill: number; total: number }) {
  return (
    <View
      style={{ width: 230, flexDirection: "row", flexWrap: "wrap", gap: 5, justifyContent: "center" }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 15,
            height: 15,
            borderRadius: 3,
            backgroundColor: i < fill ? WASTE : "transparent",
            borderWidth: i < fill ? 0 : 1,
            borderColor: "rgba(224,145,60,0.20)",
          }}
        />
      ))}
    </View>
  );
}

function TimeArt() {
  return (
    <View className="items-center">
      <View className="flex-row items-baseline">
        <Text
          className="font-semibold"
          style={{ fontSize: 56, lineHeight: 56, color: WASTE, letterSpacing: -2, fontVariant: ["tabular-nums"] }}
        >
          23
        </Text>
        <Text className="ml-2 text-dim" style={{ fontSize: 18 }}>
          min
        </Text>
      </View>
      <View className="mt-4">
        <MiniWall fill={23} total={60} />
      </View>
      <Text
        className="mt-3 text-[11px] font-semibold uppercase"
        style={{ color: WASTE, letterSpacing: 0.5 }}
      >
        37 min left of your 60-min limit
      </Text>
    </View>
  );
}

function BlockArt() {
  return (
    <View className="items-center">
      <View
        className="h-24 w-24 items-center justify-center rounded-full"
        style={{ backgroundColor: "rgba(56,199,134,0.14)" }}
      >
        <Ionicons name="shield-checkmark" size={44} color={C.toxic} />
      </View>
      <View className="mt-6 flex-row gap-1 rounded-2xl bg-panel p-1" style={{ width: 230 }}>
        <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3">
          <Ionicons name="stopwatch-outline" size={15} color={C.ash} />
          <Text className="text-[14px] font-semibold text-ash">Guilt</Text>
        </View>
        <View className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-toxic py-3">
          <Ionicons name="shield-checkmark" size={15} color={C.ink} />
          <Text className="text-[14px] font-semibold text-ink">Block</Text>
        </View>
      </View>
    </View>
  );
}

function NudgeArt() {
  return (
    <View style={{ width: 250 }} className="rounded-[22px] border border-bone/10 bg-panel p-4">
      <Image
        source={CATS[0]}
        style={{ width: "100%", height: 104, borderRadius: 14 }}
        resizeMode="cover"
      />
      <View
        className="mt-3 self-start rounded-full px-2.5 py-1"
        style={{ backgroundColor: "rgba(224,145,60,0.14)" }}
      >
        <Text className="text-[9.5px] font-semibold uppercase" style={{ color: WASTE, letterSpacing: 0.8 }}>
          30 min today
        </Text>
      </View>
      <Text className="mt-2 text-[18px] font-semibold text-bone">Half an hour, gone.</Text>
      <View className="mt-3 items-center rounded-xl bg-bone py-2.5">
        <Text className="text-[13px] font-semibold text-ink">Watch a cat instead</Text>
      </View>
      <Text className="mt-1.5 text-center text-[12.5px] font-medium text-dim">Keep scrolling</Text>
    </View>
  );
}

function EverywhereArt() {
  return (
    <View className="items-center">
      <View style={{ width: 250 }} className="rounded-[20px] border border-bone/10 bg-panel p-[18px]">
        <Text className="text-[10px] font-bold uppercase text-ash" style={{ letterSpacing: 1.6 }}>
          Doomguard
        </Text>
        <View className="mt-1.5 flex-row items-baseline gap-2">
          <Text className="font-bold" style={{ fontSize: 30, color: WASTE }}>
            23m
          </Text>
          <Text className="text-[12px] text-ash">wasted today</Text>
        </View>
        <Text className="mt-1 text-[10px] font-bold uppercase" style={{ color: WASTE, letterSpacing: 0.4 }}>
          37 min left of your limit
        </Text>
        <Text className="mt-2.5 text-[13px] text-ash">14 reels    7 shorts</Text>
      </View>
      <View
        className="mt-4 flex-row items-center gap-2.5 rounded-[20px] border border-bone/10 px-4 py-2.5"
        style={{ backgroundColor: "rgba(26,26,24,0.96)" }}
      >
        <PillRing frac={0.38} />
        <Text className="text-[14px] font-bold text-white">23 min scrolling</Text>
      </View>
    </View>
  );
}

function PillRing({ frac }: { frac: number }) {
  const R = 40;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - Math.min(frac, 1));
  return (
    <Svg width={24} height={24} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r={R} stroke="rgba(224,145,60,0.30)" strokeWidth={13} fill="none" />
      <Circle
        cx="50"
        cy="50"
        r={R}
        stroke={WASTE}
        strokeWidth={13}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        rotation={-90}
        originX={50}
        originY={50}
      />
    </Svg>
  );
}

function Step({
  index,
  done,
  title,
  body,
  action,
  onPress,
  first,
}: {
  index: number;
  done: boolean;
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  first?: boolean;
}) {
  return (
    <View className={`flex-row gap-4 border-b border-bone/10 py-5 ${first ? "border-t" : ""}`}>
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
        <Text className="text-[16px] font-semibold text-bone">{title}</Text>
        <Text className="mt-1.5 text-[13px] leading-5 text-ash">{body}</Text>
        {done ? (
          <View className="mt-2.5 flex-row items-center gap-1.5">
            <Ionicons name="checkmark-circle" size={15} color={C.toxic} />
            <Text className="text-[12.5px] font-semibold text-toxic">Enabled</Text>
          </View>
        ) : (
          <Pressable onPress={onPress} className="mt-2.5 flex-row items-center gap-1.5 active:opacity-60">
            <Text className="text-[13.5px] font-semibold text-bone">{action}</Text>
            <Ionicons name="chevron-forward" size={14} color={C.bone} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
