import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import BotAvatar, { type BotStatus } from "../components/BotAvatar2DBit";

type Provider = "auto" | "openai" | "ollama";
type Mode = "plan" | "execute";
type WsState = "disconnected" | "connecting" | "connected";
type TurnStatus = "queued" | "running" | "done" | "error" | "submitted";

type AgentTurn = {
  id: string;
  requestClientId: string;
  mode: Mode;
  request: string;
  reply: string;
  at: number;
  status: TurnStatus;
};

const WS_URL = "wss://nxlqrs6xd2.execute-api.us-east-1.amazonaws.com/production";

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export default function ManagerAgentBuilderPage() {
  const { user, api } = useAuth() as any;
  const token = safeStr((user as any)?.token || "");
  const platform = safeStr(api?.getPlatform?.() || "portal") || "portal";

  const [agentName, setAgentName] = useState("Hiring Manager");
  const [provider, setProvider] = useState<Provider>("auto");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [instruction, setInstruction] = useState(
    "Create a new job for Digital Marketing Manager in Toronto, full-time, and make it public."
  );
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<AgentTurn[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>("neutral");
  const [wsState, setWsState] = useState<WsState>("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const activeRequestClientIdRef = useRef<string | null>(null);
  const registeredClientIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const speakTimer = useRef<number | null>(null);
  const sessionIdRef = useRef(`mgr_${uid()}`);

  const roleLower = safeStr((user as any)?.role || "").toLowerCase();
  const canExecute = roleLower === "admin" || roleLower === "super";
  const isBusy = !!loadingMode;

  const lastTurn = useMemo(() => (history.length ? history[0] : null), [history]);

  function clearSpeakingTimer() {
    if (speakTimer.current) {
      window.clearTimeout(speakTimer.current);
      speakTimer.current = null;
    }
  }

  function speak(text: string) {
    if (!autoSpeak || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const cleaned = safeStr(text).trim();
    if (!cleaned) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.rate = 1;
      utter.pitch = 1;
      utter.volume = 1;
      utter.onstart = () => setBotStatus("speaking");
      utter.onend = () => setBotStatus("neutral");
      utter.onerror = () => setBotStatus("neutral");
      window.speechSynthesis.speak(utter);
    } catch {
      setBotStatus("neutral");
    }
  }

  function registerSocketClientId(clientId: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
    wsRef.current.send(JSON.stringify({ action: "register", clientId }));
    registeredClientIdRef.current = clientId;
    return true;
  }

  function updateTurnByRequest(
    requestClientId: string,
    updater: (turn: AgentTurn) => AgentTurn
  ) {
    setHistory((prev) => prev.map((turn) => (turn.requestClientId === requestClientId ? updater(turn) : turn)));
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
      const requestClientId = activeRequestClientIdRef.current;
      if (!requestClientId) return;

      if (data?.type === "ai-status") {
        updateTurnByRequest(requestClientId, (turn) => ({
          ...turn,
          status: "running",
        }));
        return;
      }

      if (data?.type === "ai-result") {
        const reply = safeStr(data?.reply || "No response received.");
        updateTurnByRequest(requestClientId, (turn) => ({
          ...turn,
          reply,
          status: "done",
        }));
        setLoadingMode(null);
        activeRequestClientIdRef.current = null;
        setBotStatus("neutral");
        clearSpeakingTimer();
        speakTimer.current = window.setTimeout(() => speak(reply), 120);
        return;
      }

      if (data?.type === "ai-error") {
        const msg = safeStr(data?.error || "Unknown websocket error");
        updateTurnByRequest(requestClientId, (turn) => ({
          ...turn,
          reply: `Error: ${msg}`,
          status: "error",
        }));
        setError(msg);
        setLoadingMode(null);
        activeRequestClientIdRef.current = null;
        setBotStatus("neutral");
      }
    };

    ws.onclose = () => {
      setWsState("disconnected");
      wsRef.current = null;
      registeredClientIdRef.current = null;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 1200);
    };

    ws.onerror = () => {
      setWsState("disconnected");
    };
  }

  useEffect(() => {
    if (!token) return;
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
  }, [token]);

function buildManagerQuestion(mode: Mode, raw: string) {
  const base = raw.trim();
  if (mode === "plan") {
    return (
      `${base}\n\n` +
      "Return a manager action plan using Fluke endpoint schema. " +
      "If this is a hiring request, return jobs planning fields. " +
      "If this is a weekly update request, return weekly update intake questions and schema-aligned draft payload."
    );
  }
  return (
    `${base}\n\n` +
    "Execute only if the selected action is currently supported by the backend executor."
  );
}

  async function run(mode: Mode) {
    const q = instruction.trim();
    if (!q) {
      setError("Please enter an instruction first.");
      return;
    }
    if (mode === "execute" && !canExecute) {
      setError("Execute is restricted to admin/super users.");
      return;
    }
    if (wsState !== "connected") {
      setError("WebSocket is not connected yet. Please retry in a moment.");
      return;
    }

    const requestClientId = `${sessionIdRef.current}__${mode}__${uid()}`;
    activeRequestClientIdRef.current = requestClientId;
    if (registeredClientIdRef.current !== requestClientId) {
      registerSocketClientId(requestClientId);
    }

    setLoadingMode(mode);
    setBotStatus("thinking");
    setError("");
    setHistory((prev) => [
      {
        id: uid(),
        requestClientId,
        mode,
        request: q,
        reply: "Queued...",
        at: Date.now(),
        status: "queued",
      },
      ...prev,
    ]);

    try {
      const response = await fetch(`${API_BASE}/ai/chat/internal`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "x-platform": platform,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: requestClientId,
          requestId: requestClientId,
          context: "internal",
          question: buildManagerQuestion(mode, q),
          agentEmployeeId: "project_manager_core",
          agentRole: "project_manager",
          perform: mode === "execute",
          provider,
        }),
      });

      const raw = await response.text();
      let parsed: any = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = { message: raw };
      }

      if (!response.ok) {
        throw new Error(
          safeStr(parsed?.error || parsed?.message || parsed?.raw || `HTTP ${response.status}`)
        );
      }

      updateTurnByRequest(requestClientId, (turn) => ({
        ...turn,
        status: "submitted",
      }));
    } catch (err: any) {
      const msg = safeStr(err?.message || "Request failed.");
      setError(msg);
      updateTurnByRequest(requestClientId, (turn) => ({
        ...turn,
        reply: `Error: ${msg}`,
        status: "error",
      }));
      setLoadingMode(null);
      activeRequestClientIdRef.current = null;
      setBotStatus("neutral");
    }
  }

  return (
    <>
      <style>{`
        .mgr-wrap { max-width: 1180px; margin: 0 auto; padding: 18px 14px 26px; }
        .mgr-hero {
          border: 1px solid rgba(96,165,250,0.24);
          background:
            radial-gradient(800px 280px at 0% 0%, rgba(56,189,248,0.12), transparent 55%),
            radial-gradient(700px 260px at 100% 0%, rgba(59,130,246,0.12), transparent 55%),
            linear-gradient(180deg, rgba(13,23,42,0.86), rgba(7,14,30,0.9));
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(2,6,23,0.5);
          padding: 18px;
        }
        .mgr-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; margin-top: 12px; }
        .mgr-card { border: 1px solid rgba(148,163,184,0.18); border-radius: 16px; background: rgba(15,23,42,0.58); padding: 14px; }
        .mgr-title { margin: 0; color: #e2e8f0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
        .mgr-sub { margin: 6px 0 0; color: rgba(191,219,254,0.9); font-size: 13px; }
        .mgr-label { display: block; margin: 0 0 6px; color: rgba(191,219,254,0.92); font-size: 11px; letter-spacing: 0.7px; text-transform: uppercase; font-weight: 800; }
        .mgr-input, .mgr-select, .mgr-textarea {
          width: 100%;
          border: 1px solid rgba(148,163,184,0.26);
          background: rgba(2,6,23,0.42);
          color: #e2e8f0;
          border-radius: 10px;
          padding: 9px 10px;
          font-size: 14px;
          outline: none;
        }
        .mgr-textarea { min-height: 98px; resize: vertical; font-family: inherit; line-height: 1.45; }
        .mgr-input:focus, .mgr-select:focus, .mgr-textarea:focus { border-color: rgba(56,189,248,0.55); box-shadow: 0 0 0 3px rgba(56,189,248,0.2); }
        .mgr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .mgr-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: center; }
        .mgr-btn {
          border: 1px solid rgba(148,163,184,0.28);
          background: rgba(15,23,42,0.8);
          color: #dbeafe;
          border-radius: 10px;
          padding: 9px 12px;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          cursor: pointer;
        }
        .mgr-btn.primary { border-color: rgba(16,185,129,0.45); background: linear-gradient(180deg, rgba(16,185,129,0.22), rgba(5,150,105,0.15)); color: #d1fae5; }
        .mgr-btn.secondary { border-color: rgba(56,189,248,0.42); background: linear-gradient(180deg, rgba(56,189,248,0.22), rgba(37,99,235,0.16)); color: #e0f2fe; }
        .mgr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mgr-toggle { display: flex; align-items: center; gap: 8px; color: rgba(191,219,254,0.94); font-size: 13px; margin-top: 8px; }
        .mgr-error { margin-top: 10px; border: 1px solid rgba(248,113,113,0.45); background: rgba(127,29,29,0.22); color: #fecaca; border-radius: 10px; padding: 8px 10px; font-size: 13px; font-weight: 700; }
        .mgr-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid rgba(56,189,248,0.38);
          background: rgba(56,189,248,0.14);
          color: #dbeafe;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .mgr-mini { margin-top: 10px; font-size: 12px; color: rgba(191,219,254,0.85); line-height: 1.45; }
        .mgr-history { display: grid; gap: 10px; margin-top: 10px; max-height: 58vh; overflow: auto; padding-right: 2px; }
        .mgr-turn { border: 1px solid rgba(148,163,184,0.24); border-radius: 12px; background: rgba(2,6,23,0.3); padding: 10px; }
        .mgr-turn-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 7px; }
        .mgr-turn pre {
          margin: 6px 0 0;
          white-space: pre-wrap;
          word-break: break-word;
          color: #e2e8f0;
          font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        @media (max-width: 980px) { .mgr-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div className="mgr-wrap">
        <div className="mgr-hero">
          <h1 className="mgr-title">Manager Agent Builder</h1>
          <p className="mgr-sub">
            Async manager workflow using existing websocket + worker pipeline.
          </p>

          <div className="mgr-grid">
            <section className="mgr-card">
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BotAvatar status={botStatus} size={130} />
              </div>

              <div style={{ marginTop: 8, textAlign: "center" }}>
                <span className="mgr-pill">Role: Manager</span>
              </div>

              <div style={{ marginTop: 14 }}>
                <label className="mgr-label">Agent Name</label>
                <input
                  className="mgr-input"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Hiring Manager"
                />
              </div>

              <div className="mgr-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="mgr-label">Provider</label>
                  <select
                    className="mgr-select"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value as Provider)}
                  >
                    <option value="auto">Auto</option>
                    <option value="openai">OpenAI</option>
                    <option value="ollama">Ollama</option>
                  </select>
                </div>
                <div>
                  <label className="mgr-label">Execution Access</label>
                  <input
                    className="mgr-input"
                    value={canExecute ? "Allowed" : "Read-only"}
                    readOnly
                  />
                </div>
              </div>

              <label className="mgr-toggle">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                />
                Auto-speak assistant replies
              </label>

              <div className="mgr-mini">
                WS status: <b>{wsState}</b>
              </div>
            </section>

            <section className="mgr-card">
              <label className="mgr-label">Instruction</label>
              <textarea
                className="mgr-textarea"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Tell the manager agent what to do..."
              />

              <div className="mgr-actions">
                <button
                  className="mgr-btn secondary"
                  disabled={isBusy}
                  onClick={() => run("plan")}
                >
                  {loadingMode === "plan" ? "Planning..." : "Plan"}
                </button>
                <button
                  className="mgr-btn primary"
                  disabled={isBusy || !canExecute}
                  onClick={() => run("execute")}
                  title={canExecute ? "" : "Admin/Super required"}
                >
                  {loadingMode === "execute" ? "Executing..." : "Execute"}
                </button>
              </div>

              {error ? <div className="mgr-error">{error}</div> : null}

              {lastTurn ? (
                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(191,219,254,0.9)" }}>
                  Latest status: <b>{lastTurn.status}</b>
                </div>
              ) : null}

              <div className="mgr-history">
                {history.map((turn) => (
                  <article className="mgr-turn" key={turn.id}>
                    <div className="mgr-turn-head">
                      <span className="mgr-pill">
                        {turn.mode === "plan" ? "Plan" : "Execute"} - {agentName || "Manager"} -{" "}
                        {turn.status}
                      </span>
                      <span style={{ color: "rgba(191,219,254,0.74)", fontSize: 12 }}>
                        {fmt(turn.at)}
                      </span>
                    </div>
                    <pre>{`Instruction:\n${turn.request}\n\nResponse:\n${turn.reply}`}</pre>
                  </article>
                ))}
                {!history.length ? (
                  <div style={{ color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                    No actions yet. Start with <b>Plan</b>.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
