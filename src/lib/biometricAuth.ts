import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { BIOMETRIC_LOCK_ENABLED_STORAGE_KEY } from "./storageKeys";

/**
 * True only when the device both has biometric hardware AND has an
 * actual fingerprint/face enrolled -- never offer the lock toggle
 * otherwise, since enabling it for someone with nothing enrolled would
 * lock them out of the app with no way back in.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const [hasHardware, isEnrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function isBiometricLockEnabled(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_LOCK_ENABLED_STORAGE_KEY);
  return raw === "true";
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_LOCK_ENABLED_STORAGE_KEY, String(enabled));
}

/**
 * Prompts Face ID/fingerprint and resolves true only on an actual
 * success. Cancellation, failure, lockout, and the OS-level prompt
 * simply not being available all resolve false rather than throwing, so
 * callers (BiometricLockScreen, the Settings confirmation step) can
 * treat every non-success outcome identically: stay locked / don't
 * enable, no special-casing needed. This never touches the server --
 * it's purely a local gate on top of the already-persisted session
 * token in SecureStore.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Moonlit Margins Admin",
    });
    return result.success;
  } catch {
    return false;
  }
}
