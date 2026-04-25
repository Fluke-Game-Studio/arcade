// src/api/types/ai.ts

export type ApiRole = "super" | "admin" | "employee";
export type AIProvider = "auto" | "openai" | "ollama";
export type AIContextId = "vaibhav" | "internal" | "flukegames" | string;

export type ApiLoginResponse = {
  token: string;
  expiresIn: number;
  username: string;
  role: ApiRole;
  name: string;
  projectStatus?: "ProjectPartialClean" | "ProjectCompleteCleanup" | "none" | string;
  allowed?: boolean;
};

export type ApiUser = {
  username: string;
  employee_name?: string;
  employee_email?: string;
  employee_title?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_picture?: string;
  linkedin_connected?: boolean;
  linkedin_connected_at?: string;
  linkedin_member_id?: string;
  linkedin_name?: string;
  linkedin_email?: string;
  discord_connected?: boolean;
  discord_connected_at?: string;
  discord_member_id?: string;
  discord_name?: string;
  discord_email?: string;
  employee_phonenumber?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: ApiRole;
  project_id?: string;
  employee_manager?: string;
  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;
  revoked?: boolean;
  portal_access?: boolean;
  project_access?: boolean;
  version_control_access?: boolean;
  project_setup?: "" | "ProjectPartialCleanUp" | "ProjectCompleteCleanup" | string;
  [k: string]: any;
};

export type CreateUserBody = {
  username: string;
  password: string;
  employee_name?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_picture?: string;
  linkedin_connected?: boolean;
  linkedin_connected_at?: string;
  linkedin_member_id?: string;
  linkedin_name?: string;
  linkedin_email?: string;
  discord_connected?: boolean;
  discord_connected_at?: string;
  discord_member_id?: string;
  discord_name?: string;
  discord_email?: string;
  employee_phonenumber?: string;
  employee_email?: string;
  employee_title?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: ApiRole;
  project_id?: string;
  employee_manager?: string;
  portal_access?: boolean;
  project_access?: boolean;
  version_control_access?: boolean;
  project_setup?: "" | "ProjectPartialCleanUp" | "ProjectCompleteCleanup" | string;
};

export type UpdateUserBody = Partial<CreateUserBody> & {
  username: string;
  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;
};

export type AIDocType = "context" | "snapshot";

export type AIContextBody = {
  label?: string;
  visibility?: "public" | "private";
  systemPrompt?: string;
  sources?: string[];
  [k: string]: any;
};

export type AISnapshotBody = {
  site?: string;
  pages?: Array<{
    route?: string;
    title?: string;
    content?: string;
    [k: string]: any;
  }>;
  policies?: Record<string, any>;
  [k: string]: any;
};

export type AIDoc = {
  id: string;
  type: AIDocType;
  contextId?: string;
  snapshotId?: string;
  updatedAt?: string;
  body: AIContextBody | AISnapshotBody | Record<string, any>;
};

export type GetAIDocResponse = {
  ok: true;
  doc: AIDoc;
};

export type PutAIDocBody = {
  type: AIDocType;
  contextId?: string;
  snapshotId?: string;
  body: Record<string, any>;
};

export type PutAIDocResponse = {
  ok: true;
  doc: AIDoc;
};

export type AIStartChatBody = {
  question: string;
  clientId: string;
  provider?: AIProvider;
  model?: string;
  username?: string;
  weekStart?: string;
  projectId?: string;
  context?: AIContextId;
  agentEmployeeId?: string;
  agentId?: string;
  agentRole?: string;
  perform?: boolean;
};

export type AIStartChatResponse = {
  ok: true;
  status: "queued";
  clientId: string;
  context: string;
  provider: string;
  model: string;
};

export type AITestBody = {
  provider?: AIProvider;
  model?: string;
};

export type AITestResponse = {
  ok: true;
  provider: string;
  model: string;
  reply: string;
};

function joinUrl(base: string, path: string) {
  const a = base.replace(/\/+$/, "");
  const b = path.replace(/^\/+/, "");
  return `${a}/${b}`;
}

async function request<T>(
  url: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  console.log("AI_REQUEST_URL", url);
  console.log("AI_REQUEST_INIT_BODY", init.body);
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  const raw = await res.text();

  let parsed: any = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = { message: raw };
  }

  if (!res.ok) {
    const message =
      parsed?.error ||
      parsed?.message ||
      parsed?.reply ||
      `Request failed with status ${res.status}`;
    throw new Error(String(message));
  }

  return parsed as T;
}

export function createAIAPI(baseUrl: string, token?: string) {
  const withDefaultAgent = (contextId: AIContextId, body: AIStartChatBody): AIStartChatBody => {
    const ctx = String(contextId || body.context || "internal").trim().toLowerCase();
    if (body.agentEmployeeId || body.agentId || body.agentRole) return body;
    if (ctx === "internal" || ctx === "flukegames" || ctx === "public") {
      return {
        ...body,
        context: body.context || contextId,
        agentEmployeeId: "project_manager_core",
        agentRole: "project_manager",
      };
    }
    return {
      ...body,
      context: body.context || contextId,
      agentEmployeeId: "assistant_default",
      agentRole: "assistant",
    };
  };

  return {
    async getAIDoc(id: string) {
      return request<GetAIDocResponse>(
        joinUrl(baseUrl, `/admin/ai-doc/${encodeURIComponent(id)}`),
        { method: "GET" },
        token
      );
    },

    async putAIDoc(id: string, body: PutAIDocBody) {
      return request<PutAIDocResponse>(
        joinUrl(baseUrl, `/admin/ai-doc/${encodeURIComponent(id)}`),
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
        token
      );
    },

    async startChat(contextId: AIContextId, body: AIStartChatBody) {
      const finalBody = withDefaultAgent(contextId, body);
      console.log("AI_STARTCHAT_BODY_OBJECT", finalBody);
      console.log("AI_STARTCHAT_BODY_JSON", JSON.stringify(finalBody));
      return request<AIStartChatResponse>(
        joinUrl(baseUrl, `/ai/chat/${encodeURIComponent(contextId)}`),
        {
          method: "POST",
          body: JSON.stringify(finalBody),
        },
        token
      );
    },

    async aiTest(body: AITestBody = {}) {
      return request<AITestResponse>(
        joinUrl(baseUrl, "/ai/test"),
        {
          method: "POST",
          body: JSON.stringify(body),
        },
        token
      );
    },
  };
}
