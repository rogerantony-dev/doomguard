# Reels Time History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a History screen that shows a per-day bar graph of time spent on reels/shorts, with 7d/30d/All filters and a Time/Count metric toggle.

**Architecture:** The accessibility service already tracks today's totals in `doomguard_reels` SharedPreferences and zeroes them at midnight in `ensureToday()`. We add a `history` JSON map (`date → {seconds,count,shorts}`) that `ensureToday()` appends the finishing day to *before* it zeroes — the only write path, no per-second churn. The native module exposes `getHistory()`, reconciling archived days with the in-progress (or stale, not-yet-rolled) live day by its own stored date. JS gets a `getHistory()` + `DoomguardDay` type. A React-free `components/history.ts` does all date-window / aggregation math (unit-tested with jest). `components/HistoryScreen.tsx` renders the chart with react-native-svg in the existing Hazard-Console style. `App.tsx` toggles between home and history via `useState`, with Android hardware-back support.

**Tech Stack:** Expo SDK 54 (React Native 0.81), TypeScript, Kotlin (Android accessibility service + Expo module), react-native-svg 15.12.1, NativeWind, jest-expo (new, dev-only).

## Global Constraints

- **No new runtime dependencies.** History storage reuses the existing `doomguard_reels` SharedPreferences; the chart uses the already-installed `react-native-svg`; navigation is a `useState` toggle; hardware-back uses core RN `BackHandler`. Only `jest-expo`/`jest` are added, and only as **devDependencies**.
- **History accrues from ship date forward — no backfill.** Past days were never stored and cannot be reconstructed. The graph fills one day at a time; missing days render as zero bars.
- **Time is a single shared timer.** `seconds` covers reels + shorts combined and cannot be split by platform. Only `count` (reels) and `shorts` are stored separately. The Time chart is therefore combined; only the Count chart splits the two.
- **Local calendar days, `yyyy-MM-dd`.** Native uses `SimpleDateFormat("yyyy-MM-dd", Locale.US)` in device-local time. JS must compute "today" the same way (local, not UTC) so labels line up.
- **Match existing patterns:** Hazard-Console primitives from `components/console.tsx` (`Instrument`, `Label`, `Mono`, `SectionRule`, `C`); palette note — `C.ember` is electric cyan `#19E3FF`, `C.toxic` is green `#3DDC84`. Instagram pink `#E1306C`, YouTube red `#FF0000` for per-platform counts (matches `CountChip` on the dashboard). Avoid raw `useEffect` — use the repo's `useMountEffect` wrapper + refs (see `App.tsx:83`).

---

### Task 1: Archive each finished day in `ensureToday()` (native)

**Files:**
- Modify: `plugin/native/ReelAccessibilityService.kt` (add import near line 31; rewrite `ensureToday()` at lines 835-846; add `archiveDay` helper after it)

**Interfaces:**
- Consumes: existing `prefs` (`SharedPreferences` for `doomguard_reels`), `today()` at line 832.
- Produces: a `history` string key in `doomguard_reels` prefs holding a JSON object `{ "yyyy-MM-dd": {"seconds":Int,"count":Int,"shorts":Int}, ... }`. Days with zero activity are not archived.

- [ ] **Step 1: Add the `org.json.JSONObject` import**

In the import block (the `java.*` imports end at line 33), add:

```kotlin
import org.json.JSONObject
```

- [ ] **Step 2: Rewrite `ensureToday()` to archive before zeroing**

Replace the existing `ensureToday()` (lines 835-846):

```kotlin
    /** Roll the reel count, the short count, and the shared timer over at midnight. */
    private fun ensureToday() {
        val today = today()
        val storedDate = prefs.getString("date", null)
        if (storedDate != today) {
            // Archive the finishing day into history before we zero it, so the
            // graph keeps it. Only days with real activity are stored.
            if (storedDate != null) {
                val seconds = prefs.getInt("seconds", 0)
                val count = prefs.getInt("count", 0)
                val shorts = prefs.getInt("shortsCount", 0)
                if (seconds > 0 || count > 0 || shorts > 0) {
                    archiveDay(storedDate, seconds, count, shorts)
                }
            }
            prefs.edit()
                .putString("date", today)
                .putInt("count", 0)
                .putInt("shortsCount", 0)
                .putInt("seconds", 0)
                .apply()
        }
    }

    /** Fold one finished day's totals into the persisted history JSON map. */
    private fun archiveDay(date: String, seconds: Int, count: Int, shorts: Int) {
        val history = runCatching {
            JSONObject(prefs.getString("history", "{}") ?: "{}")
        }.getOrElse { JSONObject() }
        history.put(
            date,
            JSONObject()
                .put("seconds", seconds)
                .put("count", count)
                .put("shorts", shorts),
        )
        prefs.edit().putString("history", history.toString()).apply()
    }
```

