import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listTasks, type Task } from "../lib/tasksApi";
import { ApiError } from "../lib/apiError";
import type { TasksStackParamList } from "../navigation/RootNavigator";

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
            <Text style={styles.emptyText}>No tasks yet.</Text>
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
                  <View style={[styles.badge, styles.badgeMuted]}>
                    <Text style={styles.badgeText}>{ACCEPTANCE_LABELS[item.acceptanceStatus]}</Text>
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
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
  },
  rowMine: {
    borderLeftColor: "#1a1a2e",
  },
  title: { fontSize: 16, fontWeight: "600", color: "#111" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  badge: {
    backgroundColor: "#eee",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeMuted: { backgroundColor: "#fdecea" },
  badgeText: { fontSize: 11, fontWeight: "500", color: "#333" },
  dueDate: { fontSize: 12, color: "#888", marginTop: 8 },
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
