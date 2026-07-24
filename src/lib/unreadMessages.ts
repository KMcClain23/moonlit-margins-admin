import { useEffect, useState } from "react";
import { listConversations } from "./messagesApi";

type Listener = (count: number) => void;

let currentCount = 0;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener(currentCount));
}

/**
 * Refetches the total unread count across all conversations and
 * notifies every subscriber (the Messages tab badge) immediately.
 *
 * Call this whenever something local just changed server-side unread
 * state -- most importantly, ConversationDetailScreen after it fetches
 * messages (which is also the moment the backend marks that
 * conversation read) -- instead of leaving the tab badge to eventually
 * catch up on its own polling interval. Without this, the badge could
 * show a stale count for up to that interval's length after the real
 * count had already changed, while anything that re-fetches on its own
 * (like the conversations list, on every focus) would already be showing
 * the correct, lower number -- looking like the list was wrong when it
 * was actually the tab lagging behind.
 */
export async function refreshUnreadCount(): Promise<void> {
  try {
    const { data: conversations } = await listConversations();
    currentCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    notify();
  } catch {
    // Best-effort -- a failed refresh just leaves the badge as it was.
  }
}

/** Pushes a known total directly, for callers that already have the
 * full conversations list on hand (ConversationsListScreen, right after
 * its own fetch) -- skips the redundant extra round trip
 * refreshUnreadCount() would otherwise make to re-fetch the same data. */
export function setUnreadCount(count: number): void {
  currentCount = count;
  notify();
}

/** Subscribes to the shared unread count, polling at the given interval
 * as a fallback for changes this app instance didn't cause itself (e.g.
 * a message arriving in a conversation that's never been opened here). */
export function useUnreadMessagesCount(pollIntervalMs: number): number {
  const [count, setCount] = useState(currentCount);

  useEffect(() => {
    const listener: Listener = (next) => setCount(next);
    listeners.add(listener);

    void refreshUnreadCount();
    const interval = setInterval(() => void refreshUnreadCount(), pollIntervalMs);

    return () => {
      listeners.delete(listener);
      clearInterval(interval);
    };
  }, [pollIntervalMs]);

  return count;
}
