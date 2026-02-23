// src/pages/Account.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";

declare const M: any;

// ---------------------------
// Helpers
// ---------------------------
function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
}

function isHttpUrl(s: string) {
  const t = safeStr(s);
  return /^https?:\/\/.+/i.test(t);
}

function fmtMaybeDate(v: any) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }
  const d2 = new Date(`${s}T00:00:00`);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }
  return s;
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

type EditableKey = "employee_profilepicture" | "employee_phonenumber" | "employee_dob" | "employee_address" | "location";

// ---------------------------
// Stylish info tiles
// ---------------------------
function InfoTile({
  icon,
  label,
  value,
  muted,
  mono,
  right,
}: {
  icon: string;
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
  right?: React.ReactNode;
}) {
  const isEmpty = !value || value === "—";
  return (
    <div className={"accTile" + (muted ? " muted" : "")}>
      <div className="accTileLeft">
        <div className="accTileIcon">
          <i className="material-icons">{icon}</i>
        </div>
        <div className="accTileText">
          <div className="accTileLabel">{label}</div>
          <div className={"accTileValue" + (mono ? " mono" : "") + (isEmpty ? " dim" : "")} title={value}>
            {value || "—"}
          </div>
        </div>
      </div>
      <div className="accTileRight">{right}</div>
    </div>
  );
}

