import * as QuickActions from "expo-quick-actions";
import type { Action } from "expo-quick-actions";

// Each id doubles as the routing key navigationRef.ts switches on when a
// shortcut is tapped -- kept here (the module that owns "what shortcuts
// exist") rather than there (which only owns "how to navigate once one
// fires").
export type ShortcutActionId = "new-task" | "new-message" | "new-event" | "new-memory";

const SHORTCUT_ACTION_IDS: readonly ShortcutActionId[] = ["new-task", "new-message", "new-event", "new-memory"];

export function isShortcutActionId(id: string): id is ShortcutActionId {
  return (SHORTCUT_ACTION_IDS as readonly string[]).includes(id);
}

// Registered unconditionally, independent of session/permissions -- who's
// actually allowed to use each one is resolved when it's tapped instead
// (see navigationRef.ts's navigateForQuickAction), since a shortcut can be
// tapped before the app -- let alone its session state -- has loaded at
// all. Icon names double as the Android resource keys the
// expo-quick-actions config plugin generates (see app.json's
// androidIcons) -- Android resource filenames must be lowercase with
// underscores only (Android's build tooling hard-rejects anything else,
// e.g. "capturePhoto" broke :app:mergeReleaseResources), so every icon
// name here has to satisfy that regardless of what's convenient on iOS.
// "task"/"message"/"date" also happen to be Apple's own built-in icon
// names, so those three resolve to a native system glyph on iOS for
// free. "capture_photo" does NOT match Apple's built-in "capturePhoto"
// name (case matters there), so on iOS it falls back to looking for a
// bundled custom image named "capture_photo" -- none exists, so New
// Memory currently renders without a distinct icon on iOS specifically.
// Fixable by adding a "capture_photo" entry to this plugin's iosIcons
// config with a real asset, if that's ever worth doing for an
// Android-primary app.
const SHORTCUT_ITEMS: Action[] = [
  { id: "new-task", title: "New Task", icon: "task" },
  { id: "new-message", title: "New Message", icon: "message" },
  { id: "new-event", title: "New Event", icon: "date" },
  { id: "new-memory", title: "New Memory", icon: "capture_photo" },
];

/**
 * (Re-)registers the app's 4 home-screen quick actions. setItems() fully
 * replaces whatever was previously registered, so this is safe to call
 * repeatedly. Called once at app startup (independent of login state, so
 * a never-logged-in install still gets shortcuts) and again after every
 * successful login per authStore.tsx -- the list itself doesn't vary by
 * session today (permission gating happens at tap time, not registration
 * time), but re-asserting it post-login keeps that possible later
 * without adding a second call site.
 */
export async function registerQuickActions(): Promise<void> {
  try {
    await QuickActions.setItems(SHORTCUT_ITEMS);
  } catch {
    // Best-effort -- an unsupported device/platform, or a transient OS
    // error, just means no shortcuts appear on long-press, not a broken app.
  }
}
