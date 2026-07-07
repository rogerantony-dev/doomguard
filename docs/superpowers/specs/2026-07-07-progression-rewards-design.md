# Progression & Rewards — Design

Date: 2026-07-07
Status: Approved design, pending implementation plan

## Goal

Add a positive-reinforcement layer over Doomguard's existing guilt framing. Today the app only ever tells you how much time you *wasted*. This system rewards restraint: clean days build a streak, earn points, unlock cats, and eventually ratchet your daily limit *down* so the challenge tightens as you improve.

The guilt hero stays. Progression sits alongside it, not in place of it.

## Core loop

Hold a clean streak → celebratory milestone moment + a new cat unlocks → the app offers to tighten your limit → a harder challenge begins. Points accumulate for life and grow faster the tighter your limit is, so descending the ladder always pays off, even after a streak breaks.

## The four numbers

Everything the user sees derives from history (see Architecture). There is no separate score to keep in sync.

| Number | Meaning | Resets? |
|---|---|---|
| **Limit** | Current daily allowance. This *is* the "level". Lower = harder = further along. | Only on a manual or offered limit change |
| **Streak** | Consecutive clean days (a day that ended under *that day's* limit). | Breaks to 0 after one over-limit day |
| **Best streak** | Longest streak ever reached. The record to beat. | Never |
| **Points** | Lifetime score. Each clean day adds points scaled inversely to the limit. | Never |

### Clean day

A day is **clean** if its recorded short-form seconds are at or under that day's limit (`seconds <= limitMinutes * 60`). Any day under the limit counts, regardless of mode (Block-mode days count). Idle days with zero activity are under the limit, so they count as clean. This is the forgiving definition chosen deliberately.

### Streak

Consecutive clean days ending today (or yesterday, if today is not yet over/clean). Each day is judged against the limit that was in effect *that* day, so changing the limit never retroactively re-judges past days. One over-limit day resets the current streak to 0. Best streak is the maximum run ever seen in history.

## Points

Per clean day, by that day's limit:

| Limit | Points / clean day |
|---|---|
| 120 min | 10 |
| 90 min | 15 |
| 60 min | 20 |
| 45 min | 30 |
| 30 min | 50 |
| 15 min | 100 |

Holding the tightest limit is worth 10x the loosest. Lifetime points = sum over every clean day in history of that day's rate.

- The limit picker only offers these six values (`LIMIT_OPTIONS`), so the table is total. For any off-table value (defensive only), fall back to `round(1200 / limitMinutes)`.
- **No streak multiplier in v1.** Points depend only on the limit. A compounding multiplier can be added later if the curve feels flat.

## The ratchet (leveling down)

- Ladder (descending): **120 → 90 → 60 → 45 → 30 → 15 (floor)**. Matches the existing `LIMIT_OPTIONS`.
- After a **7-day streak** at the current limit, a milestone moment fires and the app **offers** to drop the limit to the next rung down. It is always an offer, never automatic.
- Accepting lowers the limit (via the existing `setLimit`). The streak continues; each subsequent day is now judged against the tighter limit, and points per clean day jump to the new rate.
- Declining keeps the current limit; the offer does not re-fire for the same streak milestone (see Durable flags).
- At the **15-minute floor**, no further offers fire. The user keeps earning points and chasing best-streak from there.
- The existing limit picker still works anytime. Manually lowering raises the points rate; manually raising is allowed (a backslide) and simply lowers the rate. Nothing about the offer blocks manual control.

## Rewards

### Milestone moment

A full-screen celebratory beat (a positive counterpoint to the usual guilt). Fires on:
- Completing a **7-day streak** (also carries the level-down offer), and
- Crossing a **cat-unlock point threshold**.

Copy is warm and congratulatory. No em dashes in user-facing copy (house style).

### Cat unlocks

Cats unlock at cumulative **point thresholds**, frequent early and sparse later. Each cat carries its own `unlockAt` value so the set is extensible — add a cat, give it a threshold. First cat is free so the gallery is never empty.

Illustrative curve for the current 4 cats (extend as more are added):

| Cat | Unlocks at |
|---|---|
| 1 | 0 pts (free) |
| 2 | 50 pts |
| 3 | 150 pts |
| 4 | 400 pts |
| (future) | 800, 1500, ... |

Locked cats appear as silhouettes in the existing Cats gallery with an "Unlock at N pts" caption. Unlocking is based on **lifetime points**, which only grow, so an earned cat never re-locks.

## Where it surfaces

- **Home:** a slim strip near the header showing streak + points, alongside the existing guilt hero. Positive layer over the shame, not a replacement.
- **Milestone modal:** the full-screen moment (streak completion or cat unlock).
- **Level-down offer:** presented within/after the 7-day-streak milestone moment.
- **Cats gallery:** gains locked/unlocked states and unlock captions.

## Architecture

Approach A (derive in JS from history) plus two small durable flags (C).

### Native change (small)

- Add `limitMinutes: number` to each stored `DoomguardDay`, recorded when a day is finalized at the daily reset. This is what makes per-day judging correct and lets JS compute everything else.
- **Durable flags** persisted in SharedPreferences and exposed on status:
  - `lastCelebratedStreakMilestone` (number) — highest streak-milestone already celebrated, so the moment does not re-fire.
  - `lastPointsCelebrated` (number) — points value at which cat-unlock reveals were last shown, so unlock reveals do not re-fire.
  - The level-down offer reuse is covered by `lastCelebratedStreakMilestone` (offer rides the same milestone).
- Extend the native setters as needed to update these flags (e.g. `markStreakCelebrated`, `markPointsCelebrated`), and surface the flags in `getStatus()` / a dedicated progress getter.

### JS (all of it derived)

A pure module (e.g. `components/progress.ts`) that takes `DoomguardDay[]` + today + current limit and returns:
- `currentStreak`, `bestStreak`
- `lifetimePoints`
- `level` (= current limit rung) and `nextRung`
- `unlockedCats` (by comparing lifetime points to each cat's `unlockAt`)
- `pendingLevelDownOffer` (true when currentStreak just crossed a 7-day multiple at a rung above the floor and it has not been celebrated)
- `pendingCatUnlocks` (cats whose threshold was crossed since `lastPointsCelebrated`)

The UI reads this derived object, shows the strip, and fires modals for any pending moments, then calls the native `mark...` setters to record them as seen.

### Edge cases

- **Fresh install / no history:** streak 0, points 0, level = default limit (30). All existing heroes render unchanged.
- **Limit changed mid-history:** each day judged by its own recorded `limitMinutes`. No retroactive breakage.
- **Backslide (limit raised):** allowed; lower points rate; days judged against the higher limit.
- **History pruning:** lifetime points/best-streak are only as complete as retained history. Durable flags prevent re-celebration but a very aggressive prune could lower derived lifetime points. Native history retention is assumed long enough (existing behavior) that this is acceptable for v1.

## Out of scope for v1

Ranks/titles, streak freezes/grace days, leaderboards or social, streak-reminder notifications, sub-15-minute rungs, streak-based points multiplier. All addable later without reworking the core (history + derivation).
