import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { leaveConversation, listConversations, type Conversation } from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import type { MessagesStackParamList } from "../navigation/RootNavigator";

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
      setConversations(await listConversations());
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
            <Text style={styles.emptyText}>No conversations yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("ConversationDetail", { conversationId: item.id, title: item.title })}
            onLongPress={() => confirmLeave(item)}
            disabled={leavingId === item.id}
          >
            <Text style={styles.title}>
              {item.title}
              {item.type === "group" ? <Text style={styles.groupBadge}>  Group</Text> : null}
            </Text>
          </Pressable>
        )}
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate("NewConversation")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#777", fontSize: 15 },
  errorText: { color: "#c0392b", fontSize: 15, textAlign: "center", paddingHorizontal: 24 },
  inlineErrorText: {
    color: "#c0392b",
    fontSize: 13,
    textAlign: "center",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111" },
  groupBadge: { fontSize: 11, fontWeight: "600", color: "#6c63d1" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 28, lineHeight: 30 },
});
