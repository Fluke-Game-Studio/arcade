import type { ApiProject, ApiUser } from "../../api";

type ProjectSettingsTab = "details" | "jira";
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
  jiraEnabled: boolean;
  jiraProjectKey: string;
  jiraCloudId: string;
  jiraBoardId: string;
};

type Props = {
  projects: ApiProject[];
  users: ApiUser[];
  adminAndSupers: ApiUser[];
  loading: boolean;
  isSuperUser: boolean;
  editingProjectId: string | null;
  projectSaving: boolean;
  savingProjectVisibilityId: string;
  projectSettingsTab: ProjectSettingsTab;
  projectForm: ProjectForm;
  customPlatform: string;
  platformOptions: string[];
  releaseSourceOptions: string[];
  jiraConnectStatus: any;
  onProjectEdit: (p: ApiProject) => void;
  onProjectSubmit: (e: React.FormEvent) => void;
  onProjectChange: <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => void;
  onResetProjectForm: () => void;
  onSyncProductFromProject: (p: ApiProject) => void;
  onToggleProjectVisible: (p: ApiProject, shouldBeVisible: boolean) => void;
  onProjectSettingsTabChange: (tab: ProjectSettingsTab) => void;
  onLoadJiraConnectStatus: () => void;
  onUseConnectedCloudId: () => void;
  onCustomPlatformChange: (value: string) => void;
  onUseCustomPlatform: () => void;
  safeStr: (value: any) => string;
  visibleByStatus: (status: string) => boolean;
};

