// src/pages/Employees.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";
import "./employees.css";

declare const M: any;

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
}

function roleLower(u?: ApiUser | null) {
  return safeStr((u as any)?.employee_role).toLowerCase() || "employee";
}

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
        const data = await api.getUsers();
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
    return rows.filter((r) => {
      const hay = [
        safeStr(r.employee_name),
        safeStr(r.employee_email),
        safeStr(r.username),
        safeStr(r.department),
        safeStr(r.employee_title),
        safeStr((r as any).employee_id),
        safeStr((r as any).location),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <main className="container emp-shell" style={{ paddingTop: 18, maxWidth: 1100 }}>
      {/* Local styles: keeps everything aligned + looks “portal” */}
      <style>{`
        .emp-shell { animation: empFade .22s ease both; }
        @keyframes empFade { from{opacity:0; transform: translateY(6px);} to{opacity:1; transform:none;} }

        .emp-card {
          border-radius: 18px;
          overflow: visible;
          border: 1px solid #e6edf2;
          background: #fff;
          box-shadow: 0 14px 30px rgba(0,0,0,.08);
        }

        .emp-topbar{
          padding: 16px 16px 14px;
          border-bottom: 1px solid #eef2f7;
          background:
            radial-gradient(900px 240px at 12% 10%, rgba(37,99,235,0.24), transparent 60%),
            radial-gradient(700px 260px at 85% 40%, rgba(34,197,94,0.14), transparent 60%),
            linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
          color: #fff;
          border-top-left-radius: 18px;
          border-top-right-radius: 18px;
          position: relative;
          overflow: hidden;
        }
        .emp-topbar::after{
          content:"";
          position:absolute; inset:-40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.10), transparent);
          transform: translateX(-40%) rotate(10deg);
          animation: empShimmer 4.2s ease-in-out infinite;
          pointer-events:none;
          opacity:.55;
        }
        @keyframes empShimmer { 0%{transform: translateX(-45%) rotate(10deg);} 55%{transform: translateX(45%) rotate(10deg);} 100%{transform: translateX(45%) rotate(10deg);} }

        .emp-titleRow{
          display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
          position: relative;
          z-index: 1;
        }
        .emp-title{
          font-weight: 950;
          letter-spacing: -0.4px;
          font-size: 20px;
          line-height: 1.1;
          margin: 0;
        }
        .emp-subtitle{
          margin-top: 4px;
          font-size: 12.5px;
          color: rgba(255,255,255,.78);
          font-weight: 700;
        }
        .emp-countPill{
          display:inline-flex; align-items:center; gap:8px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.16);
          color: rgba(255,255,255,.92);
          font-weight: 900;
          font-size: 12px;
          white-space: nowrap;
        }
        .emp-countPill i.material-icons{ font-size: 16px; opacity:.95; }

        .emp-searchWrap{
          position: relative;
          z-index: 1;
          margin-top: 12px;
          display:flex;
          gap: 10px;
          align-items:center;
        }
        .emp-search{
          flex: 1;
          display:flex;
          align-items:center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 16px;
          background: rgba(255,255,255,.10);
          border: 1px solid rgba(255,255,255,.18);
          backdrop-filter: blur(10px);
        }
        .emp-search i.material-icons{ font-size: 20px; color: rgba(255,255,255,.88); }
        .emp-search input{
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          margin: 0 !important;
          height: 26px !important;
          color: rgba(255,255,255,.95) !important;
          font-weight: 900;
        }
        .emp-search input::placeholder{ color: rgba(255,255,255,.60); font-weight: 800; }

        .emp-clearBtn{
          height: 42px;
          border-radius: 14px;
          padding: 0 12px;
          font-weight: 900;
          text-transform: none;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.10);
          color: rgba(255,255,255,.92);
          display:inline-flex; align-items:center; gap:6px;
          cursor: pointer;
        }
        .emp-clearBtn i.material-icons{ font-size: 18px; }
        .emp-clearBtn:hover{ background: rgba(255,255,255,.14); }

        .emp-body{ padding: 14px 14px 16px; }

        /* list row layout */
        .emp-list{
          margin: 0;
          border: 1px solid #e6edf2 !important;
          border-radius: 16px !important;
          overflow: hidden;
          background: #fff;
        }
        .emp-item{
          display:flex !important;
          align-items:center;
          gap: 14px;
          padding: 14px 14px !important;
          border-bottom: 1px solid #eef2f7 !important;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
          transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
          position: relative;
        }
        .emp-item:last-child{ border-bottom: none !important; }
        .emp-item:hover{
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(0,0,0,.08);
          background: #fff;
        }
        .emp-item::before{
          content:"";
          position:absolute;
          left: 0;
          top: 12px;
          bottom: 12px;
          width: 3px;
          border-radius: 999px;
          background: transparent;
          transition: background .15s ease;
        }
        .emp-item:hover::before{ background: rgba(37,99,235,.65); }

        /* BIG avatar that never crops */
        .emp-avatarBox{
          width: 74px;
          height: 74px;
          min-width: 74px;
          border-radius: 22px;
          overflow: hidden;
          background: linear-gradient(135deg, rgba(37,99,235,0.14), rgba(34,197,94,0.10));
          border: 2px solid rgba(255,255,255,.85);
          box-shadow: 0 16px 30px rgba(0,0,0,.12);
          position: relative;
          display:flex;
          align-items:center;
          justify-content:center;
          flex: 0 0 auto;
        }
        .emp-avatarBox img{
          width:100%;
          height:100%;
          object-fit: cover;
          display:block;
        }
        .emp-avatarInitials{
          font-weight: 950;
          letter-spacing: .6px;
          color: #0f172a;
          font-size: 22px;
        }
        .emp-dot{
          position:absolute;
          right: 9px;
          bottom: 9px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #22c55e;
          border: 2px solid rgba(15, 23, 42, 0.9);
          box-shadow: 0 10px 18px rgba(0,0,0,.18);
        }

        .emp-meta{ flex: 1; min-width: 0; }
        .emp-nameRow{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .emp-name{
          font-weight: 950;
          letter-spacing: -0.2px;
          color: #0f172a;
          font-size: 15.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .emp-lines{
          margin-top: 4px;
          display:flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items:center;
          color: #607d8b;
          font-size: 12.5px;
          font-weight: 800;
        }
        .emp-lines .sep{ opacity:.55; }

        .emp-email{
          margin-top: 5px;
          color: #90a4ae;
          font-size: 12.5px;
          font-weight: 800;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .emp-badges{
          display:flex;
          align-items:center;
          gap: 8px;
          flex: 0 0 auto;
          flex-wrap: wrap;
          justify-content:flex-end;
        }
        .emp-badge{
          display:inline-flex;
          align-items:center;
          gap: 6px;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          border: 1px solid rgba(15,23,42,.10);
          background: rgba(148,163,184,.12);
          color: #334155;
          white-space: nowrap;
        }
        .emp-badge i.material-icons{ font-size: 16px; opacity:.9; }
        .emp-badge--super{ background: rgba(37,99,235,0.14); border-color: rgba(37,99,235,0.22); color:#1e40af; }
        .emp-badge--admin{ background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.22); color:#92400e; }
        .emp-badge--employee{ background: rgba(34,197,94,0.12); border-color: rgba(34,197,94,0.22); color:#166534; }
        .emp-badge--id{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
          background: rgba(148,163,184,0.12);
        }

        .emp-skeleton{
          border: 1px solid #e6edf2;
          border-radius: 16px;
          padding: 14px;
          background: #fbfdff;
          color: #607d8b;
          font-weight: 900;
        }

        @media (max-width: 600px){
          .emp-avatarBox{ width: 62px; height: 62px; min-width:62px; border-radius: 20px; }
          .emp-avatarInitials{ font-size: 20px; }
          .emp-title{ font-size: 18px; }
          .emp-searchWrap{ flex-direction: column; align-items: stretch; }
          .emp-clearBtn{ width: 100%; justify-content:center; }
        }
      `}</style>

      <div className="card emp-card">
        <div className="emp-topbar">
          <div className="emp-titleRow">
            <div>
              <h5 className="emp-title" style={{ margin: 0 }}>
                Employees Directory
              </h5>
              <div className="emp-subtitle">Search by name, email, username, title, department, location.</div>
            </div>

            <span className="emp-countPill" title="Results">
              <i className="material-icons">groups</i>
              {filtered.length}/{rows.length}
            </span>
          </div>

          <div className="emp-searchWrap">
            <div className="emp-search" role="search" aria-label="Employee search">
              <i className="material-icons">search</i>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees…"
                aria-label="Search employees"
              />
            </div>

            <button
              type="button"
              className="emp-clearBtn"
              onClick={() => setQuery("")}
              disabled={!query}
              title="Clear"
              style={query ? undefined : { opacity: 0.55, cursor: "default" }}
            >
              <i className="material-icons">close</i>
              Clear
            </button>
          </div>
        </div>

        <div className="emp-body">
          {loading ? (
            <div className="emp-skeleton">Loading…</div>
          ) : (
            <ul className="collection emp-list">
              {filtered.map((u) => {
                const name = safeStr(u.employee_name) || safeStr(u.username) || "—";
                const title = safeStr(u.employee_title) || "—";
                const dept = safeStr(u.department) || "—";
                const loc = safeStr((u as any).location) || "";
                const email = safeStr(u.employee_email) || "";
                const empId = safeStr((u as any).employee_id) || "";
                const role = roleLower(u);

                const badgeRoleClass =
                  role === "super"
                    ? "emp-badge emp-badge--super"
                    : role === "admin"
                    ? "emp-badge emp-badge--admin"
                    : "emp-badge emp-badge--employee";

                return (
                  <li className="collection-item emp-item" key={u.username}>
                    <div className="emp-avatarBox" title={name}>
                      {safeStr(u.employee_profilepicture) ? (
                        <img src={u.employee_profilepicture as any} alt="" />
                      ) : (
                        <span className="emp-avatarInitials">{initials(name)}</span>
                      )}
                      <span className="emp-dot" title="Active" />
                    </div>

                    <div className="emp-meta">
                      <div className="emp-nameRow">
                        <div className="emp-name" title={name}>
                          {name}
                        </div>

                        <div className="emp-badges">
                          <span className={badgeRoleClass} title="Role">
                            <i className="material-icons">verified_user</i>
                            {role.toUpperCase()}
                          </span>

                          {empId ? (
                            <span className="emp-badge emp-badge--id" title="Employee ID">
                              <i className="material-icons">badge</i>
                              {empId}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="emp-lines">
                        <span title={title}>{title}</span>
                        <span className="sep">•</span>
                        <span title={dept}>{dept}</span>
                        {loc ? (
                          <>
                            <span className="sep">•</span>
                            <span title={loc}>
                              <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4, opacity: 0.8 }}>
                                location_on
                              </i>
                              {loc}
                            </span>
                          </>
                        ) : null}
                      </div>

                      {email ? (
                        <div className="emp-email" title={email}>
                          <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4, opacity: 0.7 }}>
                            alternate_email
                          </i>
                          {email}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}

              {!filtered.length && (
                <li className="collection-item center grey-text" style={{ padding: "16px 14px" }}>
                  No results
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}