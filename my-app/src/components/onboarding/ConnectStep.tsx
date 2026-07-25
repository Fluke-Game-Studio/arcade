import type { ConnectRequirement } from "./types";

type Props = {
  requirements: ConnectRequirement[];
  onConnect: (key: ConnectRequirement["key"]) => void;
  onBack?: () => void;
  onContinue: () => void;
  canContinue: boolean;
};

export default function ConnectStep({ requirements, onConnect, onBack, onContinue, canContinue }: Props) {
  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
        Connect your workflow accounts
      </div>
      <div style={{ marginTop: -6, color: "#475569", lineHeight: 1.7 }}>
        LinkedIn, Discord, and Jira are required before we unlock the portal.
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
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    border: item.connected
                      ? "1px solid rgba(34,197,94,.26)"
                      : item.optional
                        ? "1px solid rgba(148,163,184,.26)"
                        : "1px solid rgba(245,158,11,.24)",
                    background: item.connected
                      ? "rgba(34,197,94,.12)"
                      : item.optional
                        ? "rgba(148,163,184,.10)"
                        : "rgba(245,158,11,.10)",
                    color: item.connected ? "#166534" : item.optional ? "#475569" : "#b45309",
                  }}
                >
                  {item.connected ? "Connected" : item.optional ? "Optional" : "Required"}
                </span>
              </div>
              <div style={{ color: "#64748b", fontWeight: 700, lineHeight: 1.5 }}>{item.subtitle}</div>
            </div>

            <button
              type="button"
              disabled={item.connected}
              onClick={() => onConnect(item.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                minHeight: 48,
                borderRadius: 16,
                border: "1px solid rgba(148,163,184,.22)",
                background: item.connected ? "rgba(248,250,252,.55)" : "#fff",
                color: item.connected ? "#cbd5e1" : "#0f172a",
                padding: "12px 18px",
                fontWeight: 900,
                cursor: item.connected ? "not-allowed" : "pointer",
              }}
            >
              <i className="material-icons" style={{ fontSize: 18 }}>
                {item.connected ? "check" : item.icon}
              </i>
              {item.connected ? `${item.label} connected` : `Connect ${item.label}`}
            </button>
          </section>
        ))}
      </div>

      <div style={{ borderRadius: 18, border: canContinue ? "1px solid rgba(34,197,94,.22)" : "1px solid rgba(245,158,11,.22)", background: canContinue ? "rgba(34,197,94,.08)" : "rgba(245,158,11,.10)", padding: 16, color: canContinue ? "#166534" : "#92400e", fontWeight: 900 }}>
        {canContinue
          ? "LinkedIn, Discord, and Jira are connected. Continue to enter the portal."
          : "Finish LinkedIn, Discord, and Jira to continue."}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,.22)",
            background: onBack ? "#fff" : "rgba(148,163,184,.12)",
            color: onBack ? "#0f172a" : "#94a3b8",
            padding: "12px 18px",
            fontWeight: 900,
            cursor: onBack ? "pointer" : "not-allowed",
          }}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>arrow_back</i>
          Back
        </button>

        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            borderRadius: 16,
            border: "1px solid rgba(37,99,235,.18)",
            background: canContinue ? "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)" : "rgba(148,163,184,.16)",
            color: canContinue ? "#fff" : "#94a3b8",
            padding: "12px 18px",
            fontWeight: 900,
            cursor: canContinue ? "pointer" : "not-allowed",
            boxShadow: canContinue ? "0 16px 34px rgba(37,99,235,.18)" : "none",
          }}
        >
          Continue
          <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
        </button>
      </div>
    </section>
  );
}
