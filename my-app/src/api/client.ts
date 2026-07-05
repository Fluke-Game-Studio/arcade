import { API_BASE } from "./config";
import type {
  ApiApplicantDetails,
  ApiApplicantListItem,
  ApiApplicantPageResponse,
  ApiJob,
  ApiLoginResponse,
  ApiMyUpdatesResponse,
  ApiProject,
  ApiTimeLogRow,
  ApiUpdatesResponse,
  ApiUser,
  GetEndpointCatalogResponse,
  UpdateEndpointAccessBody,
  UpdateEndpointAccessResponse,
  CreateUserBody,
  CreateWeeklyUpdateUploadUrlsBody,
  CreateWeeklyUpdateUploadUrlsResponse,
  DeleteStorageFileResponse,
  SaveProjectBody,
  SaveQuestionBankBody,
  SendApplicantDocEmailBody,
  SendApplicantRichEmailBody,
  SendApplicantWelcomeEmailBody,
  SendEmployeeDocEmailBody,
  SetJobStatusBody,
  SubmitTimeLogBody,
  SubmitUpdateBody,
  SubmitUpdateResponse,
  UpdateUserBody,
    UpsertJobBody,
    QuestionBank,
    StartLinkedInConnectBody,
    StartLinkedInConnectResponse,
    StartDiscordConnectBody,
    StartDiscordConnectResponse,
    DiscordWebhookStatusResponse,
    DiscordWebhookPostBody,
    DiscordWebhookPostResponse,
    StartJiraConnectBody,
    StartJiraConnectResponse,
    JiraConnectStatusResponse,
    ApiCustomer,
    ApiProduct,
    CreateCustomerBody,
    UpdateCustomerBody,
    CreateCustomerUserBody,
    UpsertEntitlementBody,
    CustomerFlowRow,
    LinkedInOrgPostsResponse,
    LinkedInOrgStatus,
    DiscordStatusResponse,
    ListStorageFilesResponse,
} from "./types";

import type {
  ApiAwardRuleAchievement,
  ApiAwardRuleTrophy,
  ApiMvpRule,
  AwardAchievementBody,
  AwardAchievementResponse,
  AwardTrophyBody,
  AwardTrophyResponse,
  SetWeeklyMvpManualBody,
  SetWeeklyMvpManualResponse,
  AutoAwardWeeklyMvpBody,
  AutoAwardWeeklyMvpResponse,
  GetProgressAdminResponse,
  GenerateAwardsNarrativeBody,
  GenerateAwardsNarrativeResponse,
  CreateAwardAchievementRuleBody,
  UpdateAwardAchievementRuleBody,
  DeleteAwardAchievementRuleResponse,
  CreateAwardTrophyRuleBody,
  UpdateAwardTrophyRuleBody,
  DeleteAwardTrophyRuleResponse,
  GetAllProgressResponse,
  GetAllProgressSummaryResponse,
  GetStudioSummaryResponse,
  GetRecentAwardsResponse,
} from "./types/gamification";

import type {
  AnalyticsContributorBreakdownResponse,
  AnalyticsDashboardResponse,
  AnalyticsMissingListResponse,
  AnalyticsProjectBreakdownResponse,
  AnalyticsQuery,
  AnalyticsTeamOverviewResponse,
  AnalyticsUnderReportedResponse,
  AnalyticsWeeklyComplianceResponse,
  AnalyticsWeeklySubmissionResponse,
} from "./types/analytics";

export class ApiClient {
  private token: string | null = null;
  private platform: "portal" | "project" | "version_control" = "portal";

  setPlatform(platform: "portal" | "project" | "version_control") {
    this.platform = platform;
  }

