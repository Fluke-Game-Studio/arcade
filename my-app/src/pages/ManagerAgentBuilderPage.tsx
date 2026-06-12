import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, PUBLIC_WEBSITE_BASE } from "../api/config";
import { useAuth } from "../auth/AuthContext";
import BotAvatar, { type BotStatus } from "../components/BotAvatar2DBit";
import { useAgentAdminData } from "../hooks/useAgentAdminData";
import AgentTransactionLogsPage from "./AgentTransactionLogsPage";

type Provider = "auto" | "openai" | "ollama";
type Mode = "plan" | "execute";
type BuilderTab = "execute" | "agents" | "assignments" | "requests" | "policies" | "history" | "intake";
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
  actionRagProvider?: string;
  actionRagTopAction?: string;
  routing?: Record<string, any>;
  agentEmployee?: Record<string, any> | null;
  actionMcp?: Record<string, any> | null;
  workflow?: {
    engine?: string;
    graphTrace?: Array<Record<string, any>>;
    orchestration?: boolean;
    plan?: Array<Record<string, any>>;
    stepResults?: Array<Record<string, any>>;
  } | null;
  approval?: {
    required?: boolean;
    action?: string;
    agentId?: string;
    proposedInput?: Record<string, any>;
    allowRememberedApproval?: boolean;
    requirePasswordAfterApproval?: boolean;
    passwordError?: string;
  } | null;
  guardrails?: {
    deniedReason?: string;
  } | null;
  execution?: {
    mode?: string;
    perform?: boolean;
    requestedMode?: string;
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
type TurnFeedbackState = {
  value: "yes" | "no" | "";
  executionOk: "yes" | "no" | "";
  correctActions: string[];
  note: string;
  saving: boolean;
  saved: boolean;
  error: string;
};
type AgentConfig = {
  agentId: string;
  name: string;
  description?: string;
  role?: string;
  systemPrompt?: string;
  allowedActions: string[];
  allowedContexts?: string[];
  defaultContext?: string;
  actionExecutor?: string;
  sourcesByContext?: Record<string, string[]>;
  approvalPolicy?: { mode?: string };
};
type MpcPolicy = {
  action: string;
  policyName: string;
  description?: string;
  allowedRoles: string[];
  requireApproval: boolean;
  allowRememberedApproval: boolean;
  requirePasswordAfterApproval: boolean;
};
type AgentAssignment = {
  username: string;
  defaultAgentId?: string;
  allowedAgents?: string[];
};
type AgentAccessRequest = {
  requestId: string;
  username: string;
  agentId: string;
  reason?: string;
  status: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
};
type EmployeeLite = {
  username: string;
  employee_name?: string;
};

type StoredIntakeContext = {
  key: string;
  label: string;
  description: string;
  questions: string[];
  backgroundInfo: string;
  sessionPrompt: string;
  customInstructions: string;
  followUpInstructions: string;
  endNote: string;
  mcpActions: string[];
  includeJobQuestions: boolean;
  intakeLinkMode?: "public" | "arcade";
  transcriptEmailEnabled?: boolean;
  transcriptEmailTo?: string;
};

const DEFAULT_SESSION_PROMPT = `You are a structured AI interviewer for Fluke Games. You have ONE job: conduct this interview by asking the listed questions in order.

=== ABSOLUTE RULES — no exceptions ===
1. OFF-TOPIC RESPONSE: If the candidate says ANYTHING not related to answering the current interview question, do NOT engage with it. Say exactly: "Let's keep focused on the interview." then immediately repeat the current question word-for-word. Do not acknowledge, comment on, or explore the off-topic content in any way.
2. QUESTION ORDER: Ask questions strictly in the listed order. Never skip, reorder, or paraphrase. Use the exact wording provided.
3. INCOMPLETE ANSWERS: If an answer is vague or very short, ask one targeted follow-up before moving on.
4. MIC INTERRUPTION: If a response seems cut off or too short, say "It seems your response may have been incomplete — could you complete your answer?" Do not advance.
5. ENGLISH ONLY: Respond only in English, regardless of what language the candidate uses.
6. BREVITY: Keep your own responses short — one or two sentences maximum before asking or repeating the question.`;

const DEFAULT_BACKGROUND_INFO = `This is an internal intake session for Fluke Games. The purpose is to collect structured updates or information from employees or applicants. Responses are reviewed by the relevant team lead or hiring manager.`;

const DEFAULT_CUSTOM_INSTRUCTIONS = `Speak in a warm, professional tone. Keep your own responses to 1–2 sentences before asking or moving on. Do not repeat the question word-for-word before asking it — just ask it directly. Do not use filler phrases like "Great!" or "Awesome!" more than once.`;

const DEFAULT_FOLLOW_UP_INSTRUCTIONS = `If the user's answer is vague, very short (under 15 words), or does not clearly address the question, ask one targeted follow-up before moving on. Do not ask more than one follow-up per question. If the second answer is still vague, accept it and advance.`;

const DEFAULT_END_NOTE = `Thank you for completing this session. Your responses have been recorded and will be reviewed shortly. Have a great rest of your day!`;

const WS_URL = "wss://nxlqrs6xd2.execute-api.us-east-1.amazonaws.com/production";
const FALLBACK_ROLES = ["employee", "admin", "super"] as const;
const INTAKE_CONTEXTS_KEY = "fluke_intake_contexts_v1";

const DEFAULT_INTAKE_CONTEXTS: StoredIntakeContext[] = [
  {
    key: "weekly_update",
    label: "Weekly Update",
    description: "Collect weekly accomplishments, blockers, next steps and submit via MCP.",
    questions: [
      "What did you accomplish this week?",
      "What blockers did you face?",
      "What are your next steps?",
      "Any timesheet summary you want to add?",
    ],
    backgroundInfo: "",
    customInstructions: "",
    followUpInstructions: "",
    endNote: "",
    mcpActions: ["submit_weekly_update"],
    includeJobQuestions: false,
    intakeLinkMode: "arcade",
    sessionPrompt: DEFAULT_SESSION_PROMPT,
  },
  {
    key: "interview_intake",
    label: "Interview Intake",
    description: "Run interview-style voice intake and store transcripted response via applicant action flow.",
    questions: [
      "Please introduce yourself and your relevant experience.",
      "Why are you interested in this role?",
      "Tell me about one project you are proud of.",
      "Anything else you want to add for this application?",
    ],
    backgroundInfo: "",
    customInstructions: "",
    followUpInstructions: "",
    endNote: "",
    mcpActions: ["applicant_send_email"],
    includeJobQuestions: true,
    intakeLinkMode: "public",
    sessionPrompt: DEFAULT_SESSION_PROMPT,
  },
];

function migrateIntakeContext(raw: any): StoredIntakeContext {
  return {
    key: safeStr(raw?.key),
    label: safeStr(raw?.label),
    description: safeStr(raw?.description),
    questions: Array.isArray(raw?.questions) ? raw.questions : [""],
    backgroundInfo: safeStr(raw?.backgroundInfo),
    sessionPrompt: safeStr(raw?.sessionPrompt) || DEFAULT_SESSION_PROMPT,
    customInstructions: safeStr(raw?.customInstructions),
    followUpInstructions: safeStr(raw?.followUpInstructions),
    endNote: safeStr(raw?.endNote),
    mcpActions: Array.isArray(raw?.mcpActions)
      ? raw.mcpActions
      : safeStr(raw?.mcpAction)
      ? [safeStr(raw.mcpAction)]
      : [],
    includeJobQuestions: Boolean(raw?.includeJobQuestions),
    intakeLinkMode: raw?.intakeLinkMode === "public" ? "public" : "arcade",
    transcriptEmailEnabled: Boolean(raw?.transcriptEmailEnabled),
    transcriptEmailTo: safeStr(raw?.transcriptEmailTo),
  };
}

function loadIntakeContexts(): StoredIntakeContext[] {
  try {
    const raw = localStorage.getItem(INTAKE_CONTEXTS_KEY);
    if (!raw) return DEFAULT_INTAKE_CONTEXTS.map((x) => ({ ...x }));
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(migrateIntakeContext);
  } catch {}
  return DEFAULT_INTAKE_CONTEXTS.map((x) => ({ ...x }));
}

async function saveIntakeContexts(contexts: StoredIntakeContext[], token?: string) {
  try {
    localStorage.setItem(INTAKE_CONTEXTS_KEY, JSON.stringify(contexts));
  } catch {}
  if (!token) return;
  const response = await fetch(`${API_BASE}/admin/ai/intake-contexts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ contexts }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Failed to save intake contexts (${response.status})`);
  }
}

