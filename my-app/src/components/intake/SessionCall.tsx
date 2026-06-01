import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import type { StoredIntakeContext, DebugEvent } from "./types";

// ── SVG Icons ──────────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconPhoneOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.5 6.56 13.44a19.4 19.4 0 0 1-3.07-8.68A2 2 0 0 1 5.5 2.72h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L9.47 10.6a16 16 0 0 0 1.21 2.71z" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function IconChat({ filled }: { filled: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Waveform bars ──────────────────────────────────────────────────────────

const BAR_H    = [7, 11, 16, 20, 17, 13, 9, 13, 17];
const BAR_DUR  = [0.6, 0.5, 0.7, 0.55, 0.65, 0.5, 0.7, 0.6, 0.55];

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 20 }}>
      {BAR_H.map((h, i) => (
        <div key={i} style={{
          width: 2.5,
          height: active ? h : 3,
          background: active ? "rgba(165,180,252,0.8)" : "rgba(255,255,255,0.18)",
          borderRadius: 2,
          transformOrigin: "bottom",
          animation: active ? `sc-wave ${BAR_DUR[i]}s ${i * 0.07}s ease-in-out infinite alternate` : "none",
          transition: "height 0.35s ease, background 0.3s ease",
        }} />
      ))}
    </div>
  );
}

// ── DockButton ─────────────────────────────────────────────────────────────

function DockButton({
  children, onClick, active = false, danger = false,
  label, disabled = false, large = false,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  label: string;
  disabled?: boolean;
  large?: boolean;
}) {
  const [hov, setHov] = useState(false);

  let bg: string, color: string, border: string, shadow = "none";

  if (disabled) {
    bg = "rgba(255,255,255,0.04)";
    color = "rgba(255,255,255,0.18)";
    border = "1px solid transparent";
  } else if (danger) {
    bg = hov ? "#ef4444" : "rgba(239,68,68,0.82)";
    color = "#fff";
    border = "1px solid rgba(239,68,68,0.5)";
    shadow = hov ? "0 6px 24px rgba(239,68,68,0.45)" : "0 4px 16px rgba(239,68,68,0.3)";
  } else if (active) {
    bg = hov ? "rgba(99,102,241,0.35)" : "rgba(99,102,241,0.22)";
    color = "#a5b4fc";
    border = "1px solid rgba(99,102,241,0.42)";
  } else {
    bg = hov ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.07)";
    color = hov ? "#fff" : "rgba(255,255,255,0.62)";
    border = "1px solid rgba(255,255,255,0.09)";
  }

  const size = large ? 52 : 44;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => !disabled && setHov(true)}
        onMouseLeave={() => setHov(false)}
        title={label}
        style={{
          width: size, height: size,
          borderRadius: large ? "50%" : 12,
          border, background: bg, color,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease",
          transform: hov && !disabled ? "translateY(-2px)" : "translateY(0)",
          boxShadow: shadow,
          outline: "none",
          flexShrink: 0,
        }}
      >
        {children}
      </button>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", whiteSpace: "nowrap", userSelect: "none", letterSpacing: "0.2px" }}>
        {label}
      </span>
    </div>
  );
}

// ── Transcript Panel ───────────────────────────────────────────────────────

