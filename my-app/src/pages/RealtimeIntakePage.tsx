import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import PreJoin from "../components/intake/PreJoin";
import SessionCall from "../components/intake/SessionCall";
import PostJoin from "../components/intake/PostJoin";
import type { StoredIntakeContext, FeedbackState, DebugEvent } from "../components/intake/types";

const INTAKE_CONTEXTS_KEY = "fluke_intake_contexts_v1";

// The model is never trusted to decide question order/wording from memory of a prompt.
// It must call a tool after every candidate turn; the client owns qIdx and hands back the
// exact next line to speak via a single-turn tool_choice:"none" response.
const PERSONA_INSTRUCTIONS = `You are a warm, professional AI interviewer for Fluke Games.
You do not decide what to ask, when to advance, or how to phrase questions. After every candidate response you MUST call exactly one tool: "advance_interview" (normal case) or "flag_off_topic" (only if the candidate made no attempt at all to address the current question). Never respond with speech directly at that point — only a tool call.
After you call a tool, you will be told the exact words to say. Say only those words, nothing more, nothing less — no extra commentary, no repeating earlier questions, no paraphrasing.
Respond only in English, regardless of what language the candidate uses.`;

const INTERVIEW_TOOLS = [
  {
    type: "function",
    name: "advance_interview",
    description:
      "Call this after the candidate finishes responding to the current question. You do NOT choose the next question — it will be provided to you afterward.",
    parameters: {
      type: "object",
      properties: {
        candidate_answer_seems_incomplete: {
          type: "boolean",
          description:
            "True ONLY if the candidate's answer was clearly cut off mid-sentence, silent, or nonsensical. False for any real attempt at an answer, even a brief one.",
        },
      },
      required: ["candidate_answer_seems_incomplete"],
    },
  },
  {
    type: "function",
    name: "flag_off_topic",
    description:
      "Call this INSTEAD of advance_interview only if the candidate's response made no attempt whatsoever to address the current question (asked something unrelated, went silent, or talked about something else entirely).",
    parameters: { type: "object", properties: {}, required: [] },
  },
];

