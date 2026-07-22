import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listTasks, updateTask, type Task, type TaskEditAssignment, type TaskStatus } from "../lib/tasksApi";
import { listMembers, type MemberOption } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import type { TasksStackParamList } from "../navigation/RootNavigator";
import DateField from "../components/DateField";

type Nav = NativeStackNavigationProp<TasksStackParamList, "EditTask">;
type EditRoute = RouteProp<TasksStackParamList, "EditTask">;
type AssignMode = "member" | "unassigned";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done"];
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export default function EditTaskScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditRoute>();
  const { taskId } = route.params;
  const { session } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assignMode, setAssignMode] = useState<AssignMode>("unassigned");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // No single-task GET endpoint -- same approach as TaskDetailScreen:
  // fetch the list and find this one by id, then pre-fill the form.
  useEffect(() => {
    let cancelled = false;
    listTasks()
      .then((tasks) => {
        if (cancelled) return;
        const found = tasks.find((t) => t.id === taskId) ?? null;
        setTask(found);
        if (found) {
          setTitle(found.title);
          setDescription(found.description ?? "");
          setDueDate(found.dueDate ?? "");
          setStatus(found.status);
          if (found.assignedTo) {
            setAssignMode("member");
            setSelectedMemberId(found.assignedTo);
          } else {
            setAssignMode("unassigned");
            setSelectedMemberId(null);
          }
        } else {
          setLoadError("This task couldn't be found -- it may have been deleted.");
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.message : "Could not load this task.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTask(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    listMembers()
      .then((data) => {
        if (cancelled) return;
        setMembers(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMembersError(err instanceof ApiError ? err.message : "Could not load members.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Double-guard: TaskDetailScreen already hides the "Edit" button without
  // canAssignTasks, but block the screen itself too in case something ever
  // navigates here directly.
  if (!session?.canAssignTasks) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to edit tasks.</Text>
      </View>
    );
  }

  if (isLoadingTask) {
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

  const canSubmit =
    title.trim().length >= 2 && !isSubmitting && (assignMode !== "member" || Boolean(selectedMemberId));

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const assignment: TaskEditAssignment =
      assignMode === "member" ? { mode: "member", memberId: selectedMemberId! } : { mode: "unassigned" };

    try {
      await updateTask(taskId, {
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        status,
        assignment,
      });
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not save those changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} editable={!isSubmitting} />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={!isSubmitting}
      />

      <View style={styles.dueDateField}>
        <DateField
          label="Due date (optional)"
          value={dueDate}
          onChange={setDueDate}
          disabled={isSubmitting}
          allowClear
        />
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.modeRow}>
        {STATUS_ORDER.map((s) => (
          <Pressable
            key={s}
            style={[styles.modeChip, status === s && styles.modeChipActive]}
            onPress={() => setStatus(s)}
            disabled={isSubmitting}
          >
            <Text style={[styles.modeChipText, status === s && styles.modeChipTextActive]}>
              {STATUS_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Assign to</Text>
      <View style={styles.modeRow}>
        {(["member", "unassigned"] as AssignMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, assignMode === mode && styles.modeChipActive]}
            onPress={() => setAssignMode(mode)}
            disabled={isSubmitting}
          >
            <Text style={[styles.modeChipText, assignMode === mode && styles.modeChipTextActive]}>
              {mode === "member" ? "Specific member" : "Unassigned"}
            </Text>
          </Pressable>
        ))}
      </View>

      {assignMode === "member" ? (
        isLoadingMembers ? (
          <ActivityIndicator style={styles.memberLoading} />
        ) : membersError ? (
          <Text style={styles.errorText}>{membersError}</Text>
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                style={[styles.memberRow, selectedMemberId === member.id && styles.memberRowActive]}
                onPress={() => setSelectedMemberId(member.id)}
                disabled={isSubmitting}
              >
                <Text
                  style={[styles.memberRowText, selectedMemberId === member.id && styles.memberRowTextActive]}
                >
                  {member.fullName}
                </Text>
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save changes</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", padding: 24 },
  blockedText: { fontSize: 15, color: "#555", textAlign: "center" },
  container: { padding: 20, backgroundColor: "#fff", flexGrow: 1 },
  label: { fontSize: 13, color: "#777", marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  dueDateField: { marginTop: 18 },
  modeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modeChip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modeChipActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  modeChipText: { fontSize: 13, color: "#333" },
  modeChipTextActive: { color: "#fff", fontWeight: "600" },
  memberLoading: { marginTop: 16 },
  memberList: { marginTop: 12 },
  memberRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: "#f5f5f7",
  },
  memberRowActive: { backgroundColor: "#1a1a2e" },
  memberRowText: { fontSize: 14, color: "#222" },
  memberRowTextActive: { color: "#fff", fontWeight: "600" },
  errorText: { color: "#c0392b", fontSize: 14, marginTop: 16, textAlign: "center" },
  submitButton: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
