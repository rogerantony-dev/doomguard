# Reel Nudges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show cat-themed intervention modals over Instagram/YouTube while on a reel/short — fired by time-of-day, cumulative thresholds, and history comparisons — that nudge the user to stop.

**Architecture:** Native-first. `ReelAccessibilityService` evaluates triggers on reel-entry and on each time/count update, and draws a `WindowManager` modal styled like the app's `PushThroughModal` (random `doomguard_cat_*` photo, hazard strip, two buttons). Selection rules (priority, threshold-crossing, once-per-day, 20-min cooldown) are mirrored in a React-free `components/nudges.ts` and unit-tested with jest; Kotlin is the source of truth. "Watch a cat instead" sets an `openCats` pref and launches the app; `App.tsx` consumes the flag on resume and opens the existing `CatGallery`.

**Tech Stack:** Kotlin (Android accessibility service + Expo module), TypeScript, Expo SDK 54 / RN 0.81, jest-expo (already installed by the history feature).

## Global Constraints

- **Guilt mode only.** Every evaluation is a no-op unless `currentMode() == "guilt"`. No nudges in Block mode. No on/off toggle.
- **Once per day per trigger** (tracked in `nudgeFiredToday`, reset at midnight) **and a global 20-minute cooldown** (`lastNudgeAt`, time-based, not reset at midnight). A trigger blocked by cooldown is NOT marked fired.
- **Tap to clear.** Modal covers the reel with a `#BF000000` scrim and never auto-dismisses. Two buttons: **Watch a cat instead** (violet `#7C3AED`, always instant) and **Keep scrolling** (ghost; on HARD triggers disabled with a 3-2-1 countdown).
- **HARD triggers:** `latenight`, `morning`, `workhours` (countdown on Keep scrolling). All others are SOFT (instant).
- **Timer pauses while a modal is shown** (`nudgeModalShown` gate in `addSeconds`).
- **No new dependencies, no new cat assets** (reuse `doomguard_cat_1..catCount`). Modal built programmatically, mirroring `PushThroughModal`.
- **Local calendar days, `yyyy-MM-dd`**, matching the existing `today()`/`SimpleDateFormat` and the history store.
- **Defensive overlays:** wrap `addView` in `runCatching` like the pill/cover; a failure means no nudge, never a crash.

**Trigger priority (highest first):** `latenight` > `morning` > `workhours` > `sitting` > `time120` > `time90` > `time60` > `time45` > `time30` > `time15` > `count100` > `count50` > `count25` > `vsyesterday` > `cleanday` > `weekly`.

**Thresholds:** time (seconds) 900/1800/2700/3600/5400/7200; count (reels+shorts) 25/50/100; sitting 900s continuous; `vsyesterday` crosses yesterday's archived seconds; `cleanday` when `0 < yesterdaySeconds < 900`; `weekly` on entry (shows rolling 7-day total).

---

### Task 1: Pure selection logic + jest (TDD)

**Files:**
- Create: `components/nudges.ts`
- Create: `components/nudges.test.ts`

**Interfaces:**
- Produces:
  - `export type NudgeEvent = "entry" | "tick"`
  - `export type NudgeState = { mode: "guilt" | "block"; event: NudgeEvent; nowMs: number; hour: number; weekday: number; seconds: number; prevSeconds: number; count: number; prevCount: number; sitting: number; prevSitting: number; yesterdaySeconds: number; firedToday: readonly string[]; lastNudgeAt: number }`
  - `export const COOLDOWN_MS = 1200000`
  - `export const TIME_THRESHOLDS: { key: string; at: number }[]` and `export const COUNT_THRESHOLDS: { key: string; at: number }[]`
  - `export function pickNudge(s: NudgeState): string | null` — returns the highest-priority eligible trigger key, or null. `weekday`: 0=Sun..6=Sat.

- [ ] **Step 1: Write the failing tests**

Create `components/nudges.test.ts`:

