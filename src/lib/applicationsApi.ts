import { apiFetch } from "./api";

export type ApplicationKind = "member" | "interview" | "collab";
export type ApplicationStatus = "pending" | "in_review" | "accepted" | "declined";
export type ApplicationView = "active" | "archived";

/** Matches GET /api/admin/applications's per-application shape exactly (camelCase). */
export interface Application {
  id: string;
  kind: ApplicationKind;
  status: ApplicationStatus;
  fullName: string;
  email: string;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  answers: Record<string, string>;
  createdAt: string;
}

export async function listApplications(
  kind: "all" | ApplicationKind = "all",
  view: ApplicationView = "active"
): Promise<Application[]> {
  const params = new URLSearchParams({ kind, view });
  const data = await apiFetch<{ applications: Application[] }>(`/api/admin/applications?${params.toString()}`);
  return data.applications;
}

export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus
): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/applications/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteApplication(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/applications/${id}`, { method: "DELETE" });
}
