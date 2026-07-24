import { StyleSheet, Text, View } from "react-native";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";

function formatCachedAt(cachedAt: string): string {
  return new Date(cachedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Slim strip shown above a list when there's no connection and/or the
 * data on screen is a cached fallback (see offlineCache.ts) rather than
 * a fresh fetch. Callers decide when `visible` is true -- typically
 * useNetworkStatus() OR'd with whatever withCache() reported as `stale`
 * -- and pass `cachedAt` along when they have it, for the more specific
 * "showing saved data from [time]" copy.
 */
export default function OfflineBanner({
  visible,
  cachedAt = null,
}: {
  visible: boolean;
  cachedAt?: string | null;
}) {
  if (!visible) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {cachedAt
          ? `You're offline -- showing saved data from ${formatCachedAt(cachedAt)}`
          : "You're offline -- showing saved data"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: withAlpha(colors.candle.default, 0.18),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.candle.default,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    fontFamily: typography.bodyMedium,
    fontSize: 12,
    color: colors.candle.soft,
    textAlign: "center",
  },
});