```typescript
import { pickNudge, COOLDOWN_MS, type NudgeState } from "./nudges";

const base: NudgeState = {
  mode: "guilt",
  event: "tick",
  nowMs: 10_000_000,
  hour: 12,
  weekday: 3, // Wednesday
  seconds: 0,
  prevSeconds: 0,
  count: 0,
  prevCount: 0,
  sitting: 0,
  prevSitting: 0,
  yesterdaySeconds: 0,
  firedToday: [],
  lastNudgeAt: 0,
};

describe("guards", () => {
  it("never fires in block mode", () => {
    expect(pickNudge({ ...base, mode: "block", event: "entry", hour: 2 })).toBeNull();
  });

  it("suppresses everything inside the cooldown window", () => {
    const s = { ...base, event: "tick", prevSeconds: 899, seconds: 901, nowMs: 100, lastNudgeAt: 100 - (COOLDOWN_MS - 1) };
    expect(pickNudge(s)).toBeNull();
  });

  it("allows once the cooldown has lapsed", () => {
    const s = { ...base, event: "tick", prevSeconds: 899, seconds: 901, nowMs: COOLDOWN_MS + 100, lastNudgeAt: 0 };
    expect(pickNudge(s)).toBe("time15");
  });
});

describe("time-of-day (entry, HARD)", () => {
  it("fires latenight before 5am", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 2 })).toBe("latenight");
  });
  it("fires morning at 09:59 but not 10:00", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 9 })).toBe("morning");
    expect(pickNudge({ ...base, event: "entry", hour: 10 })).toBe("workhours");
  });
  it("workhours only on weekdays", () => {
    expect(pickNudge({ ...base, event: "entry", hour: 11, weekday: 0 })).toBe("weekly");
  });
  it("does not fire time-of-day on a tick event", () => {
    expect(pickNudge({ ...base, event: "tick", hour: 2 })).toBeNull();
  });
});

describe("threshold crossing (tick)", () => {
  it("fires time30 exactly when crossing 1800", () => {
    expect(pickNudge({ ...base, prevSeconds: 1799, seconds: 1800 })).toBe("time30");
  });
  it("does not re-fire once already past the threshold", () => {
    expect(pickNudge({ ...base, prevSeconds: 1800, seconds: 1801 })).toBeNull();
  });
  it("fires the highest threshold crossed", () => {
    expect(pickNudge({ ...base, prevSeconds: 3500, seconds: 3700 })).toBe("time60");
  });
  it("fires count50 crossing 50 swipes", () => {
    expect(pickNudge({ ...base, prevCount: 49, count: 50 })).toBe("count50");
  });
  it("fires sitting at 15 continuous minutes", () => {
    expect(pickNudge({ ...base, prevSitting: 899, sitting: 900 })).toBe("sitting");
  });
  it("fires vsyesterday when passing yesterday's total", () => {
    expect(pickNudge({ ...base, yesterdaySeconds: 1000, prevSeconds: 1000, seconds: 1010 })).toBe("vsyesterday");
  });
});

describe("priority + once-per-day", () => {
  it("prefers sitting over a time milestone in the same tick", () => {
    const s = { ...base, prevSitting: 899, sitting: 900, prevSeconds: 899, seconds: 900 };
    expect(pickNudge(s)).toBe("sitting");
  });
  it("skips an already-fired trigger and falls through", () => {
    const s = { ...base, prevSitting: 899, sitting: 900, prevSeconds: 899, seconds: 900, firedToday: ["sitting"] };
    expect(pickNudge(s)).toBe("time15");
  });
  it("prefers cleanday over weekly on entry", () => {
    expect(pickNudge({ ...base, event: "entry", yesterdaySeconds: 300 })).toBe("cleanday");
  });
  it("weekly when yesterday wasn't clean", () => {
    expect(pickNudge({ ...base, event: "entry", yesterdaySeconds: 5000 })).toBe("weekly");
  });
  it("no cleanday when there is no yesterday data", () => {
    expect(pickNudge({ ...base, event: "entry", yesterdaySeconds: 0 })).toBe("weekly");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd <repo root> && npx jest components/nudges.test.ts`
Expected: FAIL — `Cannot find module './nudges'`.

- [ ] **Step 3: Implement `components/nudges.ts`**

```typescript
export type NudgeEvent = "entry" | "tick";

export type NudgeState = {
  mode: "guilt" | "block";
  event: NudgeEvent;
  nowMs: number;
  /** Local hour 0–23. */
  hour: number;
  /** 0=Sun … 6=Sat. */
  weekday: number;
  seconds: number;
  prevSeconds: number;
  count: number;
  prevCount: number;
  sitting: number;
  prevSitting: number;
  yesterdaySeconds: number;
  firedToday: readonly string[];
  lastNudgeAt: number;
};

export const COOLDOWN_MS = 20 * 60 * 1000;

/** Highest first. */
export const TIME_THRESHOLDS: { key: string; at: number }[] = [
  { key: "time120", at: 7200 },
  { key: "time90", at: 5400 },
  { key: "time60", at: 3600 },
  { key: "time45", at: 2700 },
  { key: "time30", at: 1800 },
  { key: "time15", at: 900 },
];

export const COUNT_THRESHOLDS: { key: string; at: number }[] = [
  { key: "count100", at: 100 },
  { key: "count50", at: 50 },
  { key: "count25", at: 25 },
];

const crossed = (prev: number, cur: number, at: number): boolean => prev < at && cur >= at;

/** Candidate keys in priority order whose condition is currently met. */
function candidates(s: NudgeState): string[] {
  const out: string[] = [];

  if (s.event === "entry") {
    const isWeekday = s.weekday >= 1 && s.weekday <= 5;
    if (s.hour < 5) out.push("latenight");
    else if (s.hour < 10) out.push("morning");
    else if (isWeekday && s.hour < 17) out.push("workhours");
  } else {
    if (crossed(s.prevSitting, s.sitting, 900)) out.push("sitting");
    for (const t of TIME_THRESHOLDS) if (crossed(s.prevSeconds, s.seconds, t.at)) out.push(t.key);
    for (const c of COUNT_THRESHOLDS) if (crossed(s.prevCount, s.count, c.at)) out.push(c.key);
    if (s.yesterdaySeconds > 0 && crossed(s.prevSeconds, s.seconds, s.yesterdaySeconds + 1))
      out.push("vsyesterday");
  }

  if (s.event === "entry") {
    if (s.yesterdaySeconds > 0 && s.yesterdaySeconds < 900) out.push("cleanday");
    out.push("weekly");
  }

  return out;
}

export function pickNudge(s: NudgeState): string | null {
  if (s.mode !== "guilt") return null;
  if (s.nowMs - s.lastNudgeAt < COOLDOWN_MS) return null;
  const fired = new Set(s.firedToday);
  for (const key of candidates(s)) {
    if (!fired.has(key)) return key;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd <repo root> && npx jest components/nudges.test.ts`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add components/nudges.ts components/nudges.test.ts
