import { useEffect, useMemo, useState } from "react";
import { useIntegrations } from "./useIntegrations";

declare const M: any;

type SettingsSectionKey = "general" | "integrations" | "ai_access";

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function chipStyle(active: boolean) {
  return {
    border: active ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(148,163,184,0.35)",
    background: active ? "rgba(56,189,248,0.16)" : "transparent",
    color: "#e2e8f0",
    borderRadius: 12,
    padding: "8px 10px",
    fontWeight: 900 as const,
    fontSize: 12,
    cursor: "pointer",
    textAlign: "left" as const,
  };
}

export default function AccountSettingsPanel({
  api,
  me,
  theme,
  onToggleTheme,
}: {
  api: any;
  me: any;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const [section, setSection] = useState<SettingsSectionKey>("general");
  const [agents, setAgents] = useState<any[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [requestReason, setRequestReason] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);

  const integrations = useIntegrations(api, me);

  async function loadAvailableAgents() {
    try {
      setAgentsLoading(true);
      const resp = await api.getAvailableAiAgents();
      const rows = Array.isArray(resp?.agents) ? resp.agents : [];
      setAgents(rows);
      if (!selectedAgent && rows.length) {
        setSelectedAgent(String(rows[0]?.agentId || ""));
      }
    } catch {
      setAgents([]);
    } finally {
      setAgentsLoading(false);
    }
  }

  useEffect(() => {
    void loadAvailableAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedAgentMeta = useMemo(
    () => agents.find((a: any) => String(a?.agentId || "") === selectedAgent) || null,
    [agents, selectedAgent]
  );

  async function submitRequest() {
    if (!safeStr(selectedAgent)) {
      M?.toast?.({ html: "Select an agent first.", classes: "red" });
      return;
    }
    try {
      setRequestLoading(true);
      await api.requestAiAgentAccess({
        agentId: selectedAgent,
        reason: safeStr(requestReason),
      });
      setRequestReason("");
      M?.toast?.({ html: "Access request submitted.", classes: "green" });
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to submit request.", classes: "red" });
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <section className="panelCard" style={{ background: "#fff" }}>
      <div className="panelHead">
        <div>
          <div className="h">Settings</div>
          <div className="p">General preferences, integrations, and AI access</div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 14 }}>
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.24)",
              background: "linear-gradient(180deg, #0b2544 0%, #0a1f39 100%)",
              padding: 10,
              display: "grid",
              gap: 8,
              alignSelf: "start",
            }}
          >
            <button type="button" style={chipStyle(section === "general")} onClick={() => setSection("general")}>General Settings</button>
            <button type="button" style={chipStyle(section === "integrations")} onClick={() => setSection("integrations")}>Integrations</button>
            <button type="button" style={chipStyle(section === "ai_access")} onClick={() => setSection("ai_access")}>AI Access</button>
          </div>

          <div>
            {section === "general" && (
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>Theme</div>
                    <div style={{ fontSize: 12, color: "#607d8b" }}>
                      {theme === "dark" ? "Night mode enabled" : "Day mode enabled"}
                    </div>
                  </div>
                  <button type="button" className="accBtn subtle" onClick={onToggleTheme}>
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      {theme === "dark" ? "wb_sunny" : "nightlight_round"}
                    </i>
                    {theme === "dark" ? "Switch To Day" : "Switch To Night"}
                  </button>
                </div>
              </div>
            )}

            {section === "integrations" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>LinkedIn</div>
                  <div style={{ fontSize: 12, color: "#607d8b", margin: "4px 0 10px" }}>
                    Status: {integrations.status.linkedin ? "Connected" : "Not connected"}
                  </div>
                  <button
                    type="button"
                    className="accBtn subtle"
                    disabled={integrations.loadingByKey.linkedin}
                    onClick={() => integrations.startConnect("linkedin")}
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      {integrations.loadingByKey.linkedin ? "hourglass_empty" : "link"}
                    </i>
                    {integrations.loadingByKey.linkedin ? "Connecting..." : "Connect LinkedIn"}
                  </button>
                </div>

                <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>Discord</div>
                  <div style={{ fontSize: 12, color: "#607d8b", margin: "4px 0 10px" }}>
                    Status: {integrations.status.discord ? "Connected" : "Not connected"}
                  </div>
                  <button
                    type="button"
                    className="accBtn subtle"
                    disabled={integrations.loadingByKey.discord}
                    onClick={() => integrations.startConnect("discord")}
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      {integrations.loadingByKey.discord ? "hourglass_empty" : "sports_esports"}
                    </i>
                    {integrations.loadingByKey.discord ? "Connecting..." : "Connect Discord"}
                  </button>
                </div>

                <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>Jira</div>
                  <div style={{ fontSize: 12, color: "#607d8b", margin: "4px 0 10px" }}>
                    Status: {integrations.status.jira ? "Connected" : "Not connected"}
                    {integrations.status.jiraCloudName ? ` | Site: ${integrations.status.jiraCloudName}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="accBtn subtle"
                      disabled={integrations.loadingByKey.jira}
                      onClick={() => integrations.startConnect("jira")}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        {integrations.loadingByKey.jira ? "hourglass_empty" : "account_tree"}
                      </i>
                      {integrations.loadingByKey.jira ? "Connecting..." : "Connect Jira"}
                    </button>
                    <button type="button" className="accBtn subtle" onClick={integrations.refreshJiraStatus}>
                      <i className="material-icons" style={{ fontSize: 18 }}>refresh</i>
                      Refresh Status
                    </button>
                    {integrations.status.jira ? (
                      <button
                        type="button"
                        className="accBtn subtle"
                        onClick={async () => {
                          await integrations.disconnectJira();
                          M?.toast?.({ html: "Jira disconnected.", classes: "green" });
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 18 }}>link_off</i>
                        Disconnect Jira
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {section === "ai_access" && (
              <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>Request AI Agent Access</div>
                  <button type="button" className="accBtn subtle" onClick={loadAvailableAgents}>
                    <i className="material-icons" style={{ fontSize: 18 }}>refresh</i>
                    Refresh Agents
                  </button>
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#607d8b" }}>
                  Choose an existing agent and submit an access request.
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Available Agents</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    style={{ width: "100%", height: 38, marginTop: 6, borderRadius: 8, border: "1px solid #cbd5e1" }}
                  >
                    {!agents.length ? <option value="">{agentsLoading ? "Loading..." : "No agents found"}</option> : null}
                    {agents.map((a: any) => (
                      <option key={String(a.agentId)} value={String(a.agentId)}>
                        {String(a.name || a.agentId)} ({String(a.agentId)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAgentMeta ? (
                  <div style={{ marginTop: 10, border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{String(selectedAgentMeta.name || selectedAgentMeta.agentId)}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{safeStr(selectedAgentMeta.description) || "No description."}</div>
                  </div>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Reason (optional)</label>
                  <textarea
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    rows={4}
                    style={{ width: "100%", marginTop: 6, borderRadius: 8, border: "1px solid #cbd5e1", padding: 8 }}
                    placeholder="Why do you need this agent?"
                  />
                </div>
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="accBtn" onClick={submitRequest} disabled={requestLoading}>
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      {requestLoading ? "hourglass_empty" : "send"}
                    </i>
                    {requestLoading ? "Submitting..." : "Request Access"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
