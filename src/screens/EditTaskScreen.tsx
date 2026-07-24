import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { listTasks, updateTask, type Task, type TaskEditAssignment, type TaskStatus } from "../lib/tasksApi";
import { listMembers, type Member } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { useToast } from "../lib/toastStore";
import type { TasksStackParamList } from "../navigation/RootNavigator";
import DateField from "../components/DateField";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

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
  const { showToast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [isLoadingTask, setIsLoadingTask] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [assignMode, setAssignMode] = useState<AssignMode>("unassigned");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // No single-task GET endpoint -- same approach as TaskDetailScreen:
  // fetch the list and find this one by id, then pre-fill the form.
  useEffect(() => {
    let cancelled = false;
    listTasks()
      .then((result) => {
        if (cancelled) return;
        const found = result.data.find((t) => t.id === taskId) ?? null;
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
      .then((result) => {
        if (cancelled) return;
        setMembers(result.data);
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
        <ActivityIndicator size="large" color={colors.lilac.default} />
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
    impactLight();
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
      showToast("Task updated");
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not save those changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={20}>
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={description}
        onChangeText={setDescription}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
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
          <ActivityIndicator style={styles.memberLoading} color={colors.lilac.default} />
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
        {isSubmitting ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.submitButtonText}>Save changes</Text>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  blockedText: { fontFamily: typography.body, fontSize: 15, color: colors.muted, textAlign: "center" },
  container: { padding: 20, backgroundColor: colors.ink, flexGrow: 1 },
  label: { fontFamily: typography.mono, fontSize: 12, color: colors.muted, marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.parchment,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  dueDateField: { marginTop: 18 },
  modeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  modeChip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modeChipActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  modeChipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.muted },
  modeChipTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  memberLoading: { marginTop: 16 },
  memberList: { marginTop: 12 },
  memberRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  memberRowActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  memberRowText: { fontFamily: typography.body, fontSize: 14, color: colors.parchment },
  memberRowTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  submitButton: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontFamily: typography.bodySemibold, color: colors.ink, fontSize: 16 },
});
