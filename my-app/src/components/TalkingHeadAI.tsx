import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AIProvider } from "../api/types/ai";

// ─── API config ───────────────────────────────────────────────────────────────
const API_BASE = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";
const WS_URL = "wss://nxlqrs6xd2.execute-api.us-east-1.amazonaws.com/production";
const CHAT_URL = `${API_BASE}/ai/chat/internal`;
const TTS_URL = `${API_BASE}/ai/tts/internal`;
const GENERATE_URL = `${API_BASE}/api/generate`;

const PROVIDER_MODEL: Record<Exclude<AIProvider, "auto">, string> = {
  openai: "gpt-5-mini",
  ollama: "qwen3:4b",
};

// ─── TalkingHead local module config ──────────────────────────────────────────
const TALKINGHEAD_MODULE_CANDIDATES = [
  "./modules/talkinghead.mjs",
  "./modules/talkingHead.mjs",
];
const AVATAR_OPTIONS = [
  { value: "/assets/brunette.glb", label: "Brunette" },
  { value: "/assets/brunette-t.glb", label: "Brunette T" },
  { value: "/assets/brunette1234.glb", label: "Brunette 1234" },
  { value: "/assets/boy.glb", label: "Boy" },
  { value: "/assets/vaibhav_untidy.glb", label: "Vaibhav Untidy" },
  { value: "/assets/vaibhav_untidy_animated.glb", label: "Vaibhav Untidy Animated" },
];
const DEFAULT_AVATAR_URL = AVATAR_OPTIONS[0].value;

type AnimName = "walking" | "yelling";
const ANIM_FILES: Record<AnimName, string> = {
  walking: "/assets/walking.fbx",
  yelling: "/assets/Yelling.fbx",
};

// ─── Locked voice defaults ────────────────────────────────────────────────────
const DEFAULT_TTS_LANG = "en-US";
const DEFAULT_TTS_VOICE = "en-US-Chirp3-HD-Aoede";
const DEFAULT_KOKORO_VOICE = "af_bella";

const GOOGLE_VOICE_OPTIONS = [
  { value: "en-US-Chirp3-HD-Aoede", label: "Chirp 3 HD • Aoede" },
  { value: "en-US-Chirp3-HD-Charon", label: "Chirp 3 HD • Charon" },
  { value: "en-US-Chirp3-HD-Fenrir", label: "Chirp 3 HD • Fenrir" },
  { value: "en-US-Chirp3-HD-Kore", label: "Chirp 3 HD • Kore" },
  { value: "en-US-Standard-F", label: "Standard • F" },
  { value: "en-US-Standard-C", label: "Standard • C" },
  { value: "en-US-Standard-D", label: "Standard • D" },
];

const KOKORO_VOICE_OPTIONS = [
  { value: "af_bella", label: "Kokoro - Bella" },
  { value: "af_sarah", label: "Kokoro - Sarah" },
  { value: "am_adam", label: "Kokoro - Adam" },
  { value: "am_michael", label: "Kokoro - Michael" },
];

// ─── Sample dialog chips ──────────────────────────────────────────────────────
const SAMPLE_DIALOGS = [
  "Hello there. I am ready to speak with a more polished mouth animation.",
  "This is a sample dialogue to test jaw opening, viseme strength, and timing.",
  "Watch my mouth closely while I pronounce words with different shapes and pauses.",
  "The quick brown fox jumps over the lazy dog. Amazing visuals, right?",
  "Can you hear how this sentence flows while the lipsync tries to keep up?",
];

// ─── Tunable polish defaults ──────────────────────────────────────────────────
type AvatarPolish = {
  avatarSpeakingEyeContact: number;
  avatarSpeakingHeadMove: number;
  avatarIdleEyeContact: number;
  lightAmbientIntensity: number;
  lightDirectIntensity: number;
  lightSpotIntensity: number;
  modelFPS: number;
  modelPixelRatio: number;
  animationDuration: number;
  animationIndex: number;
  animationScale: number;
  browserSpeechRate: number;
  browserSpeechPitch: number;
  browserSpeechVolume: number;
  visemeStrengthBase: number;
  visemeStrengthWave: number;
  visemeStrengthFreq: number;
  jawOpenBase: number;
  jawOpenWave: number;
  jawOpenFreq: number;
  jawOpenPhase: number;
  mouthOpenBase: number;
  mouthOpenWave: number;
  mouthOpenFreq: number;
  visemeStartStrength: number;
  visemeResumeStrength: number;
  fallbackTickMs: number;
  fallbackSpaceMs: number;
  fallbackCommaMs: number;
  fallbackSentenceMs: number;
  fallbackBoundaryKickoffMs: number;
  smoothLerpRate: number;
  estimateMsPerWord: number;
  estimateMinMs: number;
  estimateMaxMs: number;
};

type LipProfile = Pick<
  AvatarPolish,
  | "visemeStrengthBase"
  | "visemeStrengthWave"
  | "visemeStrengthFreq"
  | "jawOpenBase"
  | "jawOpenWave"
  | "jawOpenFreq"
  | "jawOpenPhase"
  | "mouthOpenBase"
  | "mouthOpenWave"
  | "mouthOpenFreq"
  | "visemeStartStrength"
  | "visemeResumeStrength"
  | "fallbackTickMs"
  | "fallbackSpaceMs"
  | "fallbackCommaMs"
  | "fallbackSentenceMs"
  | "fallbackBoundaryKickoffMs"
  | "smoothLerpRate"
>;

const AVATAR_DEFAULTS: AvatarPolish = {
  avatarSpeakingEyeContact: 0.72,
  avatarSpeakingHeadMove: 0.38,
  avatarIdleEyeContact: 0.24,

  lightAmbientIntensity: 2.15,
  lightDirectIntensity: 28,
  lightSpotIntensity: 0,
  modelFPS: 30,
  modelPixelRatio: 1,

  animationDuration: 10,
  animationIndex: 0,
  animationScale: 0.01,

  browserSpeechRate: 1.0,
  browserSpeechPitch: 1.02,
  browserSpeechVolume: 1,

  visemeStrengthBase: 0.92,
  visemeStrengthWave: 0.28,
  visemeStrengthFreq: 29,

  jawOpenBase: 0.33,
  jawOpenWave: 0.26,
  jawOpenFreq: 36,
  jawOpenPhase: 0.7,

  mouthOpenBase: 0.31,
  mouthOpenWave: 0.27,
  mouthOpenFreq: 39,

  visemeStartStrength: 0.9,
  visemeResumeStrength: 0.88,

  fallbackTickMs: 36,
  fallbackSpaceMs: 48,
  fallbackCommaMs: 95,
  fallbackSentenceMs: 160,
  fallbackBoundaryKickoffMs: 60,

  smoothLerpRate: 44,

  estimateMsPerWord: 355,
  estimateMinMs: 1800,
  estimateMaxMs: 25000,
};

const AVATAR_MOODS = {
  speakingMood: "happy",
  idleMood: "neutral",
} as const;

const GOOGLE_LIPSYNC_PROFILE: LipProfile = {
  visemeStrengthBase: 0.95,
  visemeStrengthWave: 0.24,
  visemeStrengthFreq: 30,
  jawOpenBase: 0.3,
  jawOpenWave: 0.23,
  jawOpenFreq: 34,
  jawOpenPhase: 0.7,
  mouthOpenBase: 0.28,
  mouthOpenWave: 0.23,
  mouthOpenFreq: 36,
  visemeStartStrength: 0.92,
  visemeResumeStrength: 0.9,
  fallbackTickMs: 28,
  fallbackSpaceMs: 40,
  fallbackCommaMs: 78,
  fallbackSentenceMs: 130,
  fallbackBoundaryKickoffMs: 42,
  smoothLerpRate: 42,
};

const KOKORO_NATIVE_LIPSYNC_PROFILE: LipProfile = {
  visemeStrengthBase: 1.14,
  visemeStrengthWave: 0.16,
  visemeStrengthFreq: 26,
  jawOpenBase: 0.42,
  jawOpenWave: 0.28,
  jawOpenFreq: 33,
  jawOpenPhase: 0.7,
  mouthOpenBase: 0.4,
  mouthOpenWave: 0.28,
  mouthOpenFreq: 35,
  visemeStartStrength: 1.0,
  visemeResumeStrength: 0.96,
  fallbackTickMs: 30,
  fallbackSpaceMs: 42,
  fallbackCommaMs: 80,
  fallbackSentenceMs: 130,
  fallbackBoundaryKickoffMs: 45,
  smoothLerpRate: 40,
};

// ─── Witty loading lines ──────────────────────────────────────────────────────
const CHAT_WITTY_MESSAGES = [
  "Thinking…",
  "Reviewing context…",
  "Analyzing request…",
  "Preparing response…",
  "Composing answer…",
  "Loading the brain cell that handles this…",
  "Trying not to hallucinate confidently…",
  "Checking whether this is a trick question…",
];

// ─── Types ────────────────────────────────────────────────────────────────────
type FocusMode = "face" | "full";
type ProviderType = Exclude<AIProvider, "auto">;
type TtsMode = "auto" | "google" | "kokoro" | "manual";
type ChatRole = "user" | "assistant";

type ChatMetaTag = { label: string; value: string };

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  tags?: ChatMetaTag[];
  requestClientId?: string;
  finalized?: boolean;
  stopped?: boolean;
};

type TalkingHeadCtor = new (
  node: HTMLElement,
  opt?: Record<string, any>
) => TalkingHeadInstance;

type TalkingHeadInstance = {
  showAvatar: (
    avatar: Record<string, any>,
    onprogress?: (ev: ProgressEvent<EventTarget>) => void
  ) => Promise<void>;
  setView?: (view: "head" | "full", opt?: Record<string, any>) => void;
  setMood?: (mood: string) => void;
  speakText?: (
    text: string,
    opt?: Record<string, any>,
    onsubtitles?: (subtitle: string) => void,
    excludes?: Array<[number, number]>
  ) => void;
  speakMarker?: (onmarker: () => void) => void;
  playAnimation?: (
    url: string,
    onprogress?: ((ev: ProgressEvent<EventTarget>) => void) | null,
    dur?: number,
    ndx?: number,
    scale?: number
  ) => void;
  stopAnimation?: () => void;
  start?: () => void;
  stop?: () => void;
  setFixedValue?: (name: string, value: number | null) => void;
};

