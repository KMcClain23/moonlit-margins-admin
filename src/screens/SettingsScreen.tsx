import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth, type AdminRole } from "../lib/authStore";

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
};

export default function SettingsScreen() {
  const { session, logout } = useAuth();

  function confirmLogout() {
    Alert.alert("Log out?", "You'll need to sign in again to keep using the app.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => void logout() },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.profile}>
        {/* AdminSession has no email field -- only fullName and role are
            available here. */}
        <Text style={styles.name}>{session?.fullName ?? "—"}</Text>
        {session ? <Text style={styles.role}>{ROLE_LABELS[session.role]}</Text> : null}
      </View>

      <Pressable style={styles.logoutButton} onPress={confirmLogout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20 },
  profile: {
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
    marginBottom: 24,
  },
  name: { fontSize: 20, fontWeight: "700", color: "#111" },
  role: { fontSize: 14, color: "#777", marginTop: 4 },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#c0392b",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutButtonText: { color: "#c0392b", fontSize: 15, fontWeight: "600" },
});
