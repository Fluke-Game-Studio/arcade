// src/api.ts

//-----------------------------------------------------
// LOGIN / USER TYPES
//-----------------------------------------------------

export type ApiLoginResponse = {
  token: string;
  expiresIn: number;
  username: string;
  role: "super" | "admin" | "employee";
  name: string;
};

export type ApiUser = {
  username: string;
  employee_name?: string;
  employee_email?: string;
  employee_title?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_phonenumber?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: "super" | "admin" | "employee";
  project_id?: string;
  employee_manager?: string;

  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;

  [k: string]: any;
};

export type CreateUserBody = {
  username: string;
  password: string;
  employee_name?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_phonenumber?: string;
  employee_email?: string;
  employee_title?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role?: "super" | "admin" | "employee";
  project_id?: string;
  employee_manager?: string;
};

export type UpdateUserBody = Partial<CreateUserBody> & {
  username: string;
  employee_last_update_week?: string;
  employee_last_update_hours?: string;
  employee_last_update_summary?: string;
};

//-----------------------------------------------------
// PROJECT TYPES
//-----------------------------------------------------

export type ApiProject = {
  projectId: string;
  name: string;
  slug?: string;
  description?: string;
  project_owner?: string;
  project_producer?: string;
  project_budget_total?: number | string;
  project_budget_consumed?: number | string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  last_activity_at?: string;
  [k: string]: any;
};

export type SaveProjectBody = {
  projectId?: string; // if provided → update, else create
  name: string;
  description?: string;
  project_owner?: string;
  project_producer?: string;
  project_budget_total?: string | number;
  project_budget_consumed?: string | number;
  status?: string;
};

//-----------------------------------------------------
// LEGACY WEEKLY UPDATE TYPES (kept for compatibility)
//-----------------------------------------------------

export type ApiWeeklyUpdate = {
  updateId: string;
  projectId: string;
  employee_id: string;
  weekOf: string;
  accomplishments?: string[];
  blockers?: string[];
  nextWeek?: string[];
  createdAt?: string;
  [k: string]: any;
};

export type SaveWeeklyBody = {
  updateId?: string;
  projectId: string;
  employee_id: string;
  weekOf: string;
  accomplishments?: string[];
  blockers?: string[];
  nextWeek?: string[];
};

//-----------------------------------------------------
// NEW SNAPSHOT WEEKLY UPDATE TYPES (for Retro/Report)
//-----------------------------------------------------

export type ApiUpdateRow = {
  id: string;
  userId: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId: string;
  weekStart: string;
  accomplishments?: string;
  blockers?: string;
  next?: string;
  retrospective?: any;
  timesheet?: any;
  createdAt?: string;
  [k: string]: any;
};

export type SubmitUpdateBody = {
  weekStart: string;
  accomplishments: string;
  blockers: string;
  next: string;
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
  timesheet: { date: string; hours: number }[];
  projectId?: string;
};

//-----------------------------------------------------
// APPLICANTS TYPES (ADMIN)
//-----------------------------------------------------

export type ApiApplicantListItem = {
  applicant_id: string;

  fullName?: string;
  email?: string;

  roleId?: string;
  roleTitle?: string;

  status?: string;

  source?: string;
  formVersion?: string;

  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;

  sourceIp?: string;
  userAgent?: string;

  emailHistory?: string | any;
  payload?: any;

  [k: string]: any;
};

export type ApiApplicantDetails = ApiApplicantListItem;

//-----------------------------------------------------
// EMAIL ACTION TYPES (APPLICANTS)
//-----------------------------------------------------

export type ApplicantRichEmailType = "INTRO" | "TECH" | "REJECT" | "CONFIRMATION";

export type SendApplicantRichEmailBody = {
  type: ApplicantRichEmailType;
  roleTitle: string;

  // INTRO
  calendlyUrl?: string;

  // shared
  vars?: { extraInfo?: string } & Record<string, any>;
  setStatus?: string;

  // CONFIRMATION
  meetingTitle?: string;
  meetingWhen?: string;
  meetingLink?: string;
  subjectOverride?: string;
};

export type ApplicantDocEmailType = "NDA" | "OFFER";

export type SendApplicantDocEmailBody = {
  type: ApplicantDocEmailType;
  roleTitle: string;

  subjectOverride?: string;
  setStatus?: string;

  vars?: Record<string, any>;

  // OFFER fields
  dateStarted?: string; // YYYY-MM-DD
  employment_type?: string;
  employee_role?: "super" | "admin" | "employee";
  createEmployeeUser?: boolean;
};

export type SendApplicantWelcomeEmailBody = {
  type: "WELCOME";
  roleTitle: string;

  department?: string;
  address?: string;
  city?: string;

  dateStarted?: string; // YYYY-MM-DD
  subjectOverride?: string;

  applicantId?: string;

  extraInfo?: string;
  vars?: Record<string, any>;
  setStatus?: string;
};

