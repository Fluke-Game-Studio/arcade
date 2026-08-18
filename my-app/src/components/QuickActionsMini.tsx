import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type MiniAction = {
  to: string;
  title: string;
  icon: string;
  tone: "primary" | "dark";
  badge?: number;
};

function MiniActionButton({ a }: { a: MiniAction }) {
  const isPrimary = a.tone === "primary";
  const bg = isPrimary
    ? "linear-gradient(180deg, #0b1220 0%, #101a30 100%)"
    : "linear-gradient(180deg, #111827 0%, #0f172a 100%)";
  const border = isPrimary ? "rgba(59,130,246,0.22)" : "rgba(148,163,184,0.16)";
  const iconBg = isPrimary
    ? "linear-gradient(135deg, rgba(59,130,246,0.24), rgba(99,102,241,0.12))"
    : "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))";
  const iconColor = isPrimary ? "#dbeafe" : "#e5e7eb";

  return (
    <Link
      to={a.to}
      className="waves-effect waves-light"
      aria-label={a.title}
      title={a.title}
      style={{ textDecoration: "none", display: "block", width: "100%", height: "100%" }}
    >
      <div
        style={{
          position: "relative",
          display: "grid",
          gap: 6,
          alignContent: "start",
          justifyItems: "center",
          minHeight: 72,
          padding: 10,
          borderRadius: 16,
          border: `1px solid ${border}`,
          background: bg,
          boxShadow: isPrimary ? "0 14px 30px rgba(37,99,235,0.14)" : "0 12px 26px rgba(15,23,42,0.06)",
          transition: "transform 160ms ease, box-shadow 160ms ease",
          textAlign: "center",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        }}
      >
        {typeof a.badge === "number" && a.badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 999,
              background: "linear-gradient(135deg,#ef4444,#f97316)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 950,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 18px rgba(239,68,68,.22)",
            }}
          >
            {a.badge}
          </span>
        )}

        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: iconBg,
            border: `1px solid ${border}`,
          }}
        >
          <i className="material-icons" style={{ fontSize: 15, color: iconColor }}>
            {a.icon}
          </i>
        </div>

        <div style={{ fontSize: 12, fontWeight: 950, color: "#f8fbff", letterSpacing: "-0.01em" }}>{a.title}</div>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${border}`,
            background: "rgba(255,255,255,0.08)",
            color: "#eff6ff",
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.5,
            textTransform: "uppercase",
          }}
        >
          Open
        </span>
      </div>
    </Link>
  );
}

export default function QuickActionsMini() {
  const { api } = useAuth();
  const [editRequestCount, setEditRequestCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const resp = await api.getSocialPosts();
        const items = Array.isArray(resp?.items) ? resp.items : [];
        const count = items.filter((p: any) => String(p?.status || "").toLowerCase().includes("changes_requested")).length;
        if (mounted) setEditRequestCount(count);
      } catch {
        if (mounted) setEditRequestCount(0);
      }
    };
    void load();
    const id = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [api]);

  const actions: MiniAction[] = [
    { to: "/updates/new", title: "Fill Update", icon: "edit_note", tone: "primary" },
    { to: "/organisation/social-media", title: "Social Media", icon: "share", tone: "dark", badge: editRequestCount || undefined },
  ];

  return (
    <div className="card z-depth-1" style={{ borderRadius: 18, overflow: "hidden" }}>
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid #edf2f7",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 15, color: "#0f172a" }}>Quick Actions</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, fontWeight: 700 }}>Common tasks for your week</div>
      </div>

      <div style={{ padding: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {actions.map((a) => (
            <MiniActionButton key={a.to} a={a} />
          ))}
        </div>
      </div>
    </div>
  );
}
