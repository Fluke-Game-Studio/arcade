import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";

const INTAKE_CONTEXTS_KEY = "fluke_intake_contexts_v1";

type StoredIntakeContext = {
  key: string;
  label: string;
  description: string;
  questions: string[];
  backgroundInfo: string;
  customInstructions: string;
  followUpInstructions: string;
  endNote: string;
  mcpActions: string[];
};

type IntakeContextDef = StoredIntakeContext & {
  buildInput: (answers: Record<string, string>) => Record<string, any>;
};

const BUILD_INPUT_MAP: Record<string, (a: Record<string, string>) => Record<string, any>> = {
  submit_weekly_update: (a) => ({
    weekStart: new Date().toISOString().slice(0, 10),
    accomplishments: a.q1 || "",
    blockers: a.q2 || "",
    nextSteps: a.q3 || "",
    highlights: a.q4 || "",
  }),
  applicant_send_email: (a) => ({
    applicantId: "",
    type: "INTRO",
    notes: Object.values(a).filter(Boolean).join("\n\n"),
  }),
};

const DEFAULT_STORED: StoredIntakeContext[] = [
  {
    key: "weekly_update",
    label: "Weekly Update",
    description: "Collect weekly accomplishments, blockers, next steps and submit via MCP.",
    questions: [
      "What did you accomplish this week?",
      "What blockers did you face?",
      "What are your next steps?",
      "Any timesheet summary you want to add?",
    ],
    backgroundInfo: "",
    customInstructions: "",
    followUpInstructions: "",
    endNote: "",
    mcpActions: ["submit_weekly_update"],
  },
  {
    key: "interview_intake",
    label: "Interview Intake",
    description: "Run interview-style voice intake and store transcripted response via applicant action flow.",
    questions: [
      "Please introduce yourself and your relevant experience.",
      "Why are you interested in this role?",
      "Tell me about one project you are proud of.",
      "Anything else you want to add for this application?",
    ],
    backgroundInfo: "",
    customInstructions: "",
    followUpInstructions: "",
    endNote: "",
    mcpActions: ["applicant_send_email"],
  },
];

function migrateStored(raw: any): StoredIntakeContext {
  return {
    key: String(raw?.key || ""),
    label: String(raw?.label || ""),
    description: String(raw?.description || ""),
    questions: Array.isArray(raw?.questions) ? raw.questions : [""],
    backgroundInfo: String(raw?.backgroundInfo || ""),
    customInstructions: String(raw?.customInstructions || ""),
    followUpInstructions: String(raw?.followUpInstructions || ""),
    endNote: String(raw?.endNote || ""),
    mcpActions: Array.isArray(raw?.mcpActions)
      ? raw.mcpActions
      : String(raw?.mcpAction || "") ? [String(raw.mcpAction)] : [],
  };
}

function loadContexts(): IntakeContextDef[] {
  let stored: StoredIntakeContext[] = DEFAULT_STORED;
  try {
    const raw = localStorage.getItem(INTAKE_CONTEXTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) stored = parsed.map(migrateStored);
    }
  } catch {}
  return stored.map((s) => ({
    ...s,
    buildInput: BUILD_INPUT_MAP[s.mcpActions[0] || ""] || ((a) => ({ notes: Object.values(a).filter(Boolean).join("\n\n") })),
  }));
}