function SmallAction({
  icon,
  text,
  onClick,
  disabled,
  subtle,
  title,
}: {
  icon: string;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  subtle?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={"accBtn" + (subtle ? " subtle" : "")}
      onClick={onClick}
      disabled={!!disabled}
      title={title}
    >
      <i className="material-icons">{icon}</i>
      <span>{text}</span>
    </button>
  );
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

export default function Account() {
  const { user, api } = useAuth();

  const [me, setMe] = useState<ApiUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Editable values
  const [pic, setPic] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [address, setAddress] = useState("");

  // Edit mode per tile (no more always-open input fields)
  const [editing, setEditing] = useState<Record<EditableKey, boolean>>({
    employee_profilepicture: false,
    employee_phonenumber: false,
    employee_dob: false,
    employee_address: false,
    location: false,
  });

  // password panel expand
  const [pwExpanded, setPwExpanded] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pulse, setPulse] = useState<"" | "profile" | "pw">("");

  const [picError, setPicError] = useState(false);

  useEffect(() => {
    if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingMe(true);
        const mine = await api.getMe();
        if (!mounted) return;

        setMe(mine);
        setPic(safeStr((mine as any).employee_profilepicture));
        setPhone(safeStr((mine as any).employee_phonenumber));
        setLocation(safeStr((mine as any).location));
        setDob(safeStr((mine as any).employee_dob));
        setAddress(safeStr((mine as any).employee_address));
        setPicError(false);

        if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
      } catch {
        if (typeof M !== "undefined") M.toast({ html: "Failed to load your account.", classes: "red" });
      } finally {
        if (mounted) setLoadingMe(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  if (!user) return null;

  // Base displayed identity
  const username = safeStr((me as any)?.username) || safeStr(user.username) || "—";
  const displayName = safeStr(me?.employee_name) || username || "—";
  const email = safeStr((me as any)?.employee_email) || username || "—";
  const role = (safeStr((me as any)?.employee_role) || "employee").toUpperCase();
  const title = safeStr((me as any)?.employee_title) || "—";

  const dept = safeStr((me as any)?.department) || "—";
  const employmentType = safeStr((me as any)?.employment_type) || "—";
  const employeeId = safeStr((me as any)?.employee_id) || "—";
  const started = fmtMaybeDate((me as any)?.employee_date_started);
  const createdAt = fmtMaybeDate((me as any)?.createdAt);
  const updatedAt = fmtMaybeDate((me as any)?.updatedAt);

  const avatarFallback = useMemo(() => initials(displayName), [displayName]);

  // Password UI logic
  const pwStrength = useMemo(() => strengthLabel(pw1), [pw1]);
  const pwMatch = pw1 && pw2 ? pw1 === pw2 : true;

  function setEdit(k: EditableKey, v: boolean) {
    setEditing((m) => ({ ...m, [k]: v }));
    if (!v) {
      // collapse without saving -> revert to server value
      if (!me) return;
      if (k === "employee_profilepicture") setPic(safeStr((me as any).employee_profilepicture));
      if (k === "employee_phonenumber") setPhone(safeStr((me as any).employee_phonenumber));
      if (k === "location") setLocation(safeStr((me as any).location));
      if (k === "employee_dob") setDob(safeStr((me as any).employee_dob));
      if (k === "employee_address") setAddress(safeStr((me as any).employee_address));
      setPicError(false);
    }
  }

  async function saveOne(k: EditableKey) {
    if (!me) return;

    // simple validation
    if (k === "employee_dob") {
      const d = safeStr(dob);
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        M.toast({ html: "DOB must be YYYY-MM-DD (e.g., 1998-05-10).", classes: "red" });
        return;
      }
    }
    if (k === "employee_profilepicture") {
      const p = safeStr(pic);
      if (p && !isHttpUrl(p)) {
        M.toast({ html: "Profile picture must be a full http(s) URL.", classes: "red" });
        return;
      }
    }

    setSavingProfile(true);
    try {
      const patch: any = { username };
      if (k === "employee_profilepicture") patch.employee_profilepicture = pic || undefined;
      if (k === "employee_phonenumber") patch.employee_phonenumber = phone || undefined;
      if (k === "location") patch.location = location || undefined;
      if (k === "employee_dob") patch.employee_dob = dob || undefined;
      if (k === "employee_address") patch.employee_address = address || undefined;

      await api.updateUser(patch);

      // refresh me
      try {
        const mine = await api.getMe();
        setMe(mine);
      } catch {}

      setEdit(k, false);
      setPulse("profile");
      setTimeout(() => setPulse(""), 900);
      M.toast({ html: "Saved.", classes: "green" });
    } catch (err: any) {
      M.toast({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setSavingProfile(false);
    }
  }

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
      setPwExpanded(false);
      setPulse("pw");
      setTimeout(() => setPulse(""), 900);
      M.toast({ html: "Password updated.", classes: "green" });
    } catch (err: any) {
      M.toast({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <main className="container" style={{ paddingTop: 22, maxWidth: 1080 }}>
      <style>{`
        /* Page shell */
        .accWrap { animation: accIn 260ms ease both; }
        @keyframes accIn { from { opacity: 0; transform: translateY(8px);} to { opacity:1; transform: translateY(0);} }

        /* Hero */
        .accHero {
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.22);
          background:
            radial-gradient(900px 520px at 18% -30%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(800px 520px at 105% 10%, rgba(99,102,241,0.18), transparent 55%),
            linear-gradient(180deg, #0b2544 0%, #071a33 100%);
          box-shadow: 0 22px 70px rgba(0,0,0,0.26);
          position: relative;
        }
        .accHero::after{
          content:"";
          position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transform: translateX(-60%);
          animation: accShimmer 4.4s ease-in-out infinite;
          opacity: .35;
          pointer-events:none;
        }
        @keyframes accShimmer {
          0% { transform: translateX(-60%); }
          45% { transform: translateX(60%); }
          100% { transform: translateX(60%); }
        }
        .accHeroInner{
          padding: 16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          color: white;
        }

        .accMiniProfile{
          display:flex;
          align-items:center;
          gap: 14px;
          min-width: 0;
        }

        .accAvatar{
          width: 92px; height: 92px;
          border-radius: 26px;
          overflow:hidden;
          border: 2px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.10);
          box-shadow: 0 16px 28px rgba(0,0,0,0.22);
          display:grid;
          place-items:center;
          font-weight: 900;
          letter-spacing: .6px;
          position: relative;
          flex: 0 0 auto;
        }
        .accAvatar img{ width:100%; height:100%; object-fit:cover; display:block; }
        .accDot{
          position:absolute;
          right: 10px; bottom: 10px;
          width: 12px; height: 12px;
          border-radius: 999px;
          background:#22c55e;
          border: 2px solid rgba(7,26,51,0.92);
        }

        .accTitle{
          font-weight: 1000;
          font-size: 18px;
          line-height: 22px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .accSub{
          margin-top: 4px;
          color: rgba(226,232,240,0.82);
          font-size: 12.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .accPills{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content:flex-end;
        }
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
        .accPill.grey{ background: rgba(255,255,255,0.07); }
        .accPill.blue{ background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.22); }
        .accPill.green{ background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.20); }
        .accPill.amber{ background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.18); }

        /* Section cards */
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

        .pulseGreen{ animation: pulseGlow 900ms ease both; }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 rgba(34,197,94,0); }
          45% { box-shadow: 0 0 0 6px rgba(34,197,94,0.12); }
          100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        /* Tiles grid */
        .tileGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 12px;
        }
        @media (max-width: 800px){
          .tileGrid{ grid-template-columns: 1fr; }
        }

        .accTile{
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fff;
          padding: 12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
          transform: translateZ(0);
        }
        .accTile.muted{
          background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
          border-style: dashed;
          opacity: .92;
        }
        .accTileLeft{
          display:flex;
          align-items:center;
          gap: 12px;
          min-width: 0;
        }
        .accTileIcon{
          width: 44px; height: 44px;
          border-radius: 16px;
          display:grid;
          place-items:center;
          background: #f1f5f9;
          border: 1px solid #e6edf2;
          flex: 0 0 auto;
        }
        .accTileIcon i{ font-size: 19px; color:#0f172a; opacity:.9; }
        .accTileText{ min-width: 0; }
        .accTileLabel{
          font-size: 10.5px;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
          font-weight: 900;
        }
        .accTileValue{
          margin-top: 3px;
          font-size: 13.2px;
          color:#0f172a;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .accTileValue.dim{ color:#94a3b8; }
        .accTileValue.mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12.4px;
        }

        /* Buttons */
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

        /* Inline edit panel */
        .editPanel{
          margin-top: 10px;
          border-radius: 16px;
          border: 1px solid #e6edf2;
          background: #fbfdff;
          padding: 12px;
          display:flex;
          gap: 10px;
          align-items:center;
          justify-content:space-between;
        }
        .editPanel .left{ flex: 1 1 auto; min-width:0; }
        .editPanel input{
          margin:0 !important;
          height: 2.65rem !important;
        }
        .editActions{
          display:flex;
          gap: 8px;
          align-items:center;
          flex-wrap: wrap;
          justify-content:flex-end;
        }

        /* Password strength */
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

        /* Accordion card */
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

        /* Make Materialize inputs behave inside custom boxes */
        .input-field { margin: 0.2rem 0 0.6rem !important; }
        input:focus { box-shadow: none !important; }
      `}</style>

      <div className="accWrap">
        {/* HERO */}
        <div className="accHero" style={{ marginBottom: 14 }}>
          <div className="accHeroInner">
            <div className="accMiniProfile">
              <div className="accAvatar" title={displayName}>
                {isHttpUrl(pic) && !picError ? (
                  <img src={pic} alt="profile" onError={() => setPicError(true)} />
                ) : (
                  <span style={{ fontSize: 22 }}>{avatarFallback}</span>
                )}
                <span className="accDot" title="Active" />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="accTitle" title={displayName}>{displayName}</div>
                <div className="accSub" title={email}>{email}</div>
                <div className="accSub" title={title !== "—" ? title : ""}>{title !== "—" ? title : " "}</div>
              </div>
            </div>

            <div className="accPills">
              <Pill icon="verified" text={role} tone="blue" />
              <Pill icon="apartment" text={dept !== "—" ? dept : "Department"} tone="grey" />
              <Pill icon="work_outline" text={employmentType !== "—" ? employmentType : "Employment"} tone="amber" />
            </div>
          </div>
        </div>

        {/* PROFILE */}
        <div className={`card z-depth-1 panelCard ${pulse === "profile" ? "pulseGreen" : ""}`}>
          <div className="panelHead">
            <div>
              <div className="h">Profile & Personal</div>
              <div className="p">Everything is a card. Editable ones open an inline editor.</div>
            </div>
            <Pill icon="badge" text="Self Service" tone="green" />
          </div>

          <div className="card-content" style={{ padding: 16 }}>
            {loadingMe ? (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #e6edf2", background: "#fbfdff", color: "#607d8b", fontWeight: 900 }}>
                Loading…
              </div>
            ) : (
              <>
                <div className="tileGrid">
                  {/* Editable: DP */}
                  <div>
                    <InfoTile
                      icon="image"
                      label="Profile Picture (DP)"
                      value={pic ? (isHttpUrl(pic) ? "Linked image URL" : pic) : "—"}
                      right={
                        editing.employee_profilepicture ? (
                          <Pill icon="edit" text="Editing" tone="amber" />
                        ) : (
                          <SmallAction
                            icon="edit"
                            text="Edit"
                            onClick={() => setEdit("employee_profilepicture", true)}
                            disabled={savingProfile}
                          />
                        )
                      }
                    />
                    {editing.employee_profilepicture && (
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_pic"
                              value={pic}
                              onChange={(e) => {
                                setPic(e.target.value);
                                setPicError(false);
                              }}
                              placeholder="https://…"
                            />
                            <label htmlFor="edit_pic" className={pic ? "active" : ""}>Image URL</label>
                          </div>
                          <div style={{ fontSize: 12, color: pic && !isHttpUrl(pic) ? "#b45309" : "#94a3b8", fontWeight: 800 }}>
                            {pic ? (isHttpUrl(pic) ? "Looks valid." : "Must be http(s) URL.") : "Optional"}
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("employee_profilepicture", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("employee_profilepicture")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable: Phone */}
                  <div>
                    <InfoTile
                      icon="call"
                      label="Phone"
                      value={phone || "—"}
                      right={
                        editing.employee_phonenumber ? (
                          <Pill icon="edit" text="Editing" tone="amber" />
                        ) : (
                          <SmallAction icon="edit" text="Edit" onClick={() => setEdit("employee_phonenumber", true)} disabled={savingProfile} />
                        )
                      }
                    />
                    {editing.employee_phonenumber && (
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input id="edit_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                            <label htmlFor="edit_phone" className={phone ? "active" : ""}>Phone</label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction icon="close" text="Cancel" subtle onClick={() => setEdit("employee_phonenumber", false)} disabled={savingProfile} />
                          <SmallAction icon="save" text={savingProfile ? "Saving…" : "Save"} onClick={() => saveOne("employee_phonenumber")} disabled={savingProfile} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable: DOB */}
                  <div>
                    <InfoTile
                      icon="event"
                      label="Date of Birth"
                      value={dob ? fmtMaybeDate(dob) : "—"}
                      right={
                        editing.employee_dob ? (
                          <Pill icon="edit" text="Editing" tone="amber" />
                        ) : (
                          <SmallAction icon="edit" text="Edit" onClick={() => setEdit("employee_dob", true)} disabled={savingProfile} />
                        )
                      }
                    />
                    {editing.employee_dob && (
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input id="edit_dob" value={dob} onChange={(e) => setDob(e.target.value)} placeholder="YYYY-MM-DD" />
                            <label htmlFor="edit_dob" className={dob ? "active" : ""}>DOB (YYYY-MM-DD)</label>
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>
                            Example: 1998-05-10
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction icon="close" text="Cancel" subtle onClick={() => setEdit("employee_dob", false)} disabled={savingProfile} />
                          <SmallAction icon="save" text={savingProfile ? "Saving…" : "Save"} onClick={() => saveOne("employee_dob")} disabled={savingProfile} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable: Address */}
                  <div>
                    <InfoTile
                      icon="home"
                      label="Address"
                      value={address || "—"}
                      right={
                        editing.employee_address ? (
                          <Pill icon="edit" text="Editing" tone="amber" />
                        ) : (
                          <SmallAction icon="edit" text="Edit" onClick={() => setEdit("employee_address", true)} disabled={savingProfile} />
                        )
                      }
                    />
                    {editing.employee_address && (
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input id="edit_address" value={address} onChange={(e) => setAddress(e.target.value)} />
                            <label htmlFor="edit_address" className={address ? "active" : ""}>Address</label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction icon="close" text="Cancel" subtle onClick={() => setEdit("employee_address", false)} disabled={savingProfile} />
                          <SmallAction icon="save" text={savingProfile ? "Saving…" : "Save"} onClick={() => saveOne("employee_address")} disabled={savingProfile} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Editable: Location */}
                  <div>
                    <InfoTile
                      icon="location_on"
                      label="Location"
                      value={location || "—"}
                      right={
                        editing.location ? (
                          <Pill icon="edit" text="Editing" tone="amber" />
                        ) : (
                          <SmallAction icon="edit" text="Edit" onClick={() => setEdit("location", true)} disabled={savingProfile} />
                        )
                      }
                    />
                    {editing.location && (
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input id="edit_location" value={location} onChange={(e) => setLocation(e.target.value)} />
                            <label htmlFor="edit_location" className={location ? "active" : ""}>Location</label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction icon="close" text="Cancel" subtle onClick={() => setEdit("location", false)} disabled={savingProfile} />
                          <SmallAction icon="save" text={savingProfile ? "Saving…" : "Save"} onClick={() => saveOne("location")} disabled={savingProfile} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Locked: Email */}
                  <InfoTile
                    icon="alternate_email"
                    label="Email (Locked)"
                    value={email || "—"}
                    muted
                    mono
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />

                  {/* Locked: Username */}
                  <InfoTile
                    icon="person"
                    label="Username (Locked)"
                    value={username || "—"}
                    muted
                    mono
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />

                  {/* Locked: Employee ID */}
                  <InfoTile
                    icon="badge"
                    label="Employee ID (Locked)"
                    value={employeeId || "—"}
                    muted
                    mono
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />

                  {/* Locked: Started */}
                  <InfoTile
                    icon="event_available"
                    label="Start Date (Locked)"
                    value={started}
                    muted
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />

                  {/* Locked: Created/Updated */}
                  <InfoTile
                    icon="schedule"
                    label="Created (Locked)"
                    value={createdAt}
                    muted
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />
                  <InfoTile
                    icon="update"
                    label="Updated (Locked)"
                    value={updatedAt}
                    muted
                    right={<Pill icon="lock" text="Locked" tone="grey" />}
                  />
                </div>

                {/* Tiny note */}
                <div style={{ marginTop: 12, fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                  Locked fields are visible for transparency but can’t be edited from your account.
                </div>
              </>
            )}
          </div>
        </div>

        {/* PASSWORD (accordion) */}
        <div className={`card z-depth-1 panelCard ${pulse === "pw" ? "pulseGreen" : ""}`} style={{ marginTop: 14 }}>
          <div className="panelHead">
            <div>
              <div className="h">Password</div>
              <div className="p">Collapsed by default. Expand to set a new password.</div>
            </div>
            <Pill icon="verified_user" text="Security" tone="blue" />
          </div>

          <div className="card-content" style={{ padding: 16 }}>
            <div className="accordionBar">
              <div className="accordionTitle">
                <i className="material-icons">lock</i>
                <div style={{ minWidth: 0 }}>
                  <div className="t">Change password</div>
                  <div className="s">Expand to enter new password + confirm.</div>
                </div>
              </div>

              <SmallAction
                icon={pwExpanded ? "expand_less" : "expand_more"}
                text={pwExpanded ? "Collapse" : "Edit Password"}
                onClick={() => {
                  setPwExpanded((v) => !v);
                  if (!pwExpanded) {
                    setPw1("");
                    setPw2("");
                  }
                }}
                disabled={savingPw}
                title={pwExpanded ? "Hide password editor" : "Open password editor"}
              />
            </div>

            {pwExpanded && (
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
                    <label htmlFor="pw1" className={pw1 ? "active" : ""}>New password</label>

                    <div style={{ marginTop: 10 }}>
                      <div className="accStrength" style={{ ["--w" as any]: `${pwStrength.pct}%` }}>
                        <div />
                      </div>
                      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>
                          Strength: <span style={{ color: "#0f172a" }}>{pwStrength.label}</span>
                        </span>
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 900 }}>{pw1.length}/12+</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirm only shown when expanded (your request) */}
                  <div className="input-field col s12 m6">
                    <input
                      id="pw2"
                      type={showPw ? "text" : "password"}
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      minLength={8}
                      required
                    />
                    <label htmlFor="pw2" className={pw2 ? "active" : ""}>Confirm password</label>

                    {!pwMatch ? (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                        Passwords do not match.
                      </div>
                    ) : null}
                  </div>

                  <div className="col s12" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <label>
                      <input type="checkbox" className="filled-in" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
                      <span>Show password</span>
                    </label>
                    <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>
                      Tip: 3 words + symbols is 🔥
                    </span>
                  </div>

                  <div className="col s12" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                    <SmallAction
                      icon="close"
                      text="Cancel"
                      subtle
                      onClick={() => {
                        setPwExpanded(false);
                        setPw1("");
                        setPw2("");
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
            )}

            {!pwExpanded && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                Password editor is hidden until you click <b>Edit Password</b>.
              </div>
            )}
          </div>
        </div>

        {/* Small footer tip */}
        <div
          className="card grey lighten-5 z-depth-0 panelCard"
          style={{ marginTop: 14, border: "1px solid #e6edf2" }}
        >
          <div className="card-content" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 1000, fontSize: 14.5, color: "#0f172a" }}>Security tips</div>
                <div style={{ fontSize: 12, color: "#607d8b", marginTop: 2 }}>
                  Small habits, big payoff.
                </div>
              </div>
              <Pill icon="shield" text="Best practice" tone="green" />
            </div>

            <ul className="browser-default" style={{ marginTop: 10, color: "#455a64" }}>
              <li>Use 12+ characters, mix of words, numbers, and symbols.</li>
              <li>Don’t reuse passwords from other services.</li>
              <li>Consider a password manager.</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}