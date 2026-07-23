import { apiFetch } from "./api";
import type { AdminRole } from "./authStore";

/**
 * Matches GET /api/admin/me's response shape (camelCase). Mirrors
 * AdminSession's fields, plus photoUrl -- the one field not already
 * carried in the stored session, since login/token-login's response was
 * never extended to include it. Screens that need the photo fetch this
 * endpoint directly instead.
 */
export interface AdminMeResponse {
  adminUserId: string;
  memberId: string | null;
  fullName: string;
  role: AdminRole;
  sections: string[];
  mustChangePassword: boolean;
  canAssignTasks: boolean;
  photoUrl: string | null;
}

export async function getMe(): Promise<AdminMeResponse> {
  return apiFetch<AdminMeResponse>("/api/admin/me");
}
