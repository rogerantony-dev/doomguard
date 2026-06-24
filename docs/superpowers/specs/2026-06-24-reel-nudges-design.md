# Reel Nudges — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design); pending spec review → implementation plan.

## Overview

Contextual intervention modals that the accessibility service draws **over Instagram/YouTube** while the user is on a reel/short, nudging them to stop. Each modal matches the app's existing `PushThroughModal` design language (Instrument card, corner ticks, amber hazard strip, headline + body, stacked buttons) but leads with a **random bundled cat photo** instead of an icon. The primary action, **"Watch a cat instead,"** pulls the user out of the feed and into the Doomguard cat gallery.

This is a **Guilt-mode-only** feature (Block mode already bounces the user out of reels). It is **native-first**: the modal is a `WindowManager` overlay drawn by `ReelAccessibilityService`, not a React Native screen. The only RN-side change is opening the cat gallery when the service asks.

## Behavior Rules (global)

- **Once per day per trigger.** Each trigger key fires at most once between midnight resets.
- **Global 20-minute cooldown.** No two nudges within 20 minutes of each other, regardless of trigger. A trigger suppressed by cooldown is *not* marked fired — it remains eligible later that day.
- **Tap to clear.** The modal covers the reel with a scrim and stays until the user taps a button. It never auto-dismisses.
- **Two buttons:**
  - **Watch a cat instead** (violet `#7C3AED`, matches `CatsButton`) — always immediately tappable. Sets a flag, launches the Doomguard app to the cat gallery, removes the overlay.
  - **Keep scrolling** (ghost) — dismisses and returns to the reel. On **HARD** triggers it is disabled for a **3-second countdown** (`Keep scrolling (3)` → `(2)` → `(1)` → enabled) — the speed-bump friction. On **SOFT** triggers it is instant.
