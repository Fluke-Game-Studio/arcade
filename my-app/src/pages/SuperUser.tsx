import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiProject, ApiUser } from "../api";
import { useReleaseProductsData } from "../components/admin/useReleaseProductsData";
import SuperConsoleTabs, { type SuperTab } from "../components/super/SuperConsoleTabs";
import SuperProjectsTab from "../components/super/SuperProjectsTab";
import SuperArcadeReleaseTab from "../components/super/SuperArcadeReleaseTab";
import SuperReleasesTab from "../components/super/SuperReleasesTab";
import SuperStorageTab from "../components/super/SuperStorageTab";
import SuperUsersTab from "../components/super/SuperUsersTab";

declare const M: any;

type ProjectSettingsTab = "details" | "jira";
type AssignableRole = "employee" | "admin" | "super";
type ReadScope = "employee" | "admin" | "super";

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

type StorageItem = { key: string; lastModified?: string; size: number; url?: string };

const DEFAULT_PLATFORMS = ["windows", "mac", "linux", "steam", "epic", "ps5", "xbox", "switch"];
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeRole(v: any) {
  const role = safeStr(v).toLowerCase().replace(/_/g, "-");
  if (role === "super-readonly") return "super";
  if (role === "admin-readonly") return "admin";
  return role;
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
  const [projectSettingsTab, setProjectSettingsTab] = useState<ProjectSettingsTab>("details");
  const [jiraConnectStatus, setJiraConnectStatus] = useState<any>(null);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [storageItems, setStorageItems] = useState<StorageItem[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storagePrefix, setStoragePrefix] = useState("");
  const [storageNameFilter, setStorageNameFilter] = useState("");
  const [storageMinSizeMb, setStorageMinSizeMb] = useState("");
  const [storageMaxSizeMb, setStorageMaxSizeMb] = useState("");
  const [storageUploadedFrom, setStorageUploadedFrom] = useState("");
  const [storageUploadedTo, setStorageUploadedTo] = useState("");
  const [storageDateSort, setStorageDateSort] = useState<"asc" | "desc">("desc");
  const [storageCursor, setStorageCursor] = useState("");
  const [storageTruncated, setStorageTruncated] = useState(false);
  const [storageBucket, setStorageBucket] = useState("");
  const [storageError, setStorageError] = useState("");
  const [arcadeReleaseLoading, setArcadeReleaseLoading] = useState(false);
  const [arcadeReleaseSaving, setArcadeReleaseSaving] = useState(false);
  const [arcadeReleaseVersion, setArcadeReleaseVersion] = useState("");
  const [arcadeReleaseNotes, setArcadeReleaseNotes] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectSaving, setProjectSaving] = useState(false);
  const [savingProductKey, setSavingProductKey] = useState("");
  const [savingProjectVisibilityId, setSavingProjectVisibilityId] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const isSuperUser = normalizeRole((user as any)?.employee_role || (user as any)?.role) === "super";
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
    jiraEnabled: false,
    jiraProjectKey: "",
    jiraCloudId: "",
    jiraBoardId: "",
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

  async function loadJiraConnectStatus() {
    try {
      const status = await (api as any).getJiraConnectStatus?.();
      setJiraConnectStatus(status || null);
    } catch {
      setJiraConnectStatus(null);
    }
  }

  async function loadStorageFiles(nextCursor = "") {
    setStorageLoading(true);
    setStorageError("");
    try {
      const resp = await (api as any).listStorageFiles({
        prefix: storagePrefix || undefined,
        continuationToken: nextCursor || undefined,
        limit: 100,
      });
      setStorageItems(Array.isArray(resp?.items) ? resp.items : []);
      setStorageBucket(safeStr(resp?.bucket));
      setStorageTruncated(Boolean(resp?.truncated));
      setStorageCursor(safeStr(resp?.nextContinuationToken));
    } catch (e: any) {
      setStorageItems([]);
      setStorageCursor("");
      setStorageTruncated(false);
      setStorageError(e?.message || "Failed to load storage files");
    } finally {
      setStorageLoading(false);
    }
  }

  async function loadArcadeReleaseConfig() {
    try {
      setArcadeReleaseLoading(true);
      const resp = await (api as any).getArcadeReleaseConfig();
      setArcadeReleaseVersion(safeStr(resp?.releaseVersion));
      setArcadeReleaseNotes(String(resp?.releaseNotes ?? ""));
    } catch (e: any) {
      M.toast({ html: e?.message || "Failed to load Arcade release config", classes: "red" });
    } finally {
      setArcadeReleaseLoading(false);
    }
  }

  function formatBytesMb(bytes: number) {
    const mb = Number(bytes || 0) / (1024 * 1024);
    if (!Number.isFinite(mb) || mb <= 0) return "0 MB";
    return `${mb >= 10 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
  }

  function isPreviewable(item: StorageItem) {
    const key = safeStr(item.key).toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg|mp4|webm|mov|m4v|ogg)(\?|$)/i.test(key);
  }

  const filteredStorageItems = useMemo(() => {
    const nameQ = storageNameFilter.trim().toLowerCase();
    const minMb = Number(storageMinSizeMb);
    const maxMb = Number(storageMaxSizeMb);
    const fromTs = storageUploadedFrom ? new Date(`${storageUploadedFrom}T00:00:00`).getTime() : 0;
    const toTs = storageUploadedTo ? new Date(`${storageUploadedTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    const filtered = storageItems.filter((item) => {
      const key = safeStr(item.key).toLowerCase();
      const sizeMb = Number(item.size || 0) / (1024 * 1024);
      const modifiedTs = item.lastModified ? new Date(item.lastModified).getTime() : 0;
      if (nameQ && !key.includes(nameQ)) return false;
      if (Number.isFinite(minMb) && minMb > 0 && sizeMb < minMb) return false;
      if (Number.isFinite(maxMb) && maxMb > 0 && sizeMb > maxMb) return false;
      if (fromTs && modifiedTs && modifiedTs < fromTs) return false;
      if (Number.isFinite(toTs) && modifiedTs && modifiedTs > toTs) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const aTs = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTs = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return storageDateSort === "asc" ? aTs - bTs : bTs - aTs;
    });
  }, [storageItems, storageNameFilter, storageMinSizeMb, storageMaxSizeMb, storageUploadedFrom, storageUploadedTo, storageDateSort]);

  useEffect(() => {
    loadUsers();
    loadProjects();
    loadJiraConnectStatus();
  }, []);

  useEffect(() => {
    if (tab === "storage") void loadStorageFiles();
    if (tab === "arcade_release") void loadArcadeReleaseConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        (u.employee_name || "").toLowerCase().includes(q) ||
        (u.employee_email || "").toLowerCase().includes(q) ||
        normalizeRole(u.employee_role || "").includes(q)
    );
  }, [rows, query]);

  const adminAndSupers = useMemo(
    () => rows.filter((u) => normalizeRole(u.employee_role) === "admin" || normalizeRole(u.employee_role) === "super"),
    [rows]
  );

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

  async function setRole(username: string, role: AssignableRole) {
    try {
      await api.updateUser({ username, employee_role: role });
      M.toast({ html: "Role updated", classes: "green" });
      loadUsers();
    } catch (e: any) {
      M.toast({ html: e?.message || "Failed", classes: "red" });
    }
  }

  async function setReadScope(username: string, read_only_scope: ReadScope) {
    try {
      await api.updateUser({ username, read_only_scope } as any);
      M.toast({ html: "Read scope updated", classes: "green" });
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
      jiraEnabled: false,
      jiraProjectKey: "",
      jiraCloudId: "",
      jiraBoardId: "",
    });
    setCustomPlatform("");
    setProjectSettingsTab("details");
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
        jira_enabled: projectForm.jiraEnabled,
        jira_project_key: projectForm.jiraProjectKey || undefined,
        jira_cloud_id: projectForm.jiraCloudId || undefined,
        jira_board_id: projectForm.jiraBoardId || undefined,
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
      jiraEnabled:
        (p as any).jira_enabled === true ||
        String((p as any).jira_enabled || "").toLowerCase() === "true",
      jiraProjectKey: safeStr((p as any).jira_project_key).toUpperCase(),
      jiraCloudId: safeStr((p as any).jira_cloud_id),
      jiraBoardId: safeStr((p as any).jira_board_id),
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
        jira_enabled:
          (p as any).jira_enabled === true ||
          String((p as any).jira_enabled || "").toLowerCase() === "true",
        jira_project_key: safeStr((p as any).jira_project_key).toUpperCase() || undefined,
        jira_cloud_id: safeStr((p as any).jira_cloud_id) || undefined,
        jira_board_id: safeStr((p as any).jira_board_id) || undefined,
      } as any);
      M.toast({ html: shouldBeVisible ? "Project visible on website" : "Project hidden from website", classes: "green" });
      loadProjects();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to update project visibility", classes: "red" });
    } finally {
      setSavingProjectVisibilityId("");
    }
  }

  return (
    <main className="container" style={{ paddingTop: 24, maxWidth: 1200 }}>
      <style>{`
        .suShell { display: flex; flex-direction: column; gap: 14px; }
        .suHero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .suHeader { font-size: 26px; font-weight: 1000; color: #0f172a; letter-spacing: -.02em; }
        .suSub { color: #475569; margin-top: 6px; max-width: 72ch; }
        .suCard { border: 1px solid #e6edf2; border-radius: 18px; background: #fff; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, .05); }
        .suCard .card-content { padding: 16px; }
        .suTabs { display: inline-flex; gap: 8px; border: 1px solid #dbe5ef; border-radius: 999px; padding: 6px; background: #f8fbff; flex-wrap: wrap; }
        .suTabBtn { border: 0; border-radius: 999px; padding: 9px 14px; font-weight: 900; font-size: 13px; cursor: pointer; color: #334155; background: transparent; transition: all .15s ease; }
        .suTabBtn.active { background: rgba(59,130,246,.16); color: #1d4ed8; box-shadow: inset 0 0 0 1px rgba(59,130,246,.12); }
        .suToolbar { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-top: 12px; }
        .suSearch { min-width: 280px; flex: 1 1 320px; }
        .suTableWrap { overflow: auto; border: 1px solid #edf2f7; border-radius: 14px; }
        .suTableWrap table { margin-bottom: 0; min-width: 980px; }
        .suTableWrap thead th { position: sticky; top: 0; z-index: 1; background: #f8fbff; white-space: nowrap; }
        .suMiniSelect { height: 34px !important; border: 1px solid #dbe5ef !important; border-radius: 10px !important; background: #fff !important; padding: 0 10px !important; font-size: 13px; min-width: 92px; }
        .suChip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 900; letter-spacing: .03em; border: 1px solid transparent; white-space: nowrap; }
        .suChip.employee { background: rgba(34,197,94,.10); color: #15803d; border-color: rgba(34,197,94,.18); }
        .suChip.admin { background: rgba(59,130,246,.10); color: #1d4ed8; border-color: rgba(59,130,246,.18); }
        .suChip.super { background: rgba(168,85,247,.10); color: #7e22ce; border-color: rgba(168,85,247,.18); }
        .suCellMuted { color: #64748b; font-size: 12px; }
        .suToggleRow { display: flex; align-items: center; justify-content: center; min-height: 34px; }
        .suUserList { display: flex; flex-direction: column; gap: 12px; }
        .suUserRow { display: grid; grid-template-columns: minmax(320px, 1.1fr) minmax(0, 1.9fr); gap: 14px; border: 1px solid #e6edf2; border-radius: 18px; background: linear-gradient(180deg, #fff, #fafcff); padding: 14px; box-shadow: 0 8px 24px rgba(15,23,42,.04); }
        .suUserIdentity { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
        .suAvatarWrap { position: relative; flex: 0 0 auto; }
        .suAvatar { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(180deg, #f8fafc, #eef2ff); border: 1px solid #dbe5ef; display: flex; align-items: center; justify-content: center; overflow: hidden; font-weight: 1000; color: #334155; }
        .suAvatarDot { position: absolute; right: -1px; bottom: -1px; width: 13px; height: 13px; border-radius: 999px; border: 2px solid #fff; box-shadow: 0 0 0 3px rgba(255,255,255,.75); }
        .suUserMeta { min-width: 0; flex: 1; }
        .suUserTop { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .suUserName { font-size: 16px; font-weight: 1000; color: #0f172a; line-height: 1.2; }
        .suUserLine { margin-top: 6px; color: #64748b; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .suUserRight { display: grid; grid-template-columns: minmax(220px, 320px) minmax(240px, 1fr); gap: 16px; align-items: start; }
        .suStack { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
        .suStackLabel { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
        .suSelectPanel { display: flex; flex-direction: column; gap: 8px; }
        .suAccessPanel { display: flex; flex-direction: column; gap: 8px; }
        .suAccessChecks { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; min-height: 36px; }
        .suCheckItem { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 999px; border: 1px solid #dbe5ef; background: #fff; font-size: 12px; font-weight: 800; color: #334155; }
        .suCheckItem input { margin: 0; }
        @media (max-width: 980px) { .suUserRow { grid-template-columns: 1fr; } .suUserRight { grid-template-columns: 1fr; } }
        @media (max-width: 640px) { .suSearch { min-width: 0; } }
      `}</style>

      <div className="suShell">
        <div className="suHero">
          <div>
            <div className="suHeader">Super Console</div>
            <div className="suSub">
              Manage users, projects, and website-facing release visibility. Read scope is separate from the employee role, so write permissions stay predictable.
            </div>
          </div>
          <SuperConsoleTabs tab={tab} onChange={setTab} />
        </div>

        <div className="suSub" style={{ marginTop: 0 }}>
          Users: {rows.length} · Admins + Supers: {adminAndSupers.length} · Projects: {projects.length}
        </div>
      </div>

      {tab === "users" && (
        <SuperUsersTab
          users={rows}
          filteredUsers={filtered}
          loading={loading}
          query={query}
          currentUsername={user?.username}
          isSuperUser={isSuperUser}
          adminAndSupers={adminAndSupers}
          onQueryChange={setQuery}
          onSetRole={setRole}
          onSetReadScope={setReadScope}
          onSetAccessFlag={setUserAccessFlag}
          roleFor={normalizeRole}
          readScopeFor={(u) =>
            normalizeRole(
              (u as any).read_only_scope ||
                (normalizeRole(u.employee_role) === "super"
                  ? "super"
                  : normalizeRole(u.employee_role) === "admin"
                  ? "admin"
                  : "employee")
            ) as ReadScope
          }
          safeStr={safeStr}
        />
      )}

      {tab === "projects" && (
        <SuperProjectsTab
          projects={projects}
          users={rows}
          adminAndSupers={adminAndSupers}
          loading={projectsLoading}
          isSuperUser={isSuperUser}
          editingProjectId={editingProjectId}
          projectSaving={projectSaving}
          savingProjectVisibilityId={savingProjectVisibilityId}
          projectSettingsTab={projectSettingsTab}
          projectForm={projectForm}
          customPlatform={customPlatform}
          platformOptions={platformOptions}
          releaseSourceOptions={releaseSourceOptions}
          jiraConnectStatus={jiraConnectStatus}
          onProjectEdit={handleProjectEdit}
          onProjectSubmit={handleProjectSubmit}
          onProjectChange={handleProjectChange}
          onResetProjectForm={resetProjectForm}
          onSyncProductFromProject={handleSyncProductFromProject}
          onToggleProjectVisible={toggleProjectVisible}
          onProjectSettingsTabChange={setProjectSettingsTab}
          onLoadJiraConnectStatus={loadJiraConnectStatus}
          onUseConnectedCloudId={() => handleProjectChange("jiraCloudId", safeStr(jiraConnectStatus?.cloudId))}
          onCustomPlatformChange={setCustomPlatform}
          onUseCustomPlatform={() => {
            const v = safeStr(customPlatform).toLowerCase();
            if (!v) return;
            handleProjectChange("platform", v);
            setCustomPlatform("");
          }}
          safeStr={safeStr}
          visibleByStatus={visibleByStatus}
        />
      )}

      {tab === "releases" && (
        <SuperReleasesTab
          releaseRows={releaseData.releaseRows}
          isSuperUser={isSuperUser}
          savingProductKey={savingProductKey}
          onToggleReleaseVisibility={async (row, shouldBeVisible) => {
            await releaseData.toggleReleaseVisibility(row, shouldBeVisible);
            M.toast({ html: shouldBeVisible ? "Release visible on website" : "Release hidden from website", classes: "green" });
          }}
          onSavingKeyChange={setSavingProductKey}
          safeStr={safeStr}
        />
      )}

      {tab === "arcade_release" && (
        <SuperArcadeReleaseTab
          loading={arcadeReleaseLoading}
          saving={arcadeReleaseSaving}
          releaseVersion={arcadeReleaseVersion}
          releaseNotes={arcadeReleaseNotes}
          onReleaseVersionChange={setArcadeReleaseVersion}
          onReleaseNotesChange={setArcadeReleaseNotes}
          onRefresh={() => void loadArcadeReleaseConfig()}
          onSave={async () => {
            try {
              setArcadeReleaseSaving(true);
              await (api as any).updateArcadeReleaseConfig({
                releaseVersion: safeStr(arcadeReleaseVersion),
                releaseNotes: String(arcadeReleaseNotes ?? ""),
              });
              M.toast({ html: "Arcade release updated", classes: "green" });
            } catch (e: any) {
              M.toast({ html: e?.message || "Failed to save Arcade release", classes: "red" });
            } finally {
              setArcadeReleaseSaving(false);
            }
          }}
        />
      )}

      {tab === "storage" && (
        <SuperStorageTab
          items={filteredStorageItems}
          loading={storageLoading}
          prefix={storagePrefix}
          bucket={storageBucket}
          truncated={storageTruncated}
          cursor={storageCursor}
          error={storageError}
          nameFilter={storageNameFilter}
          minSizeMb={storageMinSizeMb}
          maxSizeMb={storageMaxSizeMb}
          uploadedFrom={storageUploadedFrom}
          uploadedTo={storageUploadedTo}
          dateSort={storageDateSort}
          onPrefixChange={setStoragePrefix}
          onNameFilterChange={setStorageNameFilter}
          onMinSizeMbChange={setStorageMinSizeMb}
          onMaxSizeMbChange={setStorageMaxSizeMb}
          onUploadedFromChange={setStorageUploadedFrom}
          onUploadedToChange={setStorageUploadedTo}
          onDateSortChange={setStorageDateSort}
          onRefresh={() => void loadStorageFiles()}
          onLoadMore={() => void loadStorageFiles(storageCursor)}
          onDelete={async (item) => {
            try {
              await (api as any).deleteStorageFile({ s3Key: item.key });
              M.toast({ html: "File deleted", classes: "green" });
              await loadStorageFiles(storageCursor);
            } catch (err: any) {
              M.toast({ html: err?.message || "Delete failed", classes: "red" });
            }
          }}
          formatBytesMb={formatBytesMb}
          isPreviewable={isPreviewable}
          filteredCount={filteredStorageItems.length}
        />
      )}
    </main>
  );
}
