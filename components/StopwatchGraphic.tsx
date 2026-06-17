import Svg, { Circle, G, Line, Path, Polygon } from "react-native-svg";

type RGB = [number, number, number];

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function mix(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * clamp01(t));
}

function lerpRGB(from: RGB, to: RGB, t: number): RGB {
  return [mix(from[0], to[0], t), mix(from[1], to[1], t), mix(from[2], to[2], t)];
}

function rgb([r, g, b]: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function lerpColor(from: RGB, to: RGB, t: number): string {
  return rgb(lerpRGB(from, to, t));
}

const CX = 50;
const CY = 54;
const R = 34;

/** Point at clock-angle `deg` (0 = 12 o'clock, clockwise) and distance `d`. */
function pt(deg: number, d: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [CX + d * Math.sin(rad), CY - d * Math.cos(rad)];
}

// Cracks spider out from one impact point as `break` rises; each fades in once
// `break` passes its threshold. Paths stay inside the face radius.
const CRACKS: { d: string; at: number }[] = [
  { d: "M53,45 L51,55 L54,65 L50,77", at: 0.0 },
  { d: "M53,45 L45,42 L39,38 L31,37", at: 0.04 },
  { d: "M53,45 L61,47 L69,49 L77,51", at: 0.2 },
  { d: "M53,45 L46,53 L41,61 L33,67", at: 0.36 },
  { d: "M53,45 L59,55 L62,64 L69,71", at: 0.52 },
  { d: "M39,38 L46,53 L41,61", at: 0.64 },
  { d: "M61,47 L59,55 L62,64", at: 0.76 },
];

/**
 * A stopwatch whose face reddens as `intensity` (0..1) rises and the hand points
 * to the current minute. Past ~60 min it visibly *breaks*: the glass cracks, a
 * shard punches loose, and the hand bends — escalating toward ~120 min. Shares
 * the visual language of the floating pill.
 */
export function StopwatchGraphic({
  intensity,
  minutes,
  size = 220,
}: {
  intensity: number;
  minutes: number;
  size?: number;
}) {
  const t = clamp01(intensity);
  const brk = clamp01((minutes - 60) / 60); // 0 at 60 min → 1 at 120 min
  const angle = ((minutes % 60) / 60) * 360;

  const ring = lerpColor([150, 162, 173], [25, 227, 255], t);
  // Face charges toward electric cyan with intensity, then drains to dead grey as it shatters.
  const face = rgb(
    lerpRGB(lerpRGB([238, 240, 243], [198, 246, 255], t), [196, 198, 203], brk * 0.55)
  );
  const hand = lerpColor([44, 48, 56], [11, 160, 190], t);
  const crackDark = "rgb(12,12,16)";
  const crackLite = "rgb(232,236,242)";

  // Bent hand: a kink that grows with break.
  const bend = brk * 42;
  const tail = pt(angle + 180, 0.22 * R);
  const mid = pt(angle, 0.42 * R);
  const tip = pt(angle + bend, 0.8 * R);

  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Cyan glow stand-in (the pill animates it). */}
      {t > 0 && (
        <Circle cx={CX} cy={CY} r={44} fill={`rgba(25,227,255,${0.22 * t})`} />
      )}

      {/* Detached shards flung off near the rim once it's badly broken. */}
      {brk > 0.6 && (
        <G opacity={clamp01((brk - 0.6) / 0.25)}>
          <Polygon
            points="86,34 94,30 92,40"
            fill={ring}
            stroke={crackDark}
            strokeWidth={0.8}
          />
          <Polygon
            points="80,80 88,86 78,88"
            fill={ring}
            stroke={crackDark}
            strokeWidth={0.8}
          />
        </G>
      )}

      {/* Crown (tilts loose as it breaks) + side button. */}
      <G transform={`rotate(${brk * 14} 50 11) translate(0 ${-brk * 2})`}>
        <Path
          d="M45.5,6 h9 a2.5,2.5 0 0 1 2.5,2.5 v6.5 h-14 v-6.5 a2.5,2.5 0 0 1 2.5,-2.5 z"
          fill={ring}
        />
      </G>
      <Line
        x1={72}
        y1={20}
        x2={80}
        y2={12}
        stroke={ring}
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* Face disc + ring. */}
      <Circle cx={CX} cy={CY} r={R} fill={face} />
      <Circle cx={CX} cy={CY} r={R} fill="none" stroke={ring} strokeWidth={5} />

      {/* Tick marks. */}
      <G stroke={ring} strokeWidth={2} strokeLinecap="round">
        {ticks.map((deg) => {
          const major = deg % 90 === 0;
          const [x1, y1] = pt(deg, major ? 26 : 28.5);
          const [x2, y2] = pt(deg, 31);
          return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </G>

      {/* Punched-out shard (a hole) once nearly shattered. */}
      {brk > 0.82 && (
        <Polygon
          points="61,47 77,51 59,55"
          fill="rgb(11,11,14)"
          opacity={clamp01((brk - 0.82) / 0.18)}
        />
      )}

      {/* Cracks: a dark fracture with a glassy highlight. */}
      <G strokeLinecap="round" strokeLinejoin="round" fill="none">
        {CRACKS.map((c, i) => {
          const op = clamp01((brk - c.at) / 0.12);
          if (op <= 0) return null;
          return (
            <G key={i} opacity={op}>
              <Path d={c.d} stroke={crackDark} strokeWidth={2.2} />
              <Path d={c.d} stroke={crackLite} strokeWidth={0.7} opacity={0.7} />
            </G>
          );
        })}
      </G>

      {/* Hand (bends as it breaks) + center hub. */}
      <Path
        d={`M${tail[0]},${tail[1]} L${CX},${CY} L${mid[0]},${mid[1]} L${tip[0]},${tip[1]}`}
        fill="none"
        stroke={hand}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={CX} cy={CY} r={4.5} fill={hand} />
    </Svg>
  );
}
