import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AIProvider } from "../api/types/ai";

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

const CHAT_URL = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com/ai/chat/internal";

const PROVIDER_MODEL: Record<Exclude<AIProvider, "auto">, string> = {
  openai: "gpt-5-mini",
  ollama: "qwen3:4b",
};

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStableClientId() {
  const key = "fluke_ai_client_id";

  if (typeof window === "undefined") {
    return `client_${uid()}`;
  }

  const existing = window.localStorage.getItem(key);
  if (existing && existing.trim()) return existing;

  const next = `client_${uid()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function Pill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: "#dbe7f4",
        fontSize: 11,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "rgba(148,163,184,0.9)" }}>{label}</span>
      <span style={{ color: "#f8fafc", fontWeight: 800 }}>{value}</span>
    </span>
  );
}

export default function FloatingAIChat() {
  const { api, user } = useAuth();
  console.log("AUTH_API_OBJECT", api);
  console.log("AUTH_TOKEN_DIRECT", (api as any)?.token);
  console.log("AUTH_USER", user);

  const token = String((api as any)?.token || "").trim();
  const platform = String((api as any)?.getPlatform?.() || "portal").trim() || "portal";
  const clientIdRef = useRef<string>(getStableClientId());
  const clientId = clientIdRef.current;

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [provider, setProvider] = useState<Exclude<AIProvider, "auto">>("openai");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: "Welcome to Fluke AI. This chat sends directly to the internal chat endpoint.",
      ts: Date.now(),
      tags: [
        { label: "ClientId", value: clientId },
        { label: "Route", value: "internal" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastPayload, setLastPayload] = useState("");
  const [lastResponse, setLastResponse] = useState("");

  const currentModel = PROVIDER_MODEL[provider];
  const canSend = !loading && !!input.trim() && !!token;

  const blockedReason = loading
    ? "Already loading"
    : !input.trim()
    ? "Input is empty"
    : !token
    ? "Auth token is missing"
    : "";

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const next = Math.min(Math.max(textareaRef.current.scrollHeight, 56), 180);
    textareaRef.current.style.height = `${next}px`;
  }, [input]);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    if (!token) {
      setErrorText("Auth token is missing.");
      return;
    }

    const payload = {
      question: trimmed,
      clientId,
      context: "internal",
      provider,
      model: currentModel,
      agentEmployeeId: "project_manager_core",
      agentRole: "project_manager",
    };

    setLastPayload(JSON.stringify(payload, null, 2));
    setLastResponse("");
    setErrorText("");

    const userMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };

    const pendingId = uid();

    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: pendingId,
        role: "assistant",
        content: "Sending request to internal endpoint...",
        ts: Date.now(),
        tags: [
          { label: "Provider", value: provider },
          { label: "Model", value: currentModel },
          { label: "ClientId", value: clientId },
        ],
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      console.log("DIRECT_CHAT_URL", CHAT_URL);
      console.log("DIRECT_CHAT_PAYLOAD", payload);
      console.log("DIRECT_CHAT_TOKEN_PRESENT", !!token);

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Platform": platform,
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      setLastResponse(raw);

      console.log("DIRECT_CHAT_STATUS", res.status);
      console.log("DIRECT_CHAT_RAW", raw);

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
            `Request failed with status ${res.status}`
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content:
                  parsed?.status === "queued"
                    ? "Queued successfully. Backend accepted the request."
                    : "Request submitted.",
                tags: [
                  { label: "Status", value: parsed?.status || "ok" },
                  { label: "Provider", value: parsed?.provider || provider },
                  { label: "Model", value: parsed?.model || currentModel },
                  { label: "ClientId", value: parsed?.clientId || clientId },
                ],
              }
            : m
        )
      );
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      setErrorText(msg);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                content: `Error: ${msg}`,
                tags: [
                  { label: "Status", value: "Error" },
                  { label: "ClientId", value: clientId },
                ],
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  async function onInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          zIndex: 1600,
        }}
      >
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Open Fluke AI Assistant"
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            border: "1px solid rgba(255,255,255,0.10)",
            background:
              "linear-gradient(180deg, rgba(8,12,20,0.98), rgba(12,18,31,0.98))",
            boxShadow: "0 16px 34px rgba(0,0,0,0.28)",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <i className="material-icons" style={{ fontSize: 20, color: "#f8fafc" }}>
            psychology_alt
          </i>
        </button>
      </div>

      {modalOpen && (
        <div
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 3000,
            background: "rgba(2,6,23,0.72)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 14,
          }}
        >
          <div
            style={{
              width: "min(1200px, 96vw)",
              height: "min(90vh, 900px)",
              borderRadius: 28,
              overflow: "hidden",
              background: "#080d16",
              color: "#e5e7eb",
              boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              display: "grid",
              gridTemplateRows: "auto minmax(0,1fr) auto",
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
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
                  <Pill label="Route" value="internal only" />
                  <Pill label="ClientId" value={clientId} />
                  <Pill label="Token" value={token ? "present" : "missing"} />
                  <Pill label="URL" value="fixed internal endpoint" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#e5e7eb",
                  cursor: "pointer",
                }}
              >
                <i className="material-icons">close</i>
              </button>
            </div>

            <div
              ref={messagesRef}
              style={{
                overflowY: "auto",
                padding: "18px 22px",
              }}
            >
              <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 16 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#cbd5e1",
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {`canSend=${String(canSend)} | blocked=${blockedReason || "none"} | hasUser=${String(
                    !!user
                  )} | hasToken=${String(!!token)} | loading=${String(
                    loading
                  )} | provider=${provider} | clientId=${clientId}`}
                </div>

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
                          borderRadius: isUser ? "22px 22px 8px 22px" : "22px 22px 22px 8px",
                          border: "1px solid rgba(255,255,255,0.08)",
                          background: isUser
                            ? "linear-gradient(180deg, rgba(29,78,216,0.22), rgba(17,24,39,0.95))"
                            : "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
                          padding: "14px 16px 12px 16px",
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
                          <div style={{ fontSize: 11, color: "rgba(148,163,184,0.82)" }}>
                            {formatTime(msg.ts)}
                          </div>
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
                                key={`${msg.id}_${i}`}
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
                  );
                })}

                <div
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#cbd5e1",
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  <div><strong>Request URL:</strong> {CHAT_URL}</div>
                  <div style={{ marginTop: 8 }}><strong>Last Payload:</strong></div>
                  <div>{lastPayload || "(none yet)"}</div>
                  <div style={{ marginTop: 8 }}><strong>Last Raw Response:</strong></div>
                  <div>{lastResponse || "(none yet)"}</div>
                </div>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.08)",
                padding: "14px 22px 18px",
              }}
            >
              <div style={{ maxWidth: 920, margin: "0 auto" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setProvider("openai")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        provider === "openai"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        provider === "openai"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    OpenAI
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider("ollama")}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 12,
                      border:
                        provider === "ollama"
                          ? "1px solid rgba(96,165,250,0.32)"
                          : "1px solid rgba(255,255,255,0.08)",
                      background:
                        provider === "ollama"
                          ? "rgba(37,99,235,0.18)"
                          : "rgba(255,255,255,0.03)",
                      color: "#f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    Ollama
                  </button>
                </div>

                <div
                  style={{
                    borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background:
                      "linear-gradient(180deg, rgba(10,15,26,0.96), rgba(8,12,21,0.98))",
                    overflow: "hidden",
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
                      placeholder="Message Fluke AI..."
                      rows={1}
                      disabled={loading}
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
                      type="button"
                      onClick={sendMessage}
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
                      padding: "10px 14px 12px",
                      borderTop: "1px solid rgba(255,255,255,0.08)",
                      color: errorText ? "#fca5a5" : "rgba(226,232,240,0.62)",
                      fontSize: 12,
                      minHeight: 18,
                    }}
                  >
                    {errorText || "Ready"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>
        {`
          textarea::placeholder {
            color: rgba(255,255,255,0.32);
          }
        `}
      </style>
    </>
  );
}
