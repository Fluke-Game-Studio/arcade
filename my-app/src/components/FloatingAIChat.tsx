import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import BotAvatar, { type BotStatus } from "../components/BotAvatar2DBit";

type ChatRole = "user" | "assistant";

type ChatMetaTag = {
  label: string;
  value: string;
};

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

type ProviderType = "openai" | "ollama";
type ChatContextType = "personal" | "public" | "internal";

type SidePanelKey =
  | "context"
  | "model"
  | "session"
  | "toggles"
  | "generation"
  | "identity"
  | "advanced";

type RuntimeWarmState = "idle" | "warming" | "ready" | "error";

const WS_URL =
  "wss://nxlqrs6xd2.execute-api.us-east-1.amazonaws.com/production";

const API_BASE =
  "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";

const CONTEXT_META: Record<
  ChatContextType,
  {
    label: string;
    description: string;
    icon: string;
    path: string;
    defaultProvider: ProviderType;
  }
> = {
  personal: {
    label: "Personal",
    description: "Private Vaibhav-facing assistant route.",
    icon: "person",
    path: `${API_BASE}/ai/chat/vaibhav`,
    defaultProvider: "openai",
  },
  public: {
    label: "Public",
    description: "Community/public facing route.",
    icon: "groups",
    path: `${API_BASE}/ai/chat/flukegames`,
    defaultProvider: "openai",
  },
  internal: {
    label: "Internal",
    description: "Protected internal workspace route.",
    icon: "lock",
    path: `${API_BASE}/ai/chat/internal`,
    defaultProvider: "ollama",
  },
};

const PROVIDER_MODEL: Record<ProviderType, string> = {
  openai: "gpt-5-mini",
  ollama: "qwen3:4b",
};

const PROVIDER_META: Record<
  ProviderType,
  { label: string; description: string; icon: string }
> = {
  openai: {
    label: "OpenAI",
    description: "Cloud-hosted route for polished responses.",
    icon: "cloud_queue",
  },
  ollama: {
    label: "Ollama",
    description: "Local/self-hosted route for internal runtime flow.",
    icon: "dns",
  },
};

const CHAT_WITTY_MESSAGES = [
  "Parsing your message like it's a suspicious quest objective...",
  "Checking if this is canon lore...",
  "Scanning for hidden plot twists...",
  "Generating 3 possible smart replies and 17 questionable ones...",
  "Loading intellectual side quest...",
  "Rebuilding thoughts from cached brain fragments...",
  "Looking for the 'actually smart' button...",
  "Aligning neurons for maximum efficiency...",
  "Simulating confidence while calculations run...",
  "Reassembling logic like IKEA furniture...",
  "Thinking harder than a tutorial boss...",
  "Checking if the answer requires touching grass...",
  "Rendering thoughts in ultra settings...",
  "Attempting to avoid an intellectual skill issue...",
  "Generating a reply with 87% confidence and 13% vibes...",
  "Checking patch notes for reality...",
  "Simulating human-like hesitation...",
  "Converting confusion into wisdom...",
  "Consulting the internet spirits...",
  "Pretending this was easy...",
  "Aligning brain threads...",
  "Running AI.exe with administrator privileges...",
  "Loading premium sarcasm assets...",
  "Buffering intellectual bandwidth...",
  "Compiling answer shaders...",
  "Running a sanity check...",
  "Downloading extra neurons...",
  "Applying temporary intelligence buff...",
  "Rebalancing thoughts for fairness...",
  "Checking if answer is OP...",
  "Simulating deep thought...",
  "Trying to not hallucinate confidently...",
  "Rolling for persuasion...",
  "Optimizing logic tree...",
  "Reconstructing context like a detective...",
  "Debugging the universe...",
  "Reading between imaginary lines...",
  "Searching the cloud for answers...",
  "Synchronizing with the knowledge server...",
  "Initializing philosophical mode...",
  "Trying to sound smarter than I feel...",
  "Checking if answer will age well...",
  "Adding dramatic pause for effect...",
  "Calibrating response generator...",
  "Activating brain overclock...",
  "Checking for plot armor...",
  "Building an answer from spare logic parts...",
  "Mining data like crypto but useful...",
  "Charging sarcasm battery...",
  "Balancing humor and intelligence...",
  "Evaluating whether this is bait...",
  "Scanning message for hidden traps...",
  "Simulating a professional tone...",
  "Installing common sense patch...",
  "Deploying reasoning algorithm...",
  "Cross-referencing reality...",
  "Making sure this isn't a trick question...",
  "Stabilizing brainwaves...",
  "Searching for an answer that won't start a war...",
  "Loading advanced guesswork...",
  "Consulting the unofficial guidebook...",
  "Generating answer with cinematic lighting...",
  "Applying narrative structure...",
  "Trying to not overthink this...",
  "Building a reply from recycled wisdom...",
  "Aligning cosmic knowledge bits...",
  "Activating long-term memory fragment...",
  "Checking if sarcasm level is safe...",
  "Turning raw data into words...",
  "Running probability simulation...",
  "Charging the logic reactor...",
  "Checking if answer is cursed...",
  "Generating response with unnecessary flair...",
  "Consulting imaginary experts...",
  "Filtering out nonsense...",
  "Reconstructing missing brain pieces...",
  "Loading backup intelligence...",
  "Stitching together useful thoughts...",
  "Trying not to panic internally...",
  "Thinking in cinematic slow motion...",
  "Balancing facts and vibes...",
  "Checking if the answer requires a disclaimer...",
  "Running an internal debate...",
  "Calculating acceptable confidence levels...",
  "Spinning up extra brain threads...",
  "Trying to avoid sounding like Wikipedia...",
  "Calibrating clarity settings...",
  "Loading context awareness...",
  "Simulating expert mode...",
  "Adjusting response difficulty...",
  "Replaying your question in my head...",
  "Turning curiosity into logic...",
  "Building a temporary knowledge tower...",
  "Stabilizing thought engine...",
  "Summoning forgotten facts...",
  "Running common sense diagnostics...",
  "Reconnecting disconnected neurons...",
  "Generating answer blueprint...",
  "Mapping idea pathways...",
  "Aligning reasoning vectors...",
  "Consulting the council of neurons...",
  "Synchronizing internal databases...",
  "Applying extra thinking cycles...",
  "Trying not to improvise too much...",
  "Scanning for contradictions...",
  "Preparing a slightly smarter response...",
  "Attempting intellectual parkour...",
  "Rechecking logic integrity...",
  "Activating curiosity subroutine...",
  "Upgrading answer stability...",
  "Testing if sarcasm fits here...",
  "Simulating deep contemplation...",
  "Searching for hidden meaning...",
  "Constructing logical scaffolding...",
  "Checking if answer is too obvious...",
  "Measuring reply confidence...",
  "Turning abstract thoughts into sentences...",
  "Optimizing clarity settings...",
  "Refining intellectual output...",
  "Stabilizing conversational flow...",
  "Inspecting your question like a bug report...",
  "Preparing structured response payload...",
  "Running mental sandbox simulation...",
  "Checking if the answer is overpowered...",
  "Balancing logic difficulty...",
  "Recalibrating knowledge sensors...",
  "Compiling final reasoning bundle...",
  "Reducing answer latency...",
  "Reformatting internal data...",
  "Rehearsing the response internally...",
  "Testing different answer builds...",
  "Calculating conversational strategy...",
  "Filtering useless thoughts...",
  "Scanning for missing context...",
  "Deploying best-guess algorithm...",
  "Rearranging knowledge fragments...",
  "Attempting to look intelligent...",
  "Initializing clarity protocol...",
  "Finalizing reply architecture...",
  "Running answer QA...",
  "Double-checking reality...",
  "Rebalancing the logic engine...",
  "Evaluating explanation quality...",
  "Cross-validating thoughts...",
  "Preparing readable output...",
  "Converting brain noise into signal...",
  "Aligning facts with language...",
  "Testing humor compatibility...",
  "Completing internal reasoning loop...",
  "Stabilizing response channel...",
];

