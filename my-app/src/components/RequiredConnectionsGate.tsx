import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import ReleaseHighlightsPanel from "./ReleaseHighlightsPanel";
import { useIntegrations } from "./account/useIntegrations";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type GateStep = 1 | 2 | 3;

function primaryButton(disabled = false) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(37,99,235,.18)",
    background: disabled ? "rgba(148,163,184,.16)" : "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
    color: disabled ? "#94a3b8" : "#fff",
    padding: "12px 18px",
    fontWeight: 900 as const,
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow: disabled ? "none" : "0 16px 34px rgba(37,99,235,.18)",
  };
}

function secondaryButton(disabled = false) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,.22)",
    background: disabled ? "rgba(248,250,252,.55)" : "#fff",
    color: disabled ? "#cbd5e1" : "#0f172a",
    padding: "12px 18px",
    fontWeight: 900 as const,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function statusPill(connected: boolean, optional = false) {
  return {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900 as const,
    border: connected
      ? "1px solid rgba(34,197,94,.26)"
      : optional
        ? "1px solid rgba(148,163,184,.26)"
        : "1px solid rgba(245,158,11,.24)",
    background: connected
      ? "rgba(34,197,94,.12)"
      : optional
        ? "rgba(148,163,184,.10)"
        : "rgba(245,158,11,.10)",
    color: connected ? "#166534" : optional ? "#475569" : "#b45309",
  };
}

function stepChip(active: boolean, complete: boolean, label: string) {
  return (
    <div
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "8px 12px",
        border: active
          ? "1px solid rgba(37,99,235,.28)"
          : complete
            ? "1px solid rgba(34,197,94,.22)"
            : "1px solid rgba(148,163,184,.16)",
        background: active
          ? "rgba(37,99,235,.10)"
          : complete
            ? "rgba(34,197,94,.08)"
            : "rgba(255,255,255,.82)",
        color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: ".06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: active ? "#dbeafe" : complete ? "#dcfce7" : "#e2e8f0",
          color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
          fontSize: 11,
        }}
      >
        {complete ? "✓" : label.slice(0, 1)}
      </span>
      {label}
    </div>
  );
}

