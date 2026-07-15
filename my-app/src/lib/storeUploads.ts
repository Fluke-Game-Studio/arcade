import type { ApiClient } from "../api/client";

export type StoreUploadProgress = (pct: number) => void;

export type UploadedStoreImage = {
  name: string;
  mimeType: string;
  size: number;
  s3Key: string;
  publicUrl?: string;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeMimeType(file: File) {
  return file.type?.trim() || "application/octet-stream";
}

export function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: StoreUploadProgress
) {
  const contentType = normalizeMimeType(file);

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText || "unknown error"}`));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error while uploading file. Check S3 bucket CORS and presigned upload configuration."));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });
}

export async function uploadFileToStoreImages(
  api: ApiClient,
  file: File,
  itemName: string,
  onProgress: StoreUploadProgress = () => {}
): Promise<UploadedStoreImage> {
  const resp = await api.createStoreImageUploadUrls({
    itemName: safeStr(itemName),
    files: [
      {
        fileName: safeStr(file.name) || "upload",
        mimeType: normalizeMimeType(file),
        size: file.size,
      },
    ],
  });

  const item = Array.isArray(resp?.files) ? resp.files[0] : null;
  if (!item?.uploadUrl || !item?.s3Key) {
    throw new Error("Failed to create store image upload URL.");
  }

  await uploadFileWithProgress(item.uploadUrl, file, onProgress);

  return {
    name: file.name,
    mimeType: normalizeMimeType(file),
    size: file.size,
    s3Key: item.s3Key,
    publicUrl: item.publicUrl,
  };
}
