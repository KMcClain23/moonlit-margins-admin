import * as FileSystem from "expo-file-system/legacy";
import { apiFetch } from "./api";
import { ApiError } from "./apiError";

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Shared by membersApi.ts (photos) and memoriesApi.ts (photos + videos):
 * gets a presigned R2 upload URL from the backend, then PUTs the file
 * bytes directly to R2 from the local file URI -- an upload task streams
 * straight from disk rather than loading the whole file into JS memory as
 * a blob first. Returns the final publicUrl to store once the direct
 * upload succeeds.
 *
 * onProgress (0-1) is optional -- memoriesApi.ts's video uploads can run
 * long enough to want a progress indicator; membersApi.ts's photo
 * uploads don't bother passing one.
 */
export async function uploadToPresignedUrl(
  folder: string,
  fileName: string,
  fileType: string,
  localUri: string,
  onProgress?: (fraction: number) => void
): Promise<string> {
  const { uploadUrl, publicUrl } = await apiFetch<PresignedUpload>("/api/admin/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, fileType, folder }),
  });

  const task = FileSystem.createUploadTask(
    uploadUrl,
    localUri,
    { httpMethod: "PUT", headers: { "Content-Type": fileType } },
    onProgress
      ? (data) => {
          if (data.totalBytesExpectedToSend > 0) {
            onProgress(data.totalBytesSent / data.totalBytesExpectedToSend);
          }
        }
      : undefined
  );

  const result = await task.uploadAsync();

  if (!result || result.status < 200 || result.status >= 300) {
    throw new ApiError(result?.status ?? 0, "Could not upload that file");
  }

  return publicUrl;
}
