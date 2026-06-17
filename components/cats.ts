import type { ImageSourcePropType } from "react-native";

/**
 * Pictures shown in the "Cats, not reels" gallery: a calmer thing to rest your
 * eyes on than the feed. Add bundled images with require(), or remote ones as
 * { uri } entries. Drop files into assets/cats/ and list them here.
 */
export const CATS: ImageSourcePropType[] = [
  { uri: "https://i.pinimg.com/736x/c0/78/08/c078082c4423cda6216a7b4627c6eb52.jpg" },
  { uri: "https://media.tenor.com/zCTU9e8SmVMAAAAM/1000-yard-stare-cat-meme.gif" },
  {
    uri: "https://cdn-useast1.kapwing.com/static/templates/crying-cat-meme-template-full-719a53dc.webp",
  },
  { uri: "https://media.tenor.com/47qpxBq_Tw0AAAAe/cat-cat-meme.png" },
];
