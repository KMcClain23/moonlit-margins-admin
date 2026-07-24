import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { ActivityIndicator, AppState, StyleSheet, View, type AppStateStatus } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NavigatorScreenParams, Theme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import type { Action as QuickAction } from "expo-quick-actions";
import { useQuickActionCallback } from "expo-quick-actions/hooks";
import { useAuth, type AdminSession } from "../lib/authStore";
import { isBiometricLockEnabled } from "../lib/biometricAuth";
import { selection } from "../lib/haptics";
import { colors } from "../theme/colors";
import { isShortcutActionId, type ShortcutActionId } from "../lib/quickActions";
import { navigateForQuickAction } from "./navigationRef";
import { useUnreadMessagesCount } from "../lib/unreadMessages";
import LoginScreen from "../screens/LoginScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
import BiometricLockScreen from "../screens/BiometricLockScreen";
import TasksListScreen from "../screens/TasksListScreen";
import TaskDetailScreen from "../screens/TaskDetailScreen";
import CreateTaskScreen from "../screens/CreateTaskScreen";
import EditTaskScreen from "../screens/EditTaskScreen";
import ApplicationsListScreen from "../screens/ApplicationsListScreen";
import ApplicationDetailScreen from "../screens/ApplicationDetailScreen";
import EventsListScreen from "../screens/EventsListScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import CreateEventScreen from "../screens/CreateEventScreen";
import EditEventScreen from "../screens/EditEventScreen";
import ConversationsListScreen from "../screens/ConversationsListScreen";
import ConversationDetailScreen from "../screens/ConversationDetailScreen";
import NewConversationScreen from "../screens/NewConversationScreen";
import SettingsScreen from "../screens/SettingsScreen";
import MessageSettingsScreen from "../screens/MessageSettingsScreen";
import MembersListScreen from "../screens/MembersListScreen";
import MemberDetailScreen from "../screens/MemberDetailScreen";
import CreateMemberScreen from "../screens/CreateMemberScreen";
import EditMemberScreen from "../screens/EditMemberScreen";
import MemoriesListScreen from "../screens/MemoriesListScreen";
import MemoryDetailScreen from "../screens/MemoryDetailScreen";
import CreateMemoryScreen from "../screens/CreateMemoryScreen";
import EditMemoryScreen from "../screens/EditMemoryScreen";
import type { Event } from "../lib/eventsApi";
import type { Member } from "../lib/membersApi";
import type { Memory } from "../lib/memoriesApi";

export type MessagesStackParamList = {
  ConversationsList: undefined;
  ConversationDetail: { conversationId: string; title?: string };
  NewConversation: undefined;
};

export type TasksStackParamList = {
  TasksList: undefined;
  TaskDetail: { taskId: string };
  CreateTask: undefined;
  EditTask: { taskId: string };
};

export type ApplicationsStackParamList = {
  ApplicationsList: undefined;
  ApplicationDetail: { applicationId: string };
};

// EditEvent takes the full Event object (rather than just an id) since
// EventDetailScreen -- the only place that navigates here -- already has
// it loaded in full, avoiding a redundant listEvents()+find-by-id round
// trip that the Tasks/Applications edit flows need instead.
export type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
  EditEvent: { event: Event };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  MessageSettings: undefined;
  // Hosts the entire nested MembersNavigator/MemoriesNavigator below, the
  // same way MainTabs' "Settings" Tab.Screen hosts SettingsNavigator --
  // not a single screen each.
  Members: undefined;
  // Memories additionally accepts a nested screen/params pair -- the "New
  // Memory" quick action deep-links two levels deep, straight to
  // CreateMemory inside MemoriesNavigator, rather than just the list
  // (see navigationRef.ts's navigateForQuickAction). Still optional/bare
  // for the plain in-app "Memories" row tap in SettingsScreen.tsx, which
  // passes no params and lands on MemoriesList as usual.
  Memories: NavigatorScreenParams<MemoriesStackParamList> | undefined;
};

