import { useEffect, useMemo, useRef, useState } from "react";
import { type ApiUpdateSummary, type ApiUpdatesResponse, type ApiUser } from "../../api";
import { useAuth } from "../../auth/AuthContext";

declare const M: any;

type EditForm = {
  username: string;
  employee_name: string;
  employee_email: string;
  employee_role: string;
  employee_title: string;
  employee_picture: string;
  employee_phonenumber: string;
  department: string;
  location: string;
  project_id: string;
  project_setup: string;
  portal_access: boolean;
  project_access: boolean;
  version_control_access: boolean;
  employee_id: string;
  password?: string;
  revoked: boolean;
};

const EMPTY_EDIT: EditForm = {
  username: "",
  employee_name: "",
  employee_email: "",
  employee_role: "employee",
  employee_title: "",
  employee_picture: "",
  employee_phonenumber: "",
  department: "",
  location: "",
  project_id: "",
  project_setup: "",
  portal_access: true,
  project_access: true,
  version_control_access: false,
  employee_id: "",
  password: "",
  revoked: false,
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function norm(v: any) {
  return safeStr(v).toLowerCase();
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "").toUpperCase() + (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase()) || "FG";
}

function getUserKey(user: Partial<ApiUser>) {
  return (
    norm((user as any)?.userId) ||
    norm((user as any)?.id) ||
    norm((user as any)?.employee_id) ||
    norm((user as any)?.username) ||
    norm((user as any)?.employee_username) ||
    norm((user as any)?.employee_email) ||
    norm((user as any)?.email)
  );
}

function getUserName(user: Partial<ApiUser>) {
  return (
    safeStr((user as any)?.employee_name) ||
    safeStr((user as any)?.name) ||
    safeStr((user as any)?.username) ||
    safeStr((user as any)?.employee_email) ||
    "Unknown"
  );
}

function getUserAvatar(user: Partial<ApiUser>) {
  return safeStr((user as any)?.employee_picture) || safeStr((user as any)?.employee_profilepicture);
}

function isLinkedInConnected(user: Partial<ApiUser>) {
  return Boolean(
    (user as any)?.linkedin_connected ||
      safeStr((user as any)?.linkedin_connected_at) ||
      safeStr((user as any)?.linkedin_member_id)
  );
}

function isDiscordConnected(user: Partial<ApiUser>) {
  return Boolean(
    (user as any)?.discord_connected ||
      safeStr((user as any)?.discord_connected_at) ||
      safeStr((user as any)?.discord_member_id)
  );
}

function getRole(user: any) {
  return norm(user?.employee_role || user?.role || "employee") || "employee";
}

function normalizeAttachments(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((a: any, idx: number) => {
      const name = safeStr(a?.name || a?.fileName || a?.title || `Attachment ${idx + 1}`);
      const url = safeStr(a?.publicUrl || a?.url || a?.youtubeUrl || "");
      const s3Key = safeStr(a?.s3Key);
      if (!name && !url && !s3Key && !safeStr(a?.youtubeVideoId)) return null;
      return { name: name || `Attachment ${idx + 1}`, mimeType: safeStr(a?.mimeType), url, s3Key, youtubeUrl: safeStr(a?.youtubeUrl), youtubeVideoId: safeStr(a?.youtubeVideoId) };
    })
    .filter(Boolean) as Array<{ name: string; mimeType?: string; url?: string; s3Key?: string; youtubeUrl?: string; youtubeVideoId?: string }>;
}

function attachmentKind(a: any) {
  const mime = safeStr(a?.mimeType).toLowerCase();
  const href = safeStr(a?.url || a?.youtubeUrl || "").toLowerCase();
  if (safeStr(a?.youtubeUrl) || safeStr(a?.youtubeVideoId)) return "youtube";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(href)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(href)) return "video";
  if (mime.includes("pdf") || /\.pdf(\?|$)/i.test(href)) return "pdf";
  return "none";
}

