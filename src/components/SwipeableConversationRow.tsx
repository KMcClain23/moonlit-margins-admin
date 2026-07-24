import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import { muteConversation, setConversationReadState, leaveConversation, type Conversation } from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import { impactLight, impactMedium } from "../lib/haptics";
import { useToast } from "../lib/toastStore";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

const ACTION_WIDTH = 76;
const ACTION_COUNT = 3;
const REVEAL_WIDTH = ACTION_WIDTH * ACTION_COUNT;
const OPEN_THRESHOLD = REVEAL_WIDTH / 2;
const SPRING_CONFIG = { damping: 18, mass: 0.3, stiffness: 200 };

type BusyAction = "read" | "mute" | "leave" | null;

interface SwipeableConversationRowProps {
  conversation: Conversation;
  index: number;
  onPress: () => void;
  onReadStateChange: (conversationId: string, read: boolean) => void;
  onMutedChange: (conversationId: string, muted: boolean) => void;
  onLeft: (conversationId: string) => void;
  onError: (message: string) => void;
}

// Capped so a long list's later rows don't wait ages to appear -- the
// stagger reads as intentional for the first screenful, then rows past
// that just fade in together with the last visible delay.
const MAX_STAGGER_INDEX = 8;
const STAGGER_MS = 40;

export default function SwipeableConversationRow({
  conversation,
  index,
  onPress,
  onReadStateChange,
  onMutedChange,
  onLeft,
  onError,
}: SwipeableConversationRowProps) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const hasTriggeredThresholdHaptic = useSharedValue(false);
  const [isOpen, setIsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const { showToast } = useToast();

  const hasUnread = conversation.unreadCount > 0;

  // Plain JS helper (not a worklet) -- every caller runs on the JS
  // thread already (Pressable's onPress), unlike the pan gesture's own
  // onEnd below which sets translateX/isOpen directly from UI-thread
  // worklet code.
  function closeRow() {
    translateX.value = withSpring(0, SPRING_CONFIG);
    setIsOpen(false);
  }

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-15, 15])
    .onBegin(() => {
      startX.value = translateX.value;
      hasTriggeredThresholdHaptic.value = false;
    })
    .onUpdate((event) => {
      const next = Math.min(0, Math.max(-REVEAL_WIDTH, startX.value + event.translationX));
      translateX.value = next;
      const pastThreshold = next < -OPEN_THRESHOLD;
      if (pastThreshold && !hasTriggeredThresholdHaptic.value) {
        hasTriggeredThresholdHaptic.value = true;
        runOnJS(impactLight)();
      } else if (!pastThreshold && hasTriggeredThresholdHaptic.value) {
        hasTriggeredThresholdHaptic.value = false;
      }
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -OPEN_THRESHOLD;
      translateX.value = withSpring(shouldOpen ? -REVEAL_WIDTH : 0, SPRING_CONFIG);
      runOnJS(setIsOpen)(shouldOpen);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  function handleRowPress() {
    if (isOpen) {
      closeRow();
      return;
    }
    onPress();
  }

  async function handleToggleRead() {
    setBusyAction("read");
    impactLight();
    try {
      const nextRead = hasUnread;
      await setConversationReadState(conversation.id, nextRead);
      onReadStateChange(conversation.id, nextRead);
      showToast(nextRead ? "Marked as read" : "Marked as unread");
      closeRow();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Couldn't update that conversation.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleMute() {
    setBusyAction("mute");
    impactLight();
    try {
      const nextMuted = !conversation.muted;
      await muteConversation(conversation.id, nextMuted);
      onMutedChange(conversation.id, nextMuted);
      showToast(nextMuted ? "Conversation muted" : "Conversation unmuted");
      closeRow();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Couldn't update that conversation.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLeave() {
    setBusyAction("leave");
    try {
      await leaveConversation(conversation.id);
      onLeft(conversation.id);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Couldn't leave that conversation.");
      closeRow();
    } finally {
      setBusyAction(null);
    }
  }

  function confirmLeave() {
    Alert.alert("Leave conversation?", "You won't see it here anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        // Fires only once the destructive action is actually confirmed,
        // not on the initial tap that opened this Alert.
        onPress: () => {
          impactMedium();
          void handleLeave();
        },
      },
    ]);
  }

  return (
    <Animated.View
      style={styles.wrapper}
      entering={FadeInDown.delay(Math.min(index, MAX_STAGGER_INDEX) * STAGGER_MS).springify().damping(18)}
      exiting={FadeOutUp.springify().damping(18)}
      layout={LinearTransition.springify()}
    >
      <View style={styles.actionsContainer}>
        <Pressable
          style={styles.actionButton}
          onPress={() => void handleToggleRead()}
          disabled={busyAction !== null}
        >
          <Ionicons name={hasUnread ? "mail-open-outline" : "mail-unread-outline"} size={20} color={colors.lilac.default} />
          <Text style={styles.actionLabel}>{hasUnread ? "Read" : "Unread"}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={() => void handleToggleMute()}
          disabled={busyAction !== null}
        >
          <Ionicons
            name={conversation.muted ? "notifications-off-outline" : "notifications-outline"}
            size={20}
            color={colors.lilac.default}
          />
          <Text style={styles.actionLabel}>{conversation.muted ? "Unmute" : "Mute"}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={confirmLeave}
          disabled={busyAction !== null}
        >
          <Ionicons name="trash-outline" size={20} color={colors.candle.default} />
          <Text style={[styles.actionLabel, styles.leaveLabel]}>Leave</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.content, animatedStyle]}>
          <Pressable style={styles.row} onPress={handleRowPress}>
            <Text style={[styles.title, hasUnread && styles.titleUnread]}>
              {conversation.title}
              {conversation.type === "group" ? <Text style={styles.groupBadge}>  Group</Text> : null}
            </Text>
            {conversation.muted ? (
              <Ionicons name="notifications-off" size={14} color={colors.muted} style={styles.mutedIcon} />
            ) : null}
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  actionsContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: REVEAL_WIDTH,
    flexDirection: "row",
  },
  actionButton: {
    width: ACTION_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  actionLabel: { fontFamily: typography.mono, fontSize: 10, color: colors.lilac.default },
  leaveLabel: { color: colors.candle.default },
  content: { backgroundColor: colors.ink },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
  },
  title: { flex: 1, fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment },
  titleUnread: { fontFamily: typography.bodyBold },
  groupBadge: { fontFamily: typography.mono, fontSize: 11, color: colors.lilac.soft },
  mutedIcon: { marginRight: -2 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.candle.default,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { fontFamily: typography.bodySemibold, color: colors.ink, fontSize: 12 },
});
