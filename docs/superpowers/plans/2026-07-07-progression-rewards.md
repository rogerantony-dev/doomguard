# Progression & Rewards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a positive-reinforcement layer over Doomguard's guilt framing: clean days build a streak, earn points (more per day at tighter limits), unlock cats, and after a 7-day streak the app offers to ratchet the daily limit down.

**Architecture:** All progression is a pure function of the existing native history plus the current limit, computed in TypeScript (`components/progress.ts`), fully unit-tested with jest. The native layer gains one additive field (`limitMinutes` recorded per archived day) and three durable "seen" flags so celebrations never re-fire. The JS reads `day.limitMinutes` defensively (falls back to the current limit when absent), so the TS ships and previews before any native rebuild.

**Tech Stack:** React Native 0.81 + Expo 54, NativeWind/Tailwind, Reanimated, TypeScript, jest (jest-expo preset). Native: Kotlin (Expo module + accessibility service), SharedPreferences (`doomguard_reels`).

## Global Constraints

- Expo SDK 54 / RN 0.81.5. No new npm or native dependencies (uses existing `react-native-svg`, Reanimated, Ionicons, system fonts).
- No em dashes in any user-facing copy. Use periods or commas. (House style.)
- Dark-mode-first "Quiet" palette. Use existing tokens from `tailwind.config.js` / `components/console.tsx` (`C`): ink, panel, panelhi, bone, ash, dim, `C.toxic` (green accent), plus the existing local `WASTE = "#E0913C"` / `OVER = "#D2542F"` for guilt surfaces. Do not add new colors.
- The ladder of limits is exactly `LIMIT_OPTIONS = [15, 30, 45, 60, 90, 120]` (already in `App.tsx`). Descending order for leveling: 120 → 90 → 60 → 45 → 30 → 15 (floor).
- Points per clean day by limit: 120→10, 90→15, 60→20, 45→30, 30→50, 15→100. Off-table fallback: `round(1200 / limit)`.
- Cat unlock thresholds (cumulative lifetime points), frequent early / sparse later, first cat free: 0, 50, 150, 400, then 800, 1500, ... Each cat carries its own `unlockAt`.
- Streak milestone for the level-down offer: every 7 clean days.
- A "clean day" is `seconds <= limitForThatDay * 60` (inclusive). All days count regardless of mode; zero-activity days are clean.
- TDD: write the failing test first for every pure-TS unit. Commit after each green task.
- The guilt hero and all existing native-module logic stay behavior-unchanged. Progression is additive.

---

## File Structure

- `components/cats.ts` (modify) — cats become `{ src, unlockAt }` objects instead of bare sources; existing 4 get thresholds 0/50/150/400.
- `components/progress.ts` (create) — pure derivation: types + `computeProgress(history, currentLimit, today, seen)`, plus helpers `pointsForLimit`, `nextRungBelow`. No React, no native imports beyond the `DoomguardDay` type.
- `components/progress.test.ts` (create) — jest unit tests for `components/progress.ts`.
- `modules/doomguardnative/index.ts` (modify) — add `limitMinutes?` to `DoomguardDay`; add progress "seen" fields to `DoomguardStatus`; add three setters (`markStreakCelebrated`, `markPointsCelebrated`, and reuse existing `setLimit` for the offer).
- `components/ProgressStrip.tsx` (create) — the slim home strip (streak + points).
- `components/MilestoneModal.tsx` (create) — full-screen celebratory moment; carries the optional level-down offer.
- `App.tsx` (modify) — wire derived progress into the home screen: render `ProgressStrip`, fire `MilestoneModal` for pending moments, call the native "mark seen" setters.
- `components/CatGallery.tsx` (modify) — locked/unlocked tiles with "Unlock at N pts" captions; consume `unlockedCount` prop.
- Native Kotlin (modify, additive, one task): `ReelAccessibilityService.kt` (record limit into archived day) + `DoomguardnativeModule.kt` (surface `limitMinutes` in history, seen-flags in status, two mark setters).
- `design-previews/gen-progress.js` (create) — headless-Chrome preview mockup of the home strip + milestone + locked cats, mirroring the tokens, for the user to review without a device.

---

## Task 1: Points + ladder helpers (pure TS)

**Files:**
- Create: `components/progress.ts`
- Test: `components/progress.test.ts`

**Interfaces:**
- Produces:
  - `pointsForLimit(limitMinutes: number): number`
  - `nextRungBelow(limitMinutes: number): number | null` — next lower value in `[15,30,45,60,90,120]`, or `null` at/below 15.
  - `LADDER: readonly number[]` = `[120, 90, 60, 45, 30, 15]`.

- [ ] **Step 1: Write the failing test**

