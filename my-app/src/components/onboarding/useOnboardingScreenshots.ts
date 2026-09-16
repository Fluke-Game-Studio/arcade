import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "../../api/client";
import { uploadFileWithProgress } from "../../lib/socialUploads";

type Screenshot = { s3Key: string; name: string; url: string };
type Pending = { instructionId: string; s3Key: string; name: string };
export function useOnboardingScreenshots(api: ApiClient, projectId: string, kind: "screenshot" | "installer" = "screenshot") {
  const installer = kind === "installer";
  const [images, setImages] = useState<Record<string, Screenshot>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const uploading = useRef(false);
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getProjectOnboardingScreenshots(projectId).then(response => {
      if (!cancelled) { setImages((installer ? response.installers : response.screenshots) || {}); setLoadError(""); }
    }).catch(err => { if (!cancelled) setLoadError(err?.message || "Could not load attachments."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    const timer = window.setTimeout(refresh, 12 * 60 * 1000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [api, projectId, reload, refresh, installer]);
  async function attach(upload: Pending) {
    const result = await api.updateProjectOnboardingScreenshot(projectId, { action: "attach", kind, ...upload });
    if (!result[kind]?.url) throw new Error("Attachment saved but its link could not be loaded. Retry saving or refresh.");
    setImages(current => ({ ...current, [upload.instructionId]: result[kind] }));
    setPending(null);
  }
  async function upload(instructionId: string, file: File) {
    if (uploading.current || busy || pending || loading) return;
    setError("");
    if (!(installer ? /^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,110}\.(exe|msi)$/i.test(file.name) : ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) || !file.size || file.size > (installer ? 250 : 10) * 1024 * 1024) {
      setError(installer ? "Choose an EXE or MSI up to 250 MB with a simple filename (letters, numbers, spaces, dots, hyphens or underscores)." : "Choose a PNG, JPEG, WebP, or GIF screenshot up to 10 MB."); return;
    }
    uploading.current = true;
    setBusy(instructionId); setProgress(0);
    try {
      const signed = await api.updateProjectOnboardingScreenshot(projectId, {
        action: "upload", kind, instructionId, fileName: file.name, mimeType: file.type.trim() || "application/octet-stream", size: file.size,
      });
      if (!signed.uploadUrl || !signed.s3Key) throw new Error("Could not prepare attachment upload.");
      await uploadFileWithProgress(signed.uploadUrl, file, setProgress);
      const next = { instructionId, s3Key: signed.s3Key, name: file.name };
      setPending(next);
      await attach(next);
    } catch (err: any) { setError(err?.message || "Attachment upload failed."); }
    finally { uploading.current = false; setBusy(""); }
  }
  async function retry() {
    if (!pending || uploading.current || busy) return;
    uploading.current = true;
    setBusy(pending.instructionId); setError("");
    try { await attach(pending); }
    catch (err: any) { setError(err?.message || "Could not save attachment."); }
    finally { uploading.current = false; setBusy(""); }
  }
  async function changeScreenshot(instructionId: string, sourceInstructionId?: string) {
    if (installer || uploading.current || busy || pending || loading) return;
    uploading.current = true;
    setBusy(instructionId); setProgress(100); setError("");
    try {
      const result = await api.updateProjectOnboardingScreenshot(projectId, {
        action: sourceInstructionId ? "reuse" : "delete", instructionId, sourceInstructionId,
      });
      if (sourceInstructionId && !result.screenshot?.url) throw new Error("Could not load the reused screenshot.");
      setImages(current => {
        const next = { ...current };
        if (sourceInstructionId) next[instructionId] = result.screenshot;
        else delete next[instructionId];
        return next;
      });
    } catch (err: any) { setError(err?.message || "Could not update screenshot."); }
    finally { uploading.current = false; setBusy(""); }
  }
  return { images, loading, loadError, error, busy, progress, pending, upload, retry, refresh, changeScreenshot };
}
