import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as IntentLauncher from "expo-intent-launcher";

import { C } from "./console";
import { CATS } from "./cats";
import { KitCatClock } from "./KitCatClock";
import { setLimitNow, setMode, type WiltMode } from "../modules/wiltnative";

const ANDROID_PACKAGE = "com.rogerantony.wilt";
const WASTE = "#E0913C";
const PAGES = 4;

function fmtLimit(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

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
 * First-run flow: a swipeable, 4-page tour. Two "sell" screens (the Kit-Cat
 * clock, then the nudge + floating pill), a combined mode-and-limit screen, and
 * the two permissions. Shows only while setup is incomplete; once both
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
  const ref = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const isLast = page === PAGES - 1;

  const goTo = (i: number) => {
    const c = Math.max(0, Math.min(PAGES - 1, i));
    ref.current?.scrollTo({ x: c * width, animated: true });
    setPage(c);
  };

  // Mode + its options are chosen on pages 6-7, persisted as you go.
  const [selMode, setSelMode] = useState<WiltMode>("guilt");
  const [lim, setLim] = useState(30);

  const chooseMode = (m: WiltMode) => {
    setSelMode(m);
    setMode(m);
  };
  const pickLimit = (n: number) => {
    setLim(n);
    setLimitNow(n);
  };

  return (
    <View className="flex-1">
      <View className="flex-1" onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        <Animated.ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          onMomentumScrollEnd={(e) =>
            setPage(Math.round(e.nativeEvent.contentOffset.x / width))
          }
        >
        {/* 0 — Intro: the Kit-Cat clock sells the "time on a clock" idea. */}
        <View style={{ width, height }} className="px-6 pb-3 pt-3">
          <Header index={0} onSkip={() => goTo(PAGES - 1)} />
          <View className="flex-1 items-center justify-center">
            <KitCatClock usedMinutes={18} limitMinutes={30} />
            <Text
              className="mt-2 text-[11px] font-semibold uppercase text-dim"
              style={{ letterSpacing: 0.5 }}
            >
              of your 30-min daily limit
            </Text>
            <View className="mt-9 items-center">
              <Text
                className="text-center text-[30px] font-semibold text-bone"
                style={{ letterSpacing: -0.6, lineHeight: 34 }}
              >
                {"Your scroll,\non the clock."}
              </Text>
              <Text
                className="mt-3 text-center text-[15px] leading-relaxed text-ash"
                style={{ maxWidth: 300 }}
              >
                Wilt puts your Reels and Shorts time on a clock that runs down
                as you scroll, and reddens when it's nearly gone. Or block them
                cold.
              </Text>
            </View>
          </View>
        </View>

        {/* 1 — Presence: the nudge card plus the floating pill. */}
        <View style={{ width, height }} className="px-6 pb-3 pt-3">
          <Header index={1} onSkip={() => goTo(PAGES - 1)} />
          <View className="flex-1 items-center justify-center">
            <NudgeArt />
            <View className="mt-5">
              <ScrollPill />
            </View>
            <View className="mt-9 items-center">
              <Text
                className="text-center text-[30px] font-semibold text-bone"
                style={{ letterSpacing: -0.6, lineHeight: 34 }}
              >
                Always with you.
              </Text>
              <Text
                className="mt-3 text-center text-[15px] leading-relaxed text-ash"
                style={{ maxWidth: 300 }}
              >
                A floating timer and home-screen widget keep the time in sight.
                And when you're spiraling, Wilt interrupts with a cat to watch
                instead of the feed.
              </Text>
            </View>
          </View>
        </View>

        {/* 2 — How it works: mode choice and, for Guilt, the daily limit. */}
        <View style={{ width, height }} className="px-6 pb-3 pt-3">
          <Header index={2} onSkip={() => {}} />
          <View className="flex-1 justify-center">
            <Text className="text-[28px] font-semibold text-bone" style={{ letterSpacing: -0.5 }}>
              How should it work?
            </Text>
            <Text className="mt-2.5 text-[15px] leading-snug text-ash">
              Pick one. You can change it anytime.
            </Text>
            <View className="mt-7 gap-3.5">
              <ModeCard
                selected={selMode === "guilt"}
                accent={WASTE}
                soft="rgba(224,145,60,0.08)"
                iconBg="rgba(224,145,60,0.14)"
                icon="stopwatch-outline"
                title="Guilt"
                body="Time your scrolling. Block the reels once you hit a daily limit you set."
                onPress={() => chooseMode("guilt")}
              />
              <ModeCard
                selected={selMode === "block"}
                accent={C.toxic}
                soft="rgba(56,199,134,0.08)"
                iconBg="rgba(56,199,134,0.14)"
                icon="shield-checkmark"
                title="Block"
                body="Wall off every reel and short, all day, from the moment you open the app."
                onPress={() => chooseMode("block")}
              />
            </View>
            {selMode === "guilt" ? (
              <>
                <Text
                  className="mt-6 text-[11px] font-semibold uppercase text-dim"
                  style={{ letterSpacing: 0.5 }}
                >
                  Daily limit
                </Text>
                <View className="mt-3 flex-row flex-wrap justify-between gap-y-2.5">
                  {[15, 30, 45, 60, 90, 120].map((m) => {
                    const sel = m === lim;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => pickLimit(m)}
                        className="w-[31%] items-center rounded-2xl border py-4 active:opacity-80"
                        style={{
                          backgroundColor: sel ? "rgba(224,145,60,0.14)" : "transparent",
                          borderColor: sel ? WASTE : "rgba(242,241,236,0.10)",
                        }}
                      >
                        <Text className="text-[16px] font-semibold" style={{ color: sel ? WASTE : C.bone }}>
                          {fmtLimit(m)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text
                className="mt-6 text-[14px] leading-relaxed text-ash"
                style={{ maxWidth: 320 }}
              >
                Reels and shorts stay walled off all day, locked until midnight.
              </Text>
            )}
          </View>
        </View>

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
              This is how Wilt sees Reels and floats the timer. It only reads
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
                body="Find “Wilt Reel Counter” in the list and turn it on. This is how it knows when you're watching Reels."
                action="Open accessibility settings"
                onPress={openAccessibilitySettings}
              />
            </View>
          </View>
        </View>
        </Animated.ScrollView>
      </View>

      <View className="px-6 pb-3 pt-2">
        <MorphDots scrollX={scrollX} width={width} />
        {/* The permissions page has nothing to advance to, but the button stays
            mounted and merely hidden. Unmounting it shrinks this footer, which
            grows the pager above, which re-measures `height` and re-lays out
            every page — you see it as the whole screen twitching on the last
            swipe. */}
        <View
          className="mt-5"
          pointerEvents={isLast ? "none" : "auto"}
          accessibilityElementsHidden={isLast}
          importantForAccessibility={isLast ? "no-hide-descendants" : "auto"}
          style={{ opacity: isLast ? 0 : 1 }}
        >
          <Primary
            label={page === 0 ? "Get started" : page === 1 ? "Next" : "Continue"}
            onPress={() => goTo(page + 1)}
          />
        </View>
      </View>
    </View>
  );
}

function ModeCard({
  selected,
  accent,
  soft,
  iconBg,
  icon,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  accent: string;
  soft: string;
  iconBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-start gap-4 rounded-[20px] p-5 active:opacity-90"
      style={{
        borderWidth: 1.5,
        borderColor: selected ? accent : "rgba(242,241,236,0.10)",
        backgroundColor: selected ? soft : C.panel,
      }}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg }}
      >
        <Ionicons name={icon} size={22} color={accent} />
      </View>
      <View className="flex-1">
        <Text className="text-[17px] font-semibold text-bone">{title}</Text>
        <Text className="mt-1 text-[13px] leading-snug text-ash">{body}</Text>
      </View>
      <View
        className="mt-0.5 h-[22px] w-[22px] items-center justify-center rounded-full"
        style={{ borderWidth: 2, borderColor: selected ? accent : "rgba(242,241,236,0.15)" }}
      >
        {selected ? (
          <View style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: accent }} />
        ) : null}
      </View>
    </Pressable>
  );
}

