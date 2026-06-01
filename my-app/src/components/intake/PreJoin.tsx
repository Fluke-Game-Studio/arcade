import type { StoredIntakeContext } from "./types";

interface Props {
  ctx: StoredIntakeContext;
  jobTitle: string;
  jobQuestions: string[];
  onConnect: () => void;
  onBack: () => void;
}

const S = {
  page: {
    display: "flex",
    flexDirection: "column" as const,
    height: "calc(100vh - 64px)",
    background: "#0d0d0d",
    color: "#fff",
    overflowY: "auto" as const,
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 8,
  },
};

export default function PreJoin({ ctx, jobTitle, jobQuestions, onConnect, onBack }: Props) {
  const isWeekly = ctx.key === "weekly_update" || ctx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");
  const totalQs = [...ctx.questions, ...jobQuestions].length;
  const tips = isWeekly
    ? [
        { icon: "🎙️", text: "Find a quiet space with minimal background noise" },
        { icon: "💬", text: "Speak naturally — the AI captures your responses in real time" },
        { icon: "🔇", text: "You can mute yourself at any time during the session" },
        { icon: "✅", text: "Your update is saved automatically when you end the call" },
      ]
    : [
        { icon: "🎙️", text: "Find a quiet spot — background noise affects transcription" },
        { icon: "💬", text: "Speak clearly and take your time with each answer" },
        { icon: "⏸️", text: "Incomplete answers trigger a follow-up before moving on" },
        { icon: "✅", text: "All responses are saved when you end the call" },
      ];

  return (
    <div style={S.page}>
      <div style={S.topBar}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{ctx.label}</span>
        <div style={{ width: 60 }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", gap: 28 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 16px" }}>🤖</div>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800, color: "#fff" }}>
            {ctx.label}{jobTitle && <span style={{ color: "#a78bfa" }}> · {jobTitle}</span>}
          </h2>
          {ctx.description && (
            <p style={{ margin: "0 0 10px", color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.5, maxWidth: 380 }}>
              {ctx.description}
            </p>
          )}
          {totalQs > 0 && (
            <span style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", fontSize: 12, fontWeight: 700 }}>
              {totalQs} question{totalQs !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, width: "100%", maxWidth: 480 }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tip.icon}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>{tip.text}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onConnect}
          style={{ padding: "14px 48px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", boxShadow: "0 8px 32px rgba(99,102,241,0.4)", letterSpacing: "0.3px" }}
        >
          Join Call →
        </button>
      </div>
    </div>
  );
}
