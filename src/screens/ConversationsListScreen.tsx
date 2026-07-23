import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { leaveConversation, listConversations, type Conversation } from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import { clearBadgeCount } from "../lib/pushNotifications";
import { setUnreadCount } from "../lib/unreadMessages";
import type { MessagesStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";

type Nav = NativeStackNavigationProp<MessagesStackParamList, "ConversationsList">;

export default function ConversationsListScreen() {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      const data = await listConversations();
      setConversations(data);
      // Already have the full, fresh list here -- push the total straight
      // to the Messages tab badge instead of making it wait for its own
      // next poll (or redundantly re-fetching the same data itself).
      setUnreadCount(data.reduce((sum, c) => sum + c.unreadCount, 0));
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load conversations.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
      // Landing on this screen is the signal that whatever was unread has
      // now been seen -- there's no server-tracked unread count to base
      // this on, so it's a simple "seen the list" reset.
      void clearBadgeCount();
    }, [load])
  );

  async function handleLeave(conversationId: string) {
    setLeavingId(conversationId);
    setErrorMessage(null);
    try {
      await leaveConversation(conversationId);
      // Only this row's participation is gone server-side -- drop it from
      // the local list directly rather than refetching everything.
      setConversations((current) => current.filter((c) => c.id !== conversationId));
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't leave that conversation.");
    } finally {
      setLeavingId(null);
    }
  }

  function confirmLeave(conversation: Conversation) {
    Alert.alert("Leave conversation?", "You won't see it here anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () => void handleLeave(conversation.id),
      },
    ]);
  }

  return (
    <View style={styles.container}>
      {errorMessage && conversations.length > 0 ? (
        <Text style={styles.inlineErrorText}>{errorMessage}</Text>
      ) : null}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <EmptyState message="No conversations yet." />
          )
        }
        renderItem={({ item }) => {
          const hasUnread = item.unreadCount > 0;
          return (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate("ConversationDetail", { conversationId: item.id, title: item.title })
              }
              onLongPress={() => confirmLeave(item)}
              disabled={leavingId === item.id}
            >
              <Text style={[styles.title, hasUnread && styles.titleUnread]}>
                {item.title}
                {item.type === "group" ? <Text style={styles.groupBadge}>  Group</Text> : null}
              </Text>
              {hasUnread ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate("NewConversation")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1 },
  emptyText: { fontFamily: typography.body, color: colors.muted, fontSize: 15, textAlign: "center", marginTop: 40 },
  errorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 40,
  },
  inlineErrorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 13,
    textAlign: "center",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
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
    marginBottom: 12,
  },
  title: { flex: 1, fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment },
  titleUnread: { fontFamily: typography.bodyBold },
  groupBadge: { fontFamily: typography.mono, fontSize: 11, color: colors.lilac.soft },
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
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lilac.default,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: colors.lilac.default, fontSize: 28, lineHeight: 30 },
});