function formatWeek(weekStart: string) {
  const d = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(d.getTime())) return weekStart || "No week selected";
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function weekdayShort(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.14)", background: "#fff", padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>{title}</div>
      {!items.length ? (
        <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>None</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item, idx) => (
            <div key={`${title}-${idx}`} style={{ borderRadius: 12, border: "1px solid rgba(148,163,184,.12)", background: "linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)", padding: "10px 12px", color: "#0f172a", fontWeight: 700, lineHeight: 1.45 }}>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.14)",
        background: "linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)",
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 22, fontWeight: 1000, color: "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

export default function EmployeeExplorerPanel({ currentUser }: { currentUser: any }) {
  const { api } = useAuth();
  const isSuper = getRole(currentUser) === "super";
  const isAdmin = isSuper || getRole(currentUser) === "admin";
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [summaries, setSummaries] = useState<ApiUpdateSummary[]>([]);
  const [loadingSummaries, setLoadingSummaries] = useState(false);
  const [summariesError, setSummariesError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedAttachment, setSelectedAttachment] = useState("");
  const [signedAttachmentUrls, setSignedAttachmentUrls] = useState<Record<string, string>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editingUsername, setEditingUsername] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({ ...EMPTY_EDIT });
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const composeModalRef = useRef<HTMLDivElement | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSending, setComposeSending] = useState(false);
  const [composeGenerating, setComposeGenerating] = useState(false);
  const [composeDocType, setComposeDocType] = useState<"EXPERIENCE" | "RECOMMENDATION">("EXPERIENCE");
  const [composeRoleTitle, setComposeRoleTitle] = useState("");
  const [composeSubject, setComposeSubject] = useState("Experience Certificate | Fluke Games");
  const [composeStatus, setComposeStatus] = useState("experience_sent");
  const [composeDateStarted, setComposeDateStarted] = useState("");
  const [composeDateEnded, setComposeDateEnded] = useState("");
  const [composeCurrentDate, setComposeCurrentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [composeExtraInfo, setComposeExtraInfo] = useState("");
  const [composeCoreSkills, setComposeCoreSkills] = useState("");
  const [composePeopleSkills, setComposePeopleSkills] = useState("");
  const [composeWordCount, setComposeWordCount] = useState("220");
  const [composeRecommendationBody, setComposeRecommendationBody] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingUsers(true);
        setUsersError("");
        const resp = await api.getUsers();
        if (!mounted) return;
        setUsers(Array.isArray(resp) ? resp : []);
      } catch (e: any) {
        if (mounted) setUsersError(e?.message || "Failed to load employees.");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  useEffect(() => {
    if (!editModalRef.current || typeof M === "undefined") return;
    M.Modal.init(editModalRef.current, { dismissible: true, opacity: 0.45 });
  }, []);

  useEffect(() => {
    if (!composeModalRef.current || typeof M === "undefined") return;
    M.Modal.init(composeModalRef.current, { dismissible: true, opacity: 0.45 });
  }, []);

  const filteredUsers = useMemo(() => {
    const q = norm(search);
    return [...users]
      .filter((u) => {
        if (!q) return true;
        const hay = [
          safeStr((u as any).employee_name),
          safeStr((u as any).employee_email),
          safeStr((u as any).employee_role),
          safeStr((u as any).username),
          safeStr((u as any).department),
          safeStr((u as any).employee_title),
          safeStr((u as any).employee_id),
        ].join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => getUserName(a).localeCompare(getUserName(b)));
  }, [users, search]);

  const selectedUserRowForUpdates = useMemo(() => {
    const key = norm(selectedKey);
    if (!key) return null;

    return (
      filteredUsers.find((u) => getUserKey(u) === key) ||
      users.find((u) => getUserKey(u) === key) ||
      null
    );
  }, [filteredUsers, selectedKey, users]);

  const selectedUserIdCandidates = useMemo(() => {
    const candidates: string[] = [];
    const userRow = selectedUserRowForUpdates;

    if (userRow) {
      candidates.push(
        safeStr((userRow as any)?.userId),
        safeStr((userRow as any)?.id),
        safeStr((userRow as any)?.username),
        safeStr((userRow as any)?.employee_id),
        safeStr((userRow as any)?.employee_email),
        safeStr((userRow as any)?.email)
      );
    }

    candidates.push(safeStr(selectedKey));

    const uniq: string[] = [];
    const seen = new Set<string>();
    for (const c of candidates.map(safeStr).filter(Boolean)) {
      const k = norm(c);
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(c);
    }
    return uniq;
  }, [selectedKey, selectedUserRowForUpdates]);

  useEffect(() => {
    if (selectedKey) return;
    const first = filteredUsers[0];
    const key = first ? getUserKey(first) : "";
    if (key) setSelectedKey(key);
  }, [filteredUsers, selectedKey]);

  useEffect(() => {
    let cancelled = false;
    const candidates = selectedUserIdCandidates;
    if (!candidates.length) {
      setSummaries([]);
      setSummariesError("");
      return;
    }

    (async () => {
      try {
        setLoadingSummaries(true);
        setSummariesError("");

        const projectId =
          safeStr((selectedUserRowForUpdates as any)?.project_id) ||
          safeStr((currentUser as any)?.project_id) ||
          "";

        const likelyHasUpdates = Boolean(
          safeStr((selectedUserRowForUpdates as any)?.employee_last_update_week) ||
            safeStr((selectedUserRowForUpdates as any)?.employee_last_update_hours) ||
            safeStr((selectedUserRowForUpdates as any)?.employee_last_update_summary)
        );

        let finalRows: ApiUpdateSummary[] = [];

        for (const userId of candidates) {
          const rows: ApiUpdateSummary[] = [];
          const seen = new Set<string>();
          let cursor: string | undefined;
          let pages = 0;

          do {
            const resp: ApiUpdatesResponse = await api.getUpdates({
              userId,
              projectId: projectId || undefined,
              limit: 200,
              cursor,
            });
            (Array.isArray(resp?.summaries) ? resp.summaries : []).forEach((row) => {
              const key = `${safeStr((row as any)?.userId)}::${safeStr((row as any)?.weekStart)}`;
              if (!key || seen.has(key)) return;
              seen.add(key);
              rows.push(row);
            });
            cursor = resp?.nextCursor || undefined;
            pages += 1;
          } while (cursor && pages < 200);

          rows.sort((a, b) => safeStr((b as any)?.weekStart).localeCompare(safeStr((a as any)?.weekStart)));

          if (cancelled) return;

          if (rows.length > 0 || !likelyHasUpdates) {
            finalRows = rows;
            break;
          }
        }

        if (finalRows.length === 0 && likelyHasUpdates && selectedUserRowForUpdates) {
          const lastWeek = safeStr((selectedUserRowForUpdates as any)?.employee_last_update_week);
          const employeeId = safeStr((selectedUserRowForUpdates as any)?.employee_id);
          const employeeName = getUserName(selectedUserRowForUpdates);

          if (lastWeek) {
            try {
              const resp: ApiUpdatesResponse = await api.getUpdates({
                weekStart: lastWeek,
                projectId: projectId || undefined,
                limit: 200,
              });

              const match = (Array.isArray(resp?.summaries) ? resp.summaries : []).find((row) => {
                const rowEmployeeId = safeStr((row as any)?.employee_id);
                if (employeeId && rowEmployeeId && employeeId === rowEmployeeId) return true;

                const rowName = safeStr((row as any)?.userName);
                if (employeeName && rowName && norm(rowName) === norm(employeeName)) return true;

                const rowUserId = safeStr((row as any)?.userId);
                if (rowUserId && safeStr((selectedUserRowForUpdates as any)?.username) && norm(rowUserId) === norm(safeStr((selectedUserRowForUpdates as any)?.username))) {
                  return true;
                }

                return false;
              });

              const discoveredUserId = safeStr((match as any)?.userId);
              if (discoveredUserId && !candidates.some((c) => norm(c) === norm(discoveredUserId))) {
                const rows: ApiUpdateSummary[] = [];
                const seen = new Set<string>();
                let cursor: string | undefined;
                let pages = 0;

                do {
                  const resp2: ApiUpdatesResponse = await api.getUpdates({
                    userId: discoveredUserId,
                    projectId: projectId || undefined,
                    limit: 200,
                    cursor,
                  });
                  (Array.isArray(resp2?.summaries) ? resp2.summaries : []).forEach((row) => {
                    const key = `${safeStr((row as any)?.userId)}::${safeStr((row as any)?.weekStart)}`;
                    if (!key || seen.has(key)) return;
                    seen.add(key);
                    rows.push(row);
                  });
                  cursor = resp2?.nextCursor || undefined;
                  pages += 1;
                } while (cursor && pages < 200);

                rows.sort((a, b) => safeStr((b as any)?.weekStart).localeCompare(safeStr((a as any)?.weekStart)));
                if (!cancelled) finalRows = rows;
              }
            } catch {
              // ignore discovery failures
            }
          }
        }

        if (cancelled) return;
        setSummaries(finalRows);
        setSelectedWeek(safeStr((finalRows[0] as any)?.weekStart));
      } catch (e: any) {
        if (!cancelled) {
          setSummaries([]);
          setSummariesError(e?.message || "Failed to load employee activity.");
        }
      } finally {
        if (!cancelled) setLoadingSummaries(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, selectedUserIdCandidates, selectedUserRowForUpdates]);

  useEffect(() => {
    setSelectedAttachment("");
    setSignedAttachmentUrls({});
  }, [selectedWeek, selectedKey]);

  const selectedUser = useMemo(() => filteredUsers.find((u) => getUserKey(u) === norm(selectedKey)) || null, [filteredUsers, selectedKey]);
  const selectedSummary = useMemo(() => summaries.find((r) => safeStr((r as any)?.weekStart) === safeStr(selectedWeek)) || summaries[0] || null, [summaries, selectedWeek]);
  const selectedTimesheet = useMemo(() => {
    if (!selectedSummary) return [];
    const ts = Array.isArray((selectedSummary as any).timesheet) ? (selectedSummary as any).timesheet : [];
    return [...ts].sort((a: any, b: any) => safeStr(a?.date).localeCompare(safeStr(b?.date)));
  }, [selectedSummary]);
  const attachments = useMemo(() => {
    if (!selectedSummary) return [];
    return normalizeAttachments((selectedSummary as any).attachments || (selectedSummary as any).uploadedFiles || (selectedSummary as any).files);
  }, [selectedSummary]);
  const totals = useMemo(() => ({
    weeks: summaries.length,
    entries: summaries.reduce((acc, row) => acc + Number((row as any)?.totalEntries || 0), 0),
    hours: summaries.reduce((acc, row) => acc + Number((row as any)?.totalHours || 0), 0),
    attachments: summaries.reduce((acc, row) => acc + normalizeAttachments((row as any).attachments || (row as any).uploadedFiles || (row as any).files).length, 0),
  }), [summaries]);

  function openEdit(userRow: ApiUser) {
    if (!isAdmin) return;
    setEditingUsername(safeStr((userRow as any)?.username));
    setEditForm({
      username: safeStr((userRow as any)?.username),
      employee_name: safeStr((userRow as any)?.employee_name),
      employee_email: safeStr((userRow as any)?.employee_email),
      employee_role: safeStr((userRow as any)?.employee_role) || "employee",
      employee_title: safeStr((userRow as any)?.employee_title),
      employee_picture: safeStr((userRow as any)?.employee_picture) || safeStr((userRow as any)?.employee_profilepicture),
      employee_phonenumber: safeStr((userRow as any)?.employee_phonenumber),
      department: safeStr((userRow as any)?.department),
      location: safeStr((userRow as any)?.location),
      project_id: safeStr((userRow as any)?.project_id),
      project_setup: safeStr((userRow as any)?.project_setup),
      portal_access: (userRow as any)?.portal_access !== false,
      project_access: (userRow as any)?.project_access !== false,
      version_control_access: (userRow as any)?.version_control_access === true,
      employee_id: safeStr((userRow as any)?.employee_id),
      password: "",
      revoked: !!(userRow as any)?.revoked,
    });
    setEditOpen(true);
    requestAnimationFrame(() => {
      const inst = M?.Modal?.getInstance?.(editModalRef.current) || M?.Modal?.init?.(editModalRef.current);
      inst?.open?.();
      setTimeout(() => {
        try {
          M?.updateTextFields?.();
        } catch {}
      }, 0);
    });
  }

  function closeEdit() {
    const inst = M?.Modal?.getInstance?.(editModalRef.current) || M?.Modal?.init?.(editModalRef.current);
    inst?.close?.();
    setEditOpen(false);
  }

  function openEmployeeDocComposer(userRow: ApiUser) {
    if (!isAdmin) return;
    setComposeDocType("EXPERIENCE");
    setComposeRoleTitle(safeStr((userRow as any)?.employee_title));
    setComposeSubject("Experience Certificate | Fluke Games");
    setComposeStatus("experience_sent");
    setComposeDateStarted("");
    setComposeDateEnded("");
    setComposeCurrentDate(new Date().toISOString().slice(0, 10));
    setComposeExtraInfo("");
    setComposeCoreSkills("");
    setComposePeopleSkills("");
    setComposeWordCount("220");
    setComposeRecommendationBody("");
    setComposeOpen(true);
    requestAnimationFrame(() => {
      const inst = M?.Modal?.getInstance?.(composeModalRef.current) || M?.Modal?.init?.(composeModalRef.current);
      inst?.open?.();
      setTimeout(() => {
        try {
          M?.updateTextFields?.();
        } catch {}
      }, 0);
    });
  }

  function closeEmployeeDocComposer() {
    const inst = M?.Modal?.getInstance?.(composeModalRef.current) || M?.Modal?.init?.(composeModalRef.current);
    inst?.close?.();
    setComposeOpen(false);
  }

  async function generateRecommendationPreview() {
    if (!selectedUser) return;
    try {
      setComposeGenerating(true);
      const resp = await (api as any).previewEmployeeRecommendation(
        safeStr((selectedUser as any)?.username),
        {
          roleTitle: composeRoleTitle || undefined,
          coreSkills: composeCoreSkills.trim() || undefined,
          peopleSkills: composePeopleSkills.trim() || undefined,
          wordCount: Number(composeWordCount || "220"),
          vars: {
            coreSkills: composeCoreSkills.trim() || undefined,
            peopleSkills: composePeopleSkills.trim() || undefined,
            wordCount: String(Number(composeWordCount || "220")),
          },
        }
      );
      setComposeRecommendationBody(safeStr(resp?.recommendationBody || ""));
      M?.toast?.({ html: "Recommendation draft generated.", classes: "green" });
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to generate recommendation", classes: "red" });
    } finally {
      setComposeGenerating(false);
    }
  }

  async function sendEmployeeDocNow() {
    if (!selectedUser) return;
    if (composeDocType === "EXPERIENCE" && (!composeDateStarted || !composeDateEnded)) {
      M?.toast?.({ html: "Experience requires start and end dates.", classes: "red" });
      return;
    }
    try {
      setComposeSending(true);
      const vars: Record<string, any> = {
        ...(composeExtraInfo.trim()
          ? { extraInfo: composeExtraInfo.trim(), EXTRA_INFO: composeExtraInfo.trim() }
          : {}),
        ...(composeCurrentDate ? { CURRENT_DATE: composeCurrentDate } : {}),
        ...(composeDateStarted ? { START_DATE: composeDateStarted, dateStarted: composeDateStarted } : {}),
        ...(composeDateEnded ? { END_DATE: composeDateEnded, dateEnded: composeDateEnded } : {}),
        ...(composeCoreSkills.trim() ? { coreSkills: composeCoreSkills.trim(), CORE_SKILLS: composeCoreSkills.trim() } : {}),
        ...(composePeopleSkills.trim() ? { peopleSkills: composePeopleSkills.trim(), PEOPLE_SKILLS: composePeopleSkills.trim() } : {}),
        ...(composeWordCount.trim() ? { wordCount: String(Number(composeWordCount)), WORD_COUNT: String(Number(composeWordCount)) } : {}),
        ...(composeRecommendationBody.trim()
          ? { recommendationBody: composeRecommendationBody.trim(), RECOMMENDATION_BODY: composeRecommendationBody.trim() }
          : {}),
      };
      await (api as any).sendEmployeeDocEmail(safeStr((selectedUser as any)?.username), {
        type: composeDocType,
        roleTitle: composeRoleTitle || undefined,
        subjectOverride: composeSubject || undefined,
        setStatus: composeStatus || undefined,
        dateStarted: composeDocType === "EXPERIENCE" ? composeDateStarted || undefined : undefined,
        dateEnded: composeDocType === "EXPERIENCE" ? composeDateEnded || undefined : undefined,
        coreSkills: composeDocType === "RECOMMENDATION" ? composeCoreSkills.trim() || undefined : undefined,
        peopleSkills: composeDocType === "RECOMMENDATION" ? composePeopleSkills.trim() || undefined : undefined,
        recommendationBody:
          composeDocType === "RECOMMENDATION" ? composeRecommendationBody.trim() || undefined : undefined,
        vars,
      });
      M?.toast?.({ html: "Employee document sent.", classes: "green" });
      closeEmployeeDocComposer();
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to send document", classes: "red" });
    } finally {
      setComposeSending(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !editingUsername) return;
    try {
      setEditSaving(true);
      const patch: any = {
        username: editingUsername,
        employee_name: safeStr(editForm.employee_name) || undefined,
        employee_email: safeStr(editForm.employee_email) || undefined,
        // employee_role is shown read-only in UI; do not patch it here
        employee_title: safeStr(editForm.employee_title) || undefined,
        employee_picture: safeStr(editForm.employee_picture) || undefined,
        employee_profilepicture: safeStr(editForm.employee_picture) || undefined,
        employee_phonenumber: safeStr(editForm.employee_phonenumber) || undefined,
        department: safeStr(editForm.department) || undefined,
        location: safeStr(editForm.location) || undefined,
        project_id: safeStr(editForm.project_id) || undefined,
        // Allow clearing back to "none" (empty string) by sending it explicitly.
        project_setup: String(editForm.project_setup ?? ""),
        employee_id: safeStr(editForm.employee_id) || undefined,
        revoked: !!editForm.revoked,
      };
      if (isSuper) {
        patch.portal_access = !!editForm.portal_access;
        patch.project_access = !!editForm.project_access;
        patch.version_control_access = !!editForm.version_control_access;
      }
      if (safeStr(editForm.password)) patch.password = editForm.password;
      await api.updateUser(patch);
      M?.toast?.({ html: "Employee updated.", classes: "green" });
      setEditSaving(false);
      closeEdit();
      const resp = await api.getUsers();
      setUsers(Array.isArray(resp) ? resp : []);
    } catch (e: any) {
      setEditSaving(false);
      M?.toast?.({ html: e?.message || "Failed to save employee.", classes: "red" });
    }
  }

  async function resolveAttachmentUrl(a: any, idx: number) {
    const key = `${safeStr((selectedSummary as any)?.userId)}::${safeStr((selectedSummary as any)?.weekStart)}::${safeStr(a?.s3Key) || safeStr(a?.name) || idx}`;
    const cached = safeStr(signedAttachmentUrls[key]);
    if (cached) return cached;
    const raw = safeStr(a?.url || a?.publicUrl || a?.youtubeUrl || "");
    if (raw && !safeStr(a?.s3Key)) return raw;
    const s3Key = safeStr(a?.s3Key);
    if (!s3Key) return "";
    try {
      const resp = await (api as any).getWeeklyUpdateAttachmentUrl?.({
        s3Key,
        userId: safeStr((selectedSummary as any)?.userId),
        weekStart: safeStr((selectedSummary as any)?.weekStart),
      });
      const url = safeStr(resp?.url);
      if (url) setSignedAttachmentUrls((prev) => ({ ...prev, [key]: url }));
      return url;
    } catch {
      return "";
    }
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "330px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(148,163,184,.14)", background: "#fff" }}>
          <div style={{ padding: 14, borderBottom: "1px solid rgba(148,163,184,.12)", background: "radial-gradient(420px 140px at 0% 0%, rgba(34,197,94,.10), transparent 55%), linear-gradient(135deg,#ffffff 0%,#fbfdff 60%,#f7fafc 100%)" }}>
            <div style={{ fontWeight: 1000, color: "#0f172a" }}>Employees</div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 }}>Search, select, and edit employees.</div>
            <div style={{ marginTop: 10 }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, role, department..."
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  height: 46,
                  minHeight: 46,
                  border: "1px solid #dbe5ef",
                  borderRadius: 12,
                  padding: "0 12px",
                  fontWeight: 800,
                  outline: "none",
                  lineHeight: "46px",
                  background: "#fff",
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 650, overflow: "auto" }}>
            {loadingUsers ? (
              <div style={{ padding: 14, color: "#64748b", fontWeight: 800 }}>Loading employees…</div>
            ) : usersError ? (
              <div style={{ padding: 14, color: "#b91c1c", fontWeight: 900 }}>{usersError}</div>
            ) : (
              filteredUsers.map((u) => {
                const key = getUserKey(u);
                const avatar = getUserAvatar(u);
                const selected = norm(selectedKey) === key;
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px", borderBottom: "1px solid rgba(148,163,184,.10)", background: selected ? "rgba(59,130,246,.08)" : "#fff", cursor: "pointer" }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 999, overflow: "hidden", border: "1px solid rgba(148,163,184,.22)", background: "rgba(148,163,184,.10)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                      {avatar ? <img src={avatar} alt={getUserName(u)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontWeight: 1000, color: "#64748b" }}>{initials(getUserName(u))}</span>}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 950, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{getUserName(u)}</div>
                      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {safeStr((u as any)?.employee_title) || safeStr((u as any)?.department) || getRole(u) || "employee"}
                      </div>
                      {isLinkedInConnected(u) ? (
                        <div style={{ marginTop: 4 }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 9px",
                            borderRadius: 999,
                            background: "rgba(34,197,94,0.12)",
                            color: "#166534",
                            border: "1px solid rgba(34,197,94,0.20)",
                            fontSize: 11,
                            fontWeight: 900,
                          }}>
                            <i className="material-icons" style={{ fontSize: 14 }}>check_circle</i>
                            LinkedIn Connected
                          </span>
                        </div>
                      ) : null}
                      {isDiscordConnected(u) ? (
                        <div style={{ marginTop: 4 }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 9px",
                            borderRadius: 999,
                            background: "rgba(88,101,242,0.12)",
                            color: "#312e81",
                            border: "1px solid rgba(88,101,242,0.20)",
                            fontSize: 11,
                            fontWeight: 900,
                          }}>
                            <i className="material-icons" style={{ fontSize: 14 }}>check_circle</i>
                            Discord Connected
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(u);
                      }}
                      title="Edit employee details"
                      disabled={!isAdmin}
                      style={{ borderRadius: 10, textTransform: "none", background: "rgba(15,23,42,.06)", color: "#0f172a", boxShadow: "none", minWidth: 36 }}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>edit</i>
                    </button>
                  </div>
                );
              })
            )}
            {!loadingUsers && !usersError && !filteredUsers.length ? <div style={{ padding: 14, color: "#64748b", fontWeight: 800 }}>No employees found.</div> : null}
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(148,163,184,.14)", background: "#fff" }}>
            <div style={{ padding: 14, borderBottom: "1px solid rgba(148,163,184,.12)", background: "radial-gradient(520px 160px at 10% 0%, rgba(59,130,246,.12), transparent 55%), linear-gradient(135deg,#ffffff 0%,#fbfdff 60%,#f7fafc 100%)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, overflow: "hidden", border: "1px solid rgba(148,163,184,.22)", background: "rgba(148,163,184,.10)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selectedUser && getUserAvatar(selectedUser) ? <img src={getUserAvatar(selectedUser)} alt={getUserName(selectedUser)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <i className="material-icons" style={{ fontSize: 22, color: "#64748b" }}>person_search</i>}
                </div>
                <div>
                  <div style={{ fontWeight: 1000, color: "#0f172a" }}>{selectedUser ? getUserName(selectedUser) : "Select an employee"}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{selectedUser ? safeStr((selectedUser as any)?.employee_title) : "Weekly summaries appear here."}</div>
                  {selectedUser ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: isLinkedInConnected(selectedUser) ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
                        color: isLinkedInConnected(selectedUser) ? "#166534" : "#475569",
                        border: isLinkedInConnected(selectedUser) ? "1px solid rgba(34,197,94,0.20)" : "1px solid rgba(148,163,184,0.18)",
                        fontSize: 11,
                        fontWeight: 900,
                      }}>
                        <i className="material-icons" style={{ fontSize: 14 }}>
                          {isLinkedInConnected(selectedUser) ? "check_circle" : "link"}
                        </i>
                        {isLinkedInConnected(selectedUser) ? "LinkedIn Connected" : "LinkedIn Not Connected"}
                      </span>
                    </div>
                  ) : null}
                  {selectedUser ? (
                    <div style={{ marginTop: 6 }}>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: isDiscordConnected(selectedUser) ? "rgba(88,101,242,0.12)" : "rgba(148,163,184,0.12)",
                        color: isDiscordConnected(selectedUser) ? "#312e81" : "#475569",
                        border: isDiscordConnected(selectedUser) ? "1px solid rgba(88,101,242,0.20)" : "1px solid rgba(148,163,184,0.18)",
                        fontSize: 11,
                        fontWeight: 900,
                      }}>
                        <i className="material-icons" style={{ fontSize: 14 }}>
                          {isDiscordConnected(selectedUser) ? "check_circle" : "sports_esports"}
                        </i>
                        {isDiscordConnected(selectedUser) ? "Discord Connected" : "Discord Not Connected"}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <button
                  type="button"
                  className="btn-small"
                  disabled={!selectedUser || !isAdmin}
                  onClick={() => selectedUser && openEmployeeDocComposer(selectedUser)}
                  style={{ borderRadius: 10, textTransform: "none", fontWeight: 900, background: "#0ea5a4", color: "#ffffff", boxShadow: "none" }}
                  title="Open employee letter composer"
                >
                  <i className="material-icons left">mail</i>
                  Employee composer
                </button>
                <button
                  type="button"
                  className="btn-small"
                  disabled={!selectedUser || !isAdmin}
                  onClick={() => selectedUser && openEdit(selectedUser)}
                  style={{ borderRadius: 10, textTransform: "none", fontWeight: 900, background: "rgba(15,23,42,.06)", color: "#0f172a", boxShadow: "none" }}
                  title="Edit employee details"
                >
                  <i className="material-icons left">edit</i>
                  Edit employee
                </button>
              </div>
            </div>

            <div style={{ padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginBottom: 16 }}>
                <MetricBox label="Weeks" value={String(totals.weeks)} />
                <MetricBox label="Entries" value={String(totals.entries)} />
                <MetricBox label="Hours" value={totals.hours.toFixed(1)} />
                <MetricBox label="Attachments" value={String(totals.attachments)} />
              </div>

              {loadingSummaries ? (
                <div style={{ color: "#64748b", fontWeight: 800 }}>Loading employee activity…</div>
              ) : summariesError ? (
                <div style={{ color: "#b91c1c", fontWeight: 900 }}>{summariesError}</div>
              ) : !selectedKey ? (
                <div style={{ color: "#64748b", fontWeight: 800 }}>Pick an employee on the left.</div>
              ) : !summaries.length ? (
                <div style={{ color: "#64748b", fontWeight: 800 }}>No updates found for this employee.</div>
              ) : (
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 14, alignItems: "start" }}>
                    <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.14)", background: "#fff", overflow: "hidden" }}>
                      <div style={{ padding: 12, borderBottom: "1px solid rgba(148,163,184,.12)" }}>
                        <div style={{ fontWeight: 1000, color: "#0f172a" }}>Weekly updates</div>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>Click a week to inspect details.</div>
                      </div>
                      <div style={{ maxHeight: 520, overflow: "auto" }}>
                        {summaries.map((row) => {
                          const week = safeStr((row as any)?.weekStart);
                          const selected = safeStr(selectedWeek) === week;
                          return (
                            <button
                              key={`${safeStr((row as any)?.userId)}::${week}`}
                              type="button"
                              onClick={() => setSelectedWeek(week)}
                              style={{ width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid rgba(148,163,184,.10)", background: selected ? "rgba(59,130,246,.08)" : "#fff", padding: "12px", cursor: "pointer" }}
                            >
                              <div style={{ fontWeight: 1000, color: "#0f172a" }}>{week || "—"}</div>
                              <div style={{ marginTop: 3, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                                {safeStr((row as any)?.totalEntries)} entries · {safeStr((row as any)?.totalHours)}h · {normalizeAttachments((row as any).attachments || (row as any).uploadedFiles || (row as any).files).length} attachments
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 14 }}>
                      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.14)", background: "#fff", padding: 14 }}>
                        <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>{formatWeek(safeStr((selectedSummary as any)?.weekStart))}</div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                          {safeStr((selectedSummary as any)?.totalEntries)} entries · {safeStr((selectedSummary as any)?.totalHours)}h
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12 }}>
                        <DetailList title="Accomplishments" items={Array.isArray((selectedSummary as any)?.accomplishments) ? (selectedSummary as any).accomplishments : []} />
                        <DetailList title="Blockers" items={Array.isArray((selectedSummary as any)?.blockers) ? (selectedSummary as any).blockers : []} />
                        <DetailList title="Next" items={Array.isArray((selectedSummary as any)?.next) ? (selectedSummary as any).next : []} />
                      </div>

                      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.14)", background: "#fff", padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>Timesheet rows</div>
                        {!selectedTimesheet.length ? (
                          <div style={{ color: "#64748b", fontWeight: 700 }}>No timesheet rows found.</div>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                              <thead>
                                <tr>
                                  {["Day", "Date", "Hours"].map((h) => (
                                    <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "#64748b", borderBottom: "1px solid rgba(148,163,184,.14)" }}>
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {selectedTimesheet.map((t: any, idx: number) => (
                                  <tr key={`${t?.date || "d"}-${idx}`}>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,.10)", fontWeight: 800 }}>{weekdayShort(safeStr(t?.date))}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,.10)", fontWeight: 800 }}>{formatDate(safeStr(t?.date))}</td>
                                    <td style={{ padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,.10)", fontWeight: 900 }}>{safeStr(t?.hours)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div style={{ borderRadius: 16, border: "1px solid rgba(148,163,184,.14)", background: "#fff", padding: 14 }}>
                        <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>Attachments</div>
                        {!attachments.length ? (
                          <div style={{ color: "#64748b", fontWeight: 700 }}>No attachments.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 10 }}>
                            {attachments.map((a, idx) => {
                              const previewKey = `${safeStr((selectedSummary as any)?.userId)}::${safeStr((selectedSummary as any)?.weekStart)}::${safeStr(a?.s3Key) || safeStr(a?.name) || idx}`;
                              const kind = attachmentKind(a);
                              const href = signedAttachmentUrls[previewKey] || safeStr(a?.url || a?.youtubeUrl || "");
                              return (
                                <div key={previewKey} style={{ borderRadius: 14, border: "1px solid rgba(148,163,184,.12)", background: "#f8fbff", padding: 12 }}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 900, color: "#0f172a" }}>{safeStr(a?.name) || `Attachment ${idx + 1}`}</div>
                                    {kind !== "none" ? (
                                      <button
                                        type="button"
                                        className="btn-small"
                                        style={{ borderRadius: 10, textTransform: "none" }}
                                        onClick={async () => {
                                          const url = href || (await resolveAttachmentUrl(a, idx));
                                          if (url) setSelectedAttachment(previewKey);
                                        }}
                                      >
                                        Preview
                                      </button>
                                    ) : null}
                                  </div>
                                  {selectedAttachment === previewKey ? (
                                    <div style={{ marginTop: 12 }}>
                                      {kind === "image" ? (
                                        <img src={href} alt={safeStr(a?.name)} style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 8 }} />
                                      ) : kind === "video" ? (
                                        <video controls src={href} style={{ width: "100%", maxHeight: 360, borderRadius: 8, background: "#000" }} />
                                      ) : kind === "pdf" ? (
                                        <iframe title={`pdf-${previewKey}`} src={href} style={{ width: "100%", height: 420, border: "1px solid #e8eef3", borderRadius: 8 }} />
                                      ) : kind === "youtube" ? (
                                        <iframe title={`yt-${previewKey}`} src={href} style={{ width: "100%", height: 360, border: "1px solid #e8eef3", borderRadius: 8 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div ref={composeModalRef} className={`modal modal-fixed-footer ${composeOpen ? "open" : ""}`} style={{ maxHeight: "90%" }}>
        <div className="modal-content">
          <h5 style={{ fontWeight: 1000, marginBottom: 6 }}>Employee Letter Composer</h5>
          <p className="grey-text" style={{ marginTop: 0, fontWeight: 700 }}>
            Experience and Recommendation letters for the selected employee.
          </p>
          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m6">
              <input value={safeStr((selectedUser as any)?.employee_email)} disabled />
              <label className="active">To</label>
            </div>
            <div className="input-field col s12 m6">
              <input value={safeStr((selectedUser as any)?.username)} disabled />
              <label className="active">Studio Email</label>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m4">
              <select
                className="browser-default"
                value={composeDocType}
                onChange={(e) => {
                  const next = e.target.value as "EXPERIENCE" | "RECOMMENDATION";
                  setComposeDocType(next);
                  if (next === "EXPERIENCE") {
                    setComposeSubject("Experience Certificate | Fluke Games");
                    setComposeStatus("experience_sent");
                  } else {
                    setComposeSubject("Letter of Recommendation | Fluke Games");
                    setComposeStatus("recommendation_sent");
                  }
                }}
              >
                <option value="EXPERIENCE">EXPERIENCE</option>
                <option value="RECOMMENDATION">RECOMMENDATION</option>
              </select>
              <label className="active" style={{ position: "relative", top: -24 }}>docType</label>
            </div>
            <div className="input-field col s12 m4">
              <input value={composeRoleTitle} onChange={(e) => setComposeRoleTitle(e.target.value)} />
              <label className="active">roleTitle</label>
            </div>
            <div className="input-field col s12 m4">
              <input value={composeStatus} onChange={(e) => setComposeStatus(e.target.value)} />
              <label className="active">setStatus</label>
            </div>
          </div>

          <div className="input-field">
            <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            <label className="active">subjectOverride</label>
          </div>

          {composeDocType === "EXPERIENCE" ? (
            <div className="row" style={{ marginTop: 8 }}>
              <div className="col s12 m4">
                <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateStarted</div>
                <input type="date" value={composeDateStarted} onChange={(e) => setComposeDateStarted(e.target.value)} />
              </div>
              <div className="col s12 m4">
                <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateEnded</div>
                <input type="date" value={composeDateEnded} onChange={(e) => setComposeDateEnded(e.target.value)} />
              </div>
              <div className="col s12 m4">
                <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>CURRENT_DATE</div>
                <input type="date" value={composeCurrentDate} onChange={(e) => setComposeCurrentDate(e.target.value)} />
              </div>
            </div>
          ) : (
            <>
              <div className="row" style={{ marginTop: 8 }}>
                <div className="input-field col s12 m6">
                  <textarea className="materialize-textarea" value={composeCoreSkills} onChange={(e) => setComposeCoreSkills(e.target.value)} style={{ minHeight: 90 }} />
                  <label className="active">Core Skills</label>
                </div>
                <div className="input-field col s12 m6">
                  <textarea className="materialize-textarea" value={composePeopleSkills} onChange={(e) => setComposePeopleSkills(e.target.value)} style={{ minHeight: 90 }} />
                  <label className="active">People Skills</label>
                </div>
              </div>
              <div className="input-field">
                <input type="number" min={120} max={600} value={composeWordCount} onChange={(e) => setComposeWordCount(e.target.value)} />
                <label className="active">Word Count (120-600)</label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <button
                  type="button"
                  className={`btn ${composeGenerating ? "disabled" : ""}`}
                  disabled={composeGenerating}
                  onClick={generateRecommendationPreview}
                >
                  <i className="material-icons left">{composeGenerating ? "hourglass_empty" : "auto_awesome"}</i>
                  {composeGenerating ? "Generating..." : "Generate Recommendation"}
                </button>
              </div>
              <div className="input-field">
                <textarea
                  className="materialize-textarea"
                  value={composeRecommendationBody}
                  onChange={(e) => setComposeRecommendationBody(e.target.value)}
                  style={{ minHeight: 220 }}
                />
                <label className="active">Recommendation Draft (Editable)</label>
              </div>
            </>
          )}

          <div className="input-field">
            <textarea
              className="materialize-textarea"
              value={composeExtraInfo}
              onChange={(e) => setComposeExtraInfo(e.target.value)}
              style={{ minHeight: 90 }}
            />
            <label className="active">vars.extraInfo (optional)</label>
          </div>
        </div>
        <div className="modal-footer">
          <a className="btn-flat" onClick={closeEmployeeDocComposer}>Cancel</a>
          <button
            type="button"
            className={`btn ${composeSending ? "disabled" : ""}`}
            disabled={composeSending}
            onClick={sendEmployeeDocNow}
            style={{ textTransform: "none", fontWeight: 900 }}
          >
            <i className="material-icons left">{composeSending ? "hourglass_empty" : "send"}</i>
            {composeSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      <div ref={editModalRef} className={`modal modal-fixed-footer ${editOpen ? "open" : ""}`} style={{ maxHeight: "90%" }}>
        <form onSubmit={saveEdit}>
          <div className="modal-content">
            <h5 style={{ fontWeight: 1000, marginBottom: 6 }}>Edit Employee</h5>
            <p className="grey-text" style={{ marginTop: 0, fontWeight: 700 }}>Update employee details and save changes.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 10, marginTop: 12 }}>
              {(
                [
                  { label: "Username", key: "username", span: 4, disabled: !isSuper },
                  { label: "Employee Name", key: "employee_name", span: 4, disabled: false },
                  { label: "Employee Email", key: "employee_email", span: 4, disabled: false },
                  { label: "Title", key: "employee_title", span: 4, disabled: false },
                  { label: "Employee Picture URL", key: "employee_picture", span: 4, disabled: false },
                  { label: "Phone", key: "employee_phonenumber", span: 4, disabled: false },
                  { label: "Department", key: "department", span: 4, disabled: false },
                  { label: "Location", key: "location", span: 4, disabled: false },
                  { label: "Project ID", key: "project_id", span: 6, disabled: false },
                  { label: "Employee ID", key: "employee_id", span: 6, disabled: !isSuper },
                ] satisfies Array<{
                  label: string;
                  key: Exclude<keyof EditForm, "revoked">;
                  span: number;
                  disabled: boolean;
                }>
              ).map(({ label, key, span, disabled }) => (
                <div key={String(key)} style={{ gridColumn: `span ${span}` }}>
                  <div className="input-field">
                    <input
                      id={`edit_${key}`}
                      value={editForm[key] || ""}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={!!disabled}
                    />
                    <label className={editForm[key] ? "active" : ""} htmlFor={`edit_${key}`}>
                      {label}
                    </label>
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: "span 4" }}>
                <div className="input-field">
                  <input value={safeStr(editForm.employee_role)} disabled />
                  <label className={safeStr(editForm.employee_role) ? "active" : ""}>Role</label>
                </div>
              </div>
              <div style={{ gridColumn: "span 12" }}>
                <label>
                  <input type="checkbox" className="filled-in" checked={editForm.revoked} onChange={(e) => setEditForm((p) => ({ ...p, revoked: e.target.checked }))} />
                  <span>Revoked</span>
                </label>
              </div>
              <div style={{ gridColumn: "span 12", display: "flex", flexWrap: "wrap", gap: 18, marginTop: 4 }}>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={editForm.portal_access}
                    disabled={!isSuper}
                    onChange={(e) => setEditForm((p) => ({ ...p, portal_access: e.target.checked }))}
                  />
                  <span>Portal Access</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={editForm.project_access}
                    disabled={!isSuper}
                    onChange={(e) => setEditForm((p) => ({ ...p, project_access: e.target.checked }))}
                  />
                  <span>Project Access</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={editForm.version_control_access}
                    disabled={!isSuper}
                    onChange={(e) => setEditForm((p) => ({ ...p, version_control_access: e.target.checked }))}
                  />
                  <span>VCS Access</span>
                </label>
              </div>
              <div style={{ gridColumn: "span 6" }}>
                <div className="input-field">
                  <select
                    className="browser-default"
                    value={editForm.project_setup}
                    onChange={(e) => setEditForm((p) => ({ ...p, project_setup: e.target.value }))}
                  >
                    <option value="">Project Setup: not set</option>
                    <option value="ProjectPartialCleanUp">ProjectPartialCleanUp</option>
                    <option value="ProjectCompleteCleanup">ProjectCompleteCleanup</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <a className="modal-close btn-flat" onClick={closeEdit}>Cancel</a>
            <button type="submit" className={`btn ${editSaving ? "disabled" : ""}`} disabled={editSaving} style={{ textTransform: "none", fontWeight: 900 }}>
              <i className="material-icons left">{editSaving ? "hourglass_empty" : "save"}</i>
              {editSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
