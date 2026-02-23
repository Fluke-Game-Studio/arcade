// src/pages/Admin.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type {
  ApiUser,
  CreateUserBody,
  UpdateUserBody,
  SendEmployeeDocEmailBody,
} from "../api";

declare const M: any;

type AdminForm = CreateUserBody & {
  employee_manager?: string;
  project_id?: string;

  employee_id?: string;
  employee_date_started?: string;
  employee_address?: string;
  revoked?: boolean;
};

const EMPTY: AdminForm = {
  username: "",
  password: "",
  employee_name: "",
  employee_email: "",
  employee_role: "employee",
  employee_dob: "",
  employee_profilepicture: "",
  employee_phonenumber: "",
  employee_title: "",
  employment_type: "",
  department: "",
  location: "",
  employee_manager: "",
  project_id: "",
  employee_id: "",
  employee_date_started: "",
  employee_address: "",
  revoked: false,
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function getRoleLower(anyUser: any) {
  const r =
    safeStr(anyUser?.employee_role) ||
    safeStr(anyUser?.role) ||
    safeStr(anyUser?.employeeRole) ||
    safeStr(anyUser?.claims?.role);
  return (r || "employee").toLowerCase();
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
}

function isHttpUrl(s: string) {
  const t = safeStr(s);
  if (!t) return false;
  return /^https?:\/\/.+/i.test(t);
}

function formatLongDate(yyyyMmDd: string) {
  if (!yyyyMmDd) return "";
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function roleChipColors(roleLower: string) {
  const r = (roleLower || "employee").toLowerCase();
  if (r === "super") {
    return { bg: "rgba(168,85,247,0.16)", bd: "rgba(168,85,247,0.28)", tx: "#6d28d9" };
  }
  if (r === "admin") {
    return { bg: "rgba(59,130,246,0.14)", bd: "rgba(59,130,246,0.26)", tx: "#1d4ed8" };
  }
  return { bg: "rgba(34,197,94,0.12)", bd: "rgba(34,197,94,0.22)", tx: "#166534" };
}

function RolePill({ role }: { role: string }) {
  const c = roleChipColors(role);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.bd}`,
        color: c.tx,
        fontWeight: 1000,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      <i className="material-icons" style={{ fontSize: 16 }}>
        {role === "super" ? "auto_awesome" : role === "admin" ? "admin_panel_settings" : "badge"}
      </i>
      {role}
    </span>
  );
}

function ModalSection({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #e6edf2",
        borderRadius: 16,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        marginTop: 12,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #eef2f7",
          background:
            "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f1f5f9",
              border: "1px solid #e6edf2",
              flex: "0 0 auto",
            }}
          >
            <i className="material-icons" style={{ fontSize: 18, color: "#334e68" }}>
              {icon}
            </i>
          </div>
          <div>
            <div style={{ fontWeight: 1000, color: "#0f172a", lineHeight: "18px" }}>
              {title}
            </div>
            {hint ? (
              <div style={{ marginTop: 2, fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                {hint}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ padding: "10px 12px 2px" }}>{children}</div>
    </div>
  );
}

export default function Admin() {
  const { api, user } = useAuth();

  const myRole = useMemo(() => getRoleLower(user), [user]);
  const isSuper = myRole === "super";
  const isAdmin = myRole === "admin" || isSuper;

  const [rows, setRows] = useState<ApiUser[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<AdminForm>({ ...EMPTY });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editingTargetRole, setEditingTargetRole] = useState<string>("employee");

  const modalRef = useRef<HTMLDivElement | null>(null);
  const composerModalRef = useRef<HTMLDivElement | null>(null);

  const [composerEmployee, setComposerEmployee] = useState<ApiUser | null>(null);
  const [composerRoleTitle, setComposerRoleTitle] = useState("");
  const [composerSubjectOverride, setComposerSubjectOverride] = useState(
    "Experience Certificate | Fluke Games"
  );
  const [composerSetStatus, setComposerSetStatus] = useState("experience_sent");
  const [extraInfo, setExtraInfo] = useState("");

  const [dateStarted, setDateStarted] = useState("");
  const [dateEnded, setDateEnded] = useState("");
  const [currentDate, setCurrentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setRows(data);

      try {
        const proj = await (api as any).getProjects?.();
        if (Array.isArray(proj)) setProjects(proj);
      } catch {}

      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();

    if (typeof M !== "undefined" && modalRef.current) {
      M.Modal.init(modalRef.current, {
        dismissible: true,
        onOpenEnd: () =>
          setTimeout(() => {
            try {
              M.updateTextFields();
            } catch {}
          }, 0),
      });
    }

    if (typeof M !== "undefined" && composerModalRef.current) {
      M.Modal.init(composerModalRef.current, {
        dismissible: true,
        onOpenEnd: () =>
          setTimeout(() => {
            try {
              M.updateTextFields();
            } catch {}
          }, 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (u) =>
        (u.employee_name || "").toLowerCase().includes(q) ||
        (u.employee_email || "").toLowerCase().includes(q) ||
        (u.employee_role || "").toLowerCase().includes(q) ||
        (u.username || "").toLowerCase().includes(q) ||
        safeStr((u as any).employee_id).toLowerCase().includes(q)
    );
  }, [rows, query]);

  function openModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    setTimeout(() => {
      try {
        M.updateTextFields();
      } catch {}
    }, 0);
    inst.open();
  }

  function closeModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    M.Modal.getInstance(modalRef.current)?.close();
  }

  function canEditTarget(target: ApiUser) {
    if (!isAdmin) return false;
    const targetRole = getRoleLower(target);
    // Admin cannot edit SUPER; Super can edit everyone.
    if (targetRole === "super" && !isSuper) return false;
    return true;
  }

  function isFieldLockedForAdmin(field: keyof AdminForm) {
    if (isSuper) return false;
    // Admin cannot change identifiers (on edit)
    if (field === "username" || field === "employee_email" || field === "employee_id") return true;
    return false;
  }

  function openModalForAdd() {
    if (!isAdmin) {
      M?.toast?.({ html: "Forbidden", classes: "red" });
      return;
    }
    setEditingUsername(null);
    setEditingTargetRole("employee");
    setForm({ ...EMPTY });
    openModal();
  }

  function openModalForEdit(username: string) {
    const u = rows.find((x) => x.username === username);
    if (!u) return;

    if (!canEditTarget(u)) {
      M.toast({ html: "You cannot edit this user.", classes: "red" });
      return;
    }

    const tRole = getRoleLower(u);
    setEditingUsername(u.username);
    setEditingTargetRole(tRole);

    setForm({
      ...EMPTY,
      username: u.username,
      password: "",
      employee_name: safeStr(u.employee_name),
      employee_email: safeStr(u.employee_email),
      employee_role: (u.employee_role as any) || "employee",
      employee_dob: safeStr((u as any).employee_dob),
      employee_profilepicture: safeStr((u as any).employee_profilepicture),
      employee_phonenumber: safeStr((u as any).employee_phonenumber),
      employee_title: safeStr((u as any).employee_title),
      employment_type: safeStr((u as any).employment_type),
      department: safeStr((u as any).department),
      location: safeStr((u as any).location),
      employee_manager: safeStr((u as any).employee_manager),
      project_id: safeStr((u as any).project_id),
      employee_id: safeStr((u as any).employee_id),
      employee_date_started: safeStr((u as any).employee_date_started),
      employee_address: safeStr((u as any).employee_address),
      revoked: !!(u as any).revoked,
    });

    openModal();
  }

  async function saveFromModal(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    if (!safeStr(form.username) || !safeStr(form.employee_name) || !safeStr(form.employee_email)) {
      M.toast({ html: "Username, Name, and Email are required.", classes: "red" });
      return;
    }

    if (editingUsername && editingTargetRole === "super" && !isSuper) {
      M.toast({ html: "Admins cannot edit SUPER users.", classes: "red" });
      return;
    }

    try {
      setLoading(true);

      if (editingUsername) {
        const update: any = {
          username: editingUsername,
          employee_name: form.employee_name || undefined,
          employee_title: form.employee_title || undefined,
          employee_profilepicture: form.employee_profilepicture || undefined,
          employee_phonenumber: form.employee_phonenumber || undefined,
          employment_type: form.employment_type || undefined,
          department: form.department || undefined,
          location: form.location || undefined,
          employee_dob: form.employee_dob || undefined,
          employee_address: form.employee_address || undefined,
          employee_date_started: form.employee_date_started || undefined,
          employee_manager: form.employee_manager || undefined,
          project_id: form.project_id || undefined,
          revoked: form.revoked ?? false,
        };

        if (safeStr(form.password)) update.password = form.password;

        // ✅ Role can only be changed by SUPER (admins never send employee_role)
        if (isSuper) update.employee_role = form.employee_role || undefined;

        // identifiers: only super can modify
        if (isSuper) {
          update.username = safeStr(form.username) || editingUsername;
          update.employee_email = safeStr(form.employee_email) || undefined;
          update.employee_id = safeStr(form.employee_id) || undefined;
        } else {
          delete update.employee_email;
          delete update.employee_id;
          update.username = editingUsername;
        }

        await api.updateUser(update as UpdateUserBody as any);
        M.toast({ html: "User updated.", classes: "green" });
      } else {
        const createBody: any = {
          username: safeStr(form.username),
          password: safeStr(form.password),
          employee_name: safeStr(form.employee_name),
          employee_email: safeStr(form.employee_email),
          employee_role: "employee", // safe create
          employee_title: form.employee_title || undefined,
          employee_profilepicture: form.employee_profilepicture || undefined,
          employee_phonenumber: form.employee_phonenumber || undefined,
          employment_type: form.employment_type || undefined,
          department: form.department || undefined,
          location: form.location || undefined,
          employee_dob: form.employee_dob || undefined,
          employee_address: form.employee_address || undefined,
          employee_date_started: form.employee_date_started || undefined,
          employee_manager: form.employee_manager || undefined,
          project_id: form.project_id || undefined,
          employee_id: form.employee_id || undefined,
        };

        if (!createBody.password) {
          M.toast({ html: "Password required for new employee.", classes: "red" });
          setLoading(false);
          return;
        }

        await api.createUser(createBody as CreateUserBody as any);
        M.toast({ html: "Employee created.", classes: "green" });
      }

      await load();
      closeModal();
    } catch (e: any) {
      console.error(e);
      M.toast({ html: e.message ?? "Action failed.", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  function openComposer(u: ApiUser) {
    if (!canEditTarget(u)) {
      M.toast({ html: "You cannot send docs for this user.", classes: "red" });
      return;
    }

    setComposerEmployee(u);
    setComposerRoleTitle(safeStr(u.employee_title));
    setComposerSubjectOverride("Experience Certificate | Fluke Games");
    setComposerSetStatus("experience_sent");
    setExtraInfo("");

    setDateStarted("");
    setDateEnded("");
    setCurrentDate(new Date().toISOString().slice(0, 10));

    if (!composerModalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(composerModalRef.current) ||
      M.Modal.init(composerModalRef.current);
    inst.open();
    setTimeout(() => {
      try {
        M.updateTextFields();
      } catch {}
    }, 0);
  }

  function closeComposer() {
    if (!composerModalRef.current || typeof M === "undefined") return;
    M.Modal.getInstance(composerModalRef.current)?.close();
  }

  async function sendNow() {
    if (!composerEmployee?.username) {
      M.toast({ html: "Missing employee username.", classes: "red" });
      return;
    }
    if (!dateStarted || !dateEnded) {
      M.toast({ html: "Experience: dateStarted and dateEnded are required.", classes: "red" });
      return;
    }

    setSending(true);
    try {
      const vars: Record<string, any> = {
        ...(extraInfo.trim() ? { extraInfo: extraInfo.trim(), EXTRA_INFO: extraInfo.trim() } : {}),
        ...(currentDate ? { CURRENT_DATE: formatLongDate(currentDate) } : {}),
        ...(dateStarted ? { START_DATE: formatLongDate(dateStarted) } : {}),
        ...(dateEnded ? { END_DATE: formatLongDate(dateEnded) } : {}),
      };

      const body: SendEmployeeDocEmailBody = {
        type: "EXPERIENCE",
        roleTitle: composerRoleTitle || undefined,
        subjectOverride: composerSubjectOverride || undefined,
        setStatus: composerSetStatus || undefined,
        dateStarted: dateStarted || undefined,
        dateEnded: dateEnded || undefined,
        vars: Object.keys(vars).length ? vars : undefined,
      };

      const resp = await (api as any).sendEmployeeDocEmail(composerEmployee.username, body);
      M.toast({ html: String(resp?.message || resp?.status || "Sent"), classes: "green" });
      closeComposer();
    } catch (e: any) {
      M.toast({ html: e?.message || "Send failed", classes: "red" });
    } finally {
      setSending(false);
    }
  }

  const myChip = roleChipColors(myRole);

  return (
    <>
      <main className="container" style={{ paddingTop: 18, maxWidth: 1180 }}>
        <style>{`
          .adm-shell { animation: admFadeUp 240ms ease both; }
          @keyframes admFadeUp { from { opacity:0; transform: translateY(6px);} to { opacity:1; transform: translateY(0);} }

          .adm-hero {
            border-radius: 18px;
            overflow:hidden;
            border: 1px solid #e6edf2;
            background:
              radial-gradient(760px 200px at 18% 10%, rgba(59,130,246,0.22), transparent 55%),
              radial-gradient(650px 220px at 88% 40%, rgba(168,85,247,0.14), transparent 55%),
              linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
            color: white;
            padding: 14px 14px;
            box-shadow: 0 16px 34px rgba(0,0,0,0.18);
          }
          .adm-heroRow { display:flex; align-items:center; justify-content:space-between; gap: 12px; flex-wrap: wrap; }
          .adm-heroLeft { display:flex; align-items:center; gap: 12px; min-width: 0; }
          .adm-meAvatar {
            width: 54px; height: 54px; border-radius: 18px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.16);
            display:flex; align-items:center; justify-content:center;
            font-weight: 1000; letter-spacing: .6px;
            overflow:hidden;
            box-shadow: 0 14px 28px rgba(0,0,0,0.18);
          }
          .adm-meAvatar img { width:100%; height:100%; object-fit:cover; display:block; }
          .adm-heroTitle { font-weight: 1000; font-size: 18px; line-height: 22px; margin:0; }
          .adm-heroSub { margin-top: 4px; font-size: 12.5px; color: rgba(255,255,255,0.80); font-weight: 800; }
          .adm-chip {
            display:inline-flex; align-items:center; gap: 8px;
            padding: 7px 12px;
            border-radius: 999px;
            background: ${myChip.bg};
            border: 1px solid ${myChip.bd};
            color: ${myChip.tx};
            font-weight: 1000;
            letter-spacing: .6px;
            text-transform: uppercase;
            user-select:none;
            font-size: 12px;
          }
          .adm-btn { border-radius: 12px !important; font-weight: 1000 !important; text-transform: none !important; }
          .adm-card { border-radius: 18px; overflow: visible; border: 1px solid #e6edf2; }
          .adm-cardHead {
            padding: 12px 14px;
            border-bottom: 1px solid #eef2f7;
            background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
            display:flex;
            align-items:center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
          }
          .adm-cardHead .t { font-weight: 1000; color:#0f172a; font-size: 14.5px; }
          .adm-cardHead .h { font-weight: 800; font-size: 12px; color:#607d8b; margin-top: 2px; }
          .adm-searchRow { display:flex; align-items:center; gap: 10px; flex-wrap: wrap; }
          .adm-searchRow .input-field { margin: 0; flex: 1 1 420px; min-width: 240px; }

          .adm-tableWrap { overflow:auto; padding-right: 12px; }
          .adm-table td:last-child { padding-right: 18px; }
          .adm-table { width: 100%; border-collapse: collapse; }
          .adm-table th {
            position: sticky; top: 0; z-index: 1;
            background: #fff;
            border-bottom: 1px solid #eef2f7;
            text-align:left;
            font-size: 12px;
            letter-spacing: .4px;
            text-transform: uppercase;
            color: #607d8b;
            padding: 12px 12px;
            white-space: nowrap;
          }
          .adm-table td {
            border-bottom: 1px solid #f1f5f9;
            padding: 12px 12px;
            vertical-align: middle;
            white-space: nowrap;
          }
          .adm-rowMain { display:flex; align-items:center; gap: 10px; min-width: 0; }
          .adm-rowAvatar {
            width: 38px; height: 38px; border-radius: 14px;
            display:flex; align-items:center; justify-content:center;
            font-weight: 1000; letter-spacing: .5px;
            background: #eef2f7;
            border: 1px solid #e6edf2;
            overflow:hidden;
            flex: 0 0 auto;
          }
          .adm-rowAvatar img { width:100%; height:100%; object-fit:cover; display:block; }
          .adm-name { font-weight: 1000; color:#0f172a; max-width: 280px; overflow:hidden; text-overflow: ellipsis; }
          .adm-sub { font-size: 12px; color:#607d8b; font-weight: 800; max-width: 320px; overflow:hidden; text-overflow: ellipsis; }
          .adm-actions { display:inline-flex; gap: 8px; }
          .adm-lock { opacity: .55; }
          .adm-miniCode {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 999px;
            background: #fbfdff;
            border: 1px solid #e6edf2;
            color: #334e68;
          }

          /* Modal fancy */
          .adm-modalHero {
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.10);
            background:
              radial-gradient(760px 200px at 18% 10%, rgba(59,130,246,0.32), transparent 55%),
              radial-gradient(650px 220px at 88% 40%, rgba(168,85,247,0.22), transparent 55%),
              linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
            color: white;
            padding: 12px 12px;
            display:flex;
            align-items:center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
          }
          .adm-modalHeroLeft { display:flex; align-items:center; gap: 12px; min-width: 0; }
          .adm-modalAvatar {
            width: 54px; height: 54px;
            border-radius: 18px;
            overflow:hidden;
            display:flex; align-items:center; justify-content:center;
            font-weight: 1000;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.16);
            flex: 0 0 auto;
            position: relative;
            box-shadow: 0 14px 28px rgba(0,0,0,0.18);
          }
          .adm-modalAvatar img { width:100%; height:100%; object-fit:cover; display:block; }
          .adm-modalAvatar .dot {
            position:absolute; right:6px; bottom:6px;
            width:10px; height:10px; border-radius: 999px;
            background:#22c55e; border: 2px solid rgba(15,23,42,0.95);
            box-shadow: 0 10px 18px rgba(0,0,0,0.20);
          }
          .adm-modalTitle { font-weight: 1000; font-size: 15px; line-height: 18px; margin:0; }
          .adm-modalSub { margin-top: 3px; font-size: 12px; color: rgba(255,255,255,0.78); font-weight: 800; }
          .adm-modalChip {
            display:inline-flex; align-items:center; gap: 8px;
            padding: 6px 12px;
            border-radius: 999px;
            border: 1px solid rgba(255,255,255,0.16);
            background: rgba(255,255,255,0.10);
            font-weight: 1000;
            letter-spacing: .6px;
            text-transform: uppercase;
            user-select:none;
            font-size: 12px;
          }

          .adm-modalGrid {
            display:grid;
            grid-template-columns: repeat(12, 1fr);
            gap: 10px;
            margin-top: 12px;
          }
          .adm-span-4 { grid-column: span 4; }
          .adm-span-6 { grid-column: span 6; }
          .adm-span-12 { grid-column: span 12; }
          @media (max-width: 992px) {
            .adm-span-4, .adm-span-6 { grid-column: span 12; }
          }

          /* Fix label overlap for selects */
          .adm-selectWrap { position: relative; }
          .adm-selectWrap label {
            position: static !important;
            display:block;
            margin: 0 0 6px 0;
            transform: none !important;
            font-size: 12px;
            color: #607d8b;
            font-weight: 900;
            letter-spacing: .4px;
            text-transform: uppercase;
          }
        `}</style>

        <div className="adm-shell">
          {/* HERO */}
          <div className="adm-hero">
            <div className="adm-heroRow">
              <div className="adm-heroLeft">
                <div className="adm-meAvatar" title={safeStr(user?.username)}>
                  <span>{initials(safeStr(user?.username))}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="adm-heroTitle">Admin Panel</div>
                  <div className="adm-heroSub">
                    {isSuper
                      ? "SUPER: edit anyone (including admins + supers)."
                      : "ADMIN: edit employees + admins, cannot edit SUPER users."}
                  </div>
                </div>
              </div>

              <span className="adm-chip" title="Your role">
                <i className="material-icons" style={{ fontSize: 16 }}>
                  {isSuper ? "auto_awesome" : "admin_panel_settings"}
                </i>
                {myRole.toUpperCase()}
              </span>
            </div>
          </div>

          {/* USERS CARD */}
          <div className="card z-depth-1 adm-card" style={{ marginTop: 14 }}>
            <div className="adm-cardHead">
              <div>
                <div className="t">Users ({rows.length})</div>
                <div className="h">Search, edit, and send employee docs.</div>
              </div>

              <div className="adm-searchRow">
                <div className="input-field" style={{ minWidth: 260 }}>
                  <input
                    id="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search…"
                  />
                  <label htmlFor="search" className="active">
                    username / name / email / role / employee_id
                  </label>
                </div>

                <button className="btn adm-btn" onClick={openModalForAdd} disabled={!isAdmin}>
                  <i className="material-icons left">person_add</i>
                  Add Employee
                </button>
              </div>
            </div>

            <div className="card-content" style={{ padding: 0 }}>
              {loading && <p style={{ padding: 14 }}>Loading…</p>}
              {err && <p className="red-text" style={{ padding: 14 }}>{err}</p>}

              {!loading && !err && (
                <div className="adm-tableWrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Employee ID</th>
                        <th>Project</th>
                        <th className="right-align">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((u) => {
                        const tRole = getRoleLower(u);
                        const locked = tRole === "super" && !isSuper;
                        const canEdit = canEditTarget(u);

                        return (
                          <tr key={u.username} className={locked ? "adm-lock" : ""}>
                            <td>
                              <div className="adm-rowMain">
                                <div className="adm-rowAvatar" title={u.employee_name || u.username}>
                                  {isHttpUrl((u as any).employee_profilepicture) ? (
                                    <img src={(u as any).employee_profilepicture} alt="avatar" />
                                  ) : (
                                    <span>{initials(u.employee_name || u.username)}</span>
                                  )}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="adm-name">{u.employee_name || "—"}</div>
                                  <div className="adm-sub">
                                    <span className="adm-miniCode">{u.username}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="adm-miniCode">{u.employee_email || "—"}</span>
                            </td>

                            <td>
                              <RolePill role={tRole} />
                            </td>

                            <td>
                              <span className="adm-miniCode">{safeStr((u as any).employee_id) || "—"}</span>
                            </td>

                            <td>
                              <span className="adm-miniCode">{safeStr((u as any).project_id) || "—"}</span>
                            </td>

                            <td className="right-align">
                              <div className="adm-actions">
                                <button
                                  className="btn-small adm-btn"
                                  onClick={() => openModalForEdit(u.username)}
                                  disabled={!canEdit}
                                  title={locked ? "Admins cannot edit SUPER users" : "Edit user"}
                                >
                                  <i className="material-icons left">edit</i>
                                </button>

                                <button
                                  className="btn-small grey darken-2 adm-btn"
                                  onClick={() => openComposer(u)}
                                  disabled={!canEdit}
                                  title="Send Experience Certificate"
                                >
                                  <i className="material-icons left">mail</i>
                                  Composer
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {!filtered.length && (
                        <tr>
                          <td colSpan={6} style={{ padding: 14 }}>
                            No users found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ----------------------- EDIT MODAL ------------------------- */}
      <div ref={modalRef} id="employeeModal" className="modal modal-fixed-footer">
        <form onSubmit={saveFromModal}>
          <div className="modal-content">
            <div className="adm-modalHero">
              <div className="adm-modalHeroLeft">
                <div className="adm-modalAvatar" title={safeStr(form.employee_name) || safeStr(form.username)}>
                  {isHttpUrl(form.employee_profilepicture || "") ? (
                    <img
                      src={form.employee_profilepicture as any}
                      alt="avatar"
                      onError={(e) => {
                        (e.currentTarget as any).style.display = "none";
                      }}
                    />
                  ) : (
                    <span>{initials(safeStr(form.employee_name) || safeStr(form.username))}</span>
                  )}
                  <span className="dot" />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="adm-modalTitle">{editingUsername ? "Edit User" : "Add Employee"}</div>
                  <div className="adm-modalSub">
                    {editingUsername ? (
                      <>
                        Editing:{" "}
                        <code
                          style={{
                            background: "rgba(255,255,255,0.10)",
                            border: "1px solid rgba(255,255,255,0.16)",
                            padding: "2px 8px",
                            borderRadius: 999,
                            color: "rgba(255,255,255,0.95)",
                          }}
                        >
                          {editingUsername}
                        </code>
                      </>
                    ) : (
                      "Create a new employee account (defaults to EMPLOYEE)."
                    )}
                  </div>
                </div>
              </div>

              <span className="adm-modalChip" title="Your mode">
                <i className="material-icons" style={{ fontSize: 16 }}>
                  {isSuper ? "auto_awesome" : "admin_panel_settings"}
                </i>
                {isSuper ? "SUPER MODE" : "ADMIN MODE"}
              </span>
            </div>

            {editingUsername && editingTargetRole === "super" && !isSuper ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid #fecdd3",
                  background: "#fff1f2",
                  color: "#7f1d1d",
                  fontWeight: 900,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <i className="material-icons" style={{ color: "#b91c1c" }}>lock</i>
                <div>Admins cannot edit SUPER users.</div>
              </div>
            ) : null}

            <ModalSection
              title="Identity"
              hint="Admins can’t change username/email/employee_id (SUPER only)."
              icon="badge"
            >
              <div className="adm-modalGrid">
                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="username"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                      disabled={!!editingUsername || (!isSuper && isFieldLockedForAdmin("username"))}
                    />
                    <label className={form.username ? "active" : ""} htmlFor="username">Username</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="name"
                      value={form.employee_name}
                      onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
                    />
                    <label className={form.employee_name ? "active" : ""} htmlFor="name">Employee Name</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="email"
                      type="email"
                      value={form.employee_email}
                      onChange={(e) => setForm((f) => ({ ...f, employee_email: e.target.value }))}
                      disabled={!!editingUsername && (!isSuper && isFieldLockedForAdmin("employee_email"))}
                    />
                    <label className={form.employee_email ? "active" : ""} htmlFor="email">
                      Employee Email {!isSuper && editingUsername ? "(locked)" : ""}
                    </label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="employee_id"
                      value={form.employee_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
                      disabled={!!editingUsername && (!isSuper && isFieldLockedForAdmin("employee_id"))}
                    />
                    <label className={form.employee_id ? "active" : ""} htmlFor="employee_id">
                      Employee ID {!isSuper && editingUsername ? "(locked)" : ""}
                    </label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="password"
                      value={form.password || ""}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    />
                    <label className={form.password ? "active" : ""} htmlFor="password">
                      {editingUsername ? "New Password (optional)" : "Password"}
                    </label>
                  </div>
                </div>

                {/* ✅ ROLE: SUPER ONLY dropdown */}
                {isSuper ? (
                  <div className="adm-span-4">
                    <div className="adm-selectWrap">
                      <label>Role (SUPER only)</label>
                      <select
                        className="browser-default"
                        value={form.employee_role || "employee"}
                        onChange={(e) => setForm((f) => ({ ...f, employee_role: e.target.value as any }))}
                      >
                        <option value="employee">employee</option>
                        <option value="admin">admin</option>
                        <option value="super">super</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="adm-span-4" style={{ paddingTop: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#607d8b", textTransform: "uppercase", letterSpacing: 0.4 }}>
                      Role (read-only)
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <RolePill role={getRoleLower({ employee_role: form.employee_role })} />
                    </div>
                  </div>
                )}
              </div>
            </ModalSection>

            <ModalSection title="Employment & Contact" hint="Directory and HR metadata." icon="work">
              <div className="adm-modalGrid">
                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="dob"
                      value={form.employee_dob || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_dob: e.target.value }))}
                      placeholder="YYYY-MM-DD"
                    />
                    <label className={form.employee_dob ? "active" : ""} htmlFor="dob">DOB</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="date_started"
                      value={form.employee_date_started || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_date_started: e.target.value }))}
                      placeholder="YYYY-MM-DD"
                    />
                    <label className={form.employee_date_started ? "active" : ""} htmlFor="date_started">Date Started</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="address"
                      value={form.employee_address || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_address: e.target.value }))}
                    />
                    <label className={form.employee_address ? "active" : ""} htmlFor="address">Address</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="phone"
                      value={form.employee_phonenumber || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_phonenumber: e.target.value }))}
                    />
                    <label className={form.employee_phonenumber ? "active" : ""} htmlFor="phone">Phone</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="pic"
                      value={form.employee_profilepicture || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_profilepicture: e.target.value }))}
                      placeholder="https://…"
                    />
                    <label className={form.employee_profilepicture ? "active" : ""} htmlFor="pic">Profile Picture URL</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="title"
                      value={form.employee_title || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_title: e.target.value }))}
                    />
                    <label className={form.employee_title ? "active" : ""} htmlFor="title">Title</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="employment"
                      value={form.employment_type || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                    />
                    <label className={form.employment_type ? "active" : ""} htmlFor="employment">Employment Type</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="dept"
                      value={form.department || ""}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    />
                    <label className={form.department ? "active" : ""} htmlFor="dept">Department</label>
                  </div>
                </div>

                <div className="adm-span-4">
                  <div className="input-field">
                    <input
                      id="location"
                      value={form.location || ""}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    />
                    <label className={form.location ? "active" : ""} htmlFor="location">Location</label>
                  </div>
                </div>

                <div className="adm-span-6">
                  <div className="adm-selectWrap">
                    <label>Manager</label>
                    <select
                      className="browser-default"
                      value={form.employee_manager || ""}
                      onChange={(e) => setForm((f) => ({ ...f, employee_manager: e.target.value }))}
                    >
                      <option value="">Select Manager</option>
                      {rows.map((u) => (
                        <option key={u.username} value={u.username}>
                          {u.employee_name || u.username}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="adm-span-6">
                  <div className="adm-selectWrap">
                    <label>Assigned Project</label>
                    <select
                      className="browser-default"
                      value={form.project_id || ""}
                      onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                    >
                      <option value="">Select Project</option>
                      {projects.map((p) => (
                        <option key={p.projectId} value={p.projectId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {editingUsername ? (
                  <div className="adm-span-12" style={{ marginTop: 6 }}>
                    <label>
                      <input
                        type="checkbox"
                        className="filled-in"
                        checked={!!form.revoked}
                        onChange={(e) => setForm((f) => ({ ...f, revoked: e.target.checked }))}
                      />
                      <span>Revoked</span>
                    </label>
                  </div>
                ) : null}
              </div>
            </ModalSection>
          </div>

          <div className="modal-footer">
            <a className="modal-close btn-flat" onClick={closeModal}>Cancel</a>
            <button type="submit" className={`btn adm-btn ${loading ? "disabled" : ""}`} disabled={loading}>
              <i className="material-icons left">{editingUsername ? "save" : "add"}</i>
              {editingUsername ? "Save Changes" : "Create Employee"}
            </button>
          </div>
        </form>
      </div>

      {/* ----------------------- COMPOSER MODAL (EXPERIENCE ONLY) ------------------------- */}
      <div ref={composerModalRef} className="modal modal-fixed-footer">
        <div className="modal-content">
          <h5>Composer (Employee)</h5>
          <p className="grey-text" style={{ marginTop: 0 }}>
            Sends <b>Experience Certificate</b> using:
            <code style={{ marginLeft: 6 }}>POST /admin/employees/&lt;username&gt;/send-doc-email</code>
          </p>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m6">
              <input value={safeStr(composerEmployee?.employee_email)} disabled />
              <label className="active">To</label>
            </div>

            <div className="input-field col s12 m6">
              <input value={composerRoleTitle} onChange={(e) => setComposerRoleTitle(e.target.value)} />
              <label className="active">roleTitle</label>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m6">
              <input value={composerSubjectOverride} onChange={(e) => setComposerSubjectOverride(e.target.value)} />
              <label className="active">subjectOverride</label>
            </div>

            <div className="input-field col s12 m6">
              <input value={composerSetStatus} onChange={(e) => setComposerSetStatus(e.target.value)} />
              <label className="active">setStatus</label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateStarted</div>
              <input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} />
            </div>

            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateEnded</div>
              <input type="date" value={dateEnded} onChange={(e) => setDateEnded(e.target.value)} />
            </div>

            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>CURRENT_DATE</div>
              <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} />
            </div>
          </div>

          <div className="input-field" style={{ marginTop: 10 }}>
            <textarea
              className="materialize-textarea"
              value={extraInfo}
              onChange={(e) => setExtraInfo(e.target.value)}
              style={{ minHeight: 90 }}
            />
            <label className="active">vars.extraInfo (optional)</label>
          </div>

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Preview vars sent</summary>
            <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
{JSON.stringify(
  {
    START_DATE: dateStarted ? formatLongDate(dateStarted) : "",
    END_DATE: dateEnded ? formatLongDate(dateEnded) : "",
    CURRENT_DATE: currentDate ? formatLongDate(currentDate) : "",
    ...(extraInfo.trim() ? { extraInfo: extraInfo.trim(), EXTRA_INFO: extraInfo.trim() } : {}),
  },
  null,
  2
)}
            </pre>
          </details>
        </div>

        <div className="modal-footer">
          <a className="btn-flat" href="#!" onClick={closeComposer}>Cancel</a>
          <button className={`btn adm-btn ${sending ? "disabled" : ""}`} disabled={sending} onClick={sendNow}>
            <i className="material-icons left">{sending ? "hourglass_empty" : "send"}</i>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}