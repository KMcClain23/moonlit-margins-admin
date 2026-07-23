import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import { updateEvent, type EventInput } from "../lib/eventsApi";
import { ApiError } from "../lib/apiError";
import type { EventsStackParamList } from "../navigation/RootNavigator";
import EventForm from "../components/EventForm";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<EventsStackParamList, "EditEvent">;
type EditRoute = RouteProp<EventsStackParamList, "EditEvent">;

export default function EditEventScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<EditRoute>();
  const { event } = route.params;
  const { session } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Double-guard: EventDetailScreen's "Edit" button is already hidden
  // without "events" in session.sections, but block the screen itself too
  // in case something ever navigates here directly.
  if (!session?.sections.includes("events")) {
    return (
      <View style={styles.centered}>
        <Text style={styles.blockedText}>You don't have permission to edit events.</Text>
      </View>
    );
  }

  async function handleSubmit(input: EventInput) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await updateEvent(event.id, input);
      navigation.goBack();
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not save those changes.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <EventForm
      initialValues={event}
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
