import { useEffect, useRef, useState } from "react";
import type { ApiProject, ApiUser } from "../../api";
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
  project_ids: string[];
  project_setup: string;
  portal_access: boolean;
  project_access: boolean;
  version_control_access: boolean;
  employee_id: string;
  employee_manager: string;
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
  project_ids: [],
  project_setup: "",
  portal_access: true,
  project_access: true,
  version_control_access: false,
  employee_id: "",
  employee_manager: "",
  password: "",
  revoked: false,
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseProjectIds(value: any): string[] {
  if (Array.isArray(value)) return Array.from(new Set(value.map((x) => safeStr(x)).filter(Boolean)));
  const s = safeStr(value);
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return Array.from(new Set(parsed.map((x) => safeStr(x)).filter(Boolean)));
  } catch {}
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}


function getUserName(user: any) { return safeStr(user.employee_name || user.username); }
export default function EmployeeEditModal({ employee, users, projects, projectsError = "", currentUser, onClose, onSaved }: {
  employee: ApiUser; users: ApiUser[]; projects: ApiProject[]; projectsError?: string;
  currentUser: any; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const { api } = useAuth();
  const role = safeStr(currentUser?.employee_role || currentUser?.role).toLowerCase();
  const isSuper = role === "super";
  const isAdmin = isSuper || role === "admin";
  const [editSaving, setEditSaving] = useState(false);
  const [createAsCustomer, setCreateAsCustomer] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({ ...EMPTY_EDIT });
  const editModalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editModalRef.current || typeof M === "undefined") return;
    const instance = M.Modal.init(editModalRef.current, { dismissible: true, opacity: 0.45, onCloseEnd: onClose });
    openEdit(employee);
    return () => {
      instance.options.onCloseEnd = undefined;
      instance.close();
      instance.destroy();
    };
    // Each edit session mounts a fresh dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      project_ids: parseProjectIds((userRow as any)?.project_ids || safeStr((userRow as any)?.project_id)),
      project_setup: safeStr((userRow as any)?.project_setup),
      portal_access: (userRow as any)?.portal_access !== false,
      project_access: (userRow as any)?.project_access !== false,
      version_control_access: (userRow as any)?.version_control_access === true,
      employee_id: safeStr((userRow as any)?.employee_id),
      employee_manager: safeStr((userRow as any)?.employee_manager),
      password: "",
      revoked: !!(userRow as any)?.revoked,
    });
    setCreateAsCustomer(false);
    setEditPasswordOpen(false);
    {
      const inst = M?.Modal?.getInstance?.(editModalRef.current) || M?.Modal?.init?.(editModalRef.current);
      inst?.open?.();
      setTimeout(() => {
        try {
          M?.updateTextFields?.();
        } catch {}
      }, 0);
    }
  }

  function closeEdit() {
    const inst = M?.Modal?.getInstance?.(editModalRef.current) || M?.Modal?.init?.(editModalRef.current);
    inst?.close?.();
    setCreateAsCustomer(false);
    setEditPasswordOpen(false);
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
        employee_phonenumber: safeStr(editForm.employee_phonenumber) || undefined,
        department: safeStr(editForm.department) || undefined,
        location: safeStr(editForm.location) || undefined,
        project_id: safeStr(editForm.project_id) || undefined,
        project_ids: Array.isArray(editForm.project_ids) ? editForm.project_ids : undefined,
        // Allow clearing back to "none" (empty string) by sending it explicitly.
        project_setup: String(editForm.project_setup ?? ""),
        employee_id: safeStr(editForm.employee_id) || undefined,
        employee_manager: safeStr(editForm.employee_manager) || undefined,
        revoked: !!editForm.revoked,
      };
      if (isSuper) {
        patch.portal_access = !!editForm.portal_access;
        patch.project_access = !!editForm.project_access;
        patch.version_control_access = !!editForm.version_control_access;
      }
      if (editPasswordOpen && safeStr(editForm.password)) patch.password = editForm.password;
      await api.updateUser(patch);

      if (createAsCustomer) {
        await (api as any).createCustomerFromEmployee({
          username: safeStr(editForm.username),
          ...(editPasswordOpen && safeStr(editForm.password) ? { password: safeStr(editForm.password) } : {}),
        });
      }

      M?.toast?.({ html: "Employee updated.", classes: "green" });
      setEditSaving(false);
      await onSaved();
      closeEdit();
    } catch (e: any) {
      setEditSaving(false);
      M?.toast?.({ html: e?.message || "Failed to save employee.", classes: "red" });
    }
  }

  return (
      <div ref={editModalRef} className="modal modal-fixed-footer" style={{ maxHeight: "90%" }}>
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
                  { label: "Manager", key: "employee_manager", span: 4, disabled: false },
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
                  {key === "project_id" ? (
                    <div className="input-field">
                      <select
                        id="edit_project_id"
                        className="browser-default"
                        value={safeStr(editForm.project_id)}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            project_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select Project</option>
                        {projects.map((p) => (
                          <option key={p.projectId} value={p.projectId}>
                            {`${safeStr(p.name)} (${safeStr(p.projectId)})`}
                          </option>
                        ))}
                      </select>
                      {projectsError ? (
                        <div style={{ marginTop: 6, fontSize: 11, color: "#b45309", fontWeight: 800 }}>
                          {projectsError}
                        </div>
                      ) : null}
                    </div>
                  ) : key === "employee_manager" ? (
                    <div className="input-field">
                      <select
                        id="edit_employee_manager"
                        className="browser-default"
                        value={safeStr(editForm.employee_manager)}
                        onChange={(e) =>
                          setEditForm((p) => ({
                            ...p,
                            employee_manager: e.target.value,
                          }))
                        }
                      >
                        <option value="">No manager</option>
                        {(users as any[])
                          .filter((u) => safeStr((u as any).username) !== safeStr(editForm.username))
                          .sort((a, b) => getUserName(a).localeCompare(getUserName(b)))
                          .map((u) => (
                            <option key={safeStr((u as any).username)} value={safeStr((u as any).username)}>
                              {`${safeStr((u as any).employee_name || (u as any).username)} (${safeStr((u as any).username)})`}
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
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
                  )}
                </div>
              ))}
              <div style={{ gridColumn: "span 6" }}>
                <div className="input-field">
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 6 }}>
                    Assigned Projects (Multi)
                  </div>
                  <select
                    id="edit_project_ids"
                    className="browser-default"
                    multiple
                    value={Array.isArray(editForm.project_ids) ? editForm.project_ids : []}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions).map((o) => o.value).filter(Boolean);
                      setEditForm((p) => ({
                        ...p,
                        project_ids: values,
                        project_id: values[0] || p.project_id || "",
                      }));
                    }}
                    style={{ minHeight: 120 }}
                  >
                    {projects.map((p) => (
                      <option key={`multi_${p.projectId}`} value={p.projectId}>
                        {`${safeStr(p.name)} (${safeStr(p.projectId)})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
              <div style={{ gridColumn: "span 6" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditPasswordOpen((v) => !v);
                      if (editPasswordOpen) {
                        setEditForm((p) => ({ ...p, password: "" }));
                      }
                    }}
                    style={{ alignSelf: "flex-start", border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                  >
                    {editPasswordOpen ? "Cancel Password Edit" : "Edit Password"}
                  </button>
                  {editPasswordOpen ? (
                    <div className="input-field" style={{ marginTop: 0 }}>
                      <input
                        id="edit_password"
                        type="password"
                        value={safeStr(editForm.password)}
                        onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                      />
                      <label className={safeStr(editForm.password) ? "active" : ""} htmlFor="edit_password">
                        New Password
                      </label>
                    </div>
                  ) : null}
                </div>
              </div>
              <div style={{ gridColumn: "span 12", marginTop: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={createAsCustomer}
                    onChange={(e) => setCreateAsCustomer(e.target.checked)}
                  />
                  <span>Create this profile as Customer (internal user)</span>
                </label>
                {createAsCustomer ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#475569", fontWeight: 700 }}>
                    Customer creation and login mapping are handled fully by backend.
                  </div>
                ) : null}
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
  );
}