- [ ] **Step 3: Confirm it compiles (no jest path here — this is device code)**

Run: `cd /Users/timeless/Developer/doomguard && npx tsc --noEmit`
Expected: PASS (TypeScript is unaffected; this confirms nothing else broke). Kotlin compiles in Task 6's Android build.

- [ ] **Step 4: Commit**

```bash
git add plugin/native/ReelAccessibilityService.kt
git commit -m "History: archive each finished day before the midnight reset"
```

---

### Task 2: Expose `getHistory()` from the native module and JS

**Files:**
- Modify: `modules/doomguardnative/android/src/main/java/expo/modules/doomguardnative/DoomguardnativeModule.kt` (add import; add `Function("getHistory")`; add `history` helper)
- Modify: `modules/doomguardnative/index.ts` (add `DoomguardDay` type; add `getHistory` to `NativeModule`; export `getHistory()`)

**Interfaces:**
- Consumes: the `history` prefs key written in Task 1; existing `prefs(context)` helper.
- Produces:
  - Native `getHistory()` → `List<Map<String, Any>>`, each `{date: String, seconds: Int, count: Int, shorts: Int}`, ascending by date.
  - JS `export type DoomguardDay = { date: string; seconds: number; count: number; shorts: number }`
  - JS `export function getHistory(): DoomguardDay[]` (returns `[]` if native module absent).

- [ ] **Step 1: Add the `JSONObject` import to the module**

In `DoomguardnativeModule.kt`, after the existing imports (line 6 region), add:

```kotlin
import org.json.JSONObject
```

- [ ] **Step 2: Register the `getHistory` function**

In `DoomguardnativeModule.kt`, inside `ModuleDefinition {}`, add after the `Function("setMode") { ... }` block (currently ends line 38):

```kotlin
    Function("getHistory") {
      val context = appContext.reactContext?.applicationContext
        ?: return@Function emptyList<Map<String, Any>>()
      history(context)
    }
```

- [ ] **Step 3: Add the `history` helper**

In `DoomguardnativeModule.kt`, add as a private method (e.g. after `todaySeconds`, before the closing brace at line 98):

```kotlin
  /**
   * Archived days merged with the in-progress (or stale, not-yet-rolled) live
   * day. The live counters are filed under their own stored date, so a
   * yesterday-counter read on a new day is attributed to yesterday, never
   * mislabeled "today".
   */
  private fun history(context: Context): List<Map<String, Any>> {
    val prefs = prefs(context)
    val byDate = linkedMapOf<String, IntArray>() // date -> [seconds, count, shorts]

    runCatching {
      val json = JSONObject(prefs.getString("history", "{}") ?: "{}")
      val keys = json.keys()
      while (keys.hasNext()) {
        val date = keys.next()
        val day = json.getJSONObject(date)
        byDate[date] = intArrayOf(
          day.optInt("seconds"),
          day.optInt("count"),
          day.optInt("shorts"),
        )
      }
    }

    val liveDate = prefs.getString("date", null)
    if (liveDate != null) {
      val cur = byDate[liveDate] ?: intArrayOf(0, 0, 0)
      cur[0] += prefs.getInt("seconds", 0)
      cur[1] += prefs.getInt("count", 0)
      cur[2] += prefs.getInt("shortsCount", 0)
      byDate[liveDate] = cur
    }

    return byDate.entries
      .sortedBy { it.key }
      .map { (date, v) ->
        mapOf(
          "date" to date,
          "seconds" to v[0],
          "count" to v[1],
          "shorts" to v[2],
        )
      }
  }
```

- [ ] **Step 4: Add the JS type and function**

In `modules/doomguardnative/index.ts`, add the type after `DoomguardStatus` (after line 20):

