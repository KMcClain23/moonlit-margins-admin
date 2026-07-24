import { useEffect, useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

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

// How much larger than the visible frame the star canvas is generated when
// animated, per the requested "roughly 1.5x" -- big enough that a rotating
// corner doesn't obviously peek past the frame edge, though at very
// elongated aspect ratios (a full-screen phone viewport is far from
// square) a razor-thin sliver can still theoretically clear it at some
// angles. In practice this doesn't read as a visible seam: the SVG canvas
// has no background fill of its own, so an uncovered sliver just shows
// slightly fewer stars for an instant, not a hard edge against a
// mismatched color -- the parent behind it is already the same dark
// background these screens use everywhere else.
const ANIMATED_SCALE = 1.5;

// A full rotation every ~3.5 minutes -- slow enough to read as ambient
// background drift rather than a deliberate spin, linear so the motion
// never accelerates/decelerates or reverses.
const ROTATION_DURATION_MS = 210000;

/**
 * A dense field of small white dots, sized to fill the given width/height.
 * Purely the SVG itself -- positioning (absolute fill, z-index, etc.) is
 * the caller's responsibility via the `style` prop, so this can be reused
 * behind different layouts without assuming how it should sit relative to
 * its siblings.
 *
 * When `animated` (the default), the dot field slowly rotates clockwise
 * forever. The star canvas itself is generated oversized (ANIMATED_SCALE ×
 * the requested width/height) and centered with a negative offset inside
 * an `overflow: "hidden"` frame clipped to the actual requested size, so
 * rotating it doesn't reveal blank space at the corners the way rotating
 * an exactly-frame-sized canvas would.
 */
export default function Starfield({
  width,
  height,
  variant = "dense",
  seed = 1,
  animated = true,
  style,
}: {
  width: number;
  height: number;
  variant?: StarfieldVariant;
  /** Change this if you ever need a visibly different pattern in two
   * Starfields stacked in the same view -- otherwise leave it alone so
   * the pattern stays stable. */
  seed?: number;
  /** Slow continuous clockwise rotation, on by default. Set false for a
   * static field (e.g. a snapshot/export context where a native-thread
   * animation loop serves no purpose). */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const canvasWidth = animated ? width * ANIMATED_SCALE : width;
  const canvasHeight = animated ? height * ANIMATED_SCALE : height;

  const stars = useMemo(
    () => generateStars(canvasWidth, canvasHeight, variant, seed),
    [canvasWidth, canvasHeight, variant, seed]
  );

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    rotation.value = withRepeat(
      withTiming(360, { duration: ROTATION_DURATION_MS, easing: Easing.linear }),
      -1,
      false
    );
  }, [animated, rotation]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const dots = stars.map((star, index) => (
    <Circle key={index} cx={star.x} cy={star.y} r={star.r} fill="#FFFFFF" fillOpacity={star.opacity} />
  ));

  if (!animated) {
    return (
      <Svg width={width} height={height} style={style} pointerEvents="none">
        {dots}
      </Svg>
    );
  }

  return (
    <View style={[style, { width, height, overflow: "hidden" }]} pointerEvents="none">
      <Animated.View
        style={[
          {
            position: "absolute",
            width: canvasWidth,
            height: canvasHeight,
            left: -(canvasWidth - width) / 2,
            top: -(canvasHeight - height) / 2,
          },
          rotationStyle,
        ]}
      >
        <Svg width={canvasWidth} height={canvasHeight} pointerEvents="none">
          {dots}
        </Svg>
      </Animated.View>
    </View>
  );
}
