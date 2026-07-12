import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Line, Path } from "react-native-svg";
import { rotateAbout, translateX } from "./catmatrix";
import { C } from "./console";
import { timeLeftState } from "./timeleft";

const AnimatedG = Animated.createAnimatedComponent(G);

// Cat greys sit off the shared palette (they're chrome, not brand colour).
const FUR = "#2A2A27";
const FACE = "#201F1D";

/** Mount-only effect, mirroring App.tsx's helper so views never call useEffect raw. */
function useMountEffect(effect: () => void) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

/**
 * Kit-Cat wall-clock read-out of the reels time you have left today: the number
 * reddens as the budget runs down, the eyes dart and the tail keeps time. Replaces
 * the minute-wall on the guilt dashboard.
 */
export function KitCatClock({
  usedMinutes,
  limitMinutes,
}: {
  usedMinutes: number;
  limitMinutes: number;
}) {
  const { minutesLeft, color } = timeLeftState(usedMinutes, limitMinutes);
  const reduceMotion = useReducedMotion();

  const dart = useSharedValue(0.5); // 0..1 -> eyes glance left..right (0.5 = centred)
  const swing = useSharedValue(0.5); // 0..1 -> tail sweeps side to side (0.5 = upright)
  useMountEffect(() => {
    if (reduceMotion) return; // rest at the centred pose set above
    dart.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    swing.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  });

  // react-native-svg's native <G> only honours a `matrix` prop; `x`/`rotation`
  // are JS-render shorthands Reanimated can't reach on the New Architecture, so
  // the eyes and tail have to be driven through matrices. See catmatrix.ts.
  // `matrix` is a real native prop on RNSVGGroup but absent from the public
  // GProps types, so the returns are cast past the type gap.
  const eyeProps = useAnimatedProps(() => ({
    matrix: translateX(-2.5 + dart.value * 5),
  })) as never;
  const tailProps = useAnimatedProps(() => ({
    matrix: rotateAbout(-15 + swing.value * 30, 112, 120),
  })) as never;

  return (
    <View className="items-center">
      <Svg width={150} height={182} viewBox="0 0 150 182">
        {/* ears */}
        <Path d="M50 30 L42 6 L70 26 Z" fill={FUR} />
        <Path d="M100 30 L108 6 L80 26 Z" fill={FUR} />
        {/* head */}
        <Circle cx={75} cy={46} r={32} fill={FUR} />
        {/* eyes — glance side to side */}
        <AnimatedG animatedProps={eyeProps}>
          <Ellipse cx={64} cy={42} rx={6} ry={8} fill={C.bone} />
          <Ellipse cx={86} cy={42} rx={6} ry={8} fill={C.bone} />
          <Circle cx={64} cy={44} r={2.6} fill={C.ink} />
          <Circle cx={86} cy={44} r={2.6} fill={C.ink} />
        </AnimatedG>
        {/* nose + bow tie pick up the live tone colour */}
        <Path d="M71 58 L79 58 L75 62 Z" fill={color} />
        <Path d="M60 84 L75 74 L90 84 L75 90 Z" fill={color} />
        {/* clock face */}
        <Circle cx={75} cy={132} r={40} fill={FACE} stroke={C.ash} strokeWidth={2.5} />
        {/* 12 / 3 / 6 / 9 ticks */}
        <Line x1={75} y1={98} x2={75} y2={104} stroke={C.dim} strokeWidth={2} strokeLinecap="round" />
        <Line x1={109} y1={132} x2={103} y2={132} stroke={C.dim} strokeWidth={2} strokeLinecap="round" />
        <Line x1={75} y1={166} x2={75} y2={160} stroke={C.dim} strokeWidth={2} strokeLinecap="round" />
        <Line x1={41} y1={132} x2={47} y2={132} stroke={C.dim} strokeWidth={2} strokeLinecap="round" />
        {/* hands */}
        <Line x1={75} y1={132} x2={75} y2={110} stroke={C.bone} strokeWidth={3} strokeLinecap="round" />
        <Line x1={75} y1={132} x2={92} y2={139} stroke={C.bone} strokeWidth={3} strokeLinecap="round" />
        <Circle cx={75} cy={132} r={3.5} fill={color} />
        {/* tail — pivots at its base (matrix carries the pivot) and keeps time */}
        <AnimatedG animatedProps={tailProps}>
          <Path d="M112 120 q24 8 20 44" stroke={FUR} strokeWidth={7} strokeLinecap="round" fill="none" />
        </AnimatedG>
      </Svg>
      <Text
        className="mt-3"
        style={{ fontSize: 13, fontWeight: "700", letterSpacing: 1.2 }}
      >
        <Text style={{ color, fontVariant: ["tabular-nums"] }}>{minutesLeft} MIN</Text>
        <Text className="text-dim"> LEFT</Text>
      </Text>
    </View>
  );
}