const ACKNOWLEDGMENTS = ["Got it, thank you.", "Thanks for sharing that.", "Understood, appreciate it.", "Great, thank you."];
const OFF_TOPIC_REDIRECT = "Let's keep focused on the interview.";
const CLARIFY_PROMPT = "It seems your response may have been incomplete — could you say a bit more about that?";


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
    transcriptEmailEnabled: Boolean(raw?.transcriptEmailEnabled),
    transcriptEmailTo: String(raw?.transcriptEmailTo || ""),
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
  const expectingToolCallRef = useRef(false);
  const followUpCountRef = useRef<Record<number, number>>({});
  const ackIdxRef = useRef(0);
  const closingTextRef = useRef("");
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

  function formatMediaError(err: any) {
    const name = String(err?.name || "");
    const message = String(err?.message || err || "Unknown microphone error");
    if (name === "NotFoundError" || /requested device not found/i.test(message)) {
      return "No microphone was found. Please connect or enable a microphone, then try again.";
    }
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Microphone access was blocked. Please allow mic permissions for this site and try again.";
    }
    if (name === "NotReadableError") {
      return "Your microphone is already in use by another app or tab. Close other audio apps and try again.";
    }
    return message;
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

  async function connect(audioDeviceId = "", videoDeviceId = "") {
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
      if (!sessionRes.ok) {
        throw new Error(
          `Session ${sessionRes.status}: ${session?.error || session?.message || JSON.stringify(session || {}) || "unknown"}`
        );
      }

      const ephemeralKey = extractEphemeralKey(session);
      if (!ephemeralKey) {
        throw new Error(`Missing ephemeral key from server: ${JSON.stringify(session || {})}`);
      }

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

      const ms = await navigator.mediaDevices.getUserMedia({
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : false,
      });
      if (seq !== connectSeqRef.current) { ms.getTracks().forEach((t) => t.stop()); pc.close(); return; }
      micRef.current = ms;
      ms.getTracks().forEach((t) => { if (pc.signalingState !== "closed") pc.addTrack(t, ms); });
      startMicAnalysis(ms);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("connected");
        responseInProgressRef.current = false;
        expectingToolCallRef.current = false;
        followUpCountRef.current = {};
        ackIdxRef.current = 0;
        debugLogRef.current = [];
        setDebugLog([]);
        const qs = allQuestionsRef.current;
        const liveCtx = ctxRef.current;

        const isWeeklyCtx = liveCtx.key === "weekly_update" || liveCtx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");
        const closingDefault = isWeeklyCtx
          ? `Thank the person warmly and let them know their responses have been recorded.`
          : `Thank the candidate warmly, tell them a human will review their responses, and wish them well.`;
        closingTextRef.current = liveCtx.endNote?.trim() || closingDefault;

        // Note: question text and ordering are NOT included here — they're delivered fresh,
        // per-turn, via scripted tool_choice:"none" responses so the model never has to
        // "remember" the list or comply with a rule that's buried many turns back.
        const sessionInstructions = [
          PERSONA_INSTRUCTIONS,
          liveCtx.sessionPrompt?.trim() ? `\nAdditional tone/persona notes (style only — the tool contract above always applies):\n${liveCtx.sessionPrompt.trim()}` : "",
          liveCtx.customInstructions?.trim() ? `\nTone/style notes:\n${liveCtx.customInstructions.trim()}` : "",
          liveCtx.backgroundInfo?.trim() ? `\nBackground context (for tone only, not to be recited):\n${liveCtx.backgroundInfo.trim()}` : "",
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

        // Session-level: tools are always available and REQUIRED after every candidate turn.
        dc.send(JSON.stringify({
          type: "session.update",
          session: { type: "realtime", instructions: sessionInstructions, tools: INTERVIEW_TOOLS, tool_choice: "required" },
        }));
        addDebug("out", "session.update", `${sessionInstructions.length} chars, tools=${INTERVIEW_TOOLS.length}, tool_choice=required`);

        // Clear any mic audio buffered during connection to prevent VAD from cancelling the greeting
        dc.send(JSON.stringify({ type: "input_audio_buffer.clear" }));

        // First turn has no "advance" decision to make — override to tool_choice:"none" and
        // hand the model the literal Q1 text to speak.
        responseInProgressRef.current = true;
        expectingToolCallRef.current = false;
        dc.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Begin the session now. Greet warmly as your persona, do NOT say your model name or mention ChatGPT, then say exactly and only: "${qs[0]}"`,
            tool_choice: "none",
          },
        }));
        addDebug("out", "response.create", `greet → Q1: "${(qs[0] || "").slice(0, 60)}" (tool_choice=none)`);
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
          if (type === "response.cancelled") {
            responseInProgressRef.current = false;
            greetedRef.current = true;
            expectingToolCallRef.current = false;
          }
          if (type === "response.done") {
            responseInProgressRef.current = false;
            greetedRef.current = true;
            const outputs: any[] = Array.isArray(msg?.response?.output) ? msg.response.output : [];
            const fnCall = outputs.find((o) => o?.type === "function_call");
            if (fnCall) {
              expectingToolCallRef.current = false;
              handleFunctionCall(fnCall);
            } else if (expectingToolCallRef.current) {
              // Model ignored the required tool call — safety net so a skip is never silent.
              expectingToolCallRef.current = false;
              addDebug("info", "watchdog", "model responded without required tool call — forcing advance");
              performAdvance(false);
            }
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
            const currentIdx = qIdxRef.current;
            const key = `q${currentIdx + 1}`;
            setAnswers((prev) => ({ ...prev, [key]: (prev[key] ? `${prev[key]} ` : "") + text }));

            const channel = dcRef.current;
            if (!channel) return;
            responseInProgressRef.current = true;
            expectingToolCallRef.current = true;
            // No embedded rules here — tool_choice:"required" (set at session level) forces
            // the model into advance_interview/flag_off_topic; it cannot free-speak past a question.
            channel.send(JSON.stringify({
              type: "response.create",
              response: { tool_choice: "required" },
            }));
            addDebug("out", "response.create", "requesting tool decision (advance_interview / flag_off_topic)");
          }
        } catch {}
      };

      function sendScriptedResponse(text: string) {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = false;
        channel.send(JSON.stringify({
          type: "response.create",
          response: { instructions: `Say exactly and only: "${text}"`, tool_choice: "none" },
        }));
      }

      function performAdvance(seemsIncomplete: boolean) {
        const qs = allQuestionsRef.current;
        const currentIdx = qIdxRef.current;

        if (seemsIncomplete && (followUpCountRef.current[currentIdx] || 0) < 1) {
          followUpCountRef.current[currentIdx] = (followUpCountRef.current[currentIdx] || 0) + 1;
          addDebug("out", "response.create", `clarify Q${currentIdx + 1} (tool_choice=none)`);
          sendScriptedResponse(CLARIFY_PROMPT);
          return;
        }

        const nextIdx = currentIdx + 1;
        if (nextIdx < qs.length) {
          qIdxRef.current = nextIdx;
          setQIdx(nextIdx);
          const ack = ACKNOWLEDGMENTS[ackIdxRef.current % ACKNOWLEDGMENTS.length];
          ackIdxRef.current += 1;
          addDebug("out", "response.create", `→ Q${nextIdx + 1}: "${qs[nextIdx].slice(0, 60)}" (tool_choice=none)`);
          sendScriptedResponse(`${ack} ${qs[nextIdx]}`);
        } else {
          qIdxRef.current = qs.length;
          setQIdx(qs.length);
          addDebug("out", "response.create", "closing message (tool_choice=none)");
          sendScriptedResponse(closingTextRef.current);
        }
      }

      function handleFunctionCall(fnCall: any) {
        const name = String(fnCall?.name || "");
        const callId = String(fnCall?.call_id || fnCall?.id || "");
        let args: any = {};
        try { args = JSON.parse(fnCall?.arguments || "{}"); } catch {}
        addDebug("in", "function_call", `${name}(${JSON.stringify(args)})`);

        const channel = dcRef.current;
        if (!channel) return;

        // Acknowledge the tool call so the API doesn't consider the turn dangling.
        channel.send(JSON.stringify({
          type: "conversation.item.create",
          item: { type: "function_call_output", call_id: callId, output: JSON.stringify({ ok: true }) },
        }));

        if (name === "flag_off_topic") {
          const qs = allQuestionsRef.current;
          const currentIdx = qIdxRef.current;
          addDebug("out", "response.create", `off-topic redirect → repeat Q${currentIdx + 1} (tool_choice=none)`);
          sendScriptedResponse(`${OFF_TOPIC_REDIRECT} ${qs[currentIdx]}`);
          return;
        }

        performAdvance(!!args?.candidate_answer_seems_incomplete);
      }

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
      setErr(formatMediaError(e));
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
      await api.submitInternalIntake({
        contextKey: ctx.key,
        answers,
        transcript: buildTranscript(answers, qs),
        feedback: fb,
      });
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
        err={err}
        onConnect={(audioDeviceId, videoDeviceId) => {
          connect(audioDeviceId, videoDeviceId);
        }}
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
