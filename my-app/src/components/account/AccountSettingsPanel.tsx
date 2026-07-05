import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIntegrations } from "./useIntegrations";

declare const M: any;

type SettingsSectionKey = "general" | "notifications" | "integrations" | "ai_access";
type AiAccessTabKey = "request" | "requests";

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

function normalizePreferences(value: any) {
  const defaults = {
    email: {
      social_media: true,
      weekly_updates: true,
      applicants: true,
      mentions: true,
      system: true,
    },
    in_app: {
      social_media: true,
      weekly_updates: true,
      applicants: true,
      mentions: true,
      system: true,
    },
    discord_dm: {
      social_media: true,
      weekly_updates: true,
      applicants: false,
      mentions: true,
      system: false,
    },
    discord_channel: {
      social_media: true,
      weekly_updates: true,
      applicants: false,
      mentions: false,
      system: false,
    },
  };
  if (!value) return defaults;
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed || "{}");
    } catch {
      parsed = {};
    }
  }
  return {
    email: { ...defaults.email, ...((parsed as any)?.email || {}) },
    in_app: { ...defaults.in_app, ...((parsed as any)?.in_app || {}) },
    discord_dm: { ...defaults.discord_dm, ...((parsed as any)?.discord_dm || {}) },
    discord_channel: { ...defaults.discord_channel, ...((parsed as any)?.discord_channel || {}) },
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
  const [aiAccessTab, setAiAccessTab] = useState<AiAccessTabKey>("request");
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [requestNotice, setRequestNotice] = useState("");
  const navigate = useNavigate();
  const [notificationPrefs, setNotificationPrefs] = useState(() => normalizePreferences((me as any)?.notification_preferences));
  const [notificationSaving, setNotificationSaving] = useState(false);

  const integrations = useIntegrations(api, me);

  function preferenceCheckbox(checked: boolean, onChange: (checked: boolean) => void, label: string) {
    return (
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          color: "#334155",
          fontWeight: 800,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{
            width: 18,
            height: 18,
            accentColor: "#2563eb",
            cursor: "pointer",
            margin: 0,
            flex: "0 0 auto",
          }}
        />
        <span>{label}</span>
      </label>
    );
  }

  useEffect(() => {
    setNotificationPrefs(normalizePreferences((me as any)?.notification_preferences));
  }, [me]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.getNotificationPreferences();
        if (!mounted) return;
        setNotificationPrefs(normalizePreferences(resp?.preferences));
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

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

  async function loadMyRequests() {
    try {
      setMyRequestsLoading(true);
      const resp = await api.getMyAiAgentAccessRequests();
      setMyRequests(Array.isArray(resp?.requests) ? resp.requests : []);
    } catch {
      setMyRequests([]);
    } finally {
      setMyRequestsLoading(false);
    }
  }

  // Load agents + requests whenever the AI Access section is opened
  useEffect(() => {
    if (section === "ai_access") {
      void loadAvailableAgents();
      void loadMyRequests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

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
      setRequestNotice("Access request submitted. You can track it in Submitted Requests.");
      setAiAccessTab("requests");
      await loadMyRequests();
      M?.toast?.({ html: "Access request submitted.", classes: "green" });
    } catch (e: any) {
      setRequestNotice(e?.message || "Failed to submit request.");
      M?.toast?.({ html: e?.message || "Failed to submit request.", classes: "red" });
    } finally {
      setRequestLoading(false);
    }
  }

  async function saveNotificationPreferences() {
    try {
      setNotificationSaving(true);
      await api.updateNotificationPreferences({ preferences: notificationPrefs });
      M?.toast?.({ html: "Notification preferences saved.", classes: "green" });
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Failed to save notification preferences.", classes: "red" });
    } finally {
      setNotificationSaving(false);
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
            <button type="button" style={chipStyle(section === "notifications")} onClick={() => setSection("notifications")}>Notifications</button>
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

            {section === "notifications" && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ border: "1px solid #e6edf2", borderRadius: 16, padding: 14, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "#0f172a" }}>Notification preferences</div>
                      <div style={{ fontSize: 12, color: "#607d8b", marginTop: 4 }}>
                        Control what reaches your bell and your inbox. These settings apply across social review, update reminders, and future notification types.
                      </div>
                    </div>
                    <button type="button" className="accBtn subtle" onClick={() => navigate("/account/notifications")}>
                      <i className="material-icons" style={{ fontSize: 18 }}>notifications</i>
                      Open Notifications
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) repeat(4, minmax(120px, 180px))", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>Category</div>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>Bell</div>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>Email</div>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>Discord DM</div>
                    <div style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#64748b" }}>Discord Channel</div>

                    {[
                      { key: "mentions", label: "Mentions" },
                      { key: "social_media", label: "Social media" },
                      { key: "weekly_updates", label: "Weekly updates" },
                      { key: "applicants", label: "Applicants / admin" },
                      { key: "system", label: "System" },
                    ].map((row) => (
                      <div key={row.key} style={{ display: "contents" }}>
                        <div style={{ color: "#0f172a", fontWeight: 800 }}>{row.label}</div>
                        {preferenceCheckbox(
                          !!notificationPrefs.in_app?.[row.key as keyof typeof notificationPrefs.in_app],
                          (checked) =>
                            setNotificationPrefs((prev: any) => ({
                              ...prev,
                              in_app: { ...prev.in_app, [row.key]: checked },
                            })),
                          "In-app"
                        )}
                        {preferenceCheckbox(
                          !!notificationPrefs.email?.[row.key as keyof typeof notificationPrefs.email],
                          (checked) =>
                            setNotificationPrefs((prev: any) => ({
                              ...prev,
                              email: { ...prev.email, [row.key]: checked },
                            })),
                          "Email"
                        )}
                        {preferenceCheckbox(
                          !!notificationPrefs.discord_dm?.[row.key as keyof typeof notificationPrefs.discord_dm],
                          (checked) =>
                            setNotificationPrefs((prev: any) => ({
                              ...prev,
                              discord_dm: { ...prev.discord_dm, [row.key]: checked },
                            })),
                          "DM"
                        )}
                        {preferenceCheckbox(
                          !!notificationPrefs.discord_channel?.[row.key as keyof typeof notificationPrefs.discord_channel],
                          (checked) =>
                            setNotificationPrefs((prev: any) => ({
                              ...prev,
                              discord_channel: { ...prev.discord_channel, [row.key]: checked },
                            })),
                          "Feed"
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    Discord DMs use your connected bot-linked account. Discord Channel posts use the notifications webhook when an event involving you is echoed into the team feed.
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="accBtn" onClick={() => void saveNotificationPreferences()} disabled={notificationSaving}>
                      <i className="material-icons" style={{ fontSize: 18 }}>{notificationSaving ? "hourglass_empty" : "save"}</i>
                      {notificationSaving ? "Saving..." : "Save Preferences"}
                    </button>
                  </div>
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
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>AI Agent Access</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="accBtn subtle" onClick={() => setAiAccessTab("request")}>
                      Request Access
                    </button>
                    <button type="button" className="accBtn subtle" onClick={() => { setAiAccessTab("requests"); void loadMyRequests(); }}>
                      Submitted Requests
                    </button>
                    <button
                      type="button"
                      className="accBtn subtle"
                      onClick={aiAccessTab === "requests" ? loadMyRequests : loadAvailableAgents}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>refresh</i>
                      Refresh
                    </button>
                  </div>
                </div>
                {requestNotice ? (
                  <div style={{ marginTop: 10, border: "1px solid #bae6fd", background: "#f0f9ff", color: "#075985", borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 800 }}>
                    {requestNotice}
                  </div>
                ) : null}

                {aiAccessTab === "request" ? (
                  <>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#607d8b" }}>
                      Choose an existing agent and submit an access request.
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>Available Agents</label>
                      <div style={{ marginTop: 8, display: "grid", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                        {agentsLoading ? (
                          <div style={{ fontSize: 13, color: "#607d8b", padding: "8px 0" }}>Loading agents…</div>
                        ) : agents.length ? agents.map((a: any) => {
                          const isSelected = String(a.agentId) === selectedAgent;
                          return (
                            <div
                              key={String(a.agentId)}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedAgent(String(a.agentId))}
                              onKeyDown={(e) => e.key === "Enter" && setSelectedAgent(String(a.agentId))}
                              style={{
                                display: "flex", alignItems: "flex-start", gap: 12,
                                border: `1.5px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                                borderRadius: 10, padding: "12px 14px",
                                background: isSelected ? "#eff6ff" : "#f8fafc",
                                cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                                outline: "none",
                              }}
                            >
                              <div style={{
                                width: 18, height: 18, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                                border: `2px solid ${isSelected ? "#3b82f6" : "#cbd5e1"}`,
                                background: isSelected ? "#3b82f6" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                transition: "all 0.15s",
                              }}>
                                {isSelected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                                  {String(a.name || a.agentId)}
                                </div>
                                {safeStr(a.description) && (
                                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 1.45 }}>
                                    {safeStr(a.description)}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }) : (
                          <div style={{ fontSize: 13, color: "#607d8b", padding: "8px 0" }}>
                            No agents available. Click Refresh to reload.
                          </div>
                        )}
                      </div>
                    </div>

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
                  </>
                ) : (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {myRequestsLoading ? (
                      <div style={{ fontSize: 13, color: "#607d8b" }}>Loading requests...</div>
                    ) : myRequests.length ? myRequests.map((request: any) => {
                      const agent = agents.find((a: any) => safeStr(a.agentId).toLowerCase() === safeStr(request.agentId).toLowerCase());
                      const status = safeStr(request.status || "pending").toLowerCase();
                      const statusColor =
                        status === "approved" ? "#047857" : status === "rejected" ? "#b91c1c" : "#92400e";
                      return (
                        <div key={safeStr(request.requestId)} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <div>
                              <div style={{ fontWeight: 900, color: "#0f172a" }}>{safeStr(agent?.name) || safeStr(request.agentId)}</div>
                              <div style={{ marginTop: 3, fontSize: 12, color: "#64748b" }}>
                                {safeStr(request.createdAt) ? new Date(request.createdAt).toLocaleString() : "Submitted"}
                              </div>
                            </div>
                            <div style={{ color: statusColor, fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>{status}</div>
                          </div>
                          {safeStr(request.reason) ? (
                            <div style={{ marginTop: 8, fontSize: 13, color: "#334155" }}>{safeStr(request.reason)}</div>
                          ) : null}
                          {safeStr(request.reviewNote) ? (
                            <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>Review note: {safeStr(request.reviewNote)}</div>
                          ) : null}
                        </div>
                      );
                    }) : (
                      <div style={{ fontSize: 13, color: "#607d8b" }}>No submitted requests yet.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
