// src/components/EmployeeActions.tsx
import { Link } from "react-router-dom";

type Action = {
  to: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: "primary" | "neutral" | "dark" | "light";
};

function ActionCard({ a }: { a: Action }) {
  const tones: Record<Action["tone"], { bg: string; border: string; iconBg: string; icon: string; text: string }> = {
    primary: { bg: "#0b1220", border: "#1f2a44", iconBg: "rgba(59,130,246,0.18)", icon: "#93c5fd", text: "#e5e7eb" },
    neutral: { bg: "#ffffff", border: "#e6edf2", iconBg: "#eef2f7", icon: "#607d8b", text: "#263238" },
    dark: { bg: "#111827", border: "#1f2937", iconBg: "rgba(255,255,255,0.08)", icon: "#e5e7eb", text: "#e5e7eb" },
    light: { bg: "#f8fafc", border: "#e2e8f0", iconBg: "#ffffff", icon: "#455a64", text: "#263238" },
  };

  const t = tones[a.tone];

  return (
    <Link
      to={a.to}
      style={{ textDecoration: "none" }}
      className="waves-effect waves-light"
      aria-label={a.title}
      title={a.title}
    >
      <div
        className="z-depth-0"
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          padding: "12px 12px",
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          background: t.bg,
          transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 10px 22px rgba(0,0,0,0.10)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.35)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
          (e.currentTarget as HTMLDivElement).style.borderColor = t.border;
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: t.iconBg,
            flex: "0 0 auto",
          }}
        >
          <i className="material-icons" style={{ fontSize: 20, color: t.icon }}>
            {a.icon}
          </i>
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, color: t.text, lineHeight: "18px" }}>{a.title}</div>
          <div style={{ fontSize: 12, color: a.tone === "primary" || a.tone === "dark" ? "rgba(229,231,235,0.78)" : "#607d8b" }}>
            {a.subtitle}
          </div>
        </div>

        <i
          className="material-icons"
          style={{ fontSize: 18, color: a.tone === "primary" || a.tone === "dark" ? "rgba(229,231,235,0.8)" : "#90a4ae" }}
        >
          chevron_right
        </i>
      </div>
    </Link>
  );
}

export default function EmployeeActions() {
  const actions: Action[] = [
    { to: "/updates/new", title: "Fill Timesheet", subtitle: "Log hours for this week", icon: "edit_note", tone: "primary" },
    { to: "/updates/board", title: "Retro Board", subtitle: "Wins, blockers, next steps", icon: "view_kanban", tone: "neutral" },
    { to: "/updates/activity", title: "Activity Report", subtitle: "Progress across projects", icon: "insights", tone: "dark" },
    { to: "/account", title: "My Account", subtitle: "Profile & security settings", icon: "manage_accounts", tone: "light" },
  ];

  return (
    <div className="card z-depth-1" style={{ borderRadius: 14, overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 14px 12px",
          borderBottom: "1px solid #eceff1",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14.5, color: "#263238" }}>Quick Actions</div>
            <div style={{ fontSize: 12, color: "#607d8b", marginTop: 2 }}>Common tasks for your week</div>
          </div>
          <span
            className="chip"
            style={{
              height: 26,
              lineHeight: "26px",
              fontWeight: 800,
              background: "#eef2ff",
              color: "#1e40af",
              border: "1px solid #e0e7ff",
            }}
          >
            Employee
          </span>
        </div>
      </div>

      <div className="card-content" style={{ padding: 14 }}>
        <div style={{ display: "grid", gap: 10 }}>
          {actions.map((a) => (
            <ActionCard key={a.to} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
