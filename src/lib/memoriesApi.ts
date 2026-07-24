import { apiFetch } from "./api";
import { withCache, type CachedResult } from "./offlineCache";
import { uploadToPresignedUrl } from "./uploadMedia";

export type MemoryMediaType = "image" | "video";

/** Matches GET /api/admin/memories's shape exactly (camelCase). Already
 * sorted server-side by effective date (publishedAt ?? createdAt)
 * descending -- listMemories() doesn't re-sort. */
export interface Memory {
  id: string;
  mediaType: MemoryMediaType;
  imageUrl: string;
  thumbnailUrl: string | null;
  title: string | null;
  caption: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export async function listMemories(): Promise<CachedResult<Memory[]>> {
  return withCache("memories", async () => {
    const data = await apiFetch<{ memories: Memory[] }>("/api/admin/memories");
    return data.memories;
  });
}

/** Same shape for both POST (create) and PATCH (update). Field is named
 * imageUrl (matching the backend) even though it holds the media URL
 * regardless of type -- mediaType is derived server-side from the URL's
 * extension, never sent by the client. */
export interface MemoryInput {
  imageUrl: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  publishedAt?: string;
}

export async function createMemory(input: MemoryInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>("/api/admin/memories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateMemory(id: string, input: MemoryInput): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/memories/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteMemory(id: string): Promise<{ success: true }> {
  return apiFetch<{ success: true }>(`/api/admin/memories/${id}`, { method: "DELETE" });
}

/** onProgress (0-1) is optional -- MemoryForm passes it to drive a real
 * "Uploading… N%" indicator, since video files can take long enough that
 * an indeterminate spinner alone feels stuck. */
export async function uploadMemoryMedia(
  localUri: string,
  fileName: string,
  fileType: string,
  onProgress?: (fraction: number) => void
): Promise<string> {
  return uploadToPresignedUrl("memories", fileName, fileType, localUri, onProgress);
}
