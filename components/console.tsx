import { type ReactNode } from "react";
import { Pressable, Text, View, type TextProps } from "react-native";

/**
 * Shared building blocks for Doomguard's "Quiet" look — minimal and dark-first.
 * Near-black canvas, warm off-white text, generous whitespace, and a single
 * green accent used only where it carries meaning (service on, blocked/safe,
 * enabled, improving). No instrument framing, scanlines, or hazard tape.
 */

// Hex mirrors of the tailwind tokens, for inline styles + icon colors.
export const C = {
  ink: "#0D0D0C",
  ink2: "#141413",
  panel: "#1A1A18",
  panelhi: "#2C2C29",
  bone: "#F2F1EC",
  ash: "#9A9A92",
  dim: "#62625B",
  // Single green accent (token names kept for continuity).
  ember: "#38C786",
  emberdeep: "#2E9466",
  amber: "#F5A524",
  toxic: "#38C786",
  toxicdeep: "#0E3D29",
} as const;

/** Wordmark with a status dot — green when the service is live, dim otherwise. */
export function Brand({ on = true }: { on?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: on ? C.toxic : C.dim,
        }}
      />
      <Text className="text-[16px] font-semibold text-bone" style={{ letterSpacing: -0.2 }}>
        Doomguard
      </Text>
    </View>
  );
}

/** Quiet uppercase caption — the label voice. Defaults to the dim label color. */
export function Kicker({
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
          fontSize: 12,
          fontWeight: "600",
          letterSpacing: 1.1,
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

/** A flat segmented control: active cell lifts to `panelhi`, rest stay quiet. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View className="flex-row gap-1 rounded-2xl bg-panel p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={`flex-1 items-center rounded-xl py-2.5 ${active ? "bg-panelhi" : ""}`}
          >
            <Text className={`text-[14px] font-semibold ${active ? "text-bone" : "text-ash"}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Thin baseline track with a faint marker — the only chart on the dashboard. */
export function Track({ value, marker = 0.75 }: { value: number; marker?: number }) {
  const pct = Math.round(Math.min(1, Math.max(0.03, value)) * 100);
  return (
    <View className="h-[3px] w-full rounded-sm bg-panelhi">
      <View
        className="h-full rounded-sm bg-bone"
        style={{ width: `${pct}%` }}
      />
      <View
        style={{
          position: "absolute",
          left: `${Math.round(marker * 100)}%`,
          top: -3,
          bottom: -3,
          width: 1.5,
          backgroundColor: C.dim,
        }}
      />
    </View>
  );
}
