/**
 * Exact color tokens from the web app's tailwind.config.ts
 * (moonlit-margins, sibling project) -- kept in lockstep with those
 * values rather than approximated, so the native app's dark theme
 * matches it precisely.
 */
export const colors = {
  ink: "#0A0A14",
  surface: "#131320",
  surfaceRaised: "#1B1B2C",
  parchment: "#EDEDF2",
  muted: "#9497AC",
  lilac: {
    default: "#E8973D",
    soft: "#F2C177",
    deep: "#B8701F",
  },
  candle: {
    default: "#D9662E",
    soft: "#E8916A",
  },
  hairline: "rgba(237, 237, 242, 0.12)",
} as const;

export type Colors = typeof colors;

/** Returns a color at the given opacity, for tinted badge backgrounds
 * (e.g. lilac.default at 15% behind lilac.default text) -- takes a plain
 * "#RRGGBB" hex string, not one of the rgba() tokens above (hairline is
 * already rgba and doesn't need this). */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
