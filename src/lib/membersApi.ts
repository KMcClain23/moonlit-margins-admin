import { apiFetch } from "./api";

/** Matches GET /api/admin/members's shape -- id/fullName only, meant for
 * the task-assignment picker, not a full member profile. */
export interface MemberOption {
  id: string;
  fullName: string;
}

export async function listMembers(): Promise<MemberOption[]> {
  const data = await apiFetch<{ members: MemberOption[] }>("/api/admin/members");
  return data.members;
}