git commit -m "Nudges: tested trigger-selection logic (priority, crossing, cooldown)"
```

---

### Task 2: Native — prefs, state readers, day-rollover reset, selection

**Files:**
- Modify: `plugin/native/ReelAccessibilityService.kt`

**Interfaces:**
- Consumes: existing `prefs`, `currentSeconds()`, `currentMode()`, `ensureToday()`, the `history` JSON store, `JSONObject` import.
- Produces (private members on the service):
  - `var nudgeModalShown: Boolean`, `var sittingSeconds: Int`, `var wasOnReel: Boolean`
  - `fun yesterdaySeconds(): Int`, `fun weekSeconds(): Int`, `fun dayKey(offsetDays: Int): String`
  - `fun nudgeFiredToday(): MutableSet<String>`, `fun markNudgeFired(key: String)`, `fun cooldownActive(): Boolean`
  - `fun pickNudgeKey(event: String, prevSeconds: Int, seconds: Int, prevCount: Int, count: Int, prevSitting: Int, sitting: Int): String?`

- [ ] **Step 1: Add state fields**

In `ReelAccessibilityService.kt`, near the other mutable overlay state (around the `overlayShown`/`catCoverVisible` declarations, ~line 64), add:

```kotlin
    // Nudge state. nudgeModalShown freezes the time ticker while a modal is up;
    // sittingSeconds measures one unbroken reel sitting; wasOnReel tracks the
    // not-on-reel → on-reel transition so entry triggers fire once per entry.
    private var nudgeModalShown = false
    private var sittingSeconds = 0
    private var wasOnReel = false
    private val nudgeCooldownMs = 20 * 60 * 1000L
```

- [ ] **Step 2: Add date + history readers**

Add these private methods (place them right after `archiveDay(...)`, after line ~873):

```kotlin
    /** "yyyy-MM-dd" for today minus [offsetDays], device-local — matches today(). */
    private fun dayKey(offsetDays: Int): String {
        val cal = java.util.Calendar.getInstance()
        cal.add(java.util.Calendar.DAY_OF_YEAR, -offsetDays)
        return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.time)
    }

    private fun archivedSeconds(date: String): Int {
        val json = runCatching {
            JSONObject(prefs.getString("history", "{}") ?: "{}")
        }.getOrElse { JSONObject() }
        return json.optJSONObject(date)?.optInt("seconds") ?: 0
    }

    /** Yesterday's archived reel/short seconds (0 if none recorded). */
    private fun yesterdaySeconds(): Int = archivedSeconds(dayKey(1))

    /** Rolling 7-day seconds: today's live counter + the last 6 archived days. */
    private fun weekSeconds(): Int {
        var total = currentSeconds()
        for (i in 1..6) total += archivedSeconds(dayKey(i))
        return total
    }
```

- [ ] **Step 3: Add fired-today + cooldown helpers**

Add after the readers above:

```kotlin
    private fun nudgeFiredToday(): MutableSet<String> =
        prefs.getStringSet("nudgeFiredToday", emptySet())?.toMutableSet() ?: mutableSetOf()

    private fun markNudgeFired(key: String) {
        val set = nudgeFiredToday()
        set.add(key)
        prefs.edit()
            .putStringSet("nudgeFiredToday", set)
            .putLong("lastNudgeAt", System.currentTimeMillis())
            .apply()
    }

    private fun cooldownActive(): Boolean =
        System.currentTimeMillis() - prefs.getLong("lastNudgeAt", 0L) < nudgeCooldownMs