async function createIntakeTempLink(ctx: StoredIntakeContext, token: string) {
  const response = await fetch(`${API_BASE}/admin/ai/intake/temp-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      contextKey: ctx.key,
      ttlHours: 72,
      oneTimeUse: true,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.token) {
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }

  return {
    token: String(data.token),
    publicLink: `${PUBLIC_WEBSITE_BASE}/intake?token=${encodeURIComponent(data.token)}&context=${encodeURIComponent(ctx.key)}`,
  };
}

function getIntakeTryLink(ctx: StoredIntakeContext, publicTokenLink: string) {
  if ((ctx.intakeLinkMode || "arcade") === "public") return publicTokenLink;
  return `${window.location.origin}/updates/ai-intake?ctx=${encodeURIComponent(ctx.key)}`;
}

function isReadCapability(capability: string) {
  const key = safeStr(capability).toLowerCase();
  return key.endsWith("_read");
}

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

function prettyJson(value: any) {
  try {
    if (value === null || value === undefined) return "";
    return JSON.stringify(value, null, 2);
  } catch {
    return safeStr(value);
  }
}

function hasObjectContent(value: any) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

function pickIntentTrace(workflow: any) {
  const trace = Array.isArray(workflow?.graphTrace) ? workflow.graphTrace : [];
  return trace.find((step: any) => safeStr(step?.node) === "intent") || null;
}

function toggleInList(list: string[], value: string) {
  const has = list.includes(value);
  if (has) return list.filter((x) => x !== value);
  return [...list, value];
}

function formFromAgent(agent: any): AgentConfig {
  return {
    agentId: safeStr(agent?.agentId),
    name: safeStr(agent?.name || agent?.agentId),
    description: safeStr(agent?.description),
    role: safeStr(agent?.role || "assistant"),
    systemPrompt: safeStr(agent?.systemPrompt),
    allowedActions: Array.isArray(agent?.allowedActions) ? agent.allowedActions : [],
    allowedContexts: Array.isArray(agent?.allowedContexts)
      ? agent.allowedContexts
      : ["internal", "flukegames", "vaibhav"],
    defaultContext: safeStr(agent?.defaultContext || "internal"),
    actionExecutor: safeStr(agent?.actionExecutor),
    sourcesByContext:
      agent?.sourcesByContext && typeof agent.sourcesByContext === "object"
        ? agent.sourcesByContext
        : {},
    approvalPolicy:
      agent?.approvalPolicy && typeof agent.approvalPolicy === "object"
        ? agent.approvalPolicy
        : { mode: "always" },
  };
}

function defaultPolicyForAction(action: string): MpcPolicy {
  const readLike = isReadCapability(action);
  return {
    action,
    policyName: `${action}_policy`,
    description: "",
    allowedRoles: readLike ? ["employee", "admin", "super"] : ["admin", "super"],
    requireApproval: !readLike,
    allowRememberedApproval: true,
    requirePasswordAfterApproval: false,
  };
}

function formFromPolicy(action: string, policy?: Partial<MpcPolicy> | null): MpcPolicy {
  const fallback = defaultPolicyForAction(action);
  if (!policy) return fallback;
  return {
    action: safeStr(policy.action || action).toLowerCase(),
    policyName: safeStr(policy.policyName || fallback.policyName),
    description: safeStr(policy.description || ""),
    allowedRoles: Array.isArray(policy.allowedRoles) ? policy.allowedRoles : fallback.allowedRoles,
    requireApproval: policy.requireApproval !== false,
    allowRememberedApproval: policy.allowRememberedApproval !== false,
    requirePasswordAfterApproval: policy.requirePasswordAfterApproval === true,
  };
}

export default function ManagerAgentBuilderPage() {
  const { user, api } = useAuth() as any;
  const token = safeStr((user as any)?.token || "");

  const [provider, setProvider] = useState<Provider>("auto");
  const [autoSpeak] = useState(false);
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
    role: "assistant",
    systemPrompt: "",
    allowedActions: [],
    allowedContexts: ["internal", "flukegames", "vaibhav"],
    defaultContext: "internal",
    actionExecutor: "",
    sourcesByContext: {},
    approvalPolicy: { mode: "always" },
  });
  const [mcpPolicies, setMcpPolicies] = useState<MpcPolicy[]>([]);
  const [ragClearState, setRagClearState] = useState<{ busy: boolean; result: string }>({ busy: false, result: "" });
  const [assignUsername, setAssignUsername] = useState("");
  const [assignDefaultAgent, setAssignDefaultAgent] = useState("");
  const [assignAllowedAgentsText, setAssignAllowedAgentsText] = useState("");
  const [policyForm, setPolicyForm] = useState<MpcPolicy>({
    action: "mail_write",
    policyName: "mail_write_policy",
    description: "",
    allowedRoles: ["admin", "super"],
    requireApproval: true,
    allowRememberedApproval: true,
    requirePasswordAfterApproval: false,
  });
  const [assignments, setAssignments] = useState<AgentAssignment[]>([]);
  const [accessRequests, setAccessRequests] = useState<AgentAccessRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [pendingApproval, setPendingApproval] = useState<{
    action: string;
    agentId: string;
    proposedInput: Record<string, any>;
    allowRememberedApproval?: boolean;
    requirePasswordAfterApproval?: boolean;
    passwordError?: string;
  } | null>(null);
  const [approvalPassword, setApprovalPassword] = useState("");
  const [turnFeedback, setTurnFeedback] = useState<Record<string, TurnFeedbackState>>({});
  const [intakeContexts, setIntakeContexts] = useState<StoredIntakeContext[]>(() => loadIntakeContexts());
  const [selectedIntakeKey, setSelectedIntakeKey] = useState(() => loadIntakeContexts()[0]?.key || "");
  const [intakeForm, setIntakeForm] = useState<StoredIntakeContext>(() => {
    const ctxs = loadIntakeContexts();
    return ctxs[0] || { key: "", label: "", description: "", questions: [""], backgroundInfo: "", sessionPrompt: "", customInstructions: "", followUpInstructions: "", endNote: "", mcpActions: [], includeJobQuestions: false, intakeLinkMode: "arcade", transcriptEmailEnabled: false, transcriptEmailTo: "" };
  });
  const [intakeJobs, setIntakeJobs] = useState<{ jobId: string; title: string }[]>([]);
  const [intakeJobsLoaded, setIntakeJobsLoaded] = useState(false);
  const [intakeLinkBusyKey, setIntakeLinkBusyKey] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const activeRequestClientIdRef = useRef<string | null>(null);
  const registeredClientIdRef = useRef<string | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const runPollTimersRef = useRef<Record<string, number>>({});
  const speakTimer = useRef<number | null>(null);
  const sessionIdRef = useRef(`mgr_${uid()}`);

  const roleLower = safeStr((user as any)?.employee_role || (user as any)?.role || "").toLowerCase();
  const canExecute = roleLower === "admin" || roleLower === "super";
  const isBusy = !!loadingMode;
  const adminData = useAgentAdminData(token, safeStr((user as any)?.username || ""));
  const availableCapabilities = adminData.definitions.capabilities;
  const readCapabilities = availableCapabilities.filter(isReadCapability);
  const writeCapabilities = availableCapabilities.filter((action) => !isReadCapability(action));
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
    const intentTrace = pickIntentTrace(data?.meta?.workflow);
    return {
      provider: safeStr(data?.provider || ""),
      model: safeStr(data?.model || ""),
      contextType: safeStr(data?.contextType || ""),
      contextLabel: safeStr(data?.contextLabel || ""),
      memoryProvider: safeStr(data?.meta?.memory?.provider || ""),
      memoryTurnCount: Number(data?.meta?.memory?.turnCount || 0) || 0,
      actionRagProvider: safeStr(intentTrace?.ragProvider || ""),
      actionRagTopAction: safeStr(intentTrace?.ragTopAction || ""),
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
              orchestration: data.meta.workflow.orchestration === true,
              plan: Array.isArray(data.meta.workflow.plan) ? data.meta.workflow.plan : [],
              stepResults: Array.isArray(data.meta.workflow.stepResults) ? data.meta.workflow.stepResults : [],
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
      execution:
        data?.meta?.execution && typeof data.meta.execution === "object"
          ? data.meta.execution
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
        allowRememberedApproval: approval.allowRememberedApproval !== false,
        requirePasswordAfterApproval: approval.requirePasswordAfterApproval === true,
        passwordError: safeStr((approval as any).passwordError || ""),
      });
      setApprovalPassword("");
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

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/admin/ai/intake-contexts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));
        const items = Array.isArray(data?.contexts) ? data.contexts.map(migrateIntakeContext) : [];
        if (items.length > 0) {
          setIntakeContexts(items);
          setSelectedIntakeKey(items[0].key || "");
          setIntakeForm(items[0]);
          saveIntakeContexts(items, token).catch(() => {});
        }
      } catch {}
    })();
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
    setAccessRequests(adminData.accessRequests as any);
    setEmployees(adminData.employees as any);
  }, [adminData.agents, adminData.policies, adminData.assignments, adminData.accessRequests, adminData.employees]);

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
      setAgentForm(formFromAgent(agents[0]));
    }
  }, [adminData.agents, selectedAgentId, agentForm.agentId]);

function buildManagerQuestion(mode: Mode, raw: string) {
  const base = raw.trim();
  if (mode === "plan") {
    return (
      `You are an intent classifier and query optimizer.\n\n` +
      `The user wrote:\n"${base}"\n\n` +
      `Parse the intent carefully. Break down any compound or conditional steps into a clear ordered sequence. ` +
      `Then rewrite this as a single clean, structured, unambiguous instruction that can be pasted directly into an execution prompt and run without confusion. ` +
      `Output ONLY the rewritten instruction — no explanation, no preamble, no labels. Just the refined query.`
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
          password?: string;
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
          threadId: sessionIdRef.current,
          context: "internal",
          question: buildManagerQuestion(mode, q),
          agentEmployeeId: selectedAgentId,
          agentId: selectedAgentId,
          agentRole: "project_manager",
          executionMode: mode,
          perform: mode === "execute",
          ...(mode === "execute" && approval?.action ? { mcpAction: approval.action } : {}),
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
                        ...(approval.password ? { password: approval.password } : {}),
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

  function predictedActionForTurn(turn: AgentTurn) {
    const workflow = turn.diagnostics?.workflow as any;
    const trace = Array.isArray(workflow?.graphTrace) ? workflow.graphTrace : [];
    const intent = trace.find((x: any) => safeStr(x?.node) === "intent");
    const fromIntent = safeStr(intent?.actionName);
    const fromMcp = safeStr((turn.diagnostics?.actionMcp as any)?.action);
    return fromIntent || fromMcp;
  }

  async function submitTurnFeedback(turn: AgentTurn) {
    const key = turn.requestClientId;
    const state = turnFeedback[key];
    if (!state) return;
    const predictedAction = predictedActionForTurn(turn);
    if (!predictedAction) return;
    if (!state.value) return;
    if (state.value === "no" && state.correctActions.length === 0) {
      setTurnFeedback((prev) => ({
        ...prev,
        [key]: { ...state, error: "Add at least one MCP action in order." },
      }));
      return;
    }
    setTurnFeedback((prev) => ({
      ...prev,
      [key]: { ...state, saving: true, error: "" },
    }));
    try {
      await fetch(`${API_BASE}/ai/chat/internal`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          clientId: `${sessionIdRef.current}__feedback__${uid()}`,
          requestId: `${sessionIdRef.current}__feedback__${uid()}`,
          threadId: sessionIdRef.current,
          context: "internal",
          question: turn.request,
          requestBody: {
            intentFeedback: {
              question: turn.request,
              predictedAction,
              wasCorrect: state.value === "yes",
              executionOk: state.executionOk === "yes",
              correctAction: state.value === "no" ? state.correctActions[0] || "" : "",
              correctActionsOrdered: state.value === "no" ? state.correctActions : [],
              note: state.note || "",
            },
          },
        }),
      });
      setTurnFeedback((prev) => ({
        ...prev,
        [key]: { ...state, saving: false, saved: true, error: "" },
      }));
    } catch (err: any) {
      setTurnFeedback((prev) => ({
        ...prev,
        [key]: { ...state, saving: false, error: safeStr(err?.message || "Failed to save feedback.") },
      }));
    }
  }

  async function submitApproval(decision: ApprovalDecision, remember: boolean) {
    if (!pendingApproval) return;
    if (decision === "allow" && pendingApproval.requirePasswordAfterApproval && !approvalPassword.trim()) {
      setError("Enter your password to confirm this approval.");
      return;
    }
    await runWithApproval("execute", {
      decision,
      remember,
      action: pendingApproval.action || "",
      agentId: pendingApproval.agentId || selectedAgentId,
      proposedInput: pendingApproval.proposedInput || {},
      password: decision === "allow" && pendingApproval.requirePasswordAfterApproval ? approvalPassword : undefined,
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
        .mgr-cap-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .mgr-cap-group {
          border: 1px solid rgba(148,163,184,0.16);
          border-radius: 12px;
          background: rgba(2,6,23,0.18);
          padding: 10px;
        }
        .mgr-cap-title {
          color: rgba(226,232,240,0.92);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.4px;
        }
        .mgr-empty-inline {
          color: rgba(203,213,225,0.72);
          font-size: 12px;
          font-weight: 700;
          padding: 7px 0;
        }
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
        .mgr-btn.danger { border-color: rgba(248,113,113,0.5); background: linear-gradient(180deg, rgba(248,113,113,0.2), rgba(127,29,29,0.18)); color: #fecaca; }
        .mgr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mgr-toggle { display: flex; align-items: center; gap: 8px; color: rgba(191,219,254,0.94); font-size: 13px; margin-top: 8px; }
        .mgr-check-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid rgba(148,163,184,0.20);
          border-radius: 10px;
          background: rgba(2,6,23,0.22);
          color: rgba(219,234,254,0.96);
          padding: 9px 10px;
          font-size: 13px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .mgr-check-row:hover { border-color: rgba(56,189,248,0.45); background: rgba(15,23,42,0.54); }
        .mgr-check-row:disabled { opacity: 0.55; cursor: not-allowed; }
        .mgr-check-box {
          width: 20px;
          height: 20px;
          min-width: 20px;
          display: inline-grid;
          place-items: center;
          border-radius: 6px;
          border: 1px solid rgba(148,163,184,0.55);
          background: rgba(15,23,42,0.92);
          color: #ecfdf5;
          font-size: 15px;
          font-weight: 900;
          line-height: 1;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
        }
        .mgr-check-box.checked {
          border-color: rgba(16,185,129,0.92);
          background: linear-gradient(180deg, rgba(16,185,129,0.92), rgba(5,150,105,0.82));
        }
        .mgr-check-box.blue.checked {
          border-color: rgba(56,189,248,0.92);
          background: linear-gradient(180deg, rgba(56,189,248,0.92), rgba(37,99,235,0.82));
        }
        .mgr-check-box.amber.checked {
          border-color: rgba(251,191,36,0.92);
          background: linear-gradient(180deg, rgba(251,191,36,0.95), rgba(217,119,6,0.86));
          color: #111827;
        }
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
        .mgr-pill.ok { border-color: rgba(16,185,129,0.46); background: rgba(16,185,129,0.16); color: #d1fae5; }
        .mgr-pill.warn { border-color: rgba(250,204,21,0.5); background: rgba(250,204,21,0.12); color: #fef3c7; }
        .mgr-pill.err { border-color: rgba(248,113,113,0.5); background: rgba(127,29,29,0.2); color: #fecaca; }
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
        .mgr-debug summary {
          cursor: pointer;
          color: rgba(191,219,254,0.96);
          font-weight: 900;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          font-size: 11px;
        }
        .mgr-debug[open] summary { margin-bottom: 8px; }
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
        .mgr-mcp-payload {
          margin-top: 8px;
          border: 1px solid rgba(56,189,248,0.22);
          border-radius: 10px;
          background: rgba(2,6,23,0.28);
          overflow: hidden;
        }
        .mgr-mcp-payload-title {
          padding: 7px 9px;
          color: rgba(191,219,254,0.96);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(56,189,248,0.16);
        }
        .mgr-mcp-payload pre {
          margin: 0;
          max-height: 260px;
          overflow: auto;
          white-space: pre-wrap;
          color: #e0f2fe;
          font-size: 11px;
          line-height: 1.45;
          padding: 9px;
          background: rgba(15,23,42,0.42);
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
          <h1 className="mgr-title">Agent Builder</h1>
          <div className="mgr-actions" style={{ marginTop: 8 }}>
            <button className={`mgr-btn ${tab === "execute" ? "secondary" : ""}`} onClick={() => setTab("execute")}>Execute</button>
            <button className={`mgr-btn ${tab === "agents" ? "secondary" : ""}`} onClick={() => setTab("agents")}>Agents</button>
            <button className={`mgr-btn ${tab === "assignments" ? "secondary" : ""}`} onClick={() => setTab("assignments")}>Assignments</button>
            <button className={`mgr-btn ${tab === "requests" ? "secondary" : ""}`} onClick={() => setTab("requests")}>Requests</button>
            <button className={`mgr-btn ${tab === "policies" ? "secondary" : ""}`} onClick={() => setTab("policies")}>MCP Policies</button>
            <button className={`mgr-btn ${tab === "history" ? "secondary" : ""}`} onClick={() => setTab("history")}>Transaction History</button>
            <button className={`mgr-btn ${tab === "intake" ? "secondary" : ""}`} onClick={() => {
              setTab("intake");
              if (!intakeJobsLoaded) {
                api.listJobsAdmin().then((jobs: any[]) => {
                  setIntakeJobs(jobs.map((j: any) => ({ jobId: j.jobId, title: j.title || j.jobId })));
                  setIntakeJobsLoaded(true);
                }).catch(() => setIntakeJobsLoaded(true));
              }
            }}>Intake Contexts</button>
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
                  title="Reformulates your query into a clean, structured instruction ready for Execute"
                >
                  {loadingMode === "plan" ? "Clarifying..." : "Clarify"}
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
                  {pendingApproval.requirePasswordAfterApproval ? (
                    <div style={{ marginBottom: 10 }}>
                      <label className="mgr-label">Password Confirmation</label>
                      <input
                        className="mgr-input"
                        type="password"
                        value={approvalPassword}
                        onChange={(e) => setApprovalPassword(e.target.value)}
                        placeholder="Enter your password to approve"
                        autoComplete="current-password"
                      />
                      {pendingApproval.passwordError ? (
                        <div style={{ color: "#fecaca", fontSize: 12, marginTop: 6 }}>
                          {pendingApproval.passwordError === "approval-password-invalid"
                            ? "Password was invalid. Try again."
                            : "Password is required for this approval."}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mgr-actions">
                    <button className="mgr-btn primary" disabled={isBusy} onClick={() => submitApproval("allow", false)}>
                      Allow
                    </button>
                    {pendingApproval.allowRememberedApproval !== false ? (
                      <button className="mgr-btn secondary" disabled={isBusy} onClick={() => submitApproval("allow", true)}>
                        Allow & don't ask again
                      </button>
                    ) : null}
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
                        {turn.mode === "plan" ? "Clarify" : "Execute"} - {safeStr(selectedAgentId) || "No Agent"} -{" "}
                        {turn.status}
                      </span>
                      <span style={{ color: "rgba(191,219,254,0.74)", fontSize: 12 }}>
                        {fmt(turn.at)}
                      </span>
                    </div>
                    <pre>{`Instruction:\n${turn.request}\n\nResponse:\n${turn.reply}`}</pre>
                    {turn.mode === "plan" && turn.status === "done" && turn.reply.trim() && (
                      <button
                        className="mgr-btn secondary"
                        style={{ marginTop: 8, fontSize: 12 }}
                        onClick={() => {
                          setInstruction(turn.reply.trim());
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        ↓ Use in Execute
                      </button>
                    )}
                    {turn.status === "done" ? (() => {
                      const predictedAction = predictedActionForTurn(turn);
                      if (!predictedAction) return null;
                      const fb = turnFeedback[turn.requestClientId] || {
                        value: "",
                        executionOk: "",
                        correctActions: [],
                        note: "",
                        saving: false,
                        saved: false,
                        error: "",
                      };
                      return (
                        <div className="mgr-card" style={{ marginTop: 8, padding: 10 }}>
                          {fb.saved ? (
                            <div>
                              <div className="mgr-mini" style={{ marginTop: 0 }}>
                                Feedback saved.
                              </div>
                              <div className="mgr-mini">
                                Intent: <b>{fb.value || "-"}</b> | Execution: <b>{fb.executionOk || "-"}</b>
                              </div>
                              {fb.correctActions.length ? (
                                <div className="mgr-mini">
                                  Expected steps: <b>{fb.correctActions.join(" -> ")}</b>
                                </div>
                              ) : null}
                              {safeStr(fb.note) ? (
                                <div className="mgr-mini">Note: {fb.note}</div>
                              ) : null}
                            </div>
                          ) : (
                            <>
                          <div className="mgr-mini" style={{ marginBottom: 6 }}>
                            Was this the intent you wanted? <b>({predictedAction})</b>
                          </div>
                          <div className="mgr-actions" style={{ marginTop: 0 }}>
                            <button
                              type="button"
                              className={`mgr-btn ${fb.value === "yes" ? "secondary" : ""}`}
                              onClick={() =>
                                setTurnFeedback((prev) => ({
                                  ...prev,
                                    [turn.requestClientId]: { ...fb, value: "yes", error: "" },
                                }))
                              }
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              className={`mgr-btn ${fb.value === "no" ? "secondary" : ""}`}
                              onClick={() =>
                                setTurnFeedback((prev) => ({
                                  ...prev,
                                    [turn.requestClientId]: { ...fb, value: "no", error: "" },
                                }))
                              }
                            >
                              No
                            </button>
                            <button
                              type="button"
                              className="mgr-btn"
                              disabled={fb.saving || fb.saved || !fb.value}
                              onClick={() => submitTurnFeedback(turn)}
                            >
                              {fb.saved ? "Saved" : fb.saving ? "Saving..." : "Save Feedback"}
                            </button>
                          </div>
                          <div className="mgr-actions" style={{ marginTop: 8 }}>
                            <span className="mgr-mini" style={{ marginTop: 0 }}>Was full prompt execution complete?</span>
                            <button
                              type="button"
                              className={`mgr-btn ${fb.executionOk === "yes" ? "secondary" : ""}`}
                              onClick={() =>
                                setTurnFeedback((prev) => ({
                                  ...prev,
                                  [turn.requestClientId]: { ...fb, executionOk: "yes", error: "" },
                                }))
                              }
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className={`mgr-btn ${fb.executionOk === "no" ? "secondary" : ""}`}
                              onClick={() =>
                                setTurnFeedback((prev) => ({
                                  ...prev,
                                  [turn.requestClientId]: { ...fb, executionOk: "no", error: "" },
                                }))
                              }
                            >
                              Incomplete
                            </button>
                          </div>
                          {fb.value === "no" ? (
                            <div style={{ marginTop: 8 }}>
                              <div className="mgr-mini" style={{ marginTop: 0, marginBottom: 6 }}>
                                Select expected MCP actions in order (1, 2, 3...)
                              </div>
                              <div className="mgr-segment" style={{ marginTop: 0 }}>
                                {availableCapabilities.map((cap) => {
                                  const idx = fb.correctActions.indexOf(cap);
                                  const selected = idx >= 0;
                                  return (
                                    <button
                                      type="button"
                                      key={cap}
                                      className={`mgr-seg-btn ${selected ? "active" : ""}`}
                                      onClick={() =>
                                        setTurnFeedback((prev) => {
                                          const current = prev[turn.requestClientId] || fb;
                                          const has = current.correctActions.includes(cap);
                                          const nextActions = has
                                            ? current.correctActions.filter((x) => x !== cap)
                                            : [...current.correctActions, cap];
                                          return {
                                            ...prev,
                                            [turn.requestClientId]: {
                                              ...current,
                                              correctActions: nextActions,
                                              error: "",
                                            },
                                          };
                                        })
                                      }
                                      title={cap}
                                    >
                                      {selected ? (
                                        <span
                                          style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            minWidth: 18,
                                            height: 18,
                                            borderRadius: 999,
                                            border: "1px solid rgba(125,211,252,0.7)",
                                            background: "rgba(2,6,23,0.45)",
                                            color: "#e0f2fe",
                                            fontSize: 11,
                                            fontWeight: 900,
                                            marginRight: 6,
                                          }}
                                        >
                                          {idx + 1}
                                        </span>
                                      ) : null}
                                      {cap}
                                    </button>
                                  );
                                })}
                              </div>
                              {fb.correctActions.length ? (
                                <div style={{ marginTop: 8 }}>
                                  {fb.correctActions.map((stepAction, idx) => (
                                    <div key={`${stepAction}_${idx}`} className="mgr-actions" style={{ marginTop: 4 }}>
                                      <span className="mgr-pill">{idx + 1}</span>
                                      <span className="mgr-mini" style={{ marginTop: 0 }}>{stepAction}</span>
                                      <button
                                        type="button"
                                        className="mgr-btn danger"
                                        onClick={() =>
                                          setTurnFeedback((prev) => ({
                                            ...prev,
                                            [turn.requestClientId]: {
                                              ...fb,
                                              correctActions: fb.correctActions.filter((_, i) => i !== idx),
                                            },
                                          }))
                                        }
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <textarea
                                className="mgr-textarea"
                                style={{ minHeight: 64, marginTop: 8 }}
                                placeholder="What was missing or wrong in execution?"
                                value={fb.note}
                                onChange={(e) =>
                                  setTurnFeedback((prev) => ({
                                    ...prev,
                                    [turn.requestClientId]: { ...fb, note: e.target.value },
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                          {fb.error ? <div className="mgr-error" style={{ marginTop: 8 }}>{fb.error}</div> : null}
                            </>
                          )}
                        </div>
                      );
                    })() : null}
                    {turn.diagnostics ? (
                      <details className="mgr-diag mgr-debug">
                        <summary>Debug details</summary>
                        <div className="mgr-diag-line">
                          Provider: <b>{turn.diagnostics.provider || "-"}</b> | Model:{" "}
                          <b>{turn.diagnostics.model || "-"}</b>
                        </div>
                        <div className="mgr-diag-line">
                          Context: <b>{turn.diagnostics.contextType || "-"}</b> (
                          {turn.diagnostics.contextLabel || "-"})
                        </div>
                        <div className="mgr-diag-line">
                          Memory: <b>{turn.diagnostics.memoryProvider || "none"}</b> | turns:{" "}
                          <b>{turn.diagnostics.memoryTurnCount || 0}</b>
                        </div>
                        <div className="mgr-diag-line">
                          Action RAG: <b>{turn.diagnostics.actionRagProvider || "none"}</b>
                          {turn.diagnostics.actionRagTopAction ? (
                            <>
                              {" "}
                              | top action: <b>{turn.diagnostics.actionRagTopAction}</b>
                            </>
                          ) : null}
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
                        <div className="mgr-diag-line">
                          Execution: <b>{safeStr(turn.diagnostics.execution?.mode) || turn.mode}</b> | perform:{" "}
                          <b>{turn.diagnostics.execution?.perform === true ? "true" : "false"}</b>
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
                          {turn.diagnostics.workflow?.orchestration ? (
                            <>
                              {" "}
                              | orchestration: <b>on</b> | steps:{" "}
                              <b>{turn.diagnostics.workflow.stepResults?.length || turn.diagnostics.workflow.plan?.length || 0}</b>
                            </>
                          ) : null}
                        </div>
                        {safeStr(turn.diagnostics.guardrails?.deniedReason) ? (
                          <div className="mgr-diag-line">
                            Guardrails: <b>{safeStr(turn.diagnostics.guardrails?.deniedReason)}</b>
                          </div>
                        ) : null}
                        {hasObjectContent(turn.diagnostics.actionMcp?.response) ? (
                          <div className="mgr-mcp-payload">
                            <div className="mgr-mcp-payload-title">Action MCP Response</div>
                            <pre>{prettyJson(turn.diagnostics.actionMcp?.response)}</pre>
                          </div>
                        ) : null}
                        {hasObjectContent(turn.diagnostics.actionMcp?.request) ? (
                          <div className="mgr-mcp-payload">
                            <div className="mgr-mcp-payload-title">Action MCP Request</div>
                            <pre>{prettyJson(turn.diagnostics.actionMcp?.request)}</pre>
                          </div>
                        ) : null}
                        {Array.isArray(turn.diagnostics.workflow?.stepResults) &&
                        turn.diagnostics.workflow!.stepResults!.length ? (
                          <div className="mgr-mcp-payload">
                            <div className="mgr-mcp-payload-title">Orchestration Steps</div>
                            <pre>{prettyJson(turn.diagnostics.workflow!.stepResults)}</pre>
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
                      </details>
                    ) : null}
                  </article>
                ))}
                {!history.length ? (
                  <div style={{ color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                    No actions yet. Use <b>Clarify</b> to refine a messy query, then <b>Execute</b>.
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
                            setAgentForm(formFromAgent(a))
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
                  <div className="mgr-cap-grid">
                    <div className="mgr-cap-group">
                      <div className="mgr-cap-title">Read / Context MCP</div>
                      <div className="mgr-segment">
                        {readCapabilities.length ? readCapabilities.map((action) => (
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
                        )) : <span className="mgr-empty-inline">No read capabilities returned by backend.</span>}
                      </div>
                    </div>
                    <div className="mgr-cap-group">
                      <div className="mgr-cap-title">Write / Admin Action MCP</div>
                      <div className="mgr-segment">
                        {writeCapabilities.length ? writeCapabilities.map((action) => (
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
                        )) : <span className="mgr-empty-inline">No write capabilities returned by backend.</span>}
                      </div>
                    </div>
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
                <button
                  className="mgr-btn danger"
                  disabled={!safeStr(agentForm.agentId)}
                  onClick={async () => {
                    const agentId = safeStr(agentForm.agentId).toLowerCase();
                    if (!agentId) return;
                    const ok = window.confirm(
                      `Delete agent "${agentForm.name || agentId}"?\n\nThis removes the agent definition from the AI agent store. User assignments that referenced it may need cleanup.`
                    );
                    if (!ok) return;
                    try {
                      const resp = await fetch(`${API_BASE}/admin/ai/agents/delete`, {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ agentId }),
                      });
                      const data = await resp.json().catch(() => ({}));
                      if (!resp.ok) throw new Error(safeStr(data?.error || `HTTP ${resp.status}`));
                      setAgentForm({
                        agentId: "",
                        name: "",
                        description: "",
                        role: "assistant",
                        systemPrompt: "",
                        allowedActions: [],
                        allowedContexts: ["internal", "flukegames", "vaibhav"],
                        defaultContext: "internal",
                        actionExecutor: "",
                        sourcesByContext: {},
                        approvalPolicy: { mode: "always" },
                      });
                      if (selectedAgentId === agentId) setSelectedAgentId("");
                      invalidateAgentAdminCache();
                      await loadAgentAdminData(true);
                      notify("ok", "Agent deleted");
                    } catch (err: any) {
                      notify("err", safeStr(err?.message || "Failed to delete agent"));
                    }
                  }}
                >
                  Delete Agent
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

          {tab === "requests" ? (
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div className="mgr-turn-head">
                <div>
                  <label className="mgr-label">Agent Access Requests</label>
                  <div style={{ color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                    Review requests submitted from Settings / AI Access.
                  </div>
                </div>
                <button
                  className="mgr-btn secondary"
                  onClick={async () => {
                    invalidateAgentAdminCache();
                    await loadAgentAdminData(true);
                    notify("ok", "Requests refreshed");
                  }}
                >
                  Refresh
                </button>
              </div>
              <div className="mgr-history" style={{ maxHeight: "none" }}>
                {accessRequests.length ? accessRequests.map((request) => {
                  const agent = agentCatalog.find((a) => safeStr(a.agentId).toLowerCase() === safeStr(request.agentId).toLowerCase());
                  const employee = employees.find((e) => safeStr(e.username).toLowerCase() === safeStr(request.username).toLowerCase());
                  const status = safeStr(request.status || "pending").toLowerCase();
                  const pending = status === "pending";
                  return (
                    <article key={request.requestId} className="mgr-turn">
                      <div className="mgr-turn-head">
                        <div>
                          <div style={{ fontWeight: 900, color: "#f8fafc" }}>
                            {safeStr(employee?.employee_name) || request.username}
                          </div>
                          <div style={{ color: "rgba(191,219,254,0.78)", fontSize: 12, marginTop: 2 }}>
                            {request.username} requested <b>{safeStr(agent?.name) || request.agentId}</b>
                          </div>
                        </div>
                        <span className={`mgr-pill ${pending ? "warn" : status === "approved" ? "ok" : "err"}`}>
                          {status || "pending"}
                        </span>
                      </div>
                      <div style={{ color: "#dbeafe", fontSize: 13 }}>
                        Agent: <b>{request.agentId}</b>
                        {request.createdAt ? ` | ${new Date(request.createdAt).toLocaleString()}` : ""}
                      </div>
                      {safeStr(request.reason) ? (
                        <pre>{request.reason}</pre>
                      ) : (
                        <div style={{ marginTop: 8, color: "rgba(191,219,254,0.65)", fontSize: 13 }}>No reason provided.</div>
                      )}
                      {safeStr(request.reviewNote) ? (
                        <div style={{ marginTop: 8, color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                          Review note: {request.reviewNote}
                        </div>
                      ) : null}
                      {pending ? (
                        <div className="mgr-actions">
                          <button
                            className="mgr-btn primary"
                            onClick={async () => {
                              try {
                                const resp = await fetch(`${API_BASE}/admin/ai/agent-access/review`, {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ requestId: request.requestId, decision: "approved" }),
                                });
                                const data = await resp.json().catch(() => ({}));
                                if (!resp.ok) throw new Error(safeStr(data?.error || `HTTP ${resp.status}`));
                                invalidateAgentAdminCache();
                                await loadAgentAdminData(true);
                                notify("ok", "Request approved");
                              } catch (err: any) {
                                notify("err", safeStr(err?.message || "Failed to approve request"));
                              }
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="mgr-btn danger"
                            onClick={async () => {
                              try {
                                const resp = await fetch(`${API_BASE}/admin/ai/agent-access/review`, {
                                  method: "POST",
                                  headers: {
                                    Authorization: `Bearer ${token}`,
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ requestId: request.requestId, decision: "rejected" }),
                                });
                                const data = await resp.json().catch(() => ({}));
                                if (!resp.ok) throw new Error(safeStr(data?.error || `HTTP ${resp.status}`));
                                invalidateAgentAdminCache();
                                await loadAgentAdminData(true);
                                notify("ok", "Request rejected");
                              } catch (err: any) {
                                notify("err", safeStr(err?.message || "Failed to reject request"));
                              }
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                }) : (
                  <div style={{ color: "rgba(191,219,254,0.75)", fontSize: 13 }}>
                    No access requests found.
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {tab === "policies" ? (
            <>
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div className="mgr-row">
                <div>
                  <label className="mgr-label">MCP Permission</label>
                  <div className="mgr-cap-grid">
                    <div className="mgr-cap-group">
                      <div className="mgr-cap-title">Read / Context MCP</div>
                      <div style={{ color: "rgba(191,219,254,0.68)", fontSize: 11, marginBottom: 8 }}>
                        Select an action, then set role access and approval behavior.
                      </div>
                      <div className="mgr-segment">
                        {readCapabilities.length ? readCapabilities.map((action) => {
                          const active = policyForm.action === action;
                          const policy = formFromPolicy(action, mcpPolicies.find((p) => p.action === action));
                          return (
                            <button
                              key={action}
                              type="button"
                              className={`mgr-seg-btn ${active ? "active" : ""}`}
                              onClick={() => {
                                const existing = mcpPolicies.find((p) => p.action === action);
                                setPolicyForm(formFromPolicy(action, existing));
                              }}
                              title={`${action} | approval: ${policy.requireApproval ? "ask" : "no"} | remembered: ${
                                policy.allowRememberedApproval ? "allowed" : "blocked"
                              } | password: ${policy.requirePasswordAfterApproval ? "required" : "not required"}`}
                            >
                              {action}
                            </button>
                          );
                        }) : <span className="mgr-empty-inline">No read capabilities returned by backend.</span>}
                      </div>
                    </div>
                    <div className="mgr-cap-group">
                      <div className="mgr-cap-title">Write / Admin Action MCP</div>
                      <div style={{ color: "rgba(191,219,254,0.68)", fontSize: 11, marginBottom: 8 }}>
                        Approval toggles apply to the selected write/admin MCP policy.
                      </div>
                      <div className="mgr-segment">
                        {writeCapabilities.length ? writeCapabilities.map((action) => {
                          const active = policyForm.action === action;
                          const policy = formFromPolicy(action, mcpPolicies.find((p) => p.action === action));
                          return (
                            <button
                              key={action}
                              type="button"
                              className={`mgr-seg-btn ${active ? "active" : ""}`}
                              onClick={() => {
                                const existing = mcpPolicies.find((p) => p.action === action);
                                setPolicyForm(formFromPolicy(action, existing));
                              }}
                              title={`${action} | approval: ${policy.requireApproval ? "ask" : "no"} | remembered: ${
                                policy.allowRememberedApproval ? "allowed" : "blocked"
                              } | password: ${policy.requirePasswordAfterApproval ? "required" : "not required"}`}
                            >
                              {action}
                            </button>
                          );
                        }) : <span className="mgr-empty-inline">No write capabilities returned by backend.</span>}
                      </div>
                    </div>
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
                  <div style={{ marginTop: 18 }}>
                    <label className="mgr-label">Approval Controls</label>
                    <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                      <button
                        type="button"
                        className="mgr-check-row"
                        onClick={() => setPolicyForm((s) => ({ ...s, requireApproval: !s.requireApproval }))}
                      >
                        <span className={`mgr-check-box ${policyForm.requireApproval ? "checked" : ""}`}>
                          {policyForm.requireApproval ? "✓" : ""}
                        </span>
                        <span>Ask for human approval for this action</span>
                      </button>
                      <button
                        type="button"
                        className="mgr-check-row"
                        disabled={!policyForm.requireApproval}
                        onClick={() =>
                          setPolicyForm((s) => ({ ...s, allowRememberedApproval: !s.allowRememberedApproval }))
                        }
                      >
                        <span className={`mgr-check-box blue ${policyForm.allowRememberedApproval ? "checked" : ""}`}>
                          {policyForm.allowRememberedApproval ? "✓" : ""}
                        </span>
                        <span>Allow "don't ask again" remembered approval</span>
                      </button>
                      <button
                        type="button"
                        className="mgr-check-row"
                        disabled={!policyForm.requireApproval}
                        onClick={() =>
                          setPolicyForm((s) => ({
                            ...s,
                            requirePasswordAfterApproval: !s.requirePasswordAfterApproval,
                          }))
                        }
                      >
                        <span
                          className={`mgr-check-box amber ${
                            policyForm.requirePasswordAfterApproval ? "checked" : ""
                          }`}
                        >
                          {policyForm.requirePasswordAfterApproval ? "✓" : ""}
                        </span>
                        <span>Ask for password after human approval</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Policy Name</label>
                <input className="mgr-input" value={policyForm.policyName} onChange={(e) => setPolicyForm((s) => ({ ...s, policyName: e.target.value }))} />
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

            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <label className="mgr-label" style={{ margin: 0 }}>RAG Action Store</label>
                <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 4 }}>
                  Clear all stored action classification feedback for this context. Use this to reset corrupted or incorrect historical data — the system will fall back to builtin examples only until new feedback is submitted.
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="mgr-btn danger"
                  disabled={ragClearState.busy}
                  onClick={async () => {
                    const contextKey = "internal";
                    if (!window.confirm(`Clear all stored RAG action feedback for context "${contextKey}"? This cannot be undone.`)) return;
                    setRagClearState({ busy: true, result: "" });
                    try {
                      const res = await fetch(`${API_BASE}/admin/ai/action-rag?contextKey=${encodeURIComponent(contextKey)}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error((err as any)?.error || `HTTP ${res.status}`);
                      }
                      setRagClearState({ busy: false, result: "Cleared" });
                      notify("ok", `RAG store cleared for "${contextKey}"`);
                    } catch (e: any) {
                      setRagClearState({ busy: false, result: `Error: ${e?.message}` });
                      notify("err", `Failed to clear RAG store: ${e?.message}`);
                    }
                  }}
                >
                  {ragClearState.busy ? "Clearing…" : "Clear RAG Store"}
                </button>
                {ragClearState.result && (
                  <span style={{ fontSize: 12, color: ragClearState.result.startsWith("Error") ? "#f87171" : "#86efac" }}>
                    {ragClearState.result}
                  </span>
                )}
              </div>
            </section>
            </>
          ) : null}

          {tab === "intake" ? (
            <section className="mgr-card" style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <label className="mgr-label" style={{ margin: 0 }}>Intake Contexts</label>
                  <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 4 }}>
                    Configure the questions and AI behavior for each voice intake session. Changes are saved to browser storage and picked up automatically by the AI Intake page.
                  </div>
                </div>
                <div className="mgr-actions" style={{ marginTop: 0, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    onClick={() => {
                      const newCtx: StoredIntakeContext = {
                        key: `context_${Date.now()}`,
                        label: "New Context",
                        description: "",
                        questions: [""],
                        backgroundInfo: "",
                        sessionPrompt: DEFAULT_SESSION_PROMPT,
                        customInstructions: "",
                        followUpInstructions: "",
                        endNote: "",
                        mcpActions: [],
                        includeJobQuestions: false,
                        intakeLinkMode: "arcade",
                        transcriptEmailEnabled: false,
                        transcriptEmailTo: "",
                      };
                      const next = [...intakeContexts, newCtx];
                      setIntakeContexts(next);
                      setSelectedIntakeKey(newCtx.key);
                      setIntakeForm(newCtx);
                      saveIntakeContexts(next, token).catch(() => {});
                    }}
                  >
                    + Add Context
                  </button>
                  <button
                    type="button"
                    className="mgr-btn danger"
                    disabled={intakeContexts.length <= 1}
                    onClick={() => {
                      const ok = window.confirm(`Delete context "${intakeForm.label}"?`);
                      if (!ok) return;
                      const next = intakeContexts.filter((x) => x.key !== selectedIntakeKey);
                      setIntakeContexts(next);
                      saveIntakeContexts(next, token).catch(() => {});
                      const first = next[0];
                      setSelectedIntakeKey(first?.key || "");
                      setIntakeForm(first || { key: "", label: "", description: "", questions: [""], backgroundInfo: "", sessionPrompt: "", customInstructions: "", followUpInstructions: "", endNote: "", mcpActions: [], includeJobQuestions: false, intakeLinkMode: "arcade", transcriptEmailEnabled: false, transcriptEmailTo: "" });
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="mgr-btn primary"
                    onClick={() => {
                      const next = intakeContexts.map((x) =>
                        x.key === selectedIntakeKey ? { ...intakeForm } : x
                      );
                      setIntakeContexts(next);
                      saveIntakeContexts(next, token).catch(() => {});
                      notify("ok", "Intake context saved — intake page will use this config.");
                    }}
                  >
                    Save Context
                  </button>
                </div>
              </div>

              <div className="mgr-segment" style={{ marginBottom: 14 }}>
                {intakeContexts.map((ctx) => (
                  <div
                    key={ctx.key}
                    className={`mgr-seg-btn ${selectedIntakeKey === ctx.key ? "active" : ""}`}
                    style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", paddingRight: 10 }}
                  >
                    <button
                      type="button"
                      className="mgr-btn"
                      style={{ flex: 1, background: "transparent", border: "none", padding: 0, textAlign: "left" }}
                      onClick={() => {
                        setSelectedIntakeKey(ctx.key);
                        setIntakeForm({ ...ctx });
                      }}
                    >
                      {ctx.label || ctx.key}
                    </button>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <button
                        type="button"
                        className="mgr-btn secondary"
                        disabled={intakeLinkBusyKey === ctx.key}
                        onClick={async () => {
                          try {
                            setIntakeLinkBusyKey(ctx.key);
                            const publicLink = (await createIntakeTempLink(ctx, token)).publicLink;
                            const tryLink = getIntakeTryLink(ctx, publicLink);
                            window.open(tryLink, "_blank", "noopener,noreferrer");
                            notify("ok", `Opened test link for ${ctx.label || ctx.key}`);
                          } catch (err: any) {
                            notify("err", err?.message || "Failed to create test link");
                          } finally {
                            setIntakeLinkBusyKey("");
                          }
                        }}
                      >
                        Try
                      </button>
                    <button
                      type="button"
                      className="mgr-btn secondary"
                      disabled={intakeLinkBusyKey === ctx.key}
                      onClick={async () => {
                          try {
                            setIntakeLinkBusyKey(ctx.key);
                            const publicLink = (await createIntakeTempLink(ctx, token)).publicLink;
                            const linkToCopy = getIntakeTryLink(ctx, publicLink);
                            await navigator.clipboard.writeText(linkToCopy);
                            notify("ok", `Copied link for ${ctx.label || ctx.key}`);
                          } catch (err: any) {
                            notify("err", err?.message || "Failed to create link");
                          } finally {
                            setIntakeLinkBusyKey("");
                          }
                        }}
                      >
                        Generate Link
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mgr-row">
                <div>
                  <label className="mgr-label">Key (identifier)</label>
                  <input
                    className="mgr-input"
                    value={intakeForm.key}
                    onChange={(e) => setIntakeForm((s) => ({ ...s, key: e.target.value }))}
                    placeholder="weekly_update"
                  />
                </div>
                <div>
                  <label className="mgr-label">Label</label>
                  <input
                    className="mgr-input"
                    value={intakeForm.label}
                    onChange={(e) => setIntakeForm((s) => ({ ...s, label: e.target.value }))}
                    placeholder="Weekly Update"
                  />
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <label className="mgr-label">Description</label>
                <input
                  className="mgr-input"
                  value={intakeForm.description}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, description: e.target.value }))}
                  placeholder="Short description shown on the intake page"
                />
              </div>

              <div style={{ marginTop: 12 }}>
                <label className="mgr-label">Intake Link Mode</label>
                <div className="mgr-segment">
                  <button
                    type="button"
                    className={`mgr-seg-btn ${(intakeForm.intakeLinkMode || "arcade") === "arcade" ? "active" : ""}`}
                    onClick={() => setIntakeForm((s) => ({ ...s, intakeLinkMode: "arcade" }))}
                  >
                    Arcade Internal Session
                  </button>
                  <button
                    type="button"
                    className={`mgr-seg-btn ${intakeForm.intakeLinkMode === "public" ? "active" : ""}`}
                    onClick={() => setIntakeForm((s) => ({ ...s, intakeLinkMode: "public" }))}
                  >
                    Public Token Link
                  </button>
                </div>
                <div style={{ color: "rgba(191,219,254,0.55)", fontSize: 11, marginTop: 6, lineHeight: 1.45 }}>
                  Arcade Internal Session opens the local `/updates/ai-intake` flow. Public Token Link copies the public `/intake` URL that can be emailed or shared.
                </div>
              </div>

              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(intakeForm.transcriptEmailEnabled)}
                    onChange={(e) => setIntakeForm((s) => ({ ...s, transcriptEmailEnabled: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Email transcript on submission / skip</span>
                </label>
                {Boolean(intakeForm.transcriptEmailEnabled) && (
                  <input
                    className="mgr-input"
                    type="email"
                    value={intakeForm.transcriptEmailTo || ""}
                    onChange={(e) => setIntakeForm((s) => ({ ...s, transcriptEmailTo: e.target.value }))}
                    placeholder="recipient@example.com"
                    style={{ marginTop: 10 }}
                  />
                )}
                <div style={{ fontSize: 11, color: "rgba(191,219,254,0.55)", marginTop: 6, lineHeight: 1.5 }}>
                  When enabled, a plain-text transcript is emailed to the address above after every submission or skip.
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <details className="mgr-diag mgr-debug" style={{ padding: 0 }}>
                  <summary style={{ padding: "9px 10px" }}>
                    MCP Actions{" "}
                    {intakeForm.mcpActions.length > 0 ? (
                      <span style={{ color: "#a7f3d0", fontWeight: 700, textTransform: "none", letterSpacing: 0 }}>
                        ({intakeForm.mcpActions.join(" → ")})
                      </span>
                    ) : (
                      <span style={{ color: "#fca5a5", fontWeight: 400, textTransform: "none" }}>(none selected)</span>
                    )}
                  </summary>
                  <div style={{ padding: "0 10px 10px" }}>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginBottom: 8 }}>
                      Click to select actions in execution order. Click again to remove.
                    </div>
                    <div className="mgr-cap-grid">
                      <div className="mgr-cap-group">
                        <div className="mgr-cap-title">Write / Action MCP</div>
                        <div className="mgr-segment">
                          {writeCapabilities.length ? writeCapabilities.map((cap) => {
                            const idx = intakeForm.mcpActions.indexOf(cap);
                            const selected = idx >= 0;
                            return (
                              <button
                                key={cap}
                                type="button"
                                className={`mgr-seg-btn ${selected ? "active" : ""}`}
                                onClick={() =>
                                  setIntakeForm((s) => ({
                                    ...s,
                                    mcpActions: s.mcpActions.includes(cap)
                                      ? s.mcpActions.filter((x) => x !== cap)
                                      : [...s.mcpActions, cap],
                                  }))
                                }
                              >
                                {selected ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    minWidth: 18, height: 18, borderRadius: 999,
                                    border: "1px solid rgba(125,211,252,0.7)",
                                    background: "rgba(2,6,23,0.45)",
                                    color: "#e0f2fe", fontSize: 11, fontWeight: 900, marginRight: 6,
                                  }}>
                                    {idx + 1}
                                  </span>
                                ) : null}
                                {cap}
                              </button>
                            );
                          }) : <span className="mgr-empty-inline">No write capabilities loaded.</span>}
                        </div>
                      </div>
                      <div className="mgr-cap-group">
                        <div className="mgr-cap-title">Read / Context MCP</div>
                        <div className="mgr-segment">
                          {readCapabilities.length ? readCapabilities.map((cap) => {
                            const idx = intakeForm.mcpActions.indexOf(cap);
                            const selected = idx >= 0;
                            return (
                              <button
                                key={cap}
                                type="button"
                                className={`mgr-seg-btn ${selected ? "active" : ""}`}
                                onClick={() =>
                                  setIntakeForm((s) => ({
                                    ...s,
                                    mcpActions: s.mcpActions.includes(cap)
                                      ? s.mcpActions.filter((x) => x !== cap)
                                      : [...s.mcpActions, cap],
                                  }))
                                }
                              >
                                {selected ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    minWidth: 18, height: 18, borderRadius: 999,
                                    border: "1px solid rgba(125,211,252,0.7)",
                                    background: "rgba(2,6,23,0.45)",
                                    color: "#e0f2fe", fontSize: 11, fontWeight: 900, marginRight: 6,
                                  }}>
                                    {idx + 1}
                                  </span>
                                ) : null}
                                {cap}
                              </button>
                            );
                          }) : <span className="mgr-empty-inline">No read capabilities loaded.</span>}
                        </div>
                      </div>
                    </div>
                    {intakeForm.mcpActions.length > 0 ? (
                      <div style={{ marginTop: 8 }}>
                        {intakeForm.mcpActions.map((action, idx) => (
                          <div key={`${action}_${idx}`} className="mgr-actions" style={{ marginTop: 4 }}>
                            <span className="mgr-pill">{idx + 1}</span>
                            <span className="mgr-mini" style={{ marginTop: 0 }}>{action}</span>
                            <button
                              type="button"
                              className="mgr-btn danger"
                              onClick={() =>
                                setIntakeForm((s) => ({
                                  ...s,
                                  mcpActions: s.mcpActions.filter((_, i) => i !== idx),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <label className="mgr-label" style={{ margin: 0 }}>Session Prompt</label>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 2 }}>
                      The core AI behavior rules. Leave blank to use the built-in defaults. Questions, background info, and end note are always appended automatically.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    onClick={() => setIntakeForm((s) => ({ ...s, sessionPrompt: DEFAULT_SESSION_PROMPT }))}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  className="mgr-textarea"
                  style={{ minHeight: 180, fontFamily: "monospace", fontSize: 12 }}
                  value={intakeForm.sessionPrompt}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, sessionPrompt: e.target.value }))}
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <label className="mgr-label" style={{ margin: 0 }}>Background Info</label>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 2 }}>
                      Context that helps the AI understand the purpose of this session (company info, role context, what answers are used for, etc.).
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    onClick={() => setIntakeForm((s) => ({ ...s, backgroundInfo: DEFAULT_BACKGROUND_INFO }))}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  className="mgr-textarea"
                  value={intakeForm.backgroundInfo}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, backgroundInfo: e.target.value }))}
                  placeholder="E.g. This is for Fluke Games employees to submit their weekly work update. The company makes arcade games. Responses are reviewed by team leads..."
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <label className="mgr-label" style={{ margin: 0 }}>Custom Instructions</label>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 2 }}>
                      Specific behavior the AI should follow — tone, language, response length, format, dos and don'ts.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    onClick={() => setIntakeForm((s) => ({ ...s, customInstructions: DEFAULT_CUSTOM_INSTRUCTIONS }))}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  className="mgr-textarea"
                  value={intakeForm.customInstructions}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, customInstructions: e.target.value }))}
                  placeholder="E.g. Speak in a warm, professional tone. Keep your responses under 2 sentences. Do not repeat the question back to the user..."
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <label className="mgr-label" style={{ margin: 0 }}>Follow-up Instructions</label>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 2 }}>
                      Tell the AI when and how to probe deeper before moving to the next question.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    onClick={() => setIntakeForm((s) => ({ ...s, followUpInstructions: DEFAULT_FOLLOW_UP_INSTRUCTIONS }))}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  className="mgr-textarea"
                  value={intakeForm.followUpInstructions}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, followUpInstructions: e.target.value }))}
                  placeholder="E.g. If the user's answer is vague or under 15 words, ask one follow-up to get more specific detail before moving on..."
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div>
                    <label className="mgr-label" style={{ margin: 0 }}>End Note</label>
                    <div style={{ color: "rgba(191,219,254,0.65)", fontSize: 11, marginTop: 2 }}>
                      What the AI says after all questions are answered. Leave blank for a default closing message.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    style={{ flexShrink: 0, marginLeft: 12 }}
                    onClick={() => setIntakeForm((s) => ({ ...s, endNote: DEFAULT_END_NOTE }))}
                  >
                    Load Default
                  </button>
                </div>
                <textarea
                  className="mgr-textarea"
                  style={{ minHeight: 64 }}
                  value={intakeForm.endNote}
                  onChange={(e) => setIntakeForm((s) => ({ ...s, endNote: e.target.value }))}
                  placeholder="E.g. Thank you for completing your weekly update! Your responses have been recorded and your team lead will review them shortly. Have a great rest of your week!"
                />
              </div>

              {/* Job questions toggle */}
              <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.18)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={intakeForm.includeJobQuestions}
                    onChange={(e) => setIntakeForm((s) => ({ ...s, includeJobQuestions: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: "#6366f1", cursor: "pointer" }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Append role questions from linked job</span>
                </label>
                <div style={{ fontSize: 11, color: "rgba(191,219,254,0.55)", marginTop: 6, lineHeight: 1.5 }}>
                  When enabled, add <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 5px", borderRadius: 4 }}>?jobId=&lt;id&gt;</code> to the interview URL.
                  The job's role-specific questions will be appended after the questions below.
                </div>

                {intakeForm.includeJobQuestions && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: "rgba(191,219,254,0.65)", marginBottom: 6, fontWeight: 600 }}>Test with a job</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        className="mgr-input"
                        style={{ flex: 1, minWidth: 180, maxWidth: 320 }}
                        defaultValue=""
                        onChange={(e) => {
                          const jid = e.target.value;
                          if (jid) {
                            const url = `/updates/ai-intake?ctx=${encodeURIComponent(intakeForm.key)}&jobId=${encodeURIComponent(jid)}`;
                            window.open(url, "_blank");
                          }
                        }}
                      >
                        <option value="">— pick a job to test —</option>
                        {intakeJobs.map((j) => (
                          <option key={j.jobId} value={j.jobId}>{j.title}</option>
                        ))}
                      </select>
                      {!intakeJobsLoaded && <span style={{ fontSize: 11, color: "rgba(191,219,254,0.4)" }}>Loading jobs…</span>}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "rgba(191,219,254,0.4)" }}>
                      Or navigate manually: <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>/updates/ai-intake?ctx={intakeForm.key}&amp;jobId=&lt;jobId&gt;</code>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label className="mgr-label" style={{ margin: 0 }}>
                    Questions <span style={{ color: "rgba(191,219,254,0.55)", fontWeight: 400 }}>({intakeForm.questions.length})</span>
                  </label>
                  <button
                    type="button"
                    className="mgr-btn secondary"
                    onClick={() =>
                      setIntakeForm((s) => ({ ...s, questions: [...s.questions, ""] }))
                    }
                  >
                    + Add Question
                  </button>
                </div>
                {intakeForm.questions.map((q, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
                      <button
                        type="button"
                        className="mgr-btn"
                        style={{ padding: "3px 7px", fontSize: 11, lineHeight: 1 }}
                        disabled={idx === 0}
                        onClick={() =>
                          setIntakeForm((s) => {
                            const next = [...s.questions];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            return { ...s, questions: next };
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="mgr-btn"
                        style={{ padding: "3px 7px", fontSize: 11, lineHeight: 1 }}
                        disabled={idx === intakeForm.questions.length - 1}
                        onClick={() =>
                          setIntakeForm((s) => {
                            const next = [...s.questions];
                            [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                            return { ...s, questions: next };
                          })
                        }
                      >
                        ↓
                      </button>
                    </div>
                    <span style={{ color: "rgba(191,219,254,0.5)", fontSize: 12, paddingTop: 10, minWidth: 22, textAlign: "right" }}>
                      {idx + 1}.
                    </span>
                    <textarea
                      className="mgr-textarea"
                      style={{ minHeight: 54, flex: 1 }}
                      value={q}
                      onChange={(e) =>
                        setIntakeForm((s) => {
                          const next = [...s.questions];
                          next[idx] = e.target.value;
                          return { ...s, questions: next };
                        })
                      }
                      placeholder={`Question ${idx + 1}`}
                    />
                    <button
                      type="button"
                      className="mgr-btn danger"
                      style={{ padding: "4px 9px", fontSize: 12, marginTop: 4 }}
                      disabled={intakeForm.questions.length <= 1}
                      onClick={() =>
                        setIntakeForm((s) => ({
                          ...s,
                          questions: s.questions.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "history" ? <AgentTransactionLogsPage embedded /> : null}
        </div>
      </div>
    </>
  );
}
