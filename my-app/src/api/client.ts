import { API_BASE } from "./config";
import type {
  ApiApplicantDetails,
  ApiApplicantListItem,
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

  private headers(isJson = true): HeadersInit {
    const h: Record<string, string> = {
      Accept: "*/*",
      Connection: "keep-alive",
      "X-Platform": this.platform,
    };
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
      headers: this.headers(true),
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
      scopes: Array.isArray(payload?.scopes) ? payload.scopes : undefined,
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
}

export const api = new ApiClient();