```

- [ ] **Step 4: Add the selection (Kotlin mirror of `pickNudge`)**

Add after the helpers:

```kotlin
    private val timeThresholds = listOf(
        "time120" to 7200, "time90" to 5400, "time60" to 3600,
        "time45" to 2700, "time30" to 1800, "time15" to 900,
    )
    private val countThresholds = listOf("count100" to 100, "count50" to 50, "count25" to 25)

    private fun crossed(prev: Int, cur: Int, at: Int): Boolean = prev < at && cur >= at

    /**
     * Highest-priority eligible trigger key, or null. Mirrors components/nudges.ts
     * (kept in sync as an executable spec of these rules).
     */
    private fun pickNudgeKey(
        event: String, prevSeconds: Int, seconds: Int,
        prevCount: Int, count: Int, prevSitting: Int, sitting: Int,
    ): String? {
        if (currentMode() != "guilt") return null
        if (cooldownActive()) return null

        val cal = java.util.Calendar.getInstance()
        val hour = cal.get(java.util.Calendar.HOUR_OF_DAY)
        val dow = cal.get(java.util.Calendar.DAY_OF_WEEK) // 1=Sun..7=Sat
        val isWeekday = dow in java.util.Calendar.MONDAY..java.util.Calendar.FRIDAY
        val yest = yesterdaySeconds()
        val fired = nudgeFiredToday()

        val candidates = mutableListOf<String>()
        if (event == "entry") {
            when {
                hour < 5 -> candidates.add("latenight")
                hour < 10 -> candidates.add("morning")
                isWeekday && hour < 17 -> candidates.add("workhours")
            }
        } else {
            if (crossed(prevSitting, sitting, 900)) candidates.add("sitting")
            for ((key, at) in timeThresholds) if (crossed(prevSeconds, seconds, at)) candidates.add(key)
            for ((key, at) in countThresholds) if (crossed(prevCount, count, at)) candidates.add(key)
            if (yest > 0 && crossed(prevSeconds, seconds, yest + 1)) candidates.add("vsyesterday")
        }
        if (event == "entry") {
            if (yest in 1..899) candidates.add("cleanday")
            candidates.add("weekly")
        }

        return candidates.firstOrNull { it !in fired }
    }
```

- [ ] **Step 5: Reset fired-today on the day rollover**

In `ensureToday()`, add `nudgeFiredToday` to the reset `edit()` chain (the block that zeroes `count`/`shortsCount`/`seconds`, ~line 851):

```kotlin
            prefs.edit()
                .putString("date", today)
                .putInt("count", 0)
                .putInt("shortsCount", 0)
                .putInt("seconds", 0)
                .remove("nudgeFiredToday")
                .apply()
```

- [ ] **Step 6: Verify compile (TS unaffected; Kotlin built in Task 7)**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add plugin/native/ReelAccessibilityService.kt
git commit -m "Nudges: native state, history readers, and trigger selection"
```

---

### Task 3: Native — the modal overlay, countdown, and cat-gallery launch

**Files:**
- Modify: `plugin/native/ReelAccessibilityService.kt`

**Interfaces:**
- Consumes: `pickNudgeKey(...)`, `markNudgeFired(...)`, `nudgeModalShown`, `dp()`, `catDrawableRes()`, `catCount`, `windowManager`, `weekSeconds()`, `Settings.canDrawOverlays`.
- Produces: `fun showNudge(key: String)`, `fun hideNudgeModal()`, `fun launchCatGallery()`, and copy lookup `fun nudgeCopy(key: String): Triple<String?, String, String>`.

- [ ] **Step 1: Add the `Intent` import**

With the other `android.content` imports (top of file, near line 4):

```kotlin
import android.content.Intent
```

- [ ] **Step 2: Add modal state fields**

Next to the nudge fields from Task 2:

```kotlin
    private var nudgeModal: View? = null
    private var nudgeCountdown: Runnable? = null
    private val nudgeHardKeys = setOf("latenight", "morning", "workhours")
```

- [ ] **Step 3: Add copy lookup**

Add near the other text helpers (after `pillText`, ~line 1247). Returns `(tag, headline, body)`; tag is null when there's no `//` label.

