import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useAuth } from "../lib/authStore";
import { ApiError } from "../lib/apiError";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";
import Starfield from "../components/Starfield";

type Field = "email" | "password";

export default function LoginScreen() {
  const { login } = useAuth();
  const { width, height } = useWindowDimensions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<Field | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  return (
    <View style={styles.root}>
      {/* Fixed backdrop, deliberately a sibling of the scroll view rather
          than inside its content -- if it were a scrollable child it would
          scroll (and get keyboard-avoidance-shifted) along with the form
          instead of staying put behind it. */}
      <Starfield variant="dense" width={width} height={height} style={styles.starfield} />

      <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={20}>
        <Image source={require("../../assets/moon-flame-emblem.png")} style={styles.emblem} resizeMode="contain" />

        <Text style={styles.title}>Moonlit Margins Admin</Text>

        <TextInput
          style={[styles.input, focusedField === "email" && styles.inputFocused]}
          placeholder="Email"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          onFocus={() => setFocusedField("email")}
          onBlur={() => setFocusedField(null)}
          editable={!isSubmitting}
        />
        <TextInput
          style={[styles.input, focusedField === "password" && styles.inputFocused]}
          placeholder="Password"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedField("password")}
          onBlur={() => setFocusedField(null)}
          editable={!isSubmitting}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  starfield: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  emblem: {
    width: 96,
    height: 96,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: typography.display,
    fontSize: 24,
    color: colors.parchment,
    marginBottom: 28,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.parchment,
    backgroundColor: colors.surface,
  },
  inputFocused: {
    borderColor: colors.lilac.default,
  },
  error: {
    fontFamily: typography.body,
    color: colors.candle.default,
    marginBottom: 12,
    textAlign: "center",
  },
  button: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: typography.bodySemibold,
    color: colors.ink,
    fontSize: 16,
  },
});
