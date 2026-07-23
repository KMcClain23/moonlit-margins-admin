import { createNavigationContainerRef, type NavigatorScreenParams } from "@react-navigation/native";
import type { MessagesStackParamList } from "./RootNavigator";

// Only the one tab route this file actually needs to address is typed in
// detail -- the rest of MainTabs' Tab.Navigator is untyped today, so this
// intentionally doesn't try to fully mirror it.
type RootTabParamList = {
  Messages: NavigatorScreenParams<MessagesStackParamList>;
};

/**
 * Lets code outside the component tree (the notification tap listener in
 * App.tsx, which fires before/independent of any screen's own render)
 * drive navigation imperatively. Attached to <NavigationContainer ref={navigationRef}>
 * in App.tsx.
 */
export const navigationRef = createNavigationContainerRef<RootTabParamList>();

// A conversationId that arrived before the container was ready to
// navigate -- the classic cold-start race: a notification tap can be
// reported (via useLastNotificationResponse in App.tsx) before
// NavigationContainer finishes mounting its first real navigator.
// Queued here instead of silently dropped, and delivered by
// flushPendingNavigation() once App.tsx's <NavigationContainer
// onReady={...}> fires.
let pendingConversationId: string | null = null;

// navigate("Messages", { screen: "ConversationDetail", params }) is the
// nested-navigation form -- ConversationDetailScreen only exists inside
// MessagesNavigator, the stack nested inside the "Messages" tab, so a
// bare top-level navigate("ConversationDetail", params) would not
// resolve. This is the single place that actually calls .navigate() so
// the immediate and queued-retry paths below can't drift apart.
function navigate(conversationId: string): void {
  navigationRef.navigate("Messages", {
    screen: "ConversationDetail",
    params: { conversationId },
  });
}

/**
 * Navigates to a conversation from anywhere -- goes through the Messages
 * tab's nested stack, the same path an in-app row tap would take.
 *
 * If the container isn't ready yet (a notification tapped before the
 * app's first navigator has mounted, on cold start), the id is queued
 * instead of silently dropped -- see flushPendingNavigation().
 */
export function navigateToConversation(conversationId: string): void {
  if (!navigationRef.isReady()) {
    pendingConversationId = conversationId;
    return;
  }
  navigate(conversationId);
}

/**
 * Delivers a queued conversationId once the container becomes ready.
 * Call this from <NavigationContainer onReady={...}> in App.tsx -- that
 * prop fires exactly when the container's first real navigator (whatever
 * RootNavigator initially renders: the login stack, or the signed-in
 * tabs) has mounted, which is the earliest point navigate() can actually
 * resolve a route.
 *
 * Known limitation: if the app is cold-started by a notification tap
 * while signed out (or session restore from SecureStore hasn't resolved
 * yet), onReady fires for the login stack rather than the Messages tab --
 * the queued id is dropped here rather than retried after a subsequent
 * sign-in, since nothing tracks that later transition. The person lands
 * on the general conversations list after logging in instead of the
 * specific conversation, rather than crashing or hanging.
 */
export function flushPendingNavigation(): void {
  if (!pendingConversationId) return;
  const conversationId = pendingConversationId;
  pendingConversationId = null;
  navigate(conversationId);
}
