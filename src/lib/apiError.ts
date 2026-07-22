/**
 * Thrown by apiFetch (and the direct-fetch calls that can't use apiFetch,
 * like authStore's login()) for any non-2xx response. `message` prefers
 * the server's own `{ error }` body (a string, or a zod field-error object
 * stringified) over the generic HTTP status text, since the admin API
 * routes consistently return a useful `error` field.
 */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
