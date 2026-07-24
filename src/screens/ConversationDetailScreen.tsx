import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../lib/authStore";
import {
  leaveConversation,
  listConversations,
  listMessages,
  renameConversation,
  sendMessage,
  type Conversation,
  type Message,
} from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import { impactLight, impactMedium, selection } from "../lib/haptics";
import {
  enqueueMessage,
  getQueuedMessages,
  retryQueuedMessage,
  subscribeToQueueChanges,
  type QueuedMessage,
  type QueuedMessageStatus,
} from "../lib/messageQueue";
import { isLikelyNetworkError } from "../lib/offlineCache";
import { refreshUnreadCount } from "../lib/unreadMessages";
import {
  CONVERSATION_THEME_OPTIONS,
  DEFAULT_CONVERSATION_THEME_KEY,
  getConversationTheme,
  resolveConversationThemeColor,
  setConversationTheme,
} from "../lib/conversationThemes";
import type { MessagesStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

// A single rendered row is either a server-confirmed message or a
// locally-queued one still waiting to send (or that failed to) -- kept
// as a tagged union rather than reusing Message's shape for both, since
// a queued item has no senderId/senderName (it's always "mine" by
// definition -- nothing else can queue a message on this device) and
// carries a status the real thing never does.
type RenderItem =
  | { kind: "sent"; id: string; senderId: string; senderName: string; body: string; createdAt: string }
  | { kind: "queued"; id: string; body: string; createdAt: string; status: QueuedMessageStatus };

type Nav = NativeStackNavigationProp<MessagesStackParamList, "ConversationDetail">;
type DetailRoute = RouteProp<MessagesStackParamList, "ConversationDetail">;

// Matches the web admin's MessagesApp.tsx polling interval exactly.
const POLL_INTERVAL_MS = 5000;

function formatMessageTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function ConversationDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { conversationId, title } = route.params;
  const { session } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // route.params.title is already resolved by whoever navigated here (the
  // conversations list has it on hand from listConversations()) -- a
  // notification tap is the one path that doesn't have it, and falls back
  // to a generic label until loadConversationInfo() below resolves the
  // real one. Neither that param nor a notification tap carries `type`
  // though, so conversation (fetched separately) is what actually gates
  // the rename affordance to group conversations.
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [displayTitle, setDisplayTitle] = useState(title ?? "Conversation");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Device-local accent color, never synced server-side -- loaded once
  // per screen instance (a new conversationId always means a freshly
  // mounted screen in this stack, not a reused one) rather than re-read
  // on every focus, since nothing but this screen's own picker changes it.
  const [themeKey, setThemeKey] = useState(DEFAULT_CONVERSATION_THEME_KEY);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const themeColor = resolveConversationThemeColor(themeKey);

  useEffect(() => {
    let cancelled = false;
    getConversationTheme(conversationId).then((stored) => {
      if (!cancelled) setThemeKey(stored ?? DEFAULT_CONVERSATION_THEME_KEY);
    });
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  async function handleSelectTheme(key: string) {
    selection();
    setThemeKey(key);
    setShowThemePicker(false);
    try {
      await setConversationTheme(conversationId, key);
    } catch {
      // Best-effort, device-local preference -- the UI already reflects
      // the choice for this session; not worth an error banner for a
      // non-synced, low-stakes setting.
    }
  }

  const isFetchingRef = useRef(false);
  const listRef = useRef<FlatList<RenderItem>>(null);

  const loadConversationInfo = useCallback(async () => {
    try {
      const conversations = await listConversations();
      const found = conversations.data.find((c) => c.id === conversationId) ?? null;
      setConversation(found);
      if (found) setDisplayTitle(found.title);
    } catch {
      // Best-effort -- the header already has a usable title from route
      // params (or the "Conversation" fallback); a failed lookup here
      // just means the rename affordance won't show, not a broken screen.
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      loadConversationInfo();
    }, [loadConversationInfo])
  );

  async function handleLeave() {
    setIsLeaving(true);
    setErrorMessage(null);
    try {
      await leaveConversation(conversationId);
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't leave that conversation.");
      setIsLeaving(false);
    }
  }

  function confirmLeave() {
    Alert.alert("Leave conversation?", "You won't see it here anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => {
          impactMedium();
          void handleLeave();
        },
      },
    ]);
  }

  function startRenaming() {
    setRenameText(displayTitle);
    setIsRenaming(true);
  }

  // Fires from both onSubmitEditing (Enter/Done) and onBlur (tapping
  // away) -- either commits the edit, so this guards against running
  // twice for the same commit (those two can both fire back to back) and
  // against saving a no-op (unchanged or emptied-out text just closes
  // edit mode instead of hitting the API).
  async function commitRename() {
    if (isSavingRename) return;
    const trimmed = renameText.trim();
    if (!trimmed || trimmed === displayTitle) {
      setIsRenaming(false);
      return;
    }
    setIsSavingRename(true);
    setErrorMessage(null);
    try {
      await renameConversation(conversationId, trimmed);
      setDisplayTitle(trimmed);
      setIsRenaming(false);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't rename that conversation.");
      setIsRenaming(false);
    } finally {
      setIsSavingRename(false);
    }
  }

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => {
        if (isRenaming) {
          return (
            <TextInput
              style={styles.headerTitleInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              editable={!isSavingRename}
              onSubmitEditing={() => void commitRename()}
              onBlur={() => void commitRename()}
              returnKeyType="done"
              selectTextOnFocus
              placeholderTextColor={colors.muted}
            />
          );
        }
        if (conversation?.type === "group") {
          return (
            <Pressable onPress={startRenaming} hitSlop={8}>
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {displayTitle}
              </Text>
            </Pressable>
          );
        }
        return (
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {displayTitle}
          </Text>
        );
      },
      headerRight: () => (
        <View style={styles.headerRightRow}>
          <Pressable onPress={() => setShowThemePicker((v) => !v)} hitSlop={8} style={styles.headerIconButton}>
            <Ionicons name="color-palette-outline" size={20} color={themeColor} />
          </Pressable>
          <Pressable onPress={confirmLeave} disabled={isLeaving} hitSlop={8}>
            <Text style={styles.headerLeaveText}>Leave</Text>
          </Pressable>
        </View>
      ),
    });
  }, [
    navigation,
    isLeaving,
    conversation,
    displayTitle,
    isRenaming,
    renameText,
    isSavingRename,
    themeColor,
    showThemePicker,
  ]);

  const load = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await listMessages(conversationId);
      setMessages(data);
      setErrorMessage(null);
      // Fetching messages is also what marks this conversation read
      // server-side -- push that change to the Messages tab badge right
      // away rather than leaving it to catch up on its own poll timer.
      void refreshUnreadCount();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load messages.");
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, [conversationId]);

  // Polls every 5s while this screen is focused, and stops the moment
  // it's not -- switching tabs or navigating back to the conversation
  // list clears the interval via this effect's cleanup.
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, POLL_INTERVAL_MS);
      return () => clearInterval(interval);
    }, [load])
  );

  const loadQueuedMessages = useCallback(async () => {
    setQueuedMessages(await getQueuedMessages(conversationId));
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      loadQueuedMessages();
    }, [loadQueuedMessages])
  );

  // Reacts to the queue changing for reasons outside this screen's own
  // control -- most importantly flushMessageQueue() (App.tsx's NetInfo
  // "back online" listener) sending a message that was queued while this
  // conversation was open. Re-running load() too (not just re-reading the
  // queue) is what actually replaces the optimistic bubble with the
  // confirmed server copy, rather than just making it vanish until the
  // next 5s poll happens to catch up.
  useEffect(() => {
    const unsubscribe = subscribeToQueueChanges(() => {
      loadQueuedMessages();
      load();
    });
    return unsubscribe;
  }, [loadQueuedMessages, load]);

  const renderItems = useMemo<RenderItem[]>(() => {
    const sent: RenderItem[] = messages.map((m) => ({ kind: "sent", ...m }));
    const queued: RenderItem[] = queuedMessages.map((q) => ({
      kind: "queued",
      id: q.id,
      body: q.body,
      createdAt: q.createdAt,
      status: q.status,
    }));
    // ISO 8601 timestamps sort correctly as plain strings -- no need to
    // parse to Date first.
    return [...sent, ...queued].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages, queuedMessages]);

  async function handleSend() {
    const trimmed = composeText.trim();
    if (!trimmed) return;
    impactLight();
    setIsSending(true);
    setErrorMessage(null);
    try {
      await sendMessage(conversationId, trimmed);
      setComposeText("");
      await load();
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        // No connection right now -- queue it instead of losing it or
        // blocking the compose bar on an error. flushMessageQueue() (see
        // App.tsx) retries it automatically once connectivity returns.
        const queued = await enqueueMessage(conversationId, trimmed);
        setQueuedMessages((current) => [...current, queued]);
        setComposeText("");
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : "Couldn't send that message.");
      }
    } finally {
      setIsSending(false);
    }
  }

  // Manual "tap the red retry icon" path -- distinct from
  // flushMessageQueue()'s automatic sweep on regained connectivity.
  // retryQueuedMessage() itself persists whatever the outcome is
  // (removed on success, 'failed' on a real error, unchanged if still
  // offline), and that write is what notifies subscribeToQueueChanges
  // above -- no local state update needed here.
  function handleRetryQueued(localId: string) {
    impactLight();
    void retryQueuedMessage(localId);
  }

  return (
    // Plain flex:1 column, not a keyboard-avoiding wrapper itself -- only
    // the compose bar below needs to move when the keyboard opens, so
    // KeyboardStickyView wraps just that instead of resizing/padding this
    // entire region (which was the actual bug: see composeRow below).
    <View style={styles.flex}>
      {showThemePicker ? (
        <View style={styles.themePickerRow}>
          {CONVERSATION_THEME_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[
                styles.swatch,
                { backgroundColor: option.color },
                themeKey === option.key && styles.swatchActive,
              ]}
              onPress={() => void handleSelectTheme(option.key)}
              hitSlop={4}
            />
          ))}
        </View>
      ) : null}

      {isLoading && renderItems.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.lilac.default} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={renderItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={renderItems.length === 0 ? styles.emptyContent : styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet -- say hello.</Text>}
          renderItem={({ item }) => {
            if (item.kind === "queued") {
              const isFailed = item.status === "failed";
              return (
                <View style={[styles.messageRow, styles.messageRowMine]}>
                  <View style={styles.queuedMetaRow}>
                    <Ionicons
                      name={isFailed ? "alert-circle" : "time-outline"}
                      size={12}
                      color={isFailed ? colors.candle.default : colors.muted}
                    />
                    <Text style={[styles.messageMeta, isFailed && styles.messageMetaFailed]}>
                      {isFailed ? "Not sent -- tap to retry" : "Sending…"}
                    </Text>
                  </View>
                  <Pressable
                    disabled={!isFailed}
                    onPress={() => handleRetryQueued(item.id)}
                    style={[
                      styles.bubble,
                      styles.bubbleMine,
                      { backgroundColor: themeColor, borderColor: themeColor },
                      styles.bubbleQueued,
                      isFailed && styles.bubbleFailed,
                    ]}
                  >
                    <Text style={[styles.bubbleText, styles.bubbleTextMine]}>{item.body}</Text>
                  </Pressable>
                </View>
              );
            }

            const isMine = item.senderId === session?.adminUserId;
            return (
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <Text style={styles.messageMeta}>
                  {isMine ? "You" : item.senderName} · {formatMessageTime(item.createdAt)}
                </Text>
                <View
                  style={[
                    styles.bubble,
                    isMine && [styles.bubbleMine, { backgroundColor: themeColor, borderColor: themeColor }],
                  ]}
                >
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <KeyboardStickyView style={styles.composeRow}>
        <TextInput
          style={[styles.input, styles.composeInput]}
          placeholder="Type a message…"
          placeholderTextColor={colors.muted}
          value={composeText}
          onChangeText={setComposeText}
          editable={!isSending}
          multiline
        />
        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: themeColor },
            (!composeText.trim() || isSending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!composeText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color={colors.ink} size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerLeaveText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 14 },
  headerTitleText: { fontFamily: typography.bodySemibold, fontSize: 17, color: colors.parchment },
  headerTitleInput: {
    fontFamily: typography.bodySemibold,
    fontSize: 17,
    color: colors.parchment,
    minWidth: 160,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.lilac.default,
  },
  headerRightRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  headerIconButton: { padding: 2 },
  themePickerRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: colors.parchment },
  flex: { flex: 1, backgroundColor: colors.ink },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: typography.body, color: colors.muted, fontSize: 14 },
  errorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  messageRow: { marginBottom: 14, alignItems: "flex-start" },
  messageRowMine: { alignItems: "flex-end" },
  messageMeta: { fontFamily: typography.body, fontSize: 11, color: colors.muted, marginBottom: 3 },
  messageMetaFailed: { color: colors.candle.default },
  queuedMetaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  bubbleQueued: { opacity: 0.65 },
  bubbleFailed: { opacity: 1, borderColor: colors.candle.default, backgroundColor: colors.candle.default },
  bubble: {
    maxWidth: "80%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  bubbleText: { fontFamily: typography.body, fontSize: 14, color: colors.parchment },
  bubbleTextMine: { color: colors.ink },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.parchment,
    backgroundColor: colors.surface,
  },
  composeInput: { flex: 1, minHeight: 40, maxHeight: 100 },
  sendButton: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { fontFamily: typography.bodySemibold, color: colors.ink, fontSize: 14 },
});
