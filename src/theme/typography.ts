/**
 * Semantic font names, mapped to the exact weights loaded via useFonts()
 * in App.tsx. Screens should reference typography.display etc. rather
 * than raw @expo-google-fonts family strings, so there's a single place
 * to update if a loaded weight ever changes.
 */
export const typography = {
  // Fraunces (serif) -- display/header text.
  display: "Fraunces_600SemiBold",
  displayMedium: "Fraunces_500Medium",

  // Manrope (sans-serif) -- body text.
  body: "Manrope_400Regular",
  bodyMedium: "Manrope_500Medium",
  bodySemibold: "Manrope_600SemiBold",
  bodyBold: "Manrope_700Bold",

  // IBM Plex Mono -- eyebrow labels/mono accents.
  mono: "IBMPlexMono_500Medium",
} as const;

export type Typography = typeof typography;