- **Timer pauses while a modal is shown** — `seconds` does not accrue while a nudge modal is up (the user isn't really watching).
- **Active only in Guilt mode.** No master toggle. In Block mode the nudge system is inert.

## Trigger Catalog

Priority order (highest first). On any evaluation point, the manager shows the **first** eligible trigger (passes once-per-day + cooldown) and stops.

| # | Key | Type | Condition | Headline | Body |
|---|-----|------|-----------|----------|------|
| 1 | `latenight` | HARD | Enter reel, local time 00:00–04:59 | It's late. Put it down. | Nothing good happens in the reels at this hour. Go to sleep. |
| 2 | `morning` | HARD | Enter reel, local time 05:00–09:59 | Reels before 10am? | You could be doing something better than ruining your morning with this. |
| 3 | `workhours` | HARD | Enter reel, **weekday** local time 10:00–16:59 | Mid-workday scroll. | The deadline didn't move. The cat's judging you. |
| 4 | `sitting` | SOFT | 15 min continuous reel time in one session | Come up for air. | Fifteen minutes in the feed without stopping. |
| 5 | `time120` | SOFT | Daily `seconds` crosses 7200 | Two hours. | Two hours of your day, gone. What are we doing here. |
| 6 | `time90` | SOFT | crosses 5400 | Ninety minutes. | An hour and a half. The cat has napped twice. |
| 7 | `time60` | SOFT | crosses 3600 | An hour, gone. | That's a full workout you skipped. |
| 8 | `time45` | SOFT | crosses 2700 | Forty-five minutes. | Most of a TV episode, spent scrolling. |
| 9 | `time30` | SOFT | crosses 1800 | Half an hour, gone. | That's a real chunk of your day, in the feed. |
| 10 | `time15` | SOFT | crosses 900 | Fifteen minutes today. | The scroll is starting to pull. Worth it? |
| 11 | `count100` | SOFT | Daily `count`+`shortsCount` crosses 100 | A hundred reels. | You've thumbed past 100 today. Triple digits. |
| 12 | `count50` | SOFT | crosses 50 | Fifty reels deep. | Fifty swipes today. The cat lost count. |
| 13 | `count25` | SOFT | crosses 25 | Twenty-five reels. | Twenty-five down. Notice you're doing it? |
| 14 | `vsyesterday` | SOFT | Daily `seconds` exceeds yesterday's archived total (and yesterday > 0) | Past yesterday already. | You've out-scrolled your whole yesterday — and it's not over. |
| 15 | `cleanday` | SOFT | On reel entry (once/day), **and** `0 < yesterdaySeconds < 900` | Yesterday was clean. | Barely scrolled. Keep it going today. |
| 16 | `weekly` | SOFT | On reel entry (once/day) | This week so far | `{Xh Ym}` in the feed this week. |

Notes:
- Time-of-day windows are non-overlapping by construction; precedence 1→3 covers the boundaries.
- `cleanday` and `weekly` both want the first open of the day; precedence + cooldown means only one shows on that open, the other becomes eligible at the next open ≥20 min later (still once/day). `cleanday` outranks `weekly` so a clean streak gets the encouragement.
- `cleanday` requires yesterday to have **some** recorded activity (`> 0`) so it never fires on a brand-new install where yesterday is simply absent (archived zero-days don't exist — see the history feature).
- `weekly` body interpolates the rolling 7-day `seconds` total from history (`fmtDuration`-style "Xh Ym").

## Architecture

### Native — `ReelAccessibilityService.kt`

A new private `NudgeManager` (inner object or grouped methods) responsible for evaluation + presentation. Wiring into existing hooks:

- **Reel entry** (the `onReel` true-transition in `handleEvent`, where `showOverlay`/`startPillTicker` happen): call `evaluateOnEntry()` → considers `latenight`, `morning`, `workhours`, `weekly`, `cleanday`, `vsyesterday`, and the first-sitting baseline.
- **Threshold cross:** in `addSeconds()` (after writing) check time milestones + `sitting` + `vsyesterday`; in `incrementPref("count"/"shortsCount")` check count milestones. Each compares the pre/post value against the thresholds it crossed.
- **Guard:** every entry/threshold check is a no-op unless `currentMode() == "guilt"`.

`showNudge(trigger)`:
1. Re-check eligibility: not already fired today, `now - lastNudgeAt >= 20min`, no nudge currently shown.
2. Build a full-screen `WindowManager` overlay (`TYPE_APPLICATION_OVERLAY`, touchable, covers screen, dark scrim `#BF000000`) containing the centered Instrument card:
   - random `doomguard_cat_1..N` drawable at top (rounded),
   - optional mono tag (e.g. `// 30 MIN TODAY`) for threshold triggers,
   - headline (bone, bold) + body (ash),
   - amber hazard strip,
   - **Watch a cat instead** button, **Keep scrolling** button (with countdown if HARD).
3. Mark `nudgeModalShown = true` (pauses the time ticker), set `lastNudgeAt = now`, add `trigger.key` to today's fired set.
4. Button handlers tear the overlay down (`nudgeModalShown = false`), and for "Watch a cat" also trigger the app launch (below).

Reuse the existing overlay scaffolding patterns (the cat cover is already a full-screen touchable overlay; the pill shows the design vocabulary). Build card views programmatically (no XML needed) to mirror `PushThroughModal`.

### Data — `doomguard_reels` SharedPreferences

New keys (all reset in `ensureToday()` except `history`, which already persists):
- `nudgeFiredToday` — `Set<String>` of trigger keys fired today (stored as a `StringSet`). Cleared on day rollover.
- `lastNudgeAt` — `Long` epoch ms of the last shown nudge. **Not** reset at rollover — the 20-min cooldown is purely time-based, so it lapses on its own.
- `openCats` — `Boolean` flag the service sets when "Watch a cat instead" is tapped.

`ensureToday()` adds **only** `nudgeFiredToday` to the day-rollover reset (alongside `count`/`shortsCount`/`seconds`, and after the history archival from the prior feature).

### Cat-gallery launch (service → app)

On "Watch a cat instead":
1. Service sets `openCats = true` in prefs.
2. Service launches the app: `packageManager.getLaunchIntentForPackage(packageName)` with `FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_REORDER_TO_FRONT`, `startActivity(...)`.
3. RN side: new module function `consumeOpenCats(): boolean` (reads the flag, clears it, returns it). `App.tsx` calls it on mount and on `AppState` → `active`; if `true`, it opens the existing `CatGallery` (sets `catsOpen`-equivalent state). Because the dashboard owns `catsOpen`, lift a `forceCatsOpen` signal into `App` and pass it down, or expose an imperative open — detail for the plan.

### JS module — `modules/doomguardnative/index.ts`

Add `consumeOpenCats(): boolean` (returns `false` if native module absent). No other JS API changes.

## Edge Cases

- **Modal vs. block bounce:** nudges only run in Guilt mode, so they never collide with Block-mode's Back-press.
- **Leaving the reel while modal is up:** the modal is a separate overlay; if the user navigates away (e.g. Home), tear the modal down on the next "left tracked app" cleanup (same path that removes the pill/cover).
- **Continuous-sitting reset:** the session counter resets whenever the user leaves reels for more than the existing hide-hysteresis grace, so `sitting` measures one unbroken sitting.
- **Cooldown across app switches:** `lastNudgeAt` is persisted, so the 20-min gap survives leaving/returning to Instagram.
- **Stale day:** if the service hasn't rolled the day yet, threshold checks still use the live counters; `ensureToday()` is called at the same points as today, so fired-today resets correctly.
- **Overlay permission revoked:** if `WindowManager.addView` throws, swallow it (no nudge) — same defensive posture as the pill/cover.

## Non-Goals

- No per-trigger settings UI, no user-configurable thresholds, no on/off toggle.
- No system notifications — interventions are overlays only, shown only while on a reel.
- No nudges in Block mode.
- No new cat assets — reuse the bundled `doomguard_cat_*` drawables.
- No analytics/telemetry on nudge dismissals.

## Testing

- **Pure logic (jest, like the history feature):** extract trigger-selection into a React-free helper where feasible — e.g. `pickNudge(state)` given `{mode, nowMs, localHour, weekday, seconds, prevSeconds, count, prevCount, sittingSeconds, todayFired, lastNudgeAt, yesterdaySeconds, weekSeconds}` → returns a trigger key or null. Unit-test: window boundaries (04:59 vs 05:00, 09:59 vs 10:00), milestone crossing (1799→1800 fires `time30`; 1800→1801 does not), once-per-day suppression, 20-min cooldown suppression, priority order, weekday gating for `workhours`. (Copy/text and the Kotlin port mirror this logic.)
- **Native + UI:** verified by building and running on device (per repo convention) — trigger windows by changing device time, watch the modal appear over a reel, confirm "Watch a cat" opens the gallery and "Keep scrolling" countdown on HARD triggers.

> Note: the canonical selection logic lives in Kotlin (the service). The jest helper is a TypeScript mirror of the same rules used to lock the boundary/priority/cooldown math; both must stay in sync. The plan will treat the Kotlin implementation as the source of truth and the helper as an executable specification of its rules.
