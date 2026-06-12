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
  const tones: Record<
    Action["tone"],
    { bg: string; border: string; iconBg: string; icon: string; text: string; glow: string }
  > = {
    primary: {
      bg: "linear-gradient(180deg, #0b1220 0%, #101a30 100%)",
      border: "rgba(59,130,246,0.24)",
      iconBg: "linear-gradient(135deg, rgba(59,130,246,0.22), rgba(99,102,241,0.16))",
      icon: "#93c5fd",
      text: "#eff6ff",
      glow: "0 18px 34px rgba(37,99,235,0.18)",
    },
    neutral: {
      bg: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
      border: "rgba(148,163,184,0.20)",
      iconBg: "linear-gradient(135deg, rgba(37,99,235,0.08), rgba(14,165,233,0.05))",
      icon: "#2563eb",
      text: "#0f172a",
      glow: "0 16px 30px rgba(15,23,42,0.08)",
    },
    dark: {
      bg: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
      border: "rgba(148,163,184,0.16)",
      iconBg: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
      icon: "#e5e7eb",
      text: "#f8fafc",
      glow: "0 18px 34px rgba(2,6,23,0.18)",
    },
    light: {
      bg: "linear-gradient(180deg, #ffffff 0%, #f7fafc 100%)",
      border: "rgba(226,232,240,0.95)",
      iconBg: "linear-gradient(135deg, rgba(148,163,184,0.10), rgba(255,255,255,0.94))",
      icon: "#334155",
      text: "#0f172a",
      glow: "0 16px 30px rgba(15,23,42,0.06)",
    },
  };

  const t = tones[a.tone];

  return (
    <Link
      to={a.to}
      style={{ textDecoration: "none" }}
      className="waves-effect waves-light tooltipped"
      aria-label={a.title}
      title={a.title}
      data-tooltip={`${a.title} — ${a.subtitle}`}
      data-position="top"
    >
      <div
        className="z-depth-0"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          borderRadius: 18,
          border: `1px solid ${t.border}`,
          background: t.bg,
          boxShadow: t.glow,
          transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
          overflow: "hidden",
          minHeight: 92,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 18px 36px rgba(37,99,235,0.14)`;
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(59,130,246,0.32)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0px)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = t.glow;
          (e.currentTarget as HTMLDivElement).style.borderColor = t.border;
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: t.iconBg,
            flex: "0 0 auto",
            border: `1px solid ${t.border}`,
          }}
        >
          <i className="material-icons" style={{ fontSize: 22, color: t.icon }}>
            {a.icon}
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
    { to: "/account", title: "My Account", subtitle: "Profile & security settings", icon: "manage_accounts", tone: "light" },
  ];

  return (
    <div className="card z-depth-1 employee-actions-card" style={{ borderRadius: 14, overflow: "hidden" }}>
      <style>{`
        .employee-actions-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (max-width: 600px) {
          .employee-actions-grid {
            grid-template-columns: 1fr;
          }
        }

        .employee-action-hover {
          position: relative;
        }

        .employee-action-hover::after {
          content: attr(data-title);
          position: absolute;
          left: 50%;
          bottom: 10px;
          transform: translateX(-50%) translateY(8px);
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.92);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.2px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms ease, transform 140ms ease;
          white-space: nowrap;
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.25);
        }

        .employee-action-hover:hover::after,
        .employee-action-hover:focus-visible::after {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      `}</style>
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
        <div className="employee-actions-grid">
          {actions.map((a) => (
            <div key={`${a.to}:${a.title}`} className="employee-action-hover" data-title={a.title}>
              <ActionCard a={a} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
