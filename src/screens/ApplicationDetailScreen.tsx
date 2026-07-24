import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  deleteApplication,
  listApplications,
  updateApplicationStatus,
  type Application,
  type ApplicationStatus,
} from "../lib/applicationsApi";
import { ApiError } from "../lib/apiError";
import { impactLight, impactMedium } from "../lib/haptics";
import { useToast } from "../lib/toastStore";
import type { ApplicationsStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<ApplicationsStackParamList, "ApplicationDetail">;
type DetailRoute = RouteProp<ApplicationsStackParamList, "ApplicationDetail">;

const KIND_LABELS: Record<Application["kind"], string> = {
  member: "Membership",
  interview: "Interview",
  collab: "Partner",
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  accepted: "Accepted",
  declined: "Declined",
};

// Matches the web admin's key.replace(/([A-Z])/g, " $1") exactly, so an
// answer key like "whyJoin" reads as "why Join" in both places.
function humanizeAnswerKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1");
}

export default function ApplicationDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { applicationId } = route.params;
  const { showToast } = useToast();

  const [application, setApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // There's no single-application GET endpoint, and the list endpoint's
  // "view" param only ever covers one of active/archived at a time -- so
  // fetch both views and find this one by id, whichever it's currently in.
  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [active, archived] = await Promise.all([
        listApplications("all", "active"),
        listApplications("all", "archived"),
      ]);
      const found = [...active.data, ...archived.data].find((a) => a.id === applicationId) ?? null;
      setApplication(found);
      if (!found) {
        setLoadError("This application couldn't be found -- it may have been deleted.");
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this application.");
    } finally {
      setIsLoading(false);
    }
  }, [applicationId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function runAction(fn: () => Promise<unknown>, successMessage?: string) {
    setActionError(null);
    setIsSubmitting(true);
    try {
      await fn();
      await load();
      if (successMessage) showToast(successMessage);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStatusChange(next: ApplicationStatus) {
    impactLight();
    void runAction(() => updateApplicationStatus(applicationId, next), `Status updated to ${STATUS_LABELS[next]}`);
  }

  function handleDelete() {
    if (!application) return;
    Alert.alert(
      "Delete application",
      `Delete ${application.fullName}'s application? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            impactMedium();
            void runAction(async () => {
              await deleteApplication(applicationId);
              navigation.goBack();
            });
          },
        },
      ]
    );
  }

  if (isLoading && !application) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.lilac.default} />
      </View>
    );
  }

  if (!application) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? "Application not found."}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{application.fullName}</Text>
      <Text style={styles.subtitle}>{application.email}</Text>
      {application.instagramHandle || application.tiktokHandle ? (
        <Text style={styles.handles}>
          {application.instagramHandle ? `IG: ${application.instagramHandle}` : ""}
          {application.instagramHandle && application.tiktokHandle ? " · " : ""}
          {application.tiktokHandle ? `TikTok: ${application.tiktokHandle}` : ""}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Kind</Text>
        <Text style={styles.metaValue}>{KIND_LABELS[application.kind]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Status</Text>
        <Text style={styles.metaValue}>{STATUS_LABELS[application.status]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Submitted</Text>
        <Text style={styles.metaValue}>
          {new Date(application.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </View>

      <View style={styles.answers}>
        {Object.entries(application.answers).map(([key, value]) => (
          <View key={key} style={styles.answerBlock}>
            <Text style={styles.answerKey}>{humanizeAnswerKey(key)}</Text>
            <Text style={styles.answerValue}>{value || "Not answered"}</Text>
          </View>
        ))}
      </View>

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.actionChip, application.status === "in_review" && styles.actionChipActive]}
          onPress={() => handleStatusChange("in_review")}
          disabled={isSubmitting}
        >
          <Text
            style={[
              styles.actionChipText,
              application.status === "in_review" && styles.actionChipTextActive,
            ]}
          >
            Mark in review
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionChip, application.status === "accepted" && styles.actionChipActive]}
          onPress={() => handleStatusChange("accepted")}
          disabled={isSubmitting}
        >
          <Text
            style={[styles.actionChipText, application.status === "accepted" && styles.actionChipTextActive]}
          >
            Accept
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionChip, application.status === "declined" && styles.actionChipActive]}
          onPress={() => handleStatusChange("declined")}
          disabled={isSubmitting}
        >
          <Text
            style={[styles.actionChipText, application.status === "declined" && styles.actionChipTextActive]}
          >
            Decline
          </Text>
        </Pressable>
      </View>

      <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isSubmitting}>
        <Text style={styles.deleteButtonText}>Delete application</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  container: { padding: 20, backgroundColor: colors.ink, flexGrow: 1 },
  title: { fontFamily: typography.display, fontSize: 22, color: colors.parchment },
  subtitle: { fontFamily: typography.body, fontSize: 14, color: colors.muted, marginTop: 4 },
  handles: { fontFamily: typography.body, fontSize: 13, color: colors.muted, marginTop: 4 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginTop: 12,
  },
  metaLabel: { fontFamily: typography.mono, fontSize: 12, color: colors.muted },
  metaValue: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    color: colors.parchment,
    flexShrink: 1,
    textAlign: "right",
  },
  answers: { marginTop: 20 },
  answerBlock: { marginBottom: 14 },
  answerKey: { fontFamily: typography.mono, fontSize: 11, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  answerValue: { fontFamily: typography.body, fontSize: 14, color: colors.parchment, marginTop: 4, lineHeight: 20 },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 12 },
  actionChip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionChipActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  actionChipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.muted },
  actionChipTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  deleteButton: { marginTop: 32, alignItems: "center", paddingVertical: 10 },
  deleteButtonText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 14 },
});
