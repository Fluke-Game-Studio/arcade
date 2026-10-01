import type { ApiProject, ApiUser } from "../../api";

type ProjectSettingsTab = "details" | "jira";
type ProjectForm = {
  name: string; description: string; owner: string; producer: string; totalBudget: string; consumedBudget: string; status: string;
  releaseStatus: "dev" | "internal" | "candidate" | "released"; channel: string; platform: string; promoteFromVersion: string; downloadUrl: string;
  jiraEnabled: boolean; jiraProjectKey: string; jiraCloudId: string; jiraBoardId: string;
};

type Props = {
  projects: ApiProject[]; users: ApiUser[]; adminAndSupers: ApiUser[]; loading: boolean; editingProjectId: string | null;
  projectModalOpen: boolean; projectSaving: boolean; projectSettingsTab: ProjectSettingsTab; projectForm: ProjectForm;
  customPlatform: string; platformOptions: string[]; jiraConnectStatus: any; onOpenNewProject: () => void;
  onProjectEdit: (p: ApiProject) => void; onProjectSubmit: (e: React.FormEvent) => void;
  onProjectChange: <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => void; onResetProjectForm: () => void;
  onProjectSettingsTabChange: (tab: ProjectSettingsTab) => void; onLoadJiraConnectStatus: () => void;
  onUseConnectedCloudId: () => void; onCustomPlatformChange: (value: string) => void; onUseCustomPlatform: () => void;
  safeStr: (value: any) => string;
};

