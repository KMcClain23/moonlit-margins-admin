import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

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
    backgroundColor: colors.ink,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 20,
    color: colors.parchment,
    marginBottom: 12,
    textAlign: "center",
  },
  body: {
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
});
