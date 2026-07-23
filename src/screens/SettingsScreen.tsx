import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth, type AdminRole } from "../lib/authStore";
import { getMe } from "../lib/authApi";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export default function SettingsScreen() {
  const { session, logout } = useAuth();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setPhotoUrl(me.photoUrl);
      })
      .catch(() => {
        // Purely decorative -- fall back to the placeholder rather than
        // showing an error for a failed avatar fetch.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPhoto(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function confirmLogout() {
    Alert.alert("Log out?", "You'll need to sign in again to keep using the app.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void logout() },
    ]);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View>
        <View style={styles.profile}>
          <View style={styles.profileRow}>
            {isLoadingPhoto ? (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <ActivityIndicator size="small" color={colors.lilac.default} />
              </View>
            ) : photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitials}>{getInitials(session?.fullName ?? "")}</Text>
              </View>
            )}

            <View style={styles.profileText}>
              {/* AdminSession has no email field -- only fullName and role
                  are available from the stored session. */}
              <Text style={styles.name}>{session?.fullName ?? "—"}</Text>
              {session ? <Text style={styles.role}>{ROLE_LABELS[session.role]}</Text> : null}
            </View>
          </View>
        </View>

        <Pressable style={styles.logoutButton} onPress={confirmLogout}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </Pressable>
      </View>

      {/* Purely decorative -- sits below the fold on tall screens, and
          just scrolls into view on short ones rather than ever pushing
          the profile info or Log out button down. */}
      <View style={styles.footer}>
        <Image
          source={require("../../assets/dragon-illustration.png")}
          style={styles.footerImage}
          resizeMode="contain"
        />
        <Text style={styles.footerCaption}>Moonlit Margins Sisterhood Admin</Text>
      </View>
    </ScrollView>
  );
}

const AVATAR_SIZE = 88;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.ink },
  container: { flexGrow: 1, padding: 20, justifyContent: "space-between" },
  profile: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginBottom: 24,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surfaceRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { fontFamily: typography.display, fontSize: 28, color: colors.lilac.soft },
  profileText: { flexShrink: 1 },
  name: { fontFamily: typography.display, fontSize: 20, color: colors.parchment },
  role: { fontFamily: typography.mono, fontSize: 12, color: colors.lilac.soft, marginTop: 6 },
  logoutButton: {
    borderWidth: 1,
    borderColor: colors.candle.default,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutButtonText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 15 },
  footer: { alignItems: "center", marginTop: 48, paddingBottom: 12 },
  footerImage: { width: 180, height: 149, opacity: 0.5 },
  footerCaption: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.muted,
    marginTop: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
