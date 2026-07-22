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

/** Navigates to a conversation from anywhere -- goes through the Messages
 * tab's nested stack, the same path an in-app row tap would take. A no-op
 * if the container isn't mounted yet (e.g. a notification tapped before
 * the app has finished its first render) or the person isn't signed in
 * (no "Messages" route exists on the logged-out stack). */
export function navigateToConversation(conversationId: string): void {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate("Messages", {
    screen: "ConversationDetail",
    params: { conversationId },
  });
}