// EditMember takes the full Member object (rather than just an id) since
// MemberDetailScreen -- the only place that navigates here -- already has
// it loaded in full, avoiding a redundant listMembers()+find-by-id round
// trip, matching the EditEvent/EventDetailScreen pattern.
export type MembersStackParamList = {
  MembersList: undefined;
  MemberDetail: { memberId: string };
  CreateMember: undefined;
  EditMember: { member: Member };
};

// Same reasoning as MembersStackParamList's EditMember -- EditMemory takes
// the full Memory object since MemoryDetailScreen already has it loaded.
export type MemoriesStackParamList = {
  MemoriesList: undefined;
  MemoryDetail: { memoryId: string };
  CreateMemory: undefined;
  EditMemory: { memory: Memory };
};

// Retheme's every default header/tab bar to match the web admin's dark
// design system, without touching each screen individually. Built here
// since this is where the app's navigators are defined, but actually
// applied via <NavigationContainer theme={navigationTheme}> in App.tsx --
// that's where NavigationContainer itself is instantiated, one level up
// from this file.
export const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: colors.lilac.default,
    background: colors.ink,
    card: colors.surface,
    text: colors.parchment,
    border: colors.hairline,
    notification: colors.candle.default,
  },
  fonts: {
    regular: { fontFamily: "Manrope_400Regular", fontWeight: "400" },
    medium: { fontFamily: "Manrope_500Medium", fontWeight: "500" },
    bold: { fontFamily: "Manrope_600SemiBold", fontWeight: "600" },
    heavy: { fontFamily: "Manrope_700Bold", fontWeight: "700" },
  },
};

const AuthStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const TasksStack = createNativeStackNavigator<TasksStackParamList>();
const ApplicationsStack = createNativeStackNavigator<ApplicationsStackParamList>();
const EventsStack = createNativeStackNavigator<EventsStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const MembersStack = createNativeStackNavigator<MembersStackParamList>();
const MemoriesStack = createNativeStackNavigator<MemoriesStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.lilac.default} />
    </View>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen
        name="ConversationsList"
        component={ConversationsListScreen}
        options={{ title: "Messages" }}
      />
      <MessagesStack.Screen
        name="ConversationDetail"
        component={ConversationDetailScreen}
        options={{ title: "Conversation" }}
      />
      <MessagesStack.Screen
        name="NewConversation"
        component={NewConversationScreen}
        options={{ title: "New message", presentation: "modal" }}
      />
    </MessagesStack.Navigator>
  );
}

function TasksNavigator() {
  return (
    <TasksStack.Navigator>
      <TasksStack.Screen name="TasksList" component={TasksListScreen} options={{ title: "Tasks" }} />
      <TasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: "Task" }} />
      <TasksStack.Screen
        name="CreateTask"
        component={CreateTaskScreen}
        options={{ title: "New task", presentation: "modal" }}
      />
      <TasksStack.Screen name="EditTask" component={EditTaskScreen} options={{ title: "Edit task" }} />
    </TasksStack.Navigator>
  );
}

function ApplicationsNavigator() {
  return (
    <ApplicationsStack.Navigator>
      <ApplicationsStack.Screen
        name="ApplicationsList"
        component={ApplicationsListScreen}
        options={{ title: "Applications" }}
      />
      <ApplicationsStack.Screen
        name="ApplicationDetail"
        component={ApplicationDetailScreen}
        options={{ title: "Application" }}
      />
    </ApplicationsStack.Navigator>
  );
}

function EventsNavigator() {
  return (
    <EventsStack.Navigator>
      <EventsStack.Screen name="EventsList" component={EventsListScreen} options={{ title: "Events" }} />
      <EventsStack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: "Event" }} />
      <EventsStack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{ title: "New event", presentation: "modal" }}
      />
      <EventsStack.Screen name="EditEvent" component={EditEventScreen} options={{ title: "Edit event" }} />
    </EventsStack.Navigator>
  );
}

