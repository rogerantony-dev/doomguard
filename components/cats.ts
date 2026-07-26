import type { ImageSourcePropType } from "react-native";

/**
 * Pictures for the "Cats, not reels" gallery, each gated behind a cumulative
 * lifetime-points threshold. Frequent early, sparse later; the first cat is
 * free so the gallery is never empty. Bundled locally (assets/cats) so the
 * gallery never depends on a live URL. Add a cat by appending { src, unlockAt }
 * and dropping its image in assets/cats plus plugin/native/res/drawable (for the
 * nudge/widget — bump catCount in ReelAccessibilityService.kt to match).
 */
export type Cat = { src: ImageSourcePropType; unlockAt: number };

export const CATS: Cat[] = [
  { src: require("../assets/cats/cat_1.jpg"), unlockAt: 0 },
  { src: require("../assets/cats/cat_2.gif"), unlockAt: 40 },
  { src: require("../assets/cats/cat_3.webp"), unlockAt: 90 },
  { src: require("../assets/cats/cat_4.png"), unlockAt: 160 },
  { src: require("../assets/cats/cat_5.png"), unlockAt: 250 },
  { src: require("../assets/cats/cat_6.png"), unlockAt: 360 },
  { src: require("../assets/cats/cat_7.png"), unlockAt: 500 },
  { src: require("../assets/cats/cat_8.png"), unlockAt: 680 },
  { src: require("../assets/cats/cat_9.png"), unlockAt: 900 },
  { src: require("../assets/cats/cat_10.png"), unlockAt: 1150 },
  { src: require("../assets/cats/cat_11.png"), unlockAt: 1450 },
  { src: require("../assets/cats/cat_12.png"), unlockAt: 1800 },
  { src: require("../assets/cats/cat_13.png"), unlockAt: 2200 },
];

/** The unlock thresholds in order, for progress derivation. */
export const CAT_THRESHOLDS: number[] = CATS.map((c) => c.unlockAt);
