import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AdminMailerComposerModal from "../components/AdminMailerComposerModal";
import ActivityReport from "./ActivityReport";
import EmployeeExplorerPanel from "../components/admin/EmployeeExplorerPanel";
import AnalyticsInsightsPanel from "../components/AnalyticsInsightsPanel";
import Tabs, { type TabDef } from "../components/shared/Tabs";
import { useTabState } from "../lib/useTabState";

type TabKey = "activity" | "employees" | "analytics";
type EmployeeScope = "all" | "team";

const ALL_TAB_KEYS: TabKey[] = ["activity", "employees", "analytics"];
const TEAM_TAB_KEYS: TabKey[] = ["activity", "employees"];

export default function AdminWorkspace({
  initialTab = "employees",
  employeeScope = "all",
}: {
  initialTab?: TabKey;
  employeeScope?: EmployeeScope;
} = {}) {
  const { user, api } = useAuth();
  const [tab, setTab] = useTabState<TabKey>(
    employeeScope === "team" ? TEAM_TAB_KEYS : ALL_TAB_KEYS,
    initialTab
  );
  const [mailerOpen, setMailerOpen] = useState(false);

  const tabs = useMemo<TabDef<TabKey>[]>(() => {
    const base: TabDef<TabKey>[] = [
      { key: "activity", label: "Cumulative Activity", icon: "insights" },
      { key: "employees", label: employeeScope === "team" ? "My Team" : "Each Employee", icon: "groups" },
    ];
    if (employeeScope !== "team") {
      base.push({ key: "analytics", label: "Analytics", icon: "query_stats" });
    }
    return base;
  }, [employeeScope]);

  return (
    <div style={{ width: "100%", maxWidth: "none", padding: "24px 32px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
            {employeeScope === "team" ? "My Team Workspace" : "Admin Workspace"}
          </div>
          <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
            {employeeScope === "team"
              ? "Your direct reports, weekly activity, and team-level inspection."
              : "One place for cumulative activity and employee-level inspection."}
          </div>
        </div>

        {employeeScope !== "team" ? (
          <button
            type="button"
            className="btn"
            onClick={() => setMailerOpen(true)}
            style={{ borderRadius: 999, textTransform: "none", fontWeight: 900 }}
          >
            <i className="material-icons left">campaign</i>
            Mail Composer
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 18, marginBottom: 18 }}>
        <Tabs tabs={tabs} activeKey={tab} onChange={setTab} ariaLabel="Admin workspace tabs" />
      </div>

      <div style={{ display: tab === "activity" ? "block" : "none", width: "100%" }}>
        <ActivityReport embedded currentUser={user} scope={employeeScope} />
      </div>

      <div style={{ display: tab === "employees" ? "block" : "none", width: "100%" }}>
        <EmployeeExplorerPanel currentUser={user} scope={employeeScope} />
      </div>

      {employeeScope !== "team" && (
        <div style={{ display: tab === "analytics" ? "block" : "none", width: "100%" }}>
          <AnalyticsInsightsPanel />
        </div>
      )}
      {employeeScope !== "team" ? (
        <AdminMailerComposerModal
          api={api}
          open={mailerOpen}
          onClose={() => setMailerOpen(false)}
        />
      ) : null}
    </div>
  );
}
