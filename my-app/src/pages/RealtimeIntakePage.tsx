import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import PreJoin from "../components/intake/PreJoin";
import SessionCall from "../components/intake/SessionCall";
import PostJoin from "../components/intake/PostJoin";
import type { StoredIntakeContext, FeedbackState, DebugEvent } from "../components/intake/types";

const INTAKE_CONTEXTS_KEY = "fluke_intake_contexts_v1";

const DEFAULT_SESSION_PROMPT = `You are a structured AI interviewer for Fluke Games. You have ONE job: conduct this interview by asking the listed questions in order.

=== ABSOLUTE RULES — no exceptions ===
1. OFF-TOPIC RESPONSE: If the candidate says ANYTHING not related to answering the current interview question, do NOT engage with it. Say exactly: "Let's keep focused on the interview." then immediately repeat the current question word-for-word. Do not acknowledge, comment on, or explore the off-topic content in any way.
2. QUESTION ORDER: Ask questions strictly in the listed order. Never skip, reorder, or paraphrase. Use the exact wording provided.
3. INCOMPLETE ANSWERS: If an answer is vague or very short, ask one targeted follow-up before moving on.
4. MIC INTERRUPTION: If a response seems cut off or too short, say "It seems your response may have been incomplete — could you complete your answer?" Do not advance.
5. ENGLISH ONLY: Respond only in English, regardless of what language the candidate uses.
6. BREVITY: Keep your own responses short — one or two sentences maximum before asking or repeating the question.`;

const HR_EMAIL = "flukegamestudio@gmail.com";

function buildWeeklyInput(a: Record<string, string>) {
  return {
    weekStart: new Date().toISOString().slice(0, 10),
    accomplishments: a.q1 || "",
    blockers: a.q2 || "",
    nextSteps: a.q3 || "",
    highlights: a.q4 || "",
  };
}

function buildTranscript(answers: Record<string, string>, questions: string[]): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  let t = `INTERVIEW TRANSCRIPT — ${date}\n${"═".repeat(52)}\n\n`;
  questions.forEach((q, i) => {
    const key = `q${i + 1}`;
    t += `Q${i + 1}: ${q}\nA:  ${answers[key] || "(no answer captured)"}\n\n`;
  });
  t += `${"─".repeat(52)}\nSubmitted via Fluke Games Internal Intake\n`;
  return t;
}

