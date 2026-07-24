import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "./apiError";

const CACHE_KEY_PREFIX = "mm_admin_offline_cache_";

export interface CachedResult<T> {
  data: T;
  /** True when this came from AsyncStorage instead of a fresh fetch --
   * callers should show an indicator (see OfflineBanner) rather than
   * silently presenting stale data as current. */
  stale: boolean;
  /** When the returned data was actually fetched -- null only when
   * `stale` is false (a fresh fetch always has "now" as its own cachedAt,
   * but callers care about staleness, not the fresh timestamp, so it's
   * omitted then). */
  cachedAt: string | null;
}

interface StoredCacheEntry<T> {
  data: T;
  cachedAt: string;
}

function storageKeyFor(cacheKey: string): string {
  return `${CACHE_KEY_PREFIX}${cacheKey}`;
}

// apiFetch throws ApiError for any non-2xx HTTP response -- a real
// answer from the server (401/403/500/etc), not a connectivity problem,
// so it should always propagate normally rather than falling back to
// cache. Anything else thrown before a response was ever obtained (React
// Native's fetch polyfill throws a plain TypeError for "no connection,"
// and some platforms/paths surface it as a different Error with a
// network-flavored message) is treated as the "no connection" case this
// module exists to soften. Exported so messageQueue.ts and
// ConversationDetailScreen's send flow can apply the exact same
// distinction rather than re-implementing it.
export function isLikelyNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) return /network|fetch failed|internet/i.test(err.message);
  return false;
}

/**
 * Wraps a fetch call with an AsyncStorage-backed fallback.
 *
 * On success: returns `{ data, stale: false, cachedAt: null }` and
 * persists `data` as the new cache entry for `cacheKey`.
 *
 * On a genuine connectivity failure (see isLikelyNetworkError): returns
 * the last cached value for `cacheKey` instead of throwing, marked
 * `stale: true` with the `cachedAt` timestamp of when that value was
 * originally fetched, so callers can show a "showing cached data from
 * [time]" indicator instead of silently presenting it as fresh.
 *
 * A real API error (401/403/500/etc), or a connectivity failure with
 * nothing cached yet for this key, still throws normally -- there's
 * nothing useful to fall back to in either case.
 */
export async function withCache<T>(cacheKey: string, fetchFn: () => Promise<T>): Promise<CachedResult<T>> {
  const key = storageKeyFor(cacheKey);

  try {
    const data = await fetchFn();
    const entry: StoredCacheEntry<T> = { data, cachedAt: new Date().toISOString() };
    try {
      await AsyncStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Best-effort -- a write failure shouldn't turn a successful fetch
      // into a thrown error for the caller.
    }
    return { data, stale: false, cachedAt: null };
  } catch (err) {
    if (!isLikelyNetworkError(err)) {
      throw err;
    }

    const raw = await AsyncStorage.getItem(key).catch(() => null);
    if (!raw) {
      // Nothing cached for this key yet -- the original connectivity
      // error is more useful to the caller than silently swallowing it.
      throw err;
    }

    try {
      const entry = JSON.parse(raw) as StoredCacheEntry<T>;
      return { data: entry.data, stale: true, cachedAt: entry.cachedAt };
    } catch {
      throw err;
    }
  }
}
