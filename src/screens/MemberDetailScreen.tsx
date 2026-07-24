import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../lib/authStore";
import { deleteMember, listMembers, TIER_LABELS, type Member, type MemberTier } from "../lib/membersApi";
import { ApiError } from "../lib/apiError";
import { impactLight, impactMedium } from "../lib/haptics";
import { SOCIAL_PLATFORMS, buildSocialUrl } from "../lib/socials";
import { getAvatarPhotoStyle } from "../utils/photoCrop";
import type { MembersStackParamList } from "../navigation/RootNavigator";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";

const AVATAR_SIZE = 108;

const TIER_COLORS: Record<MemberTier, string> = {
  founder: colors.lilac.default,
  council: colors.lilac.soft,
  junior_council: colors.candle.soft,
  member: colors.muted,
};

type Nav = NativeStackNavigationProp<MembersStackParamList, "MemberDetail">;
type DetailRoute = RouteProp<MembersStackParamList, "MemberDetail">;

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default function MemberDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { memberId } = route.params;
  const { session } = useAuth();
  const canManage = Boolean(session?.sections.includes("members"));

  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // No single-member GET endpoint -- same workaround as Tasks/Applications/
  // Events: fetch the list and find this one by id.
  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const members = await listMembers();
      const found = members.data.find((m) => m.id === memberId) ?? null;
      setMember(found);
      if (!found) {
        setLoadError("This member couldn't be found -- they may have been removed.");
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this member.");
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function handleDelete() {
    if (!member) return;
    Alert.alert("Remove member", `Remove ${member.fullName} from the roster? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          impactMedium();
          setActionError(null);
          setIsDeleting(true);
          deleteMember(memberId)
            .then(() => navigation.goBack())
            .catch((err: unknown) => {
              setActionError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
              setIsDeleting(false);
            });
        },
      },
    ]);
  }

  if (isLoading && !member) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.lilac.default} />
      </View>
    );
  }

  if (!member) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? "Member not found."}</Text>
      </View>
    );
  }

  const avatarLayout = getAvatarPhotoStyle(AVATAR_SIZE, member.photoZoom, member.photoOffsetX, member.photoOffsetY);

  // Matches the web app's own SocialIcons logic (src/app/sisterhood/page.tsx):
  // resolve each platform's stored raw value into a full URL, skipping
  // anything blank or for a platform the member never filled in.
  const socialLinks = SOCIAL_PLATFORMS.map((platform) => {
    const value = member.socials[platform.key];
    const url = value ? buildSocialUrl(platform.base, value) : null;
    return url ? { ...platform, url } : null;
  }).filter((entry): entry is (typeof SOCIAL_PLATFORMS)[number] & { url: string } => entry !== null);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarFrame}>
          {member.photoUrl ? (
            <Image source={{ uri: member.photoUrl }} style={avatarLayout.image} contentFit="cover" transition={200} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{getInitials(member.fullName)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{member.fullName}</Text>
        {member.role ? <Text style={styles.role}>{member.role}</Text> : null}
        <View style={[styles.badge, { backgroundColor: withAlpha(TIER_COLORS[member.tier], 0.15) }]}>
          <Text style={[styles.badgeText, { color: TIER_COLORS[member.tier] }]}>{TIER_LABELS[member.tier]}</Text>
        </View>
      </View>

      {member.bio ? <Text style={styles.bio}>{member.bio}</Text> : null}

      {member.email ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Email</Text>
          <Text style={styles.metaValue}>{member.email}</Text>
        </View>
      ) : null}

      {socialLinks.length > 0 ? (
        <View style={styles.socialRow}>
          {socialLinks.map((link) => (
            <Pressable key={link.key} style={styles.socialButton} onPress={() => Linking.openURL(link.url)}>
              <Ionicons name={link.icon} size={20} color={colors.lilac.default} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {canManage ? (
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.editButton}
            onPress={() => {
              impactLight();
              navigation.navigate("EditMember", { member });
            }}
            disabled={isDeleting}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isDeleting}>
            <Text style={styles.deleteButtonText}>Remove</Text>
          </Pressable>
        </View>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  container: { padding: 20, backgroundColor: colors.ink, flexGrow: 1 },
  header: { alignItems: "center" },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  avatarPlaceholder: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontFamily: typography.display, fontSize: 32, color: colors.lilac.soft },
  name: { fontFamily: typography.display, fontSize: 22, color: colors.parchment, marginTop: 14, textAlign: "center" },
  role: { fontFamily: typography.bodyMedium, fontSize: 14, color: colors.lilac.soft, marginTop: 4, textAlign: "center" },
  badge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  badgeText: { fontFamily: typography.mono, fontSize: 11 },
  bio: {
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.muted,
    lineHeight: 21,
    marginTop: 20,
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginTop: 20,
  },
  metaLabel: { fontFamily: typography.mono, fontSize: 12, color: colors.muted },
  metaValue: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    color: colors.parchment,
    flexShrink: 1,
    textAlign: "right",
  },
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 20 },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 16, marginTop: 28, justifyContent: "center" },
  editButton: {
    borderWidth: 1,
    borderColor: colors.lilac.default,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  editButtonText: { fontFamily: typography.bodySemibold, color: colors.lilac.default, fontSize: 14 },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 4 },
  deleteButtonText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 14 },
});