```kotlin
    private fun nudgeCopy(key: String): Triple<String?, String, String> = when (key) {
        "latenight" -> Triple(null, "It's late. Put it down.", "Nothing good happens in the reels at this hour. Go to sleep.")
        "morning" -> Triple(null, "Reels before 10am?", "You could be doing something better than ruining your morning with this.")
        "workhours" -> Triple(null, "Mid-workday scroll.", "The deadline didn't move. The cat's judging you.")
        "sitting" -> Triple("// 15 MIN STRAIGHT", "Come up for air.", "Fifteen minutes in the feed without stopping.")
        "time120" -> Triple("// 2 HOURS TODAY", "Two hours.", "Two hours of your day, gone. What are we doing here.")
        "time90" -> Triple("// 90 MIN TODAY", "Ninety minutes.", "An hour and a half. The cat has napped twice.")
        "time60" -> Triple("// 1 HOUR TODAY", "An hour, gone.", "That's a full workout you skipped.")
        "time45" -> Triple("// 45 MIN TODAY", "Forty-five minutes.", "Most of a TV episode, spent scrolling.")
        "time30" -> Triple("// 30 MIN TODAY", "Half an hour, gone.", "That's a real chunk of your day, in the feed.")
        "time15" -> Triple("// 15 MIN TODAY", "Fifteen minutes today.", "The scroll is starting to pull. Worth it?")
        "count100" -> Triple("// 100 REELS TODAY", "A hundred reels.", "You've thumbed past 100 today. Triple digits.")
        "count50" -> Triple("// 50 REELS TODAY", "Fifty reels deep.", "Fifty swipes today. The cat lost count.")
        "count25" -> Triple("// 25 REELS TODAY", "Twenty-five reels.", "Twenty-five down. Notice you're doing it?")
        "vsyesterday" -> Triple(null, "Past yesterday already.", "You've out-scrolled your whole yesterday — and it's not over.")
        "cleanday" -> Triple(null, "Yesterday was clean.", "Barely scrolled. Keep it going today.")
        "weekly" -> Triple("// THIS WEEK", "This week so far", "${fmtDurationLong(weekSeconds())} in the feed this week.")
        else -> Triple(null, "Enough scrolling.", "The cat would rather you stopped.")
    }

    /** "1h 5m" / "45m" from seconds, for nudge copy. */
    private fun fmtDurationLong(seconds: Int): String {
        val m = seconds / 60
        return if (m < 60) "${m}m" else "${m / 60}h ${m % 60}m"
    }
```

- [ ] **Step 4: Add the modal builder + teardown + launch**

Add a new section after the cat-cover code (e.g. after `removeCatCover()`, ~line 1142):

```kotlin
    // --- Nudge modal -----------------------------------------------------------

    /** Build + show the center modal for [key], if still eligible. */
    private fun showNudge(key: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        if (!Settings.canDrawOverlays(this)) return
        if (nudgeModalShown) return

        val (tag, headline, body) = nudgeCopy(key)
        val hard = key in nudgeHardKeys

        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(16), dp(18), dp(16))
            background = nudgeCardBackground()
            elevation = dp(12).toFloat()
        }

        if (tag != null) {
            card.addView(TextView(this).apply {
                text = tag
                setTextColor(Color.parseColor("#19E3FF"))
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
                typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
                letterSpacing = 0.15f
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) })
        }

        // Random cat photo.
        val img = ImageView(this).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(view: View, outline: Outline) {
                    outline.setRoundRect(0, 0, view.width, view.height, dp(13).toFloat())
                }
            }
            val n = (blockShowSeq++ % catCount) + 1
            val resId = catDrawableRes(n)
            if (resId != 0) setImageResource(resId)
        }
        card.addView(img, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(124)))

        card.addView(TextView(this).apply {
            text = headline
            setTextColor(Color.parseColor("#F4F1EA"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(12) })

        card.addView(TextView(this).apply {
            text = body
            setTextColor(Color.parseColor("#9C9CA6"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setLineSpacing(dp(2).toFloat(), 1f)
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(5) })

        // Amber hazard divider (simplified solid bar of the app's hazard tape).
        card.addView(View(this).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(4).toFloat()
                setColor(Color.parseColor("#F5A524"))
            }
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(6)).apply { topMargin = dp(14); bottomMargin = dp(12) })

        val catBtn = TextView(this).apply {
            text = "Watch a cat instead"
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create(Typeface.DEFAULT_BOLD, Typeface.BOLD)
            setPadding(0, dp(12), 0, dp(12))
            background = nudgeButtonBackground("#7C3AED")
            setOnClickListener { hideNudgeModal(); launchCatGallery() }
        }
        card.addView(catBtn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        val keepBtn = TextView(this).apply {
            gravity = Gravity.CENTER
            setTextColor(Color.parseColor("#5C5C66"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dp(10), 0, dp(6))
            text = "Keep scrolling"
        }
        card.addView(keepBtn, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(4) })

        // Full-screen scrim that consumes touches (blocks the reel underneath).
        val scrim = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#BF000000"))
            isClickable = true
            setOnClickListener { /* eat */ }
            addView(card, FrameLayout.LayoutParams(dp(300), FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.CENTER).apply {
                leftMargin = dp(16); rightMargin = dp(16)
            })
        }

        // HARD: gate "Keep scrolling" behind a 3-2-1 countdown; SOFT: instant.
        if (hard) {
            var remaining = 3
            keepBtn.isEnabled = false
            keepBtn.alpha = 0.5f
            keepBtn.text = "Keep scrolling ($remaining)"
            val tick = object : Runnable {
                override fun run() {
                    remaining -= 1
                    if (remaining <= 0) {
                        keepBtn.text = "Keep scrolling"
                        keepBtn.isEnabled = true
                        keepBtn.alpha = 1f
                        keepBtn.setOnClickListener { hideNudgeModal() }
                        nudgeCountdown = null
                    } else {
                        keepBtn.text = "Keep scrolling ($remaining)"
                        mainHandler.postDelayed(this, 1000L)
                    }
                }
            }
            nudgeCountdown = tick
            mainHandler.postDelayed(tick, 1000L)
        } else {
            keepBtn.setOnClickListener { hideNudgeModal() }
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START }

        runCatching {
            windowManager?.addView(scrim, params)
            nudgeModal = scrim
            nudgeModalShown = true
            markNudgeFired(key)
        }
    }

    private fun hideNudgeModal() {
        nudgeCountdown?.let { mainHandler.removeCallbacks(it) }
        nudgeCountdown = null
        nudgeModal?.let { view -> runCatching { windowManager?.removeView(view) } }
        nudgeModal = null
        nudgeModalShown = false
    }

    /** Bring Doomguard to the front and ask it to open the cat gallery. */
    private fun launchCatGallery() {
        prefs.edit().putBoolean("openCats", true).apply()
        val intent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        }
        runCatching { if (intent != null) startActivity(intent) }
    }

    private fun nudgeCardBackground(): GradientDrawable =
        GradientDrawable().apply {
            setColor(Color.parseColor("#141419"))
            cornerRadius = dp(20).toFloat()
            setStroke(dp(1), Color.parseColor("#1AF4F1EA"))
        }

    private fun nudgeButtonBackground(hex: String): GradientDrawable =
        GradientDrawable().apply {
            setColor(Color.parseColor(hex))
            cornerRadius = dp(11).toFloat()
        }
```

