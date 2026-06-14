import { Link } from "react-router-dom";

type Action = {
  to: string;
  title: string;
  subtitle: string;
  icon: string;
  tone: "primary" | "neutral" | "dark" | "light";
};

function ActionCard({ a }: { a: Action }) {
  const tones: Record<
    Action["tone"],
    { bg: string; border: string; iconBg: string; icon: string; text: string; hint: string }
  > = {
    primary: {
      bg: "linear-gradient(180deg, #0b1220 0%, #101a30 100%)",
      border: "rgba(59,130,246,0.22)",
      iconBg: "linear-gradient(135deg, rgba(59,130,246,0.24), rgba(99,102,241,0.12))",
      icon: "#dbeafe",
      text: "#f8fbff",
      hint: "rgba(219,234,254,0.82)",
    },
    neutral: {
      bg: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
      border: "rgba(148,163,184,0.20)",
      iconBg: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(14,165,233,0.04))",
      icon: "#2563eb",
      text: "#0f172a",
      hint: "#64748b",
    },
    dark: {
      bg: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
      border: "rgba(148,163,184,0.16)",
      iconBg: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
      icon: "#e5e7eb",
      text: "#f8fafc",
      hint: "rgba(226,232,240,0.78)",
    },
    light: {
      bg: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
      border: "rgba(226,232,240,0.95)",
      iconBg: "linear-gradient(135deg, rgba(148,163,184,0.10), rgba(255,255,255,0.94))",
      icon: "#334155",
      text: "#0f172a",
      hint: "#64748b",
    },
  };

  const t = tones[a.tone];

  return (
    <Link
      to={a.to}
      className="waves-effect waves-light"
      aria-label={a.title}
      title={a.title}
      style={{
        textDecoration: "none",
        display: "block",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          position: "relative",
          display: "grid",
          gap: 14,
          alignContent: "start",
          minHeight: 148,
          padding: 16,
          borderRadius: 22,
          border: `1px solid ${t.border}`,
          background: t.bg,
          boxShadow:
            a.tone === "primary"
              ? "0 18px 36px rgba(37,99,235,0.16)"
              : "0 14px 30px rgba(15,23,42,0.06)",
          transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-2px)";
          el.style.borderColor = "rgba(59,130,246,0.30)";
          el.style.boxShadow = "0 20px 40px rgba(37,99,235,0.14)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(0)";
          el.style.borderColor = t.border;
          el.style.boxShadow =
            a.tone === "primary" ? "0 18px 36px rgba(37,99,235,0.16)" : "0 14px 30px rgba(15,23,42,0.06)";
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            background: t.iconBg,
            border: `1px solid ${t.border}`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <i className="material-icons" style={{ fontSize: 24, color: t.icon }}>
            {a.icon}
          </i>
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.15,
              fontWeight: 950,
              color: t.text,
              letterSpacing: "-0.02em",
            }}
          >
            {a.title}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12.5,
              lineHeight: 1.45,
              color: t.hint,
              fontWeight: 700,
            }}
          >
            {a.subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: "auto" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: 999,
              border: `1px solid ${t.border}`,
              background: a.tone === "primary" || a.tone === "dark" ? "rgba(255,255,255,0.08)" : "rgba(37,99,235,0.06)",
              color: a.tone === "primary" || a.tone === "dark" ? "#eff6ff" : "#1d4ed8",
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Open
          </span>
          <i className="material-icons" style={{ fontSize: 18, color: a.tone === "primary" || a.tone === "dark" ? "#dbeafe" : "#334155" }}>
            arrow_forward
          </i>
        </div>
      </div>
    </Link>
  );
}

export default function EmployeeActions() {
  const actions: Action[] = [
    { to: "/updates/new", title: "Fill Timesheet", subtitle: "Log hours for this week", icon: "edit_note", tone: "primary" },
    { to: "/updates/board", title: "Retro Board", subtitle: "Wins, blockers, next steps", icon: "view_kanban", tone: "neutral" },
    { to: "/account", title: "Activity Report", subtitle: "Your updates and weekly activity", icon: "insights", tone: "dark" },
    { to: "/account", title: "My Account", subtitle: "Profile and security settings", icon: "manage_accounts", tone: "light" },
  ];

  return (
    <div className="card z-depth-1 employee-actions-card" style={{ borderRadius: 18, overflow: "hidden" }}>
      <style>{`
        .employee-actions-card .card-content {
          padding: 14px;
        }

        .employee-actions-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 600px) {
          .employee-actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        style={{
          padding: "14px 14px 12px",
          borderBottom: "1px solid #edf2f7",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 55%, #f6f9ff 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>Quick Actions</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>Common tasks for your week</div>
          </div>
          <span
            className="chip"
            style={{
              height: 28,
              lineHeight: "28px",
              fontWeight: 900,
              background: "rgba(37,99,235,0.08)",
              color: "#1d4ed8",
              border: "1px solid rgba(37,99,235,0.16)",
              borderRadius: 999,
              padding: "0 12px",
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            Employee
          </span>
        </div>
      </div>

      <div className="card-content">
        <div className="employee-actions-grid">
          {actions.map((a) => (
            <ActionCard key={`${a.to}:${a.title}`} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
