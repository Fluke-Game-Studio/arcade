// src/pages/Directory.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser, UpdateUserBody } from "../api";

declare const M: any;

type EditForm = {
  username: string;
  password?: string;
  employee_profilepicture?: string;
  employee_phonenumber?: string;
  location?: string;
};

export default function Directory() {
  const { api, user } = useAuth();

  const [rows, setRows] = useState<ApiUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<EditForm>({
    username: "",
    password: "",
    employee_profilepicture: "",
    employee_phonenumber: "",
    location: "",
  });
  const [editingUsername, setEditingUsername] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  const canEdit = (targetUsername: string) => {
    if (!user) return false;
    const role = String(user.role || "").toLowerCase();
    if (role === "super" || role === "admin") return true;
    // employees can edit ONLY their own record
    return user.username === targetUsername;
  };

  async function load() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      setRows(data);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // init modal
    if (typeof M !== "undefined" && modalRef.current) {
      M.Modal.init(modalRef.current, {
        onOpenStart: () => {
          // update labels for controlled inputs
          setTimeout(() => {
            try { M.updateTextFields(); } catch {}
          }, 0);
        },
      });
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) =>
      (u.employee_name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.employee_email || "").toLowerCase().includes(q) ||
      (u.location || "").toLowerCase().includes(q) ||
      (u.employee_phonenumber || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  function openModalFor(username: string) {
    if (!canEdit(username)) {
      if (typeof M !== "undefined") M.toast({ html: "You can only edit your own profile.", classes: "red" });
      return;
    }
    const u = rows.find((x) => x.username === username);
    if (!u) return;
    setEditingUsername(username);
    setForm({
      username: u.username,
      password: "",
      employee_profilepicture: u.employee_profilepicture || "",
      employee_phonenumber: u.employee_phonenumber || "",
      location: u.location || "",
    });
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    setTimeout(() => { try { M.updateTextFields(); } catch {} }, 0);
    inst.open();
  }

  function closeModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current);
    inst?.close();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUsername) return;

    try {
      setLoading(true);
      const payload: UpdateUserBody = {
        username: editingUsername,
        location: form.location || "",
        employee_phonenumber: form.employee_phonenumber || "",
        employee_profilepicture: form.employee_profilepicture || "",
      };
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }
      await api.updateUser(payload);
      if (typeof M !== "undefined") M.toast({ html: "Profile updated.", classes: "green" });
      await load();
      closeModal();
    } catch (e: any) {
      if (typeof M !== "undefined") M.toast({ html: e.message ?? "Update failed.", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="container" style={{ paddingTop: 24, maxWidth: 1200 }}>
        <div className="row" style={{ alignItems: "center" }}>
          <div className="col s12 m8">
            <h4>Company Directory</h4>
            <p className="grey-text">View everyone’s basic details. Edit allowed fields via the action menu.</p>
          </div>
          <div className="col s12 m4">
            <div className="input-field" style={{ marginTop: 0 }}>
              <input
                id="dir-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, username, email, location, phone…"
              />
              <label htmlFor="dir-search" className="active">Search</label>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <span className="card-title">Employees ({rows.length})</span>
            {loading && <p>Loading…</p>}
            {err && <p className="red-text">{err}</p>}

            {!loading && !err && (
              <table className="highlight responsive-table">
                <thead>
                  <tr>
                    <th style={{ width: 56 }}></th>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Title</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Role</th>
                    <th className="right-align">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => {
                    const editable = canEdit(u.username);
                    return (
                      <tr key={u.username}>
                        <td>
                          {u.employee_profilepicture ? (
                            <img
                              src={u.employee_profilepicture}
                              alt={u.employee_name}
                              className="circle"
                              style={{ width: 40, height: 40, objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              className="circle"
                              style={{ width: 40, height: 40, background: "#eceff1" }}
                            />
                          )}
                        </td>
                        <td><code>{u.username}</code></td>
                        <td>{u.employee_name}</td>
                        <td><code>{u.employee_email}</code></td>
                        <td>{u.employee_title || "—"}</td>
                        <td>{u.employee_phonenumber || "—"}</td>
                        <td>{u.location || "—"}</td>
                        <td><span className="chip">{(u.employee_role || "employee").toUpperCase()}</span></td>
                        <td className="right-align">
                          <button
                            className={`btn-small ${editable ? "" : "disabled"}`}
                            onClick={() => editable && openModalFor(u.username)}
                            title={editable ? "Edit" : "You can only edit your own profile"}
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={9}>No matches.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Edit modal */}
      <div ref={modalRef} className="modal modal-fixed-footer">
        <form onSubmit={save}>
          <div className="modal-content">
            <h5>Edit Profile</h5>

            <div className="row">
              <div className="input-field col s12 m4">
                <input id="edit-username" value={form.username} disabled />
                <label htmlFor="edit-username" className="active">Username</label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="edit-password"
                  type="password"
                  value={form.password || ""}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <label htmlFor="edit-password" className={form.password ? "active" : ""}>
                  New Password (optional)
                </label>
              </div>

              <div className="input-field col s12 m4">
                <input
                  id="edit-phone"
                  value={form.employee_phonenumber || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_phonenumber: e.target.value }))}
                />
                <label htmlFor="edit-phone" className={form.employee_phonenumber ? "active" : ""}>
                  Phone Number
                </label>
              </div>
            </div>

            <div className="row">
              <div className="input-field col s12 m6">
                <input
                  id="edit-location"
                  value={form.location || ""}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
                <label htmlFor="edit-location" className={form.location ? "active" : ""}>Location</label>
              </div>

              <div className="input-field col s12 m6">
                <input
                  id="edit-pic"
                  value={form.employee_profilepicture || ""}
                  onChange={(e) => setForm((f) => ({ ...f, employee_profilepicture: e.target.value }))}
                  placeholder="https://…"
                />
                <label htmlFor="edit-pic" className={form.employee_profilepicture ? "active" : ""}>
                  Profile Picture URL
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <a className="modal-close btn-flat" onClick={closeModal}>Cancel</a>
            <button type="submit" className="btn">Save</button>
          </div>
        </form>
      </div>
    </>
  );
}
