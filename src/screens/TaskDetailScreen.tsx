import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { deleteTask, listTasks, respondToTask, updateTaskStatus, type Task, type TaskStatus } from "../lib/tasksApi";
import { ApiError } from "../lib/apiError";
import type { TasksStackParamList } from "../navigation/RootNavigator";
import DateField from "../components/DateField";

type Nav = NativeStackNavigationProp<TasksStackParamList, "TaskDetail">;
type DetailRoute = RouteProp<TasksStackParamList, "TaskDetail">;

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export default function TaskDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { taskId } = route.params;
  const { session } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [proposedDate, setProposedDate] = useState("");
  const [proposeMessage, setProposeMessage] = useState("");

  // There's no single-task GET endpoint -- this reuses the same list the
  // Tasks tab already fetches and finds this one by id, which also
  // conveniently gives us a fresh copy after every accept/propose/
  // approve/reject/status action below.
  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const tasks = await listTasks();
      const found = tasks.find((t) => t.id === taskId) ?? null;
      setTask(found);
      if (!found) {
        setLoadError("This task couldn't be found -- it may have been deleted.");
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this task.");
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    setIsSubmitting(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleAccept() {
    void runAction(() => respondToTask(taskId, "accept"));
  }

  function handleSendProposal() {
    if (!proposedDate.trim()) {
      setActionError("Select a proposed date.");
      return;
    }
    void runAction(async () => {
      await respondToTask(taskId, "propose", proposedDate.trim(), proposeMessage.trim() || undefined);
      setIsProposing(false);
      setProposedDate("");
      setProposeMessage("");
    });
  }

  function handleApprove() {
    void runAction(() => respondToTask(taskId, "approve_proposal"));
  }

  function handleReject() {
    void runAction(() => respondToTask(taskId, "reject_proposal"));
  }

  function handleStatusChange(nextStatus: TaskStatus) {
    if (!task) return;
    void runAction(() => updateTaskStatus(task, nextStatus));
  }

  function handleDelete() {
    if (!task) return;
    Alert.alert("Delete task", `Delete "${task.title}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void runAction(async () => {
            await deleteTask(taskId);
            navigation.goBack();
          });
        },
      },
    ]);
  }

  if (isLoading && !task) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? "Task not found."}</Text>
      </View>
    );
  }

  const isActualAssignee = Boolean(session?.memberId) && session?.memberId === task.assignedTo;
  const canActOnBehalf = (session?.role === "owner" || session?.role === "admin") && !task.assigneeHasLogin;
  const canRespondAsAssignee = isActualAssignee || canActOnBehalf;
  const canRespondAsAssigner =
    !isActualAssignee && (session?.adminUserId === task.assignedBy || session?.role === "owner");

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{task.title}</Text>
      {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Assigned to</Text>
        <Text style={styles.metaValue}>{task.assigneeName ?? "Unassigned"}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Created by</Text>
        <Text style={styles.metaValue}>{task.assignerName}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Due</Text>
        <Text style={styles.metaValue}>{task.dueDate ?? "No due date"}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Status</Text>
        <Text style={styles.metaValue}>{STATUS_LABELS[task.status]}</Text>
      </View>

      {session?.canAssignTasks ? (
        <Pressable
          style={styles.editButton}
          onPress={() => navigation.navigate("EditTask", { taskId })}
          disabled={isSubmitting}
        >
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {task.acceptanceStatus === "pending" && canRespondAsAssignee ? (
        isProposing ? (
          <View style={styles.card}>
            <DateField
              label="Proposed date"
              value={proposedDate}
              onChange={setProposedDate}
              disabled={isSubmitting}
              minimumDate={new Date()}
            />
            <Text style={styles.cardLabel}>Message (optional)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={proposeMessage}
              onChangeText={setProposeMessage}
              editable={!isSubmitting}
            />
            <View style={styles.buttonRow}>
              <Pressable style={styles.primaryButton} onPress={handleSendProposal} disabled={isSubmitting}>
                <Text style={styles.primaryButtonText}>{isSubmitting ? "Sending…" : "Send proposal"}</Text>
              </Pressable>
              <Pressable onPress={() => setIsProposing(false)} disabled={isSubmitting}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryButton} onPress={handleAccept} disabled={isSubmitting}>
              <Text style={styles.primaryButtonText}>Accept</Text>
            </Pressable>
            <Pressable onPress={() => setIsProposing(true)} disabled={isSubmitting}>
              <Text style={styles.secondaryButtonText}>Propose new date</Text>
            </Pressable>
          </View>
        )
      ) : null}

      {task.acceptanceStatus === "proposed_change" && canRespondAsAssigner ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Proposed date</Text>
          <Text style={styles.metaValue}>{task.proposedDueDate ?? "—"}</Text>
          {task.responseMessage ? (
            <>
              <Text style={styles.cardLabel}>Message</Text>
              <Text style={styles.metaValue}>“{task.responseMessage}”</Text>
            </>
          ) : null}
          <View style={styles.buttonRow}>
            <Pressable style={styles.primaryButton} onPress={handleApprove} disabled={isSubmitting}>
              <Text style={styles.primaryButtonText}>Approve new date</Text>
            </Pressable>
            <Pressable onPress={handleReject} disabled={isSubmitting}>
              <Text style={styles.secondaryButtonText}>Keep original date</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {task.acceptanceStatus === "accepted" && isActualAssignee ? (
        <View style={styles.buttonRow}>
          {STATUS_ORDER.map((s) => (
            <Pressable
              key={s}
              style={[styles.statusChip, task.status === s && styles.statusChipActive]}
              onPress={() => handleStatusChange(s)}
              disabled={isSubmitting || task.status === s}
            >
              <Text style={[styles.statusChipText, task.status === s && styles.statusChipTextActive]}>
                {STATUS_LABELS[s]}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {session?.canAssignTasks ? (
        <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isSubmitting}>
          <Text style={styles.deleteButtonText}>Delete task</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: 24 },
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  title: { fontSize: 22, fontWeight: "700", color: "#111" },
  description: { fontSize: 15, color: "#444", marginTop: 8, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    marginTop: 4,
  },
  metaLabel: { fontSize: 13, color: "#888" },
  metaValue: { fontSize: 13, color: "#222", fontWeight: "500", flexShrink: 1, textAlign: "right" },
  errorText: { color: "#c0392b", fontSize: 14, marginTop: 16, textAlign: "center" },
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f7",
  },
  cardLabel: { fontSize: 12, color: "#777", marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 20, flexWrap: "wrap" },
  primaryButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  secondaryButtonText: { color: "#1a1a2e", fontSize: 14, fontWeight: "500" },
  statusChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  statusChipActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  statusChipText: { fontSize: 13, color: "#333" },
  statusChipTextActive: { color: "#fff", fontWeight: "600" },
  deleteButton: { marginTop: 32, alignItems: "center", paddingVertical: 10 },
  deleteButtonText: { color: "#c0392b", fontSize: 14, fontWeight: "600" },
  editButton: {
    marginTop: 20,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#1a1a2e",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  editButtonText: { color: "#1a1a2e", fontSize: 14, fontWeight: "600" },
});