export default function SuperProjectsTab(props: Props) {
  const { projects, users, adminAndSupers, loading, editingProjectId, projectModalOpen, projectSaving, projectSettingsTab, projectForm, customPlatform, platformOptions, jiraConnectStatus, onOpenNewProject, onProjectEdit, onProjectSubmit, onProjectChange, onResetProjectForm, onProjectSettingsTabChange, onLoadJiraConnectStatus, onUseConnectedCloudId, onCustomPlatformChange, onUseCustomPlatform, safeStr } = props;
  const selectedPlatforms = Array.from(new Set(projectForm.platform.split(",").map((value) => safeStr(value).toLowerCase()).filter(Boolean)));

  function addPlatform(value: string) {
    const platform = safeStr(value).toLowerCase();
    if (!platform || selectedPlatforms.includes(platform)) return;
    onProjectChange("platform", [...selectedPlatforms, platform].join(","));
  }

  function removePlatform(platform: string) {
    onProjectChange("platform", selectedPlatforms.filter((value) => value !== platform).join(","));
  }

  return (
    <>
      <style>{`
        .projectModalBackdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.58)}
        .projectModal{width:min(900px,100%);max-height:min(88vh,820px);overflow:auto;border-radius:20px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.28)}
        .projectModalHead{position:sticky;top:0;z-index:1;display:flex;justify-content:space-between;gap:16px;align-items:flex-start;padding:18px 20px;border-bottom:1px solid #e6edf2;background:#fff}
        .projectModalTitle{color:#0f172a;font-size:20px;font-weight:1000}.projectModalBody{padding:20px}
        .projectModalClose{border:0;background:#f1f5f9;border-radius:999px;width:34px;height:34px;cursor:pointer;color:#334155}
      `}</style>
      <div className="suCard">
        <div className="card-content">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="card-title" style={{ fontWeight: 1000, margin: 0 }}>Existing Projects {loading ? "(Loading...)" : `(${projects.length})`}</span>
            <button type="button" className="btn blue" onClick={onOpenNewProject}>Add Project</button>
          </div>
          {!loading && (projects.length ? (
            <table className="highlight responsive-table"><thead><tr><th>Name</th><th>Owner</th><th>Producer</th><th>Status</th><th>Jira</th><th>Budget</th><th>Actions</th></tr></thead><tbody>
              {projects.map((p) => {
                const owner = users.find((u) => u.username === p.project_owner); const producer = users.find((u) => u.username === p.project_producer);
                const jira = (p as any).jira_enabled === true || String((p as any).jira_enabled || "").toLowerCase() === "true";
                return <tr key={p.projectId}><td><b>{p.name}</b><div style={{ fontSize: 12, color: "#64748b" }}>{p.projectId}</div></td><td>{owner?.employee_name || p.project_owner || "-"}</td><td>{producer?.employee_name || p.project_producer || "-"}</td><td>{safeStr(p.status || "active").toUpperCase()}</td><td>{jira ? <><b style={{ color: "#15803d" }}>Enabled</b><div style={{ fontSize: 12, color: "#64748b" }}>{safeStr((p as any).jira_project_key) || "-"}</div></> : <span style={{ color: "#64748b" }}>Disabled</span>}</td><td>{p.project_budget_total ? `${p.project_budget_consumed || 0}/${p.project_budget_total}` : "-"}</td><td><button type="button" className="btn-small blue" onClick={() => onProjectEdit(p)}>Edit</button></td></tr>;
              })}
            </tbody></table>
          ) : <p className="grey-text">No projects yet.</p>)}
        </div>
      </div>

      {projectModalOpen && <div className="projectModalBackdrop" role="dialog" aria-modal="true" aria-label={editingProjectId ? "Edit project" : "Add project"}>
        <div className="projectModal">
          <div className="projectModalHead"><div><div className="projectModalTitle">{editingProjectId ? "Edit Project" : "Add Project"}</div><div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>Project information and Jira settings</div></div><button type="button" className="projectModalClose" aria-label="Close" onClick={onResetProjectForm}>x</button></div>
          <div className="projectModalBody">
            <div className="suTabs" style={{ marginBottom: 18 }}><button type="button" className={`suTabBtn ${projectSettingsTab === "details" ? "active" : ""}`} onClick={() => onProjectSettingsTabChange("details")}>Project Details</button><button type="button" className={`suTabBtn ${projectSettingsTab === "jira" ? "active" : ""}`} onClick={() => onProjectSettingsTabChange("jira")}>Jira Settings</button></div>
            <form onSubmit={onProjectSubmit}>
              {projectSettingsTab === "details" && <>
                <div className="row"><div className="col s12 m6"><div className="input-field"><input value={projectForm.name} onChange={(e) => onProjectChange("name", e.target.value)} /><label className="active">Project Name *</label></div></div><div className="col s12 m3"><div className="input-field"><select className="browser-default" value={projectForm.owner} onChange={(e) => onProjectChange("owner", e.target.value)}><option value="">Owner / Lead</option>{adminAndSupers.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}</select><label className="active" style={{ top: -24 }}>Owner / Lead</label></div></div><div className="col s12 m3"><div className="input-field"><select className="browser-default" value={projectForm.producer} onChange={(e) => onProjectChange("producer", e.target.value)}><option value="">Producer / PM</option>{users.map((u) => <option key={u.username} value={u.username}>{u.employee_name}</option>)}</select><label className="active" style={{ top: -24 }}>Producer / PM</label></div></div></div>
                <div className="input-field"><textarea className="materialize-textarea" value={projectForm.description} onChange={(e) => onProjectChange("description", e.target.value)} /><label className="active">Description</label></div>
                <div className="row"><div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.totalBudget} onChange={(e) => onProjectChange("totalBudget", e.target.value)} /><label className="active">Total Budget</label></div></div><div className="col s12 m4"><div className="input-field"><input type="number" value={projectForm.consumedBudget} onChange={(e) => onProjectChange("consumedBudget", e.target.value)} /><label className="active">Consumed Budget</label></div></div><div className="col s12 m4"><div className="input-field"><select className="browser-default" value={projectForm.status} onChange={(e) => onProjectChange("status", e.target.value)}><option value="active">Active</option><option value="on-hold">On Hold</option><option value="planning">Planning</option><option value="closed">Closed</option><option value="inactive">Inactive</option></select><label className="active" style={{ top: -24 }}>Status</label></div></div></div>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#475569", fontWeight: 800, marginBottom: 8 }}>Platforms</div>
                  {selectedPlatforms.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>{selectedPlatforms.map((platform) => <span key={platform} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#e0f2fe", color: "#075985", fontSize: 12, fontWeight: 800 }}>{platform}<button type="button" aria-label={`Remove ${platform}`} onClick={() => removePlatform(platform)} style={{ border: 0, background: "transparent", color: "#075985", cursor: "pointer", fontWeight: 1000, padding: 0, lineHeight: 1 }}>x</button></span>)}</div> : <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 10 }}>No platforms selected</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}><select className="browser-default" value="" onChange={(e) => addPlatform(e.target.value)}><option value="">Select a platform</option>{platformOptions.filter((platform) => !selectedPlatforms.includes(platform)).map((platform) => <option key={platform} value={platform}>{platform}</option>)}</select><span style={{ alignSelf: "center", fontSize: 12, color: "#64748b" }}>Select multiple</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}><input placeholder="Add custom platform" value={customPlatform} onChange={(e) => onCustomPlatformChange(e.target.value)} /><button type="button" className="btn-flat" onClick={onUseCustomPlatform}>Use Custom</button></div>
                </div>
              </>}
              {projectSettingsTab === "jira" && <>
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, marginBottom: 14, background: "#f8fafc" }}><div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Global Jira Connection</div><div style={{ fontSize: 12, color: "#64748b" }}>Connected workspace: <b>{safeStr(jiraConnectStatus?.cloudName) || "Not connected"}</b>{safeStr(jiraConnectStatus?.cloudId) ? ` (${safeStr(jiraConnectStatus.cloudId)})` : ""}</div><div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}><button type="button" className="btn-flat" onClick={onLoadJiraConnectStatus}>Refresh Jira Connection</button>{safeStr(jiraConnectStatus?.cloudId) ? <button type="button" className="btn-flat" onClick={onUseConnectedCloudId}>Use Connected Cloud ID</button> : null}</div></div>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#334155" }}><input type="checkbox" checked={projectForm.jiraEnabled} onChange={(e) => onProjectChange("jiraEnabled", e.target.checked)} /><span>Enable Jira for this project</span></label>
                <div className="row" style={{ marginTop: 20 }}><div className="col s12 m4"><div className="input-field"><input value={projectForm.jiraProjectKey} onChange={(e) => onProjectChange("jiraProjectKey", safeStr(e.target.value).toUpperCase())} placeholder="FLWEB" /><label className="active">Jira Project Key</label></div></div><div className="col s12 m4"><div className="input-field"><input value={projectForm.jiraCloudId} onChange={(e) => onProjectChange("jiraCloudId", e.target.value)} placeholder="Cloud ID" /><label className="active">Jira Cloud ID</label></div></div><div className="col s12 m4"><div className="input-field"><input value={projectForm.jiraBoardId} onChange={(e) => onProjectChange("jiraBoardId", e.target.value)} placeholder="Board ID" /><label className="active">Jira Board ID</label></div></div></div>
              </>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}><button type="button" className="btn-flat" onClick={onResetProjectForm}>Cancel</button><button className="btn blue" type="submit" disabled={projectSaving}>{projectSaving ? "Saving..." : editingProjectId ? "Update Project" : "Save Project"}</button></div>
            </form>
          </div>
        </div>
      </div>}
    </>
  );
}
