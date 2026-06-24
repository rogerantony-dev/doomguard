import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Line, Rect } from "react-native-svg";

import {
  C,
  Glow,
  Instrument,
  Label,
  Mono,
  Scanlines,
  SectionRule,
} from "./console";
import { buildView, type HistoryRange } from "./history";
import { getHistory } from "../modules/doomguardnative";

type Metric = "time" | "count";

const IG_PINK = "#E1306C";
const YT_RED = "#FF0000";

/** Device-local "yyyy-mm-dd", matching the native SimpleDateFormat. */
function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Matches the native pill curve: calm under ~10 min, fully red by ~50. */
function rednessForMinutes(minutes: number): number {
  return Math.min(1, Math.max(0, (minutes - 10) / 40));
}

function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Interpolate the cyan→amber→red "heat" used for time bars. */
function heatColor(intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity));
  // cyan (calm) -> amber (warming) -> red (alarm)
  if (t < 0.5) return mix("#19E3FF", "#F5A524", t / 0.5);
  return mix("#F5A524", "#FF3B3B", (t - 0.5) / 0.5);
}

/** "1h 5m" / "5m" / "0m" from seconds. */
function fmtDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Round a value up to a tidy axis maximum (1/2/5 × 10ⁿ). */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function weekdayLetter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function dayOfMonth(date: string): string {
  return String(Number(date.split("-")[2]));
}

