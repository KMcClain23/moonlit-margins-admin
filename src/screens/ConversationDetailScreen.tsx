import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { leaveConversation, listMessages, sendMessage, type Message } from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import type { MessagesStackParamList } from "../navigation/RootNavigator";

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [composeText, setComposeText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isFetchingRef = useRef(false);
  const listRef = useRef<FlatList<Message>>(null);

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
      { text: "Leave", style: "destructive", onPress: () => void handleLeave() },
    ]);
  }

  // route.params.title is already resolved by whoever navigated here (the
  // conversations list has it on hand from listConversations()) -- a
  // notification tap is the one path that doesn't have it, and falls back
  // to a generic label rather than triggering an extra lookup here.
  useEffect(() => {
    navigation.setOptions({
      title: title ?? "Conversation",
      headerRight: () => (
        <Pressable onPress={confirmLeave} disabled={isLeaving} hitSlop={8}>
          <Text style={styles.headerLeaveText}>Leave</Text>
        </Pressable>
      ),
    });
  }, [navigation, title, isLeaving]);

  const load = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const data = await listMessages(conversationId);
      setMessages(data);
      setErrorMessage(null);
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

  async function handleSend() {
    const trimmed = composeText.trim();
    if (!trimmed) return;
    setIsSending(true);
    setErrorMessage(null);
    try {
      await sendMessage(conversationId, trimmed);
      setComposeText("");
      await load();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't send that message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {isLoading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>No messages yet -- say hello.</Text>}
          renderItem={({ item }) => {
            const isMine = item.senderId === session?.adminUserId;
            return (
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <Text style={styles.messageMeta}>
                  {isMine ? "You" : item.senderName} · {formatMessageTime(item.createdAt)}
                </Text>
                <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <View style={styles.composeRow}>
        <TextInput
          style={[styles.input, styles.composeInput]}
          placeholder="Type a message…"
          value={composeText}
          onChangeText={setComposeText}
          editable={!isSending}
          multiline
        />
        <Pressable
          style={[styles.sendButton, (!composeText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!composeText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  headerLeaveText: { color: "#c0392b", fontSize: 14, fontWeight: "600" },
  flex: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#888", fontSize: 14 },
  errorText: { color: "#c0392b", fontSize: 13, textAlign: "center", paddingVertical: 6, paddingHorizontal: 16 },
  messageRow: { marginBottom: 14, alignItems: "flex-start" },
  messageRowMine: { alignItems: "flex-end" },
  messageMeta: { fontSize: 11, color: "#999", marginBottom: 3 },
  bubble: {
    maxWidth: "80%",
    backgroundColor: "#f0f0f0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: { backgroundColor: "#1a1a2e" },
  bubbleText: { fontSize: 14, color: "#222" },
  bubbleTextMine: { color: "#fff" },
  composeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  composeInput: { flex: 1, minHeight: 40, maxHeight: 100 },
  sendButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