```typescript
export type DoomguardDay = {
  /** Local calendar day, "yyyy-mm-dd". */
  date: string;
  /** Seconds on short-form players (reels + shorts) that day. */
  seconds: number;
  /** Instagram Reels counted that day. */
  count: number;
  /** YouTube Shorts counted that day. */
  shorts: number;
};
```

Add `getHistory` to the `NativeModule` type (currently lines 22-25):

```typescript
type NativeModule = {
  getStatus(): DoomguardStatus;
  setMode(mode: DoomguardMode): void;
  getHistory(): DoomguardDay[];
};
```

Add the exported function at the end of the file (after `setMode`, line 52):

```typescript
export function getHistory(): DoomguardDay[] {
  if (!nativeModule) return [];
  try {
    return nativeModule.getHistory();
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/timeless/Developer/doomguard && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/doomguardnative/android/src/main/java/expo/modules/doomguardnative/DoomguardnativeModule.kt modules/doomguardnative/index.ts
git commit -m "History: expose getHistory() from the native module and JS"
```

---

### Task 3: Pure history logic + jest (TDD)

**Files:**
- Create: `components/history.ts`
- Create: `components/history.test.ts`
- Create: `jest.config.js`
- Modify: `package.json` (add `"test"` script + devDependencies)

**Interfaces:**
- Consumes: `DoomguardDay` (type-only import from `../modules/doomguardnative` — erased at compile, so no native module is loaded at test time).
- Produces:
  - `export type HistoryRange = "7d" | "30d" | "all"`
  - `export type HistoryView = { series: DoomguardDay[]; totalSeconds: number; totalCount: number; totalShorts: number; prevTotalSeconds: number | null; prevTotalCount: number | null }`
  - `export function toDayIndex(date: string): number`
  - `export function fromDayIndex(index: number): string`
  - `export function buildView(history: DoomguardDay[], range: HistoryRange, today: string): HistoryView`
  - `series` is contiguous, ascending, zero-filled, ending at `today`. For `"all"` it starts at the earliest history date (or `today` if empty); `prevTotal*` are `null`. For `"7d"`/`"30d"` it spans the last 7/30 days and `prevTotal*` cover the immediately-preceding equal-length window.

- [ ] **Step 1: Install jest-expo (dev-only)**

Run:
```bash
cd /Users/timeless/Developer/doomguard && npx expo install --dev jest-expo && npm install --save-dev jest @types/jest
```
Expected: `jest-expo`, `jest`, `@types/jest` appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the test script and jest config**

In `package.json`, add to `"scripts"` (currently ends at the `"web"` line):

```json
    "web": "expo start --web",
    "test": "jest"
```

Create `jest.config.js`:

```javascript
module.exports = {
  preset: "jest-expo",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};
```

- [ ] **Step 3: Write the failing tests**

Create `components/history.test.ts`:

```typescript
import { buildView, fromDayIndex, toDayIndex } from "./history";
import type { DoomguardDay } from "../modules/doomguardnative";

const day = (date: string, seconds: number, count = 0, shorts = 0): DoomguardDay => ({
  date,
  seconds,
  count,
  shorts,
});

describe("day index round-trip", () => {
  it("round-trips a date through the integer index", () => {
    expect(fromDayIndex(toDayIndex("2026-06-24"))).toBe("2026-06-24");
  });

  it("treats adjacent days as consecutive indices", () => {
    expect(toDayIndex("2026-06-24") - toDayIndex("2026-06-23")).toBe(1);
  });

  it("crosses month boundaries correctly", () => {
    expect(fromDayIndex(toDayIndex("2026-01-31") + 1)).toBe("2026-02-01");
  });
});

describe("buildView 7d", () => {
  const history = [day("2026-06-24", 600, 5, 2), day("2026-06-22", 120, 1, 0)];

  it("produces exactly 7 contiguous days ending today, zero-filling gaps", () => {
    const view = buildView(history, "7d", "2026-06-24");
    expect(view.series).toHaveLength(7);
    expect(view.series[0].date).toBe("2026-06-18");
    expect(view.series[6].date).toBe("2026-06-24");
    // 06-23 had no activity -> zero-filled
    expect(view.series[5]).toEqual({ date: "2026-06-23", seconds: 0, count: 0, shorts: 0 });
  });

  it("sums totals across the window", () => {
    const view = buildView(history, "7d", "2026-06-24");
    expect(view.totalSeconds).toBe(720);
    expect(view.totalCount).toBe(6);
    expect(view.totalShorts).toBe(2);
  });

  it("computes the previous equal-length window total", () => {
    // previous 7d window is 2026-06-11..2026-06-17
    const withPrev = [...history, day("2026-06-15", 300, 0, 0)];
    const view = buildView(withPrev, "7d", "2026-06-24");
    expect(view.prevTotalSeconds).toBe(300);
    expect(view.prevTotalCount).toBe(0);
  });
});

describe("buildView all", () => {
  it("spans from the earliest history date through today with no prev window", () => {
    const view = buildView([day("2026-06-20", 60)], "all", "2026-06-24");
    expect(view.series[0].date).toBe("2026-06-20");
    expect(view.series[view.series.length - 1].date).toBe("2026-06-24");
    expect(view.series).toHaveLength(5);
    expect(view.prevTotalSeconds).toBeNull();
  });

  it("falls back to a single today bar when history is empty", () => {
    const view = buildView([], "all", "2026-06-24");
    expect(view.series).toEqual([{ date: "2026-06-24", seconds: 0, count: 0, shorts: 0 }]);
    expect(view.totalSeconds).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd /Users/timeless/Developer/doomguard && npx jest components/history.test.ts`