//-----------------------------------------------------
// EMAIL ACTION TYPES (EMPLOYEES)
//-----------------------------------------------------

export type EmployeeDocEmailType = "EXPERIENCE";

export type SendEmployeeDocEmailBody = {
  type: EmployeeDocEmailType;

  roleTitle?: string;
  subjectOverride?: string;
  setStatus?: string;

  dateStarted?: string; // YYYY-MM-DD
  dateEnded?: string; // YYYY-MM-DD

  vars?: Record<string, any>;
};

//-----------------------------------------------------
// JOBS TYPES (ADMIN + PUBLIC)
//-----------------------------------------------------

export type JobStatus = "enabled" | "disabled" | "paused";

export type JobQuestionType =
  | "short_text"
  | "long_text"
  | "checkbox"
  | "multi_select"
  | "single_select"
  | "number"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "file";

export type JobQuestion = {
  id: string; // stable id (uuid)
  label: string;
  type: JobQuestionType;
  required?: boolean;

  // for select/multi/checkbox groups
  options?: string[];

  // optional UI hints
  placeholder?: string;
  helpText?: string;

  // free-form future proof
  meta?: Record<string, any>;
};

export type QuestionBank = {
  general: JobQuestion[];
  personal: JobQuestion[];
  updatedAt?: string;
  updatedBy?: string;
};

export type ApiJob = {
  jobId: string;
  title: string;
  slug?: string;
  location?: string;
  department?: string;
  description?: string;
  tags?: string[];

  status: JobStatus; // enabled/disabled/paused

  // role-specific questions (per job)
  roleQuestions?: JobQuestion[];

  // references (optional)
  generalBankVersion?: string;
  personalBankVersion?: string;

  createdAt?: string;
  updatedAt?: string;

  [k: string]: any;
};

// what UI will POST to /admin/jobs/upsert
export type UpsertJobBody = {
  jobId?: string; // if omitted => create
  title: string;
  slug?: string;
  location?: string;
  department?: string;
  description?: string;
  tags?: string[];

  status?: JobStatus;

  roleQuestions?: JobQuestion[];
};

export type SetJobStatusBody = {
  status: JobStatus;
};

export type SaveQuestionBankBody = {
  general: JobQuestion[];
  personal: JobQuestion[];
};

//-----------------------------------------------------
// API BASE
//-----------------------------------------------------

export const API_BASE = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";

