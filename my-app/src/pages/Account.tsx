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
  return String(v);
}

function isHttpUrl(s: string) {
  const t = safeStr(s).trim();
  if (!t) return false;
  return /^https?:\/\/.+/i.test(t);
}

function initials(nameOrUser: string) {
  const s = safeStr(nameOrUser).trim();
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
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

export default function Account() {
  const { user, api } = useAuth();

  // ------- Password form -------
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [loadingPw, setLoadingPw] = useState(false);

  // ------- Profile details form -------
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [about, setAbout] = useState("");
  const [phone, setPhone] = useState("");
  const [pic, setPic] = useState("");

  // UI delight states
  const [pulseSaved, setPulseSaved] = useState<"pw" | "profile" | "">("");
  const [picError, setPicError] = useState(false);

  useEffect(() => {
    if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
  }, []);

  // Load current user's profile details
  useEffect(() => {
    let mounted = true;
    if (!user) return;

    (async () => {
      try {
        setProfileLoading(true);
        const all = await api.getUsers();
        const me: ApiUser | undefined =
          all.find((u) => u.username === user.username) ||
          all.find((u) => (u.employee_email || "").toLowerCase() === (user.username || "").toLowerCase());

        if (mounted && me) {
          setLocation(me.location || "");
          setPhone((me as any).employee_phonenumber || "");
          setPic((me as any).employee_profilepicture || "");
          setCity((me as any).city || "");
          setAddress((me as any).address || "");
          setAbout((me as any).about || "");
          setPicError(false);
          if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
        }
      } catch {
        if (typeof M !== "undefined") M.toast({ html: "Failed to load profile.", classes: "red" });
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, api]);

  if (!user) return null;

  const displayName = useMemo(() => safeStr(user?.username || "—"), [user]);
  const avatarFallback = useMemo(() => initials(displayName), [displayName]);

  const pwStrength = useMemo(() => strengthLabel(pw1), [pw1]);
  const pwMatch = pw1 && pw2 ? pw1 === pw2 : true;

  // -------- Password submit --------
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw1 || pw1.length < 8) {
      M.toast({ html: "Password must be at least 8 characters.", classes: "red" });
      return;
    }
    if (pw1 !== pw2) {
      M.toast({ html: "Passwords do not match.", classes: "red" });
      return;
    }
    try {
      setLoadingPw(true);
      await api.updateUser({ username: user!.username, password: pw1 });
      setPw1("");
      setPw2("");
      setPulseSaved("pw");
      setTimeout(() => setPulseSaved(""), 900);
      M.toast({ html: "Password updated successfully.", classes: "green" });
    } catch (err: any) {
      M.toast({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setLoadingPw(false);
    }
  }

  // -------- Profile submit --------
  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSavingProfile(true);
      await api.updateUser({
        username: user!.username,
        location: location || undefined,
        employee_phonenumber: phone || undefined,
        employee_profilepicture: pic || undefined,
        city: city || undefined,
        address: address || undefined,
        about: about || undefined,
      } as any);

      setPulseSaved("profile");
      setTimeout(() => setPulseSaved(""), 900);
      M.toast({ html: "Profile updated.", classes: "green" });
    } catch (err: any) {
      M.toast({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <main className="container account-shell" style={{ paddingTop: 22, maxWidth: 980 }}>
      {/* Page-level styles for animation + polish */}
      <style>{`
        .account-shell { animation: accFadeUp 260ms ease both; }
        @keyframes accFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .acc-card { border-radius: 16px; overflow: hidden; }
        .acc-header {
          background: radial-gradient(900px 220px at 15% 10%, rgba(59,130,246,0.30), transparent 55%),
                      radial-gradient(700px 240px at 85% 40%, rgba(34,197,94,0.16), transparent 60%),
                      linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
          color: white;
          position: relative;
        }
        .acc-header::after {
          content:"";
          position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transform: translateX(-60%);
          animation: shimmer 3.8s ease-in-out infinite;
          pointer-events:none;
          opacity: .45;
        }
        @keyframes shimmer { 0% { transform: translateX(-60%);} 50% { transform: translateX(60%);} 100% { transform: translateX(60%);} }

        .acc-hero {
          display:flex; gap:14px; align-items:center;
          padding: 16px 16px 14px;
        }
        .acc-avatar {
          width: 62px; height: 62px; border-radius: 18px;
          display:flex; align-items:center; justify-content:center;
          font-weight: 900; letter-spacing: .6px;
          border: 2px solid rgba(255,255,255,0.24);
          background: rgba(255,255,255,0.10);
          box-shadow: 0 12px 28px rgba(0,0,0,0.22);
          position: relative;
          overflow:hidden;
          transform: translateZ(0);
        }
        .acc-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
        .acc-avatar .dot {
          position:absolute; right:6px; bottom:6px;
          width:12px; height:12px; border-radius:999px;
          background:#22c55e; border:2px solid rgba(15,23,42,0.9);
        }
        .acc-title { font-weight: 900; font-size: 16px; line-height: 20px; }
        .acc-sub { margin-top: 2px; font-size: 12.5px; color: rgba(255,255,255,0.78); }
        .acc-mono { margin-top: 7px; font-size: 12px; color: rgba(255,255,255,0.75); }
        .acc-mono code { color: rgba(255,255,255,0.92); background: rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); padding: 2px 8px; border-radius: 999px; }

        .acc-sectionHead {
          padding: 14px 16px 12px;
          border-bottom: 1px solid #eceff1;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
        }
        .acc-sectionHead .h { font-weight: 900; font-size: 14.5px; color: #263238; }
        .acc-sectionHead .p { font-size: 12px; color: #607d8b; margin-top: 2px; }

        .acc-glow {
          animation: accGlow 900ms ease both;
        }
        @keyframes accGlow {
          0% { box-shadow: 0 0 0 rgba(34,197,94,0); }
          40% { box-shadow: 0 0 0 6px rgba(34,197,94,0.12); }
          100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        .acc-strength {
          height: 8px; border-radius: 999px; overflow: hidden;
          background: #eef2f7; border: 1px solid #e6edf2;
        }
        .acc-strength > div {
          height:100%;
          width: var(--w);
          background: linear-gradient(90deg, rgba(239,68,68,0.85), rgba(245,158,11,0.85), rgba(34,197,94,0.85));
          transition: width 160ms ease;
        }
        .acc-pill {
          display:inline-flex; align-items:center; gap:6px;
          padding: 3px 10px; border-radius: 999px;
          background: #eef2ff; border: 1px solid #e0e7ff;
          color: #1e40af; font-weight: 900; font-size: 11px;
          white-space: nowrap;
        }

        .acc-preview {
          border: 1px solid #e6edf2;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
          transform: translateZ(0);
        }
        .acc-previewTop {
          padding: 10px 12px;
          background: linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
          color: white;
          display:flex; align-items:center; justify-content:space-between; gap:10px;
        }
        .acc-previewTop .t { font-weight: 900; font-size: 12.5px; }
        .acc-previewTop .mini {
          font-size: 11px; font-weight: 900;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.16);
          padding: 3px 8px; border-radius: 999px;
        }
        .acc-previewBody { padding: 12px; }
        .acc-previewAvatar {
          width: 64px; height: 64px; border-radius: 18px;
          display:flex; align-items:center; justify-content:center;
          font-weight: 900; letter-spacing:.6px;
          background: #eef2f7; border: 1px solid #e6edf2;
          overflow:hidden;
        }
        .acc-previewAvatar img { width:100%; height:100%; object-fit:cover; display:block; }
        .acc-previewName { margin-top: 10px; font-weight: 900; color:#0f172a; }
        .acc-previewLine { margin-top: 3px; font-size: 12px; color:#607d8b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        /* Nice textarea focus */
        textarea.materialize-textarea:focus { box-shadow: none !important; }
      `}</style>

      {/* HERO */}
      <div className="card z-depth-1 acc-card" style={{ marginBottom: 14 }}>
        <div className="acc-header">
          <div className="acc-hero">
            <div className="acc-avatar" title={displayName}>
              {isHttpUrl(pic) && !picError ? (
                <img
                  src={pic}
                  alt="profile"
                  onError={() => setPicError(true)}
                />
              ) : (
                <span>{avatarFallback}</span>
              )}
              <span className="dot" title="Active" />
            </div>

            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div className="acc-title">Account Settings</div>
              <div className="acc-sub">Password, profile, and professional details.</div>
              <div className="acc-mono">
                <i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>
                  alternate_email
                </i>
                <code>{user.username}</code>
              </div>
            </div>

            <span className="acc-pill" title="Settings">
              <i className="material-icons" style={{ fontSize: 14 }}>tune</i>
              Settings
            </span>
          </div>
        </div>
      </div>

      {/* PASSWORD */}
      <div className={`card z-depth-1 acc-card ${pulseSaved === "pw" ? "acc-glow" : ""}`}>
        <div className="acc-sectionHead">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="h">Password</div>
              <div className="p">Update your password securely.</div>
            </div>
            <span className="acc-pill" title="Security">
              <i className="material-icons" style={{ fontSize: 14 }}>verified_user</i>
              Security
            </span>
          </div>
        </div>

        <div className="card-content" style={{ padding: 16 }}>
          <form onSubmit={handlePasswordSubmit}>
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12">
                <input id="username" value={user.username} disabled />
                <label htmlFor="username" className="active">
                  Username
                </label>
              </div>

              <div className="input-field col s12 m6">
                <input
                  id="newpassword"
                  type={show ? "text" : "password"}
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  minLength={8}
                  required
                />
                <label htmlFor="newpassword" className={pw1 ? "active" : ""}>
                  New Password
                </label>

                {/* Strength meter */}
                <div style={{ marginTop: 10 }}>
                  <div className="acc-strength" style={{ ["--w" as any]: `${pwStrength.pct}%` }}>
                    <div />
                  </div>
                  <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                      Strength: <span style={{ color: "#0f172a" }}>{pwStrength.label}</span>
                    </span>
                    <span style={{ fontSize: 12, color: "#90a4ae", fontWeight: 800 }}>
                      {pw1.length}/12+
                    </span>
                  </div>
                </div>
              </div>

              <div className="input-field col s12 m6">
                <input
                  id="confirmpassword"
                  type={show ? "text" : "password"}
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  minLength={8}
                  required
                />
                <label htmlFor="confirmpassword" className={pw2 ? "active" : ""}>
                  Confirm Password
                </label>

                {!pwMatch ? (
                  <div style={{ marginTop: 6, fontSize: 12, fontWeight: 900, color: "#b91c1c" }}>
                    Passwords do not match.
                  </div>
                ) : null}
              </div>

              <div className="col s12" style={{ marginTop: -6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <label>
                  <input
                    type="checkbox"
                    className="filled-in"
                    checked={show}
                    onChange={(e) => setShow(e.target.checked)}
                  />
                  <span>Show password</span>
                </label>

                <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                  Tip: mix words + symbols
                </span>
              </div>
            </div>

            <button
              className={`btn ${loadingPw ? "disabled" : ""}`}
              disabled={loadingPw}
              type="submit"
              style={{ borderRadius: 10, fontWeight: 900 }}
            >
              <i className="material-icons left">lock_reset</i>
              {loadingPw ? "Updating…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>

      {/* PROFILE */}
      <div className={`card z-depth-1 acc-card ${pulseSaved === "profile" ? "acc-glow" : ""}`} style={{ marginTop: 14 }}>
        <div className="acc-sectionHead">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="h">Profile Details</div>
              <div className="p">These appear across the portal and internal directory.</div>
            </div>
            <span className="acc-pill" title="Profile">
              <i className="material-icons" style={{ fontSize: 14 }}>badge</i>
              Profile
            </span>
          </div>
        </div>

        <div className="card-content" style={{ padding: 16 }}>
          {profileLoading ? (
            <div
              style={{
                border: "1px solid #e6edf2",
                borderRadius: 12,
                padding: "12px 12px",
                background: "#fbfdff",
                color: "#607d8b",
                fontWeight: 900,
              }}
            >
              Loading…
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit}>
              <div className="row" style={{ marginBottom: 0 }}>
                {/* Live preview card (animated) */}
                <div className="col s12 m4" style={{ marginBottom: 12 }}>
                  <div className="acc-preview" style={{ animation: "accFadeUp 260ms ease both" }}>
                    <div className="acc-previewTop">
                      <div className="t">Live Preview</div>
                      <div className="mini">{city ? city : "—"}</div>
                    </div>
                    <div className="acc-previewBody">
                      <div className="acc-previewAvatar">
                        {isHttpUrl(pic) && !picError ? (
                          <img src={pic} alt="preview" onError={() => setPicError(true)} />
                        ) : (
                          <span style={{ fontWeight: 900, color: "#0f172a" }}>{avatarFallback}</span>
                        )}
                      </div>
                      <div className="acc-previewName" title={displayName}>
                        {displayName}
                      </div>
                      <div className="acc-previewLine" title={about || ""}>
                        {about ? about : "Add an About to introduce yourself."}
                      </div>
                      <div className="acc-previewLine" title={`${address} ${location}`}>
                        <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4 }}>
                          location_on
                        </i>
                        {address || location ? `${address ? address + " • " : ""}${location || ""}` : "Add a professional location/address."}
                      </div>
                      <div className="acc-previewLine" title={phone || ""}>
                        <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4 }}>
                          call
                        </i>
                        {phone || "Add a contact number."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="col s12 m8">
                  <div className="row" style={{ marginBottom: 0 }}>
                    <div className="input-field col s12">
                      <input
                        id="pic"
                        value={pic}
                        onChange={(e) => {
                          setPic(e.target.value);
                          setPicError(false);
                        }}
                        placeholder="https://…"
                      />
                      <label htmlFor="pic" className={pic ? "active" : ""}>
                        Profile Picture URL
                      </label>
                      <div style={{ marginTop: 4, fontSize: 12, color: pic && !isHttpUrl(pic) ? "#b45309" : "#90a4ae", fontWeight: 800 }}>
                        {pic
                          ? isHttpUrl(pic)
                            ? "Looks good."
                            : "Tip: Use a full http(s) URL."
                          : "Optional: add a URL to show your photo."}
                      </div>
                    </div>

                    <div className="input-field col s12 m6">
                      <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                      <label htmlFor="location" className={location ? "active" : ""}>
                        Location (Country/State)
                      </label>
                    </div>

                    <div className="input-field col s12 m6">
                      <input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                      <label htmlFor="city" className={city ? "active" : ""}>
                        City
                      </label>
                    </div>

                    <div className="input-field col s12">
                      <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                      <label htmlFor="address" className={address ? "active" : ""}>
                        Address
                      </label>
                    </div>

                    <div className="input-field col s12 m6">
                      <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      <label htmlFor="phone" className={phone ? "active" : ""}>
                        Phone Number
                      </label>
                    </div>

                    <div className="input-field col s12 m6">
                      <textarea
                        id="about"
                        className="materialize-textarea"
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        maxLength={280}
                        style={{ minHeight: 92 }}
                      />
                      <label htmlFor="about" className={about ? "active" : ""}>
                        About (max 280 chars)
                      </label>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#90a4ae", fontWeight: 800 }}>
                        {about.length}/280
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                    <button
                      className={`btn ${savingProfile ? "disabled" : ""}`}
                      disabled={savingProfile}
                      type="submit"
                      style={{ borderRadius: 10, fontWeight: 900 }}
                    >
                      <i className="material-icons left">save</i>
                      {savingProfile ? "Saving…" : "Save Profile"}
                    </button>

                    <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                      Updates reflect across the portal after refresh.
                    </span>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Tips */}
      <div
        className="card grey lighten-5 z-depth-0 acc-card"
        style={{ marginTop: 14, border: "1px solid #e6edf2" }}
      >
        <div className="card-content" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 14.5, color: "#263238" }}>Security tips</div>
              <div style={{ fontSize: 12, color: "#607d8b", marginTop: 2 }}>
                Small habits, big payoff.
              </div>
            </div>
            <span className="acc-pill">
              <i className="material-icons" style={{ fontSize: 14 }}>shield</i>
              Best practice
            </span>
          </div>

          <ul className="browser-default" style={{ marginTop: 10, color: "#455a64" }}>
            <li>Use 12+ characters, mix of words, numbers, and symbols.</li>
            <li>Don’t reuse passwords from other services.</li>
            <li>Consider a password manager.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
