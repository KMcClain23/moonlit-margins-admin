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
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";

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

const STATUS_COLORS: Record<Application["status"], string> = {
  pending: colors.candle.default,
  in_review: colors.lilac.default,
  accepted: colors.lilac.soft,
  declined: colors.muted,
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
            <EmptyState message="No applications here." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate("ApplicationDetail", { applicationId: item.id })}
          >
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.fullName}</Text>
              <View style={[styles.badge, { backgroundColor: withAlpha(STATUS_COLORS[item.status], 0.15) }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
                  {STATUS_LABELS[item.status]}
                </Text>
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
  container: { flex: 1, backgroundColor: colors.ink },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  toggleChip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  toggleChipActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  toggleChipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.muted },
  toggleChipTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 10 },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: { backgroundColor: withAlpha(colors.lilac.default, 0.15), borderColor: colors.lilac.default },
  filterChipText: { fontFamily: typography.body, fontSize: 12, color: colors.muted },
  filterChipTextActive: { fontFamily: typography.bodySemibold, color: colors.lilac.default },
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
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  rowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  title: { fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment, flexShrink: 1 },
  subtitle: { fontFamily: typography.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  handles: { fontFamily: typography.body, fontSize: 12, color: colors.muted, marginTop: 4 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: typography.mono, fontSize: 11 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  kindLabel: { fontFamily: typography.mono, fontSize: 11, color: colors.lilac.soft },
  createdDate: { fontFamily: typography.body, fontSize: 12, color: colors.muted },
});
