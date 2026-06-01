import type { Dispatch, SetStateAction } from "react";
import type { StoredIntakeContext, FeedbackState } from "./types";

const HR_EMAIL = "flukegamestudio@gmail.com";

interface Props {
  ctx: StoredIntakeContext;
  status: "awaiting_feedback" | "submitted";
  busy: boolean;
  err: string;
  feedback: FeedbackState;
  hoveredStar: number;
  onSetFeedback: Dispatch<SetStateAction<FeedbackState>>;
  onSetHoveredStar: (n: number) => void;
  onSubmit: (fb: FeedbackState | null) => void;
  onBack: () => void;
}

const page = {
  display: "flex",
  flexDirection: "column" as const,
  height: "calc(100vh - 64px)",
  background: "#0d0d0d",
  color: "#fff",
  overflow: "hidden",
};

export default function PostJoin({ ctx, status, busy, err, feedback, hoveredStar, onSetFeedback, onSetHoveredStar, onSubmit, onBack }: Props) {
  const isWeekly = ctx.key === "weekly_update" || ctx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");

  if (status === "awaiting_feedback") {
    return (
      <div style={{ ...page, alignItems: "center", justifyContent: "center", gap: 16, overflowY: "auto", padding: "24px 20px" }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h4 style={{ margin: 0, color: "#fff" }}>
          {isWeekly ? "Update Recorded!" : "Interview Complete!"}
        </h4>
        <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, textAlign: "center", maxWidth: 380 }}>
          {isWeekly
            ? "Your responses are ready to submit. Rate your experience below before submitting."
            : "Your responses are ready. Share your experience below — it will be included in the transcript email."}
        </p>

        {err && (
          <div style={{ width: "100%", maxWidth: 420, padding: "10px 16px", borderRadius: 10, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5", fontSize: 13 }}>
            {err}
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 420, background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "24px 24px 20px", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20, color: "#fff" }}>How was your experience?</div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px" }}>Overall quality</div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  onClick={() => onSetFeedback((f) => ({ ...f, stars: n }))}
                  onMouseEnter={() => onSetHoveredStar(n)}
                  onMouseLeave={() => onSetHoveredStar(0)}
                  style={{ fontSize: 34, cursor: "pointer", lineHeight: 1, color: n <= (hoveredStar || feedback.stars) ? "#f59e0b" : "rgba(255,255,255,0.15)", transition: "color 0.1s ease" }}
                >
                  ★
                </span>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.5 }}>
              {isWeekly ? "Did the agent complete all the questions?" : "Did the interviewer agent complete the questions?"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {(["Yes", "No"] as const).map((opt) => {
                const val = opt === "Yes";
                const active = feedback.completedQs === val;
                return (
                  <button key={opt} onClick={() => onSetFeedback((f) => ({ ...f, completedQs: val }))}
                    style={{ padding: "7px 20px", borderRadius: 8, border: `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.5 }}>Did the agent listen to your answers completely before moving forward?</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {(["Yes", "Partially", "No"] as const).map((opt) => {
                const active = feedback.listenedFully === opt.toLowerCase();
                return (
                  <button key={opt} onClick={() => onSetFeedback((f) => ({ ...f, listenedFully: opt.toLowerCase() }))}
                    style={{ padding: "7px 20px", borderRadius: 8, border: `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8, lineHeight: 1.5 }}>
              {isWeekly ? "Did the agent stick to the weekly update topic?" : "Did the agent stick to the interview topic?"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {(["Yes", "Partially", "No"] as const).map((opt) => {
                const active = feedback.stuckToTopic === opt.toLowerCase();
                return (
                  <button key={opt} onClick={() => onSetFeedback((f) => ({ ...f, stuckToTopic: opt.toLowerCase() }))}
                    style={{ padding: "7px 20px", borderRadius: 8, border: `1px solid ${active ? "#6366f1" : "rgba(255,255,255,0.1)"}`, background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)", color: active ? "#a5b4fc" : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={feedback.stars === 0}
              onClick={() => onSubmit(feedback)}
              style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: feedback.stars > 0 ? isWeekly ? "linear-gradient(135deg,#16a34a,#22c55e)" : "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,0.06)", color: feedback.stars > 0 ? "#fff" : "rgba(255,255,255,0.2)", fontWeight: 700, fontSize: 14, cursor: feedback.stars > 0 ? "pointer" : "not-allowed", transition: "background 0.2s ease, color 0.2s ease" }}
            >
              {isWeekly ? "Submit Update" : "Submit with Feedback"}
            </button>
            <button
              onClick={() => onSubmit(null)}
              style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // status === "submitted"
  return (
    <div style={{ ...page, alignItems: "center", justifyContent: "center", gap: 16 }}>
      {busy ? (
        <>
          <div style={{ fontSize: 36, opacity: 0.5 }}>⏳</div>
          <h4 style={{ margin: 0, color: "#fff" }}>Submitting…</h4>
          <p style={{ color: "rgba(255,255,255,0.4)", margin: 0 }}>
            {isWeekly ? "Saving your weekly update…" : "Sending interview transcript…"}
          </p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 52 }}>🎉</div>
          <h4 style={{ margin: 0, color: "#fff" }}>
            {isWeekly ? "Update Submitted!" : "Interview Complete!"}
          </h4>
          <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, textAlign: "center", maxWidth: 380 }}>
            {isWeekly
              ? "Your weekly update has been submitted successfully."
              : `Transcript sent to ${HR_EMAIL}. Great job!`}
          </p>
          {feedback.stars > 0 && (
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Feedback included — thank you!</div>
          )}
          <button
            onClick={onBack}
            style={{ borderRadius: 12, padding: "0 24px", height: 44, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.12)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            Go Back
          </button>
        </>
      )}
    </div>
  );
}
