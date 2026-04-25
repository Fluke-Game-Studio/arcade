import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AdminMailerComposerModal from "../components/AdminMailerComposerModal";
import ActivityReport from "./ActivityReport";
import EmployeeExplorerPanel from "../components/admin/EmployeeExplorerPanel";

type TabKey = "activity" | "employees";

export default function AdminWorkspace({
  initialTab = "employees",
}: {
  initialTab?: TabKey;
} = {}) {
  const { user, api } = useAuth();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [mailerOpen, setMailerOpen] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <div style={{ width: "100%", maxWidth: "none", padding: "24px 32px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
            Admin Workspace
          </div>
          <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
            One place for cumulative activity and employee-level inspection.
          </div>
        </div>

        <div style={{ display: "inline-flex", gap: 8, padding: 6, borderRadius: 999, background: "rgba(15,23,42,.04)", border: "1px solid rgba(148,163,184,.14)" }}>
          <button
            type="button"
            onClick={() => setTab("activity")}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 999,
              padding: "8px 14px",
              fontWeight: 1000,
              fontSize: 12,
              background: tab === "activity" ? "rgba(59,130,246,.16)" : "transparent",
              color: tab === "activity" ? "#1d4ed8" : "#334155",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className="material-icons" style={{ fontSize: 16 }}>insights</i>
              Cumulative Activity
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("employees")}
            style={{
              border: "none",
              cursor: "pointer",
              borderRadius: 999,
              padding: "8px 14px",
              fontWeight: 1000,
              fontSize: 12,
              background: tab === "employees" ? "rgba(34,197,94,.16)" : "transparent",
              color: tab === "employees" ? "#166534" : "#334155",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <i className="material-icons" style={{ fontSize: 16 }}>groups</i>
              Each Employee
            </span>
          </button>
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => setMailerOpen(true)}
          style={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
        >
          <i className="material-icons left">campaign</i>
          Mail Composer
        </button>
      </div>

      <div style={{ display: tab === "activity" ? "block" : "none", width: "100%" }}>
        <ActivityReport embedded />
      </div>

      <div style={{ display: tab === "employees" ? "block" : "none", width: "100%" }}>
        <EmployeeExplorerPanel currentUser={user} />
      </div>
      <AdminMailerComposerModal
        api={api}
        open={mailerOpen}
        onClose={() => setMailerOpen(false)}
      />
    </div>
  );
}
