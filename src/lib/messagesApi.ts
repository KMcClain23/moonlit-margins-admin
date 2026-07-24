import { apiFetch } from "./api";
import { withCache, type CachedResult } from "./offlineCache";

export type ConversationType = "direct" | "group" | "event";

/** Matches GET /api/admin/conversations's per-conversation shape exactly
 * (camelCase). `title` is already fully resolved server-side -- for
 * "direct" it's the other participant's name, for "group" it's the
 * stored title (or "Untitled group") -- so it can be displayed as-is. */
export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  createdAt: string;
  unreadCount: number;
  muted: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface AdminUserSummary {
  id: string;
  fullName: string;
}

// Task-type conversations are already excluded server-side. Event-type
// ones aren't -- the Events tab has its own dedicated comment thread UI
// for those (EventDetailScreen), so they're filtered out here to avoid
// showing the same thread twice in two different tabs.
export async function listConversations(): Promise<CachedResult<Conversation[]>> {
  return withCache("conversations", async () => {
    const data = await apiFetch<{ conversations: Conversation[] }>("/api/admin/conversations");
    return data.conversations.filter((c) => c.type !== "event");
  });
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  const data = await apiFetch<{ messages: Message[] }>(`/api/admin/conversations/${conversationId}/messages`);
  return data.messages;
}

export async function sendMessage(conversationId: string, body: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function createConversation(
  type: "direct" | "group",
  participantIds: string[],
  title?: string
): Promise<{ conversationId: string }> {
  return apiFetch<{ conversationId: string }>("/api/admin/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, participantIds, title }),
  });
}

export async function listAdminUsers(): Promise<AdminUserSummary[]> {
  const data = await apiFetch<{ users: AdminUserSummary[] }>("/api/admin/users");
  return data.users;
}

// Removes only the caller's own participation -- the conversation, its
// messages, and every other participant are untouched.
export async function leaveConversation(conversationId: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

// Suppresses push notifications for this conversation only -- messages,
// unread counts, and email notifications are unaffected server-side.
export async function muteConversation(conversationId: string, muted: boolean): Promise<{ success: true; muted: boolean }> {
  return apiFetch<{ success: true; muted: boolean }>(`/api/admin/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ muted }),
  });
}

// Sets or clears the requester's own last_read_at for this conversation --
// `read: true` marks everything read so far, `read: false` marks it
// fully unread again (server clears last_read_at entirely).
export async function setConversationReadState(conversationId: string, read: boolean): Promise<{ success: true; read: boolean }> {
  return apiFetch<{ success: true; read: boolean }>(`/api/admin/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ read }),
  });
}

// Group conversations only -- the server rejects this for type "direct",
// whose title is always computed from the other participant's name and
// never stored. Any current participant can rename, not just whoever
// created the group.
export async function renameConversation(conversationId: string, title: string): Promise<{ success: true; title: string }> {
  return apiFetch<{ success: true; title: string }>(`/api/admin/conversations/${conversationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}
