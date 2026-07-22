import { apiFetch } from "./api";

export type EventType =
  | "reading_sprint"
  | "tiktok_live"
  | "author_event"
  | "annual_meetup"
  | "game_night"
  | "other";
export type RegistrationType = "rsvp" | "ticketing";
export type EventStatus = "scheduled" | "canceled";
export type TargetTier = "founder" | "council" | "junior_council" | "member";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  reading_sprint: "Reading sprint",
  tiktok_live: "TikTok live",
  author_event: "Author event",
  annual_meetup: "Annual meetup",
  game_night: "Game night",
  other: "Other",
};

export const REGISTRATION_TYPE_LABELS: Record<RegistrationType, string> = {
  rsvp: "Free RSVP",
  ticketing: "Ticketed",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  scheduled: "Scheduled",
  canceled: "Canceled",
};

export const TIER_LABELS: Record<TargetTier, string> = {
  founder: "Founder",
  council: "Council",
  junior_council: "Junior council",
  member: "Member",
};

/** targetTiers on an Event is raw string[] from the DB, not necessarily
 * narrowed to TargetTier -- this falls back to the raw value for anything
 * unrecognized instead of throwing, matching the web admin's
 * `TIER_LABELS[t] ?? t` behavior. */
export function tierLabel(tier: string): string {
  return (TIER_LABELS as Record<string, string>)[tier] ?? tier;
}

/** Matches GET /api/admin/events's per-event shape exactly (camelCase). */
export interface Event {
  id: string;
  title: string;
  description: string | null;
  eventType: EventType;
  startsAt: string;
  location: string | null;
  linkUrl: string | null;
  coverImageUrl: string | null;
  registrationType: RegistrationType;
  status: EventStatus;
  isPrivate: boolean;
  targetTiers: string[] | null;
  slug: string | null;
}

export async function listEvents(): Promise<Event[]> {
  const data = await apiFetch<{ events: Event[] }>("/api/admin/events");
  return data.events;
}

/**
 * Same shape for both POST (create) and PATCH (update) -- PATCH is a
 * full-replace, not a partial update, so every field is always sent
 * (empty string rather than omitted, mirroring the web form's FormData
 * submission) so that clearing an optional field on edit actually clears
 * it server-side instead of leaving the key absent.
 */
export interface EventInput {
  title: string;
  description: string;
  eventType: EventType;
  startsAt: string;
  location: string;
  linkUrl: string;
  coverImageUrl: string;
  registrationType: RegistrationType;
  status: EventStatus;
  isPrivate: boolean;
  targetTiers: string[];
}

// Creating a private event with targetTiers triggers a one-time invite
// email to matching members, fired server-side only at creation time.
// Editing an existing private event's tiers via updateEvent below does
// NOT re-send invites -- that matches the web admin's behavior exactly
// and isn't a bug to fix.
export async function createEvent(input: EventInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/admin/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateEvent(id: string, input: EventInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteEvent(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/events/${id}`, { method: "DELETE" });
}

/** This route was never migrated to the camelCase convention the rest of
 * the admin API uses -- keep first_name/last_name/created_at as-is rather
 * than assuming it matches. */
export interface Rsvp {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export async function listEventRsvps(eventId: string): Promise<Rsvp[]> {
  const data = await apiFetch<{ rsvps: Rsvp[] }>(`/api/admin/events/${eventId}/rsvps`);
  return data.rsvps;
}

export interface EventComment {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export async function listEventComments(eventId: string): Promise<EventComment[]> {
  const data = await apiFetch<{ messages: EventComment[] }>(`/api/admin/events/${eventId}/comments`);
  return data.messages;
}

export async function postEventComment(eventId: string, body: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/events/${eventId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}
