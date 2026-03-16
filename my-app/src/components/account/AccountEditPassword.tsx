// src/components/account/AccountEditPassword.tsx
import { useMemo, useState } from "react";

declare const M: any;

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function strengthLabel(pw: string) {
  const s = pw || "";
  let score = 0;
  if (s.length >= 8) score++;
  if (s.length >= 12) score++;
  if (/[A-Z]/.test(s)) score++;
  if (/[a-z]/.test(s)) score++;
  if (/[0-9]/.test(s)) score++;
  if (/[^A-Za-z0-9]/.test(s)) score++;
  const pct = Math.min(100, Math.round((score / 6) * 100));

  let label = "Weak";
  if (pct >= 80) label = "Strong";
  else if (pct >= 55) label = "Good";
  else if (pct >= 35) label = "Ok";
  return { pct, label };
}

function Pill({
  icon,
  text,
  tone = "neutral",
}: {
  icon: string;
  text: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "grey";
}) {
  return (
    <span className={"accPill " + tone}>
      <i className="material-icons">{icon}</i>
      {text}
    </span>
  );
}

function SmallAction({
  icon,
  text,
  onClick,
  disabled,
  subtle,
}: {
  icon: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      className={"accBtn" + (subtle ? " subtle" : "")}
      onClick={onClick}
      disabled={!!disabled}
    >
      <i className="material-icons">{icon}</i>
      <span>{text}</span>
    </button>
  );
}

export default function AccountEditPassword({
  user,
  api,
}: {
  user: any;
  api: any;
}) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pulse, setPulse] = useState(false);

  const username = safeStr(user?.username);
  const pwStrength = useMemo(() => strengthLabel(pw1), [pw1]);
  const pwMatch = pw1 && pw2 ? pw1 === pw2 : true;

  async function savePassword() {
    if (!pw1 || pw1.length < 8) {
      M.toast({ html: "Password must be at least 8 characters.", classes: "red" });
      return;
    }
    if (pw1 !== pw2) {
      M.toast({ html: "Passwords do not match.", classes: "red" });
      return;
    }

    setSavingPw(true);
    try {
      await api.updateUser({ username, password: pw1 } as any);
      setPw1("");
      setPw2("");
      setShowPw(false);
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
      M.toast({ html: "Password updated.", classes: "green" });
    } catch (err: any) {
      M.toast({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <>
      <style>{`
        .panelCard{ border-radius: 20px; overflow: hidden; border: 1px solid #e6edf2; }
        .panelHead{
          padding: 14px 16px;
          border-bottom: 1px solid #eceff1;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
        }
        .panelHead .h{ font-weight: 1000; color: #0f172a; font-size: 14.5px; }
        .panelHead .p{ margin-top: 2px; color:#607d8b; font-size: 12px; }

        .accPill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          font-size: 11px;
          letter-spacing: .6px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .accPill i{ font-size: 16px; opacity: .95; }
        .accPill.blue{ background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.22); color:#1d4ed8; }
        .accPill.green{ background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.20); color:#166534; }

        .accBtn{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.35);
          background: #0b2544;
          color: white;
          font-weight: 900;
          cursor: pointer;
          transition: transform 120ms ease, opacity 120ms ease;
          white-space: nowrap;
        }
        .accBtn i{ font-size: 18px; }
        .accBtn:hover{ transform: translateY(-1px); }
        .accBtn:disabled{ opacity: .55; cursor: not-allowed; transform:none; }
        .accBtn.subtle{
          background: #ffffff;
          color: #0f172a;
          border-color: #e6edf2;
        }

        .pulseGreen{ animation: pulseGlow 900ms ease both; }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 rgba(34,197,94,0); }
          45% { box-shadow: 0 0 0 6px rgba(34,197,94,0.12); }
          100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        .accStrength {
          height: 8px; border-radius: 999px; overflow: hidden;
          background: #eef2f7; border: 1px solid #e6edf2;
        }
        .accStrength > div {
          height:100%;
          width: var(--w);
          background: linear-gradient(90deg, rgba(239,68,68,0.85), rgba(245,158,11,0.85), rgba(34,197,94,0.85));
          transition: width 160ms ease;
        }

        .accordionBar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid #e6edf2;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
        }
        .accordionTitle{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width:0;
        }
        .accordionTitle i{ color:#0f172a; opacity:.9; }
        .accordionTitle .t{
          font-weight: 1000;
          color:#0f172a;
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .accordionTitle .s{
          margin-top: 2px;
          color:#607d8b;
          font-size: 12px;
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .accordionBody{
          margin-top: 10px;
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fbfdff;
          padding: 12px;
        }

        .input-field { margin: 0.2rem 0 0.6rem !important; }
        input:focus { box-shadow: none !important; }
      `}</style>

      <div className={`card z-depth-1 panelCard ${pulse ? "pulseGreen" : ""}`}>
        <div className="panelHead">
          <div>
            <div className="h">Password</div>
            <div className="p">Set a new password for your account.</div>
          </div>
          <Pill icon="verified_user" text="Security" tone="blue" />
        </div>

        <div className="card-content" style={{ padding: 16 }}>
          <div className="accordionBar">
            <div className="accordionTitle">
              <i className="material-icons">lock</i>
              <div style={{ minWidth: 0 }}>
                <div className="t">Change password</div>
                <div className="s">Use a strong password with mixed characters.</div>
              </div>
            </div>

            <Pill icon="shield" text="Best Practice" tone="green" />
          </div>

          <div className="accordionBody" style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m6">
                <input
                  id="pw1"
                  type={showPw ? "text" : "password"}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  minLength={8}
                  required
                />
                <label htmlFor="pw1" className={pw1 ? "active" : ""}>
                  New password
                </label>

                <div style={{ marginTop: 10 }}>
                  <div className="accStrength" style={{ ["--w" as any]: `${pwStrength.pct}%` }}>
                    <div />
                  </div>
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>
                      Strength: <span style={{ color: "#0f172a" }}>{pwStrength.label}</span>
                    </span>
                    <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 900 }}>
                      {pw1.length}/12+
                    </span>
                  </div>
                </div>
              </div>

              <div className="input-field col s12 m6">
                <input
                  id="pw2"
                  type={showPw ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  minLength={8}
                  required
                />
                <label htmlFor="pw2" className={pw2 ? "active" : ""}>
                  Confirm password
                </label>

                {!pwMatch ? (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                    Passwords do not match.
                  </div>
                ) : null}
              </div>

              <div className="col s12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={showPw}
                    onChange={(e) => setShowPw(e.target.checked)}
                  />
                  <span>Show password</span>
                </label>
                <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>
                  Tip: 3 words + symbols works well
                </span>
              </div>

              <div className="col s12" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                <SmallAction
                  icon="restart_alt"
                  text="Reset"
                  subtle
                  onClick={() => {
                    setPw1("");
                    setPw2("");
                    setShowPw(false);
                  }}
                  disabled={savingPw}
                />
                <SmallAction
                  icon="save"
                  text={savingPw ? "Updating…" : "Save Password"}
                  onClick={savePassword}
                  disabled={savingPw}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}