function MembersNavigator() {
  return (
    <MembersStack.Navigator>
      <MembersStack.Screen name="MembersList" component={MembersListScreen} options={{ title: "Members" }} />
      <MembersStack.Screen name="MemberDetail" component={MemberDetailScreen} options={{ title: "Member" }} />
      <MembersStack.Screen
        name="CreateMember"
        component={CreateMemberScreen}
        options={{ title: "New member", presentation: "modal" }}
      />
      <MembersStack.Screen name="EditMember" component={EditMemberScreen} options={{ title: "Edit member" }} />
    </MembersStack.Navigator>
  );
}

function MemoriesNavigator() {
  return (
    <MemoriesStack.Navigator>
      <MemoriesStack.Screen name="MemoriesList" component={MemoriesListScreen} options={{ title: "Memories" }} />
      <MemoriesStack.Screen name="MemoryDetail" component={MemoryDetailScreen} options={{ title: "Memory" }} />
      <MemoriesStack.Screen
        name="CreateMemory"
        component={CreateMemoryScreen}
        options={{ title: "New memory", presentation: "modal" }}
      />
      <MemoriesStack.Screen name="EditMemory" component={EditMemoryScreen} options={{ title: "Edit memory" }} />
    </MemoriesStack.Navigator>
  );
}

function SettingsNavigator() {
  return (
    <SettingsStack.Navigator>
      <SettingsStack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: "Settings" }} />
      <SettingsStack.Screen
        name="MessageSettings"
        component={MessageSettingsScreen}
        options={{ title: "Message Notifications" }}
      />
      {/* Nested stack owns its own per-screen headers -- headerShown:false
          here stops SettingsStack from also rendering its own header on
          top of them, same as MainTabs does for its own nested stacks. */}
      <SettingsStack.Screen name="Members" component={MembersNavigator} options={{ headerShown: false }} />
      <SettingsStack.Screen name="Memories" component={MemoriesNavigator} options={{ headerShown: false }} />
    </SettingsStack.Navigator>
  );
}

// @expo/vector-icons ships as part of the Expo SDK and doesn't need any
// app.json plugin entry or manual useFonts()/expo-font wiring -- it just
// needs to actually be installed (it wasn't; there was no icon library in
// this project at all, so the tab bar was never rendering icons of any
// kind, not a "wrong glyph names" or "unlinked font" problem).
type IoniconName = ComponentProps<typeof Ionicons>["name"];
const TAB_ICONS: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
  Messages: { focused: "chatbubbles", unfocused: "chatbubbles-outline" },
  Tasks: { focused: "checkbox", unfocused: "checkbox-outline" },
  Events: { focused: "calendar", unfocused: "calendar-outline" },
  Applications: { focused: "document-text", unfocused: "document-text-outline" },
  Settings: { focused: "settings", unfocused: "settings-outline" },
};

// Polls independently of whichever tab is actually focused, since the
// badge needs to reflect unread state even while looking at Tasks/
// Events/etc. -- this is only the fallback cadence for changes this app
// instance didn't cause itself; anything that marks a conversation read
// locally (ConversationDetailScreen) or refetches the list
// (ConversationsListScreen) pushes an immediate update via
// refreshUnreadCount() instead of waiting for this to tick.
const UNREAD_POLL_INTERVAL_MS = 20000;

