import { useState } from "react";
import AccountEditPassword from "../account/AccountEditPassword";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type Props = {
  api: any;
  user: any;
  tempPassword?: string;
  onSaved: () => void | Promise<void>;
};

export default function PasswordResetStep({ api, user, tempPassword, onSaved }: Props) {
  const [showTempPassword, setShowTempPassword] = useState(false);
  const loginName = safeStr((user as any)?.employee_email) || safeStr((user as any)?.username);
  const canRevealTempPassword = Boolean(safeStr(tempPassword));

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
        Reset your password
      </div>
      <div style={{ color: "#475569", lineHeight: 1.7, maxWidth: 760 }}>
        Use the temporary password from your welcome email to sign in here once, then set a new permanent password before you continue.
      </div>

      <div
        style={{
          borderRadius: 24,
          border: "1px solid rgba(37,99,235,.16)",
          background: "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(239,246,255,.92) 100%)",
          boxShadow: "0 18px 40px rgba(15,23,42,.10)",
          padding: 18,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: "rgba(37,99,235,.10)",
              color: "#1d4ed8",
              border: "1px solid rgba(37,99,235,.18)",
              fontWeight: 900,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            <i className="material-icons" style={{ fontSize: 16 }}>badge</i>
            Login details
          </div>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
            The temporary password only exists in memory for this session.
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,.18)",
              background: "#fff",
              padding: 14,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>
              <i className="material-icons" style={{ fontSize: 16 }}>alternate_email</i>
              Login
            </div>
            <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 900, wordBreak: "break-word" }}>{loginName || "Unknown"}</div>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,.18)",
              background: "#fff",
              padding: 14,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>
              <i className="material-icons" style={{ fontSize: 16 }}>person</i>
              Username
            </div>
            <div style={{ marginTop: 8, color: "#0f172a", fontWeight: 900, wordBreak: "break-word" }}>{safeStr((user as any)?.username) || "Unknown"}</div>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,.18)",
              background: "#fff",
              padding: 14,
              minWidth: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#64748b", fontWeight: 900, fontSize: 12, textTransform: "uppercase" }}>
              <i className="material-icons" style={{ fontSize: 16 }}>vpn_key</i>
              Temporary password
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div
                style={{
                  flex: "1 1 auto",
                  minWidth: 0,
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,.18)",
                  background: "#f8fafc",
                  padding: "10px 12px",
                  color: "#0f172a",
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 900,
                  letterSpacing: ".02em",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {canRevealTempPassword ? (showTempPassword ? tempPassword : "••••••••••••") : "Hidden after first use"}
              </div>
              <button
                type="button"
                disabled={!canRevealTempPassword}
                onClick={() => setShowTempPassword((v) => !v)}
                title={canRevealTempPassword ? (showTempPassword ? "Hide password" : "Show password") : "Temporary password is not available in this session"}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: "1px solid rgba(148,163,184,.18)",
                  background: canRevealTempPassword ? "#fff" : "rgba(148,163,184,.10)",
                  color: canRevealTempPassword ? "#0f172a" : "#94a3b8",
                  display: "inline-grid",
                  placeItems: "center",
                  cursor: canRevealTempPassword ? "pointer" : "not-allowed",
                  flex: "0 0 auto",
                }}
              >
                <i className="material-icons" style={{ fontSize: 20 }}>
                  {canRevealTempPassword ? (showTempPassword ? "visibility_off" : "visibility") : "visibility_off"}
                </i>
              </button>
            </div>
            {!canRevealTempPassword ? (
              <div style={{ marginTop: 8, color: "#64748b", fontSize: 12, fontWeight: 800, lineHeight: 1.5 }}>
                The temporary password is only shown once in the login session that used it.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <AccountEditPassword api={api} user={user} onSaved={onSaved} />
    </section>
  );
}