const DEFAULT_CONTEXTS: StoredIntakeContext[] = [
  {
    key: "weekly_update",
    label: "Weekly Update",
    description: "Collect weekly accomplishments, blockers, and next steps.",
    questions: [
      "What did you accomplish this week?",
      "What blockers did you face?",
      "What are your next steps for next week?",
      "Any other notes or highlights to add?",
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
    description: "Voice interview for applicants.",
    questions: [
      "Please introduce yourself and your relevant experience.",
      "Why are you interested in this role at Fluke Games?",
      "Tell me about a project you are proud of.",
      "Anything else you want to share about your application?",
    ],
    backgroundInfo: "",
    customInstructions: "",
    followUpInstructions: "",
    endNote: "",
    mcpActions: [],
  },
];

function migrateStored(raw: any): StoredIntakeContext {
  return {
    key: String(raw?.key || ""),
    label: String(raw?.label || ""),
    description: String(raw?.description || ""),
    questions: Array.isArray(raw?.questions) ? raw.questions : [""],
    backgroundInfo: String(raw?.backgroundInfo || ""),
    sessionPrompt: String(raw?.sessionPrompt || ""),
    customInstructions: String(raw?.customInstructions || ""),
    followUpInstructions: String(raw?.followUpInstructions || ""),
    endNote: String(raw?.endNote || ""),
    mcpActions: Array.isArray(raw?.mcpActions)
      ? raw.mcpActions
      : String(raw?.mcpAction || "") ? [String(raw.mcpAction)] : [],
    includeJobQuestions: Boolean(raw?.includeJobQuestions),
  };
}

function loadContexts(): StoredIntakeContext[] {
  try {
    const raw = localStorage.getItem(INTAKE_CONTEXTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(migrateStored);
    }
  } catch {}
  return DEFAULT_CONTEXTS;
}

export default function RealtimeIntakePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, api } = useAuth() as any;
  const authToken = String(user?.token || "");
  const userName = String(user?.name || user?.username || "You");

  const ctxKey = searchParams.get("ctx") || DEFAULT_CONTEXTS[0].key;
  const jobId = searchParams.get("jobId") || "";

  const [ctx, setCtx] = useState<StoredIntakeContext>(
    () => loadContexts().find((x) => x.key === ctxKey) || loadContexts()[0]
  );
  const ctxRef = useRef(ctx);
  useEffect(() => { ctxRef.current = ctx; }, [ctx]);

  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "awaiting_feedback" | "submitted">("idle");
  const [jobTitle, setJobTitle] = useState("");
  const [jobQuestions, setJobQuestions] = useState<string[]>([]);
  const [micMuted, setMicMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({ stars: 0, completedQs: null, listenedFully: null, stuckToTopic: null });
  const [hoveredStar, setHoveredStar] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const greetedRef = useRef(false);
  const connectSeqRef = useRef(0);
  const qIdxRef = useRef(0);
  const allQuestionsRef = useRef<string[]>([]);
  const responseInProgressRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const [debugLog, setDebugLog] = useState<DebugEvent[]>([]);
  const [appliedInstructions, setAppliedInstructions] = useState("");
  const [appliedSnapshot, setAppliedSnapshot] = useState<{
    key: string; label: string; qs: string[];
    mcpActions: string[]; source: "ref" | "state";
    ctxMatchesState: boolean;
  } | null>(null);
  const debugLogRef = useRef<DebugEvent[]>([]);
  const isSuper = user?.role === "SUPER" || user?.role === "SUPER_READONLY";

  function addDebug(dir: DebugEvent["dir"], type: string, detail = "") {
    const e: DebugEvent = { ts: Date.now(), dir, type, detail };
    debugLogRef.current = [...debugLogRef.current, e];
    setDebugLog(debugLogRef.current);
  }

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
    };
  }, []);

  // Fetch latest contexts from backend on mount so stale localStorage never wins
  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE}/admin/ai/intake-contexts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const items: StoredIntakeContext[] = Array.isArray(data?.contexts)
          ? data.contexts.map(migrateStored)
          : [];
        if (items.length > 0) {
          try { localStorage.setItem(INTAKE_CONTEXTS_KEY, JSON.stringify(items)); } catch {}
          const fresh = items.find((x) => x.key === ctxKey) || items[0];
          setCtx(fresh);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  useEffect(() => {
    if (!ctx.includeJobQuestions || !jobId) return;
    let cancelled = false;
    api.listJobsAdmin().then((jobs: any[]) => {
      if (cancelled) return;
      const job = jobs.find((j: any) => j.jobId === jobId);
      if (!job) return;
      setJobTitle(String(job.title || jobId));
      const roleQs: string[] = (job.roleQuestions || [])
        .map((q: any) => String(q.label || q.text || "").trim())
        .filter(Boolean);
      setJobQuestions(roleQs);
    }).catch(() => {});
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, ctx.key]);

  function extractEphemeralKey(payload: any): string {
    return String(
      payload?.client_secret?.value ||
      payload?.client_secret?.secret ||
      payload?.client_secret ||
      payload?.value ||
      payload?.session?.client_secret?.value ||
      payload?.session?.client_secret?.secret ||
      ""
    );
  }

  function startMicAnalysis(stream: MediaStream) {
    try {
      const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = actx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      actx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = actx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setUserSpeaking(avg > 10);
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {}
  }

  function stopMicAnalysis() {
    cancelAnimationFrame(animFrameRef.current);
    try { audioCtxRef.current?.close(); } catch {}
    audioCtxRef.current = null;
    analyserRef.current = null;
    setUserSpeaking(false);
  }

  async function connect() {
    const seq = ++connectSeqRef.current;
    qIdxRef.current = 0;
    setQIdx(0);
    greetedRef.current = false;
    setAiSpeaking(false);
    disconnect(false);
    setErr("");
    setStatus("connecting");

    try {
      const sessionRes = await fetch(`${API_BASE}/ai/realtime/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ model: "gpt-realtime-mini", voice: "alloy" }),
      });
      const session = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok) throw new Error(session?.error || `Session ${sessionRes.status}`);

      const ephemeralKey = extractEphemeralKey(session);
      if (!ephemeralKey) throw new Error("Missing ephemeral key from server.");

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      if (seq !== connectSeqRef.current) { pc.close(); return; }

      const audioEl = audioElRef.current!;
      pc.ontrack = (event) => {
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        audioEl.srcObject = stream;
        audioEl.play().catch(() => setErr("Audio blocked by browser. Click anywhere on the page, then reconnect."));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setStatus("connected");
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) disconnect();
      };

      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (seq !== connectSeqRef.current) { ms.getTracks().forEach((t) => t.stop()); pc.close(); return; }
      micRef.current = ms;
      ms.getTracks().forEach((t) => { if (pc.signalingState !== "closed") pc.addTrack(t, ms); });
      startMicAnalysis(ms);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("connected");
        responseInProgressRef.current = false;
        debugLogRef.current = [];
        setDebugLog([]);
        const qs = allQuestionsRef.current;
        const liveCtx = ctxRef.current;

        const baseRules = liveCtx.sessionPrompt?.trim() || DEFAULT_SESSION_PROMPT;
        const isWeeklyCtx = liveCtx.key === "weekly_update" || liveCtx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");
        const closingDefault = isWeeklyCtx
          ? `Thank the person warmly and let them know their responses have been recorded.`
          : `Thank the candidate warmly, tell them a human will review their responses, and wish them well.`;
        const greetInstruction = `Begin the session now. Greet warmly as your persona, do NOT say your model name or mention ChatGPT, then immediately ask the first question: "${qs[0]}"`;

        const sessionInstructions = [
          baseRules,
          liveCtx.customInstructions?.trim() ? `\n=== ADDITIONAL INSTRUCTIONS ===\n${liveCtx.customInstructions.trim()}` : "",
          ``,
          `=== QUESTIONS (ask in this exact order) ===`,
          ...qs.map((q, i) => `Q${i + 1}: ${q}`),
          liveCtx.backgroundInfo?.trim() ? `\n=== BACKGROUND CONTEXT ===\n${liveCtx.backgroundInfo.trim()}` : "",
          ``,
          `=== CLOSING (after all ${qs.length} questions) ===`,
          liveCtx.endNote?.trim() || closingDefault,
        ].filter(Boolean).join("\n").trim();

        setAppliedInstructions(sessionInstructions);
        setAppliedSnapshot({
          key: liveCtx.key,
          label: liveCtx.label,
          qs,
          mcpActions: liveCtx.mcpActions,
          source: "ref",
          ctxMatchesState: liveCtx.key === ctxRef.current?.key,
        });
        addDebug("info", "session.open", `ctx="${liveCtx.key}" qs=${qs.length}`);

        // Set session-level instructions
        dc.send(JSON.stringify({
          type: "session.update",
          session: { type: "realtime", instructions: sessionInstructions },
        }));
        addDebug("out", "session.update", `${sessionInstructions.length} chars`);

        // Hard-inject as a system message so the model cannot ignore these rules
        dc.send(JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [{ type: "input_text", text: `[SYSTEM — ABSOLUTE RULES — follow at ALL times]\n${sessionInstructions}` }],
          },
        }));
        addDebug("out", "conversation.item.create", "system rules injected");

        // Clear any mic audio buffered during connection to prevent VAD from cancelling the greeting
        dc.send(JSON.stringify({ type: "input_audio_buffer.clear" }));

        responseInProgressRef.current = true;
        dc.send(JSON.stringify({
          type: "response.create",
          response: { instructions: greetInstruction },
        }));
        addDebug("out", "response.create", `greet → Q1: "${(qs[0] || "").slice(0, 60)}"`);
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data || "{}"));
          const type = String(msg?.type || "");

          // Log everything except high-frequency audio deltas
          const SKIP_LOG = new Set(["response.audio_transcript.delta", "response.output_audio_transcript.delta", "response.audio.delta", "input_audio_buffer.speech_started", "input_audio_buffer.speech_stopped", "input_audio_buffer.committed", "input_audio_buffer.appended"]);
          if (!SKIP_LOG.has(type)) {
            const detail =
              type === "conversation.item.input_audio_transcription.completed" ? `user: "${String(msg?.transcript || "").slice(0, 80)}"`
              : type === "response.audio_transcript.done" || type === "response.output_audio_transcript.done" ? `ai: "${String(msg?.transcript || "").slice(0, 80)}"`
              : type === "response.cancelled" ? `reason: ${String(msg?.response?.status_details?.reason || "unknown")}`
              : type === "error" ? String(msg?.error?.message || "")
              : type === "session.updated" ? "ok"
              : "";
            addDebug("in", type, detail);
          }

          if (type === "error") {
            setErr(String(msg?.error?.message || "Realtime error"));
            return;
          }
          if (type === "response.created") responseInProgressRef.current = true;
          if (type === "response.done" || type === "response.cancelled") {
            responseInProgressRef.current = false;
            greetedRef.current = true;
          }
          if (type === "response.audio_transcript.delta" || type === "response.output_audio_transcript.delta") {
            setAiSpeaking(true);
          }
          if (type === "response.audio_transcript.done" || type === "response.output_audio_transcript.done") {
            setAiSpeaking(false);
          }
          if (type === "conversation.item.input_audio_transcription.completed") {
            const text = String(msg?.transcript || "").trim();
            if (!text || responseInProgressRef.current) return;
            const wordCount = text.split(/\s+/).filter(Boolean).length;
            const qs = allQuestionsRef.current;
            const currentIdx = qIdxRef.current;
            const key = `q${currentIdx + 1}`;
            setAnswers((prev) => ({ ...prev, [key]: (prev[key] ? `${prev[key]} ` : "") + text }));

            const channel = dcRef.current;
            if (!channel) return;
            responseInProgressRef.current = true;

            if (wordCount < 4) {
              channel.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "message", role: "system", content: [{ type: "input_text",
                  text: `[HARD RULE] The candidate's last response was too short to be a real answer. Do NOT advance. Politely say their response may have been incomplete, then repeat this question VERBATIM: "${qs[currentIdx]}"`
                }] },
              }));
              channel.send(JSON.stringify({
                type: "response.create",
                response: { instructions: `Short/incomplete response detected. Do NOT move on. Politely check in and repeat the current question word-for-word: "${qs[currentIdx]}"` },
              }));
              return;
            }

            const nextIdx = currentIdx + 1;
            if (nextIdx < qs.length) {
              qIdxRef.current = nextIdx;
              setQIdx(nextIdx);
              channel.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "message", role: "system", content: [{ type: "input_text",
                  text: `[HARD RULE] You MUST now ask Q${nextIdx + 1} using EXACTLY these words: "${qs[nextIdx]}" — do not paraphrase, skip, or discuss anything else first.`
                }] },
              }));
              channel.send(JSON.stringify({
                type: "response.create",
                response: { instructions: `Acknowledge the answer in ONE sentence only. Then ask this exact question, word-for-word — no paraphrasing allowed: "${qs[nextIdx]}"` },
              }));
              addDebug("out", "response.create", `→ Q${nextIdx + 1}: "${qs[nextIdx].slice(0, 60)}"`);
            } else {
              qIdxRef.current = qs.length;
              setQIdx(qs.length);
              channel.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "message", role: "system", content: [{ type: "input_text",
                  text: `[HARD RULE] All ${qs.length} questions are complete. Deliver ONLY the closing message. Do not ask any more questions.`
                }] },
              }));
              channel.send(JSON.stringify({
                type: "response.create",
                response: { instructions: `All questions done. Deliver closing message from session instructions. Nothing else.` },
              }));
              addDebug("out", "response.create", "closing message");
            }
          }
        } catch {}
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
        body: offer.sdp || "",
      });
      const answerSdp = await sdpRes.text();
      if (!sdpRes.ok) throw new Error(`OpenAI SDP error ${sdpRes.status}`);
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (e: any) {
      setErr(String(e?.message || e));
      setStatus("idle");
    }
  }

  function disconnect(invalidate = true) {
    if (invalidate) connectSeqRef.current += 1;
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    micRef.current?.getTracks().forEach((t) => t.stop());
    const audioEl = audioElRef.current;
    if (audioEl) { try { audioEl.pause(); } catch {}; audioEl.srcObject = null; }
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    setAiSpeaking(false);
    stopMicAnalysis();
    if (invalidate) setStatus("idle");
  }

  function toggleMic() {
    const newMuted = !micMuted;
    micRef.current?.getTracks().forEach((t) => { t.enabled = !newMuted; });
    setMicMuted(newMuted);
  }

  async function submit(fb: FeedbackState | null) {
    setStatus("submitted");
    setBusy(true);
    setErr("");
    try {
      const qs = allQuestionsRef.current;
      const isWeekly = ctx.key === "weekly_update" || ctx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");

      if (isWeekly) {
        await api.chatOverUpdates({
          question: "Submit weekly update from voice intake session.",
          context: "internal",
          perform: true,
          mcpAction: "updates_write",
          mcpInput: buildWeeklyInput(answers),
        });
      } else {
        let body = buildTranscript(answers, qs);
        if (fb && fb.stars > 0) {
          const stars = "★".repeat(fb.stars) + "☆".repeat(5 - fb.stars);
          body += `\n${"─".repeat(52)}\nCANDIDATE FEEDBACK\n`;
          body += `Overall Quality:       ${stars} (${fb.stars}/5)\n`;
          if (fb.completedQs !== null) body += `Completed Questions:   ${fb.completedQs ? "Yes" : "No"}\n`;
          if (fb.listenedFully)        body += `Listened Fully:        ${fb.listenedFully}\n`;
          if (fb.stuckToTopic)         body += `Stuck to Topic:        ${fb.stuckToTopic}\n`;
        }
        await api.chatOverUpdates({
          question: `Send interview transcript email for ${ctx.label}.`,
          context: "internal",
          perform: true,
          mcpAction: "sendEmail",
          mcpInput: {
            to: HR_EMAIL,
            subject: `Interview Transcript — ${ctx.label} (${new Date().toLocaleDateString("en-GB")})`,
            body,
          },
        });
      }
    } catch (e: any) {
      setErr(String(e?.message || "Submission failed. Please try again."));
      setStatus("awaiting_feedback");
    } finally {
      setBusy(false);
    }
  }

  function endAndSubmit() {
    disconnect(true);
    setStatus("awaiting_feedback");
  }

  const allQuestions = [...ctx.questions, ...jobQuestions];
  allQuestionsRef.current = allQuestions;

  if (status === "idle") {
    return (
      <PreJoin
        ctx={ctx}
        jobTitle={jobTitle}
        jobQuestions={jobQuestions}
        onConnect={connect}
        onBack={() => navigate(-1)}
      />
    );
  }

  if (status === "connecting" || status === "connected") {
    return (
      <SessionCall
        ctx={ctx}
        jobTitle={jobTitle}
        allQuestions={allQuestions}
        status={status}
        qIdx={qIdx}
        aiSpeaking={aiSpeaking}
        userSpeaking={userSpeaking}
        micMuted={micMuted}
        busy={busy}
        err={err}
        userName={userName}
        jobQuestions={jobQuestions}
        answers={answers}
        onToggleMic={toggleMic}
        onEndAndSubmit={endAndSubmit}
        onBack={() => { disconnect(true); navigate(-1); }}
        isSuper={isSuper}
        debugLog={debugLog}
        appliedInstructions={appliedInstructions}
        appliedSnapshot={appliedSnapshot}
      />
    );
  }

  return (
    <PostJoin
      ctx={ctx}
      status={status}
      busy={busy}
      err={err}
      feedback={feedback}
      hoveredStar={hoveredStar}
      onSetFeedback={setFeedback}
      onSetHoveredStar={setHoveredStar}
      onSubmit={submit}
      onBack={() => navigate(-1)}
    />
  );
}
