import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { listConversations, type Conversation } from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { clearBadgeCount } from "../lib/pushNotifications";
import { setUnreadCount } from "../lib/unreadMessages";
import { useNetworkStatus } from "../lib/useNetworkStatus";
import type { MessagesStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";
import OfflineBanner from "../components/OfflineBanner";
import SkeletonRow from "../components/SkeletonRow";
import SwipeableConversationRow from "../components/SwipeableConversationRow";

const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

type Nav = NativeStackNavigationProp<MessagesStackParamList, "ConversationsList">;

export default function ConversationsListScreen() {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const isOffline = useNetworkStatus();

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      const result = await listConversations();
      setConversations(result.data);
      setIsStale(result.stale);
      setCachedAt(result.cachedAt);
      // Already have the full, fresh list here -- push the total straight
      // to the Messages tab badge instead of making it wait for its own
      // next poll (or redundantly re-fetching the same data itself).
      setUnreadCount(result.data.reduce((sum, c) => sum + c.unreadCount, 0));
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

  // SwipeableConversationRow already made the API call by the time any
  // of these fire -- each one only needs to reconcile local state (and,
  // for read-state changes, the Messages tab badge) to match what the
  // server now has, the same way handleLeave used to do inline.

  function handleRowLeft(conversationId: string) {
    setConversations((current) => current.filter((c) => c.id !== conversationId));
  }

  function handleRowReadStateChange(conversationId: string, read: boolean) {
    setConversations((current) => {
      const next = current.map((c) => (c.id === conversationId ? { ...c, unreadCount: read ? 0 : 1 } : c));
      setUnreadCount(next.reduce((sum, c) => sum + c.unreadCount, 0));
      return next;
    });
  }

  function handleRowMutedChange(conversationId: string, muted: boolean) {
    setConversations((current) => current.map((c) => (c.id === conversationId ? { ...c, muted } : c)));
  }

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline || isStale} cachedAt={cachedAt} />
      {errorMessage && conversations.length > 0 ? (
        <Text style={styles.inlineErrorText}>{errorMessage}</Text>
      ) : null}
      {isLoading && conversations.length === 0 ? (
        <View style={styles.listContent}>
          {SKELETON_ROWS.map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              tintColor={colors.lilac.default}
              colors={[colors.lilac.default]}
            />
          }
          ListEmptyComponent={
            errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : (
              <EmptyState message="No conversations yet." />
            )
          }
          renderItem={({ item, index }) => (
            <SwipeableConversationRow
              conversation={item}
              index={index}
              onPress={() =>
                navigation.navigate("ConversationDetail", { conversationId: item.id, title: item.title })
              }
              onReadStateChange={handleRowReadStateChange}
              onMutedChange={handleRowMutedChange}
              onLeft={handleRowLeft}
              onError={setErrorMessage}
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => {
          impactLight();
          navigation.navigate("NewConversation");
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1 },
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