// ─── Viseme tables ────────────────────────────────────────────────────────────
const VISEME_GROUPS: Record<string, string[]> = {
  sil: [" ", ".", ",", "!", "?", ";", ":"],
  PP: ["b", "m", "p"],
  FF: ["f", "v"],
  TH: ["th"],
  DD: ["t", "d", "l"],
  kk: ["k", "g", "q", "c"],
  CH: ["j", "ch", "sh"],
  SS: ["s", "z", "x"],
  nn: ["n"],
  RR: ["r"],
  aa: ["a"],
  E: ["e"],
  I: ["i", "y"],
  O: ["o"],
  U: ["u", "w"],
};

function createCharToVisemeMap(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  Object.entries(VISEME_GROUPS).forEach(([viseme, chars]) => {
    chars.forEach((char) => entries.push([char, viseme]));
  });
  entries.sort((a, b) => b[0].length - a[0].length);
  return entries;
}

const CHAR_TO_VISEME = createCharToVisemeMap();

function visemeForTextAt(text: string, index: number): string {
  const safeIndex = Math.max(0, Math.min(index, text.length - 1));
  const slice = text.toLowerCase().slice(safeIndex, safeIndex + 3);

  for (const [pattern, viseme] of CHAR_TO_VISEME) {
    if (slice.startsWith(pattern)) return viseme;
  }

  const one = (text[safeIndex] || " ").toLowerCase();
  for (const [pattern, viseme] of CHAR_TO_VISEME) {
    if (pattern.length === 1 && one === pattern) return viseme;
  }

  return /[aeiou]/.test(one) ? "aa" : "sil";
}

function isPauseChar(ch: string) {
  return /[.,!?;:\s]/.test(ch);
}

const TALKING_HEAD_VISEMES = new Set([
  "sil",
  "PP",
  "FF",
  "TH",
  "DD",
  "kk",
  "CH",
  "SS",
  "nn",
  "RR",
  "aa",
  "E",
  "I",
  "O",
  "U",
]);

