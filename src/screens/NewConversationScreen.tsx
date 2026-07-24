import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  createConversation,
  listAdminUsers,
  listConversations,
  type AdminUserSummary,
} from "../lib/messagesApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import type { MessagesStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MessagesStackParamList, "NewConversation">;
type ConversationKind = "direct" | "group";

export default function NewConversationScreen() {
  const navigation = useNavigation<Nav>();

  const [type, setType] = useState<ConversationKind>("direct");
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAdminUsers()
      .then((data) => {
        if (cancelled) return;
        setUsers(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setUsersError(err instanceof ApiError ? err.message : "Could not load teammates.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function selectType(next: ConversationKind) {
    setType(next);
    // A direct conversation is with exactly one person -- switching from
    // group to direct with more than one already picked would otherwise
    // silently submit only the first of them.
    if (next === "direct" && selectedIds.length > 1) {
      setSelectedIds(selectedIds.slice(0, 1));
    }
  }

  function toggleUser(userId: string) {
    if (type === "direct") {
      setSelectedIds([userId]);
      return;
    }
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  const canSubmit = selectedIds.length > 0 && !isSubmitting;

  async function handleSubmit() {
    impactLight();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const { conversationId } = await createConversation(
        type,
        selectedIds,
        type === "group" ? title.trim() || undefined : undefined
      );
      // The server resolves the display title (other person's name for
      // direct, stored/"Untitled group" for group) -- fetch it back rather
      // than re-deriving that logic here, so it's guaranteed to match what
      // the conversations list would show for the same conversation.
      const conversations = await listConversations();
      const created = conversations.data.find((c) => c.id === conversationId);
      navigation.replace("ConversationDetail", {
        conversationId,
        title: created?.title ?? "Conversation",
      });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't start that conversation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={20}>
      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {(["direct", "group"] as ConversationKind[]).map((kind) => (
          <Pressable
            key={kind}
            style={[styles.chip, type === kind && styles.chipActive]}
            onPress={() => selectType(kind)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipText, type === kind && styles.chipTextActive]}>
              {kind === "direct" ? "Direct" : "Group"}
            </Text>
          </Pressable>
        ))}
      </View>

      {type === "group" ? (
        <>
          <Text style={styles.label}>Group name (optional)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            editable={!isSubmitting}
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}

      <Text style={styles.label}>{type === "direct" ? "Who with" : "Who's included"}</Text>
      {isLoadingUsers ? (
        <ActivityIndicator style={styles.usersLoading} color={colors.lilac.default} />
      ) : usersError ? (
        <Text style={styles.errorText}>{usersError}</Text>
      ) : users.length === 0 ? (
        <Text style={styles.emptyText}>No other teammates yet.</Text>
      ) : (
        <View style={styles.userList}>
          {users.map((user) => (
            <Pressable
              key={user.id}
              style={[styles.userRow, selectedIds.includes(user.id) && styles.userRowActive]}
              onPress={() => toggleUser(user.id)}
              disabled={isSubmitting}
            >
              <Text style={[styles.userRowText, selectedIds.includes(user.id) && styles.userRowTextActive]}>
                {user.fullName}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.submitButtonText}>Start conversation</Text>
        )}
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
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
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  chipActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  chipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.muted },
  chipTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  usersLoading: { marginTop: 12 },
  emptyText: { fontFamily: typography.body, color: colors.muted, fontSize: 13, marginTop: 8 },
  userList: { marginTop: 4 },
  userRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  userRowActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  userRowText: { fontFamily: typography.body, fontSize: 14, color: colors.parchment },
  userRowTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
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