function TranscriptPanel({
  allQuestions, qIdx, answers, aiSpeaking, onClose,
}: {
  allQuestions: string[];
  qIdx: number;
  answers: Record<string, string>;
  aiSpeaking: boolean;
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [qIdx, answers]);

  const completedCount = Math.min(qIdx, allQuestions.length);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 300 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "rgba(255,255,255,0.88)", letterSpacing: "0.2px" }}>
            Live Transcript
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 2 }}>
            {completedCount} / {allQuestions.length} answered
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.45)", cursor: "pointer",
            borderRadius: 8, width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.12)"; b.style.color = "#fff"; }}
          onMouseLeave={(e) => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.06)"; b.style.color = "rgba(255,255,255,0.45)"; }}
        >
          <IconX />
        </button>
      </div>

      {/* Entries */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 16, scrollBehavior: "smooth" }}>
        {allQuestions.map((q, i) => {
          const key    = `q${i + 1}`;
          const answer = answers[key];
          const isCurrent   = i === qIdx;
          const isCompleted = i < qIdx;
          const isFuture    = i > qIdx;

          return (
            <div key={i} style={{ opacity: isFuture ? 0.26 : 1, transition: "opacity 0.4s ease" }}>
              {/* Question row */}
              <div style={{ display: "flex", gap: 8, marginBottom: (answer || isCurrent) ? 7 : 0 }}>
                {/* Index bubble */}
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                  background: isCurrent ? "rgba(99,102,241,0.28)" : isCompleted ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${isCurrent ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700,
                  color: isCurrent ? "#a5b4fc" : isCompleted ? "rgba(165,180,252,0.55)" : "rgba(255,255,255,0.28)",
                }}>
                  {isCompleted ? "✓" : i + 1}
                </div>

                {/* Question text */}
                <div style={{
                  flex: 1, fontSize: 12, lineHeight: 1.6,
                  color: isCurrent ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.5)",
                  fontWeight: isCurrent ? 500 : 400,
                }}>
                  {q}
                  {isCurrent && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: "#6366f1", fontWeight: 600 }}>
                      {aiSpeaking ? "● asking" : "● listening"}
                    </span>
                  )}
                </div>
              </div>

              {/* Answer bubble */}
              {answer && (
                <div style={{
                  marginLeft: 28, padding: "8px 11px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "4px 10px 10px 10px",
                  fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.65,
                }}>
                  {answer}
                </div>
              )}

              {/* Listening dots for current Q */}
              {isCurrent && !answer && !aiSpeaking && (
                <div style={{ marginLeft: 28 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "7px 11px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "4px 10px 10px 10px",
                  }}>
                    {[0, 0.18, 0.36].map((delay, j) => (
                      <div key={j} style={{
                        width: 5, height: 5, borderRadius: "50%",
                        background: "rgba(255,255,255,0.22)",
                        animation: `sc-bounce ${delay}s`,
                        animationName: "sc-bounce",
                        animationDuration: "1.2s",
                        animationDelay: `${delay}s`,
                        animationTimingFunction: "ease-in-out",
                        animationIterationCount: "infinite",
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Debug Panel (SUPER only) ───────────────────────────────────────────────

function IconBug() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9v-1a3 3 0 0 1 6 0v1" />
      <path d="M8 9h8a6 6 0 0 1 1 3.5c0 3-2 5.5-5 6s-5-3-5-6A6 6 0 0 1 8 9z" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
      <line x1="3" y1="11" x2="7" y2="12" />
      <line x1="21" y1="11" x2="17" y2="12" />
      <line x1="3" y1="7" x2="7" y2="9" />
      <line x1="21" y1="7" x2="17" y2="9" />
    </svg>
  );
}

function DebugPanel({
  debugLog, appliedInstructions, ctx, appliedSnapshot, onClose,
}: {
  debugLog: DebugEvent[];
  appliedInstructions: string;
  ctx: StoredIntakeContext;
  appliedSnapshot: { key: string; label: string; qs: string[]; mcpActions: string[]; source: string; ctxMatchesState: boolean } | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"events" | "session">("events");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === "events" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debugLog, tab]);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
    background: active ? "rgba(251,191,36,0.18)" : "transparent",
    color: active ? "#fbbf24" : "rgba(255,255,255,0.35)",
    transition: "all 0.15s",
  });

  const dirColor = (dir: DebugEvent["dir"]) =>
    dir === "out" ? "#60a5fa" : dir === "in" ? "#4ade80" : "#a78bfa";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 340 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 14px 11px",
        borderBottom: "1px solid rgba(251,191,36,0.12)",
        flexShrink: 0, gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", letterSpacing: "0.2px" }}>Debug</span>
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(251,191,36,0.12)", color: "#fbbf24", fontWeight: 600 }}>SUPER</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button style={tabStyle(tab === "events")} onClick={() => setTab("events")}>
            Events ({debugLog.length})
          </button>
          <button style={tabStyle(tab === "session")} onClick={() => setTab("session")}>
            Session
          </button>
        </div>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", cursor: "pointer", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
          onMouseEnter={(e) => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.12)"; b.style.color = "#fff"; }}
          onMouseLeave={(e) => { const b = e.currentTarget; b.style.background = "rgba(255,255,255,0.06)"; b.style.color = "rgba(255,255,255,0.45)"; }}
        >
          <IconX />
        </button>
      </div>

      {/* Events tab */}
      {tab === "events" && (
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "10px 12px", fontFamily: "monospace", fontSize: 11, display: "flex", flexDirection: "column", gap: 3 }}>
          {debugLog.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.22)", padding: "12px 0" }}>Waiting for session…</div>
          )}
          {debugLog.map((e, i) => {
            const ts = new Date(e.ts).toISOString().slice(11, 23);
            return (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>{ts}</span>
                <span style={{ color: dirColor(e.dir), flexShrink: 0, fontWeight: 700 }}>
                  {e.dir === "out" ? "→" : e.dir === "in" ? "←" : "·"}
                </span>
                <span style={{ color: e.type === "error" ? "#f87171" : "rgba(255,255,255,0.75)", flexShrink: 0 }}>{e.type}</span>
                {e.detail && <span style={{ color: "rgba(255,255,255,0.38)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.detail}</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Session tab */}
      {tab === "session" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── Applied snapshot (what dc.onopen actually used) ── */}
          <div style={{ background: appliedSnapshot ? "rgba(251,191,36,0.06)" : "rgba(248,113,113,0.06)", border: `1px solid ${appliedSnapshot ? "rgba(251,191,36,0.18)" : "rgba(248,113,113,0.18)"}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: appliedSnapshot ? "#fbbf24" : "#f87171", marginBottom: 8 }}>
              {appliedSnapshot ? "Context Applied to Session" : "Session Not Started Yet"}
            </div>
            {appliedSnapshot ? (
              <>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: 600, marginBottom: 4 }}>
                  {appliedSnapshot.label}
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 400, color: "rgba(255,255,255,0.38)" }}>{appliedSnapshot.key}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 4 }}>
                  {appliedSnapshot.qs.length} question{appliedSnapshot.qs.length !== 1 ? "s" : ""} loaded
                  {" · "}mcpActions: {appliedSnapshot.mcpActions.join(", ") || "none"}
                </div>
                {!appliedSnapshot.ctxMatchesState && (
                  <div style={{ fontSize: 11, color: "#fb923c", marginTop: 4, fontWeight: 600 }}>
                    ⚠ ctxRef differed from ctx state at open time
                  </div>
                )}
                {appliedSnapshot.qs.length === 0 && (
                  <div style={{ fontSize: 11, color: "#f87171", fontWeight: 700, marginTop: 4 }}>
                    ✗ No questions were loaded — session has no questions to ask!
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 8 }}>
                  {appliedSnapshot.qs.map((q, i) => (
                    <div key={i} style={{ fontSize: 11, display: "flex", gap: 6 }}>
                      <span style={{ color: "#fbbf24", flexShrink: 0, fontWeight: 700, fontFamily: "monospace" }}>Q{i + 1}</span>
                      <span style={{ color: "rgba(255,255,255,0.7)" }}>{q}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
                Waiting for data channel to open…<br />
                Current ctx state: <span style={{ color: "rgba(255,255,255,0.6)" }}>{ctx.key}</span> ({ctx.questions.length} questions)
              </div>
            )}
          </div>

          {/* ── Applied instructions ── */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "#fbbf24", marginBottom: 6 }}>
              Full Instructions Sent {appliedInstructions ? `(${appliedInstructions.length} chars)` : ""}
            </div>
            {appliedInstructions ? (
              <pre style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,0.55)", whiteSpace: "pre-wrap", wordBreak: "break-word", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 12px", lineHeight: 1.6, maxHeight: 300, overflowY: "auto" }}>
                {appliedInstructions}
              </pre>
            ) : (
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.28)" }}>Session not started yet</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  ctx: StoredIntakeContext;
  jobTitle: string;
  allQuestions: string[];
  status: "connecting" | "connected";
  qIdx: number;
  aiSpeaking: boolean;
  userSpeaking: boolean;
  micMuted: boolean;
  busy: boolean;
  err: string;
  userName: string;
  jobQuestions: string[];
  answers: Record<string, string>;
  onToggleMic: () => void;
  onEndAndSubmit: () => void;
  onBack: () => void;
  isSuper?: boolean;
  debugLog?: DebugEvent[];
  appliedInstructions?: string;
  appliedSnapshot?: { key: string; label: string; qs: string[]; mcpActions: string[]; source: string; ctxMatchesState: boolean } | null;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SessionCall({
  ctx, jobTitle, allQuestions, status, qIdx, aiSpeaking, userSpeaking,
  micMuted, busy, err, userName, jobQuestions, answers,
  onToggleMic, onEndAndSubmit, onBack,
  isSuper = false, debugLog = [], appliedInstructions = "", appliedSnapshot = null,
}: Props) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const connected = status === "connected";
  const allDone   = qIdx >= allQuestions.length;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 64px)",
      background: "#090910",
      color: "#fff",
      overflow: "hidden",
    }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px",
        background: "rgba(9,9,18,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.055)",
        flexShrink: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none",
            color: "rgba(255,255,255,0.42)", cursor: "pointer",
            fontSize: 13, display: "flex", alignItems: "center",
            gap: 6, padding: "5px 10px", borderRadius: 8, transition: "color 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.88)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.42)")}
        >
          ← Back
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
            {ctx.label}
            {jobTitle && <span style={{ color: "#a78bfa", fontWeight: 400 }}> · {jobTitle}</span>}
          </div>
          {connected && !allDone && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.32)", marginTop: 1 }}>
              Question {qIdx + 1} of {allQuestions.length}
              {jobQuestions.length > 0 && (
                <span style={{ color: "rgba(167,139,250,0.4)" }}> · {ctx.questions.length}+{jobQuestions.length}</span>
              )}
            </div>
          )}
          {allDone && (
            <div style={{ fontSize: 11, color: "#4ade80", marginTop: 1 }}>All questions complete</div>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 12px", borderRadius: 999,
          fontSize: 11, fontWeight: 600,
          background: connected ? "rgba(22,163,74,0.11)" : "rgba(59,130,246,0.11)",
          color:      connected ? "#4ade80"              : "#93c5fd",
          border: `1px solid ${connected ? "rgba(74,222,128,0.18)" : "rgba(147,197,253,0.18)"}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: connected ? "#4ade80" : "#93c5fd",
            animation: "sc-pulse 2s ease-in-out infinite",
          }} />
          {connected ? "Live" : "Connecting…"}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── Call Stage ────────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>

          {/* Ambient radial bg */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 65% 50% at 50% 44%, rgba(79,70,229,0.15) 0%, rgba(9,9,18,1) 70%)",
            transition: "opacity 0.6s ease",
            opacity: connected ? 1 : 0.5,
          }} />

          {/* Center stage */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 18, padding: "0 24px 88px",
          }}>

            {/* ── AI Orb ─────────────────────────────────────────────── */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Outer breathing ring */}
              <div style={{
                position: "absolute", width: 196, height: 196, borderRadius: "50%",
                border: `1px solid rgba(99,102,241,${aiSpeaking ? 0.4 : 0.1})`,
                animation: aiSpeaking ? "sc-breathe 2.2s ease-in-out infinite" : "none",
                transition: "border-color 0.5s ease",
                pointerEvents: "none",
              }} />

              {/* Ripple rings when speaking */}
              {aiSpeaking && [0, 0.45, 0.9].map((delay, i) => (
                <div key={i} style={{
                  position: "absolute", width: 118, height: 118, borderRadius: "50%",
                  border: "1.5px solid rgba(139,92,246,0.45)",
                  animation: `sc-ripple 2s ease-out ${delay}s infinite`,
                  pointerEvents: "none",
                }} />
              ))}

              {/* Orb */}
              <div style={{
                width: 108, height: 108, borderRadius: "50%",
                background: aiSpeaking
                  ? "radial-gradient(circle at 38% 32%, #818cf8 0%, #6366f1 50%, #4338ca 100%)"
                  : connected
                    ? "radial-gradient(circle at 38% 32%, #4f46e5 0%, #3730a3 55%, #1e1b4b 100%)"
                    : "radial-gradient(circle at 38% 32%, #3730a3 0%, #1e1b4b 60%, #0f0e28 100%)",
                boxShadow: aiSpeaking
                  ? "0 0 55px rgba(99,102,241,0.6), 0 0 110px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.22)"
                  : connected
                    ? "0 0 28px rgba(79,70,229,0.28), inset 0 1px 0 rgba(255,255,255,0.1)"
                    : "0 0 14px rgba(55,48,163,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 42, position: "relative", zIndex: 1,
                transition: "all 0.4s ease",
                transform: aiSpeaking ? "scale(1.05)" : "scale(1)",
              }}>
                🤖
              </div>
            </div>

            {/* Name + waveform */}
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: "rgba(255,255,255,0.9)" }}>Fluke AI</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <WaveformBars active={aiSpeaking && connected} />
                <span style={{
                  fontSize: 12, transition: "color 0.3s ease",
                  color: aiSpeaking ? "#a5b4fc" : connected ? "rgba(255,255,255,0.32)" : "rgba(147,197,253,0.55)",
                }}>
                  {!connected ? "Connecting…" : aiSpeaking ? "Speaking" : "Listening"}
                </span>
              </div>
            </div>

            {/* Current question card */}
            {connected && !allDone && (
              <div style={{
                width: "100%", maxWidth: 500,
                padding: "14px 18px",
                background: "rgba(255,255,255,0.03)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: qIdx >= ctx.questions.length ? "#a78bfa" : "#6366f1" }}>
                    {qIdx >= ctx.questions.length ? "Role Question" : "Question"} {qIdx + 1}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.22)" }}>{qIdx + 1} / {allQuestions.length}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 2, background: "rgba(255,255,255,0.07)", borderRadius: 999, marginBottom: 12 }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: qIdx >= ctx.questions.length
                      ? "linear-gradient(90deg,#a78bfa,#7c3aed)"
                      : "linear-gradient(90deg,#6366f1,#a78bfa)",
                    width: `${((qIdx + 1) / allQuestions.length) * 100}%`,
                    transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
                  }} />
                </div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.65 }}>
                  {allQuestions[qIdx]}
                </div>
              </div>
            )}

            {/* All done pill */}
            {connected && allDone && (
              <div style={{
                padding: "10px 22px",
                background: "rgba(22,163,74,0.1)",
                border: "1px solid rgba(74,222,128,0.22)",
                borderRadius: 999,
                fontSize: 13, color: "#4ade80", fontWeight: 600,
              }}>
                ✓ All questions complete — end the call to submit
              </div>
            )}
          </div>

          {/* ── User PiP ──────────────────────────────────────────────── */}
          <div style={{
            position: "absolute", bottom: 92, right: 18,
            width: 136,
            background: "rgba(12,12,22,0.88)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            borderRadius: 14,
            border: `1px solid ${userSpeaking && !micMuted ? "rgba(74,222,128,0.45)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: userSpeaking && !micMuted
              ? "0 0 22px rgba(74,222,128,0.12), 0 4px 24px rgba(0,0,0,0.5)"
              : "0 4px 24px rgba(0,0,0,0.5)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 8, padding: "16px 8px 12px",
            transition: "border-color 0.3s ease, box-shadow 0.3s ease",
            zIndex: 5,
          }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {userSpeaking && !micMuted && [0, 0.42].map((delay, i) => (
                <div key={i} style={{
                  position: "absolute", width: 38, height: 38, borderRadius: "50%",
                  border: "1px solid rgba(74,222,128,0.45)",
                  animation: `sc-ripple 1.7s ease-out ${delay}s infinite`,
                  pointerEvents: "none",
                }} />
              ))}
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: userSpeaking && !micMuted ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.07)",
                border: `1px solid ${userSpeaking && !micMuted ? "rgba(74,222,128,0.28)" : "rgba(255,255,255,0.1)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700,
                color: userSpeaking && !micMuted ? "#4ade80" : "rgba(255,255,255,0.55)",
                position: "relative", zIndex: 1,
                transition: "all 0.25s ease",
              }}>
                {userName.slice(0, 1).toUpperCase()}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.42)", fontWeight: 500, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110 }}>
              {userName}
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: micMuted ? "#f87171" : userSpeaking && connected ? "#4ade80" : "rgba(255,255,255,0.22)" }}>
              {micMuted ? "🔇 Muted" : userSpeaking && connected ? "Speaking" : "Live"}
            </div>
          </div>

          {/* Error toast */}
          {err && (
            <div style={{
              position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
              padding: "10px 18px", borderRadius: 12,
              background: "rgba(220,38,38,0.15)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(220,38,38,0.28)",
              color: "#fca5a5", fontSize: 13,
              zIndex: 20, maxWidth: 460, textAlign: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
            }}>
              {err}
            </div>
          )}

          {/* ── Glass Dock ────────────────────────────────────────────── */}
          <div style={{
            position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 20px",
            background: "rgba(11,11,22,0.8)",
            backdropFilter: "blur(30px)",
            WebkitBackdropFilter: "blur(30px)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 22,
            boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            zIndex: 10,
          }}>
            <DockButton
              onClick={onToggleMic}
              active={!micMuted}
              danger={micMuted}
              label={micMuted ? "Unmute" : "Mute"}
              disabled={!connected}
            >
              {micMuted ? <IconMicOff /> : <IconMic />}
            </DockButton>

            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.07)", margin: "0 6px" }} />

            <DockButton
              onClick={onEndAndSubmit}
              danger
              label="End Call"
              disabled={busy || !connected}
              large
            >
              <IconPhoneOff />
            </DockButton>

            <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.07)", margin: "0 6px" }} />

            <DockButton
              onClick={() => setTranscriptOpen((o) => !o)}
              active={transcriptOpen}
              label="Transcript"
            >
              <IconChat filled={transcriptOpen} />
            </DockButton>

            {isSuper && (
              <>
                <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.07)", margin: "0 6px" }} />
                <DockButton
                  onClick={() => setDebugOpen((o) => !o)}
                  active={debugOpen}
                  label="Debug"
                >
                  <IconBug />
                </DockButton>
              </>
            )}
          </div>
        </div>

        {/* ── Transcript Side Panel ──────────────────────────────────────── */}
        <div style={{
          width: transcriptOpen ? 300 : 0,
          minWidth: transcriptOpen ? 300 : 0,
          overflow: "hidden",
          background: "rgba(9,9,17,0.98)",
          borderLeft: transcriptOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
          flexShrink: 0,
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}>
          {transcriptOpen && (
            <TranscriptPanel
              allQuestions={allQuestions}
              qIdx={qIdx}
              answers={answers}
              aiSpeaking={aiSpeaking}
              onClose={() => setTranscriptOpen(false)}
            />
          )}
        </div>

        {/* ── Debug Panel (SUPER only) ────────────────────────────────────── */}
        {isSuper && (
          <div style={{
            width: debugOpen ? 360 : 0,
            minWidth: debugOpen ? 360 : 0,
            overflow: "hidden",
            background: "rgba(8,8,15,0.99)",
            borderLeft: debugOpen ? "1px solid rgba(251,191,36,0.12)" : "none",
            flexShrink: 0,
            transition: "width 0.3s cubic-bezier(0.4,0,0.2,1), min-width 0.3s cubic-bezier(0.4,0,0.2,1)",
          }}>
            {debugOpen && (
              <DebugPanel
                debugLog={debugLog}
                appliedInstructions={appliedInstructions}
                ctx={ctx}
                appliedSnapshot={appliedSnapshot}
                onClose={() => setDebugOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes sc-ripple {
          0%   { transform: scale(1);   opacity: 0.55; }
          100% { transform: scale(2.7); opacity: 0; }
        }
        @keyframes sc-breathe {
          0%, 100% { transform: scale(1);    opacity: 0.2; }
          50%       { transform: scale(1.08); opacity: 0.45; }
        }
        @keyframes sc-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes sc-wave {
          0%   { transform: scaleY(0.25); }
          100% { transform: scaleY(1); }
        }
        @keyframes sc-bounce {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.22; }
          30%            { transform: translateY(-4px); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