Expected: FAIL — `Cannot find module './history'`.

- [ ] **Step 5: Implement `components/history.ts`**

```typescript
import type { DoomguardDay } from "../modules/doomguardnative";

export type HistoryRange = "7d" | "30d" | "all";

export type HistoryView = {
  /** Contiguous, ascending, zero-filled days ending at `today`. */
  series: DoomguardDay[];
  totalSeconds: number;
  totalCount: number;
  totalShorts: number;
  /** Totals for the equal-length window immediately before; null for "all". */
  prevTotalSeconds: number | null;
  prevTotalCount: number | null;
};

const MS_PER_DAY = 86_400_000;

/** "yyyy-mm-dd" -> integer day index (UTC midnight, so arithmetic is DST-proof). */
export function toDayIndex(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** integer day index -> "yyyy-mm-dd". */
export function fromDayIndex(index: number): string {
  const dt = new Date(index * MS_PER_DAY);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Contiguous zero-filled days from startIndex..endIndex inclusive. */
function fill(byDate: Map<string, DoomguardDay>, startIndex: number, endIndex: number): DoomguardDay[] {
  const out: DoomguardDay[] = [];
  for (let i = startIndex; i <= endIndex; i++) {
    const date = fromDayIndex(i);
    out.push(byDate.get(date) ?? { date, seconds: 0, count: 0, shorts: 0 });
  }
  return out;
}

export function buildView(history: DoomguardDay[], range: HistoryRange, today: string): HistoryView {
  const byDate = new Map<string, DoomguardDay>();
  for (const d of history) byDate.set(d.date, d);

  const todayIndex = toDayIndex(today);
  let startIndex: number;
  let prevStart: number | null = null;
  let prevEnd: number | null = null;

  if (range === "all") {
    let earliest = todayIndex;
    for (const d of history) earliest = Math.min(earliest, toDayIndex(d.date));
    startIndex = earliest;
  } else {
    const span = range === "7d" ? 7 : 30;
    startIndex = todayIndex - (span - 1);
    prevEnd = startIndex - 1;
    prevStart = prevEnd - (span - 1);
  }

  const series = fill(byDate, startIndex, todayIndex);

  let totalSeconds = 0;
  let totalCount = 0;
  let totalShorts = 0;
  for (const d of series) {
    totalSeconds += d.seconds;
    totalCount += d.count;
    totalShorts += d.shorts;
  }

  let prevTotalSeconds: number | null = null;
  let prevTotalCount: number | null = null;
  if (prevStart != null && prevEnd != null) {
    const prev = fill(byDate, prevStart, prevEnd);
    prevTotalSeconds = prev.reduce((s, d) => s + d.seconds, 0);
    prevTotalCount = prev.reduce((s, d) => s + d.count + d.shorts, 0);
  }

  return { series, totalSeconds, totalCount, totalShorts, prevTotalSeconds, prevTotalCount };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /Users/timeless/Developer/doomguard && npx jest components/history.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 7: Commit**

```bash
git add components/history.ts components/history.test.ts jest.config.js package.json package-lock.json
git commit -m "History: add tested date-window + aggregation logic (jest-expo)"
```

---

### Task 4: `HistoryScreen` UI

**Files:**
- Create: `components/HistoryScreen.tsx`

**Interfaces:**
- Consumes: `getHistory`, `DoomguardDay` from `../modules/doomguardnative`; `buildView`, `HistoryRange` from `./history`; console primitives `C`, `Glow`, `Scanlines`, `Instrument`, `Label`, `Mono`, `SectionRule` from `./console`.
- Produces: `export function HistoryScreen({ onBack }: { onBack: () => void })`.

- [ ] **Step 1: Implement the screen**

Create `components/HistoryScreen.tsx`:

```tsx
import { useMemo, useState } from "react";
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

