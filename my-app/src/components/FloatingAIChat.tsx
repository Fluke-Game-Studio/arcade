import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

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
};

type ProviderType = "openai" | "ollama";
type SidePanelKey =
  | "session"
  | "toggles"
  | "model"
  | "generation"
  | "identity"
  | "advanced";

type RuntimeWarmState = "idle" | "warming" | "ready" | "error";

const API_URL =
  "https://xtipeal88c.execute-api.us-east-1.amazonaws.com/ai/chat/internal";

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
    description: "Cloud-hosted premium route for polished answers.",
    icon: "cloud_queue",
  },
  ollama: {
    label: "Ollama",
    description: "Internal or self-hosted route using your local model stack.",
    icon: "dns",
  },
};

const THINKING_MESSAGES = [
  "Thinking…",
  "Reviewing context…",
  "Analyzing request…",
  "Preparing response…",
  "Composing answer…",
];

const FALLBACK_MESSAGES = [
  "The internal AI route did not return a usable response.",
  "The assistant is currently unavailable.",
  "The backend received the request, but no valid reply came back.",
  "The internal route failed while generating a response.",
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

function runtimeKey(provider: ProviderType) {
  return provider;
}

function extractReply(data: any): string {
  if (!data) return "";
  if (typeof data === "string") return data;

  if (typeof data.reply === "string") return data.reply;
  if (typeof data.answer === "string") return data.answer;
  if (typeof data.response === "string") return data.response;
  if (typeof data.message === "string") return data.message;
  if (typeof data.output === "string") return data.output;
  if (typeof data.content === "string") return data.content;
  if (typeof data.text === "string") return data.text;

  if (typeof data?.data?.reply === "string") return data.data.reply;
  if (typeof data?.data?.answer === "string") return data.data.answer;
  if (typeof data?.data?.response === "string") return data.data.response;
  if (typeof data?.data?.message === "string") return data.data.message;
  if (typeof data?.data?.output === "string") return data.data.output;
  if (typeof data?.data?.content === "string") return data.data.content;
  if (typeof data?.data?.text === "string") return data.data.text;

  if (Array.isArray(data?.choices) && data.choices[0]) {
    const c = data.choices[0];
    if (typeof c?.message?.content === "string") return c.message.content;
    if (typeof c?.text === "string") return c.text;
  }

  return "";
}

function extractTags(data: any): ChatMetaTag[] {
  const tags: ChatMetaTag[] = [];
  if (!data) return tags;

  const provider =
    data?.provider ||
    data?.data?.provider ||
    data?.modelProvider ||
    data?.data?.modelProvider;

  const model =
    data?.model ||
    data?.data?.model ||
    data?.modelName ||
    data?.data?.modelName;

  const contextType =
    data?.contextType ||
    data?.data?.contextType ||
    data?.type ||
    data?.data?.type;

  const contextLabel =
    data?.contextLabel ||
    data?.data?.contextLabel ||
    data?.label ||
    data?.data?.label;

  if (provider) tags.push({ label: "Provider", value: String(provider) });
  if (model) tags.push({ label: "Model", value: String(model) });
  if (contextType) tags.push({ label: "Type", value: String(contextType) });
  if (contextLabel) tags.push({ label: "Label", value: String(contextLabel) });

  return tags;
}

async function typeMessage(
  fullText: string,
  messageId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
) {
  const clean = fullText || "";

  if (!clean.trim()) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, content: "No response received." } : m
      )
    );
    return;
  }

  let index = 0;
  const chunkSize =
    clean.length > 1400 ? 5 : clean.length > 900 ? 4 : clean.length > 400 ? 3 : 2;
  const delay = clean.length > 1400 ? 5 : clean.length > 900 ? 7 : 12;

  await new Promise<void>((resolve) => {
    const tick = () => {
      index += chunkSize;
      const next = clean.slice(0, index);

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: next } : m))
      );

      if (index >= clean.length) {
        resolve();
        return;
      }

      window.setTimeout(tick, delay);
    };

    tick();
  });
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
        background: strong ? "rgba(59,130,246,0.16)" : "rgba(255,255,255,0.05)",
        border: strong
          ? "1px solid rgba(59,130,246,0.28)"
          : "1px solid rgba(255,255,255,0.08)",
        color: "#dbe7f4",
        fontSize: 11,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {icon && (
        <i
          className="material-icons"
          style={{ fontSize: 13, color: "rgba(191,219,254,0.92)" }}
        >
          {icon}
        </i>
      )}
      <span style={{ color: "rgba(148,163,184,0.9)" }}>{label}</span>
      <span style={{ color: "#f8fafc", fontWeight: 800 }}>{value}</span>
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
          "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
        overflow: "hidden",
        boxShadow: open ? "0 10px 30px rgba(0,0,0,0.16)" : "none",
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
              background: "rgba(59,130,246,0.14)",
              border: "1px solid rgba(59,130,246,0.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <i className="material-icons" style={{ fontSize: 16, color: "#bfdbfe" }}>
              {icon}
            </i>
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#f8fafc" }}>{title}</div>
            {!!subtitle && (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: "rgba(148,163,184,0.78)",
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
            color: "rgba(226,232,240,0.72)",
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
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export default function FloatingAIChat() {
  const { api, user } = useAuth();

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingWarmupsRef = useRef<Set<string>>(new Set());

  const [hovered, setHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Welcome to Fluke AI.\n\nOpenAI and Ollama are available. Ollama warms in the background when this modal opens.",
      ts: Date.now(),
      tags: [
        { label: "Route", value: "Internal" },
        { label: "Auth", value: "Authenticated" },
        { label: "Providers", value: "OpenAI + Ollama" },
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState(THINKING_MESSAGES[0]);
  const [errorText, setErrorText] = useState("");
  const [verified, setVerified] = useState(true);

  const [provider, setProvider] = useState<ProviderType>("openai");
  const [temperature, setTemperature] = useState(0.6);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [topP, setTopP] = useState(0.9);
  const [streaming, setStreaming] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [safeMode, setSafeMode] = useState(true);
  const [developerMode, setDeveloperMode] = useState(false);

  const [runtimeWarmState, setRuntimeWarmState] = useState<Record<string, RuntimeWarmState>>({
    openai: "ready",
    ollama: "idle",
  });

  const [runtimeWarmError, setRuntimeWarmError] = useState<Record<string, string>>({});

  const [sideOpen, setSideOpen] = useState<Record<SidePanelKey, boolean>>({
    session: true,
    toggles: true,
    model: true,
    generation: false,
    identity: false,
    advanced: false,
  });

  const currentModel = useMemo(() => PROVIDER_MODEL[provider], [provider]);
  const currentRuntime = useMemo(() => runtimeKey(provider), [provider]);
  const currentWarmState =
    runtimeWarmState[currentRuntime] || (provider === "openai" ? "ready" : "idle");

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    setThinkingText(randomFrom(THINKING_MESSAGES));
    const id = window.setInterval(() => {
      setThinkingText(randomFrom(THINKING_MESSAGES));
    }, 1500);
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

  const toggleSideCard = (key: SidePanelKey) => {
    setSideOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function postToInternalRoute(payload: Record<string, any>) {
    const token = (api as any)?.token;

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();

    let parsed: any = raw;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = raw;
    }

    if (!res.ok) {
      throw new Error(extractReply(parsed) || `Request failed with status ${res.status}`);
    }

    return parsed;
  }

  async function warmProviderInBackground(targetProvider: ProviderType) {
    const key = runtimeKey(targetProvider);
    const model = PROVIDER_MODEL[targetProvider];

    if (targetProvider === "openai") {
      setRuntimeWarmState((prev) => ({ ...prev, [key]: "ready" }));
      return;
    }

    if (pendingWarmupsRef.current.has(key)) return;
    if (runtimeWarmState[key] === "ready") return;

    pendingWarmupsRef.current.add(key);
    setRuntimeWarmError((prev) => ({ ...prev, [key]: "" }));
    setRuntimeWarmState((prev) => ({ ...prev, [key]: "warming" }));

    try {
      const parsed = await postToInternalRoute({
        question: "Warm up the current Ollama model. Reply with one short line saying READY.",
        provider: targetProvider,
        model,
        history: [],
        settings: {
          temperature: 0.6,
          max_tokens: 64,
          top_p: 0.9,
          streaming: false,
          memory_enabled: false,
          safe_mode: true,
          developer_mode: false,
          warmup: true,
        },
      });

      const reply = extractReply(parsed).trim();

      if (!reply) {
        throw new Error("Warmup returned an empty response.");
      }

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
    void warmProviderInBackground("ollama");
  }, [modalOpen]);

  const canSend =
    !loading &&
    !!input.trim() &&
    verified &&
    !!user &&
    (provider === "openai" || currentWarmState === "ready");

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!verified) {
      setErrorText("Enable verification before sending.");
      return;
    }

    if (!user) {
      setErrorText("You are not logged in.");
      return;
    }

    if (provider === "ollama" && currentWarmState !== "ready") {
      setErrorText(
        currentWarmState === "warming"
          ? `Ollama model ${currentModel} is still warming up.`
          : `Ollama model ${currentModel} is not ready yet.`
      );
      void warmProviderInBackground("ollama");
      return;
    }

    setErrorText("");

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };

    const assistantMessageId = uid();
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      ts: Date.now(),
      tags: [
        { label: "Status", value: "Running" },
        { label: "Provider", value: PROVIDER_META[provider].label },
        { label: "Model", value: currentModel },
      ],
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInput("");
    setLoading(true);

    try {
      const parsed = await postToInternalRoute({
        question: trimmed,
        provider,
        model: currentModel,
        history: includeHistory
          ? messages.map((m) => ({
              role: m.role,
              content: m.content,
            }))
          : [],
        settings: {
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          streaming,
          memory_enabled: memoryEnabled,
          safe_mode: safeMode,
          developer_mode: developerMode,
        },
      });

      const reply = extractReply(parsed).trim();
      const tags = extractTags(parsed);

      if (!reply) {
        throw new Error("Empty response from internal AI route.");
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                tags: [
                  ...tags,
                  { label: "Temp", value: temperature.toFixed(1) },
                  { label: "Top P", value: topP.toFixed(1) },
                ],
              }
            : m
        )
      );

      await typeMessage(reply, assistantMessageId, setMessages);
    } catch (err: any) {
      const fallback = randomFrom(FALLBACK_MESSAGES);
      const msg = err?.message || fallback;
      setErrorText(msg);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: `${fallback}\n\n${msg}`,
                tags: [{ label: "Status", value: "Error" }],
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const onInputKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  };

  const statusText = errorText
    ? errorText
    : loading
    ? `${thinkingText} • ${PROVIDER_META[provider].label} • ${currentModel}`
    : provider === "ollama" && currentWarmState === "warming"
    ? `Warming Ollama • ${currentModel} • switch to OpenAI anytime`
    : provider === "ollama" && currentWarmState === "error"
    ? runtimeWarmError[currentRuntime] || `Ollama warmup failed for ${currentModel}`
    : `Internal • ${PROVIDER_META[provider].label} • ${currentModel}`;

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
            width: 330,
            borderRadius: 22,
            padding: "15px 16px",
            background: "linear-gradient(180deg, rgba(8,12,20,0.96), rgba(11,17,30,0.92))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow:
              "0 22px 60px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.04)",
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
                  "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(56,189,248,0.85))",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                boxShadow: "0 10px 20px rgba(37,99,235,0.22)",
              }}
            >
              <i className="material-icons" style={{ fontSize: 18, color: "#f8fafc" }}>
                auto_awesome
              </i>
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#f8fafc",
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
                  color: "rgba(226,232,240,0.72)",
                }}
              >
                Clean provider switching between OpenAI and Ollama.
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
                <Pill label="Provider" value={PROVIDER_META[provider].label} />
                <Pill label="Model" value={currentModel} strong />
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
            border: "1px solid rgba(255,255,255,0.10)",
            background: "linear-gradient(180deg, rgba(8,12,20,0.98), rgba(12,18,31,0.98))",
            boxShadow: hovered
              ? "0 24px 50px rgba(0,0,0,0.34)"
              : "0 16px 34px rgba(0,0,0,0.28)",
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
                "radial-gradient(circle at 30% 30%, rgba(59,130,246,0.18), transparent 36%), radial-gradient(circle at 70% 75%, rgba(56,189,248,0.12), transparent 38%)",
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
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
              zIndex: 1,
            }}
          >
            <i className="material-icons" style={{ fontSize: 18, color: "#f8fafc" }}>
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
            background: "rgba(2,6,23,0.72)",
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
              background: "#080d16",
              color: "#e5e7eb",
              boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at top right, rgba(37,99,235,0.14), transparent 24%), radial-gradient(circle at top left, rgba(56,189,248,0.08), transparent 20%), radial-gradient(circle at bottom left, rgba(99,102,241,0.08), transparent 28%)",
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
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  background:
                    "linear-gradient(180deg, rgba(8,12,20,0.94), rgba(10,15,26,0.84))",
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
                          "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(56,189,248,0.78))",
                        border: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 12px 30px rgba(37,99,235,0.24)",
                        flexShrink: 0,
                      }}
                    >
                      <i className="material-icons" style={{ color: "#f8fafc" }}>
                        psychology_alt
                      </i>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: "#f8fafc" }}>
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
                        <Pill icon="route" label="Route" value="Internal" />
                        <Pill
                          icon={PROVIDER_META[provider].icon}
                          label="Provider"
                          value={PROVIDER_META[provider].label}
                          strong
                        />
                        <Pill icon="smart_toy" label="Model" value={currentModel} />
                        <Pill
                          icon="verified_user"
                          label="Auth"
                          value={user ? "Authenticated" : "Not logged in"}
                        />
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
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e5e7eb",
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
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e5e7eb",
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
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(180deg, rgba(7,11,18,0.95), rgba(10,15,24,0.92))",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: settingsCollapsed ? 10 : 14,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: settingsCollapsed ? "center" : "space-between",
                      gap: 10,
                      flexShrink: 0,
                    }}
                  >
                    {!settingsCollapsed && (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#f8fafc" }}>
                          Settings
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 11,
                            color: "rgba(148,163,184,0.72)",
                          }}
                        >
                          Independent scroll area
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
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e5e7eb",
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
                      style={{
                        padding: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        overflowY: "auto",
                        minHeight: 0,
                      }}
                    >
                      {[
                        ["space_dashboard", "Session"],
                        ["toggle_on", "Toggles"],
                        ["tune", "Provider"],
                        ["auto_fix_high", "Gen"],
                        ["hub", "Identity"],
                        ["settings_suggest", "Advanced"],
                      ].map(([icon, label], i) => (
                        <button
                          key={`${icon}_${i}`}
                          type="button"
                          onClick={() => setSettingsCollapsed(false)}
                          title={label}
                          style={{
                            width: "100%",
                            height: 48,
                            borderRadius: 14,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#e5e7eb",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <i className="material-icons">{icon}</i>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: 14,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        overflowY: "auto",
                        minHeight: 0,
                      }}
                    >
                      <SideCard
                        title="Session Snapshot"
                        subtitle="Current route and runtime state"
                        icon="space_dashboard"
                        open={sideOpen.session}
                        onToggle={() => toggleSideCard("session")}
                      >
                        <div style={{ display: "grid", gap: 10 }}>
                          <div
                            style={{
                              padding: "12px 13px",
                              borderRadius: 14,
                              background:
                                "linear-gradient(180deg, rgba(12,19,31,0.94), rgba(10,16,27,0.94))",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.74)" }}>
                              Provider
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#f8fafc",
                              }}
                            >
                              {PROVIDER_META[provider].label}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px 13px",
                              borderRadius: 14,
                              background:
                                "linear-gradient(180deg, rgba(12,19,31,0.94), rgba(10,16,27,0.94))",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.74)" }}>
                              Active Model
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#f8fafc",
                              }}
                            >
                              {currentModel}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px 13px",
                              borderRadius: 14,
                              background:
                                "linear-gradient(180deg, rgba(12,19,31,0.94), rgba(10,16,27,0.94))",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.74)" }}>
                              User
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#f8fafc",
                              }}
                            >
                              {user?.name || user?.username || "Unavailable"}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px 13px",
                              borderRadius: 14,
                              background: verified
                                ? "linear-gradient(180deg, rgba(20,83,45,0.32), rgba(12,33,23,0.38))"
                                : "linear-gradient(180deg, rgba(60,22,22,0.30), rgba(35,14,14,0.35))",
                              border: verified
                                ? "1px solid rgba(74,222,128,0.22)"
                                : "1px solid rgba(248,113,113,0.18)",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(226,232,240,0.72)" }}>
                              Verification
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#f8fafc",
                              }}
                            >
                              {verified ? "Enabled" : "Disabled"}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: "12px 13px",
                              borderRadius: 14,
                              background:
                                currentWarmState === "ready"
                                  ? "linear-gradient(180deg, rgba(20,83,45,0.32), rgba(12,33,23,0.38))"
                                  : currentWarmState === "warming"
                                  ? "linear-gradient(180deg, rgba(30,41,59,0.42), rgba(15,23,42,0.50))"
                                  : currentWarmState === "error"
                                  ? "linear-gradient(180deg, rgba(60,22,22,0.30), rgba(35,14,14,0.35))"
                                  : "linear-gradient(180deg, rgba(12,19,31,0.94), rgba(10,16,27,0.94))",
                              border:
                                currentWarmState === "ready"
                                  ? "1px solid rgba(74,222,128,0.22)"
                                  : currentWarmState === "warming"
                                  ? "1px solid rgba(96,165,250,0.22)"
                                  : currentWarmState === "error"
                                  ? "1px solid rgba(248,113,113,0.18)"
                                  : "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <div style={{ fontSize: 11, color: "rgba(226,232,240,0.72)" }}>
                              Runtime Ready
                            </div>
                            <div
                              style={{
                                marginTop: 4,
                                fontSize: 14,
                                fontWeight: 800,
                                color: "#f8fafc",
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
                        subtitle="Session-wide behavior switches"
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
                              desc: "Required before sending to internal route.",
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
                                  ? "linear-gradient(180deg, rgba(37,99,235,0.18), rgba(14,27,51,0.44))"
                                  : "linear-gradient(180deg, rgba(12,19,31,0.94), rgba(10,16,27,0.94))",
                                border: item.value
                                  ? "1px solid rgba(96,165,250,0.24)"
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
                                  background: item.value ? "#3b82f6" : "transparent",
                                  border: item.value
                                    ? "1px solid #3b82f6"
                                    : "1px solid rgba(148,163,184,0.45)",
                                }}
                              >
                                {item.value && (
                                  <i
                                    className="material-icons"
                                    style={{ fontSize: 14, color: "#fff" }}
                                  >
                                    check
                                  </i>
                                )}
                              </div>

                              <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>
                                  {item.label}
                                </div>
                                <div
                                  style={{
                                    marginTop: 3,
                                    fontSize: 11,
                                    color: "rgba(226,232,240,0.62)",
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
                        title="Provider Selection"
                        subtitle="OpenAI or Ollama, one model each"
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
                              p === "openai" ? "ready" : runtimeWarmState[p] || "idle";

                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setProvider(p)}
                                style={{
                                  width: "100%",
                                  borderRadius: 16,
                                  border: active
                                    ? "1px solid rgba(96,165,250,0.32)"
                                    : "1px solid rgba(255,255,255,0.08)",
                                  background: active
                                    ? "linear-gradient(180deg, rgba(37,99,235,0.18), rgba(11,23,44,0.60))"
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
                                        ? "rgba(59,130,246,0.24)"
                                        : "rgba(255,255,255,0.05)",
                                      border: active
                                        ? "1px solid rgba(96,165,250,0.26)"
                                        : "1px solid rgba(255,255,255,0.08)",
                                    }}
                                  >
                                    <i
                                      className="material-icons"
                                      style={{ fontSize: 18, color: "#dbeafe" }}
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
                                      <div style={{ fontSize: 13, fontWeight: 900, color: "#f8fafc" }}>
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
                                            color: "#dbeafe",
                                            border: "1px solid rgba(96,165,250,0.28)",
                                            background: "rgba(37,99,235,0.18)",
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
                                        color: "rgba(226,232,240,0.64)",
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

                      <SideCard
                        title="Generation Controls"
                        subtitle="Response style and output tuning"
                        icon="auto_fix_high"
                        open={sideOpen.generation}
                        onToggle={() => toggleSideCard("generation")}
                      >
                        <div style={{ display: "grid", gap: 14 }}>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <span style={{ fontSize: 12, color: "#cbd5e1" }}>Temperature</span>
                              <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 800 }}>
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
                              style={{ width: "100%", accentColor: "#2563eb" }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <span style={{ fontSize: 12, color: "#cbd5e1" }}>Top P</span>
                              <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 800 }}>
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
                              style={{ width: "100%", accentColor: "#2563eb" }}
                            />
                          </div>

                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <span style={{ fontSize: 12, color: "#cbd5e1" }}>Max Tokens</span>
                              <span style={{ fontSize: 12, color: "#93c5fd", fontWeight: 800 }}>
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
                              style={{ width: "100%", accentColor: "#2563eb" }}
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
                                    ? "1px solid rgba(96,165,250,0.24)"
                                    : "1px solid rgba(255,255,255,0.06)",
                                  background: item.value ? "rgba(37,99,235,0.14)" : "rgba(255,255,255,0.03)",
                                  padding: "10px 12px",
                                  color: "#e5e7eb",
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
                                    color: item.value ? "#93c5fd" : "rgba(148,163,184,0.82)",
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
                        subtitle="Current runtime identity"
                        icon="hub"
                        open={sideOpen.identity}
                        onToggle={() => toggleSideCard("identity")}
                      >
                        <div style={{ display: "grid", gap: 10 }}>
                          {[
                            ["Provider", PROVIDER_META[provider].label],
                            ["Engine", currentModel],
                            ["Orchestrator", "Protected API Route"],
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
                              <span style={{ fontSize: 12, color: "rgba(148,163,184,0.88)" }}>{k}</span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "#f8fafc",
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
                        subtitle="Warmup and runtime notes"
                        icon="settings_suggest"
                        open={sideOpen.advanced}
                        onToggle={() => toggleSideCard("advanced")}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            lineHeight: 1.7,
                            color: "rgba(226,232,240,0.68)",
                          }}
                        >
                          Ollama warmup starts automatically when the modal opens. OpenAI is always treated as
                          ready on the frontend.
                        </div>
                      </SideCard>
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
                      "linear-gradient(180deg, rgba(8,12,20,0.84), rgba(7,11,18,0.96))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      background: "rgba(255,255,255,0.015)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          color: "rgba(148,163,184,0.86)",
                        }}
                      >
                        Conversation
                      </span>
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          fontSize: 12,
                          color: "rgba(226,232,240,0.76)",
                        }}
                      >
                        {messages.length} messages
                      </span>
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
                                    ? "linear-gradient(135deg, rgba(37,99,235,0.92), rgba(59,130,246,0.82))"
                                    : "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                                  border: isUser
                                    ? "1px solid rgba(96,165,250,0.22)"
                                    : "1px solid rgba(255,255,255,0.08)",
                                  color: "#f8fafc",
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
                                      ? "1px solid rgba(96,165,250,0.2)"
                                      : "1px solid rgba(255,255,255,0.08)",
                                    background: isUser
                                      ? "linear-gradient(180deg, rgba(29,78,216,0.22), rgba(17,24,39,0.95))"
                                      : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
                                    boxShadow: isUser
                                      ? "0 16px 36px rgba(16,24,40,0.25)"
                                      : "0 16px 32px rgba(0,0,0,0.18)",
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
                                        color: isUser ? "#dbeafe" : "#f8fafc",
                                      }}
                                    >
                                      {isUser ? "You" : "Fluke AI"}
                                    </div>

                                    {showTimestamps && (
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: "rgba(148,163,184,0.82)",
                                        }}
                                      >
                                        {formatTime(msg.ts)}
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      color: "#f8fafc",
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
                                            background: "rgba(255,255,255,0.04)",
                                            border: "1px solid rgba(255,255,255,0.08)",
                                            fontSize: 11,
                                            color: "rgba(226,232,240,0.82)",
                                          }}
                                        >
                                          <span style={{ color: "rgba(148,163,184,0.82)" }}>
                                            {tag.label}
                                          </span>
                                          <span style={{ color: "#f8fafc", fontWeight: 700 }}>
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

                      {loading && (
                        <div style={{ display: "flex", justifyContent: "flex-start" }}>
                          <div
                            style={{
                              maxWidth: "86%",
                              display: "flex",
                              gap: 12,
                              alignItems: "flex-start",
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
                                background:
                                  "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))",
                                border: "1px solid rgba(255,255,255,0.08)",
                                color: "#f8fafc",
                              }}
                            >
                              <i className="material-icons" style={{ fontSize: 17 }}>
                                psychology_alt
                              </i>
                            </div>

                            <div
                              style={{
                                borderRadius: "22px 22px 22px 8px",
                                border: "1px solid rgba(255,255,255,0.08)",
                                background:
                                  "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
                                boxShadow: "0 16px 32px rgba(0,0,0,0.18)",
                                padding: "14px 16px 12px 16px",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 900,
                                    color: "#f8fafc",
                                  }}
                                >
                                  Fluke AI
                                </div>
                                <span
                                  style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 999,
                                    background: "#60a5fa",
                                    boxShadow: "0 0 18px rgba(96,165,250,0.85)",
                                  }}
                                />
                              </div>

                              <div
                                style={{
                                  color: "#f8fafc",
                                  fontSize: 14,
                                  lineHeight: 1.8,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span>{thinkingText}</span>
                                <span style={{ display: "inline-flex", gap: 6 }}>
                                  <span className="fluke-ai-dot" />
                                  <span className="fluke-ai-dot" />
                                  <span className="fluke-ai-dot" />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <form
                    onSubmit={onSubmit}
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.02))",
                      padding: "14px clamp(12px, 2vw, 22px) 18px",
                    }}
                  >
                    <div style={{ maxWidth: 920, margin: "0 auto" }}>
                      <div
                        style={{
                          borderRadius: 24,
                          border: "1px solid rgba(255,255,255,0.08)",
                          background:
                            "linear-gradient(180deg, rgba(10,15,26,0.96), rgba(8,12,21,0.98))",
                          overflow: "hidden",
                          boxShadow:
                            "0 20px 40px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)",
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
                                ? `Warming ${currentModel}… switch to OpenAI or wait`
                                : "Message Fluke AI..."
                            }
                            rows={1}
                            disabled={loading || (provider === "ollama" && currentWarmState !== "ready")}
                            style={{
                              width: "100%",
                              minHeight: 56,
                              maxHeight: 180,
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
                            type="submit"
                            disabled={!canSend}
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 16,
                              border: "1px solid rgba(59,130,246,0.28)",
                              background:
                                !canSend
                                  ? "rgba(255,255,255,0.06)"
                                  : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                              color: "white",
                              cursor: !canSend ? "not-allowed" : "pointer",
                              opacity: !canSend ? 0.68 : 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <i className="material-icons" style={{ fontSize: 20 }}>
                              north_east
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
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: errorText ? "#fca5a5" : "rgba(226,232,240,0.62)",
                              minHeight: 18,
                            }}
                          >
                            {statusText}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Pill label="Provider" value={PROVIDER_META[provider].label} />
                            <Pill label="Model" value={currentModel} />
                            <Pill label="Temp" value={temperature.toFixed(1)} />
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
          .fluke-ai-dot {
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: rgba(191,219,254,0.92);
            display: inline-block;
            animation: flukeAiPulse 1.1s infinite ease-in-out;
          }

          .fluke-ai-dot:nth-child(2) {
            animation-delay: 0.15s;
          }

          .fluke-ai-dot:nth-child(3) {
            animation-delay: 0.3s;
          }

          @keyframes flukeAiPulse {
            0%, 80%, 100% {
              opacity: 0.35;
              transform: translateY(0);
            }
            40% {
              opacity: 1;
              transform: translateY(-3px);
            }
          }

          textarea::placeholder {
            color: rgba(255,255,255,0.32);
          }

          .fluke-ai-settings-panel::-webkit-scrollbar,
          .fluke-ai-modal-body section > div:nth-child(2)::-webkit-scrollbar,
          .fluke-ai-settings-panel div::-webkit-scrollbar,
          .fluke-ai-modal-body div::-webkit-scrollbar,
          textarea::-webkit-scrollbar {
            width: 10px;
            height: 10px;
          }

          .fluke-ai-settings-panel::-webkit-scrollbar-thumb,
          .fluke-ai-modal-body section > div:nth-child(2)::-webkit-scrollbar-thumb,
          .fluke-ai-settings-panel div::-webkit-scrollbar-thumb,
          .fluke-ai-modal-body div::-webkit-scrollbar-thumb,
          textarea::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.20);
            border-radius: 999px;
          }

          .fluke-ai-settings-panel::-webkit-scrollbar-track,
          .fluke-ai-modal-body section > div:nth-child(2)::-webkit-scrollbar-track,
          .fluke-ai-settings-panel div::-webkit-scrollbar-track,
          .fluke-ai-modal-body div::-webkit-scrollbar-track,
          textarea::-webkit-scrollbar-track {
            background: transparent;
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
              border-right: 1px solid rgba(255,255,255,0.08);
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