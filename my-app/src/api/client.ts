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
} from "./types";

export class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private headers(isJson = true): HeadersInit {
    const h: Record<string, string> = {
      Accept: "*/*",
      Connection: "keep-alive",
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

  async login(username: string, password: string): Promise<ApiLoginResponse> {
    const body = JSON.stringify({ username: username.trim(), password });
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
        `setProjectInactive failed: ${this.extractErrorMessage(
          payload,
          r.status
        )}`
      );
    }
    return payload?.ok ? payload : { ok: true };
  }

  async getUpdates(params?: {
    weekStart?: string;
    projectId?: string;
    userId?: string;
  }): Promise<ApiUpdatesResponse> {
    const qs = new URLSearchParams();
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.projectId) qs.set("projectId", params.projectId);
    if (params?.userId) qs.set("userId", params.userId);

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
    };
  }

  async getMyUpdates(params?: {
    weekStart?: string;
    projectId?: string;
  }): Promise<ApiMyUpdatesResponse> {
    const qs = new URLSearchParams();
    if (params?.weekStart) qs.set("weekStart", params.weekStart);
    if (params?.projectId) qs.set("projectId", params.projectId);

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
        `createWeeklyUpdateUploadUrls failed: ${this.extractErrorMessage(
          payload,
          r.status
        )}`
      );
    }
    return {
      files: Array.isArray(payload?.files) ? payload.files : [],
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
}

export const api = new ApiClient();