(`blockShowSeq` already exists — reused here to rotate the cat image; sharing the counter with the cover is fine.)

- [ ] **Step 5: Verify compile (TS)**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS (TS unchanged; Kotlin built in Task 7).

- [ ] **Step 6: Commit**

```bash
git add plugin/native/ReelAccessibilityService.kt
git commit -m "Nudges: native modal overlay, HARD countdown, cat-gallery launch"
```

---

### Task 4: Native — wire evaluation into the event/timer hooks

**Files:**
- Modify: `plugin/native/ReelAccessibilityService.kt`

**Interfaces:**
- Consumes: `pickNudgeKey(...)`, `showNudge(...)`, `nudgeModalShown`, `sittingSeconds`, `wasOnReel`.
- Produces: nudges actually appear — entry triggers on reel-entry, threshold triggers on time/count updates; state resets on leave.

- [ ] **Step 1: Fire entry triggers on the not-on-reel → on-reel transition**

In `onAccessibilityEvent`, replace the guilt-mode `if (onReel) { ... }` block (lines ~222-227) with:

```kotlin
        val onReel = if (pkg == youtubePackage) hit != null else onReelSurface(root)
        if (onReel) {
            val justEntered = !wasOnReel
            wasOnReel = true
            if (hit != null) countItem(counter, hit.key)
            startReelTimer()
            render()
            startPillTicker() // owns the pill's hide: pulls it the instant you leave a reel
            if (justEntered && !nudgeModalShown) {
                pickNudgeKey("entry", currentSeconds(), currentSeconds(),
                    currentCount(), currentCount(), sittingSeconds, sittingSeconds)
                    ?.let { showNudge(it) }
            }
        }
```

- [ ] **Step 2: Fire threshold triggers from `addSeconds`**

Replace `addSeconds` (~lines 865-869) with:

```kotlin
    private fun addSeconds(delta: Int) {
        ensureToday()
        val prev = prefs.getInt("seconds", 0)
        val cur = prev + delta
        prefs.edit().putInt("seconds", cur).apply()
        val prevSitting = sittingSeconds
        sittingSeconds += delta
        updateWidget()
        if (!nudgeModalShown) {
            pickNudgeKey("tick", prev, cur, currentCount(), currentCount(), prevSitting, sittingSeconds)
                ?.let { showNudge(it) }
        }
    }
```

- [ ] **Step 3: Fire count triggers from `incrementPref`**

Replace `incrementPref` (~lines 853-857) with:

```kotlin
    private fun incrementPref(name: String) {
        ensureToday()
        val before = prefs.getInt(name, 0)
        prefs.edit().putInt(name, before + 1).apply()
        updateWidget(force = true)
        if (!nudgeModalShown) {
            val total = prefs.getInt("count", 0) + prefs.getInt("shortsCount", 0)
            val s = currentSeconds()
            pickNudgeKey("tick", s, s, total - 1, total, sittingSeconds, sittingSeconds)
                ?.let { showNudge(it) }
        }
    }
```

- [ ] **Step 4: Reset sitting + entry-transition on leave**

