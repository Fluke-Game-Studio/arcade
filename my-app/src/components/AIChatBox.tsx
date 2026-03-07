import React, { useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
};

type ModelOption = {
  id: string;
  label: string;
  description: string;
};

const API_URL = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com/ai/test";

const MODEL_OPTIONS: ModelOption[] = [
  {
    id: "fast",
    label: "Fast",
    description: "Quick replies, lighter model route",
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Good quality and speed",
  },
  {
    id: "smart",
    label: "Smart",
    description: "Higher quality / heavier route",
  },
];

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function pickTextFromUnknown(data: any): string {
  if (!data) return "No response received.";

  if (typeof data === "string") return data;

  if (typeof data?.answer === "string") return data.answer;
  if (typeof data?.response === "string") return data.response;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.output === "string") return data.output;
  if (typeof data?.content === "string") return data.content;
  if (typeof data?.text === "string") return data.text;

  if (typeof data?.data?.answer === "string") return data.data.answer;
  if (typeof data?.data?.response === "string") return data.data.response;
  if (typeof data?.data?.message === "string") return data.data.message;
  if (typeof data?.data?.output === "string") return data.data.output;
  if (typeof data?.data?.content === "string") return data.data.content;
  if (typeof data?.data?.text === "string") return data.data.text;

  if (Array.isArray(data?.output) && data.output.length > 0) {
    const joined = data.output
      .map((x: any) => {
        if (typeof x === "string") return x;
        if (typeof x?.content === "string") return x.content;
        if (Array.isArray(x?.content)) {
          return x.content
            .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
            .join("\n");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
    if (joined) return joined;
  }

  if (Array.isArray(data?.choices) && data.choices[0]) {
    const c = data.choices[0];
    if (typeof c?.message?.content === "string") return c.message.content;
    if (typeof c?.text === "string") return c.text;
  }

  if (typeof data?.message?.content === "string") return data.message.content;

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return "Response received, but could not parse it.";
  }
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AIChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content:
        "Hey — choose a model, verify the checkbox, and start chatting with your AI endpoint.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(1);
  const [notRobot, setNotRobot] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [endpointMode, setEndpointMode] = useState<"auto" | "openai" | "ollama">("auto");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const selectedModel = useMemo(
    () => MODEL_OPTIONS[selectedIndex] || MODEL_OPTIONS[1],
    [selectedIndex]
  );

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (!scrollRef.current) return;
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const pushMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role,
        content,
        ts: Date.now(),
      },
    ]);
    scrollToBottom();
  };

  const sendMessage = async () => {
    const trimmed = input.trim();

    if (!trimmed) return;
    if (!notRobot) {
      setErrorText("Please confirm you are not a robot before sending.");
      return;
    }

    setErrorText("");
    setLoading(true);

    const nextUserMessage: ChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      ts: Date.now(),
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setInput("");
    scrollToBottom();

    try {
      const payload = {
        message: trimmed,
        prompt: trimmed,
        input: trimmed,
        query: trimmed,
        model: selectedModel.id,
        modelLabel: selectedModel.label,
        provider: endpointMode,
        route: endpointMode,
        captchaChecked: notRobot,
        history: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const rawText = await res.text();

      let parsed: any = rawText;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsed = rawText;
      }

      if (!res.ok) {
        const msg =
          typeof parsed === "string"
            ? parsed
            : pickTextFromUnknown(parsed) || `Request failed with ${res.status}`;
        throw new Error(msg);
      }

      const assistantText = pickTextFromUnknown(parsed);
      pushMessage("assistant", assistantText || "No response text returned.");
    } catch (err: any) {
      const msg = err?.message || "Failed to contact AI endpoint.";
      setErrorText(msg);
      pushMessage("assistant", `Error: ${msg}`);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    await sendMessage();
  };

  const onKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) await sendMessage();
    }
  };

  const sliderPercent =
    MODEL_OPTIONS.length <= 1
      ? 0
      : (selectedIndex / (MODEL_OPTIONS.length - 1)) * 100;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          borderRadius: 28,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          background:
            "linear-gradient(180deg, rgba(8,15,34,0.92), rgba(15,23,42,0.96))",
          boxShadow:
            "0 20px 60px rgba(2,6,23,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            padding: "18px 18px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background:
              "linear-gradient(135deg, rgba(37,99,235,0.22), rgba(59,130,246,0.10))",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 0.2,
                }}
              >
                Fluke AI Chat
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.68)",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                OpenAI / Ollama-ready chat surface for your Lambda endpoint
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {(["auto", "openai", "ollama"] as const).map((mode) => {
                const active = endpointMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEndpointMode(mode)}
                    style={{
                      border: active
                        ? "1px solid rgba(96,165,250,0.45)"
                        : "1px solid rgba(255,255,255,0.10)",
                      background: active
                        ? "linear-gradient(135deg, rgba(59,130,246,0.28), rgba(37,99,235,0.24))"
                        : "rgba(255,255,255,0.05)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 12,
                      textTransform: "uppercase",
                      letterSpacing: 0.8,
                      borderRadius: 999,
                      padding: "9px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 16,
            }}
            className="hide-on-small-only"
          >
            <div
              style={{
                padding: 16,
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>
                  Model Selection
                </div>
                <div
                  style={{
                    color: "#93c5fd",
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {selectedModel.label}
                </div>
              </div>

              <div style={{ position: "relative", padding: "10px 4px 2px" }}>
                <input
                  type="range"
                  min={0}
                  max={MODEL_OPTIONS.length - 1}
                  step={1}
                  value={selectedIndex}
                  onChange={(e) => setSelectedIndex(Number(e.target.value))}
                  style={{
                    width: "100%",
                    accentColor: "#60a5fa",
                    cursor: "pointer",
                  }}
                />

                <div
                  style={{
                    position: "relative",
                    marginTop: 8,
                    height: 32,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: `${sliderPercent}%`,
                      top: 0,
                      transform: "translateX(-50%)",
                      padding: "6px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 800,
                      color: "white",
                      background:
                        "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(37,99,235,0.95))",
                      border: "1px solid rgba(255,255,255,0.12)",
                      boxShadow: "0 10px 24px rgba(30,64,175,0.25)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectedModel.label}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 8,
                  color: "rgba(255,255,255,0.64)",
                  fontSize: 12,
                }}
              >
                {selectedModel.description}
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 22,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: "white", fontWeight: 800, fontSize: 14, marginBottom: 10 }}>
                Verification
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 14px",
                  borderRadius: 18,
                  background: notRobot
                    ? "rgba(34,197,94,0.12)"
                    : "rgba(255,255,255,0.05)",
                  border: notRobot
                    ? "1px solid rgba(34,197,94,0.32)"
                    : "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={notRobot}
                  onChange={(e) => setNotRobot(e.target.checked)}
                  style={{
                    width: 18,
                    height: 18,
                    accentColor: "#22c55e",
                    cursor: "pointer",
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ color: "white", fontWeight: 800, fontSize: 14 }}>
                    I’m not a robot
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.60)",
                      fontSize: 12,
                    }}
                  >
                    Simple UI gate before requests are allowed
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div
            className="hide-on-med-and-up"
            style={{
              display: "grid",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 18,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>
                Model: {selectedModel.label}
              </div>
              <input
                type="range"
                min={0}
                max={MODEL_OPTIONS.length - 1}
                step={1}
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
                style={{
                  width: "100%",
                  marginTop: 12,
                  accentColor: "#60a5fa",
                }}
              />
              <div
                style={{
                  color: "rgba(255,255,255,0.64)",
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                {selectedModel.description}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 14px",
                borderRadius: 18,
                background: notRobot
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(255,255,255,0.05)",
                border: notRobot
                  ? "1px solid rgba(34,197,94,0.32)"
                  : "1px solid rgba(255,255,255,0.08)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={notRobot}
                onChange={(e) => setNotRobot(e.target.checked)}
                style={{
                  width: 18,
                  height: 18,
                  accentColor: "#22c55e",
                }}
              />
              <span style={{ color: "white", fontWeight: 800, fontSize: 14 }}>
                I’m not a robot
              </span>
            </label>
          </div>

          <div
            ref={scrollRef}
            style={{
              marginTop: 16,
              height: 430,
              overflowY: "auto",
              borderRadius: 24,
              padding: 16,
              background:
                "linear-gradient(180deg, rgba(2,6,23,0.36), rgba(15,23,42,0.68))",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                        maxWidth: "78%",
                        padding: "14px 15px",
                        borderRadius: isUser
                          ? "22px 22px 8px 22px"
                          : "22px 22px 22px 8px",
                        background: isUser
                          ? "linear-gradient(135deg, rgba(59,130,246,0.96), rgba(37,99,235,0.96))"
                          : "rgba(255,255,255,0.07)",
                        color: "white",
                        border: isUser
                          ? "1px solid rgba(255,255,255,0.10)"
                          : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: isUser
                          ? "0 12px 30px rgba(30,64,175,0.22)"
                          : "0 10px 24px rgba(0,0,0,0.12)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          textTransform: "uppercase",
                          letterSpacing: 0.8,
                          opacity: 0.72,
                          marginBottom: 6,
                        }}
                      >
                        {isUser ? "You" : "Assistant"}
                      </div>

                      <div style={{ fontSize: 14, lineHeight: 1.6 }}>{msg.content}</div>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          opacity: 0.56,
                          textAlign: "right",
                        }}
                      >
                        {formatTime(msg.ts)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "14px 15px",
                      borderRadius: "22px 22px 22px 8px",
                      background: "rgba(255,255,255,0.07)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        opacity: 0.72,
                        marginBottom: 8,
                      }}
                    >
                      Assistant
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.78)",
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.55)",
                          display: "inline-block",
                        }}
                      />
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.35)",
                          display: "inline-block",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                padding: 14,
                borderRadius: 24,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask something..."
                rows={4}
                disabled={loading}
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid rgba(255,255,255,0.08)",
                  outline: "none",
                  borderRadius: 18,
                  padding: "14px 16px",
                  background: "rgba(2,6,23,0.34)",
                  color: "white",
                  fontSize: 14,
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    color: errorText ? "#fca5a5" : "rgba(255,255,255,0.56)",
                    fontSize: 12,
                    minHeight: 18,
                  }}
                >
                  {errorText ||
                    `Mode: ${endpointMode.toUpperCase()} • Model: ${selectedModel.label}`}
                </div>

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    minWidth: 136,
                    height: 46,
                    padding: "0 18px",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 16,
                    cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                    background:
                      loading || !input.trim()
                        ? "rgba(255,255,255,0.10)"
                        : "linear-gradient(135deg, rgba(59,130,246,0.96), rgba(37,99,235,0.96))",
                    color: "white",
                    fontWeight: 900,
                    fontSize: 14,
                    boxShadow:
                      loading || !input.trim()
                        ? "none"
                        : "0 14px 28px rgba(30,64,175,0.24)",
                    opacity: loading || !input.trim() ? 0.7 : 1,
                  }}
                >
                  {loading ? "Thinking..." : "Send"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}