// src/pages/SuperUser.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser, ApiProject } from "../api";

declare const M: any;

type ProjectForm = {
  name: string;
  description: string;
  owner: string;
  producer: string;
  totalBudget: string;
  consumedBudget: string;
  status: string;
};

export default function SuperUser() {
  const { api, user } = useAuth();
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // ---- PROJECT STATE ----
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [projectSaving, setProjectSaving] = useState(false);
  const isSuperUser = String((user as any)?.role || "").toLowerCase() === "super";

  const [projectForm, setProjectForm] = useState<ProjectForm>({
    name: "",
    description: "",
    owner: "",
    producer: "",
    totalBudget: "",
    consumedBudget: "",
    status: "active",
  });

  /* ========================= LOAD USERS ========================== */
  async function loadUsers() {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  /* ========================= LOAD PROJECTS ======================== */
  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const list = await api.getProjects(); // <- REQUIRED API
      setProjects(list);
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to load projects", classes: "red" });
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  /* ========================= COLLAPSIBLES ========================= */
  useEffect(() => {
    if (typeof M === "undefined") return;
    try {
      M.Collapsible.init(document.querySelectorAll(".collapsible"), { accordion: false });
    } catch {}
  }, []);

  /* ========================= FILTER USERS ========================= */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        (u.employee_name || "").toLowerCase().includes(q) ||
        (u.employee_email || "").toLowerCase().includes(q) ||
        (u.employee_role || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const adminAndSupers = useMemo(
    () => rows.filter((u) => u.employee_role === "admin" || u.employee_role === "super"),
    [rows]
  );

  const allUsers = rows;

  /* ========================= ROLE CHANGE ========================= */
  async function setRole(username: string, role: "employee" | "admin" | "super") {
    try {
      await api.updateUser({ username, employee_role: role });
      M.toast({ html: "Role updated", classes: "green" });
      loadUsers();
    } catch (e: any) {
      M.toast({ html: e?.message || "Failed", classes: "red" });
    }
  }

  async function setUserAccessFlag(
    username: string,
    field: "portal_access" | "project_access" | "version_control_access",
    value: boolean
  ) {
    if (!isSuperUser) return;
    try {
      await api.updateUser({ username, [field]: value } as any);
      setRows((prev) =>
        prev.map((u) => (u.username === username ? ({ ...u, [field]: value } as any) : u))
      );
      M.toast({ html: "Access updated", classes: "green" });
    } catch (e: any) {
      M.toast({ html: e?.message || "Failed", classes: "red" });
    }
  }

  /* ========================= PROJECT FORM LOGIC ========================= */
  function handleProjectChange<K extends keyof ProjectForm>(key: K, v: ProjectForm[K]) {
    setProjectForm((prev) => ({ ...prev, [key]: v }));
  }

  function resetProjectForm() {
    setEditingProjectId(null);
    setProjectForm({
      name: "",
      description: "",
      owner: "",
      producer: "",
      totalBudget: "",
      consumedBudget: "",
      status: "active",
    });
  }

  async function handleProjectSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!projectForm.name.trim()) {
      M.toast({ html: "Project name required", classes: "red" });
      return;
    }

    const payload = {
      projectId: editingProjectId || undefined,
      name: projectForm.name.trim(),
      description: projectForm.description.trim() || undefined,
      project_owner: projectForm.owner || undefined,
      project_producer: projectForm.producer || undefined,
      project_budget_total: projectForm.totalBudget || undefined,
      project_budget_consumed: projectForm.consumedBudget || undefined,
      status: projectForm.status,
    };

    setProjectSaving(true);
    try {
      await api.saveProject(payload); // <- REQUIRED API
      M.toast({ html: editingProjectId ? "Project Updated" : "Project Created", classes: "green" });

      resetProjectForm();
      loadProjects();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed saving project", classes: "red" });
    } finally {
      setProjectSaving(false);
    }
  }

  /* ========================= EDIT PROJECT ========================= */
  function handleProjectEdit(p: ApiProject) {
    setEditingProjectId(p.projectId);

    setProjectForm({
      name: p.name || "",
      description: p.description || "",
      owner: p.project_owner || "",
      producer: p.project_producer || "",
      totalBudget: p.project_budget_total ? String(p.project_budget_total) : "",
      consumedBudget: p.project_budget_consumed ? String(p.project_budget_consumed) : "",
      status: p.status || "active",
    });

    document.getElementById("project-form-card")?.scrollIntoView({ behavior: "smooth" });
  }

  /* ========================= SET INACTIVE (SUPER ONLY) ========================= */
  async function handleQuickSetInactive(p: ApiProject) {
    if (!isSuperUser) return;

    const ok = confirm(`Set project "${p.name}" to INACTIVE?`);
    if (!ok) return;

    try {
      await api.setProjectInactive(p.projectId); // <- REQUIRED API
      M.toast({ html: "Project set inactive", classes: "green" });
      loadProjects();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed", classes: "red" });
    }
  }

  /* ========================= RENDER ========================= */
  return (
    <main className="container" style={{ paddingTop: 24, maxWidth: 1100 }}>
      <style>{`
        .suHero {
          border-radius: 26px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.22);
          background:
            radial-gradient(900px 520px at 18% -30%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(800px 520px at 105% 10%, rgba(99,102,241,0.18), transparent 55%),
            linear-gradient(180deg, #0b2544 0%, #071a33 100%);
          box-shadow: 0 22px 70px rgba(0,0,0,0.26);
          position: relative;
          margin-bottom: 14px;
          color: #fff;
        }
        .suHeroInner {
          padding: 18px 18px 16px;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .suTitle { font-weight: 1000; font-size: 20px; line-height: 24px; }
        .suSub { margin-top: 6px; color: rgba(226,232,240,0.82); font-size: 13px; max-width: 760px; }
        .suPills { display: inline-flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
        .suPill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(226,232,240,0.96);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .04em;
          text-transform: uppercase;
        }
        .suStats { display: flex; gap: 10px; flex-wrap: wrap; align-items: stretch; }
        .suStat {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 16px;
          padding: 12px 14px;
          min-width: 132px;
        }
        .suStatLabel { font-size: 12px; opacity: .85; font-weight: 900; }
        .suStatValue { font-size: 22px; font-weight: 1000; margin-top: 2px; }

        .suCollapsible {
          border: 0;
          box-shadow: none;
          margin: 0;
        }
        .suCollapsible > li {
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid #e6edf2;
          margin-bottom: 14px;
        }
        .suCollapsible .collapsible-header {
          border: 0;
          padding: 14px 16px;
          font-weight: 1000;
          color: #0f172a;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .suCollapsible .collapsible-body {
          border: 0;
          padding: 16px;
          background: #fff;
        }
        .suCollapsible .card {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,.20);
          box-shadow: 0 18px 35px rgba(15,23,42,.06);
          margin: 0;
        }
        .suCollapsible .card .card-content { padding: 16px; }
        .suCollapsible .card .card-title {
          font-weight: 1000;
          color: #0f172a;
        }
        .suCollapsible table code { font-size: 12px; }
      `}</style>

      <div className="suHero">
        <div className="suHeroInner">
          <div style={{ minWidth: 260 }}>
            <div className="suTitle">Super Console</div>
            <div className="suSub">
              Manage users, roles, and access controls. Only <b>super</b> can edit Portal/Project/VCS access.
            </div>
            <div className="suPills">
              <span className="suPill">
                <i className="material-icons" style={{ fontSize: 16 }}>admin_panel_settings</i>
                {isSuperUser ? "Super" : "Read Only"}
              </span>
              <span className="suPill">
                <i className="material-icons" style={{ fontSize: 16 }}>key</i>
                Access Flags
              </span>
            </div>
          </div>

          <div className="suStats">
            <div className="suStat">
              <div className="suStatLabel">Users</div>
              <div className="suStatValue">{rows.length}</div>
            </div>
            <div className="suStat">
              <div className="suStatLabel">Projects</div>
              <div className="suStatValue">{projects.length}</div>
            </div>
          </div>
        </div>
      </div>

      <ul className="collapsible popout suCollapsible">

        {/* ===================== USERS ===================== */}
        <li className="active">
          <div className="collapsible-header">
            <i className="material-icons">people</i>
            Users & Roles
          </div>

          <div className="collapsible-body">
            <div className="card">
              <div className="card-content">

                <span className="card-title">Users ({rows.length})</span>

                <div className="input-field">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search..."
                  />
                  <label className="active">Search</label>
                </div>

                {loading ? (
                  <p>Loading...</p>
                ) : (
                  <table className="highlight responsive-table">
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Portal</th>
                        <th>Project</th>
                        <th>VCS</th>
                        <th>Revoked</th>
                        <th>Change</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filtered.map((u) => {
                        const isSelf = u.username === user?.username;
                        const portal = (u as any).portal_access !== false;
                        const project = (u as any).project_access !== false;
                        const vcs = (u as any).version_control_access === true;
                        const revoked = (u as any).revoked === true;

                        return (
                          <tr key={u.username} className={isSelf ? "grey lighten-4" : ""}>
                            <td><code>{u.username}</code></td>
                            <td>{u.employee_name}</td>
                            <td><code>{u.employee_email}</code></td>
                            <td><b>{(u.employee_role ?? "").toUpperCase()}</b></td>

                            <td>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={portal}
                                  disabled={!isSuperUser}
                                  onChange={(e) => setUserAccessFlag(u.username, "portal_access", e.target.checked)}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={project}
                                  disabled={!isSuperUser}
                                  onChange={(e) => setUserAccessFlag(u.username, "project_access", e.target.checked)}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={vcs}
                                  disabled={!isSuperUser}
                                  onChange={(e) => setUserAccessFlag(u.username, "version_control_access", e.target.checked)}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td>{revoked ? "Yes" : "No"}</td>

                            <td>
                              {["employee", "admin", "super"].map((r) => (
                                <button
                                  key={r}
                                  className={`btn-small ${
                                    r === "admin" ? "blue" :
                                    r === "super" ? "teal" : ""
                                  }`}
                                  disabled={isSelf || u.employee_role === r}
                                  onClick={() => setRole(u.username, r as any)}
                                >
                                  {r}
                                </button>
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

              </div>
            </div>
          </div>
        </li>

        {/* ===================== PROJECTS ===================== */}
        <li>
          <div className="collapsible-header">
            <i className="material-icons">work_outline</i>
            Projects & Teams
          </div>

          <div className="collapsible-body">

            {/* ===== PROJECT LIST ===== */}
            <div className="card">
              <div className="card-content">
                <span className="card-title">
                  Existing Projects {projectsLoading ? "(Loading...)" : `(${projects.length})`}
                </span>

                {!projectsLoading && (
                  projects.length > 0 ? (
                    <table className="highlight responsive-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Owner</th>
                          <th>Producer</th>
                          <th>Status</th>
                          <th>Budget</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {projects.map((p) => {
                          const owner = rows.find((u) => u.username === p.project_owner);
                          const prod = rows.find((u) => u.username === p.project_producer);

                          return (
                            <tr key={p.projectId}>
                              <td><b>{p.name}</b></td>

                              <td>{owner ? owner.employee_name : p.project_owner}</td>
                              <td>{prod ? prod.employee_name : p.project_producer}</td>

                              <td>{(p.status || "active").toUpperCase()}</td>

                              <td>
                                {p.project_budget_total
                                  ? `${p.project_budget_consumed || 0}/${p.project_budget_total}`
                                  : "—"}
                              </td>

                              <td>
                                <button className="btn-small blue" onClick={() => handleProjectEdit(p)}>
                                  Edit
                                </button>

                                {isSuperUser && p.status !== "on-hold" && (
                                  <button className="btn-flat" onClick={() => handleQuickSetInactive(p)}>
                                    <span className="grey-text">Set Inactive</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="grey-text">No projects yet.</p>
                  )
                )}

              </div>
            </div>

            {/* ===== PROJECT FORM ===== */}
            <div className="card" id="project-form-card">
              <div className="card-content">

                <span className="card-title">
                  {editingProjectId ? "Edit Project" : "Add Project"}
                </span>

                <form onSubmit={handleProjectSubmit}>
                  <div className="row">

                    {/* NAME */}
                    <div className="col s12 m6">
                      <div className="input-field">
                        <input
                          value={projectForm.name}
                          onChange={(e) => handleProjectChange("name", e.target.value)}
                        />
                        <label className="active">Project Name *</label>
                      </div>
                    </div>

                    {/* OWNER */}
                    <div className="col s12 m3">
                      <div className="input-field">
                        <select
                          className="browser-default"
                          value={projectForm.owner}
                          onChange={(e) => handleProjectChange("owner", e.target.value)}
                        >
                          <option value="">Owner / Lead</option>
                          {adminAndSupers.map((u) => (
                            <option key={u.username} value={u.username}>{u.employee_name}</option>
                          ))}
                        </select>
                        <label className="active" style={{ top: -24 }}>Owner / Lead</label>
                      </div>
                    </div>

                    {/* PRODUCER */}
                    <div className="col s12 m3">
                      <div className="input-field">
                        <select
                          className="browser-default"
                          value={projectForm.producer}
                          onChange={(e) => handleProjectChange("producer", e.target.value)}
                        >
                          <option value="">Producer / PM</option>
                          {allUsers.map((u) => (
                            <option key={u.username} value={u.username}>{u.employee_name}</option>
                          ))}
                        </select>
                        <label className="active" style={{ top: -24 }}>Producer / PM</label>
                      </div>
                    </div>

                  </div>

                  {/* DESCRIPTION */}
                  <div className="input-field">
                    <textarea
                      className="materialize-textarea"
                      value={projectForm.description}
                      onChange={(e) => handleProjectChange("description", e.target.value)}
                    />
                    <label className="active">Description</label>
                  </div>

                  {/* BUDGET */}
                  <div className="row">

                    <div className="col s12 m4">
                      <div className="input-field">
                        <input
                          type="number"
                          value={projectForm.totalBudget}
                          onChange={(e) => handleProjectChange("totalBudget", e.target.value)}
                        />
                        <label className="active">Total Budget</label>
                      </div>
                    </div>

                    <div className="col s12 m4">
                      <div className="input-field">
                        <input
                          type="number"
                          value={projectForm.consumedBudget}
                          onChange={(e) => handleProjectChange("consumedBudget", e.target.value)}
                        />
                        <label className="active">Consumed Budget</label>
                      </div>
                    </div>

                    <div className="col s12 m4">
                      <div className="input-field">
                        <select
                          className="browser-default"
                          value={projectForm.status}
                          onChange={(e) => handleProjectChange("status", e.target.value)}
                        >
                          <option value="active">Active</option>
                          <option value="on-hold">On Hold</option>
                          <option value="planning">Planning</option>
                          <option value="closed">Closed</option>
                        </select>
                        <label className="active" style={{ top: -24 }}>Status</label>
                      </div>
                    </div>

                  </div>

                  {/* SUBMIT */}
                  <button className="btn" type="submit" disabled={projectSaving}>
                    {projectSaving
                      ? "Saving..."
                      : editingProjectId
                      ? "Update Project"
                      : "Save Project"}
                  </button>

                  {editingProjectId && (
                    <button type="button" className="btn-flat" onClick={resetProjectForm}>
                      Reset
                    </button>
                  )}

                </form>
              </div>
            </div>

          </div>
        </li>

      </ul>
    </main>
  );
}
