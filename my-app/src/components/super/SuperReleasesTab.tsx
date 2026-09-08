import { useEffect, useState } from "react";

declare const M: any;

const BUILD_STAGES = [
  { value: "dev", label: "Dev" },
  { value: "internal", label: "Stable" },
  { value: "candidate", label: "RC" },
  { value: "released", label: "Production" },
];

type Props = {
  api: any;
  isSuperUser: boolean;
};

export default function SuperReleasesTab({ api, isSuperUser }: Props) {
  const [projects, setProjects] = useState<Array<{ projectId: string; name: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [stage, setStage] = useState("");
  const [builds, setBuilds] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingBuilds, setLoadingBuilds] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [deletingKey, setDeletingKey] = useState("");
  const [error, setError] = useState("");

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const data = await api.getSuperBuildProjects();
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
      setError("");
    } catch (e: any) {
      setProjects([]);
      setError(e?.message || "Failed to load build projects");
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadBuilds(nextProjectId = projectId, nextStage = stage) {
    if (!nextProjectId || !nextStage) {
      setBuilds([]);
      return;
    }
    setLoadingBuilds(true);
    try {
      const data = await api.getSuperBuilds(nextProjectId, nextStage);
      setBuilds(Array.isArray(data?.builds) ? data.builds : []);
      setError("");
    } catch (e: any) {
      setBuilds([]);
      setError(e?.message || "Failed to load builds");
    } finally {
      setLoadingBuilds(false);
    }
  }

  useEffect(() => {
    if (isSuperUser) void loadProjects();
  }, [isSuperUser]);

  async function toggleBuild(build: any) {
    if (!isSuperUser || !projectId || !build?.releaseKey) return;
    const key = `${projectId}|${build.releaseKey}`;
    setSavingKey(key);
    try {
      await api.setSuperBuildVisibility({
        projectId,
        releaseKey: build.releaseKey,
        visible: !build.visible,
      });
      await loadBuilds();
      if (typeof M !== "undefined") {
        M.toast({ html: build.visible ? "Build hidden from employee downloads" : "Build visible to employees", classes: "green" });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to update build visibility");
    } finally {
      setSavingKey("");
    }
  }

  async function deleteBuild(build: any) {
    if (!isSuperUser || !projectId || !build?.releaseKey) return;
    const key = `${projectId}|${build.releaseKey}`;
    const label = String(build.version || build.fileName || "this build");
    if (!window.confirm(`Permanently delete ${label}? This removes the installer and its manifest from Cloudflare and cannot be undone.`)) {
      return;
    }
    setDeletingKey(key);
    try {
      await api.deleteSuperBuild({ projectId, releaseKey: build.releaseKey });
      await loadBuilds();
      if (typeof M !== "undefined") {
        M.toast({ html: "Build deleted", classes: "green" });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to delete build");
    } finally {
      setDeletingKey("");
    }
  }

  async function promoteBuild(build: any) {
    const targetStage =
      build?.stage === "dev" ? "internal" : build?.stage === "internal" ? "candidate" : build?.stage === "candidate" ? "released" : "";
    if (!isSuperUser || !projectId || !targetStage || !build?.releaseKey) return;
    const key = `${projectId}|${build.releaseKey}|promote`;
    setSavingKey(key);
    try {
      await api.promoteSuperBuild({ projectId, releaseKey: build.releaseKey, targetStage });
      await loadBuilds();
      if (typeof M !== "undefined") {
        M.toast({
          html:
            targetStage === "internal"
              ? "Build promoted to Stable"
              : targetStage === "candidate"
              ? "Build promoted to Release Candidate"
              : "Build promoted to Production",
          classes: "green",
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to promote build");
    } finally {
      setSavingKey("");
    }
  }

  if (!isSuperUser) {
    return <div className="suCard"><div className="card-content"><p>Super role required.</p></div></div>;
  }

  return (
    <>
      <style>{`
        .superBuildsPanel { border-radius: 20px; overflow: hidden; border: 1px solid #e6edf2; background: #fff; }
        .superBuildsPanel .panelHead { padding: 14px 16px; border-bottom: 1px solid #eceff1; background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%); display: flex; align-items: flex-start; gap: 12px; }
        .superBuildsPanel .panelHead .h { font-weight: 1000; color: #0f172a; font-size: 14.5px; }
        .superBuildsPanel .panelHead .p { margin-top: 2px; color: #607d8b; font-size: 12px; }
        .superBuildsPanel .emptyState { padding: 14px; border-radius: 14px; border: 1px dashed #d7e0e7; background: #fbfdff; color: #607d8b; font-weight: 800; }
        .superBuildsPanel .buildSelectors { display: grid; grid-template-columns: 1.3fr 1fr; gap: 30px; padding: 34px 6px 14px; border-bottom: 1px solid #dfe5e9; }
        .superBuildsPanel .buildSelectors p { margin: 0 0 14px; color: #263238; }
        .superBuildsPanel .buildSelectors select { width: 100%; height: 45px; padding: 0 10px; border: 1px solid #e5e7eb; background: #fff; }
        @media (max-width: 700px) { .superBuildsPanel .buildSelectors { grid-template-columns: 1fr; gap: 16px; } }
      `}</style>
    <section className="superBuildsPanel">
      <div className="panelHead">
        <div>
          <div className="h">Builds & Downloads</div>
          <div className="p">Pick a project and a stage to see the latest builds. Super users can control employee visibility.</div>
        </div>
      </div>
      <div style={{ padding: "0 16px 16px" }}>
        {error ? <div style={{ color: "#b91c1c", fontWeight: 700, marginBottom: 12 }}>{error}</div> : null}
        {loadingProjects ? <div style={{ color: "#64748b" }}>Loading projects...</div> : null}
        {!loadingProjects && !projects.length ? <div className="emptyState">No published build projects found.</div> : null}
        {!loadingProjects && projects.length ? (
          <div className="buildSelectors">
                <div>
                  <p>Project</p>
                  <select
                    className="browser-default"
                    value={projectId}
                    onChange={(e) => { setProjectId(e.target.value); setStage(""); setBuilds([]); }}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => <option key={project.projectId} value={project.projectId}>{project.name}</option>)}
                  </select>
                </div>
                <div>
                  <p>Stage</p>
                  <select
                    className="browser-default"
                    value={stage}
                    disabled={!projectId}
                    onChange={(e) => { setStage(e.target.value); void loadBuilds(projectId, e.target.value); }}
                  >
                    <option value="">Select a stage...</option>
                    {BUILD_STAGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </div>
          </div>
        ) : null}

        {loadingBuilds ? <div style={{ color: "#64748b", marginTop: 16 }}>Loading builds...</div> : null}
        {!loadingBuilds && projectId && stage && !builds.length ? <div className="emptyState" style={{ marginTop: 16 }}>No builds published for this project/stage.</div> : null}
        {builds.length ? (
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {builds.map((build, index) => {
              const key = `${projectId}|${build.releaseKey}`;
              const promotionTarget = String(build.promotedTo || "").toLowerCase();
              const canPromote = (build.stage === "dev" || build.stage === "internal" || build.stage === "candidate") && !promotionTarget;
              const promotionLabel = promotionTarget === "internal"
                ? "Promoted to Stable"
                : promotionTarget === "candidate"
                  ? "Promoted to RC"
                  : promotionTarget === "released"
                    ? "Promoted to Production"
                    : build.stage === "dev"
                      ? "Promote to Stable"
                      : build.stage === "internal"
                        ? "Promote to RC"
                        : "Promote to Production";
              return (
                <div
                  key={`${build.releaseKey || build.fileName}-${index}`}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}
                >
                  <div>
                    <div style={{ fontWeight: 800 }}>{String(build.version || build.fileName || "Build")}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {String(build.fileName || "No file name")} | CL {String(build.changelist || "-")} | {String(build.platform || "all")}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {build.uploadedAt ? new Date(build.uploadedAt).toLocaleString() : ""} | {build.visible ? "Visible to employees" : "Hidden from employees"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {build.logUrl ? (
                      <button type="button" className="accBtn subtle" title="View build log" onClick={() => window.open(build.logUrl, "_blank")}>
                        <i className="material-icons" style={{ fontSize: 18 }}>visibility</i>
                      </button>
                    ) : null}
                    {build.downloadUrl ? (
                      <button type="button" className="accBtn subtle" onClick={() => window.open(build.downloadUrl, "_blank")}>
                        <i className="material-icons" style={{ fontSize: 18 }}>download</i>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="accBtn subtle"
                      disabled={savingKey === key || deletingKey === key}
                      onClick={() => void toggleBuild(build)}
                    >
                      {savingKey === key ? "Saving..." : build.visible ? "Hide" : "Show"}
                    </button>
                    {build.stage === "dev" || build.stage === "internal" || build.stage === "candidate" ? (
                      <button
                        type="button"
                        className="accBtn subtle"
                        disabled={!canPromote || savingKey === `${projectId}|${build.releaseKey}|promote` || deletingKey === key}
                        onClick={() => void promoteBuild(build)}
                      >
                        {savingKey === `${projectId}|${build.releaseKey}|promote`
                          ? "Promoting..."
                          : promotionLabel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="accBtn subtle"
                      title="Permanently delete from Cloudflare"
                      disabled={savingKey === key || deletingKey === key}
                      style={{ color: "#b91c1c", borderColor: "#fca5a5" }}
                      onClick={() => void deleteBuild(build)}
                    >
                      {deletingKey === key ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
    </>
  );
}
