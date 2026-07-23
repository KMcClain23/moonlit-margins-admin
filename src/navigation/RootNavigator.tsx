import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Theme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../lib/authStore";
import { colors } from "../theme/colors";
import { useUnreadMessagesCount } from "../lib/unreadMessages";
import LoginScreen from "../screens/LoginScreen";
import ChangePasswordScreen from "../screens/ChangePasswordScreen";
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
import type { Event } from "../lib/eventsApi";

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
        options={{ title: "New message" }}
      />
    </MessagesStack.Navigator>
  );
}

function TasksNavigator() {
  return (
    <TasksStack.Navigator>
      <TasksStack.Screen name="TasksList" component={TasksListScreen} options={{ title: "Tasks" }} />
      <TasksStack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: "Task" }} />
      <TasksStack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: "New task" }} />
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
      <EventsStack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: "New event" }} />
      <EventsStack.Screen name="EditEvent" component={EditEventScreen} options={{ title: "Edit event" }} />
    </EventsStack.Navigator>
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
      {/* No nested stack -- this is a single screen with nowhere to drill
          into, so it gets the tab navigator's own default header instead,
          the same way LoginScreen/ChangePasswordScreen do on AuthStack. */}
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
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