In `hideOverlay()` (~lines 995-1004), reset the sitting counter and the entry flag (the pill teardown is the "left the reel/app" signal, already debounced by `hideRunnable`):

```kotlin
    private fun hideOverlay() {
        if (!overlayShown) return
        stopReelTimer()
        stopPillTicker()
        pill?.let { view -> runCatching { windowManager?.removeView(view) } }
        pill = null
        dialView = null
        pillLabel = null
        overlayShown = false
        sittingSeconds = 0
        wasOnReel = false
    }
```

Also, in the "left a tracked app" branch of `onAccessibilityEvent` (the block ending ~line 187, which calls `hideOverlay()`/`hideCatCover()`), tear down any open nudge modal — add right after `hideCatCover()`:

```kotlin
            hideNudgeModal()
```

- [ ] **Step 5: Verify compile (TS)**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add plugin/native/ReelAccessibilityService.kt
git commit -m "Nudges: wire evaluation into reel-entry and time/count hooks"
```

---

### Task 5: Expose `consumeOpenCats()` from the native module + JS

**Files:**
- Modify: `modules/doomguardnative/android/src/main/java/expo/modules/doomguardnative/DoomguardnativeModule.kt`
- Modify: `modules/doomguardnative/index.ts`

**Interfaces:**
- Consumes: the `openCats` pref written by `launchCatGallery()`.
- Produces: native `consumeOpenCats(): Boolean` (reads + clears) and JS `consumeOpenCats(): boolean`.

- [ ] **Step 1: Add the native function**

In `DoomguardnativeModule.kt`, inside `ModuleDefinition {}`, after the `Function("getHistory")` block:

```kotlin
    Function("consumeOpenCats") {
      val context = appContext.reactContext?.applicationContext ?: return@Function false
      val p = prefs(context)
      val v = p.getBoolean("openCats", false)
      if (v) p.edit().putBoolean("openCats", false).apply()
      v
    }
