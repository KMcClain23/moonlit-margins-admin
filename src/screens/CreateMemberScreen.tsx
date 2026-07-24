import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { createMember, type MemberInput } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import type { MembersStackParamList } from "../navigation/RootNavigator";
import MemberForm from "../components/MemberForm";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MembersStackParamList, "CreateMember">;

export default function CreateMemberScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Double-guard: the "+" button that gets here is already hidden without
  // "members" in session.sections, but block the screen itself too in case
  // something ever navigates here directly.
  if (!session?.sections.includes("members")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to add members.</Text>
      </View>
    );
  }

  async function handleSubmit(input: MemberInput) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createMember(input);
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not add that member.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MemberForm onSubmit={handleSubmit} submitLabel="Add member" isSubmitting={isSubmitting} errorMessage={errorMessage} />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  blockedText: { fontFamily: typography.body, fontSize: 15, color: colors.muted, textAlign: "center" },
});
