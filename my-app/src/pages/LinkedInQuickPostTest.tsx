import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

// Temporary, minimal page used only for the LinkedIn API app review demo.
// Shown instead of the full Social Media hub when the logged-in account's
// role is "test" (see main.tsx / SocialMediaEntry.tsx). Delete this file,
// the SocialMediaEntry wrapper, and services/linkedin.mjs::publishLinkedInOrgPost
// once LinkedIn's Community Management API review is complete.
export default function LinkedInQuickPostTest() {
  const { api } = useAuth();
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await api.publishLinkedInOrgPost({
        caption: caption.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      setResult({ ok: true, message: `Posted to LinkedIn${resp.postId ? ` (${resp.postId})` : ""}.` });
      setCaption("");
      setImageUrl("");
    } catch (err: any) {
      setResult({ ok: false, message: err?.message || "Failed to post" });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !submitting && (caption.trim() || imageUrl.trim());

  return (
    <div style={{ maxWidth: 560, margin: "60px auto", padding: 24 }}>
      <div
        style={{
          border: "1px solid #e6edf2",
          borderRadius: 18,
          background: "#fff",
          padding: 24,
          boxShadow: "0 10px 24px rgba(15,23,42,.04)",
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 18, color: "#0f172a" }}>Post to LinkedIn</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
          Write a caption and/or paste an image URL, then post it to the connected LinkedIn Company Page.
        </div>

        <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Image URL (optional)</label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 10, marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              placeholder="What do you want to say?"
              style={{ width: "100%", borderRadius: 10, border: "1px solid #cbd5e1", padding: 10, marginTop: 4 }}
            />
          </div>

          <button type="button" className="btn" disabled={!canSubmit} onClick={() => void submit()}>
            {submitting ? "Posting..." : "Post to LinkedIn"}
          </button>

          {result ? (
            <div
              style={{
                marginTop: 4,
                borderRadius: 10,
                padding: 12,
                fontWeight: 700,
                color: result.ok ? "#166534" : "#991b1b",
                background: result.ok ? "#dcfce7" : "#fee2e2",
              }}
            >
              {result.message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
