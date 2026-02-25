import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";

declare const M: any;

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

function clampStr(v: any, max = 42) {
  const s = safeStr(v);
  if (!s) return "—";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export default function ProfileCard() {
  const { api } = useAuth();
  const [me, setMe] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const mine = await api.getMe();
        if (mounted) setMe(mine);
      } catch {
        if (typeof M !== "undefined") M.toast({ html: "Failed to load profile.", classes: "red" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api]);

  const displayName = safeStr(me?.employee_name) || safeStr(me?.username) || "—";
  const email = safeStr(me?.employee_email) || "—";
  const title = safeStr(me?.employee_title) || "—";
  const role = (safeStr(me?.employee_role) || "employee").toUpperCase();

  const dept = safeStr(me?.department) || "—";
  const empType = safeStr(me?.employment_type) || "—";
  const location = safeStr(me?.location) || "—";
  const phone = safeStr(me?.employee_phonenumber) || "—";
  const username = safeStr(me?.username) || "—";

  const avatarUrl = safeStr(me?.employee_profilepicture);
  const hasAvatar = !!avatarUrl;

  const avatarFallback = useMemo(
    () => initials(displayName !== "—" ? displayName : safeStr(me?.username)),
    [displayName, me?.username]
  );

  return (
    <aside className="fgx-wrap" aria-label="Profile">
      <style>{`
        /* -------------------- Guardrails -------------------- */
        .fgx-wrap, .fgx-card, .fgx-head, .fgx-reveal, .fgx-revealInner {
          box-sizing: border-box;
          max-width: 100%;
          min-width: 0;
        }
        .fgx-wrap{ position: sticky; top: 16px; width: 100%; }

        /* -------------------- Card Shell -------------------- */
        .fgx-card{
          width: 100%;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.10);
          background:
            radial-gradient(900px 520px at 18% -30%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(800px 520px at 105% 10%, rgba(99,102,241,0.18), transparent 55%),
            linear-gradient(180deg, #0b2544 0%, #071a33 100%);
          box-shadow: 0 22px 70px rgba(0,0,0,0.34);
        }

        /*
          FIX FOR "half visible avatar":
          We DO NOT float avatar outside the card anymore.
          Avatar sits INSIDE header with generous padding so it’s always fully visible.
        */
        .fgx-head{
          padding: 18px 18px 16px;
          text-align: center;
          position: relative;
        }

        /* Decorative top glow strip (cooler look) */
        .fgx-glowStrip{
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 64px;
          background:
            radial-gradient(800px 120px at 50% 0%, rgba(56,189,248,0.22), transparent 60%),
            radial-gradient(800px 120px at 20% 0%, rgba(99,102,241,0.18), transparent 60%),
            radial-gradient(800px 120px at 80% 0%, rgba(14,165,233,0.16), transparent 60%);
          pointer-events: none;
        }

        /* -------------------- Avatar (BIGGER + centered) -------------------- */
        .fgx-avatarWrap{
          display: grid;
          place-items: center;
          margin-top: 6px;
          margin-bottom: 10px;
        }

        .fgx-avatar{
          width: 132px;
          height: 132px;
          border-radius: 999px;
          position: relative;
          cursor: pointer;
          user-select: none;
          transform: translateZ(0);
        }

        .fgx-avatar::before{
          content:"";
          position:absolute;
          inset:-4px;
          border-radius:999px;
          background: linear-gradient(135deg, rgba(56,189,248,0.95), rgba(99,102,241,0.92), rgba(14,165,233,0.92));
          filter: blur(0px);
          opacity: 0.95;
        }

        .fgx-avatar::after{
          content:"";
          position:absolute;
          inset:-14px;
          border-radius:999px;
          background: conic-gradient(from 180deg, rgba(56,189,248,0.7), rgba(99,102,241,0.65), rgba(14,165,233,0.65), rgba(56,189,248,0.7));
          filter: blur(14px);
          opacity: 0.38;
          z-index: 0;
        }

        .fgx-avatarImg,
        .fgx-avatarFallback{
          position:absolute;
          inset:0;
          width: 132px;
          height: 132px;
          border-radius: 999px;
          object-fit: cover;
          border: 4px solid rgba(7,26,51,0.92);
          background: rgba(255,255,255,0.08);
          box-shadow: 0 20px 40px rgba(0,0,0,0.40);
          z-index: 1;
        }

        .fgx-avatarFallback{
          display:grid;
          place-items:center;
          font-weight: 900;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.95);
          font-size: 32px;
          background:
            radial-gradient(120px 120px at 30% 30%, rgba(56,189,248,0.26), transparent 60%),
            radial-gradient(120px 120px at 70% 70%, rgba(99,102,241,0.22), transparent 60%),
            rgba(255,255,255,0.06);
        }

        .fgx-status{
          position:absolute;
          left: 12px;
          bottom: 12px;
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #22c55e;
          border: 2px solid rgba(7,26,51,0.95);
          box-shadow: 0 10px 18px rgba(0,0,0,0.35);
          z-index: 2;
        }

        /* -------------------- Name + Meta -------------------- */
        .fgx-name{
          color: rgba(255,255,255,0.96);
          font-size: 18px;
          font-weight: 900;
          line-height: 22px;
          margin-top: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .fgx-pillRow{
          display:flex;
          justify-content:center;
          gap: 10px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .fgx-pill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          font-size: 11px;
        }
        .fgx-pill i{ font-size: 16px; opacity: 0.9; }

        .fgx-email{
          margin-top: 10px;
          display:flex;
          justify-content:center;
          align-items:center;
          gap: 8px;
          color: rgba(226,232,240,0.82);
          font-size: 13px;
          min-width:0;
        }
        .fgx-email i{ font-size: 18px; opacity: 0.9; }
        .fgx-email span{
          max-width: 100%;
          min-width:0;
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        /* -------------------- CTA -------------------- */
        .fgx-btnRow{ margin-top: 14px; display:flex; justify-content:center; }
        .fgx-btn{
          height: 38px;
          line-height: 38px;
          padding: 0 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.16);
          background: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          text-transform: none;
          display:inline-flex;
          align-items:center;
          gap: 10px;
          cursor:pointer;
          user-select:none;
          box-shadow: 0 14px 34px rgba(0,0,0,0.18);
        }
        .fgx-btn:hover{ background: rgba(255,255,255,0.14); }
        .fgx-btn i{ font-size: 18px; }

        /* -------------------- Reveal (cool, NOT two columns) -------------------- */
        .fgx-reveal{
          max-height: 0;
          overflow: hidden;
          transition: max-height 260ms ease;
          border-top: 1px solid rgba(255,255,255,0.10);
        }
        .fgx-reveal.open{ max-height: 560px; }

        .fgx-revealInner{
          padding: 16px 16px 16px;
          background:
            radial-gradient(820px 200px at 50% 0%, rgba(56,189,248,0.12), transparent 55%),
            linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%);
        }

        /* “HUD List” style: pill rows with icon + label + value (very clean, very game-studio) */
        .fgx-hud{
          display:flex;
          flex-direction: column;
          gap: 10px;
        }

        .fgx-item{
          display:grid;
          grid-template-columns: 40px minmax(0,1fr) auto;
          gap: 12px;
          align-items:center;
          padding: 12px 12px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.06);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
          min-width:0;
        }

        .fgx-ic{
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display:grid;
          place-items:center;
          background: rgba(0,0,0,0.18);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .fgx-ic i{
          font-size: 18px;
          color: rgba(226,232,240,0.88);
        }

        .fgx-mid{ min-width:0; }
        .fgx-label{
          font-size: 10.5px;
          letter-spacing: 0.7px;
          text-transform: uppercase;
          color: rgba(226,232,240,0.62);
          font-weight: 900;
        }
        .fgx-value{
          margin-top: 2px;
          font-size: 13px;
          color: rgba(255,255,255,0.92);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        }

        .fgx-chipVal{
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.9);
          font-weight: 900;
          font-size: 11.5px;
          white-space: nowrap;
        }

        /* Action bar */
        .fgx-actionBar{
          margin-top: 14px;
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .fgx-miniBtn{
          height: 34px;
          line-height: 34px;
          padding: 0 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          text-transform: none;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          cursor:pointer;
          user-select:none;
        }
        .fgx-miniBtn:hover{ background: rgba(255,255,255,0.12); }
        .fgx-miniBtn i{ font-size: 18px; }

        /* small screens */
        @media (max-width: 420px){
          .fgx-avatar, .fgx-avatarImg, .fgx-avatarFallback { width: 118px; height: 118px; }
          .fgx-avatar{ height: 118px; width: 118px; }
        }
      `}</style>

      <div className="fgx-card">
        {/* Header */}
        <div className="fgx-head">
          <div className="fgx-glowStrip" aria-hidden="true" />

          <div className="fgx-avatarWrap">
            <div
              className="fgx-avatar"
              role="button"
              tabIndex={0}
              title={expanded ? "Hide details" : "Reveal details"}
              onClick={() => setExpanded((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setExpanded((v) => !v);
              }}
            >
              {hasAvatar ? (
                <img className="fgx-avatarImg" src={avatarUrl} alt="avatar" />
              ) : (
                <div className="fgx-avatarFallback" aria-label="avatar-fallback">
                  {avatarFallback}
                </div>
              )}
              <span className="fgx-status" title="Active" />
            </div>
          </div>

          <div className="fgx-name" title={displayName}>
            {loading ? "Loading…" : displayName}
          </div>

          <div className="fgx-pillRow">
            <span className="fgx-pill" title={role}>
              <i className="material-icons">verified</i>
              {role}
            </span>
            <span className="fgx-pill" title={dept}>
              <i className="material-icons">account_tree</i>
              {dept}
            </span>
          </div>

          <div className="fgx-email" title={email !== "—" ? email : ""}>
            <i className="material-icons">alternate_email</i>
            <span>{email !== "—" ? email : "—"}</span>
          </div>

          {title !== "—" && (
            <div className="fgx-email" title={title}>
              <i className="material-icons">work</i>
              <span>{title}</span>
            </div>
          )}

          <div className="fgx-btnRow">
            <button type="button" className="fgx-btn" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
              <i className="material-icons">{expanded ? "expand_less" : "expand_more"}</i>
              {expanded ? "Hide Details" : "Reveal Details"}
            </button>
          </div>
        </div>

        {/* Reveal */}
        <div className={"fgx-reveal" + (expanded ? " open" : "")}>
          <div className="fgx-revealInner">
            <div className="fgx-hud">
              <div className="fgx-item">
                <div className="fgx-ic"><i className="material-icons">business_center</i></div>
                <div className="fgx-mid">
                  <div className="fgx-label">Employment</div>
                  <div className="fgx-value" title={empType}>{empType}</div>
                </div>
                <div className="fgx-chipVal">{role}</div>
              </div>

              <div className="fgx-item">
                <div className="fgx-ic"><i className="material-icons">location_on</i></div>
                <div className="fgx-mid">
                  <div className="fgx-label">Location</div>
                  <div className="fgx-value" title={location}>{location}</div>
                </div>
                <div className="fgx-chipVal">On-site</div>
              </div>

              <div className="fgx-item">
                <div className="fgx-ic"><i className="material-icons">call</i></div>
                <div className="fgx-mid">
                  <div className="fgx-label">Phone</div>
                  <div className="fgx-value" title={phone}>{phone}</div>
                </div>
                <div className="fgx-chipVal">Reachable</div>
              </div>

              <div className="fgx-item">
                <div className="fgx-ic"><i className="material-icons">person</i></div>
                <div className="fgx-mid">
                  <div className="fgx-label">Username</div>
                  <div className="fgx-value" title={username}>{clampStr(username, 44)}</div>
                </div>
                <div className="fgx-chipVal">ID</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}