import { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "./src/lib/authStore";
import RootNavigator from "./src/navigation/RootNavigator";
import { navigationRef, navigateToConversation } from "./src/navigation/navigationRef";
import { ensureAndroidNotificationChannel } from "./src/lib/pushNotifications";

function readConversationId(data: Record<string, unknown> | undefined): string | null {
  const value = data?.conversationId;
  return typeof value === "string" ? value : null;
}

// Runs unconditionally at app startup, independent of login state -- a
// returning user's session restores without ever going through
// pushNotifications.ts's login/foreground registration flow in this
// launch, but the channel still needs to exist before any push arrives.
function useAndroidNotificationChannel() {
  useEffect(() => {
    void ensureAndroidNotificationChannel();
  }, []);
}

/** Wires up "tapping a push notification opens that conversation," for
 * both ways a tap can reach the app: already running (foreground or
 * backgrounded), or fully closed (cold start). */
function useNotificationTapNavigation() {
  // Cold start: the app was launched BY the tap. useLastNotificationResponse
  // is Expo's recommended hook for this case -- it resolves to the
  // most recent tap once the native side has reported it, which the
  // listener below can't catch since it wasn't attached yet at launch time.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const conversationId = readConversationId(lastResponse?.notification.request.content.data);
    if (conversationId) {
      navigateToConversation(conversationId);
    }
  }, [lastResponse]);

  // App already running: a tap while backgrounded or foregrounded fires
  // here instead.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const conversationId = readConversationId(response.notification.request.content.data);
      if (conversationId) {
        navigateToConversation(conversationId);
      }
    });
    return () => subscription.remove();
  }, []);
}

export default function App() {
  useAndroidNotificationChannel();
  useNotificationTapNavigation();

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
