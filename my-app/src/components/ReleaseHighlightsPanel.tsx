export const DEFAULT_RELEASE_VERSION = "v2026.07.05";
export const DEFAULT_RELEASE_NOTES = [
  "Welcome to the latest Arcade release.",
  "",
  "🚀 Core highlights",
  "- Auth boot validates saved sessions before entering the app.",
  "- Social media workflow, notifications, and connected tooling continue to expand.",
  "- Use this guided setup flow to review the release, agree to expectations, and confirm your connected apps.",
].join("\n");

function normalizeNotes(notes?: string) {
  return String(notes ?? "").trim() || DEFAULT_RELEASE_NOTES;
}

function renderNoteBlock(line: string, idx: number) {
  const trimmed = line.trim();
  if (!trimmed) {
    return <div key={`spacer-${idx}`} style={{ height: 8 }} />;
  }

  const isBullet = /^[-*•]\s+/.test(trimmed);
  if (isBullet) {
    return (
      <div
        key={`bullet-${idx}`}
        style={{
          display: "grid",
          gridTemplateColumns: "16px minmax(0,1fr)",
          gap: 10,
          alignItems: "start",
          color: "#334155",
          lineHeight: 1.75,
        }}
      >
        <span style={{ color: "#2563eb", fontWeight: 1000, lineHeight: 1.6 }}>•</span>
        <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {trimmed.replace(/^[-*•]\s+/, "")}
        </span>
      </div>
    );
  }

  return (
    <div
      key={`line-${idx}`}
      style={{
        color: "#334155",
        lineHeight: 1.75,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
    >
      {line}
    </div>
  );
}

export default function ReleaseHighlightsPanel({
  title = "What's New In This Release",
  subtitle = "Release highlights (core features only).",
  releaseVersion = DEFAULT_RELEASE_VERSION,
  releaseNotes = DEFAULT_RELEASE_NOTES,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  releaseVersion?: string;
  releaseNotes?: string;
  compact?: boolean;
}) {
  const lines = normalizeNotes(releaseNotes).split(/\r?\n/);

  return (
    <div style={{ display: "grid", gap: compact ? 12 : 14 }}>
      <div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 999,
            border: "1px solid rgba(59,130,246,.18)",
            background: "rgba(59,130,246,.08)",
            color: "#1d4ed8",
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          <i className="material-icons" style={{ fontSize: 14 }}>new_releases</i>
          {releaseVersion || DEFAULT_RELEASE_VERSION}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: compact ? 24 : 22,
            fontWeight: 1000,
            letterSpacing: "-.02em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#64748b", fontWeight: 800 }}>
          {subtitle}
        </div>
      </div>

      <div
        style={{
          borderRadius: 18,
          border: "1px solid rgba(148,163,184,.16)",
          background: "rgba(255,255,255,.72)",
          padding: compact ? 16 : 18,
          display: "grid",
          gap: 8,
        }}
      >
        {lines.map((line, idx) => renderNoteBlock(line, idx))}
      </div>
    </div>
  );
}
