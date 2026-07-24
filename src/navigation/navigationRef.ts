import { createNavigationContainerRef, type NavigatorScreenParams } from "@react-navigation/native";
import type { EventsStackParamList, MessagesStackParamList, SettingsStackParamList, TasksStackParamList } from "./RootNavigator";
import type { AdminSession } from "../lib/authStore";
import type { ShortcutActionId } from "../lib/quickActions";

// Only the tab routes this file actually needs to address are typed in
// detail -- the rest of MainTabs' Tab.Navigator is untyped today, so this
// intentionally doesn't try to fully mirror it.
type RootTabParamList = {
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Tasks: NavigatorScreenParams<TasksStackParamList>;
  Events: NavigatorScreenParams<EventsStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
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

// A tapped app shortcut that arrived before the container was ready --
// same cold-start race as pendingConversationId above, queued the same
// way. The session has to be captured alongside the action id here (not
// re-read later) since flushPendingShortcutAction() has no other way to
// get at "whatever the session was when this was queued."
let pendingShortcutAction: ShortcutActionId | null = null;
let pendingShortcutSession: AdminSession | null = null;

// The single place that actually resolves "which screen does this
// shortcut go to," gated by the session's permissions at the moment it's
// tapped -- shortcuts are registered generically (see quickActions.ts)
// since the OS can offer one before the app, let alone its session
// state, has loaded, so the permission check has to happen here instead
// of at registration time. Falls back to the always-accessible list
// screen rather than the gated create screen, matching every create
// screen's own belt-and-suspenders session check (e.g. CreateEventScreen).
function resolveShortcutNavigation(actionId: ShortcutActionId, session: AdminSession): void {
  switch (actionId) {
    case "new-task":
      if (session.canAssignTasks) {
        navigationRef.navigate("Tasks", { screen: "CreateTask" });
      } else {
        navigationRef.navigate("Tasks", { screen: "TasksList" });
      }
      return;
    case "new-message":
      navigationRef.navigate("Messages", { screen: "NewConversation" });
      return;
    case "new-event":
      if (session.sections.includes("events")) {
        navigationRef.navigate("Events", { screen: "CreateEvent" });
      } else {
        navigationRef.navigate("Events", { screen: "EventsList" });
      }
      return;
    case "new-memory":
      if (session.sections.includes("memories")) {
        navigationRef.navigate("Settings", { screen: "Memories", params: { screen: "CreateMemory" } });
      } else {
        navigationRef.navigate("Settings", { screen: "Memories" });
      }
      return;
  }
}

/**
 * Called whenever a quick action fires, cold start or already running.
 * The caller (RootNavigator) is responsible for waiting until the
 * session has actually finished loading before calling this -- a null
 * session here is treated as "genuinely signed out," not "still
 * loading," and the tap is dropped rather than queued indefinitely (the
 * same choice flushPendingNavigation makes for a notification tap that
 * arrives while signed out).
 */
export function navigateForQuickAction(actionId: ShortcutActionId, session: AdminSession | null): void {
  if (!session) return;
  if (!navigationRef.isReady()) {
    pendingShortcutAction = actionId;
    pendingShortcutSession = session;
    return;
  }
  resolveShortcutNavigation(actionId, session);
}

/**
 * Delivers a queued quick action once the container becomes ready --
 * mirrors flushPendingNavigation, called from the same
 * <NavigationContainer onReady={...}> in App.tsx.
 */
export function flushPendingShortcutAction(): void {
  if (!pendingShortcutAction || !pendingShortcutSession) return;
  const actionId = pendingShortcutAction;
  const session = pendingShortcutSession;
  pendingShortcutAction = null;
  pendingShortcutSession = null;
  resolveShortcutNavigation(actionId, session);
}