function Header({ index, onSkip }: { index: number; onSkip: () => void }) {
  const dim = index === PAGES - 1;
  const canSkip = index <= 1;
  return (
    <View className="h-8 flex-row items-center justify-between">
      <View className="flex-row items-center gap-2.5">
        <View
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dim ? C.dim : C.toxic }}
        />
        <Text className="text-[15px] font-semibold text-bone">Wilt</Text>
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

/** Progress dots that morph off the scroll offset (on the UI thread, so the swipe
 *  stays smooth): the active dot elongates and brightens as you drag. */
function MorphDots({ scrollX, width }: { scrollX: SharedValue<number>; width: number }) {
  return (
    <View className="flex-row justify-center gap-1.5">
      {Array.from({ length: PAGES }).map((_, i) => (
        <MorphDot key={i} index={i} scrollX={scrollX} width={width} />
      ))}
    </View>
  );
}

function MorphDot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [7, 22, 7], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, range, [0.32, 1, 0.32], Extrapolation.CLAMP),
    };
  });
  return (
    <Animated.View style={[{ height: 7, borderRadius: 4, backgroundColor: C.bone }, style]} />
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

function NudgeArt() {
  return (
    <View style={{ width: 250 }} className="rounded-[22px] border border-bone/10 bg-panel p-4">
      <Image
        source={CATS[0].src}
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

/** The floating scroll-timer pill, as it appears over Instagram. */
function ScrollPill() {
  return (
    <View
      className="flex-row items-center gap-2.5 rounded-[20px] border border-bone/10 px-4 py-2.5"
      style={{ backgroundColor: "rgba(26,26,24,0.96)" }}
    >
      <PillRing frac={0.38} />
      <Text className="text-[14px] font-bold text-white">23 min scrolling</Text>
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
