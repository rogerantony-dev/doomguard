import { type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Defs,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

/**
 * Shared building blocks for Doomguard's "Hazard Console" look — the app styled
 * like a piece of safety equipment monitoring your doomscrolling. Instrument
 * cards with corner ticks, mono readouts, an ember/oxblood alarm palette, a
 * redline meter, scanline texture and a status strip. Kept here so every screen
 * speaks the same visual language.
 */

// Hex mirrors of the tailwind tokens, for SVG fills + icon colors.
export const C = {
  ink: "#08080A",
  ink2: "#0C0C10",
  panel: "#141419",
  panelhi: "#1B1B22",
  bone: "#F4F1EA",
  ash: "#9C9CA6",
  dim: "#5C5C66",
  // Primary "pop" accent — electric cyan (token names kept as ember*).
  ember: "#19E3FF",
  emberdeep: "#0BB6D6",
  amber: "#F5A524",
  toxic: "#3DDC84",
  toxicdeep: "#0F3A24",
} as const;

/** System monospace — the data/label voice of the console, no font assets needed. */
export const MONO = Platform.select({
  android: "monospace",
  ios: "Courier New",
  default: "monospace",
}) as string;

/** Mono, wide-tracked, uppercase caption — the instrument-label voice. */
export function Label({
  children,
  color = C.dim,
  style,
  ...rest
}: TextProps & { children: ReactNode; color?: string }) {
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 2,
          color,
          textTransform: "uppercase",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Mono numerals for readouts/counters. */
export function Mono({
  children,
  style,
  ...rest
}: TextProps & { children: ReactNode }) {
  return (
    <Text {...rest} style={[{ fontFamily: MONO }, style]}>
      {children}
    </Text>
  );
}

/** Soft radial halo bleeding down from the top — ember by default, toxic in Block mode. */
export function Glow({ color = C.ember }: { color?: string }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient id="dgGlow" cx="50%" cy="-2%" rx="75%" ry="42%">
          <Stop offset="0" stopColor={color} stopOpacity={0.2} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#dgGlow)" />
    </Svg>
  );
}

/** Faint CRT scanlines across the whole surface. Decorative; safe to ignore failures. */
export function Scanlines() {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id="dgScan"
          width="3"
          height="3"
          patternUnits="userSpaceOnUse"
        >
          <Rect x="0" y="0" width="3" height="1" fill="#000000" opacity={0.16} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#dgScan)" />
    </Svg>
  );
}

/** Amber/black diagonal hazard tape — a thin warning divider. */
export function HazardStrip({ height = 8 }: { height?: number }) {
  return (
    <View
      style={{ height, borderRadius: 4, overflow: "hidden", opacity: 0.85 }}
    >
      <Svg height={height} width="100%">
        <Defs>
          <Pattern
            id="dgHaz"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <Rect x="0" y="0" width="10" height="20" fill={C.amber} />
            <Rect x="10" y="0" width="10" height="20" fill="#1A1406" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#dgHaz)" />
      </Svg>
    </View>
  );
}

/** The four L-shaped corner brackets that frame an instrument card. */
function CornerTicks() {
  const base = "absolute h-3 w-3 border-bone/20";
  return (
    <>
      <View className={`${base} left-2 top-2 border-l-2 border-t-2`} />
      <View className={`${base} right-2 top-2 border-r-2 border-t-2`} />
      <View className={`${base} bottom-2 left-2 border-b-2 border-l-2`} />
      <View className={`${base} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
  );
}

/** A framed readout panel: gradient-dark surface, hairline border, corner ticks. */
export function Instrument({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`relative overflow-hidden rounded-[22px] border border-bone/10 bg-panel ${className}`}
    >
      <CornerTicks />
      {children}
    </View>
  );
}

/** Horizontal "redline" meter, 0..1, filling amber→ember with a redline marker. */
export function Meter({ value }: { value: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <View className="h-2.5 w-full overflow-hidden rounded-md border border-bone/10 bg-[#1C1C22]">
      <View style={{ width: `${pct}%`, height: "100%" }}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="dgMeter" cx="0%" cy="50%" rx="160%" ry="100%">
              <Stop offset="0" stopColor="#9BF7FF" />
              <Stop offset="0.6" stopColor={C.ember} />
              <Stop offset="1" stopColor={C.emberdeep} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#dgMeter)" />
        </Svg>
      </View>
    </View>
  );
}

/** Top status strip: a blinking LED label on the left, unit id on the right. */
export function StatusStrip({
  label,
  tone = "ember",
}: {
  label: string;
  tone?: "ember" | "toxic";
}) {
  const dot = tone === "toxic" ? C.toxic : C.ember;
  return (
    <View className="flex-row items-center justify-between border-b border-bone/10 pb-4">
      <View className="flex-row items-center gap-2">
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: dot,
            shadowColor: dot,
            shadowOpacity: 0.9,
            shadowRadius: 5,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <Label>{label}</Label>
      </View>
      <Label>DG-01 · LOCAL</Label>
    </View>
  );
}

/**
 * The "Cats, not reels" escape hatch — a single flat violet, distinct from the
 * cyan alarm and green "armed" states but calm rather than loud.
 */
export function CatsButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center justify-center gap-2.5 rounded-2xl py-4 active:opacity-90"
      style={{ backgroundColor: "#7C3AED" }}
    >
      <Ionicons name="paw" size={20} color="#FFFFFF" />
      <Text className="text-[16px] font-extrabold tracking-wide text-white">
        Cats, not reels
      </Text>
    </Pressable>
  );
}

/** A mono section heading with a trailing hairline rule. */
export function SectionRule({
  children,
  color = C.dim,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Label color={color}>{children}</Label>
      <View className="h-px flex-1 bg-bone/10" />
    </View>
  );
}
