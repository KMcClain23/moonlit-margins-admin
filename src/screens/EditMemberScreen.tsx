import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { updateMember, type MemberInput } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import { useToast } from "../lib/toastStore";
import type { MembersStackParamList } from "../navigation/RootNavigator";
import MemberForm from "../components/MemberForm";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MembersStackParamList, "EditMember">;
type EditRoute = RouteProp<MembersStackParamList, "EditMember">;

export default function EditMemberScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditRoute>();
  const { member } = route.params;
  const { session } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Double-guard: MemberDetailScreen's "Edit" button is already hidden
  // without "members" in session.sections, but block the screen itself too
  // in case something ever navigates here directly.
  if (!session?.sections.includes("members")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to edit members.</Text>
      </View>
    );
  }

  async function handleSubmit(input: MemberInput) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updateMember(member.id, input);
      showToast("Member updated");
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not save those changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MemberForm
      initialValues={member}
      onSubmit={handleSubmit}
      submitLabel="Save changes"
      isSubmitting={isSubmitting}
      errorMessage={errorMessage}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  blockedText: { fontFamily: typography.body, fontSize: 15, color: colors.muted, textAlign: "center" },
});
