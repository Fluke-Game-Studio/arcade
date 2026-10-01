import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiProject } from "../../api";
import { useAuth, type SessionUser } from "../../auth/AuthContext";
import OnboardingJourney from "../onboarding/OnboardingJourney";
import ProjectOnboardingJourney from "../onboarding/ProjectOnboardingJourney";
import { createPreviewSession, type PreviewScenario } from "../onboarding/previewSession";
import { DEFAULT_RELEASE_NOTES, DEFAULT_RELEASE_VERSION } from "../ReleaseHighlightsPanel";

function PreviewRun({ scenario, onClose }: { scenario: PreviewScenario; onClose: () => void }) {
  const [session] = useState(() => createPreviewSession(scenario, () => {}));
  const [user, setUser] = useState(() => session.getUser() as SessionUser);
  const [transientPassword, setTransientPassword] = useState("Preview-only-123!");
  const refreshSession = useCallback(async () => { setUser(session.getUser() as SessionUser); }, [session]);
  const applySessionPatch = useCallback((patch: Partial<SessionUser>) => {
    session.patch(patch); setUser(session.getUser() as SessionUser);
  }, [session]);
  const clearTransientPassword = useCallback(() => setTransientPassword(""), []);
  const preview = useMemo(() => ({
    api: session.api as unknown as ReturnType<typeof useAuth>["api"], user, transientPassword,
    refreshSession, applySessionPatch, clearTransientPassword, onClose,
  }), [session, user, transientPassword, refreshSession, applySessionPatch, clearTransientPassword, onClose]);
  return <OnboardingJourney preview={preview} />;
}

export default function SuperOnboardingTab({ projects, loading, isSuperUser, onRefresh }: {
  projects: ApiProject[]; loading: boolean; isSuperUser: boolean; onRefresh: () => void;
}) {
  const { api } = useAuth();
  const [query, setQuery] = useState("");
  const [activeProject, setActiveProject] = useState<ApiProject | null>(null);
  const closeProject = useCallback(() => setActiveProject(null), []);
  const [release, setRelease] = useState({ releaseVersion: DEFAULT_RELEASE_VERSION, releaseNotes: DEFAULT_RELEASE_NOTES });
  const [releaseMessage, setReleaseMessage] = useState("Loading current welcome content...");
  const [releaseLoading, setReleaseLoading] = useState(true);
  const closePreview = useCallback(() => setRun(null), []);
  const [run, setRun] = useState<{ scenario: PreviewScenario; id: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!isSuperUser) return;
    api.getArcadeReleaseConfig().then((value) => {
      if (cancelled) return;
      setRelease({ releaseVersion: value.releaseVersion || DEFAULT_RELEASE_VERSION, releaseNotes: value.releaseNotes ?? DEFAULT_RELEASE_NOTES });
      setReleaseMessage("");
    }).catch(() => { if (!cancelled) setReleaseMessage("Could not load live welcome content. Preview uses the default content for this walkthrough."); })
      .finally(() => { if (!cancelled) setReleaseLoading(false); });
    return () => { cancelled = true; };
  }, [api, isSuperUser]);
  if (!isSuperUser) return <p>Onboarding Console requires super-user access.</p>;
  function start() {
    const scenario: PreviewScenario = { name: "Preview Employee", ...release,
      passwordResetRequired: true, commitmentRequired: true, profileComplete: false, connectionsComplete: false };
    setRun({ scenario, id: Date.now() });
  }
  const filtered = projects.filter((project) => `${project.name} ${project.projectId}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section>
      <style>{`
        .ocTiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 16px; }
        .ocTile { padding: 22px; display: flex; flex-direction: column; gap: 12px; }
        .ocTile h5 { margin: 0; overflow-wrap: anywhere; }
      `}</style>
      <div className="suCard" style={{ padding: 22, marginBottom: 18 }}>
        <h5>Onboarding Console</h5>
        <p>Open organisation onboarding to validate the welcome and setup flow. Admins and supers can skip each step in the preview.</p>
        {releaseMessage && <p role="status">{releaseMessage}</p>}
        <h5>Organisation onboarding</h5>
        <button type="button" className="btn" onClick={start} disabled={releaseLoading} style={{ textTransform: "none" }}>Start organisation onboarding</button>
      </div>
      <h5>Project onboarding</h5>
      <p>Walk through project groups, version control, and editor setup.</p>
      <button type="button" className="btn-flat" onClick={onRefresh} disabled={loading}>Refresh projects</button>
      <>
        <input aria-label="Search projects" placeholder="Search projects..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {loading ? <p role="status">Loading projects...</p> : !filtered.length ? <p>{projects.length ? "No matching projects." : "No projects available. Refresh to try again."}</p> :
          <div className="ocTiles">{filtered.map((project) => <article className="suCard ocTile" key={project.projectId}>
            <i className="material-icons" aria-hidden="true">rocket_launch</i><h5>{project.name || project.projectId}</h5>
            <code>{project.projectId}</code><p>{project.description || "Set up this project's tools and workspace."}</p>
            <span>{project.status || "No status"}</span>
            <button type="button" className="btn" style={{ textTransform: "none" }} onClick={() => setActiveProject(project)}>Start onboarding</button>
          </article>)}</div>}
      </>
      {run && <PreviewRun key={run.id} scenario={run.scenario} onClose={closePreview} />}
      {activeProject && <ProjectOnboardingJourney key={activeProject.projectId} project={activeProject} onClose={closeProject} />}
    </section>
  );
}
