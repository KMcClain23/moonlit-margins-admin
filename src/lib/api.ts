import { API_BASE_URL } from "../config";
import { getToken } from "./authStore";
import { ApiError } from "./apiError";

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

/**
 * Typed fetch wrapper for the moonlit-margins admin API. Prepends
 * API_BASE_URL, attaches the current bearer token (if any) via
 * getToken(), and throws ApiError on any non-2xx response instead of
 * resolving with an error body the caller has to check for by hand.
 */
export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  return (await response.json()) as T;
}
