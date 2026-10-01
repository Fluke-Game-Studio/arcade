import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ProjectOnboardingJourney.css";
import type { ApiProject } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import OnboardingShell from "./OnboardingShell";
import OnboardingFooterButton from "./OnboardingFooterButton";
import { useOnboardingScreenshots } from "./useOnboardingScreenshots";
import { getProjectOnboarding, PROJECT_ONBOARDING_TABS, projectSectionComplete, projectTabComplete, visibleProjectSections, projectOnboardingPermissions,
  type ProjectOnboardingTab, type SetupPlatform } from "./projectOnboarding";

export default function ProjectOnboardingJourney({ project, onClose, mode = "preview", initialProgress, onSaveProgress }: {
  project: ApiProject; onClose: () => void; mode?: "preview" | "employee";
  initialProgress?: { checked?: Record<string, boolean>; platform?: SetupPlatform };
  onSaveProgress?: (progress: { checked: Record<string, boolean>; platform: SetupPlatform }) => Promise<void>;
}) {
  const { user, api } = useAuth();
  const role = String(user?.employee_role || user?.role || "").toLowerCase();
  const { canSkip, canManage } = projectOnboardingPermissions(mode, role);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingRef = useRef(false);
  const screenshots = useOnboardingScreenshots(api, project.projectId);
  const installers = useOnboardingScreenshots(api, project.projectId, "installer");
  const installerInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const screenshotInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [draggedInstruction, setDraggedInstruction] = useState("");
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const attachmentsDisabled = !!screenshots.busy || !!screenshots.pending || screenshots.loading;
  function receiveScreenshot(id: string, transfer: DataTransfer) {
    if (!canManage || attachmentsDisabled) return;
    const files = Array.from(transfer.files);
    if (!files.length) {
      for (const item of Array.from(transfer.items)) {
        if (item.kind === "file") { const file = item.getAsFile(); if (file) files.push(file); }
      }
    }
    if (files.length !== 1) {
      setAttachmentMessage(files.length ? "Attach one screenshot at a time to this instruction." : "Paste or drop an image file, rather than an image link.");
      return;
    }
    setAttachmentMessage("");
    void screenshots.upload(id, files[0]);
  }
  const [activeId, setActiveId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>(initialProgress?.checked || {});
  const [finished, setFinished] = useState(false);
  const [platform, setPlatform] = useState<SetupPlatform>(() => initialProgress?.platform || (/mac/i.test(navigator.platform) ? "macos" : /linux/i.test(navigator.platform) ? "linux" : "windows"));
  const [tab, setTab] = useState<ProjectOnboardingTab>(() => {
    if (mode === "preview") return "groups";
    const data = getProjectOnboarding(project);
    return PROJECT_ONBOARDING_TABS.find(item => !projectTabComplete(visibleProjectSections(data[item.id], platform), checked))?.id || "editor";
  });
  const heading = useRef<HTMLHeadingElement>(null);
  const instructions = useMemo(() => getProjectOnboarding(project), [project]);
  const sections = visibleProjectSections(instructions[tab], platform);
  const orderedInstructions = PROJECT_ONBOARDING_TABS.flatMap(item => visibleProjectSections(instructions[item.id], platform)
    .flatMap(section => section.instructions.map((_, i) => `${section.id}:${i}`)));
  const active = sections.find(section => section.id === activeId);
  const complete = (id: ProjectOnboardingTab) => projectTabComplete(visibleProjectSections(instructions[id], platform), checked);
  const allComplete = PROJECT_ONBOARDING_TABS.every(item => complete(item.id));
  const index = PROJECT_ONBOARDING_TABS.findIndex(item => item.id === tab);
  const tabDone = complete(tab);
  const activeIndex = active ? sections.findIndex(section => section.id === active.id) : -1;
  const activeDone = active ? projectSectionComplete(active, checked) : false;
  // Inside a sub-step, the primary button steps to the next sub-step ("Next") until the whole
  // tab is checked off, at which point it switches to advancing tabs ("Continue"/"Finish").
  const showNextStep = !!active && !tabDone;
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "nearest" });
  }, [tab, activeId, finished]);
  function navigate(id: string) {
    if (savingRef.current) return;
    const nextIndex = PROJECT_ONBOARDING_TABS.findIndex(item => item.id === id);
    if (nextIndex < 0) return;
    if (!canSkip && !PROJECT_ONBOARDING_TABS.slice(0, nextIndex).every(item => complete(item.id))) return;
    setTab(id as ProjectOnboardingTab); setActiveId(null); setFinished(false);
  }
  async function persist() {
    if (mode !== "employee") return true;
    if (savingRef.current) return false;
    savingRef.current = true; setSaving(true); setSaveError("");
    try {
      if (!onSaveProgress) throw new Error("Progress saving is unavailable.");
      await onSaveProgress({ checked, platform }); return true;
    } catch (error: any) { setSaveError(error?.message || "Could not save progress. Please try again."); return false; }
    finally { savingRef.current = false; setSaving(false); }
  }
  const closeAction = useRef<() => void>(() => {});
  closeAction.current = () => { void persist().then(saved => { if (saved) onClose(); }); };
  const requestClose = useCallback(() => closeAction.current(), []);
  async function advance() {
    if (!canSkip && !(index === 2 ? allComplete : complete(tab))) return;
    if (!await persist()) return;
    if (index === PROJECT_ONBOARDING_TABS.length - 1) setFinished(true);
    else navigate(PROJECT_ONBOARDING_TABS[index + 1].id);
  }
  return (
    <OnboardingShell title={`${project.name || project.projectId} — Project Onboarding`}
      subtitle="Set up your project groups, version control, and Unreal Editor."
      onClose={requestClose}
      onChapterSelect={navigate}
      chapters={PROJECT_ONBOARDING_TABS.map(item => ({ ...item, active: !finished && item.id === tab, complete: complete(item.id) }))}
      footer={finished ? <OnboardingFooterButton icon="check" primary disabled={saving} onClick={requestClose}>Done</OnboardingFooterButton> : (
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <OnboardingFooterButton icon="arrow_back" disabled={saving} onClick={() => active ? setActiveId(null) : index ? navigate(PROJECT_ONBOARDING_TABS[index - 1].id) : requestClose()}>
            {active ? `Back to ${PROJECT_ONBOARDING_TABS[index].label}` : index ? "Back" : "Close"}
          </OnboardingFooterButton>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {canSkip && <OnboardingFooterButton icon="skip_next" onClick={advance}>Skip step</OnboardingFooterButton>}
            <OnboardingFooterButton icon="arrow_forward" primary
              disabled={saving || (showNextStep ? !activeDone : (index === 2 ? !allComplete : !complete(tab)))}
              onClick={() => {
                if (showNextStep) {
                  if (activeIndex >= 0 && activeIndex < sections.length - 1) setActiveId(sections[activeIndex + 1].id);
                  return;
                }
                void advance();
              }}>
              {saving ? "Saving..." : showNextStep ? "Next" : index === 2 ? "Finish onboarding" : "Continue"}
            </OnboardingFooterButton>
          </div>
        </div>
      )}>
      <style>{`
        .projectSetup { display: grid; gap: 16px; }
        .projectSetup h2 { margin: 0; color: #0f172a; font-size: 26px; font-weight: 1000; }
        .projectSetupPanel { display: flex; align-items: center; justify-content: space-between; gap: 16px; width: 100%; text-align: left; border: 1px solid #dbe3ef; border-radius: 20px; padding: 18px; background: white; color: #0f172a; cursor: pointer; font: inherit; }
        .projectSetupPanel[data-complete="true"] { background: #ecfdf5; border-color: #a7f3d0; }
        .projectSetupPanel:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
        .projectSetupItem { border: 1px solid #dbe3ef; background: white; border-radius: 16px; padding: 16px; display: grid; gap: 12px; }
        .projectSetupItem label { display: flex; align-items: flex-start; gap: 12px; color: #334155; font-size: 15px; line-height: 1.7; cursor: pointer; }
        .projectSetupItem input[type="checkbox"] { position: static; opacity: 1; pointer-events: auto; appearance: auto; width: 20px; height: 20px; flex: 0 0 20px; margin: 3px 0 0; accent-color: #2563eb; }
        .projectSetupItem input[type="checkbox"] + span { padding: 0; height: auto; line-height: inherit; }
        .projectSetupItem input[type="checkbox"] + span::before, .projectSetupItem input[type="checkbox"] + span::after { display: none; }
        .projectSetupItem code { white-space: pre-wrap; overflow-wrap: anywhere; display: block; color: #0f172a; padding: 12px; border-radius: 8px; background: #f1f5f9; }
        .projectInstructionRow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 35%); gap: 16px; align-items: start; }
        .projectInstructionRow > div { min-width: 0; display: grid; gap: 12px; }
        .projectInstructionRow img { display: block; width: 100%; max-height: 260px; object-fit: contain; border-radius: 10px; border: 1px solid #dbe3ef; }
        .projectSetupItem .screenshotUpload { display: inline-flex; width: fit-content; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 10px; font-weight: 700; background: #f8fafc; }
        .screenshotDropZone { padding: 12px; border: 2px dashed #cbd5e1; border-radius: 12px; background: #f8fafc; }
        .screenshotDropZone:focus, .screenshotDropZone:focus-within, .screenshotDropZone[data-dragging="true"] { outline: 2px solid #2563eb; outline-offset: 2px; border-color: #2563eb; background: #eff6ff; }
        .screenshotDropZone[aria-disabled="true"] { opacity: .65; }
        @media(max-width: 650px) { .projectInstructionRow { grid-template-columns: 1fr; } }
      `}</style>
      <section className="projectSetup">
        {saveError && <div role="alert">{saveError}</div>}
        {mode === "employee" && <small>Progress is saved when you continue or close this window.</small>}
        {screenshots.loadError && <div role="alert">Could not load screenshots: {screenshots.loadError} <button type="button" className="btn-flat" onClick={screenshots.refresh}>Retry</button></div>}
        {screenshots.error && <div role="alert">{screenshots.error}</div>}
        {installers.loadError && <div role="alert">Could not load setup files: {installers.loadError} <button type="button" onClick={installers.refresh}>Retry</button></div>}
        {installers.error && <div role="alert">{installers.error}</div>}
        {installers.pending && !installers.busy && <button type="button" onClick={() => void installers.retry()}>Retry saving setup attachment</button>}
        {attachmentMessage && <div role="alert">{attachmentMessage}</div>}
        {screenshots.pending && !screenshots.busy && <div>Image uploaded. Save its attachment to the instruction: <button type="button" className="btn-flat" onClick={() => void screenshots.retry()}>Retry saving screenshot</button></div>}
        {finished ? <>
          <h2 ref={heading} tabIndex={-1}>{allComplete ? "Project onboarding complete" : "Project walkthrough finished"}</h2>
          <p>{allComplete ? "You have acknowledged every setup instruction." : "Some setup checklists were skipped during this preview. You can revisit them using the tabs above."}</p>
        </> : <>
          {active && <OnboardingFooterButton icon="arrow_back" disabled={saving} onClick={() => setActiveId(null)}>Back to {PROJECT_ONBOARDING_TABS[index].label}</OnboardingFooterButton>}
          <h2 ref={heading} tabIndex={-1}>{active?.title || PROJECT_ONBOARDING_TABS[index].label}</h2>
          {tab === "editor" && <label style={{ color: "#475569", fontSize: 14 }}>Operating system
            <select className="browser-default" disabled={saving} value={platform} onChange={event => { setPlatform(event.target.value as SetupPlatform); setActiveId(null); }}>
              <option value="windows">Windows</option><option value="macos">macOS</option><option value="linux">Linux</option>
            </select>
          </label>}
          {active ? <>
            <p>Complete each instruction and check it off before continuing.</p>
            {active.instructions.map((instruction, instructionIndex) => {
              const id = `${active.id}:${instructionIndex}`;
              const image = screenshots.images[id];
              const previousScreenshotId = orderedInstructions.slice(0, orderedInstructions.indexOf(id)).reverse().find(previousId => screenshots.images[previousId]);
              const installer = installers.images[id];
              return <div className="projectSetupItem projectInstructionRow" key={id}>
                <div>
                <label><input type="checkbox" disabled={saving} checked={checked[id] === true} onChange={event => setChecked(previous => ({ ...previous, [id]: event.target.checked }))} /><span>{instruction.text}</span></label>
                {instruction.code && <code>{instruction.code}</code>}
                {instruction.href && <a href={instruction.href} target="_blank" rel="noopener noreferrer">Open {active.title.replace(/^\d+\. /, "")} link ↗</a>}
                </div>
                <div>
                <div className={canManage ? "screenshotDropZone" : undefined}
                  role={canManage ? "group" : undefined}
                  tabIndex={canManage ? 0 : undefined}
                  aria-label={canManage ? `Screenshot attachment for ${instruction.text}. Drop an image or focus here and paste.` : undefined}
                  aria-disabled={canManage ? attachmentsDisabled : undefined}
                  data-dragging={draggedInstruction === id}
                  onClick={event => { if (canManage && !(event.target as HTMLElement).closest("button, a, input")) event.currentTarget.focus(); }}
                  onDragEnter={event => {
                    if (!canManage || !Array.from(event.dataTransfer.types).includes("Files")) return;
                    event.preventDefault(); if (!attachmentsDisabled) setDraggedInstruction(id);
                  }}
                  onDragOver={event => {
                    if (!canManage || !Array.from(event.dataTransfer.types).includes("Files")) return;
                    event.preventDefault(); event.dataTransfer.dropEffect = attachmentsDisabled ? "none" : "copy";
                  }}
                  onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggedInstruction(""); }}
                  onDrop={event => {
                    if (!canManage) return;
                    event.preventDefault(); event.stopPropagation(); setDraggedInstruction("");
                    event.currentTarget.focus(); receiveScreenshot(id, event.dataTransfer);
                  }}
                  onPaste={event => {
                    if (!canManage) return;
                    const hasFile = event.clipboardData.files.length > 0 || Array.from(event.clipboardData.items).some(item => item.kind === "file");
                    if (!hasFile) return;
                    event.preventDefault(); event.stopPropagation(); receiveScreenshot(id, event.clipboardData);
                  }}>
                  {image && <a href={image.url} target="_blank" rel="noopener noreferrer" title="Open full-size screenshot" className="screenshotImageLink">
                    <img src={image.url} alt={`Screenshot for ${instruction.text}`} loading="lazy" />
                  </a>}
                  {canManage && <div className="screenshotFooter">
                    {previousScreenshotId && <button type="button" className="screenshotUpload" disabled={attachmentsDisabled}
                      onClick={() => void screenshots.changeScreenshot(id, previousScreenshotId)}>Reuse screenshot from above</button>}
                    {image && <button type="button" className="screenshotUpload" disabled={attachmentsDisabled}
                      title="Delete this screenshot from this instruction. Other steps using it keep their screenshot."
                      onClick={() => void screenshots.changeScreenshot(id)}>Delete screenshot</button>}
                    <small className="screenshotHint">Drop a screenshot here, or click this area and paste with Ctrl+V / ⌘V.</small>
                    <button type="button" className="screenshotUpload"
                      disabled={!!screenshots.busy || !!screenshots.pending || screenshots.loading}
                      onClick={() => screenshotInputs.current[id]?.click()}>
                    <span>{screenshots.busy === id ? (screenshots.progress === 100 ? "Saving screenshot..." : `Uploading ${screenshots.progress}%`) : image ? "Replace screenshot" : "Attach screenshot"}</span>
                    </button>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label={`Attach screenshot: ${instruction.text}`}
                      ref={node => { screenshotInputs.current[id] = node; }}
                      disabled={!!screenshots.busy || !!screenshots.pending || screenshots.loading}
                      hidden
                      onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { setAttachmentMessage(""); void screenshots.upload(id, file); } }} />
                  </div>}
                </div>
                {(canManage || installer) && <div className="installerBox">
                  <strong>Setup installer</strong>
                  {installer && <a href={installer.url} download={installer.name} className="installerDownload" title={`Download ${installer.name}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
                    </svg>
                    <span>Download installer</span>
                  </a>}
                  {canManage && <>
                    <small>Attach an EXE or MSI (up to 250 MB) for this instruction.</small>
                    <button type="button" className="screenshotUpload" disabled={!!installers.busy || !!installers.pending || installers.loading} onClick={() => installerInputs.current[id]?.click()}>
                      {installers.busy === id ? (installers.progress === 100 ? "Saving setup file..." : `Uploading ${installers.progress}%`) : installer ? "Replace setup file" : "Attach setup file"}
                    </button>
                    <input type="file" hidden accept=".exe,.msi" aria-label={`Attach setup file: ${instruction.text}`} ref={node => { installerInputs.current[id] = node; }} disabled={!!installers.busy || !!installers.pending || installers.loading}
                      onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void installers.upload(id, file); }} />
                  </>}
                </div>}
                </div>
              </div>;
            })}
          </> : <>
            <p>Open each panel to review the setup instructions and complete its checklist.</p>
            {sections.map(section => {
              const done = projectSectionComplete(section, checked);
              const count = section.instructions.filter((_, i) => checked[`${section.id}:${i}`]).length;
              return <button key={section.id} type="button" className="projectSetupPanel" data-complete={done} onClick={() => setActiveId(section.id)}>
                <span><strong style={{ fontSize: 18 }}>{section.title}</strong><span style={{ display: "block", marginTop: 6, color: "#64748b" }}>{done ? "Complete" : `${count} of ${section.instructions.length} complete`}</span></span>
                <i className="material-icons" aria-hidden="true">{done ? "check_circle" : "chevron_right"}</i>
              </button>;
            })}
          </>}
        </>}
      </section>
    </OnboardingShell>
  );
}
