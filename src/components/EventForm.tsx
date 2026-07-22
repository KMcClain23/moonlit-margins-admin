import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import DateTimeField from "./DateTimeField";
import {
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  REGISTRATION_TYPE_LABELS,
  TIER_LABELS,
  type Event,
  type EventInput,
  type EventStatus,
  type EventType,
  type RegistrationType,
  type TargetTier,
} from "../lib/eventsApi";

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];
const REGISTRATION_TYPES = Object.keys(REGISTRATION_TYPE_LABELS) as RegistrationType[];
const STATUSES = Object.keys(EVENT_STATUS_LABELS) as EventStatus[];
const TIERS = Object.keys(TIER_LABELS) as TargetTier[];

export default function EventForm({
  initialValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  errorMessage,
}: {
  initialValues?: Event;
  onSubmit: (input: EventInput) => void;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const isEditing = Boolean(initialValues);

  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [eventType, setEventType] = useState<EventType>(initialValues?.eventType ?? "reading_sprint");
  const [startsAt, setStartsAt] = useState(initialValues?.startsAt ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [linkUrl, setLinkUrl] = useState(initialValues?.linkUrl ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(initialValues?.coverImageUrl ?? "");
  const [registrationType, setRegistrationType] = useState<RegistrationType>(
    initialValues?.registrationType ?? "rsvp"
  );
  const [status, setStatus] = useState<EventStatus>(initialValues?.status ?? "scheduled");
  const [isPrivate, setIsPrivate] = useState(initialValues?.isPrivate ?? false);
  const [targetTiers, setTargetTiers] = useState<string[]>(initialValues?.targetTiers ?? []);

  const canSubmit = title.trim().length >= 2 && startsAt.length > 0 && !isSubmitting;

  function toggleTier(tier: TargetTier) {
    setTargetTiers((current) =>
      current.includes(tier) ? current.filter((t) => t !== tier) : [...current, tier]
    );
  }

  function handleSubmit() {
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      eventType,
      startsAt,
      location: location.trim(),
      linkUrl: linkUrl.trim(),
      coverImageUrl: coverImageUrl.trim(),
      registrationType,
      status,
      isPrivate,
      targetTiers: isPrivate ? targetTiers : [],
    });
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

      <Text style={styles.label}>Type</Text>
      <View style={styles.chipRow}>
        {EVENT_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.chip, eventType === type && styles.chipActive]}
            onPress={() => setEventType(type)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipText, eventType === type && styles.chipTextActive]}>
              {EVENT_TYPE_LABELS[type]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.fieldSpacing}>
        <DateTimeField label="Starts at" value={startsAt} onChange={setStartsAt} disabled={isSubmitting} />
      </View>

      <Text style={styles.label}>Location (or "Virtual")</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} editable={!isSubmitting} />

      <Text style={styles.label}>Link (TikTok Live, Zoom, etc.)</Text>
      <TextInput
        style={styles.input}
        value={linkUrl}
        onChangeText={setLinkUrl}
        autoCapitalize="none"
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Cover image URL (optional)</Text>
      <TextInput
        style={styles.input}
        value={coverImageUrl}
        onChangeText={setCoverImageUrl}
        autoCapitalize="none"
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Registration</Text>
      <View style={styles.chipRow}>
        {REGISTRATION_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.chip, registrationType === type && styles.chipActive]}
            onPress={() => setRegistrationType(type)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipText, registrationType === type && styles.chipTextActive]}>
              {REGISTRATION_TYPE_LABELS[type]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Status</Text>
      <View style={styles.chipRow}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, status === s && styles.chipActive]}
            onPress={() => setStatus(s)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
              {EVENT_STATUS_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.checkboxRow} onPress={() => setIsPrivate((v) => !v)} disabled={isSubmitting}>
        <View style={[styles.checkbox, isPrivate && styles.checkboxChecked]} />
        <Text style={styles.checkboxLabel}>
          Private event (hidden from the public listing; still reachable via direct link)
        </Text>
      </Pressable>

      {isPrivate ? (
        <View style={styles.tierCard}>
          <Text style={styles.tierCardLabel}>
            Which tiers should be emailed the details? (Only members with an email on file will
            actually receive it.)
          </Text>
          <View style={styles.chipRow}>
            {TIERS.map((tier) => (
              <Pressable
                key={tier}
                style={[styles.chip, targetTiers.includes(tier) && styles.chipActive]}
                onPress={() => toggleTier(tier)}
                disabled={isSubmitting}
              >
                <Text style={[styles.chipText, targetTiers.includes(tier) && styles.chipTextActive]}>
                  {TIER_LABELS[tier]}
                </Text>
              </Pressable>
            ))}
          </View>
          {isEditing ? (
            <Text style={styles.tierNote}>
              Changing tiers here does not re-send invite emails -- those only go out once, when
              the event is first created.
            </Text>
          ) : null}
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>{submitLabel}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  fieldSpacing: { marginTop: 18 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipText: { fontSize: 13, color: "#333" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  checkboxChecked: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  checkboxLabel: { flex: 1, fontSize: 13, color: "#444", lineHeight: 18 },
  tierCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#f5f5f7",
  },
  tierCardLabel: { fontSize: 13, color: "#555", marginBottom: 10, lineHeight: 18 },
  tierNote: { fontSize: 12, color: "#888", marginTop: 10, lineHeight: 17 },
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
