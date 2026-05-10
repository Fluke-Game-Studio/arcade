import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";

type PersonRow = {
  key: string;
  name: string;
  title?: string;
  location?: string;
  date: string;
};

function safeDate(iso: string) {
  const s = String(iso || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const d2 = new Date(y, mm - 1, dd);
    return Number.isNaN(d2.getTime()) ? null : d2;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isCurrentMonthDate(iso: string) {
  const d = safeDate(iso);
  if (!d) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth();
}

function fmtMonthDay(iso: string) {
  const d = safeDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function monthNameNow() {
  return new Date().toLocaleDateString(undefined, { month: "long" });
}

export default function RightRail() {
  const { api } = useAuth();
  const [compact, setCompact] = useState(true);
  const [people, setPeople] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const users = await api.getUsers();
        if (mounted) setPeople(Array.isArray(users) ? users : []);
      } catch {
        if (mounted) setPeople([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  const birthdays = useMemo(() => {
    const rows: PersonRow[] = people
      .map((u: any) => {
        const dob = String(u?.employee_dob || "").trim();
        if (!dob || !isCurrentMonthDate(dob)) return null;
        return {
          key: `b:${String(u?.username || u?.employee_email || u?.employee_name || Math.random())}`,
          name: String(u?.employee_name || u?.username || "Team Member"),
          title: String(u?.employee_title || ""),
          location: String(u?.location || ""),
          date: dob,
        };
      })
      .filter(Boolean) as PersonRow[];

    rows.sort((a, b) => {
      const ad = safeDate(a.date)?.getDate() ?? 99;
      const bd = safeDate(b.date)?.getDate() ?? 99;
      return ad - bd;
    });

    return rows;
  }, [people]);

  const joinees = useMemo(() => {
    const rows: PersonRow[] = people
      .map((u: any) => {
        const start = String(u?.employee_date_started || "").trim();
        if (!start || !isCurrentMonthDate(start)) return null;
        return {
          key: `j:${String(u?.username || u?.employee_email || u?.employee_name || Math.random())}`,
          name: String(u?.employee_name || u?.username || "Team Member"),
          title: String(u?.employee_title || ""),
          location: String(u?.location || ""),
          date: start,
        };
      })
      .filter(Boolean) as PersonRow[];

    rows.sort((a, b) => {
      const ad = safeDate(a.date)?.getDate() ?? 99;
      const bd = safeDate(b.date)?.getDate() ?? 99;
      return ad - bd;
    });

    return rows;
  }, [people]);

  const limit = compact ? 5 : 20;
  const mName = monthNameNow();

  const renderList = (rows: PersonRow[], empty: string, mode: "birthday" | "join") => (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {rows.length === 0 ? (
        <li style={{ padding: 14, color: "#607d8b", fontWeight: 900 }}>{empty}</li>
      ) : (
        rows.slice(0, limit).map((p) => (
          <li key={p.key} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 10, padding: "12px 14px", borderBottom: "1px solid #edf2f7" }}>
            <div>
              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 12 }}>{fmtMonthDay(p.date)}</div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#64748b", fontWeight: 900 }}>{mode === "birthday" ? "Birthday" : "Start Date"}</div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 13.5 }}>{p.name}</div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, border: "1px solid #dbeafe", background: "#eff6ff", color: "#1e40af", fontSize: 11, fontWeight: 900 }}>
                  <i className="material-icons" style={{ fontSize: 14 }}>{mode === "birthday" ? "cake" : "groups"}</i>
                  {mode === "birthday" ? "Birthday" : "Welcome"}
                </span>
              </div>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {!!p.title && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}><i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>work</i>{p.title}</span>}
                {!!p.location && <span style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}><i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>place</i>{p.location}</span>}
              </div>
            </div>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div className="sticky-panel">
      <div className="card z-depth-1" style={{ borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #edf2f7", background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>{mName} Birthdays</div>
              <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 700 }}>{birthdays.length} this month</div>
            </div>
            <button className="btn-flat" onClick={() => setCompact((v) => !v)}>{compact ? "Expand" : "Compact"}</button>
          </div>
        </div>
        {renderList(birthdays, `No birthdays in ${mName}.`, "birthday")}
      </div>

      <div className="card z-depth-1" style={{ marginTop: 12, borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #edf2f7", background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>Welcome To Team</div>
            <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 700 }}>{joinees.length} joinees in {mName}</div>
          </div>
        </div>
        {renderList(joinees, `No joinees in ${mName}.`, "join")}
      </div>
    </div>
  );
}
