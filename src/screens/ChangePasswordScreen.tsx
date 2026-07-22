import { StyleSheet, Text, View } from "react-native";

export default function ChangePasswordScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Change your password</Text>
      <Text style={styles.body}>
        Your account is using a temporary password. You'll need to set a new one before
        continuing.
      </Text>

      {/* Not implemented yet -- building this out once the shape of the web
          app's password-change endpoint is confirmed. It's
          POST /api/admin/account/password with { currentPassword,
          newPassword }, and returns a refreshed token in the body on
          success (needed to clear mustChangePassword locally without a
          re-login). */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    lineHeight: 22,
  },
});
