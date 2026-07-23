import { useMemo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";

export type StarfieldVariant = "dense" | "subtle";

/**
 * Matches the web app's .starfield / .starfield-subtle (src/app/globals.css)
 * as closely as a runtime-generated field can: "dense" mirrors .starfield's
 * two tiled dot layers (radius ~0.35-2.3, opacity ~0.25-0.97); "subtle"
 * mirrors .starfield-subtle's much sparser, dimmer dots for screens where
 * body text sits directly on top and shouldn't have to compete with it.
 */
const VARIANT_CONFIG: Record<
  StarfieldVariant,
  { density: number; radiusRange: [number, number]; opacityRange: [number, number] }
> = {
  dense: { density: 0.0011, radiusRange: [0.35, 2.3], opacityRange: [0.25, 0.97] },
  subtle: { density: 0.00012, radiusRange: [0.35, 1.5], opacityRange: [0.15, 0.35] },
};

interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
}

// Mulberry32 -- small, fast, deterministic PRNG. Using a seeded generator
// (rather than Math.random()) means the exact same "random" star layout
// comes back every time this renders at a given size, instead of
// visibly reshuffling on every re-render.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateStars(width: number, height: number, variant: StarfieldVariant, seed: number): Star[] {
  if (width <= 0 || height <= 0) return [];

  const { density, radiusRange, opacityRange } = VARIANT_CONFIG[variant];
  const count = Math.max(1, Math.round(width * height * density));
  const random = mulberry32(seed);

  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: random() * width,
      y: random() * height,
      r: radiusRange[0] + random() * (radiusRange[1] - radiusRange[0]),
      opacity: opacityRange[0] + random() * (opacityRange[1] - opacityRange[0]),
    });
  }
  return stars;
}

/**
 * A dense field of small white dots, sized to fill the given width/height.
 * Purely the SVG itself -- positioning (absolute fill, z-index, etc.) is
 * the caller's responsibility via the `style` prop, so this can be reused
 * behind different layouts without assuming how it should sit relative to
 * its siblings.
 */
export default function Starfield({
  width,
  height,
  variant = "dense",
  seed = 1,
  style,
}: {
  width: number;
  height: number;
  variant?: StarfieldVariant;
  /** Change this if you ever need a visibly different pattern in two
   * Starfields stacked in the same view -- otherwise leave it alone so
   * the pattern stays stable. */
  seed?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const stars = useMemo(() => generateStars(width, height, variant, seed), [width, height, variant, seed]);

  return (
    <Svg width={width} height={height} style={style} pointerEvents="none">
      {stars.map((star, index) => (
        <Circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#FFFFFF" fillOpacity={star.opacity} />
      ))}
    </Svg>
  );
}
