import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "../config";
import { ApiError } from "./apiError";
import { clearBadgeCount, setupPushNotifications, unregisterPushNotifications } from "./pushNotifications";
import { registerQuickActions } from "./quickActions";
import { SESSION_STORAGE_KEY } from "./storageKeys";

export type AdminRole = "owner" | "admin" | "editor";

export type AdminSession = {
  token: string;
  adminUserId: string;
  memberId: string | null;
  fullName: string;
  role: AdminRole;
  sections: string[];
  mustChangePassword: boolean;
  canAssignTasks: boolean;
};

export async function saveSession(session: AdminSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

export async function getSession(): Promise<AdminSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

/** Used by apiFetch (src/lib/api.ts) to attach the Authorization header --
 * reads straight from SecureStore rather than React state, since it needs
 * to work from any call site, not just inside components. */
export async function getToken(): Promise<string | null> {
  const session = await getSession();
  return session?.token ?? null;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const err = (body as { error: unknown }).error;
      if (typeof err === "string") return err;
      if (err && typeof err === "object") return JSON.stringify(err);
    }
  } catch {
    // Response wasn't JSON (or had no body) -- fall through to the generic message.
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

type AuthContextValue = {
  session: AdminSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSession().then((stored) => {
      if (cancelled) return;
      setSession(stored);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A plain fetch() rather than apiFetch() -- apiFetch lives in ./api,
  // which itself imports getToken from this file for its Authorization
  // header logic. Calling back into api.ts here would recreate the same
  // require cycle this file was just pulled out of.
  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/token-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new ApiError(response.status, await extractErrorMessage(response));
    }

    const next = (await response.json()) as AdminSession;
    await saveSession(next);
    setSession(next);

    // Fire-and-forget: push registration involves a permission prompt and
    // a network round trip, neither of which should hold up navigating
    // away from the login screen. setupPushNotifications() is already
    // fully best-effort internally (see pushNotifications.ts).
    void setupPushNotifications();

    // Re-asserts the same quick-action list App.tsx already registered
    // at startup -- a no-op today (see quickActions.ts), but keeps this
    // call site in place for if the list ever needs to vary per-session
    // in the future, in case a different admin with different
    // permissions has since logged into this same device.
    void registerQuickActions();
  }, []);

  const logout = useCallback(async () => {
    try {
      await unregisterPushNotifications();
    } catch {
      // Never block sign-out on push-token cleanup failing.
    }
    void clearBadgeCount();
    await clearSession();
    setSession(null);
  }, []);

  // Re-registers this device's push token whenever the app returns to the
  // foreground while signed in -- the token can rotate, and the backend
  // upsert on (admin_user_id, device_id) makes re-sending an unchanged
  // token a harmless no-op.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === "active" && sessionRef.current) {
        void setupPushNotifications();
      }
    }
    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isLoading, login, logout }),
    [session, isLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
