import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { createMemory, type MemoryInput } from "../lib/memoriesApi";
import { ApiError } from "../lib/apiError";
import type { MemoriesStackParamList } from "../navigation/RootNavigator";
import MemoryForm from "../components/MemoryForm";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<MemoriesStackParamList, "CreateMemory">;

export default function CreateMemoryScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Double-guard: the "+" button that gets here is already hidden without
  // "memories" in session.sections, but block the screen itself too in
  // case something ever navigates here directly.
  if (!session?.sections.includes("memories")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to add memories.</Text>
      </View>
    );
  }

  async function handleSubmit(input: MemoryInput) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await createMemory(input);
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not add that memory.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <MemoryForm onSubmit={handleSubmit} submitLabel="Add memory" isSubmitting={isSubmitting} errorMessage={errorMessage} />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  blockedText: { fontFamily: typography.body, fontSize: 15, color: colors.muted, textAlign: "center" },
});