```ts
// components/progress.test.ts
import { pointsForLimit, nextRungBelow, LADDER } from "./progress";

describe("pointsForLimit", () => {
  it("maps each ladder rung to its table value", () => {
    expect(pointsForLimit(120)).toBe(10);
    expect(pointsForLimit(90)).toBe(15);
    expect(pointsForLimit(60)).toBe(20);
    expect(pointsForLimit(45)).toBe(30);
    expect(pointsForLimit(30)).toBe(50);
    expect(pointsForLimit(15)).toBe(100);
  });
  it("falls back to round(1200/limit) off-table", () => {
    expect(pointsForLimit(20)).toBe(60); // round(1200/20)
    expect(pointsForLimit(240)).toBe(5); // round(1200/240)
  });
});

describe("nextRungBelow", () => {
  it("returns the next lower ladder value", () => {
    expect(nextRungBelow(60)).toBe(45);
    expect(nextRungBelow(120)).toBe(90);
    expect(nextRungBelow(30)).toBe(15);
  });
  it("returns null at or below the floor", () => {
    expect(nextRungBelow(15)).toBeNull();
    expect(nextRungBelow(10)).toBeNull();
  });
  it("returns the next lower rung for an off-ladder value", () => {
    expect(nextRungBelow(50)).toBe(45);
  });
});

describe("LADDER", () => {
  it("is the descending limit ladder", () => {
    expect(LADDER).toEqual([120, 90, 60, 45, 30, 15]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/progress.test.ts -t pointsForLimit`
Expected: FAIL, "Cannot find module './progress'".

- [ ] **Step 3: Write minimal implementation**

```ts
// components/progress.ts
export const LADDER = [120, 90, 60, 45, 30, 15] as const;

const POINTS_TABLE: Record<number, number> = {
  120: 10,
  90: 15,
  60: 20,
  45: 30,
  30: 50,
  15: 100,
};

/** Points earned for one clean day at the given limit. Lower limit, more points. */
export function pointsForLimit(limitMinutes: number): number {
  return POINTS_TABLE[limitMinutes] ?? Math.round(1200 / limitMinutes);
}

/** The next tighter rung below `limitMinutes`, or null at/below the 15-min floor. */
export function nextRungBelow(limitMinutes: number): number | null {
  const lower = LADDER.filter((r) => r < limitMinutes);
  return lower.length ? Math.max(...lower) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/progress.ts components/progress.test.ts
git commit -m "feat(progress): points + ladder helpers"
```

---

## Task 2: Streak, best streak, lifetime points (pure TS)

**Files:**
- Modify: `components/progress.ts`
- Test: `components/progress.test.ts`

