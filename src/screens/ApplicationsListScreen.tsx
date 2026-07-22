import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  listApplications,
  type Application,
  type ApplicationKind,
  type ApplicationView,
} from "../lib/applicationsApi";
import { ApiError } from "../lib/apiError";
import type { ApplicationsStackParamList } from "../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<ApplicationsStackParamList, "ApplicationsList">;
type KindFilter = "all" | ApplicationKind;

// "collab" always reads as "Partner" in the UI, matching the web admin's
// KIND_LABELS convention.
const KIND_LABELS: Record<ApplicationKind, string> = {
  member: "Membership",
  interview: "Interview",
  collab: "Partner",
};

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "member", label: "Membership" },
  { value: "interview", label: "Interview" },
  { value: "collab", label: "Partner" },
];

const STATUS_LABELS: Record<Application["status"], string> = {
  pending: "Pending",
  in_review: "In review",
  accepted: "Accepted",
  declined: "Declined",
};

function formatCreatedDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ApplicationsListScreen() {
  const navigation = useNavigation<Nav>();
  const [view, setView] = useState<ApplicationView>("active");
  const [kind, setKind] = useState<KindFilter>("all");
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);
      try {
        setApplications(await listApplications(kind, view));
      } catch (err) {
        setErrorMessage(err instanceof ApiError ? err.message : "Could not load applications.");
      } finally {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    },
    [kind, view]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        {(["active", "archived"] as ApplicationView[]).map((v) => (
          <Pressable
            key={v}
            style={[styles.toggleChip, view === v && styles.toggleChipActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.toggleChipText, view === v && styles.toggleChipTextActive]}>
              {v === "active" ? "Active" : "Archived"}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.filterRow}>
        {KIND_FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[styles.filterChip, kind === f.value && styles.filterChipActive]}
            onPress={() => setKind(f.value)}
          >
            <Text style={[styles.filterChipText, kind === f.value && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={applications.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <Text style={styles.emptyText}>No applications here.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("ApplicationDetail", { applicationId: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.fullName}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>{item.email}</Text>
            {item.instagramHandle || item.tiktokHandle ? (
              <Text style={styles.handles}>
                {item.instagramHandle ? `IG: ${item.instagramHandle}` : ""}
                {item.instagramHandle && item.tiktokHandle ? " · " : ""}
                {item.tiktokHandle ? `TikTok: ${item.tiktokHandle}` : ""}
              </Text>
            ) : null}
            <View style={styles.footerRow}>
              <Text style={styles.kindLabel}>{KIND_LABELS[item.kind]}</Text>
              <Text style={styles.createdDate}>{formatCreatedDate(item.createdAt)}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f7" },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  toggleChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toggleChipActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  toggleChipText: { fontSize: 13, color: "#333", fontWeight: "500" },
  toggleChipTextActive: { color: "#fff", fontWeight: "600" },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 10 },
  filterChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: { backgroundColor: "#e4e4ee", borderColor: "#1a1a2e" },
  filterChipText: { fontSize: 12, color: "#555" },
  filterChipTextActive: { color: "#1a1a2e", fontWeight: "600" },
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
  rowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { fontSize: 16, fontWeight: "600", color: "#111", flexShrink: 1 },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  handles: { fontSize: 12, color: "#888", marginTop: 4 },
  badge: {
    backgroundColor: "#eee",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: "500", color: "#333" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  kindLabel: { fontSize: 12, color: "#1a1a2e", fontWeight: "500" },
  createdDate: { fontSize: 12, color: "#999" },
});