/** Interpolate the cyan→amber→red "heat" used for time bars. */
function heatColor(intensity: number): string {
  const t = Math.min(1, Math.max(0, intensity));
  // cyan (calm) -> amber (warming) -> red (alarm)
  if (t < 0.5) return mix("#19E3FF", "#F5A524", t / 0.5);
  return mix("#F5A524", "#FF3B3B", (t - 0.5) / 0.5);
}

function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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

  const days = view.series.length;
  const total = metric === "time" ? view.totalSeconds : view.totalCount + view.totalShorts;
  const avg = Math.round(total / (days || 1));
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
  const rawMax = Math.max(...series.map(value), metric === "time" ? 1 : 1);
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
            <Line key={i} x1={0} y1={y} x2={width} y2={y} stroke={C.bone} strokeOpacity={0.08} strokeWidth={1} />
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
                <Rect x={x} y={baseY - reelH} width={barW} height={Math.max(reelH, d.count > 0 ? 2 : 0)} fill={IG_PINK} />
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
```

- [ ] **Step 2: Add the missing React import for `React.Fragment`**

`React.Fragment` is used in `Chart`. Add at the top of `components/HistoryScreen.tsx`, before the other imports:

```tsx
import React from "react";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/timeless/Developer/doomguard && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/HistoryScreen.tsx
git commit -m "History: add the per-day bar chart screen"
```

---

### Task 5: Wire the History screen into `App.tsx`

**Files:**
- Modify: `App.tsx` (add `BackHandler` import + `HistoryScreen` import; add `screen` state + back-handler; add History button to `Dashboard`; render `HistoryScreen` when active)

**Interfaces:**
- Consumes: `HistoryScreen` from `./components/HistoryScreen`.
- Produces: in-app navigation between `"home"` and `"history"` via `useState`, no new dependency.

- [ ] **Step 1: Add imports**

In `App.tsx`, add `BackHandler` to the `react-native` import (currently lines 2-10):

```tsx
import {
  AppState,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
```

Add the screen import after the `StopwatchGraphic` import (line 17):

```tsx
import { HistoryScreen } from "./components/HistoryScreen";
```

- [ ] **Step 2: Add screen state and hardware-back handling**

In `App()`, after the `pollRef` declaration (line 91), add:

```tsx
  const [screen, setScreen] = useState<"home" | "history">("home");
  // Read the latest screen from a ref so the back-handler subscribes once
  // (mount-only) rather than re-subscribing on every navigation.
  const screenRef = useRef(screen);
  screenRef.current = screen;
```

Inside the existing `useMountEffect` (the body starting line 116, after `syncStatus()` and the `AppState` subscription, before the `return`), register the back handler. Replace the whole `useMountEffect` block (lines 116-125) with:

```tsx
  useMountEffect(() => {
    syncStatus();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") syncStatus();
    });
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (screenRef.current === "history") {
        setScreen("home");
        return true;
      }
      return false;
    });
    return () => {
      subscription.remove();
      backSub.remove();
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  });
```

- [ ] **Step 3: Render the History screen when active**

In `App()`'s returned JSX, immediately after the opening `<View className="flex-1 bg-ink">` (line 159), short-circuit to the history screen:

```tsx
  if (screen === "history") {
    return <HistoryScreen onBack={() => setScreen("home")} />;
  }

  return (
    <View className="flex-1 bg-ink">
```

(Place the `if` above the existing `return (`. The `<Glow>`/`<Scanlines>` etc. stay in the home `return`.)

- [ ] **Step 4: Pass an open-history callback into `Dashboard`**

Update the `<Dashboard ... />` usage (lines 185-191) to add the prop:

```tsx
              <Dashboard
                mode={mode}
                seconds={seconds}
                count={count}
                shorts={shorts}
                onChangeMode={changeMode}
                onOpenHistory={() => setScreen("history")}
              />
```

Update the `Dashboard` signature and props type (lines 242-254) to accept it:

```tsx
function Dashboard({
  mode,
  seconds,
  count,
  shorts,
  onChangeMode,
  onOpenHistory,
}: {
  mode: DoomguardMode;
  seconds: number;
  count: number;
  shorts: number;
  onChangeMode: (mode: DoomguardMode) => void;
  onOpenHistory: () => void;
}) {
```

- [ ] **Step 5: Add the History button to the dashboard**

In `Dashboard`'s JSX, add a button right after `<CatsButton ... />` (line 317):

```tsx
      <CatsButton onPress={() => setCatsOpen(true)} />

      <Pressable
        onPress={onOpenHistory}
        className="flex-row items-center justify-center gap-2.5 rounded-2xl border border-bone/15 bg-panel py-4 active:opacity-80"
      >
        <Ionicons name="bar-chart" size={19} color={C.ember} />
        <Text className="text-[16px] font-bold tracking-wide text-bone">View history</Text>
      </Pressable>
```

(`Ionicons` and `C` are already imported in `App.tsx`.)

- [ ] **Step 6: Typecheck**

Run: `cd /Users/timeless/Developer/doomguard && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add App.tsx
git commit -m "History: add a View history button and screen navigation"
```

---

### Task 6: Build & verify on Android

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd /Users/timeless/Developer/doomguard && npx jest`
Expected: PASS.

- [ ] **Step 2: Typecheck the whole project**

Run: `cd /Users/timeless/Developer/doomguard && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build & launch on Android**

Run: `cd /Users/timeless/Developer/doomguard && npx expo run:android`
Expected: app builds and launches (this compiles the Kotlin changes from Tasks 1-2).

- [ ] **Step 4: Manual verification checklist**

With the app running on a device/emulator with the accessibility service enabled:
- [ ] Tap **View history** on the dashboard → History screen opens.
- [ ] Empty state shows "No history yet…" on a fresh install (no archived days, no activity today).
- [ ] Scroll some reels/shorts, return to the app → today's bar appears and grows; counts and time are non-zero.
- [ ] Toggle **Time / Count** → chart switches between a single heat-colored bar and stacked pink/red bars; legend/footnote swaps.
- [ ] Toggle **7 days / 30 days / All** → x-axis labels adapt (weekday letters vs day numbers); 30d/All scroll horizontally.
- [ ] Summary row shows Total, Daily avg, Trend; Busiest day line is correct.
- [ ] Android hardware **back** returns to the dashboard (not exits the app).
- [ ] (If feasible) change the device date forward a day, trigger the service, change back → the prior day appears as its own archived bar and today resets to zero.

- [ ] **Step 5: Final commit (version bump, optional)**

If shipping, bump `version`/`versionCode` in `app.json` per the repo's convention (see recent commits like "Bump version to 1.1.1 (versionCode 3)").

```bash
git add app.json
git commit -m "Bump version for reels time history"
```

---

## Self-Review

**Spec coverage:**
- 7d/30d/All filters → Task 3 `buildView` ranges + Task 4 `Segmented`. ✓
- Time/Count toggle (time combined; counts split) → Task 4 `metric` state + `Chart`. ✓
- Per-day bar graph, scrollable, adaptive labels, zero-fill → Task 4 `Chart`. ✓
- Summary: total + daily average, busiest day, trend vs previous → Task 4 stats row (trend uses `prevTotal*` from Task 3). ✓
- Native per-day history + no backfill + combined timer → Tasks 1-2; constraints documented. ✓
- Lightweight in-app screen + hardware back → Task 5. ✓
- Empty state → Task 4. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. ✓

**Type consistency:** `DoomguardDay {date,seconds,count,shorts}` defined in Task 2, consumed identically in Tasks 3-4. `buildView(history, range, today)` and `HistoryView` fields (`series`, `totalSeconds`, `totalCount`, `totalShorts`, `prevTotalSeconds`, `prevTotalCount`) match between Task 3 definition and Task 4 usage. `HistoryRange` shared. `HistoryScreen({onBack})` defined in Task 4, used in Task 5. ✓