export default function RequiredConnectionsGate() {
  const { api, user, refreshSession } = useAuth();
  const integrations = useIntegrations(api, user, { onConnected: refreshSession });
  const [step, setStep] = useState<GateStep>(1);
  const [acceptTimesheet, setAcceptTimesheet] = useState(false);
  const [acceptDiscordExpectations, setAcceptDiscordExpectations] = useState(false);

  const requirements = useMemo(
    () => [
      {
        key: "linkedin" as const,
        label: "LinkedIn",
        subtitle:
          safeStr((user as any)?.linkedin_email) ||
          "Required. This keeps profile identity and employee performance workflows aligned.",
        connected: integrations.status.linkedin,
        icon: "link",
        optional: false,
      },
      {
        key: "discord" as const,
        label: "Discord",
        subtitle:
          safeStr((user as any)?.discord_name || (user as any)?.discord_email) ||
          "Required. Discord powers notifications, approvals, and fast workflow coordination.",
        connected: integrations.status.discord,
        icon: "sports_esports",
        optional: false,
      },
      {
        key: "jira" as const,
        label: "Jira",
        subtitle:
          integrations.status.jiraCloudName
            ? `Optional. Connected site: ${integrations.status.jiraCloudName}`
            : "Optional. Connect Jira now if you want project workflow hooks ready from day one.",
        connected: integrations.status.jira,
        icon: "schema",
        optional: true,
      },
    ],
    [
      integrations.status.discord,
      integrations.status.jira,
      integrations.status.jiraCloudName,
      integrations.status.linkedin,
      user,
    ]
  );

  const mustConnectReady = integrations.status.linkedin && integrations.status.discord;
  const needsGate = !mustConnectReady;

  useEffect(() => {
    if (!needsGate) return;
    if (step === 3) return;
    if (acceptTimesheet && acceptDiscordExpectations) {
      setStep((prev) => (prev < 2 ? 2 : prev));
    }
  }, [acceptDiscordExpectations, acceptTimesheet, needsGate, step]);

  if (!user || !needsGate) return null;

  const agreementReady = acceptTimesheet && acceptDiscordExpectations;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,6,23,.78)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(940px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.10)",
          background: "linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(248,250,252,.99) 100%)",
          boxShadow: "0 28px 80px rgba(15,23,42,.28)",
        }}
      >
        <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid rgba(148,163,184,.16)", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.03em" }}>
                Welcome to the Fluke portal
              </div>
              <div style={{ marginTop: 8, maxWidth: 760, fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
                We use one guided setup flow so everyone lands with the same release context, platform expectations, and connected workflow tools. LinkedIn stays tied to identity and employee performance context, while Discord powers notifications and approvals across the team.
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {stepChip(step === 1, step > 1, "Welcome")}
              {stepChip(step === 2, step > 2, "Agreement")}
              {stepChip(step === 3, mustConnectReady, "Connect")}
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {step === 1 && (
            <section style={{ display: "grid", gap: 22 }}>
              <div
                style={{
                  borderRadius: 24,
                  border: "1px solid rgba(148,163,184,.16)",
                  background: "linear-gradient(180deg, rgba(255,255,255,.96) 0%, rgba(241,245,249,.98) 100%)",
                  padding: 22,
                }}
              >
                <ReleaseHighlightsPanel
                  title="Welcome"
                  subtitle="Start with the latest release context before we lock in your team workflow setup."
                  compact
                />
              </div>

              <div
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(14,165,233,.16)",
                  background: "rgba(14,165,233,.06)",
                  padding: 18,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>What happens next</div>
                <div style={{ color: "#475569", lineHeight: 1.7 }}>
                  Step two confirms the team expectations we rely on every week. Step three connects the required tools that keep review, notification, and employee workflow signals in one place.
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section style={{ display: "grid", gap: 18 }}>
              <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
                Terms and expectations
              </div>
              <div style={{ color: "#475569", lineHeight: 1.7 }}>
                Please confirm the core operating expectations below. We only unlock the final connect step after both are acknowledged.
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                {[
                  {
                    checked: acceptTimesheet,
                    setChecked: setAcceptTimesheet,
                    title: "Update Time Sheet weekly.",
                    detail: "This keeps delivery, planning, and accountability visible across the team every week.",
                  },
                  {
                    checked: acceptDiscordExpectations,
                    setChecked: setAcceptDiscordExpectations,
                    title: "Install Discord App. Enable notifications and be responsive",
                    detail: "Discord is used for notification delivery, review workflow coordination, and team responsiveness.",
                  },
                ].map((item) => (
                  <label
                    key={item.title}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "24px minmax(0,1fr)",
                      gap: 14,
                      alignItems: "start",
                      borderRadius: 20,
                      border: item.checked ? "1px solid rgba(37,99,235,.26)" : "1px solid rgba(148,163,184,.18)",
                      background: item.checked ? "rgba(37,99,235,.07)" : "#fff",
                      padding: 18,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.setChecked(e.target.checked)}
                      style={{ width: 20, height: 20, marginTop: 2, accentColor: "#2563eb" }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>{item.title}</div>
                      <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.6 }}>{item.detail}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(16,185,129,.18)",
                  background: "rgba(16,185,129,.06)",
                  padding: 16,
                  color: "#14532d",
                  fontWeight: 800,
                  lineHeight: 1.6,
                }}
              >
                LinkedIn may be used for employee performance metrics and identity alignment. Discord is used for notifications, workflow coordination, and timely review responsiveness. Jira is optional in the next step.
              </div>
            </section>
          )}

          {step === 3 && (
            <section style={{ display: "grid", gap: 18 }}>
              <div>
                <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
                  Connect your workflow accounts
                </div>
                <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>
                  LinkedIn and Discord are required before we unlock the portal. Jira is optional here, so you can connect it now or come back from Settings later.
                </div>
              </div>

              <div style={{ display: "grid", gap: 16 }}>
                {requirements.map((item) => (
                  <section
                    key={item.key}
                    style={{
                      borderRadius: 20,
                      border: "1px solid rgba(148,163,184,.18)",
                      background: "#fff",
                      padding: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 14,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 1000, fontSize: 22, color: "#0f172a" }}>{item.label}</div>
                        <span style={statusPill(item.connected, item.optional)}>
                          {item.connected ? "Connected" : item.optional ? "Optional" : "Required"}
                        </span>
                      </div>
                      <div style={{ color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>{item.subtitle}</div>
                    </div>

                    <button
                      type="button"
                      disabled={item.connected || integrations.loadingByKey[item.key]}
                      onClick={() => integrations.startConnect(item.key)}
                      style={secondaryButton(item.connected || integrations.loadingByKey[item.key])}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        {integrations.loadingByKey[item.key] ? "hourglass_empty" : item.icon}
                      </i>
                      {item.connected
                        ? `${item.label} connected`
                        : integrations.loadingByKey[item.key]
                          ? `Connecting ${item.label}...`
                          : `Connect ${item.label}`}
                    </button>
                  </section>
                ))}
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: mustConnectReady ? "1px solid rgba(34,197,94,.22)" : "1px solid rgba(245,158,11,.22)",
                  background: mustConnectReady ? "rgba(34,197,94,.08)" : "rgba(245,158,11,.10)",
                  padding: 16,
                  color: mustConnectReady ? "#166534" : "#92400e",
                  fontWeight: 900,
                }}
              >
                {mustConnectReady
                  ? "LinkedIn and Discord are connected. The portal will unlock automatically."
                  : "Finish LinkedIn and Discord to continue. Jira can stay unconnected if you want to handle it later."}
              </div>
            </section>
          )}
        </div>

        <div
          style={{
            padding: "0 24px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setStep((prev) => (prev > 1 ? ((prev - 1) as GateStep) : prev))}
            disabled={step === 1}
            style={secondaryButton(step === 1)}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>arrow_back</i>
            Back
          </button>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {step === 1 && (
              <button type="button" onClick={() => setStep(2)} style={primaryButton(false)}>
                Next
                <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
              </button>
            )}

            {step === 2 && (
              <button type="button" onClick={() => setStep(3)} disabled={!agreementReady} style={primaryButton(!agreementReady)}>
                Agree and continue
                <i className="material-icons" style={{ fontSize: 18 }}>task_alt</i>
              </button>
            )}

            {step === 3 && (
              <button type="button" disabled={!mustConnectReady} style={primaryButton(!mustConnectReady)}>
                {mustConnectReady ? "Portal unlocking..." : "Waiting for required connections"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