export default function SuperProjectsTab(props: Props) {
  const {
    projects,
    users,
    adminAndSupers,
    loading,
    isSuperUser,
    editingProjectId,
    projectSaving,
    savingProjectVisibilityId,
    projectSettingsTab,
    projectForm,
    customPlatform,
    platformOptions,
    releaseSourceOptions,
    jiraConnectStatus,
    onProjectEdit,
    onProjectSubmit,
    onProjectChange,
    onResetProjectForm,
    onSyncProductFromProject,
    onToggleProjectVisible,
    onProjectSettingsTabChange,
    onLoadJiraConnectStatus,
    onUseConnectedCloudId,
    onCustomPlatformChange,
    onUseCustomPlatform,
    safeStr,
    visibleByStatus,
  } = props;

  return (
    <>
      <div className="suCard" style={{ marginBottom: 14 }}>
        <div className="card-content">
          <span className="card-title" style={{ fontWeight: 1000 }}>
            Existing Projects {loading ? "(Loading...)" : `(${projects.length})`}
          </span>
          {!loading && (
            projects.length > 0 ? (
              <table className="highlight responsive-table">
                <thead>
                  <tr><th>Name</th><th>Owner</th><th>Producer</th><th>Status</th><th>Release</th><th>Jira</th><th>Budget</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {projects.map((p) => {
                    const owner = users.find((u) => u.username === p.project_owner);
                    const prod = users.find((u) => u.username === p.project_producer);
                    const isVisible = visibleByStatus(p.status || "active");
                    return (
                      <tr key={p.projectId}>
                        <td><b>{p.name}</b></td>
                        <td>{owner ? owner.employee_name : p.project_owner}</td>
                        <td>{prod ? prod.employee_name : p.project_producer}</td>
                        <td>{safeStr(p.status || "active").toUpperCase()}</td>
                        <td>{safeStr(p.release_status || "dev").toUpperCase()} / {safeStr((p as any).channel || "v0.0.0")}<div style={{ fontSize: 12, color: "#64748b" }}>{safeStr((p as any).platform || "all")}</div></td>
                        <td>
                          {((p as any).jira_enabled === true || String((p as any).jira_enabled || "").toLowerCase() === "true") ? (
                            <div>
                              <div style={{ color: "#15803d", fontWeight: 800 }}>Enabled</div>
                              <div style={{ fontSize: 12, color: "#64748b" }}>
                                {safeStr((p as any).jira_project_key) || "-"}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: "#64748b" }}>Disabled</span>
                          )}
                        </td>
                        <td>{p.project_budget_total ? `${p.project_budget_consumed || 0}/${p.project_budget_total}` : "-"}</td>
                        <td>
                          <button className="btn-small blue" onClick={() => onProjectEdit(p)}>Edit</button>
                          {isSuperUser && <button className="btn-flat" onClick={() => onSyncProductFromProject(p)}><span className="blue-text text-darken-2">Sync Product</span></button>}
                          {isSuperUser && (
                            <button
                              className="btn-flat"
                              disabled={savingProjectVisibilityId === p.projectId}
                              onClick={() => onToggleProjectVisible(p, !isVisible)}
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
            ) : <p className="grey-text">No projects yet.</p>
          )}
        </div>
      </div>

      <div className="suCard" id="project-form-card">
        <div className="card-content">
          <span className="card-title" style={{ fontWeight: 1000 }}>{editingProjectId ? "Edit Project" : "Add Project"}</span>
          <div style={{ display: "inline-flex", gap: 8, border: "1px solid #dbe5ef", borderRadius: 999, padding: 6, marginBottom: 14, background: "#f8fbff" }}>
            <button type="button" className={`suTabBtn ${projectSettingsTab === "details" ? "active" : ""}`} onClick={() => onProjectSettingsTabChange("details")}>Project Details</button>
            <button type="button" className={`suTabBtn ${projectSettingsTab === "jira" ? "active" : ""}`} onClick={() => onProjectSettingsTabChange("jira")}>Jira Settings</button>
          </div>
          <form onSubmit={onProjectSubmit}>
            {projectSettingsTab === "details" && (
              <>
                <div className="row">
                  <div className="col s12 m6"><div className="input-field"><input value={projectForm.name} onChange={(e) => onProjectChange("name", e.target.value)} /><label className="active">Project Name *</label></div></div>
                  <div className="col s12 m3">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.owner} onChange={(e) => onProjectChange("owner", e.target.value)}>
                        <option value="">Owner / Lead</option>
                        {adminAndSupers.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}
                      </select>
                      <label className="active" style={{ top: -24 }}>Owner / Lead</label>
                    </div>
                  </div>
                  <div className="col s12 m3">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.producer} onChange={(e) => onProjectChange("producer", e.target.value)}>
                        <option value="">Producer / PM</option>
                        {users.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}
                      </select>
                      <label className="active" style={{ top: -24 }}>Producer / PM</label>
                    </div>
                  </div>
                </div>
                <div className="input-field">
                  <textarea className="materialize-textarea" value={projectForm.description} onChange={(e) => onProjectChange("description", e.target.value)} />
                  <label className="active">Description</label>
                </div>
                <div className="row">
                  <div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.totalBudget} onChange={(e) => onProjectChange("totalBudget", e.target.value)} /><label className="active">Total Budget</label></div></div>
                  <div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.consumedBudget} onChange={(e) => onProjectChange("consumedBudget", e.target.value)} /><label className="active">Consumed Budget</label></div></div>
                  <div className="col s12 m4">
                    <div className="input-field">
                      <select className="browser-default" value={projectForm.status} onChange={(e) => onProjectChange("status", e.target.value)}>
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
                      <select className="browser-default" value={projectForm.releaseStatus} onChange={(e) => onProjectChange("releaseStatus", e.target.value as any)}>
                        <option value="dev">Dev (Not Released)</option>
                        <option value="internal">Internal</option>
                        <option value="candidate">Candidate</option>
                        <option value="released">Released</option>
                      </select>
                      <label className="active" style={{ top: -24 }}>Release Status</label>
                    </div>
                  </div>
                  <div className="col s12 m6"><div className="input-field"><input placeholder="v1.0.0" value={projectForm.channel} onChange={(e) => onProjectChange("channel", e.target.value)} /><label className="active">Release Version</label></div></div>
                </div>
                <div className="row">
                  <div className="col s12 m12">
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 12, color: "#475569", fontWeight: 800, marginBottom: 8 }}>Platforms</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                        <select
                          className="browser-default"
                          value={projectForm.platform}
                          onChange={(e) => onProjectChange("platform", e.target.value)}
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
                          onChange={(e) => onCustomPlatformChange(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn-flat"
                          onClick={onUseCustomPlatform}
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
                        <select className="browser-default" value={projectForm.promoteFromVersion} onChange={(e) => onProjectChange("promoteFromVersion", e.target.value)}>
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
              </>
            )}

            {projectSettingsTab === "jira" && (
              <>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14, background: "#f8fafc" }}>
                  <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Global Jira Connection</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Connected workspace: <b>{safeStr(jiraConnectStatus?.cloudName) || "Not connected"}</b>
                    {safeStr(jiraConnectStatus?.cloudId) ? ` (${safeStr(jiraConnectStatus?.cloudId)})` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-flat" onClick={onLoadJiraConnectStatus}>
                      Refresh Jira Connection
                    </button>
                    {!!safeStr(jiraConnectStatus?.cloudId) && (
                      <button
                        type="button"
                        className="btn-flat"
                        onClick={onUseConnectedCloudId}
                      >
                        Use Connected Cloud ID
                      </button>
                    )}
                  </div>
                </div>

                <div className="row">
                  <div className="col s12">
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#334155" }}>
                      <input
                        type="checkbox"
                        checked={projectForm.jiraEnabled}
                        onChange={(e) => onProjectChange("jiraEnabled", e.target.checked)}
                      />
                      <span>Enable Jira for this project</span>
                    </label>
                  </div>
                </div>

                <div className="row">
                  <div className="col s12 m4">
                    <div className="input-field">
                      <input
                        value={projectForm.jiraProjectKey}
                        onChange={(e) => onProjectChange("jiraProjectKey", safeStr(e.target.value).toUpperCase())}
                        placeholder="FLWEB"
                      />
                      <label className="active">Jira Project Key (Space)</label>
                    </div>
                  </div>
                  <div className="col s12 m4">
                    <div className="input-field">
                      <input
                        value={projectForm.jiraCloudId}
                        onChange={(e) => onProjectChange("jiraCloudId", e.target.value)}
                        placeholder="Cloud ID"
                      />
                      <label className="active">Jira Cloud ID</label>
                    </div>
                  </div>
                  <div className="col s12 m4">
                    <div className="input-field">
                      <input
                        value={projectForm.jiraBoardId}
                        onChange={(e) => onProjectChange("jiraBoardId", e.target.value)}
                        placeholder="Board ID (optional)"
                      />
                      <label className="active">Jira Board ID (optional)</label>
                    </div>
                  </div>
                </div>
              </>
            )}

            <button className="btn" type="submit" disabled={projectSaving}>{projectSaving ? "Saving..." : editingProjectId ? "Update Project" : "Save Project"}</button>
            {editingProjectId && <button type="button" className="btn-flat" onClick={onResetProjectForm}>Reset</button>}
          </form>
        </div>
      </div>
    </>
  );
}
