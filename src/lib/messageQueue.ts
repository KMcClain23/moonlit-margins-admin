import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { isLikelyNetworkError } from "./offlineCache";
import { sendMessage } from "./messagesApi";

export type QueuedMessageStatus = "pending" | "failed";

export interface QueuedMessage {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  status: QueuedMessageStatus;
}

const QUEUE_STORAGE_KEY = "mm_admin_message_queue";

async function readQueue(): Promise<QueuedMessage[]> {
  const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedMessage[];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedMessage[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  notifyQueueChanged();
}

// Mirrors unreadMessages.ts's own listener-Set pub/sub -- lets
// ConversationDetailScreen (if the affected conversation is the one
// currently open) react immediately when the queue changes for reasons
// outside its own control, most importantly flushMessageQueue() running
// from the global NetInfo listener in App.tsx.
type QueueListener = () => void;
const listeners = new Set<QueueListener>();

function notifyQueueChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToQueueChanges(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Persists a new outgoing message as 'pending' and returns it so the
 * caller can render it optimistically right away using the same id. */
export async function enqueueMessage(conversationId: string, body: string): Promise<QueuedMessage> {
  const message: QueuedMessage = {
    id: Crypto.randomUUID(),
    conversationId,
    body,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  const queue = await readQueue();
  queue.push(message);
  await writeQueue(queue);
  return message;
}

export async function getQueuedMessages(conversationId: string): Promise<QueuedMessage[]> {
  const queue = await readQueue();
  return queue.filter((m) => m.conversationId === conversationId);
}

/** Every queued message across every conversation -- what
 * flushMessageQueue() below retries, not just whichever conversation
 * happens to be open right now. */
export async function getAllQueuedMessages(): Promise<QueuedMessage[]> {
  return readQueue();
}

export async function removeFromQueue(localId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.filter((m) => m.id !== localId));
}

async function markQueuedMessageFailed(localId: string): Promise<void> {
  const queue = await readQueue();
  await writeQueue(queue.map((m) => (m.id === localId ? { ...m, status: "failed" } : m)));
}

/**
 * Retries a single queued message on demand -- the "tap the red retry
 * icon" path, as opposed to flushMessageQueue()'s automatic
 * regained-connectivity sweep. Returns true on success. A network error
 * here just means still offline, so the item is left exactly as it was
 * (flushMessageQueue will pick it up once connectivity actually
 * returns); any other error marks it 'failed' again.
 */
export async function retryQueuedMessage(localId: string): Promise<boolean> {
  const queue = await readQueue();
  const item = queue.find((m) => m.id === localId);
  if (!item) return false;

  try {
    await sendMessage(item.conversationId, item.body);
    await removeFromQueue(localId);
    return true;
  } catch (err) {
    if (!isLikelyNetworkError(err)) {
      await markQueuedMessageFailed(localId);
    }
    return false;
  }
}

/**
 * Retries every queued message, across every conversation, in order --
 * called from the NetInfo "regained connectivity" listener in App.tsx.
 * Successfully-sent items are removed from the queue (notifying any
 * subscribed screen so a visible optimistic bubble updates to the
 * confirmed copy); a real failure marks that item 'failed' and moves on
 * to the next one rather than giving up on the whole queue. If a retry
 * fails because the connection dropped again mid-flush, the sweep stops
 * there instead of marking every remaining item 'failed' -- the next
 * reconnect will pick up where this one left off.
 */
export async function flushMessageQueue(): Promise<void> {
  const queue = await readQueue();
  for (const item of queue) {
    if (item.status === "failed") continue;
    try {
      await sendMessage(item.conversationId, item.body);
      await removeFromQueue(item.id);
    } catch (err) {
      if (isLikelyNetworkError(err)) {
        return;
      }
      await markQueuedMessageFailed(item.id);
    }
  }
}