**Interfaces:**
- Consumes: `DoomguardDay` from `../modules/doomguardnative` (fields `date`, `seconds`, optional `limitMinutes`), `pointsForLimit`, `toDayIndex` from `./history`.
- Produces:
  - `isCleanDay(day: DoomguardDay, currentLimit: number): boolean` — uses `day.limitMinutes ?? currentLimit`.
  - `lifetimePoints(history: DoomguardDay[], currentLimit: number): number`
  - `streaks(history: DoomguardDay[], today: string, currentLimit: number): { current: number; best: number }` — `current` counts back from `today` (or the day before if today isn't clean/tracked) over consecutive clean, contiguous days; `best` is the longest contiguous clean run anywhere.

- [ ] **Step 1: Write the failing test**

```ts
// append to components/progress.test.ts
import { isCleanDay, lifetimePoints, streaks } from "./progress";
import type { DoomguardDay } from "../modules/doomguardnative";

const day = (date: string, seconds: number, limitMinutes?: number): DoomguardDay => ({
  date, seconds, count: 0, shorts: 0, ...(limitMinutes !== undefined ? { limitMinutes } : {}),
});

describe("isCleanDay", () => {
  it("is clean when seconds are at or under the day's own limit", () => {
    expect(isCleanDay(day("2026-07-01", 60 * 60, 60), 30)).toBe(true); // exactly at limit
    expect(isCleanDay(day("2026-07-01", 60 * 60 + 1, 60), 30)).toBe(false);
  });
  it("falls back to the current limit when the day has no recorded limit", () => {
    expect(isCleanDay(day("2026-07-01", 20 * 60), 30)).toBe(true);
    expect(isCleanDay(day("2026-07-01", 40 * 60), 30)).toBe(false);
  });
  it("treats a zero-activity day as clean", () => {
    expect(isCleanDay(day("2026-07-01", 0), 30)).toBe(true);
  });
});

describe("lifetimePoints", () => {
  it("sums points per clean day using each day's own limit", () => {
    const h = [day("2026-07-01", 10 * 60, 60), day("2026-07-02", 10 * 60, 30)];
    expect(lifetimePoints(h, 30)).toBe(20 + 50);
  });
  it("skips over-limit days", () => {
    const h = [day("2026-07-01", 90 * 60, 60), day("2026-07-02", 5 * 60, 30)];
    expect(lifetimePoints(h, 30)).toBe(50);
  });
});

describe("streaks", () => {
  it("counts consecutive clean days ending today", () => {
    const h = [day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30), day("2026-07-07", 5 * 60, 30)];
    expect(streaks(h, "2026-07-07", 30).current).toBe(3);
  });
  it("breaks the current streak on an over-limit day but keeps the best run", () => {
    const h = [
      day("2026-07-01", 5 * 60, 30), day("2026-07-02", 5 * 60, 30), day("2026-07-03", 5 * 60, 30),
      day("2026-07-04", 99 * 60, 30), // over -> breaks
      day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30),
    ];
    const s = streaks(h, "2026-07-06", 30);
    expect(s.current).toBe(2);
    expect(s.best).toBe(3);
  });
  it("counts an untracked/missing today as not-yet-broken (streak up to yesterday)", () => {
    const h = [day("2026-07-05", 5 * 60, 30), day("2026-07-06", 5 * 60, 30)];
    // today 07-07 has no record yet; the run through yesterday still stands.
    expect(streaks(h, "2026-07-07", 30).current).toBe(2);
  });
  it("breaks the current streak when a day in the middle is missing (gap = not clean)", () => {
    const h = [day("2026-07-04", 5 * 60, 30), day("2026-07-06", 5 * 60, 30), day("2026-07-07", 5 * 60, 30)];
    // 07-05 missing -> the run ending today is only 06,07.
    expect(streaks(h, "2026-07-07", 30).current).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/progress.test.ts -t streaks`
Expected: FAIL, `streaks is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `components/progress.ts`:

```ts
import type { DoomguardDay } from "../modules/doomguardnative";
import { toDayIndex } from "./history";

/** A day is clean when its short-form seconds are at or under that day's limit. */
export function isCleanDay(day: DoomguardDay, currentLimit: number): boolean {
  const limit = day.limitMinutes ?? currentLimit;
  return day.seconds <= limit * 60;
}

/** Lifetime points: sum over clean days of that day's rate. */
export function lifetimePoints(history: DoomguardDay[], currentLimit: number): number {
  let total = 0;
  for (const d of history) {
    if (isCleanDay(d, currentLimit)) {
      total += pointsForLimit(d.limitMinutes ?? currentLimit);
    }
  }
  return total;
}

/**
 * Current streak (consecutive clean days ending at/just before `today`) and the
 * best contiguous clean run in history. "Contiguous" = adjacent calendar days;
 * a missing day is a gap that ends a run. A missing `today` does not break the
 * run (the day isn't over yet) — we count back from the latest recorded day.
 */
export function streaks(
  history: DoomguardDay[],
  today: string,
  currentLimit: number
): { current: number; best: number } {
  const clean = new Map<number, boolean>();
  for (const d of history) clean.set(toDayIndex(d.date), isCleanDay(d, currentLimit));

  // Best: longest run of consecutive clean day-indices.
  const indices = [...clean.keys()].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const i of indices) {
    if (!clean.get(i)) { run = 0; prev = i; continue; }
    run = prev !== null && i === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = i;
  }

  // Current: count back from today; if today has no record, start at yesterday.
  const todayIdx = toDayIndex(today);
  let cursor = clean.has(todayIdx) ? todayIdx : todayIdx - 1;
  let current = 0;
  while (clean.get(cursor) === true) {
    current += 1;
    cursor -= 1;
  }
  return { current, best };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/progress.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add components/progress.ts components/progress.test.ts
git commit -m "feat(progress): streak, best streak, lifetime points"
```

---

## Task 3: computeProgress aggregate + pending moments (pure TS)

**Files:**
- Modify: `components/progress.ts`
- Test: `components/progress.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-2; cat thresholds passed in as a `number[]` (so `progress.ts` stays free of asset imports).
- Produces:
  - `type ProgressSeen = { lastCelebratedStreakMilestone: number; lastPointsCelebrated: number }`
  - `type Progress = { streak: number; best: number; points: number; limit: number; nextRung: number | null; unlockedCount: number; pendingLevelDown: { from: number; to: number; milestone: number } | null; pendingCatUnlocks: number[] }`
  - `computeProgress(history: DoomguardDay[], currentLimit: number, today: string, catThresholds: number[], seen: ProgressSeen): Progress`
- Semantics:
  - `unlockedCount` = number of `catThresholds` entries `<= points`.
  - `pendingLevelDown` is set when `streak > 0 && streak % 7 === 0 && nextRung !== null && streak > seen.lastCelebratedStreakMilestone`. `milestone` = `streak`.
  - `pendingCatUnlocks` = thresholds `t` where `seen.lastPointsCelebrated < t <= points` (the newly crossed ones).

- [ ] **Step 1: Write the failing test**

```ts
// append to components/progress.test.ts
import { computeProgress } from "./progress";

const clean7 = (limit: number, startDay: number) =>
  Array.from({ length: 7 }, (_, i) =>
    day(`2026-07-${String(startDay + i).padStart(2, "0")}`, 60, limit)
  );

describe("computeProgress", () => {
  const thresholds = [0, 50, 150, 400];
  const noneSeen = { lastCelebratedStreakMilestone: 0, lastPointsCelebrated: 0 };

  it("offers a level-down after a fresh 7-day streak above the floor", () => {
    const p = computeProgress(clean7(60, 1), 60, "2026-07-07", thresholds, noneSeen);
    expect(p.streak).toBe(7);
    expect(p.pendingLevelDown).toEqual({ from: 60, to: 45, milestone: 7 });
  });

  it("does not re-offer a milestone already celebrated", () => {
    const seen = { lastCelebratedStreakMilestone: 7, lastPointsCelebrated: 0 };
    const p = computeProgress(clean7(60, 1), 60, "2026-07-07", thresholds, seen);
    expect(p.pendingLevelDown).toBeNull();
  });

  it("never offers a level-down at the 15-minute floor", () => {
    const p = computeProgress(clean7(15, 1), 15, "2026-07-07", thresholds, noneSeen);
    expect(p.pendingLevelDown).toBeNull();
  });

  it("reports newly crossed cat thresholds as pending unlocks", () => {
    // 7 clean days at 15 min = 700 pts -> crosses 0,50,150,400.
    const p = computeProgress(clean7(15, 1), 15, "2026-07-07", thresholds, noneSeen);
    expect(p.points).toBe(700);
    expect(p.unlockedCount).toBe(4);
    expect(p.pendingCatUnlocks).toEqual([0, 50, 150, 400]);
  });

  it("only reports thresholds crossed since last celebrated points", () => {
    const seen = { lastCelebratedStreakMilestone: 0, lastPointsCelebrated: 150 };
    const p = computeProgress(clean7(15, 1), 15, "2026-07-07", thresholds, seen);
    expect(p.pendingCatUnlocks).toEqual([400]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest components/progress.test.ts -t computeProgress`
Expected: FAIL, `computeProgress is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `components/progress.ts`:

```ts
export type ProgressSeen = {
  lastCelebratedStreakMilestone: number;
  lastPointsCelebrated: number;
};

export type Progress = {
  streak: number;
  best: number;
  points: number;
  limit: number;
  nextRung: number | null;
  unlockedCount: number;
  pendingLevelDown: { from: number; to: number; milestone: number } | null;
  pendingCatUnlocks: number[];
};

export function computeProgress(
  history: DoomguardDay[],
  currentLimit: number,
  today: string,
  catThresholds: number[],
  seen: ProgressSeen
): Progress {
  const { current: streak, best } = streaks(history, today, currentLimit);
  const points = lifetimePoints(history, currentLimit);
  const nextRung = nextRungBelow(currentLimit);
  const unlockedCount = catThresholds.filter((t) => t <= points).length;

  const pendingLevelDown =
    streak > 0 && streak % 7 === 0 && nextRung !== null && streak > seen.lastCelebratedStreakMilestone
      ? { from: currentLimit, to: nextRung, milestone: streak }
      : null;

  const pendingCatUnlocks = catThresholds
    .filter((t) => t > seen.lastPointsCelebrated && t <= points)
    .sort((a, b) => a - b);

  return { streak, best, points, limit: currentLimit, nextRung, unlockedCount, pendingLevelDown, pendingCatUnlocks };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest components/progress.test.ts`
Expected: PASS (all blocks).

- [ ] **Step 5: Commit**

```bash
git add components/progress.ts components/progress.test.ts
git commit -m "feat(progress): computeProgress aggregate with pending moments"
```

---

## Task 4: Cats carry unlock thresholds

**Files:**
- Modify: `components/cats.ts`
- Modify: `components/CatGallery.tsx`

**Interfaces:**
- Produces: `CATS: { src: ImageSourcePropType; unlockAt: number }[]` and `CAT_THRESHOLDS: number[]` (the `unlockAt` values in order).
- Consumes (CatGallery): a new prop `unlockedCount: number`.

- [ ] **Step 1: Update the cats data**

Rewrite `components/cats.ts`:

```ts
import type { ImageSourcePropType } from "react-native";

/**
 * Pictures for the "Cats, not reels" gallery, each gated behind a cumulative
 * lifetime-points threshold. Frequent early, sparse later; the first cat is
 * free so the gallery is never empty. Add a cat by appending { src, unlockAt }.
 */
export type Cat = { src: ImageSourcePropType; unlockAt: number };

export const CATS: Cat[] = [
  { src: { uri: "https://i.pinimg.com/736x/c0/78/08/c078082c4423cda6216a7b4627c6eb52.jpg" }, unlockAt: 0 },
  { src: { uri: "https://media.tenor.com/zCTU9e8SmVMAAAAM/1000-yard-stare-cat-meme.gif" }, unlockAt: 50 },
  { src: { uri: "https://cdn-useast1.kapwing.com/static/templates/crying-cat-meme-template-full-719a53dc.webp" }, unlockAt: 150 },
  { src: { uri: "https://media.tenor.com/47qpxBq_Tw0AAAAe/cat-cat-meme.png" }, unlockAt: 400 },
];

/** The unlock thresholds in order, for progress derivation. */
export const CAT_THRESHOLDS: number[] = CATS.map((c) => c.unlockAt);
```

- [ ] **Step 2: Update CatGallery to render locked/unlocked tiles**

In `components/CatGallery.tsx`: add `unlockedCount: number` to the component props. Change the tile map to gate on index. Replace the import `import { CATS } from "./cats";` (it still works) and the tile block:

```tsx
// signature:
export function CatGallery({
  visible,
  onClose,
  unlockedCount,
}: {
  visible: boolean;
  onClose: () => void;
  unlockedCount: number;
}) {
```

Replace the `{CATS.map((src, i) => (...))}` block with:

```tsx
{CATS.map((cat, i) => {
  const unlocked = i < unlockedCount;
  if (unlocked) {
    return (
      <Image
        key={i}
        source={cat.src}
        style={{ width: tile, height: tile, borderRadius: 18 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View
      key={i}
      style={{ width: tile, height: tile, borderRadius: 18, backgroundColor: C.panel, alignItems: "center", justifyContent: "center", gap: 8 }}
    >
      <Ionicons name="lock-closed" size={20} color={C.dim} />
      <Text className="text-[12.5px] font-medium text-ash">Unlock at {cat.unlockAt} pts</Text>
    </View>
  );
})}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). Note: `App.tsx` will error on the missing `unlockedCount` prop until Task 7 — if so, temporarily pass `unlockedCount={0}` at the existing `<CatGallery ... />` call in `App.tsx` and keep it until Task 7 wires the real value.

- [ ] **Step 4: Commit**

```bash
git add components/cats.ts components/CatGallery.tsx App.tsx
git commit -m "feat(cats): unlock thresholds + locked tiles in gallery"
```

---

## Task 5: ProgressStrip component (home strip)

**Files:**
- Create: `components/ProgressStrip.tsx`

**Interfaces:**
- Consumes: `{ streak: number; best: number; points: number; onPress?: () => void }`.
- Produces: default-exported `ProgressStrip` React component.

- [ ] **Step 1: Create the component**

```tsx
// components/ProgressStrip.tsx
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./console";

/** Slim positive-reinforcement strip: current streak + lifetime points. */
export function ProgressStrip({
  streak,
  best,
  points,
  onPress,
}: {
  streak: number;
  best: number;
  points: number;
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
        {best > streak ? (
          <Text className="text-[12.5px] text-dim">best {best}</Text>
        ) : null}
      </View>
      <Text className="text-[14px] font-medium text-ash">
        <Text className="font-semibold text-bone">{points.toLocaleString()}</Text> pts
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ProgressStrip.tsx
git commit -m "feat(progress): home ProgressStrip component"
```

---

## Task 6: MilestoneModal component (celebration + level-down offer)

**Files:**
- Create: `components/MilestoneModal.tsx`

**Interfaces:**
- Consumes:
  ```ts
  {
    visible: boolean;
    kind: "streak" | "cats" | null;
    streak: number;
    unlockedCats: number; // count newly unlocked, for copy
    levelDown: { from: number; to: number } | null;
    onAcceptLevelDown: () => void;
    onDismiss: () => void;
  }
  ```
- Produces: default-exported `MilestoneModal`. Uses the existing `Kicker` from `./console`, `fmtLimit`-style formatting inline, Reanimated `SlideInDown` like the other modals in `App.tsx`.

- [ ] **Step 1: Create the component**

```tsx
// components/MilestoneModal.tsx
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SlideInDown } from "react-native-reanimated";
import { C, Kicker } from "./console";

function fmtLimit(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Full-screen celebratory beat for a streak milestone or a batch of cat unlocks. */
export function MilestoneModal({
  visible,
  kind,
  streak,
  unlockedCats,
  levelDown,
  onAcceptLevelDown,
  onDismiss,
}: {
  visible: boolean;
  kind: "streak" | "cats" | null;
  streak: number;
  unlockedCats: number;
  levelDown: { from: number; to: number } | null;
  onAcceptLevelDown: () => void;
  onDismiss: () => void;
}) {
  const title = kind === "streak" ? `${streak} days clean.` : unlockedCats === 1 ? "New cat unlocked." : "New cats unlocked.";
  const body =
    kind === "streak"
      ? "A full week under your limit. That is a real habit forming."
      : "Your points earned you something better to look at than reels.";

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View className="flex-1 justify-end bg-black/60 p-4">
        <Animated.View entering={SlideInDown.duration(200)}>
          <View className="gap-5 rounded-[28px] bg-panel p-6">
            <View className="gap-2">
              <View className="h-[64px] w-[64px] items-center justify-center rounded-full" style={{ backgroundColor: "rgba(56,199,134,0.14)" }}>
                <Ionicons name={kind === "streak" ? "flame" : "paw"} size={30} color={C.toxic} />
              </View>
              <Kicker color={C.toxic} style={{ marginTop: 8 }}>
                {kind === "streak" ? "Streak milestone" : "Reward"}
              </Kicker>
              <Text className="text-[26px] font-semibold text-bone" style={{ letterSpacing: -0.5 }}>
                {title}
              </Text>
              <Text className="text-[14.5px] leading-6 text-ash">{body}</Text>
            </View>

            {levelDown ? (
              <View className="gap-2.5">
                <Text className="text-[14.5px] leading-6 text-bone">
                  Ready for less? Drop your limit from {fmtLimit(levelDown.from)} to {fmtLimit(levelDown.to)} and earn more per clean day.
                </Text>
                <Pressable onPress={onAcceptLevelDown} className="items-center rounded-2xl bg-toxic py-4 active:opacity-80">
                  <Text className="text-[15.5px] font-semibold text-ink">Lower to {fmtLimit(levelDown.to)}</Text>
                </Pressable>
                <Pressable onPress={onDismiss} className="items-center rounded-2xl py-3 active:opacity-60">
                  <Text className="text-[15px] font-medium text-dim">Keep {fmtLimit(levelDown.from)} for now</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={onDismiss} className="items-center rounded-2xl bg-toxic py-4 active:opacity-80">
                <Text className="text-[15.5px] font-semibold text-ink">Nice</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/MilestoneModal.tsx
git commit -m "feat(progress): MilestoneModal celebration + level-down offer"
```

---

## Task 7: Wire progress into App.tsx

**Files:**
- Modify: `App.tsx`
- Modify: `modules/doomguardnative/index.ts` (JS-side additions only; native Kotlin lands in Task 8)

**Interfaces:**
- Consumes: `computeProgress`, `ProgressSeen`, `Progress` from `./components/progress`; `CAT_THRESHOLDS` from `./components/cats`; `ProgressStrip`, `MilestoneModal`; new native accessors `markStreakCelebrated`, `markPointsCelebrated` (JS wrappers safe-no-op when native absent, like the existing ones).
- Produces: home screen renders the strip and fires the modal.

- [ ] **Step 1: Extend the TS module surface**

In `modules/doomguardnative/index.ts`:

Add to `DoomguardDay`:
```ts
  /** Daily limit in effect that day, in minutes. Absent on days archived before this shipped. */
  limitMinutes?: number;
```

Add to `DoomguardStatus`:
```ts
  /** Highest streak milestone already celebrated (so the moment doesn't re-fire). */
  lastCelebratedStreakMilestone: number;
  /** Lifetime points value at which cat-unlock reveals were last shown. */
  lastPointsCelebrated: number;
```

Add to the `NativeModule` type and export wrappers mirroring the existing safe pattern:
```ts
  markStreakCelebrated(milestone: number): void;
  markPointsCelebrated(points: number): void;
```
```ts
export function markStreakCelebrated(milestone: number): void {
  if (!nativeModule) return;
  try { nativeModule.markStreakCelebrated(milestone); } catch {}
}
export function markPointsCelebrated(points: number): void {
  if (!nativeModule) return;
  try { nativeModule.markPointsCelebrated(points); } catch {}
}
```

Because native may not yet expose the seen-fields (Task 8), read them defensively in `App.tsx` with `?? 0`.

- [ ] **Step 2: Wire the derivation and UI in App.tsx**

In `App.tsx`:

Add imports:
```tsx
import { computeProgress, type Progress } from "./components/progress";
import { CAT_THRESHOLDS } from "./components/cats";
import { ProgressStrip } from "./components/ProgressStrip";
import { MilestoneModal } from "./components/MilestoneModal";
import { getHistory, markStreakCelebrated, markPointsCelebrated, setLimit } from "./modules/doomguardnative";
```
(`setLimit` is already imported; merge, don't duplicate.)

Add a `localToday()` helper (copy the one already in `components/HistoryScreen.tsx`) near the top of `App.tsx`:
```tsx
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

Inside `App()`, after `status` is derived, compute progress and a milestone-modal state:
```tsx
const progress: Progress = computeProgress(
  getHistory(),
  limit,
  localToday(),
  CAT_THRESHOLDS,
  {
    lastCelebratedStreakMilestone: status?.lastCelebratedStreakMilestone ?? 0,
    lastPointsCelebrated: status?.lastPointsCelebrated ?? 0,
  }
);

const [milestone, setMilestone] = useState<
  { kind: "streak" | "cats"; streak: number; unlockedCats: number; levelDown: { from: number; to: number } | null } | null
>(null);

// Surface a pending moment once per resume. Streak offer takes priority over cats.
useMountEffect(() => {
  if (progress.pendingLevelDown) {
    setMilestone({
      kind: "streak",
      streak: progress.pendingLevelDown.milestone,
      unlockedCats: 0,
      levelDown: { from: progress.pendingLevelDown.from, to: progress.pendingLevelDown.to },
    });
  } else if (progress.pendingCatUnlocks.length) {
    setMilestone({ kind: "cats", streak: progress.streak, unlockedCats: progress.pendingCatUnlocks.length, levelDown: null });
  }
});
```

Render `ProgressStrip` in the ready branch, directly under the header row (after the `<View className="flex-row items-center justify-between">...</View>` that holds `Brand` + `LimitChip`, before `<Dashboard .../>`):
```tsx
<ProgressStrip streak={progress.streak} best={progress.best} points={progress.points} onPress={() => setScreen("history")} />
```

Pass `unlockedCount` to the existing `<CatGallery ... />`:
```tsx
<CatGallery visible={catsOpen} onClose={() => setCatsOpen(false)} unlockedCount={progress.unlockedCount} />
```

Add the milestone modal near the other modals at the bottom of the tree:
```tsx
<MilestoneModal
  visible={milestone !== null}
  kind={milestone?.kind ?? null}
  streak={milestone?.streak ?? 0}
  unlockedCats={milestone?.unlockedCats ?? 0}
  levelDown={milestone?.levelDown ?? null}
  onAcceptLevelDown={() => {
    if (milestone?.levelDown) setLimit(milestone.levelDown.to);
    if (milestone?.kind === "streak") markStreakCelebrated(milestone.streak);
    setMilestone(null);
    refresh();
  }}
  onDismiss={() => {
    if (milestone?.kind === "streak") markStreakCelebrated(milestone.streak);
    if (milestone?.kind === "cats") markPointsCelebrated(progress.points);
    setMilestone(null);
    refresh();
  }}
/>
```

- [ ] **Step 3: Typecheck + run the full JS test suite**

Run: `npx tsc --noEmit && npx jest`
Expected: `tsc` clean; all jest suites (existing 32 + new progress tests) PASS.

- [ ] **Step 4: Commit**

```bash
git add App.tsx modules/doomguardnative/index.ts
git commit -m "feat(progress): wire streak/points/milestones into home"
```

---

## Task 8: Native — record per-day limit + seen flags + mark setters (Kotlin)

This task is not unit-testable in jest (native runs on-device). It is additive; the JS already falls back gracefully when these are absent. Verify by `tsc` + build, and (when a device is available) by inspecting behavior.

**Files:**
- Modify: `android/app/src/main/java/com/rogerantony/doomguard/ReelAccessibilityService.kt:947-959` (archive the limit)
- Modify: `modules/doomguardnative/android/src/main/java/expo/modules/doomguardnative/DoomguardnativeModule.kt`

- [ ] **Step 1: Record the limit when archiving a day**

In `ReelAccessibilityService.kt`, change `archiveDay` to also store the limit in effect. Update the call site at line 933 to pass it.

`archiveDay` signature and body (lines 947-959):
```kotlin
    /** Fold one finished day's totals into the persisted history JSON map. */
    private fun archiveDay(date: String, seconds: Int, count: Int, shorts: Int, limitMinutes: Int) {
        val history = runCatching {
            JSONObject(prefs.getString("history", "{}") ?: "{}")
        }.getOrElse { JSONObject() }
        history.put(
            date,
            JSONObject()
                .put("seconds", seconds)
                .put("count", count)
                .put("shorts", shorts)
                .put("limitMinutes", limitMinutes),
        )
        prefs.edit().putString("history", history.toString()).apply()
    }
```

Call site (line 933) becomes:
```kotlin
                if (seconds > 0 || count > 0 || shorts > 0) {
                    archiveDay(storedDate, seconds, count, shorts, limitMinutes())
                }
```

- [ ] **Step 2: Surface `limitMinutes` in the module's history reader**

In `DoomguardnativeModule.kt`, the `history()` function currently tracks `IntArray` of `[seconds, count, shorts]`. Extend to carry the limit. Change the map value to a 4-int array and read `limitMinutes` (default 0 = "unknown", JS falls back):

Replace the body of `history()` (lines 221-258):
```kotlin
  private fun history(context: Context): List<Map<String, Any>> {
    val prefs = prefs(context)
    val byDate = linkedMapOf<String, IntArray>() // date -> [seconds, count, shorts, limitMinutes]

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
          day.optInt("limitMinutes"),
        )
      }
    }

    val liveDate = prefs.getString("date", null)
    if (liveDate != null) {
      val cur = byDate[liveDate] ?: intArrayOf(0, 0, 0, 0)
      cur[0] += prefs.getInt("seconds", 0)
      cur[1] += prefs.getInt("count", 0)
      cur[2] += prefs.getInt("shortsCount", 0)
      cur[3] = limitMinutes(context) // live day: current limit
      byDate[liveDate] = cur
    }

    return byDate.entries
      .sortedBy { it.key }
      .map { (date, v) ->
        val m = mutableMapOf<String, Any>(
          "date" to date,
          "seconds" to v[0],
          "count" to v[1],
          "shorts" to v[2],
        )
        if (v[3] > 0) m["limitMinutes"] = v[3]
        m
      }
  }
```

- [ ] **Step 3: Add seen-flags to status + mark setters**

In `DoomguardnativeModule.kt` `getStatus()` map, add two entries:
```kotlin
        "lastCelebratedStreakMilestone" to prefs(context).getInt("lastCelebratedStreakMilestone", 0),
        "lastPointsCelebrated" to prefs(context).getInt("lastPointsCelebrated", 0),
```
Add the same two keys to `defaultStatus()` with value `0`.

Add two `Function` setters inside `definition()` (next to the other setters):
```kotlin
    Function("markStreakCelebrated") { milestone: Int ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      val p = prefs(context)
      val cur = p.getInt("lastCelebratedStreakMilestone", 0)
      if (milestone > cur) p.edit().putInt("lastCelebratedStreakMilestone", milestone).apply()
    }

    Function("markPointsCelebrated") { points: Int ->
      val context = appContext.reactContext?.applicationContext ?: return@Function
      val p = prefs(context)
      val cur = p.getInt("lastPointsCelebrated", 0)
      if (points > cur) p.edit().putInt("lastPointsCelebrated", points).apply()
    }
```

- [ ] **Step 4: Typecheck the JS side still matches**

Run: `npx tsc --noEmit`
Expected: PASS (the `DoomguardStatus` fields added in Task 7 now have native providers; JS still uses `?? 0`, which is fine).

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/rogerantony/doomguard/ReelAccessibilityService.kt modules/doomguardnative/android/src/main/java/expo/modules/doomguardnative/DoomguardnativeModule.kt
git commit -m "feat(progress): native per-day limit + celebration seen-flags"
```

---

## Task 9: Preview mockup for user review (no device needed)

The user reviews via headless-Chrome screenshots of HTML phone mockups (see the redesign workflow). This task produces a static preview of the new surfaces so the user can approve the look before a device build.

**Files:**
- Create: `design-previews/gen-progress.js`

- [ ] **Step 1: Write the generator**

Model it on the existing `design-previews/gen-quiet-dark.js` (same tokens/mockup frame). Emit an HTML board to `out-progress/board.html` showing three phone frames on the `#0D0D0C` canvas with `#F2F1EC` text and the `#38C786` accent:
1. Home with the `ProgressStrip` ("5 days clean · best 8" left, "1,240 pts" right) sitting under the header, above the guilt hero.
2. The `MilestoneModal` streak moment with the "Lower to 45m" / "Keep 60m for now" buttons.
3. The Cats gallery with 2 unlocked tiles and 2 locked "Unlock at N pts" tiles.

Reuse the exact class-to-CSS token mapping the sibling generators use so the mockup matches the RN output 1:1.

- [ ] **Step 2: Render the screenshots**

Run:
```bash
node design-previews/gen-progress.js
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --headless=new --force-device-scale-factor=2 --window-size=440,900 --virtual-time-budget=5000 --screenshot=design-previews/out-progress/board.png design-previews/out-progress/board.html
```
Expected: `design-previews/out-progress/board.png` is written.

- [ ] **Step 3: Show the user and get sign-off**

Read the PNG back and present it. Iterate on copy/layout before any device build.

- [ ] **Step 4: Commit**

```bash
git add design-previews/gen-progress.js
git commit -m "chore(progress): headless preview mockup"
```

---

## Self-Review notes

- **Spec coverage:** four numbers (Task 2-3, 5), points formula (Task 1), ratchet/offer (Task 3, 6, 7), streak break + best kept (Task 2), clean-day definition (Task 2), milestone moment (Task 6-7), cat unlocks + curve + first-free (Task 4), home surface (Task 5, 7), native `limitMinutes` + durable flags (Task 8), edge cases (fresh install / limit change / backslide all covered by defensive `?? currentLimit` and per-day judging in Task 2). No streak multiplier, no ranks/titles (out of scope).
- **Type consistency:** `computeProgress` / `Progress` / `ProgressSeen` names identical across Tasks 3 and 7. `markStreakCelebrated` / `markPointsCelebrated` identical across Tasks 7 and 8. `CAT_THRESHOLDS` and `CATS: Cat[]` from Task 4 consumed in Tasks 4/7. `unlockedCount` prop name identical across Tasks 4 and 7.
- **Preview-before-device:** because the user can't run on device, the derivation and UI are fully testable via jest and viewable via the Task 9 mockup before Task 8's native code is exercised.
