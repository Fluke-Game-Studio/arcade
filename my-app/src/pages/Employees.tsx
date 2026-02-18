// src/pages/Employees.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";
import "./employees.css"; // ← add this line

declare const M: any;

export default function Employees() {
  const { api } = useAuth();

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mount = true;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getUsers(); // same endpoint admin/super uses
        const list = Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray(data)
          ? (data as any)
          : [];
        if (mount) setRows(list);
      } catch (e: any) {
        if (typeof M !== "undefined") {
          M.toast({ html: e?.message || "Failed to load employees", classes: "red" });
        }
        if (mount) setRows([]);
      } finally {
        if (mount) setLoading(false);
      }
    })();
    return () => {
      mount = false;
    };
  }, [api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.employee_name || "").toLowerCase().includes(q) ||
      (r.employee_email || "").toLowerCase().includes(q) ||
      (r.username || "").toLowerCase().includes(q) ||
      (r.department || "").toLowerCase().includes(q) ||
      (r.employee_title || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <>
      <div className="container" style={{ paddingTop: 20 }}>
        <div className="card">
          <div className="card-content">
            <span className="card-title">Employees</span>

            <div className="input-field" style={{ marginTop: 0 }}>
              <input
                id="emp-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, username, department…"
              />
              <label htmlFor="emp-search" className="active">Search</label>
            </div>

            {loading ? (
              <p>Loading…</p>
            ) : (
              <ul className="collection emp-collection">
                {filtered.map((u) => {
                  const name = u.employee_name || u.username || "—";
                  const title = u.employee_title || "—";
                  const dept = u.department || "—";
                  const email = u.employee_email || "";

                  return (
                    <li className="collection-item emp-row" key={u.username}>
                      {u.employee_profilepicture ? (
                        <img
                          className="emp-avatar circle"
                          src={u.employee_profilepicture}
                          alt=""
                        />
                      ) : (
                        <i className="material-icons emp-avatar circle grey lighten-2">person</i>
                      )}

                      <div className="emp-meta">
                        <div className="emp-name">{name}</div>
                        <div className="grey-text emp-sub">{title} • {dept}</div>
                        {email && <div className="grey-text text-darken-1 emp-email">{email}</div>}
                      </div>
                    </li>
                  );
                })}
                {!filtered.length && (
                  <li className="collection-item center grey-text">No results</li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
