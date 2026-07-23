import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listTasks, type Task } from "../lib/tasksApi";
import { ApiError } from "../lib/apiError";
import type { TasksStackParamList } from "../navigation/RootNavigator";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";

type Nav = NativeStackNavigationProp<TasksStackParamList, "TasksList">;

const STATUS_LABELS: Record<Task["status"], string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const ACCEPTANCE_LABELS: Record<Task["acceptanceStatus"], string> = {
  pending: "Awaiting response",
  accepted: "Accepted",
  proposed_change: "New date proposed",
};

function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return dueDate;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function TasksListScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
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
      setTasks(await listTasks());
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load tasks.");
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
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={tasks.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.emptyText}>Loading…</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <EmptyState message="No tasks yet." />
          )
        }
        renderItem={({ item }) => {
          const isMine = Boolean(session?.memberId) && session?.memberId === item.assignedTo;
          return (
            <Pressable
              style={[styles.row, isMine && styles.rowMine]}
              onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.assigneeName ?? "Unassigned"}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{STATUS_LABELS[item.status]}</Text>
                </View>
                {item.acceptanceStatus !== "accepted" ? (
                  <View style={[styles.badge, styles.badgeAttention]}>
                    <Text style={[styles.badgeText, styles.badgeAttentionText]}>
                      {ACCEPTANCE_LABELS[item.acceptanceStatus]}
                    </Text>
                  </View>
                ) : null}
              </View>
              {item.dueDate ? <Text style={styles.dueDate}>Due {formatDueDate(item.dueDate)}</Text> : null}
            </Pressable>
          );
        }}
      />

      {session?.canAssignTasks ? (
        <Pressable style={styles.fab} onPress={() => navigation.navigate("CreateTask")}>
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
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
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  rowMine: {
    borderLeftColor: colors.lilac.default,
  },
  title: { fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment },
  subtitle: { fontFamily: typography.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" },
  badge: {
    backgroundColor: withAlpha(colors.lilac.default, 0.15),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeAttention: { backgroundColor: withAlpha(colors.candle.default, 0.15) },
  badgeText: { fontFamily: typography.mono, fontSize: 11, color: colors.lilac.soft },
  badgeAttentionText: { color: colors.candle.soft },
  dueDate: { fontFamily: typography.body, fontSize: 12, color: colors.muted, marginTop: 8 },
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
