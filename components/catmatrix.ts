// Transform matrices for the Kit-Cat clock's animated <G> groups.
//
// react-native-svg's native group exposes exactly one transform prop, `matrix`
// (an [a, b, c, d, tx, ty] affine, column-major: [a c tx / b d ty / 0 0 1]).
// The friendly `x` / `rotation` shorthands only fold into that matrix during JS
// render, which Reanimated bypasses on the New Architecture. So the animated
// worklets must produce `matrix` directly. These helpers are the pure geometry
// behind that, kept out of the component so they can be tested without a device.

export type Matrix = [number, number, number, number, number, number];

/** Horizontal translation by `tx` (used for the eyes darting side to side). */
export function translateX(tx: number): Matrix {
  "worklet";
  return [1, 0, 0, 1, tx, 0];
}

/** Rotation by `deg` degrees about the pivot (ox, oy) (used for the tail). */
export function rotateAbout(deg: number, ox: number, oy: number): Matrix {
  "worklet";
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // P' = R·(P - O) + O  ->  translation folds the pivot back in.
  return [cos, sin, -sin, cos, ox - cos * ox + sin * oy, oy - sin * ox - cos * oy];
}
