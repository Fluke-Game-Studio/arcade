import { useCallback, useEffect, useState } from "react";
import type { ApiProject } from "../api";
import { useAuth } from "../auth/AuthContext";
import ProjectOnboardingJourney from "../components/onboarding/ProjectOnboardingJourney";
import { getProjectOnboarding, PROJECT_ONBOARDING_TABS, projectTabComplete, visibleProjectSections, type SetupPlatform } from "../components/onboarding/projectOnboarding";

type Progress = { checked?: Record<string, boolean>; platform?: SetupPlatform };
export default function ProjectOnboardingPage() {
  const { api } = useAuth();
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [active, setActive] = useState<ApiProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const close = useCallback(() => setActive(null), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setProjects([]);
    api.getMyProjectOnboarding().then(result => {
      if (!cancelled) { setProjects(result.items); setProgress(result.progress || {}); }
    }).catch(err => { if (!cancelled) setError(err?.message || "Could not load your assigned projects."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, reload]);
  const save = useCallback(async (next: { checked: Record<string, boolean>; platform: SetupPlatform }) => {
    if (!active) return;
    await api.saveMyProjectOnboarding(active.projectId, next.checked, next.platform);
    setProgress(previous => ({ ...previous, [active.projectId]: next }));
  }, [api, active]);
  return <main style={{ padding: 24 }}>
    <h4>Project onboarding</h4>
    <p>Complete setup for your assigned projects. Open each section, follow the instructions, and check off each requirement to continue.</p>
    {loading ? <p role="status">Loading your projects...</p> : error ? <div role="alert">{error} <button type="button" className="btn-flat" onClick={() => setReload(value => value + 1)}>Retry</button></div> : !projects.length ? <p>No projects are assigned to you yet. Contact your manager for an assignment.</p> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap: 18 }}>
        {projects.map(project => {
          const saved = progress[project.projectId] || {};
          const data = getProjectOnboarding(project);
          const complete = !!saved.platform && PROJECT_ONBOARDING_TABS.every(tab => projectTabComplete(visibleProjectSections(data[tab.id], saved.platform!), saved.checked || {}));
          const started = Object.values(saved.checked || {}).some(Boolean);
          return <article className="card" key={project.projectId} style={{ padding: 22, margin: 0, borderRadius: 20, display: "grid", gap: 12 }}>
            <h5 style={{ margin: 0 }}>{project.name || project.projectId}</h5>
            {project.description && <p>{project.description}</p>}
            <span>{complete ? "Completed" : started ? "In progress" : "Ready to start"}</span>
            <button type="button" className="btn" style={{ textTransform: "none" }} onClick={() => setActive(project)}>{complete ? "Review onboarding" : started ? "Continue onboarding" : "Start onboarding"}</button>
          </article>;
        })}
      </div>}
    {active && <ProjectOnboardingJourney key={active.projectId} project={active} mode="employee" initialProgress={progress[active.projectId]} onSaveProgress={save} onClose={close} />}
  </main>;
}