const STATUS_MESSAGES = [
  "Thinking…",
  "Reviewing context…",
  "Analyzing request…",
  "Preparing response…",
  "Composing answer…",
];

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

function runtimeKey(provider: ProviderType, context: ChatContextType) {
  return `${context}_${provider}`;
}

function safeStr(v: unknown) {
  return v == null ? "" : String(v).trim();
}

function getRoleLower(anyUser: any) {
  const r =
    safeStr(anyUser?.employee_role) ||
    safeStr(anyUser?.role) ||
    safeStr(anyUser?.employeeRole) ||
    safeStr(anyUser?.claims?.role);
  return (r || "employee").toLowerCase();
}

function getStableSessionId() {
  const key = "fluke_ai_session_id";

  if (typeof window === "undefined") {
    return `session_${uid()}`;
  }

  const existing = window.localStorage.getItem(key);
  if (existing && existing.trim()) return existing;

  const next = `session_${uid()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function makeRequestClientId(sessionId: string) {
  return `${sessionId}__req__${uid()}`;
}

function Pill({
  icon,
  label,
  value,
  strong = false,
}: {
  icon?: string;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 10px",
        borderRadius: 999,
        background: strong
          ? "rgba(77, 208, 225, 0.18)"
          : "rgba(255,255,255,0.05)",
        border: strong
          ? "1px solid rgba(77, 208, 225, 0.34)"
          : "1px solid rgba(255,255,255,0.08)",
        color: "#dcfbff",
        fontSize: 11,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {icon && (
        <i
          className="material-icons"
          style={{ fontSize: 13, color: "rgba(125, 249, 255, 0.95)" }}
        >
          {icon}
        </i>
      )}
      <span style={{ color: "rgba(196, 244, 255, 0.82)" }}>{label}</span>
      <span style={{ color: "#ffffff", fontWeight: 800 }}>{value}</span>
    </span>
  );
}

function SideCard({
  title,
  subtitle,
  icon,
  children,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.018))",
        overflow: "hidden",
        boxShadow: open ? "0 10px 30px rgba(0,0,0,0.18)" : "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: "14px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          textAlign: "left",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "rgba(139, 92, 246, 0.16)",
              border: "1px solid rgba(77, 208, 225, 0.20)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="material-icons" style={{ fontSize: 16, color: "#9ef7ff" }}>
              {icon}
            </i>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#f3fbff" }}>{title}</div>
            {!!subtitle && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "rgba(193, 228, 255, 0.70)",
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <i
          className="material-icons"
          style={{
            color: "rgba(220,240,255,0.72)",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
            flexShrink: 0,
          }}
        >
          expand_more
        </i>
      </button>

      <div
        style={{
          display: open ? "block" : "none",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="fluke-sidecard-scroll" style={{ padding: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function FloatingAIChat() {
  const { api, user } = useAuth();

  const myRole = useMemo(() => getRoleLower(user), [user]);
  const isSuper = myRole === "super";

  const defaultContext: ChatContextType = isSuper ? "internal" : "public";

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingWarmupsRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string>(getStableSessionId());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const speakingTimerRef = useRef<number | null>(null);
  const didInitContextRef = useRef(false);
  const submitAbortRef = useRef<AbortController | null>(null);
  const activeRequestClientIdRef = useRef<string | null>(null);
  const registeredClientIdRef = useRef<string | null>(null);

  const [hovered, setHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const [selectedContext, setSelectedContext] =
    useState<ChatContextType>(defaultContext);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Welcome to Fluke AI.\n\nChoose your model route and start chatting.",
      ts: Date.now(),
      finalized: true,
      tags: [
        { label: "Context", value: CONTEXT_META[defaultContext].label },
        { label: "Auth", value: user ? "Authenticated" : "Not logged in" },
        { label: "Session", value: sessionIdRef.current },
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusThinkingText, setStatusThinkingText] = useState(STATUS_MESSAGES[0]);
  const [errorText, setErrorText] = useState("");
  const [verified, setVerified] = useState(true);
  const [wsState, setWsState] = useState<"disconnected" | "connecting" | "connected">(
    "disconnected"
  );

  const [provider, setProvider] = useState<ProviderType>(
    CONTEXT_META[defaultContext].defaultProvider
  );
  const [temperature, setTemperature] = useState(0.6);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(0.9);
  const [streaming, setStreaming] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [safeMode, setSafeMode] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);
  const [botSpeaking, setBotSpeaking] = useState(false);

  const [runtimeWarmState, setRuntimeWarmState] = useState<Record<string, RuntimeWarmState>>(
    {
      [runtimeKey("openai", "personal")]: "ready",
      [runtimeKey("openai", "public")]: "ready",
      [runtimeKey("openai", "internal")]: "ready",
      [runtimeKey("ollama", "personal")]: "idle",
      [runtimeKey("ollama", "public")]: "idle",
      [runtimeKey("ollama", "internal")]: "idle",
    }
  );

  const [runtimeWarmError, setRuntimeWarmError] = useState<Record<string, string>>({});

  const [sideOpen, setSideOpen] = useState<Record<SidePanelKey, boolean>>({
    context: true,
    model: true,
    session: true,
    toggles: true,
    generation: false,
    identity: false,
    advanced: false,
  });

  const token = useMemo(() => safeStr((api as any)?.token), [api]);
  const currentModel = useMemo(() => PROVIDER_MODEL[provider], [provider]);
  const currentRuntime = useMemo(
    () => runtimeKey(provider, selectedContext),
    [provider, selectedContext]
  );
  const currentWarmState =
    runtimeWarmState[currentRuntime] || (provider === "openai" ? "ready" : "idle");
  const currentApiUrl = useMemo(
    () => CONTEXT_META[selectedContext].path,
    [selectedContext]
  );

  const botStatus: BotStatus = botSpeaking
    ? "speaking"
    : loading
    ? provider === "ollama"
      ? "computing"
      : "thinking"
    : wsState !== "connected"
    ? "listening"
    : "neutral";

  useEffect(() => {
    if (didInitContextRef.current) return;
    didInitContextRef.current = true;
    setSelectedContext(defaultContext);
    setProvider(CONTEXT_META[defaultContext].defaultProvider);
  }, [defaultContext]);

  useEffect(() => {
    setProvider(CONTEXT_META[selectedContext].defaultProvider);
  }, [selectedContext]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;

    setStatusThinkingText(randomFrom(STATUS_MESSAGES));

    const id = window.setInterval(() => {
      setStatusThinkingText(randomFrom(STATUS_MESSAGES));

      setMessages((prev) => {
        const next = [...prev];
        const activeClientId = activeRequestClientIdRef.current;
        if (!activeClientId) return prev;

        for (let i = next.length - 1; i >= 0; i--) {
          const m = next[i];
          if (
            m.role === "assistant" &&
            m.requestClientId === activeClientId &&
            !m.finalized
          ) {
            next[i] = {
              ...m,
              content: randomFrom(CHAT_WITTY_MESSAGES),
            };
            return next;
          }
        }
        return prev;
      });
    }, 3200);

    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const next = Math.min(Math.max(textareaRef.current.scrollHeight, 56), 180);
    textareaRef.current.style.height = `${next}px`;
  }, [input]);

  useEffect(() => {
    if (!modalOpen) {
      setMobileSettingsOpen(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSettingsOpen(false);
        setModalOpen(false);
      }
    };

    if (modalOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKey);
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen]);

  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) {
        window.clearTimeout(speakingTimerRef.current);
      }
      if (submitAbortRef.current) {
        submitAbortRef.current.abort();
      }
    };
  }, []);

  const toggleSideCard = (key: SidePanelKey) => {
    setSideOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  function triggerSpeaking(duration = 2600) {
    setBotSpeaking(true);

    if (speakingTimerRef.current) {
      window.clearTimeout(speakingTimerRef.current);
    }

    speakingTimerRef.current = window.setTimeout(() => {
      setBotSpeaking(false);
      speakingTimerRef.current = null;
    }, duration);
  }

  async function postToRoute(
    routeUrl: string,
    payload: Record<string, any>,
    signal?: AbortSignal
  ) {
    const res = await fetch(routeUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });

    const raw = await res.text();

    let parsed: any = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { message: raw };
    }

    if (!res.ok) {
      throw new Error(
        parsed?.error ||
          parsed?.message ||
          raw ||
          `Request failed with status ${res.status}`
      );
    }

    return parsed;
  }

  function updateLatestMessageForRequestClientId(
    requestClientId: string,
    updater: (msg: ChatMessage) => ChatMessage
  ) {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const m = next[i];
        if (m.role === "assistant" && m.requestClientId === requestClientId) {
          next[i] = updater(m);
          return next;
        }
      }
      return prev;
    });
  }

  function registerSocketClientId(clientId: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;

    wsRef.current.send(
      JSON.stringify({
        action: "register",
        clientId,
      })
    );

    registeredClientIdRef.current = clientId;
    return true;
  }

  function connectWebSocket() {
    if (!modalOpen) return;
    if (!token) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;

    setWsState("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    registeredClientIdRef.current = null;

    ws.onopen = () => {
      setWsState("connected");

      const initialClientId =
        activeRequestClientIdRef.current || `${sessionIdRef.current}__idle`;
      registerSocketClientId(initialClientId);
    };

    ws.onmessage = (event) => {
      let data: any = {};
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      if (data?.type === "registered") {
        return;
      }

      if (data?.type === "ack") {
        return;
      }

      const activeRequestId = activeRequestClientIdRef.current;
      if (!activeRequestId) return;

      if (data?.type === "ai-status") {
        updateLatestMessageForRequestClientId(activeRequestId, (msg) => {
          if (msg.finalized || msg.stopped) return msg;

          return {
            ...msg,
            tags: [
              { label: "Status", value: safeStr(data?.status || "running") },
              { label: "Context", value: CONTEXT_META[selectedContext].label },
              { label: "Provider", value: PROVIDER_META[provider].label },
              { label: "Model", value: currentModel },
              { label: "Request", value: activeRequestId },
            ],
          };
        });
        return;
      }

      if (data?.type === "ai-result") {
        updateLatestMessageForRequestClientId(activeRequestId, (msg) => {
          if (msg.stopped) return msg;

          return {
            ...msg,
            content: safeStr(data?.reply || "No response received."),
            finalized: true,
            tags: [
              { label: "Status", value: "done" },
              { label: "Context", value: CONTEXT_META[selectedContext].label },
              { label: "Provider", value: safeStr(data?.provider || provider) },
              { label: "Type", value: safeStr(data?.contextType || selectedContext) },
              { label: "Label", value: safeStr(data?.contextLabel || selectedContext) },
              { label: "Request", value: activeRequestId },
            ],
          };
        });

        setLoading(false);
        activeRequestClientIdRef.current = null;
        triggerSpeaking();
        return;
      }

      if (data?.type === "ai-error") {
        updateLatestMessageForRequestClientId(activeRequestId, (msg) => {
          if (msg.stopped) return msg;

          return {
            ...msg,
            content: `Error: ${safeStr(data?.error || "Unknown websocket error")}`,
            finalized: true,
            tags: [
              { label: "Status", value: "Error" },
              { label: "Context", value: CONTEXT_META[selectedContext].label },
              { label: "Request", value: activeRequestId },
            ],
          };
        });

        setErrorText(safeStr(data?.error || "Unknown websocket error"));
        setLoading(false);
        activeRequestClientIdRef.current = null;
      }
    };

    ws.onclose = () => {
      setWsState("disconnected");
      wsRef.current = null;
      registeredClientIdRef.current = null;

      if (modalOpen) {
        if (reconnectTimerRef.current) {
          window.clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = window.setTimeout(() => {
          connectWebSocket();
        }, 1200);
      }
    };

    ws.onerror = () => {
      setWsState("disconnected");
    };
  }

  useEffect(() => {
    if (!modalOpen || !token) return;

    connectWebSocket();

    return () => {
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      registeredClientIdRef.current = null;
      setWsState("disconnected");
    };
  }, [modalOpen, token]);

  async function warmProviderInBackground(
    targetProvider: ProviderType,
    targetContext: ChatContextType
  ) {
    const key = runtimeKey(targetProvider, targetContext);
    const model = PROVIDER_MODEL[targetProvider];
    const routeUrl = CONTEXT_META[targetContext].path;

    if (targetProvider === "openai") {
      setRuntimeWarmState((prev) => ({ ...prev, [key]: "ready" }));
      return;
    }

    if (!token) {
      setRuntimeWarmState((prev) => ({ ...prev, [key]: "error" }));
      setRuntimeWarmError((prev) => ({
        ...prev,
        [key]: "Missing login token.",
      }));
      return;
    }

    if (pendingWarmupsRef.current.has(key)) return;
    if (runtimeWarmState[key] === "ready") return;

    pendingWarmupsRef.current.add(key);
    setRuntimeWarmError((prev) => ({ ...prev, [key]: "" }));
    setRuntimeWarmState((prev) => ({ ...prev, [key]: "warming" }));

    try {
      await postToRoute(routeUrl, {
        question: "__warmup__",
        clientId: `${sessionIdRef.current}__warmup__${targetContext}`,
        provider: targetProvider,
        model,
      });

      setRuntimeWarmState((prev) => ({ ...prev, [key]: "ready" }));
      setRuntimeWarmError((prev) => ({ ...prev, [key]: "" }));
    } catch (err: any) {
      setRuntimeWarmState((prev) => ({ ...prev, [key]: "error" }));
      setRuntimeWarmError((prev) => ({
        ...prev,
        [key]: err?.message || "Warmup failed.",
      }));
    } finally {
      pendingWarmupsRef.current.delete(key);
    }
  }

  useEffect(() => {
    if (!modalOpen) return;
    if (provider !== "ollama") return;
    void warmProviderInBackground("ollama", selectedContext);
  }, [modalOpen, provider, selectedContext, token]);

  function stopCurrentGeneration(markText = "Generation stopped.") {
    const activeRequestId = activeRequestClientIdRef.current;

    if (submitAbortRef.current) {
      submitAbortRef.current.abort();
      submitAbortRef.current = null;
    }

    if (activeRequestId) {
      updateLatestMessageForRequestClientId(activeRequestId, (msg) => {
        if (msg.finalized) return msg;
        return {
          ...msg,
          finalized: true,
          stopped: true,
          content:
            msg.content && msg.content.trim()
              ? `${msg.content}\n\n[Stopped]`
              : markText,
          tags: [
            { label: "Status", value: "Stopped" },
            { label: "Context", value: CONTEXT_META[selectedContext].label },
            { label: "Request", value: activeRequestId },
          ],
        };
      });
    }

    activeRequestClientIdRef.current = null;
    setLoading(false);
    setBotSpeaking(false);
  }

  const canSend =
    !!input.trim() &&
    verified &&
    !!user &&
    !!token &&
    wsState === "connected" &&
    (!loading || true) &&
    (provider === "openai" || currentWarmState === "ready");

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (loading) {
      stopCurrentGeneration("Previous generation stopped.");
    }

    if (!verified) {
      setErrorText("Enable verification before sending.");
      return;
    }

    if (!user) {
      setErrorText("You are not logged in.");
      return;
    }

    if (!token) {
      setErrorText("Missing login token.");
      return;
    }

    if (wsState !== "connected") {
      setErrorText("WebSocket is not connected yet.");
      return;
    }

    if (provider === "ollama" && currentWarmState !== "ready") {
      setErrorText(
        currentWarmState === "warming"
          ? `Ollama model ${currentModel} is still warming up.`
          : `Ollama model ${currentModel} is not ready yet.`
      );
      void warmProviderInBackground("ollama", selectedContext);
      return;
    }

    const requestClientId = makeRequestClientId(sessionIdRef.current);

    if (!registerSocketClientId(requestClientId)) {
      setErrorText("WebSocket registration failed.");
      return;
    }

    activeRequestClientIdRef.current = requestClientId;
    setErrorText("");
    setBotSpeaking(false);

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
      finalized: true,
    };

    const assistantMessageId = uid();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: randomFrom(CHAT_WITTY_MESSAGES),
      ts: Date.now(),
      requestClientId,
      finalized: false,
      tags: [
        { label: "Status", value: "Queued" },
        { label: "Context", value: CONTEXT_META[selectedContext].label },
        { label: "Provider", value: PROVIDER_META[provider].label },
        { label: "Model", value: currentModel },
        { label: "Request", value: requestClientId },
      ],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    submitAbortRef.current = controller;

    try {
      const parsed = await postToRoute(
        currentApiUrl,
        {
          question: trimmed,
          clientId: requestClientId,
          provider,
          model: currentModel,
          temperature,
          topP,
          maxTokens,
          streaming,
          memoryEnabled,
          includeHistory,
          safeMode,
          developerMode,
        },
        controller.signal
      );

      updateLatestMessageForRequestClientId(requestClientId, (m) =>
        m.finalized
          ? m
          : {
              ...m,
              tags: [
                { label: "Status", value: parsed?.status || "Submitted" },
                { label: "Context", value: CONTEXT_META[selectedContext].label },
                { label: "Provider", value: parsed?.provider || provider },
                { label: "Model", value: parsed?.model || currentModel },
                { label: "Request", value: parsed?.clientId || requestClientId },
              ],
            }
      );
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return;
      }

      const msg = err?.message || "The selected route failed.";
      setErrorText(msg);

      updateLatestMessageForRequestClientId(requestClientId, (m) => ({
        ...m,
        content: `Error: ${msg}`,
        finalized: true,
        tags: [
          { label: "Status", value: "Error" },
          { label: "Context", value: CONTEXT_META[selectedContext].label },
          { label: "Request", value: requestClientId },
        ],
      }));

      setLoading(false);
      if (activeRequestClientIdRef.current === requestClientId) {
        activeRequestClientIdRef.current = null;
      }
    } finally {
      if (submitAbortRef.current === controller) {
        submitAbortRef.current = null;
      }
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) {
      stopCurrentGeneration();
      return;
    }

    await sendMessage();
  };

  const onInputKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if (loading) {
        stopCurrentGeneration();
        return;
      }

      await sendMessage();
    }
  };

  const statusText = errorText
    ? errorText
    : loading
    ? `${statusThinkingText} • ${CONTEXT_META[selectedContext].label} • ${PROVIDER_META[provider].label} • ${currentModel}`
    : wsState !== "connected"
    ? "Connecting websocket..."
    : provider === "ollama" && currentWarmState === "warming"
    ? `Warming Ollama • ${CONTEXT_META[selectedContext].label} • ${currentModel}`
    : provider === "ollama" && currentWarmState === "error"
    ? runtimeWarmError[currentRuntime] || `Ollama warmup failed for ${currentModel}`
    : `${CONTEXT_META[selectedContext].label} • ${PROVIDER_META[provider].label} • ${currentModel}`;

  const collapsedItems: Array<{ key: SidePanelKey; icon: string; label: string }> = isSuper
    ? [
        { key: "context", icon: "category", label: "Context" },
        { key: "model", icon: "tune", label: "Model" },
        { key: "session", icon: "space_dashboard", label: "Session" },
        { key: "toggles", icon: "toggle_on", label: "Toggles" },
        { key: "generation", icon: "auto_fix_high", label: "Gen" },
        { key: "identity", icon: "hub", label: "Identity" },
        { key: "advanced", icon: "settings_suggest", label: "Advanced" },
      ]
    : [{ key: "model", icon: "tune", label: "Model" }];

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          zIndex: 1600,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          style={{
            position: "absolute",
            right: 82,
            bottom: 8,
            width: 340,
            borderRadius: 22,
            padding: "15px 16px",
            background:
              "linear-gradient(180deg, rgba(12,16,28,0.98), rgba(14,20,34,0.95))",
            border: "1px solid rgba(125, 249, 255, 0.14)",
            boxShadow:
              "0 22px 60px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            opacity: hovered ? 1 : 0,
            transform: hovered ? "translateY(0)" : "translateY(8px)",
            transition: "all 180ms ease",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background:
                  "linear-gradient(135deg, rgba(124,58,237,0.98), rgba(34,211,238,0.86))",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 10px 20px rgba(34,211,238,0.18)",
              }}
            >
              <i className="material-icons" style={{ fontSize: 18, color: "#fff" }}>
                auto_awesome
              </i>
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#f4fcff",
                  letterSpacing: 0.2,
                }}
              >
                Fluke AI Workspace
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: "rgba(224,245,255,0.74)",
                }}
              >
                Context-aware routing with selectable model runtime.
              </div>
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <Pill label="Context" value={CONTEXT_META[selectedContext].label} />
                <Pill label="Provider" value={PROVIDER_META[provider].label} strong />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Open Fluke AI Assistant"
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            border: "1px solid rgba(125,249,255,0.16)",
            background:
              "linear-gradient(180deg, rgba(12,16,26,0.99), rgba(16,20,34,0.99))",
            boxShadow: hovered
              ? "0 24px 50px rgba(0,0,0,0.36)"
              : "0 16px 34px rgba(0,0,0,0.30)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 180ms ease",
            transform: hovered ? "translateY(-2px)" : "translateY(0)",
            position: "relative",
            overflow: "hidden",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 25% 25%, rgba(124,58,237,0.20), transparent 35%), radial-gradient(circle at 75% 75%, rgba(34,211,238,0.18), transparent 38%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <i className="material-icons" style={{ fontSize: 18, color: "#f2fcff" }}>
              psychology_alt
            </i>
          </div>
        </button>
      </div>

      {modalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setMobileSettingsOpen(false);
              setModalOpen(false);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(5,8,16,0.80)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            style={{
              width: "min(1320px, 96vw)",
              height: "min(92vh, 940px)",
              borderRadius: 28,
              overflow: "hidden",
              background: "#0a0f1c",
              color: "#e7f8ff",
              boxShadow: "0 40px 100px rgba(0,0,0,0.56)",
              border: "1px solid rgba(125,249,255,0.10)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at top right, rgba(34,211,238,0.14), transparent 24%), radial-gradient(circle at top left, rgba(124,58,237,0.12), transparent 22%), radial-gradient(circle at bottom left, rgba(45,212,191,0.08), transparent 30%)",
              }}
            />

            <div
              style={{
                position: "relative",
                zIndex: 1,
                height: "100%",
                display: "grid",
                gridTemplateRows: "auto minmax(0, 1fr)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "18px 22px",
                  borderBottom: "1px solid rgba(125,249,255,0.10)",
                  background:
                    "linear-gradient(180deg, rgba(9,13,23,0.97), rgba(11,16,28,0.90))",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        background:
                          "linear-gradient(135deg, rgba(124,58,237,0.98), rgba(34,211,238,0.82))",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 12px 30px rgba(34,211,238,0.18)",
                        flexShrink: 0,
                      }}
                    >
                      <i className="material-icons" style={{ color: "#fff" }}>
                        psychology_alt
                      </i>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#f2fdff" }}>
                        Fluke AI Workspace
                      </div>

                      <div
                        style={{
                          marginTop: 6,
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        {isSuper && (
                          <Pill
                            icon={CONTEXT_META[selectedContext].icon}
                            label="Context"
                            value={CONTEXT_META[selectedContext].label}
                            strong
                          />
                        )}
                        <Pill
                          icon={PROVIDER_META[provider].icon}
                          label="Provider"
                          value={PROVIDER_META[provider].label}
                        />
                        <Pill icon="smart_toy" label="Model" value={currentModel} />
                        <Pill
                          icon="verified_user"
                          label="Auth"
                          value={token ? "Bearer Ready" : "Token Missing"}
                        />
                        <Pill icon="wifi" label="WS" value={wsState} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      className="fluke-ai-mobile-settings-btn"
                      onClick={() => setMobileSettingsOpen(true)}
                      style={{
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid rgba(125,249,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e7f8ff",
                        cursor: "pointer",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "0 14px",
                        display: "none",
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        tune
                      </i>
                      <span style={{ fontSize: 12, fontWeight: 800 }}>Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMobileSettingsOpen(false);
                        setModalOpen(false);
                      }}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid rgba(125,249,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e7f8ff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <i className="material-icons">close</i>
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="fluke-ai-modal-body"
                style={{
                  minHeight: 0,
                  display: "grid",
                  gridTemplateColumns: settingsCollapsed
                    ? "78px minmax(0, 1fr)"
                    : "360px minmax(0, 1fr)",
                  overflow: "hidden",
                }}
              >
                <aside
                  className={`fluke-ai-settings-panel ${mobileSettingsOpen ? "mobile-open" : ""}`}
                  style={{
                    position: "relative",
                    minHeight: 0,
                    borderRight: "1px solid rgba(125,249,255,0.10)",
                    background:
                      "linear-gradient(180deg, rgba(10,15,26,0.98), rgba(12,18,30,0.95))",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: settingsCollapsed ? 10 : 14,
                      borderBottom: "1px solid rgba(125,249,255,0.10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: settingsCollapsed ? "center" : "space-between",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    {!settingsCollapsed && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#f2fdff" }}>
                          Settings
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "rgba(196, 244, 255, 0.72)",
                          }}
                        >
                          {isSuper ? "Super controls unlocked" : "Model selection only"}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setSettingsCollapsed((v) => !v)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid rgba(125,249,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e7f8ff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        {settingsCollapsed
                          ? "keyboard_double_arrow_right"
                          : "keyboard_double_arrow_left"}
                      </i>
                    </button>
                  </div>

                  {settingsCollapsed ? (
                    <div
                      className="fluke-settings-scroll"
                      style={{
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        overflowY: "auto",
                        minHeight: 0,
                      }}
                    >
                      {collapsedItems.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSettingsCollapsed(false)}
                          title={item.label}
                          style={{
                            width: "100%",
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid rgba(125,249,255,0.10)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#e7f8ff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="material-icons">{item.icon}</i>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="fluke-settings-scroll"
                      style={{
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        overflowY: "auto",
                        minHeight: 0,
                      }}
                    >
                      {isSuper && (
                        <SideCard
                          title="Context Selection"
                          subtitle="Super only"
                          icon="category"
                          open={sideOpen.context}
                          onToggle={() => toggleSideCard("context")}
                        >
                          <div style={{ display: "grid", gap: 10 }}>
                            {(Object.keys(CONTEXT_META) as ChatContextType[]).map((ctx) => {
                              const active = selectedContext === ctx;
                              const meta = CONTEXT_META[ctx];

                              return (
                                <button
                                  key={ctx}
                                  type="button"
                                  onClick={() => setSelectedContext(ctx)}
                                  style={{
                                    width: "100%",
                                    borderRadius: 16,
                                    border: active
                                      ? "1px solid rgba(34,211,238,0.30)"
                                      : "1px solid rgba(255,255,255,0.08)",
                                    background: active
                                      ? "linear-gradient(180deg, rgba(34,211,238,0.14), rgba(124,58,237,0.16))"
                                      : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))",
                                    padding: "12px 13px",
                                    color: "inherit",
                                    cursor: "pointer",
                                    textAlign: "left",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                    <div
                                      style={{
                                        width: 34,
                                        height: 34,
                                        borderRadius: 12,
                                        flexShrink: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: active
                                          ? "rgba(34,211,238,0.20)"
                                          : "rgba(255,255,255,0.05)",
                                        border: active
                                          ? "1px solid rgba(34,211,238,0.24)"
                                          : "1px solid rgba(255,255,255,0.08)",
                                      }}
                                    >
                                      <i
                                        className="material-icons"
                                        style={{ fontSize: 18, color: "#aef8ff" }}
                                      >
                                        {meta.icon}
                                      </i>
                                    </div>

                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: 12,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <div style={{ fontSize: 13, fontWeight: 900, color: "#f3fbff" }}>
                                          {meta.label}
                                        </div>
                                        {active && (
                                          <span
                                            style={{
                                              padding: "4px 8px",
                                              borderRadius: 999,
                                              fontSize: 10,
                                              fontWeight: 900,
                                              letterSpacing: 0.6,
                                              textTransform: "uppercase",
                                              color: "#ecfeff",
                                              border: "1px solid rgba(34,211,238,0.24)",
                                              background: "rgba(34,211,238,0.16)",
                                            }}
                                          >
                                            Active
                                          </span>
                                        )}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontSize: 11,
                                          lineHeight: 1.55,
                                          color: "rgba(214, 242, 255, 0.68)",
                                        }}
                                      >
                                        {meta.description}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 8,
                                          display: "flex",
                                          gap: 8,
                                          flexWrap: "wrap",
                                        }}
                                      >
                                        <Pill label="Route" value={ctx} />
                                        <Pill
                                          label="Default"
                                          value={PROVIDER_META[meta.defaultProvider].label}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </SideCard>
                      )}

                      <SideCard
                        title="Model Selection"
                        subtitle="Visible to all users"
                        icon="tune"
                        open={sideOpen.model}
                        onToggle={() => toggleSideCard("model")}
                      >
                        <div style={{ display: "grid", gap: 10 }}>
                          {(Object.keys(PROVIDER_META) as ProviderType[]).map((p) => {
                            const active = provider === p;
                            const meta = PROVIDER_META[p];
                            const model = PROVIDER_MODEL[p];
                            const warmState =
                              p === "openai"
                                ? "ready"
                                : runtimeWarmState[runtimeKey(p, selectedContext)] || "idle";

                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setProvider(p)}
                                style={{
                                  width: "100%",
                                  borderRadius: 16,
                                  border: active
                                    ? "1px solid rgba(34,211,238,0.30)"
                                    : "1px solid rgba(255,255,255,0.08)",
                                  background: active
                                    ? "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(34,211,238,0.10))"
                                    : "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))",
                                  padding: "12px 13px",
                                  color: "inherit",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                                  <div
                                    style={{
                                      width: 34,
                                      height: 34,
                                      borderRadius: 12,
                                      flexShrink: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: active
                                        ? "rgba(124,58,237,0.22)"
                                        : "rgba(255,255,255,0.05)",
                                      border: active
                                        ? "1px solid rgba(124,58,237,0.24)"
                                        : "1px solid rgba(255,255,255,0.08)",
                                    }}
                                  >
                                    <i
                                      className="material-icons"
                                      style={{ fontSize: 18, color: "#aef8ff" }}
                                    >
                                      {meta.icon}
                                    </i>
                                  </div>

                                  <div style={{ minWidth: 0, flex: 1 }}>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 12,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <div style={{ fontSize: 13, fontWeight: 900, color: "#f3fbff" }}>
                                        {meta.label}
                                      </div>
                                      {active && (
                                        <span
                                          style={{
                                            padding: "4px 8px",
                                            borderRadius: 999,
                                            fontSize: 10,
                                            fontWeight: 900,
                                            letterSpacing: 0.6,
                                            textTransform: "uppercase",
                                            color: "#ecfeff",
                                            border: "1px solid rgba(34,211,238,0.24)",
                                            background: "rgba(34,211,238,0.16)",
                                          }}
                                        >
                                          Active
                                        </span>
                                      )}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: 4,
                                        fontSize: 11,
                                        lineHeight: 1.55,
                                        color: "rgba(214, 242, 255, 0.68)",
                                      }}
                                    >
                                      {meta.description}
                                    </div>

                                    <div
                                      style={{
                                        marginTop: 8,
                                        display: "flex",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <Pill label="Model" value={model} />
                                      {p === "ollama" && (
                                        <Pill
                                          label="Runtime"
                                          value={
                                            warmState === "ready"
                                              ? "Ready"
                                              : warmState === "warming"
                                              ? "Warming"
                                              : warmState === "error"
                                              ? "Error"
                                              : "Idle"
                                          }
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </SideCard>

                      {isSuper && (
                        <>
                          <SideCard
                            title="Session Snapshot"
                            subtitle="Super only"
                            icon="space_dashboard"
                            open={sideOpen.session}
                            onToggle={() => toggleSideCard("session")}
                          >
                            <div style={{ display: "grid", gap: 10 }}>
                              {[
                                ["Context", CONTEXT_META[selectedContext].label],
                                ["Provider", PROVIDER_META[provider].label],
                                ["Active Model", currentModel],
                                ["WebSocket", wsState],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    padding: "12px 13px",
                                    borderRadius: 14,
                                    background:
                                      "linear-gradient(180deg, rgba(16,22,36,0.96), rgba(12,17,29,0.96))",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                  }}
                                >
                                  <div style={{ fontSize: 11, color: "rgba(196, 244, 255, 0.70)" }}>
                                    {k}
                                  </div>
                                  <div
                                    style={{
                                      marginTop: 4,
                                      fontSize: 14,
                                      fontWeight: 800,
                                      color: "#f3fbff",
                                    }}
                                  >
                                    {v}
                                  </div>
                                </div>
                              ))}

                              <div
                                style={{
                                  padding: "12px 13px",
                                  borderRadius: 14,
                                  background:
                                    currentWarmState === "ready"
                                      ? "linear-gradient(180deg, rgba(25,60,72,0.34), rgba(14,27,34,0.44))"
                                      : currentWarmState === "warming"
                                      ? "linear-gradient(180deg, rgba(78,45,132,0.32), rgba(28,16,48,0.46))"
                                      : currentWarmState === "error"
                                      ? "linear-gradient(180deg, rgba(78,28,42,0.30), rgba(38,14,20,0.35))"
                                      : "linear-gradient(180deg, rgba(16,22,36,0.96), rgba(12,17,29,0.96))",
                                  border:
                                    currentWarmState === "ready"
                                      ? "1px solid rgba(34,211,238,0.20)"
                                      : currentWarmState === "warming"
                                      ? "1px solid rgba(168,85,247,0.24)"
                                      : currentWarmState === "error"
                                      ? "1px solid rgba(248,113,113,0.18)"
                                      : "1px solid rgba(255,255,255,0.06)",
                                }}
                              >
                                <div style={{ fontSize: 11, color: "rgba(236,248,255,0.72)" }}>
                                  Runtime Ready
                                </div>
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color: "#f3fbff",
                                  }}
                                >
                                  {provider === "openai"
                                    ? "Ready"
                                    : currentWarmState === "ready"
                                    ? "Ollama Ready"
                                    : currentWarmState === "warming"
                                    ? "Warming"
                                    : currentWarmState === "error"
                                    ? "Warmup Failed"
                                    : "Idle"}
                                </div>
                              </div>
                            </div>
                          </SideCard>

                          <SideCard
                            title="Quick Toggles"
                            subtitle="Super only"
                            icon="toggle_on"
                            open={sideOpen.toggles}
                            onToggle={() => toggleSideCard("toggles")}
                          >
                            <div style={{ display: "grid", gap: 10 }}>
                              {[
                                {
                                  label: "Verification",
                                  value: verified,
                                  setValue: setVerified,
                                  desc: "Required before sending to selected route.",
                                },
                                {
                                  label: "Memory",
                                  value: memoryEnabled,
                                  setValue: setMemoryEnabled,
                                  desc: "Include memory-oriented session context.",
                                },
                                {
                                  label: "Safe Mode",
                                  value: safeMode,
                                  setValue: setSafeMode,
                                  desc: "Prefer guarded and more reliable responses.",
                                },
                                {
                                  label: "Developer Mode",
                                  value: developerMode,
                                  setValue: setDeveloperMode,
                                  desc: "Show more technical backend behavior.",
                                },
                              ].map((item) => (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => item.setValue((v: boolean) => !v)}
                                  style={{
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    cursor: "pointer",
                                    padding: "12px 13px",
                                    borderRadius: 14,
                                    background: item.value
                                      ? "linear-gradient(180deg, rgba(124,58,237,0.18), rgba(34,211,238,0.08))"
                                      : "linear-gradient(180deg, rgba(16,22,36,0.96), rgba(12,17,29,0.96))",
                                    border: item.value
                                      ? "1px solid rgba(34,211,238,0.22)"
                                      : "1px solid rgba(255,255,255,0.06)",
                                    color: "inherit",
                                    textAlign: "left",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: 5,
                                      marginTop: 2,
                                      flexShrink: 0,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: item.value ? "#22d3ee" : "transparent",
                                      border: item.value
                                        ? "1px solid #7df9ff"
                                        : "1px solid rgba(196,244,255,0.45)",
                                    }}
                                  >
                                    {item.value && (
                                      <i
                                        className="material-icons"
                                        style={{ fontSize: 14, color: "#081018" }}
                                      >
                                        check
                                      </i>
                                    )}
                                  </div>

                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: "#f3fbff" }}>
                                      {item.label}
                                    </div>
                                    <div
                                      style={{
                                        marginTop: 3,
                                        fontSize: 11,
                                        color: "rgba(236,248,255,0.62)",
                                      }}
                                    >
                                      {item.desc}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </SideCard>

                          <SideCard
                            title="Generation Controls"
                            subtitle="Super only"
                            icon="auto_fix_high"
                            open={sideOpen.generation}
                            onToggle={() => toggleSideCard("generation")}
                          >
                            <div style={{ display: "grid", gap: 14 }}>
                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <span style={{ fontSize: 12, color: "#d4f2ff" }}>Temperature</span>
                                  <span style={{ fontSize: 12, color: "#9ef7ff", fontWeight: 800 }}>
                                    {temperature.toFixed(1)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  value={temperature}
                                  onChange={(e) => setTemperature(Number(e.target.value))}
                                  style={{ width: "100%", accentColor: "#22d3ee" }}
                                />
                              </div>

                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <span style={{ fontSize: 12, color: "#d4f2ff" }}>Top P</span>
                                  <span style={{ fontSize: 12, color: "#9ef7ff", fontWeight: 800 }}>
                                    {topP.toFixed(1)}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={0.1}
                                  max={1}
                                  step={0.1}
                                  value={topP}
                                  onChange={(e) => setTopP(Number(e.target.value))}
                                  style={{ width: "100%", accentColor: "#22d3ee" }}
                                />
                              </div>

                              <div>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                                  <span style={{ fontSize: 12, color: "#d4f2ff" }}>Max Tokens</span>
                                  <span style={{ fontSize: 12, color: "#9ef7ff", fontWeight: 800 }}>
                                    {maxTokens}
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={256}
                                  max={4096}
                                  step={256}
                                  value={maxTokens}
                                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                                  style={{ width: "100%", accentColor: "#22d3ee" }}
                                />
                              </div>

                              <div style={{ display: "grid", gap: 10 }}>
                                {[
                                  { label: "Streaming", value: streaming, setValue: setStreaming },
                                  { label: "Include History", value: includeHistory, setValue: setIncludeHistory },
                                  { label: "Show Timestamps", value: showTimestamps, setValue: setShowTimestamps },
                                ].map((item) => (
                                  <button
                                    key={item.label}
                                    type="button"
                                    onClick={() => item.setValue((v: boolean) => !v)}
                                    style={{
                                      width: "100%",
                                      borderRadius: 12,
                                      border: item.value
                                        ? "1px solid rgba(34,211,238,0.22)"
                                        : "1px solid rgba(255,255,255,0.06)",
                                      background: item.value
                                        ? "rgba(34,211,238,0.12)"
                                        : "rgba(255,255,255,0.03)",
                                      padding: "10px 12px",
                                      color: "#e7f8ff",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</span>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 800,
                                        color: item.value ? "#9ef7ff" : "rgba(196,244,255,0.82)",
                                      }}
                                    >
                                      {item.value ? "ON" : "OFF"}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </SideCard>

                          <SideCard
                            title="Model Identity"
                            subtitle="Super only"
                            icon="hub"
                            open={sideOpen.identity}
                            onToggle={() => toggleSideCard("identity")}
                          >
                            <div style={{ display: "grid", gap: 10 }}>
                              {[
                                ["Context", CONTEXT_META[selectedContext].label],
                                ["Provider", PROVIDER_META[provider].label],
                                ["Engine", currentModel],
                                ["Endpoint", selectedContext],
                                ["Session Id", sessionIdRef.current],
                                ["Retrieval", memoryEnabled ? "Session + History" : "Minimal"],
                                ["Output Mode", streaming ? "Progressive" : "Buffered"],
                                ["Safety Layer", safeMode ? "Enabled" : "Bypassed"],
                              ].map(([k, v]) => (
                                <div
                                  key={k}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    background: "rgba(255,255,255,0.03)",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <span style={{ fontSize: 12, color: "rgba(196,244,255,0.88)" }}>{k}</span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 800,
                                      color: "#f3fbff",
                                      textAlign: "right",
                                    }}
                                  >
                                    {v}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </SideCard>

                          <SideCard
                            title="Advanced Notes"
                            subtitle="Super only"
                            icon="settings_suggest"
                            open={sideOpen.advanced}
                            onToggle={() => toggleSideCard("advanced")}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                lineHeight: 1.7,
                                color: "rgba(236,248,255,0.68)",
                              }}
                            >
                              Stop currently cancels the active frontend submission and ignores any
                              future websocket update for that request id. It does not hard-cancel
                              the backend worker unless you add a dedicated stop endpoint later.
                            </div>
                          </SideCard>
                        </>
                      )}
                    </div>
                  )}
                </aside>

                <section
                  style={{
                    minWidth: 0,
                    minHeight: 0,
                    display: "grid",
                    gridTemplateRows: "auto minmax(0, 1fr) auto",
                    background:
                      "linear-gradient(180deg, rgba(10,14,24,0.92), rgba(7,10,18,0.98))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid rgba(125,249,255,0.10)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      background: "rgba(255,255,255,0.015)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <div
                        style={{
                          width: 82,
                          height: 82,
                          borderRadius: 18,
                          border: "1px solid rgba(125,249,255,0.12)",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                        }}
                      >
                        <BotAvatar status={botStatus} size={66} />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: "rgba(196,244,255,0.86)",
                          }}
                        >
                          Conversation
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              fontSize: 12,
                              color: "rgba(236,248,255,0.76)",
                            }}
                          >
                            {messages.length} messages
                          </span>

                          <span
                            style={{
                              padding: "5px 10px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              fontSize: 12,
                              color: "rgba(236,248,255,0.76)",
                              textTransform: "capitalize",
                            }}
                          >
                            {botStatus}
                          </span>

                          {isSuper && (
                            <span
                              style={{
                                padding: "5px 10px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.04)",
                                border: "1px solid rgba(255,255,255,0.06)",
                                fontSize: 12,
                                color: "rgba(236,248,255,0.76)",
                              }}
                            >
                              {CONTEXT_META[selectedContext].label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={messagesRef}
                    style={{
                      minHeight: 0,
                      overflowY: "auto",
                      overflowX: "hidden",
                      padding: "24px clamp(14px, 2vw, 26px)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 920,
                        margin: "0 auto",
                        display: "flex",
                        flexDirection: "column",
                        gap: 18,
                      }}
                    >
                      {messages.map((msg) => {
                        const isUser = msg.role === "user";

                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: "flex",
                              justifyContent: isUser ? "flex-end" : "flex-start",
                            }}
                          >
                            <div
                              style={{
                                maxWidth: isUser ? "78%" : "86%",
                                minWidth: 0,
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                                flexDirection: isUser ? "row-reverse" : "row",
                              }}
                            >
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 12,
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginTop: 4,
                                  background: isUser
                                    ? "linear-gradient(135deg, rgba(163,230,53,0.30), rgba(101,163,13,0.22))"
                                    : "linear-gradient(135deg, rgba(124,58,237,0.24), rgba(34,211,238,0.14))",
                                  border: isUser
                                    ? "1px solid rgba(190,242,100,0.22)"
                                    : "1px solid rgba(125,249,255,0.12)",
                                  color: "#f8fff0",
                                }}
                              >
                                <i className="material-icons" style={{ fontSize: 17 }}>
                                  {isUser ? "person" : "psychology_alt"}
                                </i>
                              </div>

                              <div style={{ minWidth: 0, width: "100%" }}>
                                <div
                                  style={{
                                    borderRadius: isUser ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
                                    border: isUser
                                      ? "1px solid rgba(190,242,100,0.16)"
                                      : "1px solid rgba(125,249,255,0.10)",
                                    background: isUser
                                      ? "linear-gradient(180deg, rgba(97,129,27,0.52), rgba(36,54,14,0.94))"
                                      : "linear-gradient(180deg, rgba(66,40,120,0.44), rgba(14,26,42,0.94))",
                                    boxShadow: isUser
                                      ? "0 16px 36px rgba(28,42,10,0.26)"
                                      : "0 16px 32px rgba(0,0,0,0.22)",
                                    padding: "14px 16px 12px 16px",
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 12,
                                      marginBottom: 8,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 900,
                                        color: isUser ? "#efffd0" : "#eefbff",
                                      }}
                                    >
                                      {isUser ? "You" : "Fluke AI"}
                                    </div>

                                    {showTimestamps && (
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: "rgba(223,244,220,0.74)",
                                        }}
                                      >
                                        {formatTime(msg.ts)}
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      color: "#fbfff8",
                                      fontSize: 14,
                                      lineHeight: 1.8,
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                    }}
                                  >
                                    {msg.content}
                                  </div>

                                  {!!msg.tags?.length && (
                                    <div
                                      style={{
                                        marginTop: 12,
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                      }}
                                    >
                                      {msg.tags.map((tag, i) => (
                                        <span
                                          key={`${msg.id}_tag_${i}`}
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                            padding: "6px 10px",
                                            borderRadius: 999,
                                            background: "rgba(255,255,255,0.05)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            fontSize: 11,
                                            color: "rgba(236,248,255,0.82)",
                                          }}
                                        >
                                          <span style={{ color: "rgba(196,244,255,0.82)" }}>
                                            {tag.label}
                                          </span>
                                          <span style={{ color: "#ffffff", fontWeight: 700 }}>
                                            {tag.value}
                                          </span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <form
                    onSubmit={onSubmit}
                    style={{
                      borderTop: "1px solid rgba(125,249,255,0.10)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.02))",
                      padding: "14px clamp(12px, 2vw, 22px) 18px",
                    }}
                  >
                    <div style={{ maxWidth: 920, margin: "0 auto" }}>
                      <div
                        style={{
                          borderRadius: 24,
                          border: "1px solid rgba(125,249,255,0.10)",
                          background:
                            "linear-gradient(180deg, rgba(11,15,25,0.98), rgba(8,11,19,0.98))",
                          overflow: "hidden",
                          boxShadow:
                            "0 20px 40px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.03)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: 12,
                            padding: "12px 12px 10px 14px",
                          }}
                        >
                          <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={onInputKeyDown}
                            placeholder={
                              provider === "ollama" && currentWarmState !== "ready"
                                ? `Warming ${currentModel}… switch model or wait`
                                : wsState !== "connected"
                                ? "Connecting websocket..."
                                : `Message Fluke AI${isSuper ? ` (${CONTEXT_META[selectedContext].label})` : ""}...`
                            }
                            rows={1}
                            disabled={
                              wsState !== "connected" ||
                              (provider === "ollama" && currentWarmState !== "ready")
                            }
                            style={{
                              width: "100%",
                              minHeight: 56,
                              maxHeight: 180,
                              boxSizing: "border-box",
                              resize: "none",
                              border: "none",
                              background: "transparent",
                              color: "#f8fdff",
                              padding: "4px 2px",
                              fontSize: 14,
                              lineHeight: 1.7,
                              outline: "none",
                            }}
                          />

                          <button
                            type="submit"
                            disabled={!loading && !canSend}
                            title={loading ? "Stop generation" : "Send message"}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 16,
                              border: loading
                                ? "1px solid rgba(248,113,113,0.28)"
                                : "1px solid rgba(125,249,255,0.24)",
                              background: loading
                                ? "linear-gradient(135deg, #ef4444, #991b1b)"
                                : !canSend
                                ? "rgba(255,255,255,0.06)"
                                : "linear-gradient(135deg, #7c3aed, #22d3ee)",
                              color: "white",
                              cursor: !loading && !canSend ? "not-allowed" : "pointer",
                              opacity: !loading && !canSend ? 0.68 : 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "all 160ms ease",
                            }}
                          >
                            <i className="material-icons" style={{ fontSize: 20 }}>
                              {loading ? "stop" : "north_east"}
                            </i>
                          </button>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                            padding: "10px 14px 12px",
                            borderTop: "1px solid rgba(125,249,255,0.10)",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: errorText ? "#fca5a5" : "rgba(236,248,255,0.62)",
                              minHeight: 18,
                            }}
                          >
                            {statusText}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {isSuper && (
                              <Pill label="Context" value={CONTEXT_META[selectedContext].label} />
                            )}
                            <Pill label="Provider" value={PROVIDER_META[provider].label} />
                            <Pill label="WS" value={wsState} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </section>
              </div>
            </div>

            {mobileSettingsOpen && (
              <div
                className="fluke-ai-mobile-settings-backdrop"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) setMobileSettingsOpen(false);
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 5,
                  display: "none",
                }}
              />
            )}
          </div>
        </div>
      )}

      <style>
        {`
          textarea::placeholder {
            color: rgba(240,250,255,0.30);
          }

          .fluke-settings-scroll,
          .fluke-sidecard-scroll,
          .fluke-ai-settings-panel,
          .fluke-ai-modal-body section > div:nth-child(2),
          .fluke-ai-modal-body div,
          textarea {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .fluke-settings-scroll::-webkit-scrollbar,
          .fluke-sidecard-scroll::-webkit-scrollbar,
          .fluke-ai-settings-panel::-webkit-scrollbar,
          .fluke-ai-modal-body section > div:nth-child(2)::-webkit-scrollbar,
          .fluke-ai-modal-body div::-webkit-scrollbar,
          textarea::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }

          .fluke-sidecard-scroll {
            max-height: 320px;
            overflow-y: auto;
            min-height: 0;
          }

          @media (max-width: 980px) {
            .fluke-ai-modal-body {
              grid-template-columns: minmax(0, 1fr) !important;
            }

            .fluke-ai-mobile-settings-btn {
              display: inline-flex !important;
            }

            .fluke-ai-settings-panel {
              position: absolute !important;
              left: 0;
              top: 0;
              bottom: 0;
              width: min(360px, 88vw);
              z-index: 20;
              transform: translateX(-101%);
              transition: transform 220ms ease;
              border-right: 1px solid rgba(125,249,255,0.10);
              box-shadow: 20px 0 60px rgba(0,0,0,0.38);
            }

            .fluke-ai-settings-panel.mobile-open {
              transform: translateX(0);
            }

            .fluke-ai-mobile-settings-backdrop {
              display: block !important;
              background: rgba(2,6,23,0.45);
              backdrop-filter: blur(2px);
              -webkit-backdrop-filter: blur(2px);
            }
          }
        `}
      </style>
    </>
  );
}