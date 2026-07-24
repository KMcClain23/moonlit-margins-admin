import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { authenticateWithBiometrics } from "../lib/biometricAuth";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

/**
 * A pure re-entry gate, not an auth screen -- the session token in
 * SecureStore is already valid and untouched. On success this just
 * flips the caller's lock flag back off; on failure/cancel it stays put
 * with a retry button rather than forcing a logout.
 */
export default function BiometricLockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const attemptUnlock = useCallback(async () => {
    setIsAuthenticating(true);
    setHasFailed(false);
    const success = await authenticateWithBiometrics();
    if (success) {
      onUnlock();
      return;
    }
    setHasFailed(true);
    setIsAuthenticating(false);
  }, [onUnlock]);

  // Auto-triggers once on mount so the OS prompt just appears, rather
  // than making every re-entry require an extra tap first.
  useEffect(() => {
    void attemptUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root}>
      <Image source={require("../../assets/moon-flame-emblem.png")} style={styles.emblem} resizeMode="contain" />
      <Text style={styles.title}>Moonlit Margins Admin</Text>
      <Text style={styles.subtitle}>
        {isAuthenticating ? "Verifying…" : hasFailed ? "Couldn't verify -- try again." : "Locked"}
      </Text>

      {isAuthenticating ? (
        <ActivityIndicator color={colors.lilac.default} style={styles.spinner} />
      ) : (
        <Pressable style={styles.button} onPress={() => void attemptUnlock()}>
          <Text style={styles.buttonText}>Unlock</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emblem: {
    width: 96,
    height: 96,
    marginBottom: 20,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 24,
    color: colors.parchment,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.muted,
    marginTop: 10,
    marginBottom: 28,
    textAlign: "center",
  },
  spinner: { marginTop: 4 },
  button: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: typography.bodySemibold,
    color: colors.ink,
    fontSize: 16,
  },
});
