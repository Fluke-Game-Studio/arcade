import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import BotAvatar, { type BotStatus } from "../components/BotAvatar2DBit";
import { useAgentAdminData } from "../hooks/useAgentAdminData";

type Provider = "auto" | "openai" | "ollama";
type Mode = "plan" | "execute";
type BuilderTab = "execute" | "agents" | "assignments" | "policies";
type WsState = "disconnected" | "connecting" | "connected";
type TurnStatus = "queued" | "running" | "done" | "error" | "submitted";
type ApprovalDecision = "allow" | "cancel";

type TurnDiagnostics = {
  provider?: string;
  model?: string;
  contextType?: string;
  contextLabel?: string;
  memoryProvider?: string;
  memoryTurnCount?: number;
  routing?: Record<string, any>;
  agentEmployee?: Record<string, any> | null;
  actionMcp?: Record<string, any> | null;
  workflow?: {
    engine?: string;
    graphTrace?: Array<Record<string, any>>;
  } | null;
  approval?: {
    required?: boolean;
    action?: string;
    agentId?: string;
    proposedInput?: Record<string, any>;
  } | null;
  guardrails?: {
    deniedReason?: string;
  } | null;
};

type AgentTurn = {
  id: string;
  requestClientId: string;
  mode: Mode;
  request: string;
  reply: string;
  at: number;
  status: TurnStatus;
  diagnostics?: TurnDiagnostics;
};
type AgentConfig = {
  agentId: string;
  name: string;
  description?: string;
  allowedActions: string[];
  approvalPolicy?: { mode?: string };
};
type MpcPolicy = {
  action: string;
  policyName: string;
  description?: string;
  allowedRoles: string[];
  requireApproval: boolean;
};
type AgentAssignment = {
  username: string;
  defaultAgentId?: string;
  allowedAgents?: string[];
};
type EmployeeLite = {
  username: string;
  employee_name?: string;
};

const WS_URL = "wss://nxlqrs6xd2.execute-api.us-east-1.amazonaws.com/production";
const FALLBACK_CAPABILITIES = ["jobs_write", "mail_write", "updates_write", "jira_read", "jira_write", "jira_admin"] as const;
const FALLBACK_ROLES = ["employee", "admin", "super", "admin-readonly", "super-readonly"] as const;

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

function toggleInList(list: string[], value: string) {
  const has = list.includes(value);
  if (has) return list.filter((x) => x !== value);
  return [...list, value];
}

function defaultPolicyForAction(action: string): MpcPolicy {
  return {
    action,
    policyName: `${action}_policy`,
    description: "",
    allowedRoles: ["admin", "super"],
    requireApproval: true,
  };
}

