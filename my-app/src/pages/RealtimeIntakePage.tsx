import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import PreJoin from "../components/intake/PreJoin";
import SessionCall from "../components/intake/SessionCall";
import PostJoin from "../components/intake/PostJoin";
import type { StoredIntakeContext, FeedbackState, DebugEvent } from "../components/intake/types";

const INTAKE_CONTEXTS_KEY = "fluke_intake_contexts_v1";

// Two clearly separate layers:
// - PROTOCOL_INSTRUCTIONS: the mechanical contract (must call a tool, never free-speak).
//   This is the part that actually fixes question skipping, so it stays code-owned and is
//   never overridable by admin-authored text — that's exactly what broke before.
// - Persona/tone/behavior: comes entirely from the context's own sessionPrompt /
//   customInstructions (admin-editable via the context builder). DEFAULT_PERSONA is only a
//   fallback for contexts that leave sessionPrompt blank.
const PROTOCOL_INSTRUCTIONS = `PROTOCOL — follow exactly, no exceptions:
After every candidate response you MUST call exactly one tool: "advance_interview" (normal case), "flag_off_topic" (candidate made no attempt to address the question), or "ask_follow_up_question" (when the current topic could use more depth — either because you decide that yourself, or because you're told to). Never respond with speech directly at that point — only a tool call.
After a tool call you'll be told what to say next. When told to say something "exactly," use those exact words — no additions, no paraphrasing. When told to "acknowledge naturally," vary your phrasing and sound genuinely human — don't reuse the same stock phrase every time. Never comment on audio quality, interruptions, or whether an answer "sounded cut off" during a natural acknowledgment — that judgment is handled separately; a natural acknowledgment always means the system has already decided to move on, so treat it as a settled transition, not a chance to ask for a repeat.
Respond only in English, regardless of what language the candidate uses.`;

const DEFAULT_PERSONA = "You are a warm, professional AI interviewer for Fluke Games, having a natural conversation — not reading a script robotically.";

// Re-stated in every per-turn instruction that asks the model to freely generate text (rather
// than recite a literal script) — session-opening instructions alone don't reliably hold this
// rule many turns into a conversation, same class of drift the whole tool-calling redesign
// exists to prevent for question order.
const ENGLISH_REMINDER = "(Regardless of what language the candidate just used, write this in English only.)";

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
  {
    type: "function",
    name: "ask_follow_up_question",
    description:
      "Call this INSTEAD of advance_interview when the candidate's answer to the current topic could use more depth or specifics before moving on — use your own judgment on when a topic has been covered well enough. You may call this multiple times in a row on the same topic to keep drilling in (e.g. ask what they did, then ask to elaborate on a specific part of that answer), but don't overdo it once you have a clear, complete picture. Craft ONE natural, specific follow-up question based directly on what the candidate just said — never generic.",
    parameters: {
      type: "object",
      properties: {
        follow_up_question: {
          type: "string",
          description: "The exact follow-up question to ask, phrased naturally and conversationally, referencing specifics from the candidate's answer.",
        },
      },
      required: ["follow_up_question"],
    },
  },
];

// Tools allowed once the safety-net cap is hit — ask_follow_up_question is removed so the
// model is structurally unable to keep drilling, regardless of what it "wants."
const ADVANCE_AND_OFFTOPIC_TOOLS = INTERVIEW_TOOLS.filter((t) => t.name !== "ask_follow_up_question");

