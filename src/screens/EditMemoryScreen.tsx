import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { updateMemory, type MemoryInput } from "../lib/memoriesApi";
import { ApiError } from "../lib/apiError";
import { useToast } from "../lib/toastStore";
import type { MemoriesStackParamList } from "../navigation/RootNavigator";
import MemoryForm from "../components/MemoryForm";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MemoriesStackParamList, "EditMemory">;
type EditRoute = RouteProp<MemoriesStackParamList, "EditMemory">;

export default function EditMemoryScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditRoute>();
  const { memory } = route.params;
  const { session } = useAuth();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Double-guard: MemoryDetailScreen's "Edit" button is already hidden
  // without "memories" in session.sections, but block the screen itself
  // too in case something ever navigates here directly.
  if (!session?.sections.includes("memories")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to edit memories.</Text>
      </View>
    );
  }

  async function handleSubmit(input: MemoryInput) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updateMemory(memory.id, input);
      showToast("Memory updated");
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not save those changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MemoryForm
      initialValues={memory}
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
