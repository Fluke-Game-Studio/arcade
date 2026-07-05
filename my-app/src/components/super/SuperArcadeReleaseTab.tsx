import { useState } from "react";
import ReleaseHighlightsPanel from "../ReleaseHighlightsPanel";

type Props = {
  loading: boolean;
  saving: boolean;
  releaseVersion: string;
  releaseNotes: string;
  onReleaseVersionChange: (value: string) => void;
  onReleaseNotesChange: (value: string) => void;
  onRefresh: () => void;
  onSave: () => Promise<void>;
};

export default function SuperArcadeReleaseTab({
  loading,
  saving,
  releaseVersion,
  releaseNotes,
  onReleaseVersionChange,
  onReleaseNotesChange,
  onRefresh,
  onSave,
}: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <div className="suCard">
        <div className="card-content">
          <span className="card-title" style={{ fontWeight: 1000 }}>Arcade Release</span>
          <p className="grey-text" style={{ marginTop: 0 }}>
            Control the live Arcade release version and the notes shown in the welcome modal for the whole portal.
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            <div className="input-field" style={{ marginTop: 0 }}>
              <input
                value={releaseVersion}
                onChange={(e) => onReleaseVersionChange(e.target.value)}
                placeholder="v2026.07.05"
              />
              <label className="active">Release version</label>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Release notes
              </div>
              <textarea
                value={releaseNotes}
                onChange={(e) => onReleaseNotesChange(e.target.value)}
                rows={14}
                placeholder={"🚀 What's new\n- Bullet point\n- Emoji stay visible\n\nIndented notes stay preserved."}
                style={{
                  width: "100%",
                  resize: "vertical",
                  minHeight: 280,
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,.25)",
                  background: "#fff",
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "#0f172a",
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                Line breaks, indentation, bullets, and emoji are preserved in the modal preview.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={onRefresh} disabled={loading || saving}>
                {loading ? "Refreshing..." : "Refresh"}
              </button>
              <button type="button" className="btn-flat" onClick={() => setPreviewOpen(true)} disabled={!releaseVersion.trim()}>
                Preview modal
              </button>
              <button
                type="button"
                className="btn blue"
                onClick={() => void onSave()}
                disabled={loading || saving || !releaseVersion.trim() || !releaseNotes.trim()}
              >
                {saving ? "Saving..." : "Save release"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewOpen ? (
        <div
          onClick={() => setPreviewOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15,23,42,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(880px, 96vw)",
              maxHeight: "92vh",
              overflow: "auto",
              borderRadius: 24,
              background: "#fff",
              boxShadow: "0 24px 80px rgba(0,0,0,.35)",
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 22, fontWeight: 1000, color: "#0f172a" }}>Modal preview</div>
              <button type="button" className="btn-flat" onClick={() => setPreviewOpen(false)}>
                Close
              </button>
            </div>

            <ReleaseHighlightsPanel
              title="Welcome"
              subtitle="This is how the release copy appears in the guided setup modal."
              releaseVersion={releaseVersion}
              releaseNotes={releaseNotes}
              compact
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