export function HistoryScreen({ onBack }: { onBack: () => void }) {
  const [range, setRange] = useState<HistoryRange>("7d");
  const [metric, setMetric] = useState<Metric>("time");

  // Read once per screen open (the screen remounts each time it's shown).
  const history = useMemo(() => getHistory(), []);
  const today = useMemo(() => localToday(), []);
  const view = useMemo(() => buildView(history, range, today), [history, range, today]);

  const hasData = view.series.some((d) => d.seconds > 0 || d.count > 0 || d.shorts > 0);

  // Average over days actually tracked, not the full window — a fresh install
  // shouldn't be divided by 7 (or 30) empty days it never existed for.
  const total = metric === "time" ? view.totalSeconds : view.totalCount + view.totalShorts;
  const avg = Math.round(total / view.coveredDays);
  const prevTotal = metric === "time" ? view.prevTotalSeconds : view.prevTotalCount;
  const trendPct =
    prevTotal != null && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const busiest = view.series.reduce<(typeof view.series)[number] | null>((best, d) => {
    const v = metric === "time" ? d.seconds : d.count + d.shorts;
    if (v <= 0) return best;
    const bestV = best ? (metric === "time" ? best.seconds : best.count + best.shorts) : -1;
    return v > bestV ? d : best;
  }, null);

  const fmtTotal = metric === "time" ? fmtDuration(total) : String(total);
  const fmtAvg = metric === "time" ? fmtDuration(avg) : String(avg);
  const fmtBusiest = busiest
    ? metric === "time"
      ? fmtDuration(busiest.seconds)
      : String(busiest.count + busiest.shorts)
    : "—";

  return (
    <View className="flex-1 bg-ink">
      <Glow color={C.ember} />
      <Scanlines />
      <SafeAreaView className="flex-1">
        <StatusBar style="light" />

        <View className="flex-row items-center gap-3 px-5 pb-2 pt-3">
          <Pressable
            onPress={onBack}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-60"
          >
            <Ionicons name="arrow-back" size={24} color={C.bone} />
          </Pressable>
          <Text className="text-[22px] font-extrabold text-bone" style={{ letterSpacing: -0.5 }}>
            History
          </Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="gap-6 px-5 py-4">
            <Segmented
              options={[
                { key: "7d", label: "7 days" },
                { key: "30d", label: "30 days" },
                { key: "all", label: "All" },
              ]}
              value={range}
              onChange={(k) => setRange(k as HistoryRange)}
            />

            <Segmented
              options={[
                { key: "time", label: "Time" },
                { key: "count", label: "Count" },
              ]}
              value={metric}
              onChange={(k) => setMetric(k as Metric)}
            />

            {!hasData ? (
              <Instrument className="items-center gap-3 px-5 py-10">
                <Ionicons name="bar-chart-outline" size={40} color={C.dim} />
                <Text className="text-center text-[15px] leading-6 text-ash">
                  No history yet — your first day is being logged.{"\n"}Check back tomorrow.
                </Text>
              </Instrument>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <Stat label="Total" value={fmtTotal} />
                  <Stat label="Daily avg" value={fmtAvg} />
                  <Stat
                    label="Trend"
                    value={trendPct == null ? "—" : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
                    tone={trendPct == null ? "neutral" : trendPct > 0 ? "bad" : "good"}
                  />
                </View>

                {busiest ? (
                  <Text className="-mt-2 px-1 text-[13px] text-ash">
                    Busiest day:{" "}
                    <Text className="font-bold text-bone">{busiest.date}</Text> · {fmtBusiest}
                  </Text>
                ) : null}

                <Instrument className="gap-4 px-3 py-5">
                  <Label style={{ marginLeft: 8 }}>
                    {metric === "time" ? "// MINUTES PER DAY" : "// REELS + SHORTS PER DAY"}
                  </Label>
                  <Chart series={view.series} metric={metric} range={range} />
                  {metric === "count" ? (
                    <View className="flex-row justify-center gap-5 pt-1">
                      <LegendDot color={IG_PINK} label="Reels" />
                      <LegendDot color={YT_RED} label="Shorts" />
                    </View>
                  ) : (
                    <Text className="px-2 text-center text-[12px] text-dim">
                      Reels + shorts combined — they share one timer.
                    </Text>
                  )}
                </Instrument>
              </>
            )}

            <SectionRule>NOTE</SectionRule>
            <Text className="px-1 text-[12.5px] leading-5 text-dim">
              History starts the day you updated the app — earlier days weren't recorded. It fills
              in one day at a time and lives only on this device.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View className="flex-row gap-1.5 rounded-2xl border border-bone/10 bg-ink2 p-1.5">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={`flex-1 items-center rounded-xl py-2.5 ${active ? "bg-bone" : ""}`}
          >
            <Text className={`text-[14px] font-bold ${active ? "text-ink" : "text-ash"}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const color = tone === "good" ? C.toxic : tone === "bad" ? C.amber : C.bone;
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-bone/10 bg-panel px-3 py-3">
      <Label>{label}</Label>
      <Mono className="text-[18px] font-bold" style={{ color }}>
        {value}
      </Mono>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Text className="text-[12px] text-ash">{label}</Text>
    </View>
  );
}

function Chart({
  series,
  metric,
  range,
}: {
  series: { date: string; seconds: number; count: number; shorts: number }[];
  metric: Metric;
  range: HistoryRange;
}) {
  const H = 180; // plot height
  const TOP = 8;
  const BOTTOM = 22; // room for x labels
  const plotH = H - TOP - BOTTOM;
  const slot = range === "7d" ? 40 : 26; // px per day (bar + gap)
  const barW = Math.round(slot * 0.6);
  const width = Math.max(series.length * slot, 1);

  const value = (d: (typeof series)[number]) =>
    metric === "time" ? d.seconds / 60 : d.count + d.shorts; // minutes or count
  const rawMax = Math.max(...series.map(value), 1);
  const max = niceMax(rawMax);

  const gridY = [0, 0.5, 1].map((f) => TOP + plotH * (1 - f));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 8 }}
    >
      <View>
        <Svg width={width} height={H}>
          {gridY.map((y, i) => (
            <Line
              key={i}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={C.bone}
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          ))}
          {series.map((d, i) => {
            const x = i * slot + (slot - barW) / 2;
            if (metric === "time") {
              const mins = d.seconds / 60;
              const h = max > 0 ? (mins / max) * plotH : 0;
              return (
                <Rect
                  key={d.date}
                  x={x}
                  y={TOP + plotH - h}
                  width={barW}
                  height={Math.max(h, mins > 0 ? 2 : 0)}
                  rx={3}
                  fill={heatColor(rednessForMinutes(mins))}
                />
              );
            }
            // stacked counts: reels (pink) bottom, shorts (red) on top
            const reelH = max > 0 ? (d.count / max) * plotH : 0;
            const shortH = max > 0 ? (d.shorts / max) * plotH : 0;
            const baseY = TOP + plotH;
            return (
              <React.Fragment key={d.date}>
                <Rect
                  x={x}
                  y={baseY - reelH}
                  width={barW}
                  height={Math.max(reelH, d.count > 0 ? 2 : 0)}
                  fill={IG_PINK}
                />
                <Rect
                  x={x}
                  y={baseY - reelH - shortH}
                  width={barW}
                  height={Math.max(shortH, d.shorts > 0 ? 2 : 0)}
                  fill={YT_RED}
                />
              </React.Fragment>
            );
          })}
        </Svg>
        {/* x-axis labels */}
        <View style={{ flexDirection: "row", width, marginTop: -BOTTOM + 4 }}>
          {series.map((d, i) => {
            const show = range === "7d" || i === series.length - 1 || i % 5 === 0;
            return (
              <View key={d.date} style={{ width: slot, alignItems: "center" }}>
                <Mono className="text-[10px] text-dim">
                  {show ? (range === "7d" ? weekdayLetter(d.date) : dayOfMonth(d.date)) : ""}
                </Mono>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
