import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Rect,
} from "react-native-svg";

type RGB = [number, number, number];

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * Math.min(1, Math.max(0, t)));
}

function lerpColor(from: RGB, to: RGB, t: number): string {
  return `rgb(${mix(from[0], to[0], t)}, ${mix(from[1], to[1], t)}, ${mix(
    from[2],
    to[2],
    t
  )})`;
}

/** An eye that reddens, grows veiny, and droops tired as `intensity` (0..1) rises. */
export function EyeGraphic({
  intensity,
  size = 220,
}: {
  intensity: number;
  size?: number;
}) {
  const t = Math.min(1, Math.max(0, intensity));
  const sclera = lerpColor([255, 255, 255], [255, 205, 198], t);
  const iris = lerpColor([90, 116, 134], [158, 22, 16], t);
  const outline = lerpColor([130, 130, 140], [200, 60, 55], t);
  const lidDrop = 4 + t * 16; // tired upper-lid droop
  const almond = "M4,30 Q50,2 96,30 Q50,58 4,30 Z";

  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 100 60">
      <Defs>
        <ClipPath id="eyeClip">
          <Path d={almond} />
        </ClipPath>
      </Defs>

      {t > 0 && (
        <Ellipse
          cx={50}
          cy={30}
          rx={54}
          ry={32}
          fill={`rgba(255,45,32,${0.22 * t})`}
        />
      )}

      <G clipPath="url(#eyeClip)">
        <Rect x={0} y={0} width={100} height={60} fill={sclera} />

        {t > 0.02 && (
          <G stroke="rgb(214,28,22)" strokeWidth={0.9} opacity={t}>
            <Line x1={6} y1={28} x2={34} y2={31} />
            <Line x1={6} y1={34} x2={32} y2={30} />
            <Line x1={94} y1={28} x2={66} y2={31} />
            <Line x1={94} y1={34} x2={68} y2={30} />
            <Line x1={22} y1={14} x2={40} y2={26} />
            <Line x1={78} y1={46} x2={60} y2={34} />
          </G>
        )}

        <Circle cx={50} cy={30} r={15} fill={iris} />
        <Circle cx={50} cy={30} r={7.5} fill="rgb(14,14,18)" />
        <Circle cx={45} cy={25} r={3} fill="rgba(255,255,255,0.92)" />

        {/* tired upper lid */}
        <Rect x={0} y={0} width={100} height={lidDrop} fill="#09090b" />
      </G>

      <Path d={almond} fill="none" stroke={outline} strokeWidth={2} />
    </Svg>
  );
}