```

- [ ] **Step 2: Add to the JS `NativeModule` type and export**

In `modules/doomguardnative/index.ts`, add to the `NativeModule` type:

```typescript
type NativeModule = {
  getStatus(): DoomguardStatus;
  setMode(mode: DoomguardMode): void;
  getHistory(): DoomguardDay[];
  consumeOpenCats(): boolean;
};
```

And export at the end of the file:

```typescript
export function consumeOpenCats(): boolean {
  if (!nativeModule) return false;
  try {
    return nativeModule.consumeOpenCats();
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/doomguardnative/
git commit -m "Nudges: consumeOpenCats() bridge for the cat-gallery launch"
```

---

### Task 6: App — open the cat gallery when the service asks

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `consumeOpenCats` from `./modules/doomguardnative`.
- Produces: on resume (or mount), if `openCats` was set, the `CatGallery` opens. Cat-gallery open state lifts to `App`.

- [ ] **Step 1: Import `consumeOpenCats`**

Update the module import (lines ~31-36) to add `consumeOpenCats`:

```tsx
import {
  consumeOpenCats,
  getStatus,
  setMode,
  type DoomguardMode,
  type DoomguardStatus,
} from "./modules/doomguardnative";
```

Also import `CatGallery` if not already imported at the top — it currently is imported (`import { CatGallery } from "./components/CatGallery";`), keep it.

- [ ] **Step 2: Lift cat-gallery state into `App` and add the resume check**

In `App()`, add state next to `screen` (after the `screen` declaration ~line 92):

```tsx
  const [catsOpen, setCatsOpen] = useState(false);
```

Add a check helper near `refresh`/`syncStatus` (after `syncStatus`, ~line 114):

```tsx
  const checkOpenCats = useCallback(() => {
    if (consumeOpenCats()) setCatsOpen(true);
  }, []);
```

In the `useMountEffect` body, call it on mount and on every foreground. Update the block to:

```tsx
  useMountEffect(() => {
    syncStatus();
    checkOpenCats();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        syncStatus();
        checkOpenCats();
      }
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

- [ ] **Step 3: Render `CatGallery` at the `App` level and pass an opener to `Dashboard`**

In the home `return`, add the gallery alongside the other top-level modals (next to `<PushThroughModal .../>`, ~line 210):

```tsx
      <CatGallery visible={catsOpen} onClose={() => setCatsOpen(false)} />
```

Update the `<Dashboard ... />` usage to pass an opener and drop its internal gallery ownership:

```tsx
              <Dashboard
                mode={mode}
                seconds={seconds}
                count={count}
                shorts={shorts}
                onChangeMode={changeMode}
                onOpenHistory={() => setScreen("history")}
                onOpenCats={() => setCatsOpen(true)}
              />
```

- [ ] **Step 4: Update `Dashboard` to use the lifted state**

In `Dashboard`, update the signature/props to accept `onOpenCats` and remove the local `catsOpen` state + the `<CatGallery>` it rendered:

```tsx
function Dashboard({
  mode,
  seconds,
  count,
  shorts,
  onChangeMode,
  onOpenHistory,
  onOpenCats,
}: {
  mode: DoomguardMode;
  seconds: number;
  count: number;
  shorts: number;
  onChangeMode: (mode: DoomguardMode) => void;
  onOpenHistory: () => void;
  onOpenCats: () => void;
}) {
  const minutes = Math.floor(seconds / 60);
  const v = vibe(minutes);
  return (
```

(Delete the `const [catsOpen, setCatsOpen] = useState(false);` line that was in `Dashboard`.)

Change the `CatsButton` press handler to the prop, and delete the `<CatGallery ... />` line near the end of `Dashboard`:

```tsx
      <CatsButton onPress={onOpenCats} />
```

- [ ] **Step 5: Typecheck**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS (no unused `catsOpen`/`CatGallery` left in `Dashboard`).

- [ ] **Step 6: Commit**

```bash
git add App.tsx
git commit -m "Nudges: open cat gallery on resume when the service requests it"
```

---

### Task 7: Build & verify on device

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd <repo root> && npx jest`
Expected: PASS (history + nudges suites green).

- [ ] **Step 2: Typecheck**

Run: `cd <repo root> && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Build & install standalone on device**

Run (env as used for the history feature):
```bash
cd <repo root>
export ANDROID_HOME="$HOME/Library/Android/sdk"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:$PATH"
export CI=1
npx expo run:android --variant release
```
Expected: `BUILD SUCCESSFUL` → `Installing app-release.apk` → `Opening … on <device>`. (Prebuild re-copies `plugin/native/` sources first.)

- [ ] **Step 4: Manual verification checklist** (Guilt mode, accessibility + overlay on)

- [ ] Set device clock before 10am, open a reel → `morning` modal appears centered with a cat photo; "Keep scrolling" counts 3→2→1 then enables.
- [ ] Tap **Watch a cat instead** → Doomguard comes to front with the cat gallery open.
- [ ] Re-open a reel within 20 min → no second modal (cooldown). After 20 min, the next eligible trigger can show.
- [ ] Scroll to cross 15 min today → `time15` modal (instant buttons). Confirm it doesn't re-fire after dismissal.
- [ ] Swipe ~25 reels → `count25` modal.
- [ ] Switch to **Block mode**, open reels → no nudge modal (only the block bounce/cover).
- [ ] Background the app mid-modal / leave Instagram → modal tears down cleanly.
- [ ] Confirm the time pill doesn't keep ticking up while a modal is on screen.

- [ ] **Step 5: Optional version bump**

If shipping, bump `version`/`versionCode` in `app.json` per repo convention.

```bash
git add app.json && git commit -m "Bump version for reel nudges"
```

---

## Self-Review

**Spec coverage:**
- 16 triggers w/ priority, thresholds, HARD/SOFT → Task 1 (`pickNudge`) + Task 2 (`pickNudgeKey`) + Task 3 (`nudgeCopy`/`nudgeHardKeys`). ✓
- Once/day + 20-min cooldown → `nudgeFiredToday`/`lastNudgeAt` (Tasks 2–3); reset in `ensureToday` (Task 2). ✓
- Tap-to-clear modal, cat photo, hazard strip, two buttons, HARD countdown → Task 3. ✓
- Timer pause while shown → `nudgeModalShown` gate in `addSeconds` (Task 4). ✓
- "Watch a cat" → `openCats` + launch (Task 3), `consumeOpenCats` (Task 5), gallery open on resume (Task 6). ✓
- Guilt-only, no toggle → `currentMode()` guard in `pickNudgeKey` (Task 2). ✓
- Continuous-sitting + entry-transition reset on leave → Task 4. ✓
- jest mirror + on-device verification → Task 1 + Task 7. ✓

**Placeholder scan:** No TBD/TODO. All code blocks complete; copy strings present. ✓

**Type consistency:** `pickNudge`/`NudgeState` (Task 1) and `pickNudgeKey(event, prevSeconds, seconds, prevCount, count, prevSitting, sitting)` (Task 2) use consistent signals; Task 4 calls `pickNudgeKey` with exactly that signature. `nudgeCopy` keys (Task 3) match the keys produced by `pickNudgeKey` (Task 2) and `nudges.ts` (Task 1). `consumeOpenCats` consistent across Tasks 5–6. `onOpenCats` prop added in Task 6 used in both `App` and `Dashboard`. ✓

**Open risk noted:** the `sitting` reset is tied to `hideOverlay()` (pill teardown, debounced 250ms) rather than a dedicated session timer — accepted in the spec's edge-cases. Verify on-device in Task 7 that brief detection blips don't reset a real sitting prematurely; if they do, a follow-up can add an explicit grace timer.
