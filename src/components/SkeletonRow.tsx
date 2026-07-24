import { useCallback, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { colors, withAlpha } from "../theme/colors";

const ROW_HEIGHT = 84;
const SHIMMER_WIDTH_RATIO = 0.5;
const SWEEP_DURATION_MS = 1100;

/** Placeholder row shown only during a list's FIRST load (never during
 * pull-to-refresh, which keeps its own RefreshControl spinner) --
 * roughly matches a real row's shape (title bar + subtitle bar) with a
 * looping gradient sweep across it. Render 4-5 of these stacked instead
 * of a single centered ActivityIndicator. */
export default function SkeletonRow() {
  const [rowWidth, setRowWidth] = useState(0);
  const translateX = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width === rowWidth) return;
      setRowWidth(width);
      const shimmerWidth = width * SHIMMER_WIDTH_RATIO;
      translateX.value = -shimmerWidth;
      translateX.value = withRepeat(
        withTiming(width, { duration: SWEEP_DURATION_MS, easing: Easing.linear }),
        -1,
        false
      );
    },
    [rowWidth, translateX]
  );

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.row} onLayout={onLayout}>
      <View style={styles.barTitle} />
      <View style={styles.barSubtitle} />
      {rowWidth > 0 ? (
        <Animated.View
          style={[styles.shimmer, { width: rowWidth * SHIMMER_WIDTH_RATIO }, shimmerStyle]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={["transparent", withAlpha(colors.parchment, 0.08), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: 12,
    overflow: "hidden",
  },
  barTitle: { width: "60%", height: 16, borderRadius: 6, backgroundColor: colors.surfaceRaised },
  barSubtitle: { width: "40%", height: 12, borderRadius: 6, backgroundColor: colors.surfaceRaised, marginTop: 10 },
  shimmer: { position: "absolute", top: 0, bottom: 0 },
});