//-----------------------------------------------------
// API CLIENT
//-----------------------------------------------------

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

  // API Gateway safe parsing (supports `{ body: "json-string" }` wrappers)
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
      payload?.error ||
      payload?.errors?.[0]?.message ||
      payload?.raw ||
      `HTTP ${status}`
    );
  }

  //---------------------------------------------------
  // AUTH
  //---------------------------------------------------

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

  //---------------------------------------------------
  // PROFILE / DIRECTORY
  //---------------------------------------------------

  async getMe(): Promise<ApiUser> {
    const r = await fetch(`${API_BASE}/me`, { headers: this.headers(false) });
    if (!r.ok) throw new Error(`me failed (${r.status})`);
    return r.json();
  }

  async getDirectory(): Promise<ApiUser[]> {
    const r = await fetch(`${API_BASE}/directory`, { headers: this.headers(false) });
    if (!r.ok) throw new Error(`directory failed (${r.status})`);
    const payload = await this.readJson(r);
    if (Array.isArray(payload?.items)) return payload.items as ApiUser[];
    if (Array.isArray(payload)) return payload as ApiUser[];
    return [];
  }

  //---------------------------------------------------
  // USERS (ADMIN / FALLBACK)
  //---------------------------------------------------

  async getUsers(): Promise<ApiUser[]> {
    const r = await fetch(`${API_BASE}/admin/users`, { headers: this.headers(false) });
    if (r.status === 403) return this.getDirectory();
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`getUsers failed: ${this.extractErrorMessage(payload, r.status)}`);
    if (Array.isArray(payload)) return payload as ApiUser[];
    if (Array.isArray(payload?.items)) return payload.items as ApiUser[];
    return [];
  }

  async getUser(username: string): Promise<ApiUser> {
    const r = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`getUser failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload as ApiUser;
  }

  async createUser(body: CreateUserBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/createUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`createUser failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  async updateUser(body: UpdateUserBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/updateUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`updateUser failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  //---------------------------------------------------
  // PROJECTS
  //---------------------------------------------------

  async getProjects(): Promise<ApiProject[]> {
    const r = await fetch(`${API_BASE}/projects`, { method: "GET", headers: this.headers(false) });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`getProjects failed: ${this.extractErrorMessage(payload, r.status)}`);
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
    if (!r.ok) throw new Error(`saveProject failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  async setProjectInactive(projectId: string): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ projectId, status: "inactive" }),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`setProjectInactive failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  //---------------------------------------------------
  // LEGACY WEEKLY
  //---------------------------------------------------

  async getWeeklyUpdates(projectId: string): Promise<ApiWeeklyUpdate[]> {
    const r = await fetch(`${API_BASE}/weekly/${encodeURIComponent(projectId)}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`getWeeklyUpdates failed: ${this.extractErrorMessage(payload, r.status)}`);
    if (Array.isArray(payload)) return payload as ApiWeeklyUpdate[];
    if (Array.isArray(payload?.items)) return payload.items as ApiWeeklyUpdate[];
    return [];
  }

  async saveWeeklyUpdate(body: SaveWeeklyBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/weekly`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`saveWeeklyUpdate failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  //---------------------------------------------------
  // NEW WEEKLY SNAPSHOT ENDPOINTS (/updates)
  //---------------------------------------------------

  async getUpdates(): Promise<ApiUpdateRow[]> {
    const r = await fetch(`${API_BASE}/updates`, { method: "GET", headers: this.headers(false) });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`getUpdates failed: ${this.extractErrorMessage(payload, r.status)}`);
    if (Array.isArray(payload)) return payload as ApiUpdateRow[];
    if (Array.isArray(payload?.items)) return payload.items as ApiUpdateRow[];
    return [];
  }

  async submitUpdate(body: SubmitUpdateBody): Promise<{ ok: true; id?: string }> {
    const r = await fetch(`${API_BASE}/updates/submit`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`submitUpdate failed: ${this.extractErrorMessage(payload, r.status)}`);
    return { ok: true, id: payload?.id };
  }

  //---------------------------------------------------
  // APPLICANTS (ADMIN)
  //---------------------------------------------------

  async getApplicants(): Promise<ApiApplicantListItem[]> {
    const r = await fetch(`${API_BASE}/admin/applicants`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`getApplicants failed: ${this.extractErrorMessage(payload, r.status)}`);

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
    const r = await fetch(`${API_BASE}/admin/applicants/${encodeURIComponent(applicantId)}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.readJson(r);
    if (!r.ok)
      throw new Error(`getApplicantById failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload as ApiApplicantDetails;
  }

  //---------------------------------------------------
  // APPLICANT EMAIL ACTIONS
  //---------------------------------------------------

  async sendApplicantRichEmail(applicantId: string, body: SendApplicantRichEmailBody): Promise<any> {
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

  async sendApplicantDocEmail(applicantId: string, body: SendApplicantDocEmailBody): Promise<any> {
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

  async sendApplicantWelcomeEmail(applicantId: string, body: SendApplicantWelcomeEmailBody): Promise<any> {
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

  //---------------------------------------------------
  // EMPLOYEE EMAIL ACTIONS
  //---------------------------------------------------

  async sendEmployeeDocEmail(username: string, body: SendEmployeeDocEmailBody): Promise<any> {
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

  //---------------------------------------------------
  // JOBS (ADMIN)
  //---------------------------------------------------

  async listJobsAdmin(): Promise<ApiJob[]> {
    const r = await fetch(`${API_BASE}/admin/jobs`, { method: "GET", headers: this.headers(false) });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`listJobsAdmin failed: ${this.extractErrorMessage(payload, r.status)}`);
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
    if (!r.ok) throw new Error(`getQuestionBank failed: ${this.extractErrorMessage(payload, r.status)}`);
    return (payload || { general: [], personal: [] }) as QuestionBank;
  }

  async saveQuestionBank(body: SaveQuestionBankBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/jobs/question-bank`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`saveQuestionBank failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  async upsertJobAdmin(body: UpsertJobBody): Promise<{ ok: true; jobId?: string }> {
    const r = await fetch(`${API_BASE}/admin/jobs/upsert`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`upsertJobAdmin failed: ${this.extractErrorMessage(payload, r.status)}`);
    return { ok: true, jobId: payload?.jobId || payload?.id || body?.jobId };
  }

  async setJobStatusAdmin(jobId: string, body: SetJobStatusBody): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/jobs/${encodeURIComponent(jobId)}/status`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`setJobStatusAdmin failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  async deleteJobAdmin(jobId: string): Promise<{ ok: true }> {
    const r = await fetch(`${API_BASE}/admin/jobs/${encodeURIComponent(jobId)}/delete`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ jobId }),
    });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`deleteJobAdmin failed: ${this.extractErrorMessage(payload, r.status)}`);
    return payload?.ok ? payload : { ok: true };
  }

  //---------------------------------------------------
  // JOBS (PUBLIC)
  //---------------------------------------------------

  async listJobsPublic(): Promise<ApiJob[]> {
    const r = await fetch(`${API_BASE}/jobs`, { method: "GET", headers: this.headers(false) });
    const payload = await this.readJson(r);
    if (!r.ok) throw new Error(`listJobsPublic failed: ${this.extractErrorMessage(payload, r.status)}`);
    if (Array.isArray(payload)) return payload as ApiJob[];
    if (Array.isArray(payload?.items)) return payload.items as ApiJob[];
    return [];
  }
}

//-----------------------------------------------------
// SINGLETON
//-----------------------------------------------------

export const api = new ApiClient();