export default function ManagerAgentBuilderPage() {
  const { user } = useAuth() as any;
  const token = safeStr((user as any)?.token || "");

  const [provider, setProvider] = useState<Provider>("auto");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [instruction, setInstruction] = useState(
    "Create a new job for Digital Marketing Manager in Toronto, full-time, and make it public."
  );
  const [useMcpOverrides, setUseMcpOverrides] = useState(false);
  const [mcpInputText, setMcpInputText] = useState(
    '{\n  "title": "Digital Marketing Manager",\n  "team": "Marketing",\n  "location": "Toronto",\n  "employmentType": "full-time",\n  "description": "Own growth campaigns and funnel analytics.",\n  "isPublic": true\n}'
  );
  const [loadingMode, setLoadingMode] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<AgentTurn[]>([]);
  const [botStatus, setBotStatus] = useState<BotStatus>("neutral");
  const [wsState, setWsState] = useState<WsState>("disconnected");
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tab, setTab] = useState<BuilderTab>("execute");
  const [agentCatalog, setAgentCatalog] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [agentForm, setAgentForm] = useState<AgentConfig>({
    agentId: "",
    name: "",
    description: "",
    allowedActions: [],
    approvalPolicy: { mode: "always" },
  });
  const [mcpPolicies, setMcpPolicies] = useState<MpcPolicy[]>([]);
  const [assignUsername, setAssignUsername] = useState("");
  const [assignDefaultAgent, setAssignDefaultAgent] = useState("");
  const [assignAllowedAgentsText, setAssignAllowedAgentsText] = useState("");
  const [policyForm, setPolicyForm] = useState<MpcPolicy>({
    action: "mail_write",
    policyName: "mail_write_policy",
    description: "",
    allowedRoles: ["admin", "super"],
    requireApproval: true,
  });
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{
    action: string;
    agentId: string;
    proposedInput: Record<string, any>;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const activeRequestClientIdRef = useRef<string | null>(null);
  const registeredClientIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const runPollTimersRef = useRef<Record<string, number>>({});
  const speakTimer = useRef<number | null>(null);
  const sessionIdRef = useRef(`mgr_${uid()}`);

  const roleLower = safeStr((user as any)?.role || "").toLowerCase();
  const canExecute = roleLower === "admin" || roleLower === "super";
  const isBusy = !!loadingMode;
  const adminData = useAgentAdminData(token, safeStr((user as any)?.username || ""));
  const availableCapabilities =
    adminData.definitions.capabilities.length > 0
      ? adminData.definitions.capabilities
      : [...FALLBACK_CAPABILITIES];
  const availableRoles =
    adminData.definitions.roles.length > 0 ? adminData.definitions.roles : [...FALLBACK_ROLES];

  const lastTurn = useMemo(() => (history.length ? history[0] : null), [history]);

  function notify(type: "ok" | "err", text: string) {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 2200);
  }

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

  function clearRunPolling(requestClientId: string) {
    const timer = runPollTimersRef.current[requestClientId];
    if (timer) {
      window.clearInterval(timer);
      delete runPollTimersRef.current[requestClientId];
    }
  }

  function diagnosticsFromPayload(data: any): TurnDiagnostics {
    return {
      provider: safeStr(data?.provider || ""),
      model: safeStr(data?.model || ""),
      contextType: safeStr(data?.contextType || ""),
      contextLabel: safeStr(data?.contextLabel || ""),
      memoryProvider: safeStr(data?.meta?.memory?.provider || ""),
      memoryTurnCount: Number(data?.meta?.memory?.turnCount || 0) || 0,
      routing:
        data?.routing && typeof data.routing === "object"
          ? data.routing
          : undefined,
      agentEmployee:
        data?.agentEmployee && typeof data.agentEmployee === "object"
          ? data.agentEmployee
          : null,
      actionMcp:
        data?.meta?.actionMcp && typeof data.meta.actionMcp === "object"
          ? data.meta.actionMcp
          : null,
      workflow:
        data?.meta?.workflow && typeof data.meta.workflow === "object"
          ? {
              engine: safeStr(data.meta.workflow.engine || ""),
              graphTrace: Array.isArray(data.meta.workflow.graphTrace)
                ? data.meta.workflow.graphTrace
                : [],
            }
          : null,
      approval:
        data?.meta?.approval && typeof data.meta.approval === "object"
          ? data.meta.approval
          : null,
      guardrails:
        data?.meta?.guardrails && typeof data.meta.guardrails === "object"
          ? data.meta.guardrails
          : null,
    };
  }

  function finishTurnFromPayload(requestClientId: string, data: any) {
    clearRunPolling(requestClientId);
    const reply = safeStr(data?.reply || "No response received.");
    const diagnostics = diagnosticsFromPayload(data);
    const approval = diagnostics.approval;
    if (approval?.required) {
      setPendingApproval({
        action: safeStr(approval.action || ""),
        agentId: safeStr(approval.agentId || ""),
        proposedInput:
          approval.proposedInput && typeof approval.proposedInput === "object"
            ? approval.proposedInput
            : {},
      });
    } else {
      setPendingApproval(null);
    }
    updateTurnByRequest(requestClientId, (turn) => ({
      ...turn,
      reply,
      status: "done",
      diagnostics,
    }));
    setLoadingMode(null);
    if (activeRequestClientIdRef.current === requestClientId) activeRequestClientIdRef.current = null;
    setBotStatus("neutral");
    clearSpeakingTimer();
    speakTimer.current = window.setTimeout(() => speak(reply), 120);
  }

  function failTurn(requestClientId: string, msg: string) {
    clearRunPolling(requestClientId);
    updateTurnByRequest(requestClientId, (turn) => ({
      ...turn,
      reply: `Error: ${msg}`,
      status: "error",
    }));
    setError(msg);
    setLoadingMode(null);
    if (activeRequestClientIdRef.current === requestClientId) activeRequestClientIdRef.current = null;
    setBotStatus("neutral");
  }

  function startRunPolling(requestClientId: string) {
    clearRunPolling(requestClientId);
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const resp = await fetch(`${API_BASE}/admin/ai/runs?runId=${encodeURIComponent(requestClientId)}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (resp.status === 404) {
          if (attempts > 45) failTurn(requestClientId, "Timed out waiting for worker result.");
          return;
        }
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = safeStr(data?.error || `HTTP ${resp.status}`);
          if (resp.status >= 500) {
            failTurn(requestClientId, msg);
            return;
          }
          throw new Error(msg);
        }
        const run = data?.run || {};
        const status = safeStr(run?.status).toLowerCase();
        if (status === "running") {
          updateTurnByRequest(requestClientId, (turn) => ({ ...turn, status: "running" }));
          return;
        }
        if (status === "done" || status === "needs_approval" || status === "denied") {
          finishTurnFromPayload(requestClientId, run?.resultPayload || {
            type: "ai-result",
            requestId: requestClientId,
            clientId: requestClientId,
            reply: safeStr(run?.reply || run?.replySummary || "No response received."),
          });
          return;
        }
        if (status === "error") {
          const payload = run?.errorPayload || {};
          failTurn(requestClientId, safeStr(payload?.error || run?.deniedReason || "Worker failed."));
        }
      } catch (err: any) {
        if (attempts > 45) failTurn(requestClientId, safeStr(err?.message || "Timed out waiting for worker result."));
      }
    };
    poll();
    runPollTimersRef.current[requestClientId] = window.setInterval(poll, 2000);
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
        finishTurnFromPayload(requestClientId, data);
        return;
      }

      if (data?.type === "ai-error") {
        const msg = safeStr(data?.error || "Unknown websocket error");
        failTurn(requestClientId, msg);
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
      for (const timer of Object.values(runPollTimersRef.current)) {
        window.clearInterval(timer);
      }
      runPollTimersRef.current = {};
      registeredClientIdRef.current = null;
      setWsState("disconnected");
    };
  }, [token]);

  async function loadAgentAdminData(force = false) {
    await adminData.load(force);
  }

  function invalidateAgentAdminCache() {
    adminData.invalidate();
  }

  useEffect(() => {
    setAgentCatalog(adminData.agents as any);
    setMcpPolicies(adminData.policies as any);
    setAssignments(adminData.assignments as any);
    setEmployees(adminData.employees as any);
  }, [adminData.agents, adminData.policies, adminData.assignments, adminData.employees]);

  useEffect(() => {
    const agents = adminData.agents as any[];
    if (!agents.length) {
      setSelectedAgentId("");
      return;
    }
    if (!agents.find((a: any) => a.agentId === selectedAgentId)) {
      setSelectedAgentId(String(agents[0].agentId || ""));
    }
    if (!safeStr(agentForm.agentId)) {
      const first = agents[0];
      setAgentForm({
        agentId: safeStr(first?.agentId),
        name: safeStr(first?.name || first?.agentId),
        description: safeStr(first?.description),
        allowedActions: Array.isArray(first?.allowedActions) ? first.allowedActions : [],
        approvalPolicy:
          first?.approvalPolicy && typeof first.approvalPolicy === "object"
            ? first.approvalPolicy
            : { mode: "always" },
      });
    }
  }, [adminData.agents, selectedAgentId, agentForm.agentId]);

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

function parseMcpInput(text: string) {
  const trimmed = safeStr(text).trim();
  if (!trimmed) return {};
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    throw new Error("MCP input must be a JSON object.");
  } catch (err: any) {
    throw new Error(safeStr(err?.message || "Invalid MCP input JSON."));
  }
}

  async function run(mode: Mode) {
    return runWithApproval(mode, null);
  }

  async function runWithApproval(
    mode: Mode,
    approval:
      | {
          decision: ApprovalDecision;
          remember: boolean;
          action: string;
          agentId: string;
          proposedInput: Record<string, any>;
        }
      | null
  ) {
    const q = instruction.trim();
    if (!q) {
      setError("Please enter an instruction first.");
      return;
    }
    if (mode === "execute" && !canExecute) {
      setError("Execute is restricted to admin/super users.");
      return;
    }
    if (!agentCatalog.length) {
      setError("No dynamic agents available. Create an agent in Agents tab first.");
      return;
    }
    if (!safeStr(selectedAgentId)) {
      setError("Select an agent profile before plan/execute.");
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

    let parsedMcpInput: Record<string, any> = {};
    if (mode === "execute" && useMcpOverrides) {
      try {
        parsedMcpInput = parseMcpInput(mcpInputText);
      } catch (err: any) {
        setLoadingMode(null);
        setBotStatus("neutral");
        setError(safeStr(err?.message || "Invalid MCP input."));
        return;
      }
    }

    try {
      const response = await fetch(`${API_BASE}/ai/chat/internal`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: requestClientId,
          requestId: requestClientId,
          context: "internal",
          question: buildManagerQuestion(mode, q),
          agentEmployeeId: selectedAgentId,
          agentId: selectedAgentId,
          agentRole: "project_manager",
          perform: mode === "execute",
          ...(mode === "execute"
            ? {
                mcpInputMode: useMcpOverrides ? "override" : "auto",
                ...(useMcpOverrides ? { mcpInput: parsedMcpInput } : {}),
                ...(approval
                  ? {
                      approval: {
                        decision: approval.decision,
                        remember: approval.remember,
                        action: approval.action,
                        agentId: approval.agentId,
                        proposedInput: approval.proposedInput,
                      },
                    }
                  : {}),
              }
            : {}),
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
      startRunPolling(requestClientId);
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

  async function submitApproval(decision: ApprovalDecision, remember: boolean) {
    if (!pendingApproval) return;
    await runWithApproval("execute", {
      decision,
      remember,
      action: pendingApproval.action || "",
      agentId: pendingApproval.agentId || selectedAgentId,
      proposedInput: pendingApproval.proposedInput || {},
    });
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
        .mgr-select.mgr-select-strong {
          height: 44px;
          border: 1px solid rgba(96,165,250,0.7);
          background:
            linear-gradient(180deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92));
          color: #f8fafc;
          font-weight: 700;
          padding-right: 34px;
          appearance: none;
          background-image:
            linear-gradient(180deg, rgba(30,41,59,0.92), rgba(15,23,42,0.92)),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23bfdbfe' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat, no-repeat;
          background-position: 0 0, right 10px center;
          background-size: auto, 16px;
        }
        .mgr-select.mgr-select-strong:focus {
          border-color: rgba(56,189,248,0.92);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.28);
        }
        .mgr-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .mgr-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; align-items: center; }
        .mgr-segment { display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
        .mgr-seg-btn {
          border: 1px solid rgba(96,165,250,0.45);
          background: rgba(15,23,42,0.75);
          color: #dbeafe;
          border-radius: 10px;
          padding: 8px 10px;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.4px;
          cursor: pointer;
        }
        .mgr-seg-btn.active {
          border-color: rgba(16,185,129,0.75);
          background: linear-gradient(180deg, rgba(16,185,129,0.28), rgba(5,150,105,0.2));
          color: #ecfdf5;
        }
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
        .mgr-diag {
          margin-top: 8px;
          border: 1px solid rgba(148,163,184,0.2);
          border-radius: 10px;
          background: rgba(15,23,42,0.38);
          padding: 8px;
          font-size: 12px;
          color: rgba(191,219,254,0.9);
        }
        .mgr-diag-line { margin: 2px 0; }
        .mgr-diag-trace {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed rgba(148,163,184,0.28);
          display: grid;
          gap: 4px;
        }
        .mgr-diag-trace-item {
          font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          color: rgba(191,219,254,0.92);
          background: rgba(2,6,23,0.35);
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 8px;
          padding: 5px 6px;
        }
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
          <div className="mgr-actions" style={{ marginTop: 8 }}>
            <button className={`mgr-btn ${tab === "execute" ? "secondary" : ""}`} onClick={() => setTab("execute")}>Execute</button>
            <button className={`mgr-btn ${tab === "agents" ? "secondary" : ""}`} onClick={() => setTab("agents")}>Agents</button>
            <button className={`mgr-btn ${tab === "assignments" ? "secondary" : ""}`} onClick={() => setTab("assignments")}>Assignments</button>
            <button className={`mgr-btn ${tab === "policies" ? "secondary" : ""}`} onClick={() => setTab("policies")}>MCP Policies</button>
          </div>
          {toast ? (
            <div
              className="mgr-error"
              style={{
                marginTop: 10,
                borderColor: toast.type === "ok" ? "rgba(16,185,129,0.6)" : undefined,
                background: toast.type === "ok" ? "rgba(6,78,59,0.25)" : undefined,
                color: toast.type === "ok" ? "#a7f3d0" : undefined,
              }}
            >
              {toast.text}
            </div>
          ) : null}
          <p className="mgr-sub">
            Async manager workflow using existing websocket + worker pipeline.
          </p>

          {tab === "execute" ? <div className="mgr-grid">
            <section className="mgr-card">
              <div style={{ display: "flex", justifyContent: "center" }}>
                <BotAvatar status={botStatus} size={130} />
              </div>

              <div style={{ marginTop: 8, textAlign: "center" }}>
                <span className="mgr-pill">Role: Manager</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Agent Profile</label>
                <div className="mgr-actions" style={{ marginTop: 0, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: "rgba(191,219,254,0.9)" }}>
                    Available Agents: <b>{agentCatalog.length}</b>
                  </span>
                  <button
                    type="button"
                    className="mgr-btn"
                    onClick={() => loadAgentAdminData(true)}
                  >
                    Refresh Agents
                  </button>
                </div>
                <div className="mgr-segment" style={{ marginBottom: 8 }}>
                  {agentCatalog.map((a: any) => {
                    const id = String(a.agentId || "");
                    const active = selectedAgentId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`mgr-seg-btn ${active ? "active" : ""}`}
                        onClick={() => setSelectedAgentId(id)}
                      >
                        {String(a.name || id)}
                      </button>
                    );
                  })}
                </div>
                <select
                  className="mgr-select mgr-select-strong"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select agent...</option>
                  {agentCatalog.map((a: any) => (
                    <option key={String(a.agentId)} value={String(a.agentId)}>
                      {String(a.name || a.agentId)} ({String(a.agentId)})
                    </option>
                  ))}
                </select>
                {!agentCatalog.length ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#fca5a5" }}>
                    No agents found in `AI_AGENT_STORE`. Create one in Agents tab, then refresh.
                  </div>
                ) : null}
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Execution Access</label>
                <span className="mgr-pill">{canExecute ? "Allowed" : "Read-only"}</span>
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
                <div className="mgr-segment" style={{ marginTop: 0 }}>
                  <button
                    type="button"
                    className={`mgr-seg-btn ${provider === "auto" ? "active" : ""}`}
                    onClick={() => setProvider("auto")}
                  >
                    auto
                  </button>
                  <button
                    type="button"
                    className={`mgr-seg-btn ${provider === "openai" ? "active" : ""}`}
                    onClick={() => setProvider("openai")}
                  >
                    openai
                  </button>
                  <button
                    type="button"
                    className={`mgr-seg-btn ${provider === "ollama" ? "active" : ""}`}
                    onClick={() => setProvider("ollama")}
                  >
                    ollama
                  </button>
                </div>
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

              <div className="mgr-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="mgr-label">Action Routing</label>
                  <div className="mgr-mini">
                    Action is auto-selected by selected agent policy + MCP policy matrix.
                  </div>
                </div>
                <div>
                  <label className="mgr-label">MCP Input JSON</label>
                  <label className="mgr-toggle" style={{ marginTop: 0, marginBottom: 6 }}>
                    <input
                      type="checkbox"
                      checked={useMcpOverrides}
                      onChange={(e) => setUseMcpOverrides(e.target.checked)}
                    />
                    Use JSON as override (otherwise AI generates payload from instruction)
                  </label>
                  <textarea
                    className="mgr-textarea"
                    style={{ minHeight: 98 }}
                    value={mcpInputText}
                    onChange={(e) => setMcpInputText(e.target.value)}
                    placeholder='{"title":"Gameplay Programmer"}'
                  />
                </div>
              </div>

              {error ? <div className="mgr-error">{error}</div> : null}
              {pendingApproval ? (
                <div className="mgr-card" style={{ marginTop: 10, borderColor: "rgba(250,204,21,0.5)" }}>
                  <div className="mgr-label">Human Approval Required</div>
                  <div style={{ color: "#fde68a", fontSize: 13, marginBottom: 8 }}>
                    Action <b>{pendingApproval.action || "auto-detected"}</b> needs confirmation before execute.
                  </div>
                  <div className="mgr-actions">
                    <button className="mgr-btn primary" disabled={isBusy} onClick={() => submitApproval("allow", false)}>
                      Allow
                    </button>
                    <button className="mgr-btn secondary" disabled={isBusy} onClick={() => submitApproval("allow", true)}>
                      Allow & don't ask again
                    </button>
                    <button className="mgr-btn" disabled={isBusy} onClick={() => submitApproval("cancel", false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

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
                        {turn.mode === "plan" ? "Plan" : "Execute"} - {safeStr(selectedAgentId) || "No Agent"} -{" "}
                        {turn.status}
                      </span>
                      <span style={{ color: "rgba(191,219,254,0.74)", fontSize: 12 }}>
                        {fmt(turn.at)}
                      </span>
                    </div>
                    <pre>{`Instruction:\n${turn.request}\n\nResponse:\n${turn.reply}`}</pre>
                    {turn.diagnostics ? (
                      <div className="mgr-diag">
                        <div className="mgr-diag-line">
                          Provider: <b>{turn.diagnostics.provider || "-"}</b> | Model:{" "}
                          <b>{turn.diagnostics.model || "-"}</b>
                        </div>
                        <div className="mgr-diag-line">
                          Context: <b>{turn.diagnostics.contextType || "-"}</b> (
                          {turn.diagnostics.contextLabel || "-"})
                        </div>
                        <div className="mgr-diag-line">
                          Memory/RAG: <b>{turn.diagnostics.memoryProvider || "none"}</b> | turns:{" "}
                          <b>{turn.diagnostics.memoryTurnCount || 0}</b>
                        </div>
                        <div className="mgr-diag-line">
                          Agent:{" "}
                          <b>
                            {safeStr(turn.diagnostics.agentEmployee?.id) ||
                              safeStr(turn.diagnostics.routing?.agentEmployeeId) ||
                              "-"}
                          </b>{" "}
                          | executor:{" "}
                          <b>{safeStr(turn.diagnostics.routing?.actionExecutor) || "-"}</b>
                        </div>
                        {turn.diagnostics.actionMcp ? (
                          <div className="mgr-diag-line">
                            MCP fired: <b>{safeStr(turn.diagnostics.actionMcp?.action) || "-"}</b>{" "}
                            via <b>{safeStr(turn.diagnostics.actionMcp?.route) || "-"}</b>
                          </div>
                        ) : (
                          <div className="mgr-diag-line">
                            MCP fired: <b>no</b>
                          </div>
                        )}
                        <div className="mgr-diag-line">
                          Workflow: <b>{safeStr(turn.diagnostics.workflow?.engine) || "none"}</b>
                        </div>
                        {safeStr(turn.diagnostics.guardrails?.deniedReason) ? (
                          <div className="mgr-diag-line">
                            Guardrails: <b>{safeStr(turn.diagnostics.guardrails?.deniedReason)}</b>
                          </div>
                        ) : null}
                        {Array.isArray(turn.diagnostics.workflow?.graphTrace) &&
                        turn.diagnostics.workflow!.graphTrace!.length ? (
                          <div className="mgr-diag-trace">
                            {turn.diagnostics.workflow!.graphTrace!.map((step, idx) => {
                              const node = safeStr((step as any)?.node || `step_${idx + 1}`);
                              const summary = Object.entries((step || {}) as Record<string, any>)
                                .filter(([k]) => k !== "node")
                                .map(([k, v]) => {
                                  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                                    return `${k}=${String(v)}`;
                                  }
                                  if (Array.isArray(v)) return `${k}=[${v.length}]`;
                                  if (v && typeof v === "object") return `${k}={...}`;
                                  return `${k}=`;
                                })
                                .join(" | ");
                              return (
                                <div key={`${turn.id}_trace_${idx}`} className="mgr-diag-trace-item">
                                  {idx + 1}. {node}
                                  {summary ? ` -> ${summary}` : ""}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
                {!history.length ? (
                  <div style={{ color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                    No actions yet. Start with <b>Plan</b>.
                  </div>
                ) : null}
              </div>
            </section>
          </div> : null}

          {tab === "agents" ? (
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div className="mgr-row">
                <div>
                  <label className="mgr-label">Existing Agents</label>
                  <div className="mgr-segment">
                    {agentCatalog.map((a) => {
                      const active = safeStr(agentForm.agentId) === safeStr(a.agentId);
                      return (
                        <button
                          key={a.agentId}
                          type="button"
                          className={`mgr-seg-btn ${active ? "active" : ""}`}
                          onClick={() =>
                            setAgentForm({
                              agentId: safeStr(a.agentId),
                              name: safeStr(a.name || a.agentId),
                              description: safeStr(a.description),
                              allowedActions: Array.isArray(a.allowedActions) ? a.allowedActions : [],
                              approvalPolicy:
                                a?.approvalPolicy && typeof a.approvalPolicy === "object"
                                  ? a.approvalPolicy
                                  : { mode: "always" },
                            })
                          }
                        >
                          {a.name || a.agentId}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mgr-label">Allowed Capabilities</label>
                  <div className="mgr-segment">
                    {availableCapabilities.map((action) => (
                      <button
                        key={action}
                        type="button"
                        className={`mgr-seg-btn ${agentForm.allowedActions.includes(action) ? "active" : ""}`}
                        onClick={() =>
                          setAgentForm((s) => ({
                            ...s,
                            allowedActions: toggleInList(s.allowedActions || [], action),
                          }))
                        }
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mgr-row" style={{ marginTop: 10 }}>
                <div>
                  <label className="mgr-label">Agent Id</label>
                  <input className="mgr-input" value={agentForm.agentId} onChange={(e) => setAgentForm((s) => ({ ...s, agentId: e.target.value }))} />
                </div>
                <div>
                  <label className="mgr-label">Name</label>
                  <input className="mgr-input" value={agentForm.name} onChange={(e) => setAgentForm((s) => ({ ...s, name: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Description</label>
                <textarea className="mgr-textarea" value={agentForm.description || ""} onChange={(e) => setAgentForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Approval Mode</label>
                <select
                  className="mgr-select"
                  value={safeStr(agentForm.approvalPolicy?.mode || "always")}
                  onChange={(e) => setAgentForm((s) => ({ ...s, approvalPolicy: { mode: e.target.value } }))}
                >
                  <option value="always">always</option>
                  <option value="first_time">first_time</option>
                  <option value="never">never</option>
                </select>
              </div>
              <div className="mgr-actions">
                <button
                  className="mgr-btn primary"
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/admin/ai/agents/upsert`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(agentForm),
                      });
                      invalidateAgentAdminCache();
                      await loadAgentAdminData();
                      notify("ok", "Agent saved");
                    } catch {
                      notify("err", "Failed to save agent");
                    }
                  }}
                >
                  Save Agent
                </button>
              </div>
            </section>
          ) : null}

          {tab === "assignments" ? (
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div className="mgr-row">
                <div>
                  <label className="mgr-label">Users</label>
                  <div className="mgr-segment">
                    {employees.map((row) => {
                      const active = assignUsername === row.username;
                      return (
                        <button
                          key={row.username}
                          type="button"
                          className={`mgr-seg-btn ${active ? "active" : ""}`}
                          onClick={() => {
                            setAssignUsername(row.username);
                            const existing = assignments.find((x) => x.username === row.username);
                            const allowed = Array.isArray(existing?.allowedAgents) ? existing!.allowedAgents! : [];
                            setAssignAllowedAgentsText(allowed.join(", "));
                            setAssignDefaultAgent(safeStr(existing?.defaultAgentId));
                          }}
                        >
                          {safeStr(row.employee_name) ? `${row.employee_name} (${row.username})` : row.username}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mgr-label">Default Agent</label>
                  <div className="mgr-segment">
                    {agentCatalog.map((a) => {
                      const active = assignDefaultAgent === a.agentId;
                      return (
                        <button
                          key={a.agentId}
                          type="button"
                          className={`mgr-seg-btn ${active ? "active" : ""}`}
                          onClick={() => setAssignDefaultAgent(a.agentId)}
                        >
                          {a.agentId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Allowed Agents</label>
                <div className="mgr-segment">
                  {agentCatalog.map((a) => {
                    const selected = assignAllowedAgentsText.split(",").map((x) => x.trim()).filter(Boolean);
                    const active = selected.includes(a.agentId);
                    return (
                      <button
                        key={a.agentId}
                        type="button"
                        className={`mgr-seg-btn ${active ? "active" : ""}`}
                        onClick={() => setAssignAllowedAgentsText(toggleInList(selected, a.agentId).join(", "))}
                      >
                        {a.agentId}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mgr-actions">
                <button
                  className="mgr-btn secondary"
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/admin/ai/agent-assignments/upsert`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          username: assignUsername,
                          defaultAgentId: assignDefaultAgent,
                          allowedAgents: assignAllowedAgentsText.split(",").map((x) => x.trim()).filter(Boolean),
                        }),
                      });
                      invalidateAgentAdminCache();
                      await loadAgentAdminData();
                      notify("ok", "User assignment saved");
                    } catch {
                      notify("err", "Failed to save user assignment");
                    }
                  }}
                >
                  Save User Assignment
                </button>
              </div>
            </section>
          ) : null}

          {tab === "policies" ? (
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div className="mgr-row">
                <div>
                  <label className="mgr-label">MCP Permission</label>
                  <div className="mgr-segment">
                    {availableCapabilities.map((action) => {
                      const active = policyForm.action === action;
                      return (
                        <button
                          key={action}
                          type="button"
                          className={`mgr-seg-btn ${active ? "active" : ""}`}
                          onClick={() => {
                            const existing = mcpPolicies.find((p) => p.action === action);
                            setPolicyForm(existing || defaultPolicyForAction(action));
                          }}
                        >
                          {action}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="mgr-label">Allowed Roles</label>
                  <div className="mgr-segment">
                    {availableRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className={`mgr-seg-btn ${policyForm.allowedRoles.includes(role) ? "active" : ""}`}
                        onClick={() =>
                          setPolicyForm((s) => ({
                            ...s,
                            allowedRoles: toggleInList(s.allowedRoles || [], role),
                          }))
                        }
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Policy Name</label>
                <input className="mgr-input" value={policyForm.policyName} onChange={(e) => setPolicyForm((s) => ({ ...s, policyName: e.target.value }))} />
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-toggle">
                  <input
                    type="checkbox"
                    checked={policyForm.requireApproval}
                    onChange={(e) => setPolicyForm((s) => ({ ...s, requireApproval: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "#10b981", cursor: "pointer" }}
                  />
                  Require human approval
                </label>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Description</label>
                <textarea className="mgr-textarea" value={policyForm.description || ""} onChange={(e) => setPolicyForm((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div className="mgr-actions">
                <button
                  className="mgr-btn primary"
                  onClick={async () => {
                    try {
                      await fetch(`${API_BASE}/admin/ai/mcp-policies/upsert`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify(policyForm),
                      });
                      invalidateAgentAdminCache();
                      await loadAgentAdminData();
                      notify("ok", "MCP policy saved");
                    } catch {
                      notify("err", "Failed to save MCP policy");
                    }
                  }}
                >
                  Save MCP Policy
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