export default function RealtimeIntakePage() {
  const navigate = useNavigate();
  const { user, api } = useAuth() as any;
  const token = String(user?.token || "");
  const [contexts] = useState<IntakeContextDef[]>(() => loadContexts());
  const [ctxKey, setCtxKey] = useState<string>(() => loadContexts()[0]?.key || "weekly_update");
  const ctx = useMemo(() => contexts.find((x) => x.key === ctxKey) || contexts[0], [ctxKey, contexts]);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const greetedRef = useRef(false);
  const connectSeqRef = useRef(0);
  const qIdxRef = useRef(0);

  // Persistent DOM-attached audio element — created once, reused across sessions
  useEffect(() => {
    const el = document.createElement("audio");
    el.autoplay = true;
    el.setAttribute("playsinline", "true");
    el.style.display = "none";
    document.body.appendChild(el);
    audioElRef.current = el;
    return () => {
      try { el.pause(); } catch {}
      try { document.body.removeChild(el); } catch {}
      audioElRef.current = null;
    };
  }, []);

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    setDebugLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 30));
  }

  function extractEphemeralKey(payload: any): string {
    return String(
      payload?.client_secret?.value ||
      payload?.client_secret?.secret ||
      payload?.client_secret ||
      payload?.value ||
      payload?.session?.client_secret?.value ||
      payload?.session?.client_secret?.secret ||
      payload?.session?.client_secret ||
      payload?.session?.value ||
      ""
    );
  }

  async function connectRealtime() {
    const seq = ++connectSeqRef.current;
    qIdxRef.current = 0;
    setQIdx(0);
    greetedRef.current = false;
    disconnectRealtime(false);
    setErr("");
    setDebugLog([]);
    setStatus("connecting");
    addLog("Starting session request...");

    try {
      const sessionRes = await fetch(`${API_BASE}/ai/realtime/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ model: "gpt-realtime-mini", voice: "alloy" }),
      });
      const sessionRaw = await sessionRes.text();
      let session: any = {};
      try { session = sessionRaw ? JSON.parse(sessionRaw) : {}; } catch { session = { message: sessionRaw }; }
      if (!sessionRes.ok) throw new Error(session?.error || session?.message || `Session ${sessionRes.status}`);
      addLog("Session token received.");

      const ephemeralKey = extractEphemeralKey(session);
      if (!ephemeralKey) throw new Error("Missing realtime ephemeral key — check backend response: " + JSON.stringify(session).slice(0, 200));

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      if (seq !== connectSeqRef.current) { pc.close(); return; }

      const audioEl = audioElRef.current!;

      pc.ontrack = (event) => {
        addLog(`ontrack fired — streams: ${event.streams.length}, track: ${event.track.kind}`);
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        audioEl.srcObject = stream;
        audioEl.play().then(() => {
          addLog("Audio play() resolved — you should hear audio now.");
        }).catch((e) => {
          addLog(`Audio play() rejected: ${e?.message || e} — click anywhere on the page to unblock autoplay.`);
          setErr(`Audio blocked by browser. Click anywhere on the page, then reconnect.`);
        });
      };

      pc.onconnectionstatechange = () => {
        addLog(`PC connection state: ${pc.connectionState}`);
        if (pc.connectionState === "connected") setStatus("connected");
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          setErr(`WebRTC connection ${pc.connectionState}.`);
          disconnectRealtime();
        }
      };

      pc.onicegatheringstatechange = () => addLog(`ICE gathering: ${pc.iceGatheringState}`);
      pc.oniceconnectionstatechange = () => addLog(`ICE connection: ${pc.iceConnectionState}`);

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (seq !== connectSeqRef.current) { ms.getTracks().forEach((t) => t.stop()); pc.close(); return; }
      addLog("Microphone access granted.");
      micRef.current = ms;

      if (pc.signalingState === "closed") throw new Error("Peer connection closed before track attach.");
      ms.getTracks().forEach((t) => { if (pc.signalingState !== "closed") pc.addTrack(t, ms); });

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        addLog("Data channel open — sending session.update + response.create.");
        setStatus("connected");

        const allQs = ctx.questions.map((q, i) => `${i + 1}. ${q}`).join(" | ");
        let instructions = `You are Fluke AI intake assistant for ${ctx.label}. `;
        if (ctx.backgroundInfo) instructions += `Background: ${ctx.backgroundInfo} `;
        instructions += `Guide the user through these ${ctx.questions.length} questions one at a time: ${allQs}. Ask each question clearly, wait for the answer, then move on. Keep replies short and natural. `;
        if (ctx.followUpInstructions) instructions += ctx.followUpInstructions + " ";
        if (ctx.customInstructions) instructions += ctx.customInstructions;

        dc.send(JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
            instructions: instructions.trim(),
          },
        }));

        const opening = JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Greet the user briefly, then ask question 1: "${ctx.questions[0]}"`,
          },
        });
        dc.send(opening);

        // Retry greeting if no audio transcript arrived within 2s
        window.setTimeout(() => {
          if (!greetedRef.current && dc.readyState === "open") {
            addLog("No greeting yet — retrying response.create.");
            dc.send(opening);
          }
        }, 2000);
      };

      dc.onclose = () => addLog("Data channel closed.");

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || "{}"));
          const type = String(msg?.type || "");

          // Always log event types so we can see what's arriving
          if (type) addLog(`DC event: ${type}`);

          if (type === "error") {
            const errMsg = String(msg?.error?.message || msg?.message || "OpenAI Realtime error");
            addLog(`OpenAI error: ${errMsg}`);
            setErr(errMsg);
            return;
          }

          // AI finished speaking — mark greeted so retry doesn't double-fire
          if (
            type === "response.audio_transcript.done" ||
            type === "response.output_audio_transcript.done"
          ) {
            greetedRef.current = true;
            return;
          }

          // User finished speaking — store answer and advance
          if (type === "conversation.item.input_audio_transcription.completed") {
            const text = String(msg?.transcript || "").trim();
            if (!text) return;
            addLog(`User answer captured: "${text.slice(0, 60)}..."`);

            const currentIdx = qIdxRef.current;
            const key = `q${currentIdx + 1}`;
            setAnswers((prev) => ({ ...prev, [key]: (prev[key] ? `${prev[key]} ` : "") + text }));

            const nextIdx = currentIdx + 1;
            if (nextIdx < ctx.questions.length) {
              qIdxRef.current = nextIdx;
              setQIdx(nextIdx);
              if (dcRef.current?.readyState === "open") {
                dcRef.current.send(JSON.stringify({
                  type: "response.create",
                  response: {
                    instructions: `Acknowledge the answer briefly, then ask question ${nextIdx + 1}: "${ctx.questions[nextIdx]}"`,
                  },
                }));
              }
            } else {
              qIdxRef.current = ctx.questions.length;
              setQIdx(ctx.questions.length);
              if (dcRef.current?.readyState === "open") {
                const closing = ctx.endNote?.trim() ||
                  "All questions have been answered. Thank the user warmly and let them know their responses will be submitted shortly.";
                dcRef.current.send(JSON.stringify({
                  type: "response.create",
                  response: { instructions: closing },
                }));
              }
            }
          }
        } catch {}
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog("SDP offer created — sending to OpenAI...");

      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp || "",
      });
      const answerSdp = await sdpRes.text();
      if (!sdpRes.ok) throw new Error(`OpenAI SDP ${sdpRes.status}: ${answerSdp.slice(0, 200)}`);
      addLog("SDP answer received — setting remote description.");

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      if (seq !== connectSeqRef.current) { disconnectRealtime(); return; }

      addLog("ICE negotiation in progress...");
      setStatus("negotiating");
    } catch (e: any) {
      const msg = String(e?.message || e);
      addLog(`Error: ${msg}`);
      setErr(msg);
      setStatus("disconnected");
    }
  }

  function disconnectRealtime(invalidate = true) {
    if (invalidate) connectSeqRef.current += 1;
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    micRef.current?.getTracks().forEach((t) => t.stop());
    const audioEl = audioElRef.current;
    if (audioEl) {
      try { audioEl.pause(); } catch {}
      audioEl.srcObject = null;
    }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    if (invalidate) setStatus("disconnected");
  }

  async function submitViaAgent() {
    setBusy(true);
    setErr("");
    try {
      const primaryAction = ctx.mcpActions[0] || "";
      if (!primaryAction) throw new Error("No MCP action configured for this context. Set one in Agent Builder > Intake Contexts.");
      const input = ctx.buildInput(answers);
      if (ctx.key === "interview_intake" && !input.applicantId) {
        throw new Error("Set applicantId in the payload before interview submit.");
      }
      await api.chatOverUpdates({
        question: `Submit ${ctx.label} intake from voice session.`,
        context: "internal",
        perform: true,
        mcpAction: primaryAction,
        mcpInput: input,
      });
      setStatus("submitted");
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const statusColor =
    status === "connected" ? "#166534" :
    status === "negotiating" ? "#92400e" :
    status === "connecting" ? "#1d4ed8" :
    status === "submitted" ? "#166534" :
    status === "disconnected" ? "#b91c1c" : "#64748b";

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h4 style={{ margin: 0 }}>AI Realtime Intake</h4>
        <button className="btn-flat" onClick={() => navigate("/updates/new")}>Back to Timesheet</button>
      </div>
      <p style={{ color: "#64748b" }}>
        Select context, connect via WebRTC, and answer each question aloud. Responses submit to MCP.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {contexts.map((x) => (
          <button
            key={x.key}
            className={`btn ${ctxKey === x.key ? "" : "btn-flat"}`}
            onClick={() => {
              setCtxKey(x.key);
              qIdxRef.current = 0;
              setQIdx(0);
              setAnswers({});
            }}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="card-panel" style={{ borderRadius: 14 }}>
        <div style={{ fontWeight: 700 }}>{ctx.label}</div>
        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{ctx.description}</div>

        <div style={{ marginTop: 12, fontWeight: 700 }}>
          {qIdx < ctx.questions.length ? `Question ${qIdx + 1} of ${ctx.questions.length}` : "All questions answered"}
        </div>
        <div style={{ marginTop: 6, fontSize: 15 }}>
          {ctx.questions[qIdx] || "✅ Done — submit below."}
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={connectRealtime} disabled={status === "connected" || status === "negotiating" || status === "connecting"}>
            {status === "connecting" || status === "negotiating" ? "Connecting..." : "Connect WebRTC"}
          </button>
          <button className="btn-flat waves-effect" onClick={() => disconnectRealtime(true)}>Disconnect</button>
          <button
            className="btn-flat waves-effect"
            onClick={() => {
              const next = Math.min(qIdxRef.current + 1, ctx.questions.length - 1);
              qIdxRef.current = next;
              setQIdx(next);
            }}
          >
            Skip Question
          </button>
        </div>

        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              display: "inline-block",
              width: 10, height: 10,
              borderRadius: "50%",
              background: statusColor,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 700 }}>{status}</span>
        </div>

        {err && (
          <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#b91c1c", fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* Debug log — shows exactly what OpenAI events are arriving */}
        {debugLog.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Event log</div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "#475569",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "8px 10px",
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {debugLog.map((line, i) => <div key={i}>{line}</div>)}
            </div>
          </div>
        )}
      </div>

      <div className="card-panel" style={{ borderRadius: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Transcripted Answers</div>
        {ctx.questions.map((q, i) => {
          const key = `q${i + 1}`;
          return (
            <div key={key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{i + 1}. {q}</div>
              <textarea
                value={answers[key] || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [key]: e.target.value }))}
                style={{ width: "100%", minHeight: 72, borderRadius: 8, border: "1px solid #e2e8f0", padding: 8, fontSize: 13 }}
              />
            </div>
          );
        })}
        <button className="btn" onClick={submitViaAgent} disabled={busy}>
          {busy ? "Submitting..." : `Submit via ${ctx.mcpActions[0] || "MCP"}`}
        </button>
      </div>
    </div>
  );
}
