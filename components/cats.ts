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
  {
    src: { uri: "https://cdn-useast1.kapwing.com/static/templates/crying-cat-meme-template-full-719a53dc.webp" },
    unlockAt: 150,
  },
  { src: { uri: "https://media.tenor.com/47qpxBq_Tw0AAAAe/cat-cat-meme.png" }, unlockAt: 400 },
];

/** The unlock thresholds in order, for progress derivation. */
export const CAT_THRESHOLDS: number[] = CATS.map((c) => c.unlockAt);
