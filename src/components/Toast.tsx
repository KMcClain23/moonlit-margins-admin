import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

export type ToastVariant = "success" | "error";

interface ToastProps {
  message: string;
  variant: ToastVariant;
  onDone: () => void;
}

const VISIBLE_MS = 2000;
const SPRING_CONFIG = { damping: 16, mass: 0.4, stiffness: 180 };

export default function Toast({ message, variant, onDone }: ToastProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSequence(
      withSpring(1, SPRING_CONFIG),
      withDelay(
        VISIBLE_MS,
        withTiming(0, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onDone)();
        })
      )
    );
    // Runs once per mounted toast instance -- the parent remounts this
    // component (via a fresh `key`) for each new showToast() call rather
    // than updating props on an existing one, so there's no case where
    // message/variant change without a full re-entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <Animated.View style={[styles.pill, animatedStyle]}>
        <View style={[styles.dot, variant === "error" ? styles.dotError : styles.dotSuccess]} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 32,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotSuccess: { backgroundColor: colors.lilac.default },
  dotError: { backgroundColor: colors.candle.default },
  text: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.parchment, flexShrink: 1 },
});