  getPlatform(): "portal" | "project" | "version_control" {
    return this.platform;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private resolveDefaultAgentEmployee(context?: string) {
    const ctx = String(context || "internal").trim().toLowerCase();
    if (ctx === "internal" || ctx === "flukegames" || ctx === "public") {
      return {
        agentEmployeeId: "project_manager_core",
        agentRole: "project_manager",
      };
    }
    return {
      agentEmployeeId: "assistant_default",
      agentRole: "assistant",
    };
  }

  private headers(isJson = true, includePlatform = false): HeadersInit {
    const h: Record<string, string> = {
      Accept: "*/*",
      Connection: "keep-alive",
    };
    if (includePlatform) h["x-platform"] = this.platform;
    if (isJson) h["Content-Type"] = "application/json";
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async readJson(res: Response): Promise<any> {
    const text = await res.text().catch(() => "");
    if (!text) return {};
    try {
      const j = JSON.parse(text);
      if (typeof j?.body === "string") {
        try {
          return JSON.parse(j.body);
        } catch {
          return { body: j.body };
        }
      }
      return j;
    } catch {
      return { raw: text };
    }
  }

  private extractErrorMessage(payload: any, status: number) {
    return (
      payload?.message ||
      payload?.details ||
      payload?.error ||
      payload?.errors?.[0]?.message ||
      payload?.raw ||
      `HTTP ${status}`
    );
  }

  private buildAnalyticsQuery(query?: AnalyticsQuery): string {
    const params = new URLSearchParams();

    if (!query) return "";

    if (query.weekStart) {
      params.set("weekStart", query.weekStart);
    } else if (query.weekOf) {
      params.set("weekOf", query.weekOf);
    }

    if (query.projectId) params.set("projectId", query.projectId);
    if (query.department) params.set("department", query.department);
    if (query.role) params.set("role", query.role);

    if (typeof query.minHours === "number" && Number.isFinite(query.minHours)) {
      params.set("minHours", String(query.minHours));
    }

    if (typeof query.includeInactive === "boolean") {
      params.set("includeInactive", String(query.includeInactive));
    }

    if (typeof query.includeRows === "boolean") {
      params.set("includeRows", String(query.includeRows));
    }

    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  private async getAnalytics<T>(path: string, query?: AnalyticsQuery): Promise<T> {
    const r = await fetch(`${API_BASE}${path}${this.buildAnalyticsQuery(query)}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `${path} failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as T;
  }

  async login(
    username: string,
    password: string,
    platform: "portal" | "project" | "version_control" = "portal"
  ): Promise<ApiLoginResponse> {
    this.setPlatform(platform);
    const body = JSON.stringify({ username: username.trim(), password, platform });
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: this.headers(true, true),
      body,
    });
    if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
    const json = (await res.json()) as ApiLoginResponse;
    if (!json?.token) throw new Error("Login response missing token");
    this.setToken(json.token);
    return json;
  }

  async getMe(): Promise<ApiUser> {
    const r = await fetch(`${API_BASE}/me`, { headers: this.headers(false) });
    if (!r.ok) throw new Error(`me failed (${r.status})`);
    return r.json();
  }

  async getArcadeReleaseConfig(): Promise<{ ok: boolean; releaseVersion: string; releaseNotes: string }> {
    const r = await fetch(`${API_BASE}/arcade-release-config`, {
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getArcadeReleaseConfig failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; releaseVersion: string; releaseNotes: string };
  }

  async updateArcadeReleaseConfig(body: { releaseVersion: string; releaseNotes: string }): Promise<{ ok: boolean; releaseVersion: string; releaseNotes: string }> {
    const r = await fetch(`${API_BASE}/admin/arcade-release-config`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`updateArcadeReleaseConfig failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; releaseVersion: string; releaseNotes: string };
  }

  async markReleaseSeen(body: { releaseVersion: string }): Promise<{ ok: boolean; releaseVersion: string }> {
    const r = await fetch(`${API_BASE}/me/release-seen`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`markReleaseSeen failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; releaseVersion: string };
  }

  async getDirectory(): Promise<ApiUser[]> {
    const r = await fetch(`${API_BASE}/directory`, {
      headers: this.headers(false),
    });
    if (!r.ok) throw new Error(`directory failed (${r.status})`);
    const payload = await this.readJson(r);
    if (Array.isArray(payload?.items)) return payload.items as ApiUser[];
    if (Array.isArray(payload)) return payload as ApiUser[];
    return [];
  }

  async getUsers(): Promise<ApiUser[]> {
    const r = await fetch(`${API_BASE}/admin/users`, {
      headers: this.headers(false),
    });
    if (r.status === 403) return this.getDirectory();
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getUsers failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiUser[];
    if (Array.isArray(payload?.items)) return payload.items as ApiUser[];
    return [];
  }

  async getUser(username: string): Promise<ApiUser> {
    const r = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getUser failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiUser;
  }

  async createUser(body: CreateUserBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/createUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createUser failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async sendAdminGenericEmail(body: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    htmlBody: string;
    textBody?: string;
    autoCc?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/admin/mail/generic`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `sendAdminGenericEmail failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async sendAdminNewsletter(body: any): Promise<any> {
    const r = await fetch(`${API_BASE}/admin/mail/newsletter`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `sendAdminNewsletter failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async sendAdminActivityReportReminders(body: any): Promise<any> {
    const r = await fetch(`${API_BASE}/admin/mail/activity-report-reminders`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `sendAdminActivityReportReminders failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async updateUser(body: UpdateUserBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/updateUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `updateUser failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async startLinkedInConnect(
    body?: StartLinkedInConnectBody
  ): Promise<StartLinkedInConnectResponse> {
    const r = await fetch(`${API_BASE}/integrations/linkedin/start`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `startLinkedInConnect failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      authorizeUrl: String(payload?.authorizeUrl || ""),
      returnTo: typeof payload?.returnTo === "string" ? payload.returnTo : undefined,
      scopes: Array.isArray(payload?.scopes) ? payload.scopes : undefined,
    };
  }

  async startLinkedInOrgConnect(
    body?: StartLinkedInConnectBody
  ): Promise<StartLinkedInConnectResponse> {
    const r = await fetch(`${API_BASE}/integrations/linkedin/org/start`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `startLinkedInOrgConnect failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      authorizeUrl: String(payload?.authorizeUrl || ""),
      returnTo: typeof payload?.returnTo === "string" ? payload.returnTo : undefined,
      scopes: Array.isArray(payload?.scopes) ? payload.scopes : undefined,
    };
  }

  async getLinkedInOrgStatus(): Promise<LinkedInOrgStatus> {
    const r = await fetch(`${API_BASE}/integrations/linkedin/org/status`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getLinkedInOrgStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async getLinkedInOrgPosts(limit = 12): Promise<LinkedInOrgPostsResponse> {
    const r = await fetch(`${API_BASE}/integrations/linkedin/org/posts?limit=${encodeURIComponent(String(limit))}`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getLinkedInOrgPosts failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      configured: Boolean(payload?.configured),
      items: Array.isArray(payload?.items) ? payload.items : [],
    };
  }

  async startDiscordConnect(
    body?: StartDiscordConnectBody
  ): Promise<StartDiscordConnectResponse> {
    const r = await fetch(`${API_BASE}/integrations/discord/start`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `startDiscordConnect failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      authorizeUrl: String(payload?.authorizeUrl || ""),
      returnTo: typeof payload?.returnTo === "string" ? payload.returnTo : undefined,
      joinUrl: typeof payload?.joinUrl === "string" ? payload.joinUrl : undefined,
      scopes: Array.isArray(payload?.scopes) ? payload.scopes : undefined,
    };
  }

  async getDiscordStatus(): Promise<DiscordStatusResponse> {
    const r = await fetch(`${API_BASE}/integrations/discord/status`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getDiscordStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async getDiscordWebhookStatus(): Promise<DiscordWebhookStatusResponse> {
    const r = await fetch(`${API_BASE}/integrations/discord/webhook/status`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (r.status === 404) {
      return {
        ok: false,
        configured: false,
        webhookConfigured: false,
      };
    }
    if (!r.ok) {
      throw new Error(
        `getDiscordWebhookStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async postDiscordWebhookMessage(
    body: DiscordWebhookPostBody
  ): Promise<DiscordWebhookPostResponse> {
    const r = await fetch(`${API_BASE}/integrations/discord/webhook/post`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `postDiscordWebhookMessage failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      delivered: Boolean(payload?.delivered),
      response: typeof payload?.response === "string" ? payload.response : undefined,
    };
  }

  async startJiraConnect(
    body?: StartJiraConnectBody
  ): Promise<StartJiraConnectResponse> {
    const r = await fetch(`${API_BASE}/integrations/jira/start`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `startJiraConnect failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      authorizeUrl: String(payload?.authorizeUrl || ""),
      returnTo: typeof payload?.returnTo === "string" ? payload.returnTo : undefined,
      redirectUri:
        typeof payload?.redirectUri === "string" ? payload.redirectUri : undefined,
      scopes: Array.isArray(payload?.scopes) ? payload.scopes : undefined,
    };
  }

  async getJiraConnectStatus(): Promise<JiraConnectStatusResponse> {
    const r = await fetch(`${API_BASE}/integrations/jira/status`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getJiraConnectStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      connected: Boolean(payload?.connected),
      accountId: typeof payload?.accountId === "string" ? payload.accountId : undefined,
      email: typeof payload?.email === "string" ? payload.email : undefined,
      cloudId: typeof payload?.cloudId === "string" ? payload.cloudId : undefined,
      cloudName: typeof payload?.cloudName === "string" ? payload.cloudName : undefined,
      cloudUrl: typeof payload?.cloudUrl === "string" ? payload.cloudUrl : undefined,
      scope: typeof payload?.scope === "string" ? payload.scope : undefined,
      connectedAt:
        typeof payload?.connectedAt === "string" ? payload.connectedAt : undefined,
      tokenExpiresAt:
        typeof payload?.tokenExpiresAt === "string"
          ? payload.tokenExpiresAt
          : undefined,
    };
  }

  async disconnectJira(): Promise<{ ok: boolean }> {
    const r = await fetch(`${API_BASE}/integrations/jira/disconnect`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `disconnectJira failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return { ok: Boolean(payload?.ok ?? true) };
  }

  async getAvailableAiAgents(): Promise<{
    ok: boolean;
    count: number;
    agents: Array<{
      agentId: string;
      name?: string;
      description?: string;
      allowedActions?: string[];
      approvalPolicy?: { mode?: string };
    }>;
  }> {
    const r = await fetch(`${API_BASE}/ai/agents/available`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getAvailableAiAgents failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      count: Number(payload?.count) || 0,
      agents: Array.isArray(payload?.agents) ? payload.agents : [],
    };
  }

  async requestAiAgentAccess(body: { agentId: string; reason?: string }): Promise<{ ok: boolean; request?: any }> {
    const r = await fetch(`${API_BASE}/ai/agent-access/request`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `requestAiAgentAccess failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      request: payload?.request,
    };
  }

  async getMyAiAgentAccessRequests(): Promise<{ ok: boolean; count: number; requests: any[] }> {
    const r = await fetch(`${API_BASE}/ai/agent-access/requests?status=all&limit=50`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getMyAiAgentAccessRequests failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      count: Number(payload?.count) || 0,
      requests: Array.isArray(payload?.requests) ? payload.requests : [],
    };
  }

  async getProjects(): Promise<ApiProject[]> {
    const r = await fetch(`${API_BASE}/projects`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getProjects failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiProject[];
    if (Array.isArray(payload?.items)) return payload.items as ApiProject[];
    return [];
  }

  async getJiraTickets(params?: {
    projectId?: string;
    weekStart?: string;
    assignee?: string;
    limit?: number;
  }): Promise<{
    ok: boolean;
    projectId?: string;
    jiraProjectKey?: string;
    assignee?: string;
    weekStart?: string;
    count: number;
    items: Array<{
      key: string;
      id?: string;
      summary?: string;
      status?: string;
      assignee?: string;
      updated?: string;
      url?: string;
    }>;
  }> {
    const qs = new URLSearchParams();
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.assignee) qs.set("assignee", params.assignee);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(Math.max(1, Math.floor(params.limit))));
    }
    const r = await fetch(`${API_BASE}/jira/tickets${qs.toString() ? `?${qs.toString()}` : ""}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getJiraTickets failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      projectId: payload?.projectId,
      jiraProjectKey: payload?.jiraProjectKey,
      assignee: payload?.assignee,
      weekStart: payload?.weekStart,
      count: Number(payload?.count) || 0,
      items: Array.isArray(payload?.items) ? payload.items : [],
    };
  }

  async validateJiraTicket(params: {
    ticketKey: string;
    projectId?: string;
  }): Promise<{
    ok: boolean;
    ticket?: {
      key: string;
      id?: string;
      summary?: string;
      status?: string;
      assignee?: string;
      updated?: string;
      url?: string;
    };
  }> {
    const qs = new URLSearchParams();
    qs.set("ticketKey", params.ticketKey);
    if (params?.projectId) qs.set("projectId", params.projectId);
    const r = await fetch(`${API_BASE}/jira/tickets/validate?${qs.toString()}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `validateJiraTicket failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      ticket: payload?.ticket,
    };
  }

  async saveProject(body: SaveProjectBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `saveProject failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async setProjectInactive(projectId: string): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ projectId, status: "inactive" }),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `setProjectInactive failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async getCustomers(): Promise<ApiCustomer[]> {
    const r = await fetch(`${API_BASE}/admin/customers`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getCustomers failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload?.items)) return payload.items as ApiCustomer[];
    if (Array.isArray(payload)) return payload as ApiCustomer[];
    return [];
  }

  async createCustomer(body: CreateCustomerBody): Promise<{ ok: true; customer_id: string }> {
    const r = await fetch(`${API_BASE}/admin/customers`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createCustomer failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { ok: true; customer_id: string };
  }

  async updateCustomer(customerId: string, body: UpdateCustomerBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}`, {
      method: "PATCH",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `updateCustomer failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async getCustomerFlow(customerId: string): Promise<CustomerFlowRow[]> {
    const r = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}/flow`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getCustomerFlow failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return Array.isArray(payload?.items) ? (payload.items as CustomerFlowRow[]) : [];
  }

  async createCustomerUser(customerId: string, body: CreateCustomerUserBody): Promise<{ ok: true; user_id: string }> {
    const r = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}/users`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createCustomerUser failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { ok: true; user_id: string };
  }

  async createCustomerFromEmployee(body: {
    username: string;
    customer_type?: "internal" | "test" | "final" | string;
    status?: "active" | "suspended" | "restricted" | string;
    password?: string;
    role?: "owner" | "admin" | "member" | string;
    user_status?: "active" | "disabled" | string;
  }): Promise<{ ok: true; customer_id: string; user_id: string }> {
    const r = await fetch(`${API_BASE}/admin/customers/from-employee`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createCustomerFromEmployee failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { ok: true; customer_id: string; user_id: string };
  }

  async upsertCustomerEntitlement(customerId: string, body: UpsertEntitlementBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/customers/${encodeURIComponent(customerId)}/entitlements`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `upsertCustomerEntitlement failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async getProductsAdmin(): Promise<ApiProduct[]> {
    const r = await fetch(`${API_BASE}/admin/products`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getProductsAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload?.items)) return payload.items as ApiProduct[];
    if (Array.isArray(payload)) return payload as ApiProduct[];
    return [];
  }

  async getInstagramStatus(): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/instagram/status`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getInstagramStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async getFacebookPageStatus(): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/facebook-page/status`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getFacebookPageStatus failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async saveInstagramConfig(body: {
    accessToken?: string;
    instagramAccessToken?: string;
    pageAccessToken?: string;
    pageToken?: string;
    accountId?: string;
    instagramAccountId?: string;
    pageId?: string;
    facebookPageId?: string;
    pageName?: string;
    tokenSource?: string;
    tokenExpiresAt?: string;
    metaUserAccessToken?: string;
    metaUserTokenExpiresAt?: string;
    graphVersion?: string;
    exchangeLongLived?: boolean;
    resolveFromPage?: boolean;
    resolveInstagramAccount?: boolean;
    dryRun?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/instagram/config`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `saveInstagramConfig failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async saveFacebookPageConfig(body: {
    accessToken?: string;
    facebookPageAccessToken?: string;
    pageAccessToken?: string;
    metaUserAccessToken?: string;
    metaUserTokenExpiresAt?: string;
    pageId?: string;
    facebookPageId?: string;
    pageName?: string;
    tokenSource?: string;
    tokenExpiresAt?: string;
    graphVersion?: string;
    exchangeLongLived?: boolean;
    resolveFromPage?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/facebook-page/config`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `saveFacebookPageConfig failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async refreshFacebookPageConfig(): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/facebook-page/refresh`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `refreshFacebookPageConfig failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async refreshInstagramConfig(): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/instagram/refresh`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `refreshInstagramConfig failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async getInstagramPosts(limit = 24): Promise<any> {
    const qs = new URLSearchParams();
    if (Number.isFinite(limit)) {
      qs.set("limit", String(Math.max(1, Math.min(100, Math.floor(limit)))));
    }
    const r = await fetch(
      `${API_BASE}/integrations/instagram/posts${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getInstagramPosts failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async getFacebookPagePosts(limit = 24): Promise<any> {
    const qs = new URLSearchParams();
    if (Number.isFinite(limit)) {
      qs.set("limit", String(Math.max(1, Math.min(100, Math.floor(limit)))));
    }
    const r = await fetch(
      `${API_BASE}/integrations/facebook-page/posts${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getFacebookPagePosts failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async publishInstagramPost(body: {
    caption?: string;
    message?: string;
    text?: string;
    imageUrl?: string;
    mediaUrl?: string;
    image_url?: string;
    media_url?: string;
    instagramAccountId?: string;
    instagramAccessToken?: string;
    graphVersion?: string;
    queue?: boolean;
    async?: boolean;
    dryRun?: boolean;
    preview?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/instagram/publish`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `publishInstagramPost failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async debugInstagramPublish(body: {
    caption?: string;
    message?: string;
    text?: string;
    imageUrl?: string;
    instagramAccountId?: string;
    instagramAccessToken?: string;
    graphVersion?: string;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/instagram/publish/debug`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `debugInstagramPublish failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async publishFacebookPagePost(body: {
    caption?: string;
    message?: string;
    text?: string;
    imageUrl?: string;
    mediaUrl?: string;
    image_url?: string;
    media_url?: string;
    facebookPageId?: string;
    pageId?: string;
    facebookPageAccessToken?: string;
    pageAccessToken?: string;
    accessToken?: string;
    graphVersion?: string;
    dryRun?: boolean;
    preview?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/integrations/facebook-page/publish`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `publishFacebookPagePost failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload;
  }

  async submitSocialPost(body: {
    title?: string;
    content?: string;
    caption?: string;
    message?: string;
    imageUrl?: string;
    image_url?: string;
    channels?: string[];
    scheduledAt?: string;
    reviewerUsernames?: string[];
    internalReviewNote?: string;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`submitSocialPost failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async updateSocialPost(body: {
    postId?: string;
    post_id?: string;
    title?: string;
    content?: string;
    caption?: string;
    message?: string;
    imageUrl?: string;
    image_url?: string;
    channels?: string[];
    reviewerUsernames?: string[];
    internalReviewNote?: string;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`updateSocialPost failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async getMySocialPosts(): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/me`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getMySocialPosts failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async getSocialPosts(): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getSocialPosts failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async getSocialPostsOrg(): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/org`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getSocialPostsOrg failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async reviewSocialPost(body: {
    postId?: string;
    decision?: string;
    reviewNote?: string;
    scheduledAt?: string;
    title?: string;
    content?: string;
    caption?: string;
    imageUrl?: string;
    image_url?: string;
    channels?: string[];
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/review`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`reviewSocialPost failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async addSocialPostComment(body: {
    postId?: string;
    post_id?: string;
    comment?: string;
    text?: string;
    reviewNote?: string;
    note?: string;
    requestEdits?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/comment`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`addSocialPostComment failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async retrySocialPostChannel(body: { postId?: string; post_id?: string; channel?: string }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/retry-channel`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`retrySocialPostChannel failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async adminUpdateScheduledSocialPost(body: {
    postId?: string;
    post_id?: string;
    title?: string;
    content?: string;
    caption?: string;
    message?: string;
    imageUrl?: string;
    image_url?: string;
    channels?: string[];
    scheduledAt?: string;
    scheduled_at?: string;
    cancelSchedule?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/admin-update`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`adminUpdateScheduledSocialPost failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async toggleSocialPostTodo(body: {
    postId?: string;
    post_id?: string;
    todoId?: string;
    todo_id?: string;
    done?: boolean;
  }): Promise<any> {
    const r = await fetch(`${API_BASE}/social-posts/todo`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`toggleSocialPostTodo failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload;
  }

  async getNotifications(params?: {
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
  }): Promise<{ ok: boolean; items: any[]; nextCursor?: string | null; unreadCount?: number }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.unreadOnly) query.set("unreadOnly", "true");
    const qs = query.toString();
    const r = await fetch(`${API_BASE}/notifications${qs ? `?${qs}` : ""}`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getNotifications failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; items: any[]; nextCursor?: string | null; unreadCount?: number };
  }

  async getNotificationUnreadCount(): Promise<{ ok: boolean; unreadCount: number }> {
    const r = await fetch(`${API_BASE}/notifications/unread-count`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getNotificationUnreadCount failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; unreadCount: number };
  }

  async markNotificationsRead(body: {
    notificationId?: string;
    notification_id?: string;
    notificationIds?: string[];
    all?: boolean;
  }): Promise<{ ok: boolean; unreadCount?: number }> {
    const r = await fetch(`${API_BASE}/notifications/read`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`markNotificationsRead failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; unreadCount?: number };
  }

  async getNotificationPreferences(): Promise<{ ok: boolean; preferences: any }> {
    const r = await fetch(`${API_BASE}/notifications/preferences`, {
      method: "GET",
      headers: this.headers(true),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`getNotificationPreferences failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; preferences: any };
  }

  async updateNotificationPreferences(body: { preferences: any }): Promise<{ ok: boolean; preferences: any }> {
    const r = await fetch(`${API_BASE}/notifications/preferences`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`updateNotificationPreferences failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; preferences: any };
  }

  async getEmployeeCustomerDownloads(): Promise<{ customer: any; entitlements: any[]; items: any[] }> {
    const r = await fetch(`${API_BASE}/customer/employee/downloads`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getEmployeeCustomerDownloads failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { customer: any; entitlements: any[]; items: any[] };
  }

  async syncProductFromProject(body: {
    project_id: string;
    product_id?: string;
    name: string;
    release_status: "internal" | "candidate" | "released" | string;
    channel?: "alpha" | "beta" | "stable" | string;
    platform?: string;
    status?: "active" | "archived" | string;
  }): Promise<{ ok: true; product_id: string }> {
    const r = await fetch(`${API_BASE}/admin/products/sync-from-project`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `syncProductFromProject failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { ok: true; product_id: string };
  }

  async getUpdates(params?: {
    weekStart?: string;
    submittedWeekStart?: string;
    projectId?: string;
    userId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ApiUpdatesResponse> {
    const qs = new URLSearchParams();
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.submittedWeekStart) qs.set("submittedWeekStart", params.submittedWeekStart);
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (params?.userId) qs.set("userId", params.userId);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(Math.max(1, Math.floor(params.limit))));
    }
    if (params?.cursor) qs.set("cursor", params.cursor);

    const url = `${API_BASE}/updates${qs.toString() ? `?${qs.toString()}` : ""}`;

    const r = await fetch(url, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getUpdates failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      summaries: Array.isArray(payload?.summaries) ? payload.summaries : [],
      count: Number(payload?.count) || 0,
      summaryCount: Number(payload?.summaryCount) || 0,
      submitDates: Array.isArray(payload?.submitDates) ? payload.submitDates : undefined,
      submitDateCount: typeof payload?.submitDateCount === "number" ? payload.submitDateCount : undefined,
      limit: Number(payload?.limit) || undefined,
      cursor: typeof payload?.cursor === "string" ? payload.cursor : undefined,
      nextCursor: typeof payload?.nextCursor === "string" ? payload.nextCursor : null,
    };
  }

  async getMyUpdates(params?: {
    weekStart?: string;
    projectId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ApiMyUpdatesResponse> {
    const qs = new URLSearchParams();
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(Math.max(1, Math.floor(params.limit))));
    }
    if (params?.cursor) qs.set("cursor", params.cursor);

    const url = `${API_BASE}/updates/me${qs.toString() ? `?${qs.toString()}` : ""}`;

    const r = await fetch(url, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getMyUpdates failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      summaries: Array.isArray(payload?.summaries) ? payload.summaries : [],
      summaryCount: Number(payload?.summaryCount) || 0,
      limit: Number(payload?.limit) || undefined,
      cursor: typeof payload?.cursor === "string" ? payload.cursor : undefined,
      nextCursor: typeof payload?.nextCursor === "string" ? payload.nextCursor : null,
    };
  }

  async createWeeklyUpdateUploadUrls(
    body: CreateWeeklyUpdateUploadUrlsBody
  ): Promise<CreateWeeklyUpdateUploadUrlsResponse> {
    const r = await fetch(`${API_BASE}/updates/upload-urls`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createWeeklyUpdateUploadUrls failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      files: Array.isArray(payload?.files) ? payload.files : [],
    };
  }

  async listStorageFiles(params?: {
    prefix?: string;
    continuationToken?: string;
    limit?: number;
  }): Promise<ListStorageFilesResponse> {
    const qs = new URLSearchParams();
    if (params?.prefix) qs.set("prefix", params.prefix);
    if (params?.continuationToken) qs.set("continuationToken", params.continuationToken);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(params.limit));
    }
    const r = await fetch(`${API_BASE}/updates/storage-files${qs.toString() ? `?${qs.toString()}` : ""}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `listStorageFiles failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      bucket: typeof payload?.bucket === "string" ? payload.bucket : undefined,
      prefix: typeof payload?.prefix === "string" ? payload.prefix : undefined,
      limit: Number(payload?.limit) || undefined,
      items: Array.isArray(payload?.items) ? payload.items : [],
      truncated: Boolean(payload?.truncated),
      nextContinuationToken:
        typeof payload?.nextContinuationToken === "string"
          ? payload.nextContinuationToken
          : undefined,
    };
  }

  async deleteStorageFile(body: { s3Key?: string }): Promise<DeleteStorageFileResponse> {
    const r = await fetch(`${API_BASE}/updates/storage-files/delete`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body || {}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `deleteStorageFile failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      deletedS3Key: typeof payload?.deletedS3Key === "string" ? payload.deletedS3Key : undefined,
      bucket: typeof payload?.bucket === "string" ? payload.bucket : undefined,
    };
  }

  async getWeeklyUpdateAttachmentUrl(params: {
    s3Key: string;
    userId?: string;
    weekStart?: string;
  }): Promise<{ ok: boolean; url: string; expiresIn?: number }> {
    const qs = new URLSearchParams();
    qs.set("s3Key", params.s3Key);
    if (params.userId) qs.set("userId", params.userId);
    if (params.weekStart) qs.set("weekStart", params.weekStart);

    const r = await fetch(`${API_BASE}/updates/attachment-url?${qs.toString()}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getWeeklyUpdateAttachmentUrl failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      url: String(payload?.url || ""),
      expiresIn: Number(payload?.expiresIn) || undefined,
    };
  }

  async submitUpdate(body: SubmitUpdateBody): Promise<SubmitUpdateResponse> {
    const r = await fetch(`${API_BASE}/updates/submit`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `submitUpdate failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: Boolean(payload?.ok ?? true),
      id: payload?.id,
      uploadStatus: payload?.uploadStatus,
      driveFolderId: payload?.driveFolderId,
      driveFolderLink: payload?.driveFolderLink,
      attachments: Array.isArray(payload?.attachments) ? payload.attachments : [],
      message: payload?.message,
    };
  }

  async submitTimeLog(
    body: SubmitTimeLogBody
  ): Promise<{ ok: true; id?: string; weekStart?: string; durationMinutes?: number }> {
    const r = await fetch(`${API_BASE}/timelogs`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `submitTimeLog failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return {
      ok: true,
      id: payload?.id,
      weekStart: payload?.weekStart,
      durationMinutes: payload?.durationMinutes,
    };
  }

  async getMyTimeLogs(params?: {
    weekStart?: string;
    projectId?: string;
  }): Promise<{
    items: ApiTimeLogRow[];
    count: number;
    totalMinutes: number;
    totalHours: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.projectId) qs.set("projectId", params.projectId);

    const url = `${API_BASE}/timelogs/me${qs.toString() ? `?${qs.toString()}` : ""}`;

    const r = await fetch(url, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getMyTimeLogs failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      items: Array.isArray(payload?.items) ? payload.items : [],
      count: Number(payload?.count) || 0,
      totalMinutes: Number(payload?.totalMinutes) || 0,
      totalHours: Number(payload?.totalHours) || 0,
    };
  }

  async getApplicants(): Promise<ApiApplicantListItem[]> {
    const r = await fetch(`${API_BASE}/admin/applicants`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getApplicants failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    const list =
      (Array.isArray(payload) && payload) ||
      (Array.isArray(payload?.items) && payload.items) ||
      (Array.isArray(payload?.Items) && payload.Items) ||
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(payload?.records) && payload.records) ||
      [];

    return list as ApiApplicantListItem[];
  }

  async getApplicantsPage(params?: {
    limit?: number;
    cursor?: string;
    query?: string;
    pipeline?: string;
    role?: string;
    gender?: string;
    dateFrom?: string;
    dateTo?: string;
    sortKey?: string;
    sortDir?: string;
  }): Promise<ApiApplicantPageResponse> {
    const qs = new URLSearchParams();
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(Math.max(1, Math.floor(params.limit))));
    }
    if (params?.cursor) qs.set("cursor", params.cursor);
    if (params?.query) qs.set("q", params.query);
    if (params?.pipeline) qs.set("pipeline", params.pipeline);
    if (params?.role) qs.set("role", params.role);
    if (params?.gender) qs.set("gender", params.gender);
    if (params?.dateFrom) qs.set("dateFrom", params.dateFrom);
    if (params?.dateTo) qs.set("dateTo", params.dateTo);
    if (params?.sortKey) qs.set("sortKey", params.sortKey);
    if (params?.sortDir) qs.set("sortDir", params.sortDir);

    const url = `${API_BASE}/admin/applicants${qs.toString() ? `?${qs.toString()}` : ""}`;

    const r = await fetch(url, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getApplicantsPage failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    const items =
      (Array.isArray(payload?.items) && payload.items) ||
      (Array.isArray(payload?.Items) && payload.Items) ||
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(payload?.records) && payload.records) ||
      (Array.isArray(payload) && payload) ||
      [];

    return {
      items: items as ApiApplicantListItem[],
      count: Number(payload?.count) || items.length,
      limit: Number(payload?.limit) || undefined,
      cursor: typeof payload?.cursor === "string" ? payload.cursor : undefined,
      nextCursor: typeof payload?.nextCursor === "string" ? payload.nextCursor : null,
      roleOptions: Array.isArray(payload?.roleOptions) ? payload.roleOptions.map(String) : undefined,
      genderOptions: Array.isArray(payload?.genderOptions) ? payload.genderOptions.map(String) : undefined,
    };
  }

  async getApplicantById(applicantId: string): Promise<ApiApplicantDetails> {
    const r = await fetch(
      `${API_BASE}/admin/applicants/${encodeURIComponent(applicantId)}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getApplicantById failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiApplicantDetails;
  }

  async sendApplicantRichEmail(
    applicantId: string,
    body: SendApplicantRichEmailBody
  ): Promise<any> {
    const r = await fetch(
      `${API_BASE}/admin/applicants/${encodeURIComponent(applicantId)}/send-rich-email`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload;
  }

  async sendApplicantDocEmail(
    applicantId: string,
    body: SendApplicantDocEmailBody
  ): Promise<any> {
    const r = await fetch(
      `${API_BASE}/admin/applicants/${encodeURIComponent(applicantId)}/send-doc-email`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload;
  }

  async sendApplicantWelcomeEmail(
    applicantId: string,
    body: SendApplicantWelcomeEmailBody
  ): Promise<any> {
    const resolvedExtra =
      body.extraInfo ||
      (body.vars as any)?.extraInfo ||
      (body.vars as any)?.EXTRA_INFO ||
      (body.vars as any)?.DOC_NOTES ||
      (body.vars as any)?.WELCOME_NOTES ||
      undefined;

    const finalBody: SendApplicantWelcomeEmailBody = {
      ...body,
      applicantId: body.applicantId || applicantId,
      extraInfo: resolvedExtra,
      vars: {
        ...(body.vars || {}),
        APPLICANT_ID: (body.vars as any)?.APPLICANT_ID || applicantId,
        ...(resolvedExtra
          ? {
              extraInfo: resolvedExtra,
              EXTRA_INFO: resolvedExtra,
              DOC_NOTES: resolvedExtra,
              WELCOME_NOTES: resolvedExtra,
            }
          : {}),
      },
    };

    const r = await fetch(
      `${API_BASE}/admin/applicants/${encodeURIComponent(applicantId)}/send-welcome-email`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(finalBody),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload;
  }

  async sendEmployeeDocEmail(
    username: string,
    body: SendEmployeeDocEmailBody
  ): Promise<any> {
    const r = await fetch(
      `${API_BASE}/admin/employees/${encodeURIComponent(username)}/send-doc-email`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload;
  }

  async previewEmployeeRecommendation(
    username: string,
    body: {
      roleTitle?: string;
      coreSkills?: string;
      peopleSkills?: string;
      wordCount?: number | string;
      vars?: Record<string, any>;
    }
  ): Promise<any> {
    const r = await fetch(
      `${API_BASE}/admin/employees/${encodeURIComponent(username)}/preview-recommendation`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body || {}),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload;
  }

  async listJobsAdmin(): Promise<ApiJob[]> {
    const r = await fetch(`${API_BASE}/admin/jobs`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `listJobsAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiJob[];
    if (Array.isArray(payload?.items)) return payload.items as ApiJob[];
    return [];
  }

  async getQuestionBank(): Promise<QuestionBank> {
    const r = await fetch(`${API_BASE}/admin/jobs/question-bank`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getQuestionBank failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return (payload || { general: [], personal: [] }) as QuestionBank;
  }

  async saveQuestionBank(body: SaveQuestionBankBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/jobs/question-bank`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `saveQuestionBank failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async upsertJobAdmin(
    body: UpsertJobBody
  ): Promise<{ ok: true; jobId?: string }> {
    const r = await fetch(`${API_BASE}/admin/jobs/upsert`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `upsertJobAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return { ok: true, jobId: payload?.jobId || payload?.id || body?.jobId };
  }

  async setJobStatusAdmin(
    jobId: string,
    body: SetJobStatusBody
  ): Promise<{ ok: true }> {
    const r = await fetch(
      `${API_BASE}/admin/jobs/${encodeURIComponent(jobId)}/status`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `setJobStatusAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async deleteJobAdmin(jobId: string): Promise<{ ok: true }> {
    const r = await fetch(
      `${API_BASE}/admin/jobs/${encodeURIComponent(jobId)}/delete`,
      {
        method: "POST",
        headers: this.headers(true),
        body: JSON.stringify({ jobId }),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `deleteJobAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async listJobsPublic(): Promise<ApiJob[]> {
    const r = await fetch(`${API_BASE}/jobs`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `listJobsPublic failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiJob[];
    if (Array.isArray(payload?.items)) return payload.items as ApiJob[];
    return [];
  }

  /* ===================== */
  /* Awards / Gamification */
  /* ===================== */

  async getAwardAchievementRules(): Promise<ApiAwardRuleAchievement[]> {
    const r = await fetch(`${API_BASE}/gamification/rules/achievements`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getAwardAchievementRules failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiAwardRuleAchievement[];
    if (Array.isArray(payload?.items)) return payload.items as ApiAwardRuleAchievement[];
    return [];
  }

  async createAwardAchievementRule(
    body: CreateAwardAchievementRuleBody
  ): Promise<ApiAwardRuleAchievement> {
    const r = await fetch(`${API_BASE}/gamification/rules/achievements`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createAwardAchievementRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiAwardRuleAchievement;
  }

  async updateAwardAchievementRule(
    ruleId: string,
    body: UpdateAwardAchievementRuleBody
  ): Promise<ApiAwardRuleAchievement> {
    const r = await fetch(
      `${API_BASE}/gamification/rules/achievements/${encodeURIComponent(ruleId)}`,
      {
        method: "PUT",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `updateAwardAchievementRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiAwardRuleAchievement;
  }

  async deleteAwardAchievementRule(
    ruleId: string
  ): Promise<DeleteAwardAchievementRuleResponse> {
    const r = await fetch(
      `${API_BASE}/gamification/rules/achievements/${encodeURIComponent(ruleId)}`,
      {
        method: "DELETE",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `deleteAwardAchievementRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as DeleteAwardAchievementRuleResponse;
  }

  async getAwardTrophyRules(): Promise<ApiAwardRuleTrophy[]> {
    const r = await fetch(`${API_BASE}/gamification/rules/trophies`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getAwardTrophyRules failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    if (Array.isArray(payload)) return payload as ApiAwardRuleTrophy[];
    if (Array.isArray(payload?.items)) return payload.items as ApiAwardRuleTrophy[];
    return [];
  }

  async createAwardTrophyRule(
    body: CreateAwardTrophyRuleBody
  ): Promise<ApiAwardRuleTrophy> {
    const r = await fetch(`${API_BASE}/gamification/rules/trophies`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `createAwardTrophyRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiAwardRuleTrophy;
  }

  async updateAwardTrophyRule(
    ruleId: string,
    body: UpdateAwardTrophyRuleBody
  ): Promise<ApiAwardRuleTrophy> {
    const r = await fetch(
      `${API_BASE}/gamification/rules/trophies/${encodeURIComponent(ruleId)}`,
      {
        method: "PUT",
        headers: this.headers(true),
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `updateAwardTrophyRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiAwardRuleTrophy;
  }

  async deleteAwardTrophyRule(
    ruleId: string
  ): Promise<DeleteAwardTrophyRuleResponse> {
    const r = await fetch(
      `${API_BASE}/gamification/rules/trophies/${encodeURIComponent(ruleId)}`,
      {
        method: "DELETE",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `deleteAwardTrophyRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as DeleteAwardTrophyRuleResponse;
  }

  async getMvpRule(): Promise<ApiMvpRule> {
    const r = await fetch(`${API_BASE}/gamification/rules/mvp`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getMvpRule failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as ApiMvpRule;
  }

  async getProgressAdmin(username: string): Promise<GetProgressAdminResponse> {
    const r = await fetch(
      `${API_BASE}/awards/progress?username=${encodeURIComponent(username)}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getProgressAdmin failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as GetProgressAdminResponse;
  }

  async getAllProgress(): Promise<GetAllProgressResponse> {
    const r = await fetch(`${API_BASE}/awards/progress/all`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getAllProgress failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      ...payload,
      items: Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [],
      count:
        Number(payload?.count) ||
        (Array.isArray(payload?.items) ? payload.items.length : Array.isArray(payload) ? payload.length : 0),
    } as GetAllProgressResponse;
  }

  async getAllProgressSummary(): Promise<GetAllProgressSummaryResponse> {
    const r = await fetch(`${API_BASE}/awards/progress/summary/all`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getAllProgressSummary failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      ...payload,
      items: Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [],
      count:
        Number(payload?.count) ||
        (Array.isArray(payload?.items) ? payload.items.length : Array.isArray(payload) ? payload.length : 0),
    } as GetAllProgressSummaryResponse;
  }

  async getStudioSummary(weekStart?: string): Promise<GetStudioSummaryResponse> {
    const qs = new URLSearchParams();
    if (weekStart) qs.set("weekStart", weekStart);

    const r = await fetch(
      `${API_BASE}/awards/summary/studio${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getStudioSummary failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as GetStudioSummaryResponse;
  }

  async getRecentAwards(params?: {
    limit?: number;
    weekStart?: string;
  }): Promise<GetRecentAwardsResponse> {
    const qs = new URLSearchParams();
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
      qs.set("limit", String(Math.max(1, Math.floor(params.limit))));
    }
    if (params?.weekStart) qs.set("weekStart", params.weekStart);

    const r = await fetch(
      `${API_BASE}/awards/recent${qs.toString() ? `?${qs.toString()}` : ""}`,
      {
        method: "GET",
        headers: this.headers(false),
      }
    );
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getRecentAwards failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      ...payload,
      items: Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
        ? payload
        : [],
      count:
        Number(payload?.count) ||
        (Array.isArray(payload?.items) ? payload.items.length : Array.isArray(payload) ? payload.length : 0),
      limit: Number(payload?.limit) || (typeof params?.limit === "number" ? params.limit : undefined),
      weekStart: payload?.weekStart || params?.weekStart,
    } as GetRecentAwardsResponse;
  }

  async awardAchievement(
    body: AwardAchievementBody
  ): Promise<AwardAchievementResponse> {
    const r = await fetch(`${API_BASE}/awards/achievement`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `awardAchievement failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as AwardAchievementResponse;
  }

  async awardTrophy(body: AwardTrophyBody): Promise<AwardTrophyResponse> {
    const r = await fetch(`${API_BASE}/awards/trophy`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `awardTrophy failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as AwardTrophyResponse;
  }

  async setWeeklyMvpManual(
    body: SetWeeklyMvpManualBody
  ): Promise<SetWeeklyMvpManualResponse> {
    const r = await fetch(`${API_BASE}/awards/weekly-mvp`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `setWeeklyMvpManual failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as SetWeeklyMvpManualResponse;
  }

  async autoAwardWeeklyMvp(
    body: AutoAwardWeeklyMvpBody
  ): Promise<AutoAwardWeeklyMvpResponse> {
    const r = await fetch(`${API_BASE}/awards/weekly-mvp/auto`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `autoAwardWeeklyMvp failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as AutoAwardWeeklyMvpResponse;
  }

  async generateAwardsNarrative(
    body: GenerateAwardsNarrativeBody
  ): Promise<GenerateAwardsNarrativeResponse> {
    const defaultAgent = this.resolveDefaultAgentEmployee("internal");
    const finalBody = {
      question:
        body.question ||
        "Create a polished narrative about how the studio functions, the culture of the team, and the awards and recognition the team has been earning.",
      username: body.username,
      weekStart: body.weekStart,
      projectId: body.projectId,
      provider: body.provider,
      model: body.model,
      context: "internal",
      agentEmployeeId: defaultAgent.agentEmployeeId,
      agentRole: defaultAgent.agentRole,
    };

    const r = await fetch(`${API_BASE}/ai/chat-sync/internal`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(finalBody),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `generateAwardsNarrative failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as GenerateAwardsNarrativeResponse;
  }

  async chatOverUpdates(body: {
    question: string;
    username?: string;
    weekStart?: string;
    projectId?: string;
    provider?: "auto" | "openai" | "ollama";
    model?: string;
    context?: string;
    agentRole?: string;
    agentEmployeeId?: string;
    agentId?: string;
    perform?: boolean;
    mcpAction?:
      | "upsert_job"
      | "send_email"
      | "submit_weekly_update"
      | "search_jira_issues"
      | "get_issue_details"
      | "transition_issue"
      | "add_comment"
      | string;
    mcpInputMode?: "override" | "auto";
    mcpInput?: Record<string, any>;
  }): Promise<GenerateAwardsNarrativeResponse> {
    const context = body.context || "internal";
    const defaultAgent = this.resolveDefaultAgentEmployee(context);
    const requestBody = {
      ...body,
      context,
      agentEmployeeId:
        body.agentEmployeeId || body.agentId || defaultAgent.agentEmployeeId,
      agentRole: body.agentRole || defaultAgent.agentRole,
    };

    const r = await fetch(`${API_BASE}/ai/chat-sync/${context}`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(requestBody),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `chatOverUpdates failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as GenerateAwardsNarrativeResponse;
  }

  async submitInternalIntake(body: {
    contextKey: string;
    answers?: Record<string, string>;
    transcript?: string;
    feedback?: Record<string, any> | null;
  }): Promise<{ ok: boolean; emailSent?: boolean }> {
    const r = await fetch(`${API_BASE}/ai/intake/submit-internal`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(`submitInternalIntake failed: ${this.extractErrorMessage(payload, r.status)}`);
    }
    return payload as { ok: boolean; emailSent?: boolean };
  }

  /* ===================== */
  /* Analytics             */
  /* ===================== */

  async getAnalyticsDashboard(
    query?: AnalyticsQuery
  ): Promise<AnalyticsDashboardResponse> {
    return this.getAnalytics<AnalyticsDashboardResponse>(
      "/analytics/dashboard",
      query
    );
  }

  async getAnalyticsWeeklyCompliance(
    query?: AnalyticsQuery
  ): Promise<AnalyticsWeeklyComplianceResponse> {
    return this.getAnalytics<AnalyticsWeeklyComplianceResponse>(
      "/analytics/weekly-compliance",
      query
    );
  }

  async getAnalyticsSubmissionStatus(
    query?: AnalyticsQuery
  ): Promise<AnalyticsWeeklySubmissionResponse> {
    return this.getAnalytics<AnalyticsWeeklySubmissionResponse>(
      "/analytics/submission-status",
      query
    );
  }

  async getAnalyticsMissingUpdates(
    query?: AnalyticsQuery
  ): Promise<AnalyticsMissingListResponse> {
    return this.getAnalytics<AnalyticsMissingListResponse>(
      "/analytics/missing-updates",
      query
    );
  }

  async getAnalyticsMissingTimesheets(
    query?: AnalyticsQuery
  ): Promise<AnalyticsMissingListResponse> {
    return this.getAnalytics<AnalyticsMissingListResponse>(
      "/analytics/missing-timesheets",
      query
    );
  }

  async getAnalyticsUnderReportedHours(
    query?: AnalyticsQuery
  ): Promise<AnalyticsUnderReportedResponse> {
    return this.getAnalytics<AnalyticsUnderReportedResponse>(
      "/analytics/under-reported-hours",
      query
    );
  }

  async getAnalyticsNoActivity(
    query?: AnalyticsQuery
  ): Promise<AnalyticsMissingListResponse> {
    return this.getAnalytics<AnalyticsMissingListResponse>(
      "/analytics/no-activity",
      query
    );
  }

  async getAnalyticsProjectBreakdown(
    query?: AnalyticsQuery
  ): Promise<AnalyticsProjectBreakdownResponse> {
    return this.getAnalytics<AnalyticsProjectBreakdownResponse>(
      "/analytics/project-breakdown",
      query
    );
  }

  async getAnalyticsContributorBreakdown(
    query?: AnalyticsQuery
  ): Promise<AnalyticsContributorBreakdownResponse> {
    return this.getAnalytics<AnalyticsContributorBreakdownResponse>(
      "/analytics/contributor-breakdown",
      query
    );
  }

  async getAnalyticsTeamOverview(
    query?: AnalyticsQuery
  ): Promise<AnalyticsTeamOverviewResponse> {
    return this.getAnalytics<AnalyticsTeamOverviewResponse>(
      "/analytics/team-overview",
      query
    );
  }

  analytics = {
    getDashboard: (query?: AnalyticsQuery) => this.getAnalyticsDashboard(query),
    getWeeklyCompliance: (query?: AnalyticsQuery) =>
      this.getAnalyticsWeeklyCompliance(query),
    getSubmissionStatus: (query?: AnalyticsQuery) =>
      this.getAnalyticsSubmissionStatus(query),
    getMissingUpdates: (query?: AnalyticsQuery) =>
      this.getAnalyticsMissingUpdates(query),
    getMissingTimesheets: (query?: AnalyticsQuery) =>
      this.getAnalyticsMissingTimesheets(query),
    getUnderReportedHours: (query?: AnalyticsQuery) =>
      this.getAnalyticsUnderReportedHours(query),
    getNoActivity: (query?: AnalyticsQuery) =>
      this.getAnalyticsNoActivity(query),
    getProjectBreakdown: (query?: AnalyticsQuery) =>
      this.getAnalyticsProjectBreakdown(query),
    getContributorBreakdown: (query?: AnalyticsQuery) =>
      this.getAnalyticsContributorBreakdown(query),
    getTeamOverview: (query?: AnalyticsQuery) =>
      this.getAnalyticsTeamOverview(query),
  };

  async getEndpointCatalog(): Promise<GetEndpointCatalogResponse> {
    const r = await fetch(`${API_BASE}/admin/endpoints`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `getEndpointCatalog failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }

    return {
      ok: Boolean(payload?.ok ?? true),
      count: Number(payload?.count) || (Array.isArray(payload?.endpoints) ? payload.endpoints.length : 0),
      endpoints: Array.isArray(payload?.endpoints) ? payload.endpoints : [],
    };
  }

  async updateEndpointAccess(
    body: UpdateEndpointAccessBody
  ): Promise<UpdateEndpointAccessResponse> {
    const r = await fetch(`${API_BASE}/admin/endpoints/access`, {
      method: "PUT",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `updateEndpointAccess failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as UpdateEndpointAccessResponse;
  }

  async syncEndpointCatalogNow(): Promise<{ ok: boolean; result?: any }> {
    const r = await fetch(`${API_BASE}/admin/endpoints/sync-now`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({}),
    });
    const payload = await this.readJson(r);
    if (!r.ok) {
      throw new Error(
        `syncEndpointCatalogNow failed: ${this.extractErrorMessage(payload, r.status)}`
      );
    }
    return payload as { ok: boolean; result?: any };
  }

  async generateCalendlySchedulingLink(body: {
    name?: string;
    contactEmail?: string;
    contactName?: string;
  }): Promise<{ ok: boolean; schedulingUrl: string; name: string }> {
    const r = await fetch(`${API_BASE}/integrations/calendly/scheduling-link`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(this.extractErrorMessage(payload, r.status));
    return payload as { ok: boolean; schedulingUrl: string; name: string };
  }
}

export const api = new ApiClient();
