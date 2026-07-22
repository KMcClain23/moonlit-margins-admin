/**
 * SecureStore key constants, centralized here so modules that can't
 * import from each other (authStore.tsx and pushNotifications.ts, whose
 * cross-import would recreate the authStore<->api.ts require cycle
 * broken back in Phase 1) don't have to duplicate the literal to stay in
 * sync -- both import it from this shared, dependency-free module instead.
 */
export const SESSION_STORAGE_KEY = "mm_admin_session";
