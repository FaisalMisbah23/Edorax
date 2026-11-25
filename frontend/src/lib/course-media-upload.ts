import { ApiError, parseApiResponse } from "@/lib/api-client";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function uploadCourseImage(courseId: string, purpose: "cover" | "content", file: File): Promise<string> {
  if (!IMAGE_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, WebP, GIF, or AVIF image.");
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error("Choose an image smaller than 8 MB.");
  const response = await fetch(`/api/v1/teach/courses/${encodeURIComponent(courseId)}/media/${purpose}`, {
    method: "POST",
    headers: { "Content-Type": file.type, Accept: "application/json" },
    body: file,
    credentials: "same-origin",
  });
  const result = await parseApiResponse<{ url: string }>(response);
  return result.url;
}

/**
 * Uploads a screenshot for a course announcement and reports progress (0 to 100) as it goes.
 * fetch() cannot report upload progress, so this one uses XMLHttpRequest. The caller checks the
 * file type and size first.
 */
export function uploadAnnouncementScreenshot(courseId: string, file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `/api/v1/teach/courses/${encodeURIComponent(courseId)}/media/announcement`);
    request.setRequestHeader("Content-Type", file.type);
    request.setRequestHeader("Accept", "application/json");
    request.withCredentials = true;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onerror = () => reject(new ApiError("The upload stopped. Check your connection and try again.", 503, "API_UNAVAILABLE"));
    request.onload = () => {
      if (request.status < 200) {
        reject(new ApiError("The upload stopped. Please try again.", 503, "API_UNAVAILABLE"));
        return;
      }
      const response = new Response(request.responseText || null, { status: request.status === 204 ? 200 : request.status });
      parseApiResponse<{ url: string }>(response).then((result) => resolve(result.url), reject);
    };
    request.send(file);
  });
}
