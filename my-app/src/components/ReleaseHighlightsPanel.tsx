export const HOME_RELEASE_VERSION = "v2026.04.12";
export const HOME_RELEASE_STORAGE_KEY = `fg_home_whats_new_seen_${HOME_RELEASE_VERSION}`;

const RELEASE_HIGHLIGHTS = [
  "Auth boot: validate saved token before entering the app (no Home flash + no bad-token toast loop).",
  "Login UX: branded loader under the Fluke logo, then auto-flip to the form only when the token is invalid.",
  "AI Chat routing: requests carry context + agent identity (Project Manager for internal/public, default assistant for personal).",
  "WebSocket reliability: `ai-result` frames include `clientId` so responses attach to the correct request.",
  "Update summaries: admin queries resolve the correct employee and summarize real submissions instead of generic JSON-style replies.",
  "Summary tone: deterministic summaries now return smooth pattern and theme answers by default (raw lists only when requested).",
];

export default function ReleaseHighlightsPanel({
  title = "What's New In This Release",
  subtitle = "Release highlights (core features only).",
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  compact?: boolean;
}) {
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
          {HOME_RELEASE_VERSION}
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

      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 10, color: "#334155", lineHeight: 1.6 }}>
        {RELEASE_HIGHLIGHTS.map((item) => (
          <li key={item} style={{ margin: 0 }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
