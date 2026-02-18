// src/api.ts
//-----------------------------------------------------
// TYPES
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
  employee_name: string;
  employee_email: string;
  employee_title?: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_phonenumber?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role: "super" | "admin" | "employee";
};

export type CreateUserBody = {
  username: string;
  password: string;
  employee_name: string;
  employee_dob?: string;
  employee_profilepicture?: string;
  employee_phonenumber?: string;
  employee_email: string;
  employee_title?: string;
  employment_type?: string;
  department?: string;
  location?: string;
  employee_role: "super" | "admin" | "employee";
};

export type UpdateUserBody = Partial<CreateUserBody> & { username: string };

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
// WEEKLY UPDATE TYPES
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
// API BASE
//-----------------------------------------------------

export const API_BASE = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";

//-----------------------------------------------------
// CLASS API CLIENT
//-----------------------------------------------------

export class ApiClient {
  private token: string | null = null;

  //---------------------------------------------------
  // TOKEN MANAGEMENT
  //---------------------------------------------------

  setToken(token: string | null) {
    this.token = token;
  }

  //---------------------------------------------------
  // HEADERS
  //---------------------------------------------------

  private headers(isJson = true): HeadersInit {
    const h: Record<string, string> = {
      Accept: "*/*",
      Connection: "keep-alive",
    };
    if (isJson) h["Content-Type"] = "application/json";
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  //---------------------------------------------------
  // AUTH
  //---------------------------------------------------

  async login(username: string, password: string): Promise<ApiLoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Login failed (${res.status}): ${t}`);
    }

    const json = (await res.json()) as ApiLoginResponse;
    this.setToken(json.token);
    return json;
  }

  //---------------------------------------------------
  // USERS
  //---------------------------------------------------

  async getUsers(): Promise<ApiUser[]> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: "GET",
      headers: this.headers(false),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`getUsers failed (${res.status}): ${t}`);
    }

    // Your backend returns: {items: [...]}
    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  }

  async createUser(body: CreateUserBody): Promise<{ ok: true }> {
    const res = await fetch(`${API_BASE}/admin/createUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`createUser failed (${res.status}): ${t}`);
    }

    return { ok: true };
  }

  async updateUser(body: UpdateUserBody): Promise<{ ok: true }> {
    const res = await fetch(`${API_BASE}/admin/updateUser`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`updateUser failed (${res.status}): ${t}`);
    }

    return { ok: true };
  }

  //---------------------------------------------------
  // PROJECTS
  //---------------------------------------------------

  async getProjects(): Promise<ApiProject[]> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "GET",
      headers: this.headers(false),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`getProjects failed (${res.status}): ${t}`);
    }

    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  }

  async saveProject(body: SaveProjectBody): Promise<{ ok: true }> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`saveProject failed (${res.status}): ${t}`);
    }

    return { ok: true };
  }

  async setProjectInactive(projectId: string): Promise<{ ok: true }> {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify({ projectId, status: "inactive" }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`setProjectInactive failed (${res.status}): ${t}`);
    }

    return { ok: true };
  }

  //---------------------------------------------------
  // WEEKLY UPDATES
  //---------------------------------------------------

  async getWeeklyUpdates(projectId: string): Promise<ApiWeeklyUpdate[]> {
    const res = await fetch(`${API_BASE}/weekly/${projectId}`, {
      method: "GET",
      headers: this.headers(false),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`getWeeklyUpdates failed (${res.status}): ${t}`);
    }

    const json = await res.json();
    return Array.isArray(json.items) ? json.items : [];
  }

  async saveWeeklyUpdate(body: SaveWeeklyBody): Promise<{ ok: true }> {
    const res = await fetch(`${API_BASE}/weekly`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`saveWeeklyUpdate failed (${res.status}): ${t}`);
    }

    return { ok: true };
  }
}

//-----------------------------------------------------
// EXPORT CLIENT
//-----------------------------------------------------

export const api = new ApiClient();
