import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { API_BASE_URL } from "../config";
import { SESSION_STORAGE_KEY } from "./storageKeys";

const DEVICE_ID_KEY = "mm_admin_device_id";

async function getStoredToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "token" in parsed) {
      const token = (parsed as { token: unknown }).token;
      return typeof token === "string" ? token : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** A plain fetch() (not apiFetch from ./api) for the same require-cycle
 * reason as getStoredToken()/SESSION_STORAGE_KEY above -- ./api imports
 * getToken from authStore.tsx, so routing through it here would still
 * close the loop. Returns the Response (or null if there's no stored
 * token to send) so callers can inspect it for diagnostics. */
async function pushApiRequest(path: string, method: "POST" | "DELETE", body: unknown): Promise<Response | null> {
  const token = await getStoredToken();
  if (!token) return null;

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

// Notifications received while the app is in the foreground still show a
// banner -- without this handler they'd otherwise be silently swallowed.
// shouldShowBanner/shouldShowList are the current SDK's actual controlling
// fields; shouldShowAlert is deprecated (optional) but included too since
// it's still what most guidance/tooling checks for. shouldSetBadge is
// true so a delivered notification also bumps the home-screen app icon
// badge -- see incrementBadgeCount()/clearBadgeCount() below for the
// actual count tracking, since this flag alone doesn't set a count.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Bumps the app icon's badge count by one. Called from App.tsx's
 * addNotificationReceivedListener whenever a notification is actually
 * delivered while the app is running (foreground or backgrounded) --
 * there's no server-tracked unread count this reads from, so it's a
 * simple local increment instead. */
export async function incrementBadgeCount(): Promise<void> {
  try {
    const current = await Notifications.getBadgeCountAsync();
    await Notifications.setBadgeCountAsync(current + 1);
  } catch (err) {
    console.error("[push] incrementBadgeCount threw", err);
  }
}

/** Resets the app icon's badge count to zero. Called when the person
 * opens the Messages tab, since that's the point they've actually seen
 * whatever was unread. */
export async function clearBadgeCount(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (err) {
    console.error("[push] clearBadgeCount threw", err);
  }
}

const DEFAULT_ANDROID_CHANNEL_ID = "default";

/**
 * Creates (or updates) the Android notification channel pushes are
 * delivered on. This must exist -- with real importance -- before any
 * push arrives, or Android can silently accept the notification via FCM
 * and never surface it, even though the send itself reports success.
 * Called both here (as part of the registration flow below) and
 * unconditionally at app startup in App.tsx, since a returning user's
 * restored session never runs the registration flow in this app launch,
 * yet still needs the channel to exist before a push can show up.
 */
export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF231F7C",
  });

  const channels = await Notifications.getNotificationChannelsAsync();
  console.log("[push] existing notification channels:", JSON.stringify(channels));
}

/**
 * This install's stable device id, generated once and persisted via
 * SecureStore so it survives app restarts. A reinstall gets a fresh id,
 * which is fine -- it's effectively a new device registration anyway.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

/**
 * Read-only lookup for logout -- deliberately does NOT generate a new id.
 * Generating one here would produce an id the server never registered,
 * turning the DELETE /api/admin/push-tokens call into a silent no-op
 * instead of actually unregistering this device.
 */
export async function getDeviceId(): Promise<string | null> {
  return SecureStore.getItemAsync(DEVICE_ID_KEY);
}

/**
 * Requests notification permission and resolves this device's Expo push
 * token. Push tokens only work on physical devices -- simulators/
 * emulators always resolve to null here rather than throwing, same as a
 * denied permission or a failed token fetch, so callers can treat "no
 * push" as a normal, silent outcome rather than an error to handle.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  console.log("[push] Device.isDevice =", Device.isDevice);
  if (!Device.isDevice) {
    return null;
  }

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log("[push] existing permission status =", existingStatus);
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    console.log("[push] requested permission status =", status);
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    console.log("[push] permission not granted, skipping token fetch");
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    console.log("[push] obtained Expo push token =", token);
    return token;
  } catch (err) {
    console.error("[push] getExpoPushTokenAsync threw", err);
    return null;
  }
}

/**
 * Ties deviceId + push token together and registers this device with the
 * backend. Safe to call repeatedly -- once right after login, and again
 * every time the app returns to the foreground (the token can rotate) --
 * since the server upserts on (admin_user_id, device_id).
 */
export async function setupPushNotifications(): Promise<void> {
  try {
    const [deviceId, expoPushToken] = await Promise.all([
      getOrCreateDeviceId(),
      registerForPushNotificationsAsync(),
    ]);

    console.log("[push] setupPushNotifications: deviceId =", deviceId, "expoPushToken =", expoPushToken);

    if (!expoPushToken) {
      console.log("[push] setupPushNotifications: no push token, skipping backend registration");
      return;
    }

    const response = await pushApiRequest("/api/admin/push-tokens", "POST", {
      expoPushToken,
      deviceId,
      platform: Platform.OS,
    });

    if (!response) {
      console.log("[push] POST /api/admin/push-tokens skipped -- no stored session token");
    } else if (!response.ok) {
      console.error("[push] POST /api/admin/push-tokens failed", response.status, await response.text());
    } else {
      console.log("[push] POST /api/admin/push-tokens succeeded", response.status);
    }
  } catch (err) {
    // Best-effort -- push registration must never block login or app usage.
    console.error("[push] setupPushNotifications threw", err);
  }
}

/** Unregisters this device on logout -- a no-op if it was never
 * registered (e.g. simulator, or permission was denied). Left unwrapped
 * here since authStore.tsx's logout() already wraps this call in its own
 * try/catch so a failure never blocks sign-out. */
export async function unregisterPushNotifications(): Promise<void> {
  const deviceId = await getDeviceId();
  if (!deviceId) return;
  await pushApiRequest("/api/admin/push-tokens", "DELETE", { deviceId });
}
