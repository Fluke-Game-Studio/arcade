// src/pages/JobsAdmin.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { API_BASE } from "../api";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

/* ---------------------------------------------------------
   Types (UI-side)
--------------------------------------------------------- */
type JobStatus = "ACTIVE" | "PAUSED" | "DISABLED";

type QuestionType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "url"
  | "checkbox"
  | "radio"
  | "select"
  | "file";

type JobQuestion = {
  id: string;
  label: string;
  type: QuestionType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: string[];
};

type QuestionBank = {
  general: JobQuestion[];
  personal: JobQuestion[];
};

type Job = {
  jobId: string;
  title: string;
  team?: string;
  location?: string;
  employmentType?: string;
  tags?: string[];
  status: JobStatus;
  description?: string;

  // Admin flags
  isPublic?: boolean;

  // Bank references
  generalQuestionIds?: string[];
  personalQuestionIds?: string[];

  // Role-specific (inline)
  roleQuestions?: JobQuestion[];

  createdAt?: string;
  updatedAt?: string;
};

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function safeClone<T>(v: T): T {
  try {
    // @ts-ignore
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {}
  return JSON.parse(JSON.stringify(v));
}

function isOptionType(t: QuestionType) {
  return t === "checkbox" || t === "radio" || t === "select";
}

function normalizeLines(raw: string): string[] {
  return String(raw || "")
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function statusChipClass(s: JobStatus) {
  if (s === "ACTIVE") return "new badge green";
  if (s === "PAUSED") return "new badge orange";
  return "new badge grey";
}

function safeRoleLower(r: any) {
  return String(r || "employee").toLowerCase();
}

function safeParseApiGw(text: string) {
  if (!text) return {};
  try {
    const j = JSON.parse(text);
    if (typeof j?.body === "string") {
      try {
        return JSON.parse(j.body);
      } catch {
        return { body: j.body };
      }
    }
    return j;
  } catch {
    return { raw: text };
  }
}

async function apiJson(token: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "*/*",
      ...(init?.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const text = await res.text().catch(() => "");
  const payload = safeParseApiGw(text);

  if (!res.ok) {
    const msg = payload?.message || payload?.error || payload?.raw || `HTTP ${res.status}`;
    throw new Error(String(msg));
  }

  return payload;
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function safeLower(s: any) {
  return String(s || "").trim().toLowerCase();
}

function uniqSorted(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

/* ---------------------------------------------------------
   Small UI components
--------------------------------------------------------- */
function PageShell(props: {
  title: string;
  subtitle: string;
  right?: ReactElement;
  children: ReactElement;
}) {
  return (
    <div className="container" style={{ padding: "22px 0" }}>
      <div
        className="card"
        style={{
          borderRadius: 16,
          marginTop: 0,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))",
        }}
      >
        <div className="card-content" style={{ padding: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h5 style={{ margin: 0, fontWeight: 800 }}>{props.title}</h5>
                <span className="grey-text" style={{ fontSize: 13 }}>
                  {props.subtitle}
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>{props.right}</div>
          </div>
        </div>
      </div>

      {props.children}
    </div>
  );
}

function ProgressBar({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="progress" style={{ marginTop: 12, borderRadius: 999, overflow: "hidden" }}>
      <div className="indeterminate" />
    </div>
  );
}

function Pill({ text, tone }: { text: string; tone?: "default" | "green" | "orange" | "grey" | "blue" }) {
  const bg =
    tone === "green"
      ? "rgba(46, 204, 113, 0.15)"
      : tone === "orange"
      ? "rgba(243, 156, 18, 0.15)"
      : tone === "blue"
      ? "rgba(52, 152, 219, 0.15)"
      : tone === "grey"
      ? "rgba(127, 140, 141, 0.16)"
      : "rgba(0,0,0,0.06)";
  const color =
    tone === "green"
      ? "#1e8449"
      : tone === "orange"
      ? "#a86100"
      : tone === "blue"
      ? "#1b4f72"
      : tone === "grey"
      ? "#4d5656"
      : "#111";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function OptionsEditor(props: { options: string[]; onChange: (opts: string[]) => void }) {
  const { options, onChange } = props;
  const [text, setText] = useState((options || []).join("\n"));

  useEffect(() => {
    setText((options || []).join("\n"));
  }, [options]);

  function onText(v: string) {
    setText(v);
    onChange(normalizeLines(v));
    try {
      M.textareaAutoResize?.(document.activeElement);
    } catch {}
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="grey-text" style={{ fontSize: 12, marginBottom: 6 }}>
        Options (one per line)
      </div>

      <textarea
        className="materialize-textarea"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder={"Yes\nNo\nMaybe"}
        style={{
          minHeight: 120,
          whiteSpace: "pre-wrap",
          borderRadius: 12,
          padding: "10px 12px",
          background: "rgba(0,0,0,0.02)",
        }}
      />

      {!!(options || []).length && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(options || []).map((o, idx) => (
            <span key={`${o}_${idx}`} className="chip" style={{ margin: 0 }}>
              {o}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionRowEditor(props: {
  q: JobQuestion;
  onChange: (patch: Partial<JobQuestion>) => void;
  onRemove: () => void;
  badge?: string;
}) {
  const { q, onChange, onRemove, badge } = props;
  const needsOptions = isOptionType(q.type);

  useEffect(() => {
    if (!needsOptions && (q.options?.length || 0) > 0) onChange({ options: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.type]);

  return (
    <div className="card" style={{ marginBottom: 12, borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.06)" }}>
      <div className="card-content" style={{ paddingBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ fontSize: 14 }}>{q.label?.trim() ? q.label : "Untitled question"}</b>
            {badge && <span className="new badge blue" data-badge-caption={badge} />}
            {q.required && <span className="new badge red" data-badge-caption="Required" />}
            <span className="grey-text" style={{ fontSize: 12 }}>
              {q.type}
            </span>
          </div>
          <button className="btn-flat red-text" type="button" onClick={onRemove}>
            Delete
          </button>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input value={q.label || ""} onChange={(e) => onChange({ label: e.target.value })} />
            <label className="active">Label</label>
          </div>

          <div className="input-field col s12 m3">
            <select className="browser-default" value={q.type} onChange={(e) => onChange({ type: e.target.value as QuestionType })}>
              <option value="text">Text</option>
              <option value="textarea">Textarea</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="url">URL</option>
              <option value="checkbox">Checkbox</option>
              <option value="radio">Radio</option>
              <option value="select">Select</option>
              <option value="file">File</option>
            </select>
            <label className="active">Type</label>
          </div>

          <div className="input-field col s12 m3" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={!!q.required} onChange={(e) => onChange({ required: e.target.checked })} />
              <span>Required</span>
            </label>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input value={q.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
            <label className="active">Placeholder</label>
          </div>

          <div className="input-field col s12 m6">
            <input value={q.helpText || ""} onChange={(e) => onChange({ helpText: e.target.value })} />
            <label className="active">Help text</label>
          </div>
        </div>

        {needsOptions && <OptionsEditor options={q.options || []} onChange={(opts) => onChange({ options: opts })} />}
      </div>
    </div>
  );
}

function SectionCard(props: { title: string; subtitle?: string; right?: ReactElement; children: ReactElement }) {
  return (
    <div className="card" style={{ marginTop: 14, borderRadius: 16, boxShadow: "0 8px 28px rgba(0,0,0,0.06)" }}>
      <div className="card-content" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{props.title}</div>
            {props.subtitle && (
              <div className="grey-text" style={{ marginTop: 4, fontSize: 12 }}>
                {props.subtitle}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>{props.right}</div>
        </div>
        <div style={{ marginTop: 12 }}>{props.children}</div>
      </div>
    </div>
  );
}

function CompactKeyValue(props: { left: string; right: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 4 }}>
      <span className="grey-text" style={{ fontSize: 12 }}>
        {props.left}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{props.right}</span>
    </div>
  );
}

/* ---------------------------------------------------------
   Main Page
--------------------------------------------------------- */
export default function JobsAdmin(): ReactElement {
  const { user } = useAuth();
  const token = user?.token || "";
  const roleLower = safeRoleLower(user?.role);
  const isAllowed = roleLower === "admin" || roleLower === "super";

  const [loading, setLoading] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [banks, setBanks] = useState<QuestionBank>({ general: [], personal: [] });

  // Filters (smarter)
  const [filterStatus, setFilterStatus] = useState<"" | JobStatus>("");
  const [filterVisibility, setFilterVisibility] = useState<"" | "PUBLIC" | "PRIVATE">("");
  const [filterTeam, setFilterTeam] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");
  const [sortBy, setSortBy] = useState<"UPDATED_DESC" | "UPDATED_ASC" | "TITLE_ASC" | "TITLE_DESC">("UPDATED_DESC");
  const [search, setSearch] = useState("");

  const teamOptions = useMemo(() => {
    const teams = jobs.map((j) => String(j.team || "").trim()).filter(Boolean);
    return uniqSorted(teams);
  }, [jobs]);

  const tagOptions = useMemo(() => {
    const tags = jobs.flatMap((j) => (Array.isArray(j.tags) ? j.tags : [])).map((t) => String(t || "").trim());
    return uniqSorted(tags);
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let base = [...jobs];

    if (filterStatus) base = base.filter((j) => j.status === filterStatus);

    if (filterVisibility === "PUBLIC") base = base.filter((j) => j.isPublic !== false);
    if (filterVisibility === "PRIVATE") base = base.filter((j) => j.isPublic === false);

    if (filterTeam.trim()) {
      const t = safeLower(filterTeam);
      base = base.filter((j) => safeLower(j.team) === t);
    }

    if (filterTag.trim()) {
      const ft = safeLower(filterTag);
      base = base.filter((j) => (j.tags || []).some((x) => safeLower(x) === ft));
    }

    const s = search.trim().toLowerCase();
    if (s) {
      base = base.filter((j) => {
        const blob = `${j.title || ""} ${j.team || ""} ${j.location || ""} ${(j.tags || []).join(" ")} ${j.employmentType || ""}`.toLowerCase();
        return blob.includes(s);
      });
    }

    function updatedTime(j: Job) {
      const v = j.updatedAt || j.createdAt || "";
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    }

    base.sort((a, b) => {
      if (sortBy === "UPDATED_DESC") return updatedTime(b) - updatedTime(a);
      if (sortBy === "UPDATED_ASC") return updatedTime(a) - updatedTime(b);
      if (sortBy === "TITLE_ASC") return String(a.title || "").localeCompare(String(b.title || ""));
      return String(b.title || "").localeCompare(String(a.title || ""));
    });

    return base;
  }, [jobs, filterStatus, filterVisibility, filterTeam, filterTag, search, sortBy]);

  // modals
  const bankModalRef = useRef<HTMLDivElement | null>(null);
  const jobModalRef = useRef<HTMLDivElement | null>(null);

  // drafts
  const [bankDraft, setBankDraft] = useState<QuestionBank>({ general: [], personal: [] });
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobDraft, setJobDraft] = useState<Job>(blankJob());
  const [jobModalTab, setJobModalTab] = useState<"DETAILS" | "BANKS" | "ROLE">("DETAILS");

  // UI conveniences
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  function toast(html: string) {
    try {
      M.toast({ html });
    } catch {}
  }

  function blankJob(): Job {
    return {
      jobId: uid("job"),
      title: "",
      team: "",
      location: "",
      employmentType: "Volunteer (Remote)",
      tags: [],
      status: "ACTIVE",
      isPublic: true,
      description: "",
      generalQuestionIds: [],
      personalQuestionIds: [],
      roleQuestions: [],
    };
  }

  async function loadAll() {
    if (!token) return;
    setLoading(true);
    try {
      const [jobsRes, bankRes] = await Promise.all([
        apiJson(token, "/admin/jobs", { method: "GET" }),
        apiJson(token, "/admin/jobs/question-bank", { method: "GET" }),
      ]);

      setJobs(Array.isArray(jobsRes?.items) ? jobsRes.items : []);
      setBanks({
        general: Array.isArray(bankRes?.general) ? bankRes.general : [],
        personal: Array.isArray(bankRes?.personal) ? bankRes.personal : [],
      });
    } catch (e: any) {
      toast(`<span style="color:#ffbdbd">${String(e?.message || e)}</span>`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTimeout(() => {
      if (bankModalRef.current) M.Modal.init(bankModalRef.current, { dismissible: false });
      if (jobModalRef.current) M.Modal.init(jobModalRef.current, { dismissible: false });
    }, 0);
  }, []);

  useEffect(() => {
    if (!token || !isAllowed) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAllowed]);

  /* ---------------- Bank editor ---------------- */
  function openBanks() {
    setBankDraft(safeClone(banks));
    M.Modal.getInstance(bankModalRef.current)?.open();
  }
  function closeBanks() {
    M.Modal.getInstance(bankModalRef.current)?.close();
  }

  function addBank(which: "general" | "personal") {
    setBankDraft((b) => ({
      ...b,
      [which]: [
        ...b[which],
        { id: uid(which === "general" ? "g" : "p"), label: "", type: "text", required: false, options: [] },
      ],
    }));
  }

  function updateBankQ(which: "general" | "personal", id: string, patch: Partial<JobQuestion>) {
    setBankDraft((b) => ({
      ...b,
      [which]: b[which].map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function removeBankQ(which: "general" | "personal", id: string) {
    setBankDraft((b) => ({ ...b, [which]: b[which].filter((q) => q.id !== id) }));
  }

  function validateQuestion(q: JobQuestion): string | null {
    if (!q.label?.trim()) return "Every question must have a label.";
    if (isOptionType(q.type) && (q.options || []).length === 0) return "Checkbox/Radio/Select must have at least 1 option.";
    return null;
  }

  function validateBankDraft(b: QuestionBank): string | null {
    for (const q of [...(b.general || []), ...(b.personal || [])]) {
      const err = validateQuestion(q);
      if (err) return err;
    }
    return null;
  }

  async function saveBanks() {
    const err = validateBankDraft(bankDraft);
    if (err) return toast(`<span style="color:#ffbdbd">${err}</span>`);

    setLoading(true);
    try {
      await apiJson(token, "/admin/jobs/question-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankDraft),
      });

      const gSet = new Set(bankDraft.general.map((q) => q.id));
      const pSet = new Set(bankDraft.personal.map((q) => q.id));

      setJobs((prev) =>
        prev.map((j) => ({
          ...j,
          generalQuestionIds: (j.generalQuestionIds || []).filter((id) => gSet.has(id)),
          personalQuestionIds: (j.personalQuestionIds || []).filter((id) => pSet.has(id)),
        }))
      );

      setBanks(bankDraft);
      toast("✅ Question banks saved");
      closeBanks();
    } catch (e: any) {
      toast(`<span style="color:#ffbdbd">${String(e?.message || e)}</span>`);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Job editor ---------------- */
  function openCreateJob() {
    setEditingJobId(null);
    setJobDraft(blankJob());
    setJobModalTab("DETAILS");
    M.Modal.getInstance(jobModalRef.current)?.open();
  }

  function openEditJob(j: Job) {
    setEditingJobId(j.jobId);
    setJobDraft({
      ...safeClone(j),
      tags: Array.isArray(j.tags) ? j.tags : [],
      generalQuestionIds: Array.isArray(j.generalQuestionIds) ? j.generalQuestionIds : [],
      personalQuestionIds: Array.isArray(j.personalQuestionIds) ? j.personalQuestionIds : [],
      roleQuestions: Array.isArray(j.roleQuestions) ? j.roleQuestions : [],
      isPublic: j.isPublic !== false,
    });
    setJobModalTab("DETAILS");
    M.Modal.getInstance(jobModalRef.current)?.open();
  }

  function closeJob() {
    M.Modal.getInstance(jobModalRef.current)?.close();
  }

  function setDraft(patch: Partial<Job>) {
    setJobDraft((d) => ({ ...d, ...patch }));
  }

  function addRoleQ() {
    setJobDraft((d) => ({
      ...d,
      roleQuestions: [...(d.roleQuestions || []), { id: uid("r"), label: "", type: "text", required: false, options: [] }],
    }));
  }

  function updateRoleQ(id: string, patch: Partial<JobQuestion>) {
    setJobDraft((d) => ({
      ...d,
      roleQuestions: (d.roleQuestions || []).map((q) => (q.id === id ? { ...q, ...patch } : q)),
    }));
  }

  function removeRoleQ(id: string) {
    setJobDraft((d) => ({ ...d, roleQuestions: (d.roleQuestions || []).filter((q) => q.id !== id) }));
  }

  function validateJobDraft(j: Job): string | null {
    if (!j.title?.trim()) return "Job title is required.";
    for (const q of j.roleQuestions || []) {
      const err = validateQuestion(q);
      if (err) return `Role-specific: ${err}`;
    }
    return null;
  }

  async function saveJob() {
    const err = validateJobDraft(jobDraft);
    if (err) return toast(`<span style="color:#ffbdbd">${err}</span>`);

    setLoading(true);
    try {
      await apiJson(token, "/admin/jobs/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobDraft),
      });

      toast("✅ Job saved");
      closeJob();
      await loadAll();
    } catch (e: any) {
      toast(`<span style="color:#ffbdbd">${String(e?.message || e)}</span>`);
    } finally {
      setLoading(false);
    }
  }

  async function setJobStatus(jobId: string, status: JobStatus) {
    setLoading(true);
    try {
      await apiJson(token, `/admin/jobs/${encodeURIComponent(jobId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, status, updatedAt: new Date().toISOString() } : j)));
      toast(`✅ Status: ${status}`);
    } catch (e: any) {
      toast(`<span style="color:#ffbdbd">${String(e?.message || e)}</span>`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteJob(jobId: string) {
    if (!confirm("Delete this job? This cannot be undone.")) return;

    setLoading(true);
    try {
      await apiJson(token, `/admin/jobs/${encodeURIComponent(jobId)}/delete`, { method: "POST" });
      setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
      toast("🗑️ Job deleted");
    } catch (e: any) {
      toast(`<span style="color:#ffbdbd">${String(e?.message || e)}</span>`);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Select-all helpers (job modal) ---------------- */
  const allGeneralIds = useMemo(() => (banks.general || []).map((q) => q.id), [banks.general]);
  const allPersonalIds = useMemo(() => (banks.personal || []).map((q) => q.id), [banks.personal]);

  function setAllGeneral(on: boolean) {
    setDraft({ generalQuestionIds: on ? [...allGeneralIds] : [] });
  }
  function setAllPersonal(on: boolean) {
    setDraft({ personalQuestionIds: on ? [...allPersonalIds] : [] });
  }

  /* ---------------- Guards ---------------- */
  if (!user) {
    return (
      <PageShell title="Jobs Admin" subtitle="Manage jobs and questionnaires">
        <div className="card" style={{ marginTop: 16, borderRadius: 14 }}>
          <div className="card-content">
            <p>Please log in first.</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (!isAllowed) {
    return (
      <PageShell title="Jobs Admin" subtitle="Manage jobs and questionnaires">
        <div className="card" style={{ marginTop: 16, borderRadius: 14 }}>
          <div className="card-content">
            <p>You don’t have access to this page.</p>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ---------------- Render ---------------- */
  return (
    <PageShell
      title="Jobs Admin"
      subtitle="Create jobs, enable/pause/disable, delete jobs, and build questionnaires (General / Personal / Role-specific)"
      right={
        <>
          <button className="btn grey lighten-2 black-text" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
          <button className="btn blue lighten-1" onClick={openBanks} disabled={loading}>
            Edit Question Banks
          </button>
          <button className="btn green" onClick={openCreateJob} disabled={loading}>
            + Add Job
          </button>
        </>
      }
    >
      <>
        {/* FILTERS */}
        <SectionCard
          title="Filters"
          subtitle="Find jobs quickly by status, team, tags, visibility, and recent updates."
          right={
            <button
              className="btn-flat"
              type="button"
              onClick={() => {
                setFilterStatus("");
                setFilterVisibility("");
                setFilterTeam("");
                setFilterTag("");
                setSortBy("UPDATED_DESC");
                setSearch("");
              }}
              disabled={loading}
            >
              Clear
            </button>
          }
        >
          <>
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m3">
                <label className="active" style={{ fontSize: 12 }}>
                  Status
                </label>
                <select className="browser-default" value={filterStatus} onChange={(e) => setFilterStatus((e.target.value as any) || "")}>
                  <option value="">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>

              <div className="input-field col s12 m3">
                <label className="active" style={{ fontSize: 12 }}>
                  Visibility
                </label>
                <select
                  className="browser-default"
                  value={filterVisibility}
                  onChange={(e) => setFilterVisibility((e.target.value as any) || "")}
                >
                  <option value="">All</option>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>

              <div className="input-field col s12 m3">
                <label className="active" style={{ fontSize: 12 }}>
                  Team
                </label>
                <select className="browser-default" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value || "")}>
                  <option value="">All</option>
                  {teamOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-field col s12 m3">
                <label className="active" style={{ fontSize: 12 }}>
                  Tag
                </label>
                <select className="browser-default" value={filterTag} onChange={(e) => setFilterTag(e.target.value || "")}>
                  <option value="">All</option>
                  {tagOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-field col s12 m6">
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title / team / location / tags..." />
                <label className="active">Search</label>
              </div>

              <div className="input-field col s12 m3">
                <label className="active" style={{ fontSize: 12 }}>
                  Sort
                </label>
                <select className="browser-default" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="UPDATED_DESC">Updated (new → old)</option>
                  <option value="UPDATED_ASC">Updated (old → new)</option>
                  <option value="TITLE_ASC">Title (A → Z)</option>
                  <option value="TITLE_DESC">Title (Z → A)</option>
                </select>
              </div>

              <div className="col s12 m3" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Pill text={`Showing ${filteredJobs.length}`} tone="blue" />
                <Pill text={`Total ${jobs.length}`} tone="grey" />
                {filterStatus && <Pill text={filterStatus} tone={filterStatus === "ACTIVE" ? "green" : filterStatus === "PAUSED" ? "orange" : "grey"} />}
              </div>
            </div>
          </>
        </SectionCard>

        <ProgressBar show={loading} />

        {/* LIST */}
        <div style={{ marginTop: 14 }}>
          {filteredJobs.map((j) => {
            const isExpanded = expandedJobId === j.jobId;
            const tone = j.status === "ACTIVE" ? "green" : j.status === "PAUSED" ? "orange" : "grey";
            return (
              <div
                className="card"
                key={j.jobId}
                style={{
                  borderRadius: 18,
                  boxShadow: "0 10px 34px rgba(0,0,0,0.07)",
                  overflow: "hidden",
                }}
              >
                <div className="card-content" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</span>
                        <span className={statusChipClass(j.status)} data-badge-caption={j.status} />
                        {j.isPublic === false ? <Pill text="Private" tone="grey" /> : <Pill text="Public" tone="blue" />}
                        <Pill
                          text={`${(j.generalQuestionIds || []).length} General`}
                          tone="default"
                        />
                        <Pill
                          text={`${(j.personalQuestionIds || []).length} Personal`}
                          tone="default"
                        />
                        <Pill
                          text={`${(j.roleQuestions || []).length} Role`}
                          tone="default"
                        />
                      </div>

                      <div className="grey-text" style={{ fontSize: 13, marginTop: 8 }}>
                        {(j.team || "—")} • {(j.location || "—")} • {(j.employmentType || "—")}
                      </div>

                      <CompactKeyValue left="Updated" right={formatDateTime(j.updatedAt)} />

                      {!!(j.tags || []).length && (
                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(j.tags || []).map((t, idx) => (
                            <span
                              key={`${t}_${idx}`}
                              className="chip"
                              style={{ margin: 0, cursor: "pointer" }}
                              title="Click to filter by this tag"
                              onClick={() => setFilterTag(t)}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {!!(j.description || "").trim() && (
                        <div style={{ marginTop: 10 }}>
                          <button
                            className="btn-flat"
                            type="button"
                            onClick={() => setExpandedJobId(isExpanded ? null : j.jobId)}
                            style={{ paddingLeft: 0 }}
                          >
                            {isExpanded ? "Hide description" : "Preview description"}
                          </button>
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: 8,
                                padding: 12,
                                borderRadius: 14,
                                background: "rgba(0,0,0,0.03)",
                                fontSize: 13,
                                lineHeight: 1.45,
                                maxHeight: 220,
                                overflow: "auto",
                              }}
                            >
                              <div className="grey-text" style={{ fontSize: 12, marginBottom: 6 }}>
                                Description preview
                              </div>
                              <div style={{ whiteSpace: "pre-wrap" }}>{j.description}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button className="btn grey lighten-2 black-text" onClick={() => openEditJob(j)} disabled={loading}>
                        Edit
                      </button>
                      <button className="btn green" onClick={() => setJobStatus(j.jobId, "ACTIVE")} disabled={loading} title="Set ACTIVE">
                        Enable
                      </button>
                      <button className="btn orange" onClick={() => setJobStatus(j.jobId, "PAUSED")} disabled={loading} title="Set PAUSED">
                        Pause
                      </button>
                      <button className="btn grey" onClick={() => setJobStatus(j.jobId, "DISABLED")} disabled={loading} title="Set DISABLED">
                        Disable
                      </button>
                      <button className="btn red" onClick={() => deleteJob(j.jobId)} disabled={loading}>
                        Delete
                      </button>
                      <Pill text={j.status} tone={tone} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && filteredJobs.length === 0 && (
            <div className="card" style={{ borderRadius: 16, boxShadow: "0 10px 34px rgba(0,0,0,0.07)" }}>
              <div className="card-content">
                <p className="grey-text">No jobs found.</p>
              </div>
            </div>
          )}
        </div>

        {/* ---------------- BANK MODAL ---------------- */}
        <div ref={bankModalRef} className="modal modal-fixed-footer" style={{ maxHeight: "88%", borderRadius: 16 }}>
          <div className="modal-content">
            <h5 style={{ marginTop: 0, fontWeight: 900 }}>Question Banks</h5>
            <p className="grey-text" style={{ marginTop: 6 }}>
              Add/edit/delete reusable questions. Each job selects which ones apply.
            </p>

            <div className="row">
              <div className="col s12 m6">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h6 style={{ margin: "12px 0" }}>General ({bankDraft.general.length})</h6>
                  <button className="btn blue lighten-1" type="button" onClick={() => addBank("general")} disabled={loading}>
                    + Add
                  </button>
                </div>

                {bankDraft.general.map((q) => (
                  <QuestionRowEditor
                    key={q.id}
                    q={q}
                    badge="General"
                    onChange={(patch) => updateBankQ("general", q.id, patch)}
                    onRemove={() => removeBankQ("general", q.id)}
                  />
                ))}
              </div>

              <div className="col s12 m6">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h6 style={{ margin: "12px 0" }}>Personal ({bankDraft.personal.length})</h6>
                  <button className="btn blue lighten-1" type="button" onClick={() => addBank("personal")} disabled={loading}>
                    + Add
                  </button>
                </div>

                {bankDraft.personal.map((q) => (
                  <QuestionRowEditor
                    key={q.id}
                    q={q}
                    badge="Personal"
                    onChange={(patch) => updateBankQ("personal", q.id, patch)}
                    onRemove={() => removeBankQ("personal", q.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn-flat" type="button" onClick={closeBanks} disabled={loading}>
              Cancel
            </button>
            <button className="btn green" type="button" onClick={saveBanks} disabled={loading}>
              Save Banks
            </button>
          </div>
        </div>

        {/* ---------------- JOB MODAL ---------------- */}
        <div ref={jobModalRef} className="modal modal-fixed-footer" style={{ maxHeight: "88%", borderRadius: 16 }}>
          <div className="modal-content">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <h5 style={{ marginTop: 0, fontWeight: 900 }}>{editingJobId ? "Edit Job" : "Add Job"}</h5>
                <div className="grey-text" style={{ fontSize: 12 }}>
                  Step through tabs: Details → Bank Questions → Role-specific.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Pill text={jobDraft.status} tone={jobDraft.status === "ACTIVE" ? "green" : jobDraft.status === "PAUSED" ? "orange" : "grey"} />
                {jobDraft.isPublic === false ? <Pill text="Private" tone="grey" /> : <Pill text="Public" tone="blue" />}
              </div>
            </div>

            {/* Tabs (simple, no Materialize Tabs dependency) */}
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                className={`btn ${jobModalTab === "DETAILS" ? "blue" : "grey lighten-2 black-text"}`}
                onClick={() => setJobModalTab("DETAILS")}
              >
                1) Details
              </button>
              <button
                type="button"
                className={`btn ${jobModalTab === "BANKS" ? "blue" : "grey lighten-2 black-text"}`}
                onClick={() => setJobModalTab("BANKS")}
              >
                2) Bank Questions
              </button>
              <button
                type="button"
                className={`btn ${jobModalTab === "ROLE" ? "blue" : "grey lighten-2 black-text"}`}
                onClick={() => setJobModalTab("ROLE")}
              >
                3) Role-specific
              </button>
            </div>

            <div className="divider" style={{ margin: "14px 0" }} />

            {/* DETAILS TAB */}
            {jobModalTab === "DETAILS" && (
              <SectionCard title="Job Details" subtitle="Core job information shown on the public jobs page.">
                <>
                  <div className="row">
                    <div className="input-field col s12 m6">
                      <input value={jobDraft.title} onChange={(e) => setDraft({ title: e.target.value })} />
                      <label className="active">Job Title</label>
                    </div>

                    <div className="input-field col s12 m6">
                      <input value={jobDraft.team || ""} onChange={(e) => setDraft({ team: e.target.value })} />
                      <label className="active">Team / Department</label>
                    </div>

                    <div className="input-field col s12 m6">
                      <input value={jobDraft.location || ""} onChange={(e) => setDraft({ location: e.target.value })} />
                      <label className="active">Location</label>
                    </div>

                    <div className="input-field col s12 m6">
                      <input value={jobDraft.employmentType || ""} onChange={(e) => setDraft({ employmentType: e.target.value })} />
                      <label className="active">Employment Type</label>
                    </div>

                    <div className="input-field col s12">
                      <input
                        value={(jobDraft.tags || []).join(", ")}
                        onChange={(e) =>
                          setDraft({
                            tags: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="UE5, Blueprints, Remote"
                      />
                      <label className="active">Tags (comma-separated)</label>
                    </div>

                    <div className="col s12" style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={jobDraft.isPublic !== false}
                          onChange={(e) => setDraft({ isPublic: e.target.checked })}
                        />
                        <span>Publicly visible (shows on /jobs)</span>
                      </label>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="btn grey lighten-2 black-text" type="button" onClick={() => setDraft({ status: "ACTIVE" })}>
                          ACTIVE
                        </button>
                        <button className="btn grey lighten-2 black-text" type="button" onClick={() => setDraft({ status: "PAUSED" })}>
                          PAUSED
                        </button>
                        <button className="btn grey lighten-2 black-text" type="button" onClick={() => setDraft({ status: "DISABLED" })}>
                          DISABLED
                        </button>
                      </div>
                    </div>

                    <div className="input-field col s12">
                      <textarea
                        className="materialize-textarea"
                        value={jobDraft.description || ""}
                        onChange={(e) => setDraft({ description: e.target.value })}
                        placeholder="Write job description (HTML/Markdown — your server decides)"
                        style={{ minHeight: 160, borderRadius: 14, padding: "12px 12px", background: "rgba(0,0,0,0.02)" }}
                      />
                      <label className="active">Description</label>
                    </div>
                  </div>
                </>
              </SectionCard>
            )}

            {/* BANKS TAB */}
            {jobModalTab === "BANKS" && (
              <SectionCard
                title="Bank Questions"
                subtitle="Pick General + Personal questions for this job. (Select-all included.)"
                right={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="btn grey lighten-2 black-text" type="button" onClick={() => setAllGeneral(true)}>
                      General: Select all
                    </button>
                    <button className="btn grey lighten-2 black-text" type="button" onClick={() => setAllGeneral(false)}>
                      General: Clear
                    </button>
                    <button className="btn grey lighten-2 black-text" type="button" onClick={() => setAllPersonal(true)}>
                      Personal: Select all
                    </button>
                    <button className="btn grey lighten-2 black-text" type="button" onClick={() => setAllPersonal(false)}>
                      Personal: Clear
                    </button>
                  </div>
                }
              >
                <>
                  <div className="row">
                    <div className="col s12 m6">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <h6 style={{ margin: "8px 0", fontWeight: 900 }}>General Questions</h6>
                        <Pill text={`${(jobDraft.generalQuestionIds || []).length}/${(banks.general || []).length}`} tone="blue" />
                      </div>

                      {(banks.general || []).length === 0 && <p className="grey-text">No general questions yet.</p>}

                      {banks.general.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 14,
                            background: (jobDraft.generalQuestionIds || []).includes(q.id) ? "rgba(52,152,219,0.10)" : "rgba(0,0,0,0.02)",
                            marginBottom: 8,
                          }}
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={(jobDraft.generalQuestionIds || []).includes(q.id)}
                              onChange={() => setDraft({ generalQuestionIds: toggleId(jobDraft.generalQuestionIds || [], q.id) })}
                            />
                            <span style={{ fontWeight: 700 }}>
                              {q.label}{" "}
                              <span className="grey-text" style={{ fontSize: 12 }}>
                                ({q.type})
                              </span>
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>

                    <div className="col s12 m6">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                        <h6 style={{ margin: "8px 0", fontWeight: 900 }}>Personal Info Questions</h6>
                        <Pill text={`${(jobDraft.personalQuestionIds || []).length}/${(banks.personal || []).length}`} tone="blue" />
                      </div>

                      {(banks.personal || []).length === 0 && <p className="grey-text">No personal questions yet.</p>}

                      {banks.personal.map((q) => (
                        <div
                          key={q.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 14,
                            background: (jobDraft.personalQuestionIds || []).includes(q.id) ? "rgba(52,152,219,0.10)" : "rgba(0,0,0,0.02)",
                            marginBottom: 8,
                          }}
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={(jobDraft.personalQuestionIds || []).includes(q.id)}
                              onChange={() => setDraft({ personalQuestionIds: toggleId(jobDraft.personalQuestionIds || [], q.id) })}
                            />
                            <span style={{ fontWeight: 700 }}>
                              {q.label}{" "}
                              <span className="grey-text" style={{ fontSize: 12 }}>
                                ({q.type})
                              </span>
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              </SectionCard>
            )}

            {/* ROLE TAB */}
            {jobModalTab === "ROLE" && (
              <SectionCard
                title="Role-specific Questions"
                subtitle="These are unique to this job. Bank selections above stay separate."
                right={
                  <button className="btn blue lighten-1" type="button" onClick={addRoleQ} disabled={loading}>
                    + Add
                  </button>
                }
              >
                <>
                  {(jobDraft.roleQuestions || []).length === 0 && (
                    <div style={{ padding: "12px 0" }}>
                      <p className="grey-text" style={{ margin: 0 }}>
                        No role-specific questions yet.
                      </p>
                    </div>
                  )}

                  {(jobDraft.roleQuestions || []).map((q) => (
                    <QuestionRowEditor key={q.id} q={q} badge="Role" onChange={(patch) => updateRoleQ(q.id, patch)} onRemove={() => removeRoleQ(q.id)} />
                  ))}
                </>
              </SectionCard>
            )}
          </div>

          <div className="modal-footer" style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
            <div className="grey-text" style={{ fontSize: 12, paddingLeft: 10 }}>
              General: <b>{(jobDraft.generalQuestionIds || []).length}</b> • Personal: <b>{(jobDraft.personalQuestionIds || []).length}</b> • Role:{" "}
              <b>{(jobDraft.roleQuestions || []).length}</b>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-flat" type="button" onClick={closeJob} disabled={loading}>
                Cancel
              </button>
              <button className="btn green" type="button" onClick={saveJob} disabled={loading}>
                Save Job
              </button>
            </div>
          </div>
        </div>
      </>
    </PageShell>
  );
}
