import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listEvents, tierLabel, type Event } from "../lib/eventsApi";
import { ApiError } from "../lib/apiError";
import type { EventsStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<EventsStackParamList, "EventsList">;

function formatEventDateTime(startsAt: string): string {
  return new Date(startsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function privateBadgeLabel(event: Event): string {
  if (!event.targetTiers || event.targetTiers.length === 0) return "Private";
  return `Private: ${event.targetTiers.map(tierLabel).join(", ")}`;
}

export default function EventsListScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      setEvents(await listEvents());
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load events.");
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

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        contentContainerStyle={events.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <Text style={styles.emptyText}>No events yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>
              {formatEventDateTime(item.startsAt)}
              {item.location ? ` · ${item.location}` : ""}
            </Text>
            {item.status === "canceled" || item.registrationType === "ticketing" || item.isPrivate ? (
              <View style={styles.badgeRow}>
                {item.status === "canceled" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Canceled</Text>
                  </View>
                ) : null}
                {item.registrationType === "ticketing" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Ticketed</Text>
                  </View>
                ) : null}
                {item.isPrivate ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{privateBadgeLabel(item)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Pressable>
        )}
      />

      {session?.sections.includes("events") ? (
        <Pressable style={styles.fab} onPress={() => navigation.navigate("CreateEvent")}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { color: "#777", fontSize: 15 },
  errorText: { color: "#c0392b", fontSize: 15, textAlign: "center", paddingHorizontal: 24 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  badge: {
    backgroundColor: "#eee",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "500", color: "#333" },
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
