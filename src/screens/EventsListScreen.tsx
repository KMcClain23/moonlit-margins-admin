import { useCallback, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../lib/authStore";
import { formatEventDateTime, listEvents, tierLabel, type Event, type EventType } from "../lib/eventsApi";
import { ApiError } from "../lib/apiError";
import { impactLight } from "../lib/haptics";
import { listItemExiting, listItemLayout, staggeredEntering } from "../lib/listAnimations";
import { useNetworkStatus } from "../lib/useNetworkStatus";
import type { EventsStackParamList } from "../navigation/RootNavigator";
import { colors, withAlpha } from "../theme/colors";
import { typography } from "../theme/typography";
import EmptyState from "../components/EmptyState";
import OfflineBanner from "../components/OfflineBanner";
import SkeletonRow from "../components/SkeletonRow";

const SKELETON_ROWS = Array.from({ length: 5 }, (_, i) => i);

type Nav = NativeStackNavigationProp<EventsStackParamList, "EventsList">;
type IoniconName = ComponentProps<typeof Ionicons>["name"];

const EVENT_TYPE_ICONS: Record<EventType, IoniconName> = {
  reading_sprint: "book-outline",
  tiktok_live: "videocam-outline",
  author_event: "mic-outline",
  annual_meetup: "people-outline",
  game_night: "game-controller-outline",
  other: "calendar-outline",
};

function privateBadgeLabel(event: Event): string {
  if (!event.targetTiers || event.targetTiers.length === 0) return "Private";
  return `Private: ${event.targetTiers.map(tierLabel).join(", ")}`;
}

export default function EventsListScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const isOffline = useNetworkStatus();

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage(null);
    try {
      const result = await listEvents();
      setEvents(result.data);
      setIsStale(result.stale);
      setCachedAt(result.cachedAt);
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : "Could not load events.");
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  return (
    <View style={styles.container}>
      <OfflineBanner visible={isOffline || isStale} cachedAt={cachedAt} />
      {isLoading && events.length === 0 ? (
        <View style={styles.listContent}>
          {SKELETON_ROWS.map((i) => (
            <SkeletonRow key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={events.length === 0 ? styles.emptyContent : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => load(true)}
              tintColor={colors.lilac.default}
              colors={[colors.lilac.default]}
            />
          }
          ListEmptyComponent={
            errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : <EmptyState message="No events yet." />
          }
          renderItem={({ item, index }) => {
            const hasBadges = item.status === "canceled" || item.registrationType === "ticketing" || item.isPrivate;
            const showBody = !item.coverImageUrl || hasBadges;
            const dateAndLocation = `${formatEventDateTime(item.startsAt)}${item.location ? ` · ${item.location}` : ""}`;

            const badges = hasBadges ? (
              <View style={[styles.badgeRow, !item.coverImageUrl && styles.badgeRowSpaced]}>
                {item.status === "canceled" ? (
                  <View style={[styles.badge, styles.badgeCandle]}>
                    <Text style={[styles.badgeText, styles.badgeCandleText]}>Canceled</Text>
                  </View>
                ) : null}
                {item.registrationType === "ticketing" ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Ticketed</Text>
                  </View>
                ) : null}
                {item.isPrivate ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{privateBadgeLabel(item)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null;

            return (
              <Animated.View entering={staggeredEntering(index)} exiting={listItemExiting} layout={listItemLayout}>
                <Pressable style={styles.card} onPress={() => navigation.navigate("EventDetail", { eventId: item.id })}>
                  {item.coverImageUrl ? (
                    <View style={styles.mediaWrap}>
                      <Image
                        source={{ uri: item.coverImageUrl }}
                        style={styles.coverImage}
                        contentFit="cover"
                        transition={300}
                      />
                      <LinearGradient colors={["transparent", withAlpha(colors.ink, 0.85)]} style={styles.gradient} />
                      <View style={styles.overlayText}>
                        <Text style={styles.overlayTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.overlaySubtitle} numberOfLines={1}>
                          {dateAndLocation}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={[styles.mediaWrap, styles.fallback]}>
                      <Ionicons name={EVENT_TYPE_ICONS[item.eventType]} size={48} color={colors.muted} />
                    </View>
                  )}

                  {showBody ? (
                    <View style={styles.body}>
                      {!item.coverImageUrl ? (
                        <>
                          <Text style={styles.title}>{item.title}</Text>
                          <Text style={styles.subtitle}>{dateAndLocation}</Text>
                        </>
                      ) : null}
                      {badges}
                    </View>
                  ) : null}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      )}

      {session?.sections.includes("events") ? (
        <Pressable
          style={styles.fab}
          onPress={() => {
            impactLight();
            navigation.navigate("CreateEvent");
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const MEDIA_HEIGHT = 140;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  listContent: { padding: 16 },
  emptyContent: { flexGrow: 1 },
  errorText: {
    fontFamily: typography.body,
    color: colors.candle.default,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
    marginTop: 40,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  mediaWrap: { height: MEDIA_HEIGHT, width: "100%" },
  coverImage: { width: "100%", height: "100%" },
  gradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: "38%" },
  overlayText: { position: "absolute", left: 14, right: 14, bottom: 10 },
  overlayTitle: { fontFamily: typography.display, fontSize: 18, color: colors.parchment },
  overlaySubtitle: { fontFamily: typography.body, fontSize: 12, color: colors.parchment, marginTop: 2, opacity: 0.9 },
  fallback: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  body: { padding: 14 },
  title: { fontFamily: typography.bodySemibold, fontSize: 16, color: colors.parchment },
  subtitle: { fontFamily: typography.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badgeRowSpaced: { marginTop: 8 },
  badge: {
    backgroundColor: withAlpha(colors.lilac.default, 0.15),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeCandle: { backgroundColor: withAlpha(colors.candle.default, 0.15) },
  badgeText: { fontFamily: typography.mono, fontSize: 11, color: colors.lilac.soft },
  badgeCandleText: { color: colors.candle.soft },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.lilac.default,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { color: colors.lilac.default, fontSize: 28, lineHeight: 30 },
});
