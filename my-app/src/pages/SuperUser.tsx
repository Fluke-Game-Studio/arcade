import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiProject, ApiUser } from "../api";
import { useReleaseProductsData } from "../components/admin/useReleaseProductsData";

declare const M: any;

type SuperTab = "users" | "projects" | "releases";

type ProjectForm = {
  name: string;
  description: string;
  owner: string;
  producer: string;
  totalBudget: string;
  consumedBudget: string;
  status: string;
  releaseStatus: "dev" | "internal" | "candidate" | "released";
  channel: string;
  platform: string;
  promoteFromVersion: string;
};

const DEFAULT_PLATFORMS = ["windows", "mac", "linux", "steam", "epic", "ps5", "xbox", "switch"];

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function parsePlatformCsv(v: string) {
  return Array.from(
    new Set(
      safeStr(v)
        .split(",")
        .map((x) => safeStr(x).toLowerCase())
        .filter(Boolean)
    )
  );
}

function visibleByStatus(status: string) {
  const s = safeStr(status).toLowerCase();
  return !(s === "inactive" || s === "archived" || s === "disabled" || s === "hidden");
}

export default function SuperUser() {
  const { api, user } = useAuth();
  const [tab, setTab] = useState<SuperTab>("users");
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [savingProductKey, setSavingProductKey] = useState("");
  const [savingProjectVisibilityId, setSavingProjectVisibilityId] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const isSuperUser = String((user as any)?.role || "").toLowerCase() === "super";
  const releaseData = useReleaseProductsData(api as any);

  const [projectForm, setProjectForm] = useState<ProjectForm>({
    name: "",
    description: "",
    owner: "",
    producer: "",
    totalBudget: "",
    consumedBudget: "",
    status: "active",
    releaseStatus: "dev",
    channel: "v0.0.0",
    platform: "",
    promoteFromVersion: "",
  });

  async function loadUsers() {
    setLoading(true);
    try {
      setRows(await api.getUsers());
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      setProjects(await api.getProjects());
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
      setRows((prev) => prev.map((u) => (u.username === username ? ({ ...u, [field]: value } as any) : u)));
      M.toast({ html: "Access updated", classes: "green" });
    } catch (e: any) {
      M.toast({ html: e?.message || "Failed", classes: "red" });
    }
  }

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
      releaseStatus: "dev",
      channel: "v0.0.0",
      platform: "",
      promoteFromVersion: "",
    });
    setCustomPlatform("");
  }

  async function handleProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectForm.name.trim()) {
      M.toast({ html: "Project name required", classes: "red" });
      return;
    }

    setProjectSaving(true);
    try {
      await api.saveProject({
        projectId: editingProjectId || undefined,
        name: projectForm.name.trim(),
        description: projectForm.description.trim() || undefined,
        project_owner: projectForm.owner || undefined,
        project_producer: projectForm.producer || undefined,
        project_budget_total: projectForm.totalBudget || undefined,
        project_budget_consumed: projectForm.consumedBudget || undefined,
        status: projectForm.status,
        release_status: projectForm.releaseStatus,
        channel: projectForm.channel,
        platform: projectForm.platform,
        release_version: projectForm.channel,
        promote_from_version: projectForm.promoteFromVersion || undefined,
      } as any);
      M.toast({ html: editingProjectId ? "Project Updated" : "Project Created", classes: "green" });
      resetProjectForm();
      loadProjects();
      releaseData.refresh();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed saving project", classes: "red" });
    } finally {
      setProjectSaving(false);
    }
  }

  function handleProjectEdit(p: ApiProject) {
    const parsedPlatforms = parsePlatformCsv(safeStr((p as any).platform || ""));
    const selectedPlatform = parsedPlatforms[0] || "";
    setEditingProjectId(p.projectId);
    setProjectForm({
      name: p.name || "",
      description: p.description || "",
      owner: p.project_owner || "",
      producer: p.project_producer || "",
      totalBudget: p.project_budget_total ? String(p.project_budget_total) : "",
      consumedBudget: p.project_budget_consumed ? String(p.project_budget_consumed) : "",
      status: p.status || "active",
      releaseStatus: (p.release_status as any) || "dev",
      channel: safeStr((p as any).channel || "v0.0.0"),
      platform: selectedPlatform,
      promoteFromVersion: safeStr((p as any).promote_from_version),
    });
    setCustomPlatform("");
    setTab("projects");
    document.getElementById("project-form-card")?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSyncProductFromProject(p: ApiProject) {
    if (!isSuperUser) return;
    try {
      await (api as any).syncProductFromProject({
        project_id: p.projectId,
        product_id: p.projectId,
        name: p.name,
        release_status: (p.release_status as any) || "internal",
        channel: safeStr((p as any).channel || "v0.0.0"),
        platform: safeStr((p as any).platform || ""),
        promote_from_version: safeStr((p as any).promote_from_version),
        status: p.status || "active",
      });
      M.toast({ html: "Product sync triggered", classes: "green" });
      releaseData.refresh();
    } catch (err: any) {
      M.toast({ html: err?.message || "Sync failed", classes: "red" });
    }
  }

  async function toggleProjectVisible(p: ApiProject, shouldBeVisible: boolean) {
    if (!isSuperUser) return;
    setSavingProjectVisibilityId(p.projectId);
    try {
      await api.saveProject({
        projectId: p.projectId,
        name: p.name,
        description: p.description,
        project_owner: p.project_owner,
        project_producer: p.project_producer,
        project_budget_total: p.project_budget_total,
        project_budget_consumed: p.project_budget_consumed,
        release_status: p.release_status,
        channel: p.channel,
        platform: (p as any).platform,
        status: shouldBeVisible ? "active" : "inactive",
      } as any);
      M.toast({ html: shouldBeVisible ? "Project visible on website" : "Project hidden from website", classes: "green" });
      loadProjects();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to update project visibility", classes: "red" });
    } finally {
      setSavingProjectVisibilityId("");
    }
  }

  const releaseSourceOptions = useMemo(() => {
    if (!editingProjectId) return [];
    const fromState =
      projectForm.releaseStatus === "candidate"
        ? "internal"
        : projectForm.releaseStatus === "released"
        ? "candidate"
        : "";
    if (!fromState) return [];
    return (releaseData.products || [])
      .filter((x: any) => safeStr(x.project_id) === safeStr(editingProjectId) && safeStr(x.release_status).toLowerCase() === fromState)
      .map((x: any) => safeStr(x.channel))
      .filter(Boolean)
      .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);
  }, [releaseData.products, projectForm.releaseStatus, editingProjectId]);

  const platformOptions = useMemo(() => {
    const fromProjects = projects.flatMap((p: any) => parsePlatformCsv(safeStr(p.platform || "")));
    return Array.from(new Set([...DEFAULT_PLATFORMS, ...fromProjects]));
  }, [projects]);

  return (
    <main className="container" style={{ paddingTop: 24, maxWidth: 1200 }}>
      <style>{`
        .suCard { border: 1px solid #e6edf2; border-radius: 16px; background: #fff; overflow: hidden; }
        .suCard .card-content { padding: 16px; }
        .suTabs { display: inline-flex; gap: 8px; border: 1px solid #dbe5ef; border-radius: 999px; padding: 6px; margin: 0 0 14px; background: #f8fbff; }
        .suTabBtn { border: 0; border-radius: 999px; padding: 9px 14px; font-weight: 900; font-size: 13px; cursor: pointer; color: #334155; background: transparent; }
        .suTabBtn.active { background: rgba(59,130,246,.16); color: #1d4ed8; }
        .suHeader { font-size: 22px; font-weight: 1000; color: #0f172a; }
        .suSub { color: #475569; margin: 6px 0 14px; }
      `}</style>

      <div className="suHeader">Super Console</div>
      <div className="suSub">
        Manage users, projects, and website-facing release visibility.
      </div>

      <div className="suTabs" role="tablist" aria-label="Super Console tabs">
        <button type="button" className={`suTabBtn ${tab === "users" ? "active" : ""}`} onClick={() => setTab("users")}>Users & Roles</button>
        <button type="button" className={`suTabBtn ${tab === "projects" ? "active" : ""}`} onClick={() => setTab("projects")}>Projects</button>
        <button type="button" className={`suTabBtn ${tab === "releases" ? "active" : ""}`} onClick={() => setTab("releases")}>Releases & Products</button>
      </div>

      {tab === "users" && (
        <div className="suCard">
          <div className="card-content">
            <span className="card-title" style={{ fontWeight: 1000 }}>Users ({rows.length})</span>
            <div className="input-field">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." />
              <label className="active">Search</label>
            </div>
            {loading ? <p>Loading...</p> : (
              <table className="highlight responsive-table">
                <thead>
                  <tr>
                    <th>Username</th><th>Name</th><th>Email</th><th>Role</th><th>Portal</th><th>Project</th><th>VCS</th><th>Revoked</th><th>Change</th>
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
                        <td><label><input type="checkbox" checked={portal} disabled={!isSuperUser} onChange={(e) => setUserAccessFlag(u.username, "portal_access", e.target.checked)} /><span></span></label></td>
                        <td><label><input type="checkbox" checked={project} disabled={!isSuperUser} onChange={(e) => setUserAccessFlag(u.username, "project_access", e.target.checked)} /><span></span></label></td>
                        <td><label><input type="checkbox" checked={vcs} disabled={!isSuperUser} onChange={(e) => setUserAccessFlag(u.username, "version_control_access", e.target.checked)} /><span></span></label></td>
                        <td>{revoked ? "Yes" : "No"}</td>
                        <td>
                          {["employee", "admin", "super"].map((r) => (
                            <button key={r} className={`btn-small ${r === "admin" ? "blue" : r === "super" ? "teal" : ""}`} disabled={isSelf || u.employee_role === r} onClick={() => setRole(u.username, r as any)}>{r}</button>
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
      )}

      {tab === "projects" && (
        <>
          <div className="suCard" style={{ marginBottom: 14 }}>
            <div className="card-content">
              <span className="card-title" style={{ fontWeight: 1000 }}>
                Existing Projects {projectsLoading ? "(Loading...)" : `(${projects.length})`}
              </span>
              {!projectsLoading && (projects.length > 0 ? (
                <table className="highlight responsive-table">
                  <thead>
                    <tr><th>Name</th><th>Owner</th><th>Producer</th><th>Status</th><th>Release</th><th>Budget</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {projects.map((p) => {
                      const owner = rows.find((u) => u.username === p.project_owner);
                      const prod = rows.find((u) => u.username === p.project_producer);
                      const isVisible = visibleByStatus(p.status || "active");
                      return (
                        <tr key={p.projectId}>
                          <td><b>{p.name}</b></td>
                          <td>{owner ? owner.employee_name : p.project_owner}</td>
                          <td>{prod ? prod.employee_name : p.project_producer}</td>
                          <td>{safeStr(p.status || "active").toUpperCase()}</td>
                          <td>{safeStr(p.release_status || "dev").toUpperCase()} / {safeStr(p.channel || "v0.0.0")}<div style={{ fontSize: 12, color: "#64748b" }}>{safeStr((p as any).platform || "all")}</div></td>
                          <td>{p.project_budget_total ? `${p.project_budget_consumed || 0}/${p.project_budget_total}` : "-"}</td>
                          <td>
                            <button className="btn-small blue" onClick={() => handleProjectEdit(p)}>Edit</button>
                            {isSuperUser && <button className="btn-flat" onClick={() => handleSyncProductFromProject(p)}><span className="blue-text text-darken-2">Sync Product</span></button>}
                            {isSuperUser && (
                              <button
                                className="btn-flat"
                                disabled={savingProjectVisibilityId === p.projectId}
                                onClick={() => toggleProjectVisible(p, !isVisible)}
                              >
                                <span className={isVisible ? "red-text text-darken-2" : "green-text text-darken-2"}>
                                  {savingProjectVisibilityId === p.projectId ? "Saving..." : isVisible ? "Hide on Website" : "Show on Website"}
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <p className="grey-text">No projects yet.</p>)}
            </div>
          </div>

          <div className="suCard" id="project-form-card">
            <div className="card-content">
              <span className="card-title" style={{ fontWeight: 1000 }}>{editingProjectId ? "Edit Project" : "Add Project"}</span>
              <form onSubmit={handleProjectSubmit}>
                <div className="row">
                  <div className="col s12 m6"><div className="input-field"><input value={projectForm.name} onChange={(e) => handleProjectChange("name", e.target.value)} /><label className="active">Project Name *</label></div></div>
                  <div className="col s12 m3">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.owner} onChange={(e) => handleProjectChange("owner", e.target.value)}>
                        <option value="">Owner / Lead</option>
                        {adminAndSupers.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}
                      </select>
                      <label className="active" style={{ top: -24 }}>Owner / Lead</label>
                    </div>
                  </div>
                  <div className="col s12 m3">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.producer} onChange={(e) => handleProjectChange("producer", e.target.value)}>
                        <option value="">Producer / PM</option>
                        {rows.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}
                      </select>
                      <label className="active" style={{ top: -24 }}>Producer / PM</label>
                    </div>
                  </div>
                </div>

                <div className="input-field">
                  <textarea className="materialize-textarea" value={projectForm.description} onChange={(e) => handleProjectChange("description", e.target.value)} />
                  <label className="active">Description</label>
                </div>

                <div className="row">
                  <div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.totalBudget} onChange={(e) => handleProjectChange("totalBudget", e.target.value)} /><label className="active">Total Budget</label></div></div>
                  <div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.consumedBudget} onChange={(e) => handleProjectChange("consumedBudget", e.target.value)} /><label className="active">Consumed Budget</label></div></div>
                  <div className="col s12 m4">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.status} onChange={(e) => handleProjectChange("status", e.target.value)}>
                        <option value="active">Active</option>
                        <option value="on-hold">On Hold</option>
                        <option value="planning">Planning</option>
                        <option value="closed">Closed</option>
                        <option value="inactive">Inactive (Hidden)</option>
                      </select>
                      <label className="active" style={{ top: -24 }}>Status</label>
                    </div>
                  </div>
                </div>

                <div className="row">
                  <div className="col s12 m6">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.releaseStatus} onChange={(e) => handleProjectChange("releaseStatus", e.target.value as any)}>
                        <option value="dev">Dev (Not Released)</option>
                        <option value="internal">Internal</option>
                        <option value="candidate">Candidate</option>
                        <option value="released">Released</option>
                      </select>
                      <label className="active" style={{ top: -24 }}>Release Status</label>
                    </div>
                  </div>
                  <div className="col s12 m6"><div className="input-field"><input placeholder="v1.0.0" value={projectForm.channel} onChange={(e) => handleProjectChange("channel", e.target.value)} /><label className="active">Release Version</label></div></div>
                </div>
                <div className="row">
                  <div className="col s12 m12">
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: "#475569", fontWeight: 800, marginBottom: 8 }}>Platforms</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                        <select
                          className="browser-default"
                          value={projectForm.platform}
                          onChange={(e) => {
                            const v = e.target.value;
                            handleProjectChange("platform", v);
                          }}
                        >
                          <option value="">Select one platform</option>
                          {platformOptions.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <span style={{ alignSelf: "center", fontSize: 12, color: "#64748b" }}>One build = one platform</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                        <input
                          placeholder="Add custom platform (e.g. gog)"
                          value={customPlatform}
                          onChange={(e) => setCustomPlatform(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-flat"
                          onClick={() => {
                            const v = safeStr(customPlatform).toLowerCase();
                            if (!v) return;
                            handleProjectChange("platform", v);
                            setCustomPlatform("");
                          }}
                        >
                          Use Custom
                        </button>
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        Active platform: <b>{projectForm.platform || "not set"}</b>
                      </div>
                    </div>
                  </div>
                </div>

                {(projectForm.releaseStatus === "candidate" || projectForm.releaseStatus === "released") && (
                  <div className="row">
                    <div className="col s12 m6">
                      <div className="input-field">
                        <select className="browser-default" value={projectForm.promoteFromVersion} onChange={(e) => handleProjectChange("promoteFromVersion", e.target.value)}>
                          <option value="">Select source version</option>
                          {releaseSourceOptions.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <label className="active" style={{ top: -24 }}>
                          Promote From Version ({projectForm.releaseStatus === "candidate" ? "from Internal" : "from Testing"})
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <button className="btn" type="submit" disabled={projectSaving}>{projectSaving ? "Saving..." : editingProjectId ? "Update Project" : "Save Project"}</button>
                {editingProjectId && <button type="button" className="btn-flat" onClick={resetProjectForm}>Reset</button>}
              </form>
            </div>
          </div>
        </>
      )}

      {tab === "releases" && (
        <div className="suCard">
          <div className="card-content">
            <span className="card-title" style={{ fontWeight: 1000 }}>Releases & Products ({releaseData.releaseRows.length})</span>
            <p className="grey-text" style={{ marginTop: 0 }}>
              Disable a release/product to hide it from main website download views.
            </p>
            {releaseData.releaseRows.length === 0 ? (
              <p className="grey-text">No releases/products found.</p>
            ) : (
              <table className="highlight responsive-table">
                <thead>
                  <tr>
                    <th>Product</th><th>Project</th><th>Release Status</th><th>Version</th><th>Current State</th><th>Website</th>
                  </tr>
                </thead>
                <tbody>
                  {releaseData.releaseRows.map((r: any) => {
                    const actionKey = r.key;
                    const isVisible = r.isVisible;
                    return (
                      <tr key={r.key}>
                        <td><b>{r.name}</b><div style={{ fontSize: 12, color: "#64748b" }}>{r.product_id}</div></td>
                        <td>{r.project_id}</td>
                        <td>{safeStr(r.release_status || "internal").toUpperCase()}</td>
                        <td>{r.channel}<div style={{ fontSize: 12, color: "#64748b" }}>{safeStr((r as any).platform || "all")}</div></td>
                        <td>{safeStr(r.status || "active").toUpperCase()}</td>
                        <td>
                          <button
                            type="button"
                            className="btn-small"
                            style={{ background: isVisible ? "#ef4444" : "#16a34a" }}
                            disabled={!isSuperUser || savingProductKey === actionKey}
                            onClick={async () => {
                              setSavingProductKey(actionKey);
                              try {
                                await releaseData.toggleReleaseVisibility(r, !isVisible);
                                M.toast({ html: !isVisible ? "Release visible on website" : "Release hidden from website", classes: "green" });
                              } catch (err: any) {
                                M.toast({ html: err?.message || "Failed to update release visibility", classes: "red" });
                              } finally {
                                setSavingProductKey("");
                              }
                            }}
                          >
                            {savingProductKey === actionKey ? "Saving..." : isVisible ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
