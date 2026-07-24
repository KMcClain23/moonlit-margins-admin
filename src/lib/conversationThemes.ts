import * as SecureStore from "expo-secure-store";
import { colors } from "../theme/colors";
import { CONVERSATION_THEME_STORAGE_KEY_PREFIX } from "./storageKeys";

export interface ConversationThemeOption {
  key: string;
  label: string;
  color: string;
}

/**
 * A curated palette, not a free-form picker -- every option is chosen to
 * stay legible against the app's near-black `colors.ink` background,
 * matching the existing lilac/candle accents' general lightness rather
 * than introducing anything too dark or too saturated to read text on.
 * "lilac" and "candle" reuse the app's own existing accent tokens; the
 * rest are new, complementary options picked for the same dark-background
 * contrast (soft blue, teal, green, gold, pink, violet).
 */
export const CONVERSATION_THEME_OPTIONS: ConversationThemeOption[] = [
  { key: "lilac", label: "Lilac", color: colors.lilac.default },
  { key: "candle", label: "Candle", color: colors.candle.default },
  { key: "blue", label: "Blue", color: "#5B9BD5" },
  { key: "teal", label: "Teal", color: "#5FC7C0" },
  { key: "green", label: "Green", color: "#6FBF8B" },
  { key: "gold", label: "Gold", color: "#D9B44A" },
  { key: "pink", label: "Pink", color: "#E88FB0" },
  { key: "violet", label: "Violet", color: "#A78BFA" },
];

/** What an unthemed conversation (or the theme picker, before anything's
 * been loaded) should show as selected -- the app's standard accent. */
export const DEFAULT_CONVERSATION_THEME_KEY = "lilac";

function storageKeyFor(conversationId: string): string {
  return `${CONVERSATION_THEME_STORAGE_KEY_PREFIX}${conversationId}`;
}

/** The raw stored theme key for this conversation, or null if it's never
 * been customized. Callers that want an actual color to render should go
 * through resolveConversationThemeColor instead, which applies the
 * "default to lilac" fallback this function deliberately doesn't. */
export async function getConversationTheme(conversationId: string): Promise<string | null> {
  return SecureStore.getItemAsync(storageKeyFor(conversationId));
}

export async function setConversationTheme(conversationId: string, colorKey: string): Promise<void> {
  await SecureStore.setItemAsync(storageKeyFor(conversationId), colorKey);
}

/** Turns a (possibly null, or no longer recognized) stored key into an
 * actual color to render -- falls back to the app's standard lilac accent
 * whenever nothing valid is set, matching every other unthemed
 * conversation. */
export function resolveConversationThemeColor(key: string | null): string {
  const option = CONVERSATION_THEME_OPTIONS.find((o) => o.key === key);
  return option?.color ?? colors.lilac.default;
}
