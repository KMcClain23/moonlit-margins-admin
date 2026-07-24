import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import PhotoPositioner from "./PhotoPositioner";
import { impactLight } from "../lib/haptics";
import { SOCIAL_PLATFORMS, type SocialPlatformKey, type SocialsMap } from "../lib/socials";
import type { Member, MemberInput, MemberTier } from "../lib/membersApi";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

const TIER_ORDER: MemberTier[] = ["founder", "council", "junior_council", "member"];

// Matches the web form's <select> option text exactly -- membersApi.ts's
// TIER_LABELS stays short, for compact badge use on the list/detail screens.
const TIER_PICKER_LABELS: Record<MemberTier, string> = {
  founder: "Founder / Co-President",
  council: "Leadership council",
  junior_council: "Junior council",
  member: "Member",
};

export default function MemberForm({
  initialValues,
  onSubmit,
  submitLabel,
  isSubmitting,
  errorMessage,
}: {
  initialValues?: Member;
  onSubmit: (input: MemberInput) => void;
  submitLabel: string;
  isSubmitting: boolean;
  errorMessage: string | null;
}) {
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [role, setRole] = useState(initialValues?.role ?? "");
  const [bio, setBio] = useState(initialValues?.bio ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [tier, setTier] = useState<MemberTier>(initialValues?.tier ?? "member");
  const [socials, setSocials] = useState<SocialsMap>(initialValues?.socials ?? {});

  const [photoUrl, setPhotoUrl] = useState(initialValues?.photoUrl ?? "");
  const [photoZoom, setPhotoZoom] = useState(initialValues?.photoZoom ?? 1);
  const [photoOffsetX, setPhotoOffsetX] = useState(initialValues?.photoOffsetX ?? 0);
  const [photoOffsetY, setPhotoOffsetY] = useState(initialValues?.photoOffsetY ?? 0);

  const canSubmit = fullName.trim().length >= 2 && !isSubmitting;

  function updateSocial(key: SocialPlatformKey, value: string) {
    setSocials((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit() {
    impactLight();

    // Only non-empty values get sent, matching the web form's own
    // per-platform trim-and-skip behavior -- an emptied field should
    // clear that platform, not save a blank string.
    const socialsPayload: SocialsMap = {};
    for (const platform of SOCIAL_PLATFORMS) {
      const value = (socials[platform.key] ?? "").trim();
      if (value) socialsPayload[platform.key] = value;
    }

    onSubmit({
      fullName: fullName.trim(),
      role: role.trim() || undefined,
      bio: bio.trim() || undefined,
      email: email.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      photoZoom,
      photoOffsetX,
      photoOffsetY,
      tier,
      socials: socialsPayload,
    });
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={20}>
      <Text style={styles.label}>Full name</Text>
      <TextInput
        style={styles.input}
        value={fullName}
        onChangeText={setFullName}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Role (e.g. Co-President)</Text>
      <TextInput
        style={styles.input}
        value={role}
        onChangeText={setRole}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Email (private event invites, not a login)</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      <Text style={styles.label}>Tier</Text>
      <View style={styles.chipRow}>
        {TIER_ORDER.map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, tier === t && styles.chipActive]}
            onPress={() => setTier(t)}
            disabled={isSubmitting}
          >
            <Text style={[styles.chipText, tier === t && styles.chipTextActive]}>{TIER_PICKER_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Photo</Text>
      <View style={styles.photoSection}>
        <PhotoPositioner
          photoUrl={photoUrl || null}
          zoom={photoZoom}
          offsetX={photoOffsetX}
          offsetY={photoOffsetY}
          disabled={isSubmitting}
          onChange={(next) => {
            setPhotoUrl(next.photoUrl);
            setPhotoZoom(next.zoom);
            setPhotoOffsetX(next.offsetX);
            setPhotoOffsetY(next.offsetY);
          }}
        />
      </View>

      <Text style={styles.label}>Socials (leave blank to skip a platform)</Text>
      <View style={styles.socialsGrid}>
        {SOCIAL_PLATFORMS.map((platform) => (
          <View key={platform.key} style={styles.socialField}>
            <Text style={styles.socialLabel}>{platform.label}</Text>
            <TextInput
              style={styles.input}
              value={socials[platform.key] ?? ""}
              onChangeText={(value) => updateSocial(platform.key, value)}
              placeholder={platform.placeholder}
              autoCapitalize="none"
              editable={!isSubmitting}
              placeholderTextColor={colors.muted}
            />
          </View>
        ))}
      </View>

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={bio}
        onChangeText={setBio}
        editable={!isSubmitting}
        placeholderTextColor={colors.muted}
      />

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Pressable
        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.submitButtonText}>{submitLabel}</Text>}
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
  multiline: { minHeight: 70, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: colors.lilac.default, borderColor: colors.lilac.default },
  chipText: { fontFamily: typography.bodyMedium, fontSize: 13, color: colors.muted },
  chipTextActive: { fontFamily: typography.bodySemibold, color: colors.ink },
  photoSection: { marginTop: 4 },
  socialsGrid: { marginTop: 4 },
  socialField: { marginBottom: 12 },
  socialLabel: { fontFamily: typography.mono, fontSize: 11, color: colors.muted, marginBottom: 4 },
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
