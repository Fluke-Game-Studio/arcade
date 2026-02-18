// src/pages/Admin.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser, CreateUserBody, UpdateUserBody, SendEmployeeDocEmailBody } from "../api";

declare const M: any;

// Include new fields: manager + project (UI-only project field)
const EMPTY: CreateUserBody & {
  employee_manager?: string;
  employee_project?: string; // UI alias for project_id
} = {
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
  employee_project: "",
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function formatLongDate(yyyyMmDd: string) {
  if (!yyyyMmDd) return "";
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Admin() {
  const { api } = useAuth();

  const [rows, setRows] = useState<ApiUser[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Add/Edit modal
  const [form, setForm] = useState<CreateUserBody & { employee_manager?: string; employee_project?: string }>({
    ...EMPTY,
  });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const dobInputRef = useRef<HTMLInputElement | null>(null);

  // Composer modal (Employee Experience only)
  const composerModalRef = useRef<HTMLDivElement | null>(null);
  const [composerEmployee, setComposerEmployee] = useState<ApiUser | null>(null);

  const [composerTo, setComposerTo] = useState("");
  const [composerRoleTitle, setComposerRoleTitle] = useState("");
  const [composerSubjectOverride, setComposerSubjectOverride] = useState("Experience Certificate | Fluke Games");
  const [composerSetStatus, setComposerSetStatus] = useState("experience_sent");
  const [extraInfo, setExtraInfo] = useState("");

  // Experience dates
  const [dateStarted, setDateStarted] = useState("");
  const [dateEnded, setDateEnded] = useState("");
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().slice(0, 10));

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
        onOpenStart: () => {
          setTimeout(() => {
            try {
              M.updateTextFields();
            } catch {}
          }, 0);

          const input = dobInputRef.current;
          if (!input) return;

          try {
            const prev = M.Datepicker.getInstance(input);
            prev && prev.destroy();
          } catch {}

          let defaultDate: Date | undefined;
          if (form.employee_dob) {
            const [y, m, d] = form.employee_dob.split("-").map(Number);
            const dt = new Date(y, (m || 1) - 1, d || 1);
            if (!isNaN(dt.getTime())) defaultDate = dt;
          }

          M.Datepicker.init(input, {
            container: document.body,
            format: "yyyy-mm-dd",
            yearRange: 100,
            showClearBtn: true,
            defaultDate,
            setDefaultDate: !!defaultDate,
            onSelect: (date: Date) => {
              setForm((f) => ({ ...f, employee_dob: date.toISOString().slice(0, 10) }));
              try {
                const inst = M.Datepicker.getInstance(input);
                inst && inst.setInputValue();
              } catch {}
            },
          });
        },
      });

      setTimeout(() => {
        try {
          M.updateTextFields();
        } catch {}
      }, 0);
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
        (u.username || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  function openModalForAdd() {
    setEditingUsername(null);
    setForm({ ...EMPTY });
    openModal();
  }

  function openModalForEdit(username: string) {
    const u = rows.find((x) => x.username === username);
    if (!u) return;

    setEditingUsername(u.username);

    setForm({
      username: u.username,
      password: "",
      employee_name: u.employee_name || "",
      employee_email: u.employee_email || "",
      employee_role: u.employee_role || "employee",
      employee_dob: u.employee_dob || "",
      employee_profilepicture: u.employee_profilepicture || "",
      employee_phonenumber: u.employee_phonenumber || "",
      employee_title: u.employee_title || "",
      employment_type: u.employment_type || "",
      department: u.department || "",
      location: u.location || "",
      employee_manager: (u as any).employee_manager || "",
      employee_project: (u as any).project_id || "",
    });

    openModal();
  }

  function openModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    setTimeout(() => {
      try {
        M.updateTextFields();
      } catch {}
    }, 0);
    inst.open();
  }

  function closeModal() {
    if (!modalRef.current) return;
    M.Modal.getInstance(modalRef.current)?.close();
  }

  async function saveFromModal(e: React.FormEvent) {
    e.preventDefault();

    if (!form.username.trim() || !form.employee_name || !form.employee_email) {
      M.toast({ html: "Username, Name, and Email are required.", classes: "red" });
      return;
    }

    try {
      setLoading(true);

      if (editingUsername) {
        const { employee_project, ...rest } = form as any;
        const update: UpdateUserBody & { employee_manager?: string; project_id?: string } = {
          ...rest,
          username: editingUsername,
          ...(employee_project ? { project_id: employee_project } : {}),
        };
        if (!update.password) delete (update as any).password;

        await api.updateUser(update as any);
        M.toast({ html: "Employee updated.", classes: "green" });
      } else {
        const { employee_project, ...rest } = form as any;
        const createBody: CreateUserBody & { employee_manager?: string; project_id?: string } = {
          ...rest,
          employee_role: "employee",
          ...(employee_project ? { project_id: employee_project } : {}),
        };
        if (!createBody.password) {
          M.toast({ html: "Password required for new employee.", classes: "red" });
          setLoading(false);
          return;
        }
        await api.createUser(createBody as any);
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

  // ---------------- Composer (EXPERIENCE only) ----------------

  function openComposer(u: ApiUser) {
    setComposerEmployee(u);

    const roleTitle = safeStr(u.employee_title);
    const toEmail = safeStr(u.employee_email);
    const todayIso = new Date().toISOString().slice(0, 10);

    setComposerTo(toEmail);
    setComposerRoleTitle(roleTitle);
    setComposerSubjectOverride("Experience Certificate | Fluke Games");
    setComposerSetStatus("experience_sent");
    setExtraInfo("");

    setDateStarted("");
    setDateEnded("");
    setCurrentDate(todayIso);

    if (!composerModalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(composerModalRef.current) || M.Modal.init(composerModalRef.current);
    inst.open();
    setTimeout(() => {
      try {
        M.updateTextFields();
      } catch {}
    }, 0);
  }

  function closeComposer() {
    if (!composerModalRef.current) return;
    M.Modal.getInstance(composerModalRef.current)?.close();
  }

  async function sendNow() {
    if (!composerEmployee?.username) {
      M.toast({ html: "Missing employee username.", classes: "red" });
      return;
    }

    // minimal validations
    if (!dateStarted || !dateEnded) {
      M.toast({ html: "Experience: dateStarted and dateEnded are required.", classes: "red" });
      return;
    }

    setSending(true);
    try {
      const vars: Record<string, any> = {
        // ✅ notes (send both lower + UPPER for safety)
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

  return (
    <>
      <main className="container" style={{ paddingTop: 24, maxWidth: 1100 }}>
        <div className="row" style={{ alignItems: "center" }}>
          <div className="col s12 m8">
            <h4>Admin Panel</h4>
          </div>
          <div className="col s12 m4 right-align">
            <button className="btn" onClick={openModalForAdd}>
              <i className="material-icons left">person_add</i>
              Add Employee
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <span className="card-title">Employees ({rows.length})</span>

            <div className="input-field">
              <input
                id="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
              />
              <label htmlFor="search" className="active">
                Search by username, name, email, or role
              </label>
            </div>

            {loading && <p>Loading…</p>}
            {err && <p className="red-text">{err}</p>}

            {!loading && !err && (
              <table className="highlight responsive-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th className="right-align">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.username}>
                      <td>
                        <code>{u.username}</code>
                      </td>
                      <td>{u.employee_name}</td>
                      <td>
                        <code>{u.employee_email}</code>
                      </td>
                      <td>
                        <span className="chip">{(u.employee_role || "employee").toUpperCase()}</span>
                      </td>
                      <td className="right-align">
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <button className="btn-small" onClick={() => openModalForEdit(u.username)}>
                            Edit
                          </button>
                          <button
                            className="btn-small grey darken-2"
                            onClick={() => openComposer(u)}
                            title="Send Experience Certificate"
                          >
                            Composer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5}>No employees found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* ----------------------- EDIT MODAL ------------------------- */}
      <div ref={modalRef} id="employeeModal" className="modal modal-fixed-footer">
        <form onSubmit={saveFromModal}>
          <div className="modal-content">
            <h5>{editingUsername ? "Edit Employee" : "Add Employee"}</h5>

            <div className="row">
              <div className="input-field col s12 m4">
                <input
                  id="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  disabled={!!editingUsername}
                />
                <label className={form.username ? "active" : ""} htmlFor="username">
                  Username
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="name"
                  value={form.employee_name}
                  onChange={(e) => setForm((f) => ({ ...f, employee_name: e.target.value }))}
                />
                <label className={form.employee_name ? "active" : ""} htmlFor="name">
                  Employee Name
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="email"
                  type="email"
                  value={form.employee_email}
                  onChange={(e) => setForm((f) => ({ ...f, employee_email: e.target.value }))}
                />
                <label className={form.employee_email ? "active" : ""} htmlFor="email">
                  Employee Email
                </label>
              </div>
            </div>

            <div className="row">
              <div className="input-field col s12 m4">
                <input
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <label className={form.password ? "active" : ""} htmlFor="password">
                  {editingUsername ? "New Password (optional)" : "Password"}
                </label>
              </div>

              <div className="input-field col s12 m4">
                <div style={{ marginTop: 22 }}>
                  <span className="grey-text">Role</span>
                  <br />
                  <span className="chip">{(form.employee_role || "employee").toUpperCase()}</span>
                </div>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="dob"
                  ref={dobInputRef}
                  className="datepicker"
                  value={form.employee_dob || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_dob: e.target.value }))}
                  placeholder="YYYY-MM-DD"
                />
                <label className={form.employee_dob ? "active" : ""} htmlFor="dob">
                  DOB
                </label>
              </div>
            </div>

            <div className="row">
              <div className="input-field col s12 m6">
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
                <label className="active" style={{ position: "relative", top: -24 }}>
                  Manager
                </label>
              </div>

              <div className="input-field col s12 m6">
                <select
                  className="browser-default"
                  value={form.employee_project || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_project: e.target.value }))}
                >
                  <option value="">Select Project</option>
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <label className="active" style={{ position: "relative", top: -24 }}>
                  Assigned Project
                </label>
              </div>
            </div>

            <div className="row">
              <div className="input-field col s12 m4">
                <input
                  id="phone"
                  value={form.employee_phonenumber || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_phonenumber: e.target.value }))}
                />
                <label className={form.employee_phonenumber ? "active" : ""} htmlFor="phone">
                  Phone
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="pic"
                  value={form.employee_profilepicture || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_profilepicture: e.target.value }))}
                  placeholder="https://…"
                />
                <label className={form.employee_profilepicture ? "active" : ""} htmlFor="pic">
                  Profile Picture URL
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="title"
                  value={form.employee_title || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_title: e.target.value }))}
                />
                <label className={form.employee_title ? "active" : ""} htmlFor="title">
                  Title
                </label>
              </div>
            </div>

            <div className="row">
              <div className="input-field col s12 m4">
                <input
                  id="employment"
                  value={form.employment_type || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                />
                <label className={form.employment_type ? "active" : ""} htmlFor="employment">
                  Employment Type
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="dept"
                  value={form.department || ""}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                />
                <label className={form.department ? "active" : ""} htmlFor="dept">
                  Department
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="location"
                  value={form.location || ""}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
                <label className={form.location ? "active" : ""} htmlFor="location">
                  Location
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <a className="modal-close btn-flat" onClick={closeModal}>
              Cancel
            </a>
            <button type="submit" className={`btn ${editingUsername ? "blue" : "teal"}`}>
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
            Sends <b>Experience Certificate</b> using the employee endpoint:
            <code style={{ marginLeft: 6 }}>POST /admin/employees/&lt;username&gt;/send-doc-email</code>
          </p>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m6">
              <input value={composerTo} onChange={(e) => setComposerTo(e.target.value)} />
              <label className={composerTo ? "active" : ""}>To</label>
            </div>

            <div className="input-field col s12 m6">
              <input value={composerRoleTitle} onChange={(e) => setComposerRoleTitle(e.target.value)} />
              <label className="active">roleTitle</label>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="input-field col s12 m6">
              <input
                value={composerSubjectOverride}
                onChange={(e) => setComposerSubjectOverride(e.target.value)}
              />
              <label className="active">subjectOverride</label>
            </div>

            <div className="input-field col s12 m6">
              <input value={composerSetStatus} onChange={(e) => setComposerSetStatus(e.target.value)} />
              <label className="active">setStatus</label>
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>
                dateStarted
              </div>
              <input type="date" value={dateStarted} onChange={(e) => setDateStarted(e.target.value)} />
            </div>

            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>
                dateEnded
              </div>
              <input type="date" value={dateEnded} onChange={(e) => setDateEnded(e.target.value)} />
            </div>

            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>
                CURRENT_DATE
              </div>
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
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>Preview vars sent (optional)</summary>
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
          <a className="btn-flat" href="#!" onClick={closeComposer}>
            Cancel
          </a>

          <button className={`btn ${sending ? "disabled" : ""}`} disabled={sending} onClick={sendNow}>
            <i className="material-icons left">{sending ? "hourglass_empty" : "send"}</i>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
