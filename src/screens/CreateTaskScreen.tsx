import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { createTask, type TaskAssignment } from "../lib/tasksApi";
import { listMembers, type MemberOption } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import type { TasksStackParamList } from "../navigation/RootNavigator";
import DateField from "../components/DateField";

type Nav = NativeStackNavigationProp<TasksStackParamList, "CreateTask">;
type AssignMode = "member" | "all" | "leadership";

export default function CreateTaskScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignMode, setAssignMode] = useState<AssignMode>("member");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  // Double-guard: the "+" button that gets here is already hidden without
  // canAssignTasks, but block the screen itself too in case something
  // ever navigates here directly.
  if (!session?.canAssignTasks) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to create tasks.</Text>
      </View>
    );
  }

  const canSubmit =
    title.trim().length >= 2 && !isSubmitting && (assignMode !== "member" || Boolean(selectedMemberId));

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);

    const assignment: TaskAssignment =
      assignMode === "member"
        ? { mode: "member", memberId: selectedMemberId! }
        : { mode: "group", group: assignMode };

    try {
      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        assignment,
      });
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not create that task.");
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

      <Text style={styles.label}>Assign to</Text>
      <View style={styles.modeRow}>
        {(["member", "all", "leadership"] as AssignMode[]).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, assignMode === mode && styles.modeChipActive]}
            onPress={() => setAssignMode(mode)}
            disabled={isSubmitting}
          >
            <Text style={[styles.modeChipText, assignMode === mode && styles.modeChipTextActive]}>
              {mode === "member" ? "Specific member" : mode === "all" ? "Everyone" : "Leadership"}
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
      ) : (
        <Text style={styles.groupNote}>
          {assignMode === "all"
            ? "Creates a separate copy of this task for every roster member."
            : "Creates a separate copy of this task for Founder/Council/Junior council."}
        </Text>
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Create task</Text>}
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
  groupNote: { fontSize: 13, color: "#777", marginTop: 12, lineHeight: 19 },
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
