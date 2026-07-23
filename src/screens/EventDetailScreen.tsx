import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../lib/authStore";
import {
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  REGISTRATION_TYPE_LABELS,
  deleteEvent,
  listEventComments,
  listEventRsvps,
  listEvents,
  postEventComment,
  tierLabel,
  type Event,
  type EventComment,
  type Rsvp,
} from "../lib/eventsApi";
import { ApiError } from "../lib/apiError";
import type { EventsStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { typography } from "../theme/typography";

type Nav = NativeStackNavigationProp<EventsStackParamList, "EventDetail">;
type DetailRoute = RouteProp<EventsStackParamList, "EventDetail">;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { eventId } = route.params;
  const { session } = useAuth();
  const canManage = Boolean(session?.sections.includes("events"));

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [isLoadingRsvps, setIsLoadingRsvps] = useState(false);
  const [rsvpsError, setRsvpsError] = useState<string | null>(null);
  const [rsvpsExpanded, setRsvpsExpanded] = useState(false);

  const [comments, setComments] = useState<EventComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentSendError, setCommentSendError] = useState<string | null>(null);

  // There's no single-event GET -- same workaround as Tasks/Applications:
  // fetch the list and find this one by id.
  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const events = await listEvents();
      const found = events.find((e) => e.id === eventId) ?? null;
      setEvent(found);
      if (!found) {
        setLoadError("This event couldn't be found -- it may have been deleted.");
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Could not load this event.");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  const loadComments = useCallback(async () => {
    setIsLoadingComments(true);
    setCommentsError(null);
    try {
      setComments(await listEventComments(eventId));
    } catch (err) {
      setCommentsError(err instanceof ApiError ? err.message : "Could not load comments.");
    } finally {
      setIsLoadingComments(false);
    }
  }, [eventId]);

  const loadRsvps = useCallback(async () => {
    setIsLoadingRsvps(true);
    setRsvpsError(null);
    try {
      setRsvps(await listEventRsvps(eventId));
    } catch (err) {
      setRsvpsError(err instanceof ApiError ? err.message : "Could not load RSVPs.");
    } finally {
      setIsLoadingRsvps(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
      loadComments();
    }, [loadEvent, loadComments])
  );

  // RSVPs only apply to non-canceled, RSVP-registration events -- fetched
  // separately once the event itself is known, rather than always.
  useEffect(() => {
    if (event && event.registrationType === "rsvp" && event.status !== "canceled") {
      loadRsvps();
    }
  }, [event, loadRsvps]);

  function handleDelete() {
    if (!event) return;
    Alert.alert("Delete event", `Delete "${event.title}"? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setActionError(null);
          setIsDeleting(true);
          deleteEvent(eventId)
            .then(() => navigation.goBack())
            .catch((err: unknown) => {
              setActionError(err instanceof ApiError ? err.message : "That didn't go through. Try again.");
              setIsDeleting(false);
            });
        },
      },
    ]);
  }

  async function handleSendComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    setCommentSendError(null);
    setIsPostingComment(true);
    try {
      await postEventComment(eventId, trimmed);
      setCommentText("");
      await loadComments();
    } catch (err) {
      setCommentSendError(err instanceof ApiError ? err.message : "Couldn't post that comment.");
    } finally {
      setIsPostingComment(false);
    }
  }

  if (isLoading && !event) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.lilac.default} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? "Event not found."}</Text>
      </View>
    );
  }

  const showRsvps = event.registrationType === "rsvp" && event.status !== "canceled";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{event.title}</Text>
      {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Starts</Text>
        <Text style={styles.metaValue}>{formatDateTime(event.startsAt)}</Text>
      </View>
      {event.location ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Location</Text>
          <Text style={styles.metaValue}>{event.location}</Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Type</Text>
        <Text style={styles.metaValue}>{EVENT_TYPE_LABELS[event.eventType]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Registration</Text>
        <Text style={styles.metaValue}>{REGISTRATION_TYPE_LABELS[event.registrationType]}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Status</Text>
        <Text style={styles.metaValue}>{EVENT_STATUS_LABELS[event.status]}</Text>
      </View>
      {event.isPrivate ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Private</Text>
          <Text style={styles.metaValue}>
            {event.targetTiers && event.targetTiers.length > 0
              ? event.targetTiers.map(tierLabel).join(", ")
              : "Yes"}
          </Text>
        </View>
      ) : null}
      {event.linkUrl ? (
        <Pressable onPress={() => Linking.openURL(event.linkUrl as string)} style={styles.metaRow}>
          <Text style={styles.metaLabel}>Link</Text>
          <Text style={[styles.metaValue, styles.link]} numberOfLines={1}>
            {event.linkUrl}
          </Text>
        </Pressable>
      ) : null}

      {canManage ? (
        <View style={styles.buttonRow}>
          <Pressable
            style={styles.editButton}
            onPress={() => navigation.navigate("EditEvent", { event })}
            disabled={isDeleting}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isDeleting}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {showRsvps ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isLoadingRsvps ? "RSVPs" : `${rsvps.length} RSVP${rsvps.length === 1 ? "" : "s"}`}
          </Text>
          {rsvpsError ? (
            <Text style={styles.errorText}>{rsvpsError}</Text>
          ) : (
            <>
              <Pressable onPress={() => setRsvpsExpanded((v) => !v)}>
                <Text style={styles.linkButton}>{rsvpsExpanded ? "Hide list" : "Show list"}</Text>
              </Pressable>
              {rsvpsExpanded ? (
                isLoadingRsvps ? (
                  <ActivityIndicator style={styles.sectionLoading} color={colors.lilac.default} />
                ) : rsvps.length === 0 ? (
                  <Text style={styles.emptyText}>No RSVPs yet.</Text>
                ) : (
                  <View style={styles.list}>
                    {rsvps.map((r) => (
                      <View key={r.id} style={styles.listRow}>
                        <Text style={styles.listRowTitle}>
                          {r.first_name} {r.last_name}
                        </Text>
                        <Text style={styles.listRowSubtitle}>{r.email}</Text>
                      </View>
                    ))}
                  </View>
                )
              ) : null}
            </>
          )}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comments</Text>
        {commentsError ? (
          <Text style={styles.errorText}>{commentsError}</Text>
        ) : isLoadingComments && comments.length === 0 ? (
          <ActivityIndicator style={styles.sectionLoading} color={colors.lilac.default} />
        ) : comments.length === 0 ? (
          <Text style={styles.emptyText}>No comments yet.</Text>
        ) : (
          <View style={styles.list}>
            {comments.map((c) => (
              <View key={c.id} style={styles.listRow}>
                <View style={styles.commentHeader}>
                  <Text style={styles.listRowTitle}>{c.senderName}</Text>
                  <Text style={styles.commentTime}>{formatDateTime(c.createdAt)}</Text>
                </View>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))}
          </View>
        )}

        {commentSendError ? <Text style={styles.errorText}>{commentSendError}</Text> : null}

        <View style={styles.commentInputRow}>
          <TextInput
            style={[styles.input, styles.commentInput]}
            placeholder="Add a comment…"
            placeholderTextColor={colors.muted}
            value={commentText}
            onChangeText={setCommentText}
            editable={!isPostingComment}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!commentText.trim() || isPostingComment) && styles.sendButtonDisabled]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || isPostingComment}
          >
            {isPostingComment ? (
              <ActivityIndicator color={colors.ink} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink, padding: 24 },
  container: { padding: 20, backgroundColor: colors.ink, flexGrow: 1 },
  title: { fontFamily: typography.display, fontSize: 22, color: colors.parchment },
  description: { fontFamily: typography.body, fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
    marginTop: 4,
  },
  metaLabel: { fontFamily: typography.mono, fontSize: 12, color: colors.muted },
  metaValue: {
    fontFamily: typography.bodyMedium,
    fontSize: 13,
    color: colors.parchment,
    flexShrink: 1,
    textAlign: "right",
  },
  link: { color: colors.lilac.default, textDecorationLine: "underline" },
  errorText: { fontFamily: typography.body, color: colors.candle.default, fontSize: 14, marginTop: 16, textAlign: "center" },
  buttonRow: { flexDirection: "row", gap: 16, marginTop: 20 },
  editButton: {
    borderWidth: 1,
    borderColor: colors.lilac.default,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  editButtonText: { fontFamily: typography.bodySemibold, color: colors.lilac.default, fontSize: 14 },
  deleteButton: { paddingVertical: 8, paddingHorizontal: 4 },
  deleteButtonText: { fontFamily: typography.bodySemibold, color: colors.candle.default, fontSize: 14 },
  section: {
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  sectionTitle: { fontFamily: typography.bodySemibold, fontSize: 15, color: colors.parchment, marginBottom: 8 },
  sectionLoading: { marginTop: 12 },
  emptyText: { fontFamily: typography.body, color: colors.muted, fontSize: 13, marginTop: 8 },
  linkButton: { fontFamily: typography.bodyMedium, color: colors.lilac.default, fontSize: 13, marginTop: 4 },
  list: { marginTop: 12 },
  listRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  listRowTitle: { fontFamily: typography.bodySemibold, fontSize: 14, color: colors.parchment },
  listRowSubtitle: { fontFamily: typography.body, fontSize: 12, color: colors.muted, marginTop: 2 },
  commentHeader: { flexDirection: "row", justifyContent: "space-between" },
  commentTime: { fontFamily: typography.body, fontSize: 11, color: colors.muted },
  commentBody: { fontFamily: typography.body, fontSize: 14, color: colors.parchment, marginTop: 4, lineHeight: 19 },
  commentInputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: typography.body,
    fontSize: 15,
    color: colors.parchment,
    backgroundColor: colors.surface,
  },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 100 },
  sendButton: {
    backgroundColor: colors.lilac.default,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { fontFamily: typography.bodySemibold, color: colors.ink, fontSize: 14 },
});