function MainTabs() {
  const unreadCount = useUnreadMessagesCount(UNREAD_POLL_INTERVAL_MS);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icon = TAB_ICONS[route.name];
          const name: IoniconName = icon ? (focused ? icon.focused : icon.unfocused) : "ellipse-outline";
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.lilac.default,
        tabBarInactiveTintColor: colors.muted,
      })}
      // React Navigation's JS-rendered tab bar has no built-in haptic on
      // tab switches (unlike a native UITabBarController) -- selection()
      // is the lightest-weight feedback available, appropriate for a
      // same-level switch rather than a triggered action.
      screenListeners={{ tabPress: () => selection() }}
    >
      {/* Nested stack owns its own per-screen headers -- headerShown:false
          here stops the tab navigator from also rendering its own header
          on top of them. */}
      <Tab.Screen
        name="Messages"
        component={MessagesNavigator}
        options={{
          headerShown: false,
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.candle.default },
        }}
      />
      <Tab.Screen name="Tasks" component={TasksNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Events" component={EventsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Applications" component={ApplicationsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsNavigator} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

// Purely a local re-entry gate on top of the already-valid session token
// in SecureStore -- never touches the server. isChecking covers the gap
// between "we have a session" and "we've confirmed whether the lock is
// even enabled," so MainTabs never flashes on screen first when it is.
function useBiometricLock(hasSession: boolean) {
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const previousAppState = useRef(AppState.currentState);

  useEffect(() => {
    if (!hasSession) {
      setIsChecking(false);
      return;
    }
    let cancelled = false;
    setIsChecking(true);
    isBiometricLockEnabled().then((enabled) => {
      if (cancelled) return;
      setIsLocked(enabled);
      setIsChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  // Re-locks on every background->foreground transition, not just cold
  // start, mirroring the AppState pattern authStore.tsx already uses for
  // foreground push-token re-registration.
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      const cameFromBackground = previousAppState.current !== "active" && nextState === "active";
      previousAppState.current = nextState;
      if (cameFromBackground && hasSession) {
        void isBiometricLockEnabled().then((enabled) => {
          if (enabled) setIsLocked(true);
        });
      }
    }
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [hasSession]);

  const unlock = useCallback(() => setIsLocked(false), []);

  return { isLocked, isChecking, unlock };
}

// Fires on both a cold start (the app was launched BY the shortcut tap)
// and while already running (foreground or backgrounded) -- unlike the
// notification-tap handling in App.tsx, expo-quick-actions' own
// useQuickActionCallback already covers both cases in one hook. session
// may still be mid-restore (isLoading) at the exact moment a cold-start
// tap is reported, so an unresolved tap is queued in a ref and flushed
// once loading finishes, rather than resolved against a session that
// hasn't actually loaded yet.
function useQuickActionNavigation(session: AdminSession | null, isLoading: boolean) {
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const pendingActionIdRef = useRef<ShortcutActionId | null>(null);

  // useQuickActionCallback re-subscribes (and replays the initial action)
  // whenever the function identity it's given changes, so this has to be
  // referentially stable -- reading session/isLoading through the refs
  // above rather than closing over them keeps it stable across renders
  // without going stale.
  const handleQuickAction = useCallback((action: QuickAction) => {
    if (!isShortcutActionId(action.id)) return;
    if (isLoadingRef.current) {
      pendingActionIdRef.current = action.id;
      return;
    }
    navigateForQuickAction(action.id, sessionRef.current);
  }, []);

  useQuickActionCallback(handleQuickAction);

  useEffect(() => {
    if (isLoading || !pendingActionIdRef.current) return;
    const actionId = pendingActionIdRef.current;
    pendingActionIdRef.current = null;
    navigateForQuickAction(actionId, session);
  }, [isLoading, session]);
}

export default function RootNavigator() {
  const { session, isLoading } = useAuth();
  const { isLocked, isChecking, unlock } = useBiometricLock(Boolean(session));
  useQuickActionNavigation(session, isLoading);

  if (isLoading || (session && isChecking)) {
    return <LoadingScreen />;
  }

  if (!session) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Login" component={LoginScreen} />
      </AuthStack.Navigator>
    );
  }

  if (session.mustChangePassword) {
    return (
      <AuthStack.Navigator screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      </AuthStack.Navigator>
    );
  }

  if (isLocked) {
    return <BiometricLockScreen onUnlock={unlock} />;
  }

  return <MainTabs />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
});