// Post-session open Q&A: only reachable after all fixed questions are done, and only when the
// context has postSessionQAEnabled. Separate tool set from INTERVIEW_TOOLS — never offered
// during the main epic phase, only via an explicit per-response override once open Q&A starts.
const ANSWER_CANDIDATE_QUESTION_TOOL = {
  type: "function",
  name: "answer_candidate_question",
  description:
    "Call this if the candidate asked a real question. Answer it using ONLY the company information you were given in this turn's instructions — if it doesn't cover what they asked, say a team member will follow up with details. Never invent facts.",
  parameters: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description: "Your answer, natural and conversational, grounded strictly in the provided company information.",
      },
    },
    required: ["answer"],
  },
};
const CONCLUDE_QA_TOOL = {
  type: "function",
  name: "conclude_qa",
  description:
    "Call this if the candidate said they have no questions, declined, or gave any closing/negative response (e.g. \"no\", \"I'm good\", \"that's all\"). A short negative answer here is complete by itself — do not ask them to elaborate.",
  parameters: { type: "object", properties: {}, required: [] },
};
const OPEN_QA_TOOLS = [ANSWER_CANDIDATE_QUESTION_TOOL, CONCLUDE_QA_TOOL];
const OPEN_QA_PROMPT = "Before we wrap up — do you have any questions for me?";
const OPEN_QA_FOLLOWUP_PROMPT = "Do you have any other questions for me?";
// Circuit breaker only, same philosophy as SAFETY_MAX_FOLLOWUPS_PER_EPIC — open Q&A is meant to
// run as long as the candidate has real questions, this just prevents it running forever.
const MAX_QA_ROUNDS = 5;

const OFF_TOPIC_REDIRECT = "Let's keep focused on the interview.";
const CLARIFY_PROMPT = "It seems your response may have been incomplete — could you say a bit more about that?";
// Under 10s: elaboration is forced. Under 30s: elaboration is nudged but the model still
// chooses freely (it can also choose to elaborate above 30s — there's no hard duration ceiling,
// only the circuit breaker below).
const HARD_ELABORATE_THRESHOLD_MS = 10000;
const SOFT_ELABORATE_THRESHOLD_MS = 30000;
// Not a normal operating limit — the model is meant to decide when a topic ("epic") has been
// covered well enough. This is purely a circuit breaker so a stuck/looping model can't trap a
// candidate on one question forever.
const SAFETY_MAX_FOLLOWUPS_PER_EPIC = 3;