function normalizeProviderViseme(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (TALKING_HEAD_VISEMES.has(raw)) return raw;

  const lower = raw.toLowerCase();
  const alias: Record<string, string> = {
    a: "aa",
    aa: "aa",
    e: "E",
    i: "I",
    o: "O",
    u: "U",
    kk: "kk",
    nn: "nn",
    rr: "RR",
    pp: "PP",
    ff: "FF",
    th: "TH",
    dd: "DD",
    ch: "CH",
    ss: "SS",
    sil: "sil",
  };
  const normalized = alias[lower];
  return normalized && TALKING_HEAD_VISEMES.has(normalized) ? normalized : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStableSessionId() {
  const key = "fluke_talking_head_session_id";
  if (typeof window === "undefined") return `session_${uid()}`;
  const existing = window.localStorage.getItem(key);
  if (existing?.trim()) return existing;
  const next = `session_${uid()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function makeRequestClientId(sessionId: string) {
  return `${sessionId}__req__${uid()}`;
}

function normalizeSpeechText(text: string) {
  return text.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function polishAssistantReply(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderPolishedMessageContent(text: string, isUser: boolean) {
  const input = String(text || "");
  const lines = input.split("\n");
  const parts: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];

  const flushCode = () => {
    if (!codeLines.length) return;
    parts.push(
      <pre
        key={`code_${parts.length}`}
        style={{
          margin: "8px 0",
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,0.25)",
          background: "rgba(2,6,23,0.55)",
          color: "#e2e8f0",
          fontSize: 12.5,
          lineHeight: 1.6,
          overflowX: "auto",
        }}
      >
        {codeLines.join("\n")}
      </pre>
    );
    codeLines = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      parts.push(<div key={`sp_${parts.length}`} style={{ height: 6 }} />);
      continue;
    }

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      parts.push(
        <div
          key={`h_${parts.length}`}
          style={{
            margin: "2px 0 4px",
            fontSize: 13,
            fontWeight: 900,
            color: isUser ? "#f7fee7" : "#dbeafe",
            letterSpacing: 0.2,
          }}
        >
          {heading[1]}
        </div>
      );
      continue;
    }

    const numbered = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      parts.push(
        <div
          key={`n_${parts.length}`}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "2px 0" }}
        >
          <span style={{ fontWeight: 900, color: "#93c5fd", minWidth: 20 }}>{numbered[1]}.</span>
          <span>{numbered[2]}</span>
        </div>
      );
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      parts.push(
        <div
          key={`b_${parts.length}`}
          style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "2px 0" }}
        >
          <span style={{ color: "#67e8f9", lineHeight: 1.2 }}>•</span>
          <span>{bullet[1]}</span>
        </div>
      );
      continue;
    }

    parts.push(
      <div key={`p_${parts.length}`} style={{ margin: "1px 0" }}>
        {line}
      </div>
    );
  }

  if (inCode) flushCode();
  return parts;
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 9px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
        color: "rgba(226,232,240,0.82)",
      }}
    >
      <span style={{ color: "rgba(148,163,184,0.82)" }}>{label}</span>
      <span style={{ color: "#f8fafc", fontWeight: 700 }}>{value}</span>
    </span>
  );
}

function estimateSpeechMs(text: string, polish: AvatarPolish) {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  return Math.min(
    Math.max(words * polish.estimateMsPerWord, polish.estimateMinMs),
    polish.estimateMaxMs
  );
}

function formatSliderValue(value: number, digits = 2) {
  return Number.isInteger(value) ? String(value) : value.toFixed(digits);
}

async function importTalkingHeadCtor(): Promise<TalkingHeadCtor> {
  let lastError: unknown = null;

  for (const path of TALKINGHEAD_MODULE_CANDIDATES) {
    try {
      const mod = await import(/* @vite-ignore */ path);
      const Ctor = mod?.TalkingHead || mod?.default?.TalkingHead || mod?.default || null;
      if (typeof Ctor === "function") {
        return Ctor as TalkingHeadCtor;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Could not import TalkingHead from /public/modules.");
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TalkingHeadAI() {
  const { api } = useAuth();
  const token = String((api as any)?.token || "").trim();

  const sessionIdRef = useRef<string>(getStableSessionId());
  const avatarNodeRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<TalkingHeadInstance | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const serverAudioRef = useRef<HTMLAudioElement | null>(null);
  const serverVisemeTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const activeLipProfileRef = useRef<LipProfile>({
    visemeStrengthBase: AVATAR_DEFAULTS.visemeStrengthBase,
    visemeStrengthWave: AVATAR_DEFAULTS.visemeStrengthWave,
    visemeStrengthFreq: AVATAR_DEFAULTS.visemeStrengthFreq,
    jawOpenBase: AVATAR_DEFAULTS.jawOpenBase,
    jawOpenWave: AVATAR_DEFAULTS.jawOpenWave,
    jawOpenFreq: AVATAR_DEFAULTS.jawOpenFreq,
    jawOpenPhase: AVATAR_DEFAULTS.jawOpenPhase,
    mouthOpenBase: AVATAR_DEFAULTS.mouthOpenBase,
    mouthOpenWave: AVATAR_DEFAULTS.mouthOpenWave,
    mouthOpenFreq: AVATAR_DEFAULTS.mouthOpenFreq,
    visemeStartStrength: AVATAR_DEFAULTS.visemeStartStrength,
    visemeResumeStrength: AVATAR_DEFAULTS.visemeResumeStrength,
    fallbackTickMs: AVATAR_DEFAULTS.fallbackTickMs,
    fallbackSpaceMs: AVATAR_DEFAULTS.fallbackSpaceMs,
    fallbackCommaMs: AVATAR_DEFAULTS.fallbackCommaMs,
    fallbackSentenceMs: AVATAR_DEFAULTS.fallbackSentenceMs,
    fallbackBoundaryKickoffMs: AVATAR_DEFAULTS.fallbackBoundaryKickoffMs,
    smoothLerpRate: AVATAR_DEFAULTS.smoothLerpRate,
  });
  const fallbackVisemeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeVisemeRef = useRef<string | null>(null);
  const nativeServerVisemeModeRef = useRef(false);
  const browserVoiceNameRef = useRef<string | null>(null);

  const speechAnimFrameRef = useRef<number | null>(null);
  const speechAnimLastTsRef = useRef<number | null>(null);
  const speechAnimStartTsRef = useRef<number | null>(null);

  const currentVisemeStrengthRef = useRef(0);
  const currentJawOpenRef = useRef(0);
  const currentMouthOpenRef = useRef(0);

  const [provider, setProvider] = useState<ProviderType>("openai");
  const [ttsMode, setTtsMode] = useState<TtsMode>("auto");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(DEFAULT_AVATAR_URL);
  const [googleVoiceName, setGoogleVoiceName] = useState(DEFAULT_TTS_VOICE);
  const [kokoroVoiceName, setKokoroVoiceName] = useState(DEFAULT_KOKORO_VOICE);
  const providerRef = useRef<ProviderType>("openai");
  const resolvedAiProviderRef = useRef<ProviderType>("openai");
  const ttsModeRef = useRef<TtsMode>("auto");
  const googleVoiceNameRef = useRef(DEFAULT_TTS_VOICE);
  const kokoroVoiceNameRef = useRef(DEFAULT_KOKORO_VOICE);
  const [focusMode, setFocusMode] = useState<FocusMode>("face");
  const [activeAnim, setActiveAnim] = useState<AnimName | null>(null);
  const [polish, setPolish] = useState<AvatarPolish>({ ...AVATAR_DEFAULTS });

  const [polishOpen, setPolishOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState({
    mouth: true,
    jaw: true,
    viseme: true,
    timing: false,
    behavior: false,
    render: false,
    ttsdebug: false,
  });

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [ttsDebug, setTtsDebug] = useState<Record<string, any> | null>(null);
  const [statusText, setStatusText] = useState("Loading avatar...");
  const [wsState, setWsState] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );
  const [avatarReady, setAvatarReady] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  useEffect(() => {
    ttsModeRef.current = ttsMode;
  }, [ttsMode]);

  useEffect(() => {
    googleVoiceNameRef.current = googleVoiceName;
  }, [googleVoiceName]);

  useEffect(() => {
    kokoroVoiceNameRef.current = kokoroVoiceName;
  }, [kokoroVoiceName]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Hi. Type a message and I will answer here and speak it out loud.",
      ts: Date.now(),
      finalized: true,
      tags: [
        { label: "Route", value: "internal" },
        { label: "Provider", value: "openai" },
      ],
    },
  ]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRequestClientIdRef = useRef<string | null>(null);
  const submitAbortRef = useRef<AbortController | null>(null);
  const registeredClientIdRef = useRef<string | null>(null);
  const speechDoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakSeqRef = useRef(0);

  const talkingHeadView = useMemo<"head" | "full">(
    () => (focusMode === "face" ? "head" : "full"),
    [focusMode]
  );

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(
      Math.max(textareaRef.current.scrollHeight, 56),
      160
    )}px`;
  }, [input]);

  function clearSpeechTimer() {
    if (speechDoneTimerRef.current !== null) {
      window.clearTimeout(speechDoneTimerRef.current);
      speechDoneTimerRef.current = null;
    }
  }

  function clearFallbackVisemeTimer() {
    if (fallbackVisemeTimerRef.current !== null) {
      window.clearTimeout(fallbackVisemeTimerRef.current);
      fallbackVisemeTimerRef.current = null;
    }
  }

  function stopSpeechAnimationLoop() {
    if (speechAnimFrameRef.current !== null) {
      window.cancelAnimationFrame(speechAnimFrameRef.current);
      speechAnimFrameRef.current = null;
    }
    speechAnimLastTsRef.current = null;
    speechAnimStartTsRef.current = null;
  }

  function clearAllVisemes() {
    const head = headRef.current;
    if (!head?.setFixedValue) return;

    const all = ["sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR", "aa", "E", "I", "O", "U"];
    all.forEach((v) => head.setFixedValue?.(`viseme_${v}`, null));
    head.setFixedValue?.("jawOpen", 0);
    head.setFixedValue?.("mouthOpen", 0);

    currentVisemeStrengthRef.current = 0;
    currentJawOpenRef.current = 0;
    currentMouthOpenRef.current = 0;
    activeVisemeRef.current = null;
  }

  function startSpeechAnimationLoop() {
    stopSpeechAnimationLoop();
    speechAnimStartTsRef.current = performance.now();
    speechAnimLastTsRef.current = performance.now();

    const tick = (now: number) => {
      const head = headRef.current;
      if (!head?.setFixedValue || !speaking) {
        speechAnimFrameRef.current = null;
        return;
      }

      const last = speechAnimLastTsRef.current ?? now;
      const delta = Math.max(0.001, (now - last) / 1000);
      const start = speechAnimStartTsRef.current ?? now;
      const t = (now - start) / 1000;
      speechAnimLastTsRef.current = now;
      const lip = activeLipProfileRef.current;
      const isNativeServerVisemeMode = nativeServerVisemeModeRef.current;

      const alpha = 1 - Math.exp(-delta * lip.smoothLerpRate);

      const targetVisemeStrength =
        activeVisemeRef.current && activeVisemeRef.current !== "sil"
          ? isNativeServerVisemeMode
            ? lip.visemeStrengthBase
            : lip.visemeStrengthBase + lip.visemeStrengthWave * Math.sin(t * lip.visemeStrengthFreq)
          : 0;

      const targetJawOpen =
        lip.jawOpenBase +
        (isNativeServerVisemeMode ? lip.jawOpenWave * 0.35 : lip.jawOpenWave) *
          Math.sin(t * lip.jawOpenFreq + lip.jawOpenPhase);

      const targetMouthOpen =
        lip.mouthOpenBase +
        (isNativeServerVisemeMode ? lip.mouthOpenWave * 0.35 : lip.mouthOpenWave) *
          Math.sin(t * lip.mouthOpenFreq);

      currentVisemeStrengthRef.current +=
        (targetVisemeStrength - currentVisemeStrengthRef.current) * alpha;
      currentJawOpenRef.current +=
        (targetJawOpen - currentJawOpenRef.current) * alpha;
      currentMouthOpenRef.current +=
        (targetMouthOpen - currentMouthOpenRef.current) * alpha;

      if (activeVisemeRef.current && activeVisemeRef.current !== "sil") {
        head.setFixedValue?.(
          `viseme_${activeVisemeRef.current}`,
          Math.max(0, currentVisemeStrengthRef.current)
        );
      }

      head.setFixedValue?.("jawOpen", Math.max(0, currentJawOpenRef.current));
      head.setFixedValue?.("mouthOpen", Math.max(0, currentMouthOpenRef.current));

      speechAnimFrameRef.current = window.requestAnimationFrame(tick);
    };

    speechAnimFrameRef.current = window.requestAnimationFrame(tick);
  }

  function applyViseme(
    viseme: string,
    strength = activeLipProfileRef.current.visemeStrengthBase,
    force = false
  ) {
    const head = headRef.current;
    if (!head?.setFixedValue) return;

    if (!force && activeVisemeRef.current === viseme) return;

    const all = ["sil", "PP", "FF", "TH", "DD", "kk", "CH", "SS", "nn", "RR", "aa", "E", "I", "O", "U"];
    all.forEach((v) => head.setFixedValue?.(`viseme_${v}`, null));

    activeVisemeRef.current = viseme === "sil" ? null : viseme;
    currentVisemeStrengthRef.current = viseme === "sil" ? 0 : strength;

    if (viseme !== "sil") {
      head.setFixedValue?.(`viseme_${viseme}`, strength);
    }
  }

  function startFallbackVisemes(text: string) {
    clearFallbackVisemeTimer();
    const normalized = normalizeSpeechText(text);
    if (!normalized.length) return;

    let charIndex = 0;

    const tick = () => {
      if (charIndex >= normalized.length) {
        applyViseme("sil");
        fallbackVisemeTimerRef.current = null;
        return;
      }

      const ch = normalized[charIndex] || " ";
      const viseme = isPauseChar(ch) ? "sil" : visemeForTextAt(normalized, charIndex);
      applyViseme(viseme);
      const lip = activeLipProfileRef.current;

      let delay = lip.fallbackTickMs;
      if (ch === " ") delay = lip.fallbackSpaceMs;
      if (/[,;:]/.test(ch)) delay = lip.fallbackCommaMs;
      if (/[.!?]/.test(ch)) delay = lip.fallbackSentenceMs;

      charIndex += 1;
      fallbackVisemeTimerRef.current = window.setTimeout(tick, delay);
    };

    tick();
  }

  function stopAvatarSpeech() {
    clearSpeechTimer();
    clearFallbackVisemeTimer();
    stopSpeechAnimationLoop();
    speakSeqRef.current += 1;
    setSpeaking(false);

    try {
      window.speechSynthesis?.cancel();
    } catch {
      //
    }

    try {
      if (serverAudioRef.current) {
        serverAudioRef.current.pause();
        serverAudioRef.current.src = "";
        serverAudioRef.current = null;
      }
    } catch {
      //
    }

    if (serverVisemeTimersRef.current.length) {
      serverVisemeTimersRef.current.forEach((id) => window.clearTimeout(id));
      serverVisemeTimersRef.current = [];
    }
    nativeServerVisemeModeRef.current = false;

    clearAllVisemes();

    try {
      headRef.current?.stop?.();
      headRef.current?.start?.();
      headRef.current?.setMood?.(AVATAR_MOODS.idleMood);
    } catch {
      //
    }

    setStatusText("Ready");
  }

  function startServerTimedVisemes(
    cleanText: string,
    timeline: Array<{ atMs?: number; charIndex?: number; viseme?: string; durationMs?: number }>
  ) {
    if (serverVisemeTimersRef.current.length) {
      serverVisemeTimersRef.current.forEach((id) => window.clearTimeout(id));
      serverVisemeTimersRef.current = [];
    }

    const points = (Array.isArray(timeline) ? timeline : [])
      .map((p) => ({
        atMs: Math.max(0, Number(p?.atMs) || 0),
        charIndex: Math.max(0, Number(p?.charIndex) || 0),
        viseme: normalizeProviderViseme(p?.viseme),
        durationMs: Math.max(0, Number(p?.durationMs) || 0),
      }))
      .sort((a, b) => a.atMs - b.atMs);

    if (!points.length) {
      startFallbackVisemes(cleanText);
      return;
    }

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const next = i + 1 < points.length ? points[i + 1] : null;
      const scheduleMs = Math.max(0, Math.round(p.atMs));
      const id = window.setTimeout(() => {
        const viseme =
          p.viseme ||
          (() => {
            const idx = Math.max(0, Math.min(p.charIndex, cleanText.length - 1));
            const ch = cleanText[idx] || " ";
            return isPauseChar(ch) ? "sil" : visemeForTextAt(cleanText, idx);
          })();
        applyViseme(viseme);
      }, scheduleMs);
      serverVisemeTimersRef.current.push(id);

      // If provider gives explicit duration and there is a gap before next viseme,
      // return to neutral at duration end to preserve native timing.
      if (p.viseme && p.durationMs > 0) {
        const endMs = Math.max(scheduleMs, Math.round(scheduleMs + p.durationMs));
        const nextStartMs = next ? Math.max(0, Math.round(next.atMs)) : Number.POSITIVE_INFINITY;
        if (endMs + 8 < nextStartMs) {
          const endId = window.setTimeout(() => {
            applyViseme("sil", 0, true);
          }, endMs);
          serverVisemeTimersRef.current.push(endId);
        }
      }
    }
  }

  useEffect(() => {
    return () => {
      submitAbortRef.current?.abort();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      clearSpeechTimer();
      clearFallbackVisemeTimer();
      stopSpeechAnimationLoop();
      wsRef.current?.close();

      try {
        headRef.current?.stopAnimation?.();
        headRef.current?.stop?.();
      } catch {
        //
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootAvatar() {
      if (!avatarNodeRef.current) return;

      setAvatarReady(false);
      setAvatarProgress(0);
      setStatusText("Loading avatar…");
      setErrorText("");

      try {
        const TalkingHead = await importTalkingHeadCtor();
        if (cancelled || !avatarNodeRef.current) return;

        avatarNodeRef.current.innerHTML = "";

        const head = new TalkingHead(avatarNodeRef.current, {
          lipsyncModules: ["en", "de", "fi", "fr", "lt"],
          cameraView: talkingHeadView,
          cameraRotateEnable: true,
          cameraPanEnable: false,
          cameraZoomEnable: true,
          modelFPS: polish.modelFPS,
          modelPixelRatio: polish.modelPixelRatio,
          avatarMood: AVATAR_MOODS.idleMood,
          lightAmbientIntensity: polish.lightAmbientIntensity,
          lightDirectIntensity: polish.lightDirectIntensity,
          lightSpotIntensity: polish.lightSpotIntensity,
        });

        headRef.current = head;

        await head.showAvatar(
          {
            url: selectedAvatarUrl,
            body: "F",
            avatarMood: AVATAR_MOODS.idleMood,
            lipsyncLang: "en",
            ttsLang: DEFAULT_TTS_LANG,
            ttsVoice: DEFAULT_TTS_VOICE,
            avatarSpeakingEyeContact: polish.avatarSpeakingEyeContact,
            avatarSpeakingHeadMove: polish.avatarSpeakingHeadMove,
            avatarIdleEyeContact: polish.avatarIdleEyeContact,
            avatarIgnoreCamera: false,
          },
          (ev) => {
            if (!ev?.lengthComputable) return;
            const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
            if (!cancelled) setAvatarProgress(pct);
          }
        );

        if (cancelled) return;

        head.setView?.(talkingHeadView);
        head.start?.();

        setAvatarReady(true);
        setStatusText("Ready");
      } catch (err: any) {
        if (cancelled) return;
        setAvatarReady(false);
        setStatusText("Avatar error");
        setErrorText(err?.message || "TalkingHead failed to load.");
      }
    }

    void bootAvatar();

    return () => {
      cancelled = true;
      clearSpeechTimer();
      clearFallbackVisemeTimer();
      stopSpeechAnimationLoop();
      try {
        headRef.current?.stopAnimation?.();
        headRef.current?.stop?.();
      } catch {
        //
      }
      headRef.current = null;
    };
  }, [
    selectedAvatarUrl,
    talkingHeadView,
    polish.avatarSpeakingEyeContact,
    polish.avatarSpeakingHeadMove,
    polish.avatarIdleEyeContact,
    polish.lightAmbientIntensity,
    polish.lightDirectIntensity,
    polish.lightSpotIntensity,
    polish.modelFPS,
    polish.modelPixelRatio,
  ]);

  useEffect(() => {
    if (!avatarReady || !headRef.current) return;
    try {
      headRef.current.setView?.(talkingHeadView);
    } catch {
      //
    }
  }, [avatarReady, talkingHeadView]);

  useEffect(() => {
    if (!headRef.current) return;

    try {
      if (!activeAnim) {
        headRef.current.stopAnimation?.();
        return;
      }

      headRef.current.playAnimation?.(
        ANIM_FILES[activeAnim],
        null,
        polish.animationDuration,
        polish.animationIndex,
        polish.animationScale
      );
      setStatusText(`Playing ${activeAnim}…`);
    } catch (err: any) {
      setErrorText(err?.message || `Failed to play ${activeAnim}.`);
    }
  }, [activeAnim, polish.animationDuration, polish.animationIndex, polish.animationScale]);

  function toggleAnim(name: AnimName) {
    setActiveAnim((prev) => (prev === name ? null : name));
  }

  function registerSocketClientId(clientId: string): boolean {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify({ action: "register", clientId }));
    registeredClientIdRef.current = clientId;
    return true;
  }

  function updateLatestForRequest(
    requestClientId: string,
    updater: (msg: ChatMessage) => ChatMessage
  ) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant" && next[i].requestClientId === requestClientId) {
          next[i] = updater(next[i]);
          return next;
        }
      }
      return prev;
    });
  }

  function connectWebSocket() {
    if (!token) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    setWsState("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    registeredClientIdRef.current = null;

    ws.onopen = () => {
      setWsState("connected");
      registerSocketClientId(activeRequestClientIdRef.current || `${sessionIdRef.current}__idle`);
    };

    ws.onmessage = (event) => {
      let data: any = {};
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data?.type === "registered" || data?.type === "ack") return;
      const reqId = activeRequestClientIdRef.current;
      if (!reqId) return;
      if (data?.clientId && String(data.clientId) !== reqId) return;

      if (data?.type === "ai-status") {
        const activeProvider = providerRef.current;
        updateLatestForRequest(reqId, (m) =>
          m.finalized || m.stopped
            ? m
            : {
                ...m,
                tags: [
                  { label: "Status", value: String(data?.status || "running") },
                  { label: "Provider", value: activeProvider },
                  { label: "Model", value: PROVIDER_MODEL[activeProvider] },
                  { label: "Request", value: reqId },
                ],
              }
        );
        return;
      }

      if (data?.type === "ai-result") {
        const reply = polishAssistantReply(String(data?.reply || "No response received."));
        const reportedProvider = String(data?.provider || "").toLowerCase();
        if (reportedProvider === "ollama" || reportedProvider === "openai") {
          resolvedAiProviderRef.current = reportedProvider as ProviderType;
          setProvider(reportedProvider as ProviderType);
        }
        const activeProvider = providerRef.current;
        const resolvedTtsMode = resolveRequestedTtsMode();
        const delayReplyForVoice = resolvedTtsMode !== "manual";

        if (delayReplyForVoice) {
          updateLatestForRequest(reqId, (m) =>
            m.stopped
              ? m
              : {
                  ...m,
                  content: "Synthesizing voice...",
                  finalized: false,
                    tags: [
                      { label: "Status", value: "tts" },
                      { label: "Provider", value: String(data?.provider || activeProvider) },
                      { label: "Model", value: PROVIDER_MODEL[activeProvider] },
                      { label: "Request", value: reqId },
                    ],
                }
          );
          setStatusText("Synthesizing voice...");
          void speakWithTalkingHead(reply, {
            onReadyToRevealText: () => {
              if (activeRequestClientIdRef.current !== reqId) return;
              updateLatestForRequest(reqId, (m) =>
                m.stopped
                  ? m
                  : {
                      ...m,
                      content: reply,
                      finalized: true,
                      tags: [
                        { label: "Status", value: "done" },
                        { label: "Provider", value: String(data?.provider || activeProvider) },
                        { label: "Model", value: PROVIDER_MODEL[activeProvider] },
                        { label: "Request", value: reqId },
                      ],
                    }
              );
              setLoading(false);
              activeRequestClientIdRef.current = null;
            },
          });
        } else {
          updateLatestForRequest(reqId, (m) =>
            m.stopped
              ? m
              : {
                  ...m,
                  content: reply,
                  finalized: true,
                  tags: [
                    { label: "Status", value: "done" },
                    { label: "Provider", value: String(data?.provider || activeProvider) },
                    { label: "Model", value: PROVIDER_MODEL[activeProvider] },
                    { label: "Request", value: reqId },
                  ],
                }
          );
          setLoading(false);
          activeRequestClientIdRef.current = null;
          void speakWithTalkingHead(reply);
        }
        return;
      }

      if (data?.type === "ai-error") {
        const errMsg = String(data?.error || "Unknown websocket error");
        updateLatestForRequest(reqId, (m) =>
          m.stopped
            ? m
            : {
                ...m,
                content: `Error: ${errMsg}`,
                finalized: true,
                tags: [
                  { label: "Status", value: "Error" },
                  { label: "Request", value: reqId },
                ],
              }
        );
        setErrorText(errMsg);
        setStatusText("Error");
        setLoading(false);
        activeRequestClientIdRef.current = null;
      }
    };

    ws.onclose = () => {
      setWsState("disconnected");
      wsRef.current = null;
      registeredClientIdRef.current = null;

      if (token) {
        if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = window.setTimeout(connectWebSocket, 1200);
      }
    };

    ws.onerror = () => setWsState("disconnected");
  }

  function resolveRequestedTtsMode() {
    const activeMode = ttsModeRef.current;
    const activeProvider = resolvedAiProviderRef.current || providerRef.current;
    return activeMode === "auto" ? (activeProvider === "openai" ? "google" : "kokoro") : activeMode;
  }

  async function requestServerTts(text: string) {
    const mode = resolveRequestedTtsMode();
    const selectedVoice =
      mode === "kokoro" ? kokoroVoiceNameRef.current : googleVoiceNameRef.current;
    const res = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        turnId: activeRequestClientIdRef.current || "",
        text,
        mode,
        engine: mode === "kokoro" ? "kokoro" : mode === "google" ? "google" : "manual",
        voice: mode === "kokoro" ? kokoroVoiceNameRef.current : undefined,
        languageCode: DEFAULT_TTS_LANG,
        voiceName: selectedVoice,
        speakingRate: 1,
      }),
    });

    const raw = await res.text();
    let parsed: any = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }

    if (!res.ok) {
      const err: any = new Error(parsed?.error || parsed?.message || raw || `TTS ${res.status}`);
      err.requestedMode = mode;
      throw err;
    }
    parsed.requestedMode = mode;
    return parsed;
  }

  useEffect(() => {
    if (!token) return;

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      registeredClientIdRef.current = null;
      setWsState("disconnected");
    };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function speakWithTalkingHead(
    text: string,
    options?: {
      onReadyToRevealText?: () => void;
    }
  ) {
    const cleanText = normalizeSpeechText(text);
    if (!cleanText) return;

    clearSpeechTimer();
    clearFallbackVisemeTimer();
    const speakSeq = ++speakSeqRef.current;
    let didRevealText = false;
    const revealTextIfNeeded = () => {
      if (didRevealText) return;
      didRevealText = true;
      options?.onReadyToRevealText?.();
    };

    const finish = () => {
      if (speakSeq !== speakSeqRef.current) return;
      stopSpeechAnimationLoop();
      clearAllVisemes();
      setSpeaking(false);
      setStatusText("Ready");
      try {
        headRef.current?.setMood?.(AVATAR_MOODS.idleMood);
      } catch {
        //
      }
    };

    try {
      setSpeaking(true);
      setStatusText("Speaking...");
      headRef.current?.setMood?.(AVATAR_MOODS.speakingMood);

      try {
        const tts = await requestServerTts(cleanText);
        const activeTurn = activeRequestClientIdRef.current;
        if (tts?.turnId && activeTurn && String(tts.turnId) !== String(activeTurn)) {
          return;
        }
        if (tts?.audioContent) {
          const mime = String(tts?.audioMimeType || "audio/mpeg");
          const audio = new Audio(`data:${mime};base64,${tts.audioContent}`);
          audio.playbackRate = 1;
          serverAudioRef.current = audio;
          const timeline = Array.isArray(tts?.visemeTimeline) ? tts.visemeTimeline : [];
          const hasNativeVisemes = timeline.some((p: any) => !!normalizeProviderViseme(p?.viseme));
          nativeServerVisemeModeRef.current = hasNativeVisemes;
          const isGoogleEngine = String(tts?.mode || "").toLowerCase() === "google";
          const isKokoroEngine = String(tts?.mode || "").toLowerCase() === "kokoro";

          activeLipProfileRef.current = isGoogleEngine
            ? GOOGLE_LIPSYNC_PROFILE
            : isKokoroEngine && hasNativeVisemes
            ? KOKORO_NATIVE_LIPSYNC_PROFILE
            : {
                visemeStrengthBase: polish.visemeStrengthBase,
                visemeStrengthWave: polish.visemeStrengthWave,
                visemeStrengthFreq: polish.visemeStrengthFreq,
                jawOpenBase: polish.jawOpenBase,
                jawOpenWave: polish.jawOpenWave,
                jawOpenFreq: polish.jawOpenFreq,
                jawOpenPhase: polish.jawOpenPhase,
                mouthOpenBase: polish.mouthOpenBase,
                mouthOpenWave: polish.mouthOpenWave,
                mouthOpenFreq: polish.mouthOpenFreq,
                visemeStartStrength: polish.visemeStartStrength,
                visemeResumeStrength: polish.visemeResumeStrength,
                fallbackTickMs: polish.fallbackTickMs,
                fallbackSpaceMs: polish.fallbackSpaceMs,
                fallbackCommaMs: polish.fallbackCommaMs,
                fallbackSentenceMs: polish.fallbackSentenceMs,
                fallbackBoundaryKickoffMs: polish.fallbackBoundaryKickoffMs,
                smoothLerpRate: polish.smoothLerpRate,
              };

          startSpeechAnimationLoop();

          if (!hasNativeVisemes) {
            applyViseme("aa", activeLipProfileRef.current.visemeStartStrength);
          }
          startServerTimedVisemes(cleanText, timeline);
          setTtsDebug({
            engine: isGoogleEngine ? "google-server" : "server",
            mode: tts?.mode || "",
            requestedMode: tts?.requestedMode || "",
            provider: tts?.provider || "",
            voiceName:
              String(tts?.requestedMode || "").toLowerCase() === "kokoro"
                ? kokoroVoiceNameRef.current
                : googleVoiceNameRef.current,
            audioMimeType: mime,
            marksCount: timeline.length,
            usage: tts?.usage || null,
            timelinePreview: timeline.slice(0, 40),
          });
          revealTextIfNeeded();

          audio.onended = () => {
            clearFallbackVisemeTimer();
            clearSpeechTimer();
            finish();
          };
          audio.onerror = () => {
            clearFallbackVisemeTimer();
            clearSpeechTimer();
            finish();
          };

          await audio.play();
          setStatusText(
            `Speaking... (${String(tts?.mode || "server-tts")}, marks ${timeline.length})`
          );
          return;
        }
      } catch (err: any) {
        revealTextIfNeeded();
        const resolvedRequestedMode =
          String(err?.requestedMode || "").trim() || resolveRequestedTtsMode();
        setTtsDebug({
          engine: "server-tts-fallback",
          mode: "fallback",
          requestedMode: resolvedRequestedMode,
          provider: "browser",
          voiceName:
            resolvedRequestedMode === "kokoro"
              ? kokoroVoiceNameRef.current
              : googleVoiceNameRef.current,
          marksCount: 0,
          error: String(err?.message || "server-tts-failed"),
          usage: { inputChars: cleanText.length },
          timelinePreview: [],
        });
        // Fallback to browser/manual speech below.
      }

      if ("speechSynthesis" in window) {
        nativeServerVisemeModeRef.current = false;
        revealTextIfNeeded();
        activeLipProfileRef.current = {
          visemeStrengthBase: polish.visemeStrengthBase,
          visemeStrengthWave: polish.visemeStrengthWave,
          visemeStrengthFreq: polish.visemeStrengthFreq,
          jawOpenBase: polish.jawOpenBase,
          jawOpenWave: polish.jawOpenWave,
          jawOpenFreq: polish.jawOpenFreq,
          jawOpenPhase: polish.jawOpenPhase,
          mouthOpenBase: polish.mouthOpenBase,
          mouthOpenWave: polish.mouthOpenWave,
          mouthOpenFreq: polish.mouthOpenFreq,
          visemeStartStrength: polish.visemeStartStrength,
          visemeResumeStrength: polish.visemeResumeStrength,
          fallbackTickMs: polish.fallbackTickMs,
          fallbackSpaceMs: polish.fallbackSpaceMs,
          fallbackCommaMs: polish.fallbackCommaMs,
          fallbackSentenceMs: polish.fallbackSentenceMs,
          fallbackBoundaryKickoffMs: polish.fallbackBoundaryKickoffMs,
          smoothLerpRate: polish.smoothLerpRate,
        };
        window.speechSynthesis.cancel();
        clearAllVisemes();
        clearFallbackVisemeTimer();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utteranceRef.current = utterance;
        utterance.lang = DEFAULT_TTS_LANG;

        const voices = window.speechSynthesis.getVoices?.() || [];
        const exactVoice = voices.find((v) => v.name === DEFAULT_TTS_VOICE) || null;
        const cachedVoice = browserVoiceNameRef.current
          ? voices.find((v) => v.name === browserVoiceNameRef.current) || null
          : null;
        const englishVoice =
          voices.find((v) => v.lang?.toLowerCase().startsWith("en")) || null;

        const chosenVoice = exactVoice || cachedVoice || englishVoice || null;

        if (chosenVoice) {
          utterance.voice = chosenVoice;
          browserVoiceNameRef.current = chosenVoice.name;
        }

        utterance.rate = polish.browserSpeechRate;
        utterance.pitch = polish.browserSpeechPitch;
        utterance.volume = polish.browserSpeechVolume;

        let boundaryFired = false;

        speechDoneTimerRef.current = window.setTimeout(() => {
          finish();
        }, estimateSpeechMs(cleanText, polish));

        utterance.onstart = () => {
          setSpeaking(true);
          setTtsDebug((prev) => {
            if (prev?.engine === "server-tts-fallback") {
              return {
                ...prev,
                browserVoice: chosenVoice?.name || "",
              };
            }
            return {
              engine: "browser-tts",
              mode: "manual",
              requestedMode:
                resolveRequestedTtsMode(),
              provider: "browser",
              voiceName: chosenVoice?.name || "",
              marksCount: 0,
              usage: { inputChars: cleanText.length },
              timelinePreview: [],
            };
          });
          setStatusText(
            `Speaking... ${chosenVoice ? `(${chosenVoice.name})` : "(browser TTS)"}`
          );

          startSpeechAnimationLoop();

          const delay = window.setTimeout(() => {
            if (!boundaryFired) startFallbackVisemes(cleanText);
          }, polish.fallbackBoundaryKickoffMs);

          (utterance as any).__fallbackDelay = delay;
          applyViseme("aa", polish.visemeStartStrength);
        };

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          if (typeof event.charIndex !== "number") return;

          if (!boundaryFired) {
            boundaryFired = true;
            clearFallbackVisemeTimer();
            const d = (utterance as any).__fallbackDelay;
            if (d) window.clearTimeout(d);
          }

          const idx = Math.max(0, Math.min(event.charIndex, cleanText.length - 1));
          const ch = cleanText[idx] || " ";
          const viseme = isPauseChar(ch) ? "sil" : visemeForTextAt(cleanText, idx);
          applyViseme(viseme);
        };

        utterance.onpause = () => {
          applyViseme("sil");
        };

        utterance.onresume = () => {
          applyViseme("aa", polish.visemeResumeStrength);
          startSpeechAnimationLoop();
        };

        utterance.onend = () => {
          const d = (utterance as any).__fallbackDelay;
          if (d) window.clearTimeout(d);
          clearFallbackVisemeTimer();
          clearSpeechTimer();
          finish();
        };

        utterance.onerror = () => {
          const d = (utterance as any).__fallbackDelay;
          if (d) window.clearTimeout(d);
          clearFallbackVisemeTimer();
          clearSpeechTimer();
          finish();
          setErrorText("Browser TTS playback failed.");
        };

        window.speechSynthesis.speak(utterance);
        return;
      }

      speechDoneTimerRef.current = globalThis.setTimeout(() => {
        finish();
      }, estimateSpeechMs(cleanText, polish));

      revealTextIfNeeded();
      setStatusText("No TTS available | using estimated speaking state");
    } catch (err: any) {
      revealTextIfNeeded();
      clearSpeechTimer();
      clearFallbackVisemeTimer();
      stopSpeechAnimationLoop();
      setSpeaking(false);
      setStatusText("Speech error");
      setErrorText(err?.message || "Speech failed.");
    }
  }

  function stopCurrentGeneration() {
    submitAbortRef.current?.abort();
    submitAbortRef.current = null;
    stopAvatarSpeech();

    const reqId = activeRequestClientIdRef.current;
    if (reqId) {
      updateLatestForRequest(reqId, (m) =>
        m.finalized
          ? m
          : {
              ...m,
              finalized: true,
              stopped: true,
              content: m.content?.trim() ? `${m.content}\n\n[Stopped]` : "Generation stopped.",
              tags: [
                { label: "Status", value: "Stopped" },
                { label: "Request", value: reqId },
              ],
            }
      );
    }

    activeRequestClientIdRef.current = null;
    setLoading(false);
    setStatusText("Ready");
  }

  function playSampleDialogue(text: string) {
    setErrorText("");
    stopCurrentGeneration();
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "assistant",
        content: text,
        ts: Date.now(),
        finalized: true,
        tags: [
          { label: "Mode", value: "Sample" },
          { label: "Voice", value: "Local preview" },
        ],
      },
    ]);
    void speakWithTalkingHead(text);
  }

  const canSend = !!input.trim() && !!token && wsState === "connected";

  const topMetaTags = useMemo(() => {
    const preferredOrder = ["Status", "Provider", "TTS", "Model", "Request"];
    const latestTaggedAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && Array.isArray(m.tags) && m.tags.length > 0);

    const byLabel = new Map<string, string>();
    if (latestTaggedAssistant?.tags?.length) {
      for (const tag of latestTaggedAssistant.tags) {
        const k = String(tag?.label || "").trim();
        const v = String(tag?.value || "").trim();
        if (!k || !v) continue;
        byLabel.set(k, v);
      }
    }

    if (!byLabel.has("Status")) byLabel.set("Status", loading ? "running" : errorText ? "error" : "ready");
    if (!byLabel.has("Provider")) byLabel.set("Provider", provider);
    if (!byLabel.has("TTS")) {
      byLabel.set(
        "TTS",
        ttsMode === "auto" ? `auto (${provider === "openai" ? "google" : "kokoro"})` : ttsMode
      );
    }
    if (!byLabel.has("Voice")) {
      byLabel.set(
        "Voice",
        resolveRequestedTtsMode() === "kokoro" ? kokoroVoiceName : googleVoiceName
      );
    }
    if (!byLabel.has("Model")) byLabel.set("Model", PROVIDER_MODEL[provider]);

    return preferredOrder
      .filter((label) => byLabel.has(label))
      .map((label) => ({ label, value: String(byLabel.get(label) || "") }));
  }, [messages, loading, errorText, provider, ttsMode, googleVoiceName, kokoroVoiceName]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (loading) {
      stopCurrentGeneration();
      return;
    }
    if (!token) {
      setErrorText("Auth token is missing.");
      return;
    }

    const requestClientId = makeRequestClientId(sessionIdRef.current);
    if (wsState === "connected" && !registerSocketClientId(requestClientId)) {
      setErrorText("WebSocket registration failed.");
      return;
    }

    activeRequestClientIdRef.current = requestClientId;
    setErrorText("");
    setLoading(true);
    setStatusText("Thinking…");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
      finalized: true,
    };

    const placeholder: ChatMessage = {
      id: uid(),
      role: "assistant",
      content: randomFrom(CHAT_WITTY_MESSAGES),
      ts: Date.now(),
      requestClientId,
      finalized: false,
      tags: [
        { label: "Status", value: "Queued" },
        { label: "Provider", value: provider },
        { label: "Model", value: PROVIDER_MODEL[provider] },
        { label: "Request", value: requestClientId },
      ],
    };

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput("");

    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      const generatePayload = {
        turnId: requestClientId,
        clientId: requestClientId,
        question: trimmed,
        message: trimmed,
        context: "internal",
        provider: "auto",
        agentEmployeeId: "project_manager_core",
        agentRole: "project_manager",
      };

      const parseJson = async (res: Response) => {
        const raw = await res.text();
        let data: any = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch {
          data = { message: raw };
        }
        if (!res.ok) {
          throw new Error(data?.error || data?.message || raw || `HTTP ${res.status}`);
        }
        return data;
      };

      let parsed: any = {};
      let immediateReply = "";

      try {
        parsed = await fetch(GENERATE_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(generatePayload),
          signal: controller.signal,
        }).then(parseJson);

        immediateReply = String(
          parsed?.replyText ?? parsed?.reply ?? parsed?.answer ?? parsed?.content ?? ""
        ).trim();
        const resolvedProvider = String(parsed?.provider || "").toLowerCase();
        if (resolvedProvider === "ollama" || resolvedProvider === "openai") {
          resolvedAiProviderRef.current = resolvedProvider as ProviderType;
          setProvider(resolvedProvider as ProviderType);
        }
      } catch {
        immediateReply = "";
      }

      // Legacy async path still supported.
      if (!immediateReply) {
        parsed = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(generatePayload),
        signal: controller.signal,
        }).then(parseJson);
      }

      if (immediateReply) {
        const reply = polishAssistantReply(immediateReply);
        const delayReplyForVoice = resolveRequestedTtsMode() !== "manual";

        if (delayReplyForVoice) {
          updateLatestForRequest(requestClientId, (m) =>
            m.finalized || m.stopped
              ? m
              : {
                  ...m,
                  content: "Synthesizing voice...",
                  finalized: false,
                  tags: [
                    { label: "Status", value: "tts" },
                    { label: "Provider", value: String(parsed?.provider || provider) },
                    { label: "Model", value: String(parsed?.model || PROVIDER_MODEL[provider]) },
                    { label: "Request", value: String(parsed?.turnId || parsed?.clientId || requestClientId) },
                  ],
                }
          );
          setStatusText("Synthesizing voice...");
          void speakWithTalkingHead(reply, {
            onReadyToRevealText: () => {
              if (activeRequestClientIdRef.current !== requestClientId) return;
              updateLatestForRequest(requestClientId, (m) =>
                m.stopped
                  ? m
                  : {
                      ...m,
                      content: reply,
                      finalized: true,
                      tags: [
                        { label: "Status", value: "done" },
                        { label: "Provider", value: String(parsed?.provider || provider) },
                        { label: "Model", value: String(parsed?.model || PROVIDER_MODEL[provider]) },
                        { label: "Request", value: String(parsed?.turnId || parsed?.clientId || requestClientId) },
                      ],
                    }
              );
              setLoading(false);
              activeRequestClientIdRef.current = null;
            },
          });
        } else {
          updateLatestForRequest(requestClientId, (m) =>
            m.finalized || m.stopped
              ? m
              : {
                  ...m,
                  content: reply,
                  finalized: true,
                  tags: [
                    { label: "Status", value: "done" },
                    { label: "Provider", value: String(parsed?.provider || provider) },
                    { label: "Model", value: String(parsed?.model || PROVIDER_MODEL[provider]) },
                    { label: "Request", value: String(parsed?.turnId || parsed?.clientId || requestClientId) },
                  ],
                }
          );
          setLoading(false);
          activeRequestClientIdRef.current = null;
          void speakWithTalkingHead(reply);
        }
        return;
      }

      updateLatestForRequest(requestClientId, (m) =>
        m.finalized
          ? m
          : {
              ...m,
              tags: [
                { label: "Status", value: String(parsed?.status || "Submitted") },
                { label: "Provider", value: String(parsed?.provider || provider) },
                { label: "Model", value: String(parsed?.model || PROVIDER_MODEL[provider]) },
                { label: "Request", value: String(parsed?.clientId || requestClientId) },
              ],
            }
      );
    } catch (err: any) {
      if (err?.name === "AbortError") return;

      const msg = err?.message || "The route failed.";
      setErrorText(msg);
      updateLatestForRequest(requestClientId, (m) => ({
        ...m,
        content: `Error: ${msg}`,
        finalized: true,
        tags: [
          { label: "Status", value: "Error" },
          { label: "Request", value: requestClientId },
        ],
      }));
      setLoading(false);
      setStatusText("Error");

      if (activeRequestClientIdRef.current === requestClientId) {
        activeRequestClientIdRef.current = null;
      }
    } finally {
      if (submitAbortRef.current === controller) submitAbortRef.current = null;
    }
  }

  async function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  }

  function stopAnimationNow() {
    try {
      headRef.current?.stopAnimation?.();
      setActiveAnim(null);
      setStatusText("Animation stopped");
    } catch (err: any) {
      setErrorText(err?.message || "Failed to stop animation.");
    }
  }

  function renderSlider(
    label: string,
    key: keyof AvatarPolish,
    min: number,
    max: number,
    step: number,
    digits = 2
  ) {
    const value = polish[key];
    if (typeof value !== "number") return null;

    return (
      <div key={String(key)} style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 12, color: "rgba(226,232,240,0.92)" }}>{label}</span>
          <span
            style={{
              minWidth: 54,
              textAlign: "right",
              fontSize: 11,
              fontWeight: 800,
              color: "#d8b4fe",
            }}
          >
            {formatSliderValue(value, digits)}
          </span>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) =>
            setPolish((prev) => ({
              ...prev,
              [key]: Number(e.target.value),
            }))
          }
          style={{
            width: "100%",
            accentColor: "#8b5cf6",
            cursor: "pointer",
          }}
        />
      </div>
    );
  }

  function renderSection(
    id: keyof typeof groupOpen,
    title: string,
    subtitle: string,
    children: React.ReactNode
  ) {
    const open = groupOpen[id];
    return (
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setGroupOpen((prev) => ({ ...prev, [id]: !prev[id] }))}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 12px",
            background: "transparent",
            border: "none",
            color: "#f8fafc",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <div style={{ display: "grid", gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>{title}</span>
            <span style={{ fontSize: 11, color: "rgba(226,232,240,0.64)" }}>{subtitle}</span>
          </div>

          <span
            style={{
              width: 26,
              height: 26,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 13,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
              flexShrink: 0,
            }}
          >
            ˅
          </span>
        </button>

        {open && (
          <div
            style={{
              padding: 12,
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gap: 12,
            }}
          >
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "calc(100dvh - 84px)",
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(360px, 470px) 1fr",
        gap: 20,
        padding: 20,
        boxSizing: "border-box",
        overflow: "hidden",
        background:
          "radial-gradient(circle at top left, rgba(34,211,238,0.10), transparent 28%), " +
          "radial-gradient(circle at top right, rgba(168,85,247,0.12), transparent 30%), " +
          "radial-gradient(circle at bottom center, rgba(14,165,233,0.08), transparent 32%), " +
          "linear-gradient(180deg, #070b16, #0a1020 45%, #090e1b)",
        color: "#f8fafc",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          borderRadius: 28,
          padding: 20,
          background: "linear-gradient(180deg, rgba(12,18,34,0.88), rgba(9,14,27,0.82))",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow:
            "0 18px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
          backdropFilter: "blur(18px)",
          display: "grid",
          gridTemplateRows: "auto auto auto auto minmax(0,1fr) auto",
          minHeight: 0,
          height: "100%",
          gap: 0,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at 0% 0%, rgba(34,211,238,0.10), transparent 28%), " +
              "radial-gradient(circle at 100% 0%, rgba(168,85,247,0.12), transparent 26%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "inline-flex",
            padding: "7px 11px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 0.7,
            background: "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18))",
            border: "1px solid rgba(255,255,255,0.10)",
            marginBottom: 12,
            width: "fit-content",
            boxShadow: "0 8px 20px rgba(0,0,0,0.18)",
          }}
        >
          TALKINGHEAD · CHAT · WS
        </div>

        <div style={{ marginBottom: 14, position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 28, lineHeight: 1.08 }}>
            Brunette Talking Head Chat
          </h1>
          <p
            style={{
              margin: 0,
              color: "rgba(226,232,240,0.78)",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            Test sample lines first, tune the mouth and jaw, then hit the AI route.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", position: "relative" }}>
          {(["openai", "ollama"] as ProviderType[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProvider(p)}
              style={{
                padding: "9px 13px",
                borderRadius: 14,
                border:
                  provider === p
                    ? "1px solid rgba(34,211,238,0.42)"
                    : "1px solid rgba(255,255,255,0.08)",
                background:
                  provider === p
                    ? "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(139,92,246,0.18))"
                    : "rgba(255,255,255,0.035)",
                color: "#f8fafc",
                cursor: "pointer",
                textTransform: "capitalize",
                boxShadow: provider === p ? "0 8px 24px rgba(34,211,238,0.10)" : "none",
              }}
            >
              {p === "openai" ? "OpenAI" : "Ollama"}
            </button>
          ))}
          {(["auto", "google", "kokoro", "manual"] as TtsMode[]).map((m) => (
            <button
              key={`tts_${m}`}
              type="button"
              onClick={() => setTtsMode(m)}
              style={{
                padding: "9px 13px",
                borderRadius: 14,
                border:
                  ttsMode === m
                    ? "1px solid rgba(251,191,36,0.45)"
                    : "1px solid rgba(255,255,255,0.08)",
                background:
                  ttsMode === m
                    ? "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(244,114,182,0.15))"
                    : "rgba(255,255,255,0.035)",
                color: "#f8fafc",
                cursor: "pointer",
                textTransform: "capitalize",
                boxShadow: ttsMode === m ? "0 8px 24px rgba(251,191,36,0.12)" : "none",
              }}
              title={
                m === "auto"
                  ? "Auto: OpenAI -> Google, Ollama -> Kokoro"
                  : m === "google"
                  ? "Force Google TTS via backend"
                  : m === "kokoro"
                  ? "Force Kokoro/HeadTTS via backend"
                  : "Force manual/browser fallback mode"
              }
            >
              {m === "auto"
                ? "TTS Auto"
                : m === "google"
                ? "TTS Google"
                : m === "kokoro"
                ? "TTS Kokoro"
                : "TTS Manual"}
            </button>
          ))}
          <select
            className="browser-default"
            value={selectedAvatarUrl}
            onChange={(e) => setSelectedAvatarUrl(e.target.value)}
            style={{
              maxWidth: 220,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#f8fafc",
              height: 38,
              padding: "0 10px",
            }}
            title="Select avatar from /public/assets"
          >
            {AVATAR_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          <select
            className="browser-default"
            value={googleVoiceName}
            onChange={(e) => setGoogleVoiceName(e.target.value)}
            style={{
              maxWidth: 230,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#f8fafc",
              height: 38,
              padding: "0 10px",
            }}
            title="Google voice name used by backend TTS route"
          >
            {GOOGLE_VOICE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>

          <select
            className="browser-default"
            value={kokoroVoiceName}
            onChange={(e) => setKokoroVoiceName(e.target.value)}
            style={{
              maxWidth: 220,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#f8fafc",
              height: 38,
              padding: "0 10px",
            }}
            title="Kokoro/HeadTTS voice used by backend TTS route"
          >
            {KOKORO_VOICE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={stopCurrentGeneration}
            style={{
              padding: "9px 13px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.035)",
              color: "#f8fafc",
              cursor: "pointer",
            }}
          >
            Stop
          </button>
        </div>

        {/* sample dialogs */}
        <div
          style={{
            position: "relative",
            marginBottom: 14,
            padding: 12,
            borderRadius: 18,
            background:
              ttsDebug?.engine === "server-tts-fallback"
                ? "linear-gradient(180deg, rgba(60,15,20,0.72), rgba(25,8,12,0.72))"
                : "linear-gradient(180deg, rgba(8,13,24,0.82), rgba(8,13,24,0.64))",
            border:
              ttsDebug?.engine === "server-tts-fallback"
                ? "1px solid rgba(248,113,113,0.45)"
                : "1px solid rgba(34,211,238,0.25)",
            boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              color: "rgba(191,219,254,0.92)",
              marginBottom: 8,
            }}
          >
            Sample Dialogs
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SAMPLE_DIALOGS.map((line, index) => (
              <button
                key={`${index}_${line.slice(0, 12)}`}
                type="button"
                onClick={() => playSampleDialogue(line)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 12,
                  lineHeight: 1.3,
                  textAlign: "left",
                }}
                title={line}
              >
                Sample {index + 1}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={messagesRef}
          style={{
            overflowY: "auto",
            borderRadius: 20,
            padding: 12,
            background: "linear-gradient(180deg, rgba(2,6,23,0.48), rgba(2,6,23,0.30))",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "grid",
            gap: 12,
            alignContent: "start",
            minHeight: 0,
            position: "relative",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {topMetaTags.map((tag, i) => (
              <MetaChip key={`top_meta_${tag.label}_${i}`} label={tag.label} value={tag.value} />
            ))}
          </div>

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "88%",
                    borderRadius: isUser ? "20px 20px 8px 20px" : "20px 20px 20px 8px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: isUser
                      ? "linear-gradient(180deg, rgba(163,230,53,0.18), rgba(20,30,20,0.92))"
                      : "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
                    padding: "12px 14px 10px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      marginBottom: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 900, color: isUser ? "#ecfccb" : "#f8fafc" }}>
                      {isUser ? "You" : "Fluke AI"}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(148,163,184,0.82)" }}>
                      {formatTime(msg.ts)}
                    </div>
                  </div>

                  <div
                    style={{
                      color: "#f8fafc",
                      fontSize: 14,
                      lineHeight: 1.7,
                      wordBreak: "break-word",
                    }}
                  >
                    {renderPolishedMessageContent(msg.content, isUser)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 14, position: "relative" }}>
          <div
            style={{
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(180deg, rgba(9,14,24,0.98), rgba(7,11,20,0.98))",
              overflow: "hidden",
              boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, padding: "12px 12px 10px 14px" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder={wsState !== "connected" ? "Connecting..." : "Message Fluke AI..."}
                rows={1}
                style={{
                  width: "100%",
                  minHeight: 56,
                  maxHeight: 160,
                  boxSizing: "border-box",
                  resize: "none",
                  border: "none",
                  background: "transparent",
                  color: "#f8fafc",
                  padding: "4px 2px",
                  fontSize: 14,
                  lineHeight: 1.7,
                  outline: "none",
                }}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={!loading && !canSend}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 18,
                  border: loading
                    ? "1px solid rgba(248,113,113,0.32)"
                    : "1px solid rgba(34,211,238,0.24)",
                  background: loading
                    ? "linear-gradient(135deg, #ef4444, #7f1d1d)"
                    : !canSend
                    ? "rgba(255,255,255,0.06)"
                    : "linear-gradient(135deg, #06b6d4, #7c3aed)",
                  color: "white",
                  cursor: !loading && !canSend ? "not-allowed" : "pointer",
                  opacity: !loading && !canSend ? 0.68 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 18,
                  boxShadow: !loading && canSend ? "0 10px 24px rgba(124,58,237,0.24)" : "none",
                }}
                title={loading ? "Stop generation" : "Send message"}
              >
                <i className="material-icons" style={{ fontSize: 20 }}>
                  {loading ? "stop" : "north_east"}
                </i>
              </button>
            </div>

            <div
              style={{
                padding: "10px 14px 12px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                color: errorText ? "#fca5a5" : "rgba(226,232,240,0.62)",
                fontSize: 12,
                minHeight: 18,
              }}
            >
              {errorText ||
                `${statusText} | ${provider} | ws ${wsState} | ${token ? "auth ok" : "no token"}`}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          position: "relative",
          minHeight: 0,
          height: "100%",
          borderRadius: 28,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.32)",
          background:
            "radial-gradient(circle at top, rgba(34,211,238,0.10), transparent 25%), " +
            "radial-gradient(circle at right top, rgba(168,85,247,0.13), transparent 28%), " +
            "#090f1e",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00) 20%)",
            zIndex: 1,
          }}
        />

        {/* HUD */}
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 16,
            zIndex: 30,
            display: "grid",
            gap: 10,
            width: 380,
            maxWidth: "calc(100% - 32px)",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(10,16,30,0.72)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                backdropFilter: "blur(14px)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: speaking ? "#22c55e" : activeAnim ? "#f59e0b" : "#64748b",
                  boxShadow: speaking
                    ? "0 0 12px rgba(34,197,94,0.75)"
                    : activeAnim
                    ? "0 0 12px rgba(245,158,11,0.75)"
                    : "none",
                }}
              />
              {speaking ? "Speaking" : activeAnim ? `Playing · ${activeAnim}` : "Idle"}
            </span>

            <span
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: "rgba(10,16,30,0.72)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                backdropFilter: "blur(14px)",
                boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
              }}
            >
              Avatar {avatarReady ? "ready" : `loading ${avatarProgress}%`}
            </span>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 18,
              background: "rgba(10,16,30,0.72)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 14px 32px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.7,
                textTransform: "uppercase",
                color: "rgba(191,219,254,0.92)",
                marginBottom: 8,
              }}
            >
              Mood
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["neutral", "happy", "angry", "sad", "love"].map((mood) => (
                <button
                  key={mood}
                  type="button"
                  onClick={() => {
                    try {
                      headRef.current?.setMood?.(mood);
                      setStatusText(`Mood: ${mood}`);
                    } catch (err: any) {
                      setErrorText(err?.message || `Failed to set mood ${mood}.`);
                    }
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "#f8fafc",
                    fontSize: 12,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 18,
              background: "rgba(10,16,30,0.72)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 14px 32px rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: 0.7,
                textTransform: "uppercase",
                color: "rgba(191,219,254,0.92)",
                marginBottom: 8,
              }}
            >
              Animations
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(Object.keys(ANIM_FILES) as AnimName[]).map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleAnim(name)}
                  style={{
                    flex: 1,
                    minWidth: 88,
                    padding: "10px 12px",
                    borderRadius: 12,
                    border:
                      activeAnim === name
                        ? "1px solid rgba(245,158,11,0.70)"
                        : "1px solid rgba(255,255,255,0.10)",
                    background:
                      activeAnim === name
                        ? "linear-gradient(135deg, rgba(245,158,11,0.24), rgba(217,119,6,0.18))"
                        : "rgba(255,255,255,0.04)",
                    color: activeAnim === name ? "#fcd34d" : "#f8fafc",
                    fontWeight: activeAnim === name ? 800 : 500,
                    fontSize: 13,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {activeAnim === name ? `⏹ ${name}` : `▶ ${name}`}
                </button>
              ))}

              <button
                type="button"
                onClick={stopAnimationNow}
                style={{
                  minWidth: 88,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#f8fafc",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Stop
              </button>
            </div>
          </div>

          {/* grouped collapsible polish panel */}
          <div
            style={{
              borderRadius: 18,
              background: "rgba(10,16,30,0.72)",
              border: "1px solid rgba(255,255,255,0.10)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 14px 32px rgba(0,0,0,0.22)",
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              onClick={() => setPolishOpen((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                background: "transparent",
                border: "none",
                color: "#f8fafc",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "grid", gap: 3, textAlign: "left" }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 0.7,
                    textTransform: "uppercase",
                    color: "rgba(191,219,254,0.92)",
                  }}
                >
                  Speech Polish
                </span>
                <span style={{ fontSize: 12, color: "rgba(226,232,240,0.68)" }}>
                  Grouped tuning for mouth, jaw, visemes, timing and behavior
                </span>
              </div>

              <span
                style={{
                  width: 28,
                  height: 28,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 14,
                  transform: polishOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 180ms ease",
                }}
              >
                ˅
              </span>
            </button>

            {polishOpen && (
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  padding: 14,
                  display: "grid",
                  gap: 10,
                  maxHeight: 430,
                  overflowY: "auto",
                }}
              >
                {renderSection(
                  "mouth",
                  "Mouth",
                  "Overall mouth open shape and rhythm",
                  <>
                    {renderSlider("Mouth base", "mouthOpenBase", 0, 0.75, 0.01)}
                    {renderSlider("Mouth wave", "mouthOpenWave", 0, 0.55, 0.01)}
                    {renderSlider("Mouth frequency", "mouthOpenFreq", 1, 35, 0.1)}
                  </>
                )}

                {renderSection(
                  "jaw",
                  "Jaw",
                  "Jaw opening amount and movement phase",
                  <>
                    {renderSlider("Jaw base", "jawOpenBase", 0, 0.75, 0.01)}
                    {renderSlider("Jaw wave", "jawOpenWave", 0, 0.55, 0.01)}
                    {renderSlider("Jaw frequency", "jawOpenFreq", 1, 35, 0.1)}
                    {renderSlider("Jaw phase", "jawOpenPhase", 0, 3.14, 0.01)}
                  </>
                )}

                {renderSection(
                  "viseme",
                  "Visemes",
                  "Viseme strength, speech entry and smoothing",
                  <>
                    {renderSlider("Viseme base", "visemeStrengthBase", 0.2, 1.5, 0.01)}
                    {renderSlider("Viseme wave", "visemeStrengthWave", 0, 0.8, 0.01)}
                    {renderSlider("Viseme frequency", "visemeStrengthFreq", 1, 35, 0.1)}
                    {renderSlider("Start strength", "visemeStartStrength", 0.2, 1.5, 0.01)}
                    {renderSlider("Resume strength", "visemeResumeStrength", 0.2, 1.5, 0.01)}
                    {renderSlider("Smooth lerp", "smoothLerpRate", 4, 80, 0.1)}
                  </>
                )}

                {renderSection(
                  "timing",
                  "Timing",
                  "Fallback lipsync pacing and sentence pauses",
                  <>
                    {renderSlider("Fallback char", "fallbackTickMs", 20, 120, 1, 0)}
                    {renderSlider("Fallback space", "fallbackSpaceMs", 20, 140, 1, 0)}
                    {renderSlider("Fallback comma", "fallbackCommaMs", 40, 240, 1, 0)}
                    {renderSlider("Fallback sentence", "fallbackSentenceMs", 80, 420, 1, 0)}
                    {renderSlider("Boundary kickoff", "fallbackBoundaryKickoffMs", 0, 260, 1, 0)}
                  </>
                )}

                {renderSection(
                  "behavior",
                  "Behavior",
                  "Eye contact, head motion and speech voice settings",
                  <>
                    {renderSlider("Speaking eye contact", "avatarSpeakingEyeContact", 0, 1, 0.01)}
                    {renderSlider("Speaking head move", "avatarSpeakingHeadMove", 0, 1, 0.01)}
                    {renderSlider("Idle eye contact", "avatarIdleEyeContact", 0, 1, 0.01)}
                    {renderSlider("Speech rate", "browserSpeechRate", 0.7, 1.3, 0.01)}
                    {renderSlider("Speech pitch", "browserSpeechPitch", 0.7, 1.4, 0.01)}
                    {renderSlider("Speech volume", "browserSpeechVolume", 0, 1, 0.01)}
                  </>
                )}

                {renderSection(
                  "render",
                  "Render / Scene",
                  "Avatar render and animation playback parameters",
                  <>
                    {renderSlider("Ambient light", "lightAmbientIntensity", 0, 6, 0.05)}
                    {renderSlider("Direct light", "lightDirectIntensity", 0, 40, 0.25)}
                    {renderSlider("Spot light", "lightSpotIntensity", 0, 10, 0.1)}
                    {renderSlider("Model FPS", "modelFPS", 15, 60, 1, 0)}
                    {renderSlider("Pixel ratio", "modelPixelRatio", 0.5, 2, 0.05)}
                    {renderSlider("Anim duration", "animationDuration", 1, 20, 0.25)}
                    {renderSlider("Anim index", "animationIndex", 0, 10, 1, 0)}
                    {renderSlider("Anim scale", "animationScale", 0.001, 0.05, 0.001, 3)}
                  </>
                )}

                {renderSection(
                  "ttsdebug",
                  "TTS Debug",
                  "See requested mode, actual engine, marks and timeline payload",
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <MetaChip label="Engine" value={String(ttsDebug?.engine || "-")} />
                      <MetaChip label="Requested" value={String(ttsDebug?.requestedMode || "-")} />
                      <MetaChip label="Mode" value={String(ttsDebug?.mode || "-")} />
                      <MetaChip label="Voice" value={String(ttsDebug?.voiceName || "-")} />
                      <MetaChip label="Marks" value={String(ttsDebug?.marksCount ?? 0)} />
                    </div>
                    {!!ttsDebug?.error && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#fecaca", fontWeight: 700 }}>
                        Error: {String(ttsDebug.error)}
                      </div>
                    )}
                    <div
                      style={{
                        marginTop: 8,
                        padding: 8,
                        borderRadius: 10,
                        background: "rgba(2,6,23,0.55)",
                        border: "1px solid rgba(148,163,184,0.22)",
                        fontSize: 12,
                        color: "#cbd5e1",
                        maxHeight: 190,
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                      }}
                    >
                      {JSON.stringify(
                        {
                          usage: ttsDebug?.usage || null,
                          timelinePreview: ttsDebug?.timelinePreview || [],
                        },
                        null,
                        2
                      )}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setPolish({ ...AVATAR_DEFAULTS })}
                    style={{
                      padding: "9px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#f8fafc",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Reset defaults
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Focus mode */}
        <div
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 20,
            display: "grid",
            gap: 10,
          }}
        >
          {(["face", "full"] as FocusMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFocusMode(mode)}
              style={{
                width: 114,
                height: 46,
                borderRadius: 14,
                border:
                  focusMode === mode
                    ? "1px solid rgba(34,211,238,0.85)"
                    : "1px solid rgba(255,255,255,0.10)",
                background:
                  focusMode === mode
                    ? "linear-gradient(135deg, rgba(6,182,212,0.95), rgba(124,58,237,0.92))"
                    : "rgba(10,16,30,0.72)",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
                boxShadow:
                  focusMode === mode ? "0 12px 28px rgba(124,58,237,0.24)" : "0 8px 18px rgba(0,0,0,0.14)",
                backdropFilter: "blur(14px)",
              }}
            >
              {mode === "face" ? "Focus Face" : "Focus Full"}
            </button>
          ))}
        </div>

        {/* TalkingHead mount */}
        <div
          ref={avatarNodeRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
          }}
        />

        {!avatarReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(180deg, rgba(11,16,32,0.70), rgba(11,16,32,0.84))",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderRadius: 18,
                background: "rgba(10,16,30,0.84)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 14px 34px rgba(0,0,0,0.25)",
                fontSize: 14,
                backdropFilter: "blur(14px)",
              }}
            >
              Loading avatar {avatarProgress}%
            </div>
          </div>
        )}
      </div>

      <style>{`
        textarea::placeholder { color: rgba(255,255,255,0.32); }
        *::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        *::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.22);
          border-radius: 999px;
        }
        *::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
}
