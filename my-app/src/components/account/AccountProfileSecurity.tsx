import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiUser } from "../../api";

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

function isHttpUrl(s: string) {
  const t = safeStr(s);
  return /^https?:\/\/.+/i.test(t);
}

function fmtMaybeDate(v: any) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  const d2 = new Date(`${s}T00:00:00`);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
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

type EditableKey =
  | "employee_profilepicture"
  | "employee_picture"
  | "employee_phonenumber"
  | "employee_dob"
  | "employee_address"
  | "location";

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
  right?: ReactNode;
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
          <div
            className={
              "accTileValue" + (mono ? " mono" : "") + (isEmpty ? " dim" : "")
            }
            title={value}
          >
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

function EditableDropdown({
  open,
  onToggle,
  summary,
  children,
}: {
  open: boolean;
  onToggle: (next: boolean) => void;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <details
      className="accDetails"
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="accSummary">{summary}</summary>
      <div className="accDetailsBody">{children}</div>
    </details>
  );
}

export default function AccountProfileSecurity({
  user,
  api,
  initialTab = "details",
}: {
  user: any;
  api: any;
  initialTab?: "details" | "password";
}) {
  const [me, setMe] = useState<ApiUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [pic, setPic] = useState("");
  const [employeePic, setEmployeePic] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");

  const [editing, setEditing] = useState<Record<EditableKey, boolean>>({
    employee_profilepicture: false,
    employee_picture: false,
    employee_phonenumber: false,
    employee_dob: false,
    employee_address: false,
    location: false,
  });

  const [pwExpanded, setPwExpanded] = useState(initialTab === "password");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pulse, setPulse] = useState<"" | "profile" | "pw">("");

  const [picError, setPicError] = useState(false);
  const [employeePicError, setEmployeePicError] = useState(false);

  const detailsOnly = initialTab === "details";
  const passwordOnly = initialTab === "password";

  useEffect(() => {
    if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
  }, [initialTab, pwExpanded, pic, employeePic, phone, location, dob, address, pw1, pw2]);

  useEffect(() => {
    if (initialTab === "password") {
      setPwExpanded(true);
    }
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingMe(true);
        const mine = await api.getMe();
        if (!mounted) return;

        setMe(mine);
        setPic(safeStr((mine as any).employee_profilepicture));
        setEmployeePic(safeStr((mine as any).employee_picture));
        setPhone(safeStr((mine as any).employee_phonenumber));
        setLocation(safeStr((mine as any).location));
        setDob(safeStr((mine as any).employee_dob));
        setAddress(safeStr((mine as any).employee_address));
        setPicError(false);
        setEmployeePicError(false);

        if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
      } catch {
        if (typeof M !== "undefined") {
          M.toast({ html: "Failed to load your account.", classes: "red" });
        }
      } finally {
        if (mounted) setLoadingMe(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [api]);

  const username =
    safeStr((me as any)?.username) || safeStr(user?.username) || "—";
  const displayName = safeStr((me as any)?.employee_name) || username || "—";
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

  const heroAvatarUrl = useMemo(() => {
    const dp = safeStr(pic);
    if (dp && isHttpUrl(dp)) return dp;
    const t = safeStr(employeePic);
    if (t && isHttpUrl(t)) return t;
    return "";
  }, [pic, employeePic]);

  const pwStrength = useMemo(() => strengthLabel(pw1), [pw1]);
  const pwMatch = pw1 && pw2 ? pw1 === pw2 : true;

  function setEdit(k: EditableKey, v: boolean) {
    setEditing((m) => ({ ...m, [k]: v }));
    if (!v) {
      if (!me) return;
      if (k === "employee_profilepicture") {
        setPic(safeStr((me as any).employee_profilepicture));
        setPicError(false);
      }
      if (k === "employee_picture") {
        setEmployeePic(safeStr((me as any).employee_picture));
        setEmployeePicError(false);
      }
      if (k === "employee_phonenumber") {
        setPhone(safeStr((me as any).employee_phonenumber));
      }
      if (k === "location") {
        setLocation(safeStr((me as any).location));
      }
      if (k === "employee_dob") {
        setDob(safeStr((me as any).employee_dob));
      }
      if (k === "employee_address") {
        setAddress(safeStr((me as any).employee_address));
      }
    }
  }

  async function refreshMeSafe() {
    try {
      const mine = await api.getMe();
      setMe(mine);
      setPic(safeStr((mine as any).employee_profilepicture));
      setEmployeePic(safeStr((mine as any).employee_picture));
      setPhone(safeStr((mine as any).employee_phonenumber));
      setLocation(safeStr((mine as any).location));
      setDob(safeStr((mine as any).employee_dob));
      setAddress(safeStr((mine as any).employee_address));
      setPicError(false);
      setEmployeePicError(false);
      if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
    } catch {
      // ignore
    }
  }

  async function saveOne(k: EditableKey) {
    if (!me) return;

    if (k === "employee_dob") {
      const d = safeStr(dob);
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        M.toast({
          html: "DOB must be YYYY-MM-DD (e.g., 1998-05-10).",
          classes: "red",
        });
        return;
      }
    }

    if (k === "employee_profilepicture") {
      const p = safeStr(pic);
      if (p && !isHttpUrl(p)) {
        M.toast({
          html: "Profile picture (DP) must be a full http(s) URL.",
          classes: "red",
        });
        return;
      }
    }

    if (k === "employee_picture") {
      const p = safeStr(employeePic);
      if (p && !isHttpUrl(p)) {
        M.toast({
          html: "Employee picture must be a full http(s) URL.",
          classes: "red",
        });
        return;
      }
    }

    setSavingProfile(true);
    try {
      const patch: any = { username };

      if (k === "employee_profilepicture") {
        patch.employee_profilepicture = safeStr(pic) || undefined;
      }
      if (k === "employee_picture") {
        patch.employee_picture = safeStr(employeePic) || undefined;
      }
      if (k === "employee_phonenumber") {
        patch.employee_phonenumber = safeStr(phone) || undefined;
      }
      if (k === "location") {
        patch.location = safeStr(location) || undefined;
      }
      if (k === "employee_dob") {
        patch.employee_dob = safeStr(dob) || undefined;
      }
      if (k === "employee_address") {
        patch.employee_address = safeStr(address) || undefined;
      }

      await api.updateUser(patch);
      await refreshMeSafe();

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
    <>
      {!passwordOnly && (
        <>
          <div className="accHero" style={{ marginBottom: 14 }}>
            <div className="accHeroInner">
              <div className="accMiniProfile">
                <div className="accAvatar" title={displayName}>
                  {isHttpUrl(heroAvatarUrl) && !(picError && employeePicError) ? (
                    <img
                      src={heroAvatarUrl}
                      alt="profile"
                      onError={() => {
                        if (heroAvatarUrl === pic) setPicError(true);
                        else setEmployeePicError(true);
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 22 }}>{avatarFallback}</span>
                  )}
                  <span className="accDot" title="Active" />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="accTitle" title={displayName}>
                    {displayName}
                  </div>
                  <div className="accSub" title={email}>
                    {email}
                  </div>
                  <div className="accSub" title={title !== "—" ? title : ""}>
                    {title !== "—" ? title : " "}
                  </div>
                </div>
              </div>

              <div className="accPills">
                <Pill icon="verified" text={role} tone="blue" />
                <Pill
                  icon="apartment"
                  text={dept !== "—" ? dept : "Department"}
                  tone="grey"
                />
                <Pill
                  icon="work_outline"
                  text={employmentType !== "—" ? employmentType : "Employment"}
                  tone="amber"
                />
              </div>
            </div>
          </div>

          <div className={`card z-depth-1 panelCard ${pulse === "profile" ? "pulseGreen" : ""}`}>
            <div className="panelHead">
              <div>
                <div className="h">Profile & Personal</div>
                <div className="p">
                  Editable cards are now dropdowns, so the page stays cleaner.
                </div>
              </div>
              <Pill icon="badge" text="Self Service" tone="green" />
            </div>

            <div className="card-content" style={{ padding: 16 }}>
              {loadingMe ? (
                <div className="emptyState">Loading…</div>
              ) : (
                <>
                  <div className="tileGrid">
                    <EditableDropdown
                      open={editing.employee_profilepicture}
                      onToggle={(next) => setEdit("employee_profilepicture", next)}
                      summary={
                        <InfoTile
                          icon="image"
                          label="Profile Picture (DP)"
                          value={pic ? (isHttpUrl(pic) ? "Linked image URL" : pic) : "—"}
                          right={
                            editing.employee_profilepicture ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
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
                            <label htmlFor="edit_pic" className={pic ? "active" : ""}>
                              Image URL
                            </label>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: pic && !isHttpUrl(pic) ? "#b45309" : "#94a3b8",
                              fontWeight: 800,
                            }}
                          >
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
                    </EditableDropdown>

                    <EditableDropdown
                      open={editing.employee_picture}
                      onToggle={(next) => setEdit("employee_picture", next)}
                      summary={
                        <InfoTile
                          icon="portrait"
                          label="Employee Picture (Teams Photo)"
                          value={employeePic ? (isHttpUrl(employeePic) ? "Linked image URL" : employeePic) : "—"}
                          right={
                            editing.employee_picture ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_employee_pic"
                              value={employeePic}
                              onChange={(e) => {
                                setEmployeePic(e.target.value);
                                setEmployeePicError(false);
                              }}
                              placeholder="https://…"
                            />
                            <label htmlFor="edit_employee_pic" className={employeePic ? "active" : ""}>
                              Employee Photo URL
                            </label>
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: employeePic && !isHttpUrl(employeePic) ? "#b45309" : "#94a3b8",
                              fontWeight: 800,
                            }}
                          >
                            {employeePic
                              ? isHttpUrl(employeePic)
                                ? "Looks valid."
                                : "Must be http(s) URL."
                              : "Optional"}
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("employee_picture", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("employee_picture")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </EditableDropdown>

                    <EditableDropdown
                      open={editing.employee_phonenumber}
                      onToggle={(next) => setEdit("employee_phonenumber", next)}
                      summary={
                        <InfoTile
                          icon="call"
                          label="Phone"
                          value={phone || "—"}
                          right={
                            editing.employee_phonenumber ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_phone"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                            <label htmlFor="edit_phone" className={phone ? "active" : ""}>
                              Phone
                            </label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("employee_phonenumber", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("employee_phonenumber")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </EditableDropdown>

                    <EditableDropdown
                      open={editing.employee_dob}
                      onToggle={(next) => setEdit("employee_dob", next)}
                      summary={
                        <InfoTile
                          icon="event"
                          label="Date of Birth"
                          value={dob ? fmtMaybeDate(dob) : "—"}
                          right={
                            editing.employee_dob ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_dob"
                              value={dob}
                              onChange={(e) => setDob(e.target.value)}
                              placeholder="YYYY-MM-DD"
                            />
                            <label htmlFor="edit_dob" className={dob ? "active" : ""}>
                              DOB (YYYY-MM-DD)
                            </label>
                          </div>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>
                            Example: 1998-05-10
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("employee_dob", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("employee_dob")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </EditableDropdown>

                    <EditableDropdown
                      open={editing.employee_address}
                      onToggle={(next) => setEdit("employee_address", next)}
                      summary={
                        <InfoTile
                          icon="home"
                          label="Address"
                          value={address || "—"}
                          right={
                            editing.employee_address ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_address"
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                            />
                            <label htmlFor="edit_address" className={address ? "active" : ""}>
                              Address
                            </label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("employee_address", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("employee_address")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </EditableDropdown>

                    <EditableDropdown
                      open={editing.location}
                      onToggle={(next) => setEdit("location", next)}
                      summary={
                        <InfoTile
                          icon="location_on"
                          label="Location"
                          value={location || "—"}
                          right={
                            editing.location ? (
                              <Pill icon="expand_less" text="Open" tone="amber" />
                            ) : (
                              <Pill icon="expand_more" text="Dropdown" tone="grey" />
                            )
                          }
                        />
                      }
                    >
                      <div className="editPanel">
                        <div className="left">
                          <div className="input-field">
                            <input
                              id="edit_location"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                            />
                            <label htmlFor="edit_location" className={location ? "active" : ""}>
                              Location
                            </label>
                          </div>
                        </div>
                        <div className="editActions">
                          <SmallAction
                            icon="close"
                            text="Cancel"
                            subtle
                            onClick={() => setEdit("location", false)}
                            disabled={savingProfile}
                          />
                          <SmallAction
                            icon="save"
                            text={savingProfile ? "Saving…" : "Save"}
                            onClick={() => saveOne("location")}
                            disabled={savingProfile}
                          />
                        </div>
                      </div>
                    </EditableDropdown>

                    <InfoTile
                      icon="alternate_email"
                      label="Email (Locked)"
                      value={email || "—"}
                      muted
                      mono
                      right={<Pill icon="lock" text="Locked" tone="grey" />}
                    />
                    <InfoTile
                      icon="person"
                      label="Username (Locked)"
                      value={username || "—"}
                      muted
                      mono
                      right={<Pill icon="lock" text="Locked" tone="grey" />}
                    />
                    <InfoTile
                      icon="badge"
                      label="Employee ID (Locked)"
                      value={employeeId || "—"}
                      muted
                      mono
                      right={<Pill icon="lock" text="Locked" tone="grey" />}
                    />
                    <InfoTile
                      icon="event_available"
                      label="Start Date (Locked)"
                      value={started}
                      muted
                      right={<Pill icon="lock" text="Locked" tone="grey" />}
                    />
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

                  <div style={{ marginTop: 12, fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                    Locked fields are visible for transparency but can’t be edited from your account.
                  </div>
                </>
              )}
            </div>
          </div>

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
        </>
      )}

      {!detailsOnly && (
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
                  const next = !pwExpanded;
                  setPwExpanded(next);
                  if (!next) {
                    setPw1("");
                    setPw2("");
                    setShowPw(false);
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
            )}

            {!pwExpanded && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
                Password editor is hidden until you click <b>Edit Password</b>.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}