function buildTranscript(answers: Record<string, string>, questions: string[]): string {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  let t = `INTERVIEW TRANSCRIPT — ${date}\n${"═".repeat(52)}\n\n`;
  questions.forEach((q, i) => {
    const key = `q${i + 1}`;
    t += `Q${i + 1}: ${q}\nA:  ${answers[key] || "(no answer captured)"}\n\n`;
  });
  if (answers.qa) {
    t += `${"─".repeat(52)}\nOPEN Q&A\n${answers.qa}\n\n`;
  }
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
    preSessionEnabled: Boolean(raw?.preSessionEnabled),
    preSessionNote: String(raw?.preSessionNote || ""),
    postSessionQAEnabled: Boolean(raw?.postSessionQAEnabled),
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
  const counterQuestionCountRef = useRef<Record<number, number>>({});
  const speechStartedAtRef = useRef<number | null>(null);
  const lastAnswerDurationMsRef = useRef<number | null>(null);
  const closingTextRef = useRef("");
  // The literal text of whatever question is currently "live" — the top-level question, or the
  // most recent follow-up within it. Clarify/off-topic repeats must target THIS, not always the
  // top-level question, since the candidate may be mid-elaboration-chain when either fires.
  const currentAskedQuestionRef = useRef("");
  // What kind of tool call is outstanding, so the watchdog can react correctly instead of
  // always defaulting to "just advance" — that default is wrong when a FORCED follow-up
  // (<10s case) silently fails, since blindly advancing corrupts qIdx/answer attribution
  // mid-epic. null once a response is scripted (no tool call is ever expected then).
  const pendingKindRef = useRef<"decision" | "forced_elaborate" | "decision_retry" | null>(null);
  const inOpenQaRef = useRef(false);
  const qaRoundsRef = useRef(0);
  const qaGroundingTextRef = useRef("");
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
      qaGroundingTextRef.current = "";
      if (ctxRef.current?.postSessionQAEnabled) {
        try {
          const groundingRes = await fetch(`${API_BASE}/admin/ai/intake-qa-grounding`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          const groundingData = await groundingRes.json().catch(() => ({}));
          if (groundingRes.ok) qaGroundingTextRef.current = String(groundingData?.qaGroundingText || "");
        } catch {}
      }

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
        counterQuestionCountRef.current = {};
        speechStartedAtRef.current = null;
        lastAnswerDurationMsRef.current = null;
        inOpenQaRef.current = false;
        qaRoundsRef.current = 0;
        debugLogRef.current = [];
        setDebugLog([]);
        const qs = allQuestionsRef.current;
        const liveCtx = ctxRef.current;
        currentAskedQuestionRef.current = qs[0] || "";

        const isWeeklyCtx = liveCtx.key === "weekly_update" || liveCtx.mcpActions.some((a) => a === "submit_weekly_update" || a === "updates_write");
        const closingDefault = isWeeklyCtx
          ? `Thank the person warmly and let them know their responses have been recorded.`
          : `Thank the candidate warmly, tell them a human will review their responses, and wish them well.`;
        closingTextRef.current = liveCtx.endNote?.trim() || closingDefault;

        // Note: question text and ordering are NOT included here — they're delivered fresh,
        // per-turn, via scripted tool_choice:"none" responses so the model never has to
        // "remember" the list or comply with a rule that's buried many turns back.
        // Persona/behavior comes from the context itself (admin-editable) — PROTOCOL_INSTRUCTIONS
        // is the only hardcoded, non-overridable part, and it's appended last.
        const sessionInstructions = [
          liveCtx.sessionPrompt?.trim() || DEFAULT_PERSONA,
          liveCtx.customInstructions?.trim() ? `\nBehavior rules for this interview:\n${liveCtx.customInstructions.trim()}` : "",
          liveCtx.backgroundInfo?.trim() ? `\nBackground context (for tone only, not to be recited):\n${liveCtx.backgroundInfo.trim()}` : "",
          `\n${PROTOCOL_INSTRUCTIONS}`,
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
        // hand the model the literal Q1 text to speak. If preSessionEnabled, the overview is
        // folded into this SAME turn (natural paraphrase, not verbatim) rather than a separate
        // round-trip — simplest way to give "a quick glance of how this interview would look"
        // without adding a new state to track.
        const overviewText = liveCtx.preSessionEnabled
          ? (liveCtx.preSessionNote?.trim() ||
              `This will be a short interview with ${qs.length} question${qs.length === 1 ? "" : "s"} about ${liveCtx.label || "a few topics"}, and it should take about ${Math.max(3, qs.length * 2)} minutes.`)
          : "";
        responseInProgressRef.current = true;
        expectingToolCallRef.current = false;
        dc.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Begin the session now. Greet warmly as your persona, do NOT say your model name or mention ChatGPT.${overviewText ? ` Then say, adapted naturally in your own words but keeping the same meaning: "${overviewText}"` : ""} Then say exactly and only: "${qs[0]}"`,
            tool_choice: "none",
          },
        }));
        addDebug("out", "response.create", `greet${overviewText ? " + overview" : ""} → Q1: "${(qs[0] || "").slice(0, 60)}" (tool_choice=none)`);
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
            // An error event can arrive INSTEAD OF response.done (e.g. a rejected pinned
            // tool_choice during forced elaboration). Without resetting state here,
            // responseInProgressRef stays stuck true forever and the transcription handler's
            // guard silently drops every future candidate turn — the session looks "over"
            // when it's actually just wedged. Recover exactly like the response.done watchdog.
            setErr(String(msg?.error?.message || "Realtime error"));
            const wasExpectingToolCall = expectingToolCallRef.current;
            const kind = pendingKindRef.current;
            responseInProgressRef.current = false;
            expectingToolCallRef.current = false;
            pendingKindRef.current = null;
            if (wasExpectingToolCall) {
              addDebug("info", "watchdog", `error event while expecting tool call (${kind || "none"}) — recovering`);
              if (kind === "forced_elaborate") {
                requestToolDecision({ kind: "decision_retry" });
              } else {
                performAdvance(false);
              }
            }
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
              pendingKindRef.current = null;
              handleFunctionCall(fnCall);
            } else if (expectingToolCallRef.current) {
              expectingToolCallRef.current = false;
              const kind = pendingKindRef.current;
              pendingKindRef.current = null;
              if (kind === "forced_elaborate") {
                // A forced ask_follow_up_question call didn't come through. Do NOT advance —
                // qIdx must not move while the candidate is still mid-answer on this topic.
                // Retry once as an open decision instead of a pinned single-function call.
                addDebug("info", "watchdog", "forced follow-up call missing — retrying as open tool decision (qIdx untouched)");
                requestToolDecision({ kind: "decision_retry" });
              } else {
                // An open decision (or its retry) came back empty — safety net so a skip is
                // never silent. Advancing here is the correct fallback: the model already had
                // the chance to choose ask_follow_up_question and didn't take it.
                addDebug("info", "watchdog", "model responded without required tool call — forcing advance");
                performAdvance(false);
              }
            }
          }
          if (type === "response.audio_transcript.delta" || type === "response.output_audio_transcript.delta") {
            setAiSpeaking(true);
          }
          if (type === "response.audio_transcript.done" || type === "response.output_audio_transcript.done") {
            setAiSpeaking(false);
          }
          // Track how long the candidate actually spoke this turn (first speech_started to
          // last speech_stopped), so "under 30s" is measured, not guessed by the model.
          if (type === "input_audio_buffer.speech_started" && speechStartedAtRef.current == null) {
            speechStartedAtRef.current = Date.now();
          }
          if (type === "input_audio_buffer.speech_stopped" && speechStartedAtRef.current != null) {
            lastAnswerDurationMsRef.current = Date.now() - speechStartedAtRef.current;
          }
          if (type === "conversation.item.input_audio_transcription.completed") {
            const text = String(msg?.transcript || "").trim();
            if (!text || responseInProgressRef.current) return;

            if (inOpenQaRef.current) {
              // Open Q&A: deliberately NO duration/elaboration logic here — a brief "no" is a
              // complete, valid answer by definition, unlike a fixed interview question. This
              // is the actual fix for "AI keeps asking to clarify 'no I don't have questions'".
              setAnswers((prev) => ({ ...prev, qa: (prev.qa ? `${prev.qa} | ` : "") + text }));
              const channel = dcRef.current;
              if (!channel) return;
              responseInProgressRef.current = true;
              requestOpenQaDecision();
              return;
            }

            const currentIdx = qIdxRef.current;
            const key = `q${currentIdx + 1}`;
            setAnswers((prev) => ({ ...prev, [key]: (prev[key] ? `${prev[key]} ` : "") + text }));

            const channel = dcRef.current;
            if (!channel) return;
            responseInProgressRef.current = true;

            const durationMs = lastAnswerDurationMsRef.current;
            const roundsUsed = counterQuestionCountRef.current[currentIdx] || 0;
            const safetyReached = roundsUsed >= SAFETY_MAX_FOLLOWUPS_PER_EPIC;
            const followUpGuidance = ctxRef.current?.followUpInstructions?.trim();
            const qs = allQuestionsRef.current;
            const remaining = qs.length - currentIdx - 1;
            // The model has no innate sense of how many topics are left, so left unchecked it
            // will happily spend the whole interview drilling into one — this is the missing
            // context that keeps its (deliberately uncapped) judgment well-informed.
            const pacingNote = `You are covering topic ${currentIdx + 1} of ${qs.length}${remaining > 0 ? ` (${remaining} more after this one)` : " (the last one)"}. Keep the interview moving — don't over-invest in one topic at the expense of the others.`;

            if (!safetyReached && durationMs != null && durationMs < HARD_ELABORATE_THRESHOLD_MS) {
              // Under 10s: elaboration is forced, not offered.
              addDebug("out", "response.create", `answer ${(durationMs / 1000).toFixed(1)}s < 10s → forcing elaboration (${roundsUsed + 1})`);
              requestForcedFollowUp(
                `The candidate's answer was very brief (under 10 seconds). Based specifically on what they just said, call ask_follow_up_question with ONE natural, targeted follow-up asking them to elaborate.${followUpGuidance ? ` Follow these guidelines from the interviewer's configuration: ${followUpGuidance}` : ""} ${pacingNote} ${ENGLISH_REMINDER}`
              );
              return;
            }

            const softNudge = !safetyReached && durationMs != null && durationMs < SOFT_ELABORATE_THRESHOLD_MS;
            const decisionInstructions = [
              softNudge ? `The candidate's answer was somewhat brief (under 30 seconds). Decide whether this topic has enough substance now, or whether one more targeted follow-up (ask_follow_up_question) would get meaningfully more useful information before moving on (advance_interview).` : "",
              pacingNote,
              followUpGuidance ? `Follow-up guidance from the interviewer's configuration: ${followUpGuidance}` : "",
              ENGLISH_REMINDER,
            ].filter(Boolean).join(" ");
            addDebug("out", "response.create", safetyReached
              ? "safety cap reached — forcing advance_interview/flag_off_topic only"
              : `requesting tool decision${softNudge ? " (soft nudge toward elaboration)" : ""}`);
            requestToolDecision({ kind: "decision", instructions: decisionInstructions, restrictTools: safetyReached });
          }
        } catch {}
      };

      // No embedded per-turn rules beyond what's passed in `instructions` — tool_choice
      // forces the model to choose among the allowed tools; it cannot free-speak past a
      // question. `kind` lets the response.done watchdog react correctly if this call fails.
      function requestToolDecision({ kind, instructions, restrictTools }: { kind: "decision" | "decision_retry"; instructions?: string; restrictTools?: boolean }) {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = true;
        pendingKindRef.current = kind;
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            ...(instructions ? { instructions } : {}),
            ...(restrictTools ? { tools: ADVANCE_AND_OFFTOPIC_TOOLS } : {}),
            tool_choice: "required",
          },
        }));
      }

      function requestForcedFollowUp(instructions: string) {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = true;
        pendingKindRef.current = "forced_elaborate";
        channel.send(JSON.stringify({
          type: "response.create",
          response: { instructions, tool_choice: { type: "function", name: "ask_follow_up_question" } },
        }));
      }

      function sendScriptedResponse(text: string) {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = false;
        pendingKindRef.current = null;
        speechStartedAtRef.current = null;
        channel.send(JSON.stringify({
          type: "response.create",
          response: { instructions: `Say exactly and only: "${text}"`, tool_choice: "none" },
        }));
      }

      function sendAckThenQuestion(question: string) {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = false;
        pendingKindRef.current = null;
        speechStartedAtRef.current = null;
        currentAskedQuestionRef.current = question;
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Briefly and naturally acknowledge the candidate's last answer in your own words — one short sentence, warm and human, varied phrasing (don't reuse the same stock phrase every time). Do NOT comment on audio quality, interruptions, or completeness — that's already been decided; just acknowledge normally. Then ask this exact question, word-for-word with no changes: "${question}" ${ENGLISH_REMINDER}`,
            tool_choice: "none",
          },
        }));
      }

      function requestOpenQaDecision() {
        const channel = dcRef.current;
        if (!channel) return;
        responseInProgressRef.current = true;
        expectingToolCallRef.current = true;
        pendingKindRef.current = "decision";
        qaRoundsRef.current += 1;
        const safetyReached = qaRoundsRef.current > MAX_QA_ROUNDS;
        const grounding = qaGroundingTextRef.current;
        addDebug("out", "response.create", safetyReached
          ? "qa safety cap reached — forcing conclude_qa"
          : `qa round ${qaRoundsRef.current}/${MAX_QA_ROUNDS} — requesting answer/conclude decision`);
        channel.send(JSON.stringify({
          type: "response.create",
          response: {
            instructions: safetyReached
              ? `The candidate has asked several questions already — it's time to wrap up. Call conclude_qa now regardless of what they just said.`
              : `The candidate just responded to being asked if they have any questions for you. If they asked a real question, call answer_candidate_question and answer it using ONLY this company information — never invent facts beyond it: ${grounding || "(No additional company information is available. If you can't answer from general public knowledge of Fluke Games, say politely that a team member will follow up with details.)"} If they said no, declined, or gave any closing/negative response, call conclude_qa. ${ENGLISH_REMINDER}`,
            tools: safetyReached ? [CONCLUDE_QA_TOOL] : OPEN_QA_TOOLS,
            tool_choice: "required",
          },
        }));
      }

      function performAdvance(seemsIncomplete: boolean) {
        const qs = allQuestionsRef.current;
        const currentIdx = qIdxRef.current;

        if (seemsIncomplete && (followUpCountRef.current[currentIdx] || 0) < 1) {
          followUpCountRef.current[currentIdx] = (followUpCountRef.current[currentIdx] || 0) + 1;
          addDebug("out", "response.create", `clarify → repeat current question (tool_choice=none)`);
          sendScriptedResponse(`${CLARIFY_PROMPT} ${currentAskedQuestionRef.current}`);
          return;
        }

        const nextIdx = currentIdx + 1;
        counterQuestionCountRef.current[currentIdx] = 0;
        if (nextIdx < qs.length) {
          qIdxRef.current = nextIdx;
          setQIdx(nextIdx);
          addDebug("out", "response.create", `→ Q${nextIdx + 1}: "${qs[nextIdx].slice(0, 60)}" (natural ack, tool_choice=none)`);
          sendAckThenQuestion(qs[nextIdx]);
        } else if (ctxRef.current?.postSessionQAEnabled && !inOpenQaRef.current) {
          // All fixed questions done — enter open Q&A instead of the rigid "any questions for
          // me?" list item, which is what caused the elaboration/clarify loop on short "no"s.
          inOpenQaRef.current = true;
          qaRoundsRef.current = 0;
          qIdxRef.current = qs.length;
          setQIdx(qs.length);
          currentAskedQuestionRef.current = OPEN_QA_PROMPT;
          addDebug("out", "response.create", "entering open Q&A (tool_choice=none)");
          sendScriptedResponse(OPEN_QA_PROMPT);
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
          addDebug("out", "response.create", `off-topic redirect → repeat current question (tool_choice=none)`);
          sendScriptedResponse(`${OFF_TOPIC_REDIRECT} ${currentAskedQuestionRef.current}`);
          return;
        }

        if (name === "ask_follow_up_question") {
          const currentIdx = qIdxRef.current;
          counterQuestionCountRef.current[currentIdx] = (counterQuestionCountRef.current[currentIdx] || 0) + 1;
          const followUp = String(args?.follow_up_question || "").trim() || CLARIFY_PROMPT;
          currentAskedQuestionRef.current = followUp;
          addDebug("out", "response.create", `follow-up ${counterQuestionCountRef.current[currentIdx]}/${SAFETY_MAX_FOLLOWUPS_PER_EPIC}: "${followUp.slice(0, 60)}" (tool_choice=none)`);
          sendScriptedResponse(followUp);
          return;
        }

        if (name === "answer_candidate_question") {
          const answer = String(args?.answer || "").trim() || "I'm not certain about that, but a team member will follow up with you on it.";
          currentAskedQuestionRef.current = OPEN_QA_FOLLOWUP_PROMPT;
          addDebug("out", "response.create", `qa answer: "${answer.slice(0, 60)}" (tool_choice=none)`);
          sendScriptedResponse(`${answer} ${OPEN_QA_FOLLOWUP_PROMPT}`);
          return;
        }

        if (name === "conclude_qa") {
          inOpenQaRef.current = false;
          addDebug("out", "response.create", "qa concluded → closing (tool_choice=none)");
          sendScriptedResponse(closingTextRef.current);
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
