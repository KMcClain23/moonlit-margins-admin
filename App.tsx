import { useCallback, useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
// Per-weight subpath imports, not the package's flat top-level export --
// @expo-google-fonts/<family>'s top-level index.js unconditionally
// requires every weight's .ttf as a static asset, so importing even one
// named export from it bundles the whole family regardless. The subpath
// form (documented in each package's own README) is what actually limits
// the bundle to the weights this app uses.
import { Fraunces_500Medium } from "@expo-google-fonts/fraunces/500Medium";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { IBMPlexMono_500Medium } from "@expo-google-fonts/ibm-plex-mono/500Medium";
import { AuthProvider } from "./src/lib/authStore";
import RootNavigator, { navigationTheme } from "./src/navigation/RootNavigator";
import { navigationRef, navigateToConversation, flushPendingNavigation } from "./src/navigation/navigationRef";
import { ensureAndroidNotificationChannel, incrementBadgeCount } from "./src/lib/pushNotifications";

// Keeps the native splash screen visible until fonts finish loading, so
// there's no flash of unstyled (system-font) text on launch.
void SplashScreen.preventAutoHideAsync();

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

/**
 * Fires whenever a notification is actually DELIVERED to this device
 * while the app is running (not tapped -- that's
 * addNotificationResponseReceivedListener above). Distinct diagnostic
 * purpose: if a push reportedly sends successfully but nothing appears
 * on screen while the app is foregrounded, this listener firing (or not)
 * tells us whether the notification ever reached the JS layer at all --
 * if it never logs, the problem is upstream (native delivery); if it
 * logs but still doesn't display, the problem is in
 * setNotificationHandler's returned behavior or platform-level display.
 * Also bumps the app icon badge count, since there's no server-tracked
 * unread count to read a number from.
 */
function useNotificationReceivedLogging() {
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("[push] notification received while app running:", JSON.stringify(notification));
      void incrementBadgeCount();
    });
    return () => subscription.remove();
  }, []);
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    IBMPlexMono_500Medium,
  });

  useAndroidNotificationChannel();
  useNotificationTapNavigation();
  useNotificationReceivedLogging();

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Keep the native splash screen up (nothing rendered yet) until the
  // fonts either finish loading or fail -- either way there's a font to
  // paint text with by the time anything becomes visible.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} onReady={flushPendingNavigation} theme={navigationTheme}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
