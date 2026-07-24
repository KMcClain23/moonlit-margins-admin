import { apiFetch } from "./api";
import { withCache, type CachedResult } from "./offlineCache";
import { uploadToPresignedUrl } from "./uploadMedia";
import type { SocialsMap } from "./socials";

export type MemberTier = "founder" | "council" | "junior_council" | "member";

export const TIER_LABELS: Record<MemberTier, string> = {
  founder: "Founder",
  council: "Council",
  junior_council: "Junior Council",
  member: "Member",
};

/** Matches GET /api/admin/members's shape exactly (camelCase). Also backs
 * the Tasks tab's assignment picker, which only reads id/fullName and
 * ignores the rest. */
export interface Member {
  id: string;
  fullName: string;
  role: string | null;
  bio: string | null;
  email: string | null;
  photoUrl: string | null;
  photoZoom: number;
  photoOffsetX: number;
  photoOffsetY: number;
  tier: MemberTier;
  socials: SocialsMap;
}

export async function listMembers(): Promise<CachedResult<Member[]>> {
  return withCache("members", async () => {
    const data = await apiFetch<{ members: Member[] }>("/api/admin/members");
    return data.members;
  });
}

/** Same shape for both POST (create) and PATCH (update). */
export interface MemberInput {
  fullName: string;
  role?: string;
  bio?: string;
  email?: string;
  photoUrl?: string;
  photoZoom?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
  tier?: MemberTier;
  socials?: SocialsMap;
}

export async function createMember(input: MemberInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/admin/members", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateMember(id: string, input: MemberInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/members/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMember(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/members/${id}`, { method: "DELETE" });
}

export async function uploadMemberPhoto(localUri: string, fileName: string, fileType: string): Promise<string> {
  return uploadToPresignedUrl("members", fileName, fileType, localUri);
}
