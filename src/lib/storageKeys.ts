/**
 * SecureStore key constants, centralized here so modules that can't
 * import from each other (authStore.tsx and pushNotifications.ts, whose
 * cross-import would recreate the authStore<->api.ts require cycle
 * broken back in Phase 1) don't have to duplicate the literal to stay in
 * sync -- both import it from this shared, dependency-free module instead.
 */
export const SESSION_STORAGE_KEY = "mm_admin_session";

// Message Settings screen preferences -- device-level, independent of
// whichever admin account is currently signed in.
export const PUSH_ENABLED_STORAGE_KEY = "mm_admin_push_enabled";
export const NOTIFICATION_SOUND_STORAGE_KEY = "mm_admin_notif_sound";
export const NOTIFICATION_VIBRATION_STORAGE_KEY = "mm_admin_notif_vibration";

// Per-conversation accent color theme -- device-local only, never synced
// server-side. Keyed per conversation id rather than a single flat key,
// so this is a prefix: the full key is this plus the conversation's id,
// built in conversationThemes.ts.
export const CONVERSATION_THEME_STORAGE_KEY_PREFIX = "mm_admin_conversation_theme_";

// Whether Face ID/fingerprint gates re-entry to the app -- device-level,
// independent of whichever admin account is currently signed in.
export const BIOMETRIC_LOCK_ENABLED_STORAGE_KEY = "mm_admin_biometric_lock_enabled";
