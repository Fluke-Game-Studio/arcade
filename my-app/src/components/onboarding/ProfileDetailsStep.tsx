import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

declare const M: any;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function fmtMaybeDate(v: any) {
  const s = safeStr(v);
  if (!s) return "—";
  const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      });
    }
  }
  const d2 = new Date(s);
  if (!Number.isNaN(d2.getTime())) {
    return d2.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }
  return s;
}

function isHttpUrl(s: string) {
  const t = safeStr(s);
  return /^https?:\/\/.+/i.test(t);
}

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
    <div style={{
      borderRadius: 18,
      border: "1px solid #e6edf2",
      background: muted ? "linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)" : "#fff",
      padding: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 16,
          display: "grid",
          placeItems: "center",
          background: "#f1f5f9",
          border: "1px solid #e6edf2",
          flex: "0 0 auto",
        }}>
          <i className="material-icons" style={{ fontSize: 19, color: "#0f172a", opacity: .9 }}>{icon}</i>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10.5,
            letterSpacing: ".6px",
            textTransform: "uppercase",
            color: "#64748b",
            fontWeight: 900,
          }}>{label}</div>
          <div
            style={{
              marginTop: 3,
              fontSize: 13.2,
              color: isEmpty ? "#94a3b8" : "#0f172a",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' : undefined,
            }}
            title={value}
          >
            {value || "—"}
          </div>
        </div>
      </div>
      <div>{right}</div>
    </div>
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
  const styles: Record<string, CSSProperties> = {
    neutral: { background: "rgba(241,245,249,.94)", borderColor: "rgba(148,163,184,.20)", color: "#334155" },
    blue: { background: "rgba(219,234,254,.92)", borderColor: "rgba(96,165,250,.24)", color: "#1d4ed8" },
    green: { background: "rgba(220,252,231,.92)", borderColor: "rgba(34,197,94,.22)", color: "#166534" },
    amber: { background: "rgba(254,243,199,.92)", borderColor: "rgba(245,158,11,.24)", color: "#b45309" },
    grey: { background: "rgba(241,245,249,.84)", borderColor: "rgba(148,163,184,.16)", color: "#475569" },
  };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px",
      borderRadius: 999,
      border: "1px solid rgba(148,163,184,0.35)",
      fontWeight: 900,
      fontSize: 11,
      letterSpacing: ".6px",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      ...styles[tone],
    }}>
      <i className="material-icons" style={{ fontSize: 16 }}>{icon}</i>
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
      onClick={onClick}
      disabled={!!disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 12,
        border: "1px solid rgba(148,163,184,.35)",
        background: subtle ? "#fff" : "#0b2544",
        color: subtle ? "#0f172a" : "#fff",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <i className="material-icons" style={{ fontSize: 18 }}>{icon}</i>
      <span>{text}</span>
    </button>
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
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
      style={{
        borderRadius: 18,
        border: "1px solid #e6edf2",
        background: "#fff",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <summary style={{ listStyle: "none", cursor: "pointer" }}>
        {summary}
      </summary>
      <div style={{ padding: 12, background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)" }}>{children}</div>
    </details>
  );
}

export default function ProfileDetailsStep({
  api,
  user,
  onBack,
  onContinue,
}: {
  api: any;
  user: any;
  onBack?: () => void;
  onContinue: () => void;
}) {
  const [me, setMe] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>("");
  const [pulse, setPulse] = useState(false);
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const [pic, setPic] = useState("");
  const [employeePic, setEmployeePic] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [discordUrl, setDiscordUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [initialProfile, setInitialProfile] = useState<Record<string, string>>({});

  function syncProfile(mine: any, fallbackUser: any) {
    const source = mine || fallbackUser || {};
    const next = {
      employee_profilepicture: safeStr(source?.employee_profilepicture),
      employee_picture: safeStr(source?.employee_picture),
      linkedin_url: safeStr(source?.linkedin_url),
      discord_url: safeStr(source?.discord_url),
      employee_phonenumber: safeStr(source?.employee_phonenumber),
      employee_dob: safeStr(source?.employee_dob),
      employee_address: safeStr(source?.employee_address),
      location: safeStr(source?.location),
    };
    setInitialProfile(next);
    return next;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const mine = await api.getMe();
        if (!mounted) return;
        setMe(mine);
        setPic(safeStr(mine?.employee_profilepicture));
        setEmployeePic(safeStr(mine?.employee_picture));
        setLinkedinUrl(safeStr(mine?.linkedin_url));
        setDiscordUrl(safeStr(mine?.discord_url));
        setPhone(safeStr(mine?.employee_phonenumber));
        setLocation(safeStr(mine?.location));
        setDob(safeStr(mine?.employee_dob));
        setAddress(safeStr(mine?.employee_address));
        syncProfile(mine, user);
      } catch {
        setMe(user || null);
        setPic(safeStr(user?.employee_profilepicture));
        setEmployeePic(safeStr(user?.employee_picture));
        setLinkedinUrl(safeStr(user?.linkedin_url));
        setDiscordUrl(safeStr(user?.discord_url));
        setPhone(safeStr(user?.employee_phonenumber));
        setLocation(safeStr(user?.location));
        setDob(safeStr(user?.employee_dob));
        setAddress(safeStr(user?.employee_address));
        syncProfile(user, user);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api, user]);

  const username = safeStr(me?.username || user?.username);
  const displayName = safeStr(me?.employee_name || user?.employee_name || username || "—");
  const email = safeStr(me?.employee_email || user?.employee_email || username || "—");
  const employeeId = safeStr(me?.employee_id || user?.employee_id);
  const started = fmtMaybeDate(me?.employee_date_started || user?.employee_date_started);
  const createdAt = fmtMaybeDate(me?.createdAt || user?.createdAt);
  const updatedAt = fmtMaybeDate(me?.updatedAt || user?.updatedAt);
  const role = safeStr((me?.employee_role || user?.employee_role || "employee")).toUpperCase();
  const title = safeStr(me?.employee_title || user?.employee_title) || "—";
  const dept = safeStr(me?.department || user?.department) || "—";
  const employmentType = safeStr(me?.employment_type || user?.employment_type) || "—";

  const requiredFields = useMemo(
    () => [
      { key: "employee_profilepicture", label: "Profile Picture (DP)", value: pic },
      { key: "employee_picture", label: "Employee Picture", value: employeePic },
      { key: "linkedin_url", label: "LinkedIn URL", value: linkedinUrl },
      { key: "discord_url", label: "Discord URL", value: discordUrl },
      { key: "employee_phonenumber", label: "Phone", value: phone },
      { key: "employee_dob", label: "Date of Birth", value: dob },
      { key: "employee_address", label: "Address", value: address },
      { key: "location", label: "Location", value: location },
    ],
    [address, discordUrl, dob, employeePic, linkedinUrl, location, pic, phone]
  );

  const missingFields = useMemo(() => requiredFields.filter((item) => !safeStr(item.value)), [requiredFields]);
  const canContinue = missingFields.length === 0 && !loading;

  function setEdit(k: string, next: boolean) {
    setEditing((m) => ({ ...m, [k]: next }));
    if (!next && me) {
      setPic(safeStr(me?.employee_profilepicture));
      setEmployeePic(safeStr(me?.employee_picture));
      setLinkedinUrl(safeStr(me?.linkedin_url));
      setDiscordUrl(safeStr(me?.discord_url));
      setPhone(safeStr(me?.employee_phonenumber));
      setLocation(safeStr(me?.location));
      setDob(safeStr(me?.employee_dob));
      setAddress(safeStr(me?.employee_address));
    }
  }

  async function saveOne(key: string) {
    if (!username) return;

    const originalValue =
      key === "employee_profilepicture" ? safeStr(initialProfile.employee_profilepicture) :
      key === "employee_picture" ? safeStr(initialProfile.employee_picture) :
      key === "linkedin_url" ? safeStr(initialProfile.linkedin_url) :
      key === "discord_url" ? safeStr(initialProfile.discord_url) :
      key === "employee_phonenumber" ? safeStr(initialProfile.employee_phonenumber) :
      key === "location" ? safeStr(initialProfile.location) :
      key === "employee_dob" ? safeStr(initialProfile.employee_dob) :
      key === "employee_address" ? safeStr(initialProfile.employee_address) :
      "";

    const nextValue =
      key === "employee_profilepicture" ? safeStr(pic) :
      key === "employee_picture" ? safeStr(employeePic) :
      key === "linkedin_url" ? safeStr(linkedinUrl) :
      key === "discord_url" ? safeStr(discordUrl) :
      key === "employee_phonenumber" ? safeStr(phone) :
      key === "location" ? safeStr(location) :
      key === "employee_dob" ? safeStr(dob) :
      key === "employee_address" ? safeStr(address) :
      "";

    if (nextValue === originalValue) {
      setEdit(key, false);
      M?.toast?.({ html: "No changes to save.", classes: "blue" });
      return;
    }

    if (key === "employee_dob" && safeStr(dob) && !/^\d{4}-\d{2}-\d{2}$/.test(safeStr(dob))) {
      M?.toast?.({ html: "DOB must be YYYY-MM-DD (e.g., 1998-05-10).", classes: "red" });
      return;
    }
    if (key === "employee_profilepicture" && safeStr(pic) && !isHttpUrl(pic)) {
      M?.toast?.({ html: "Profile picture (DP) must be a full http(s) URL.", classes: "red" });
      return;
    }
    if (key === "employee_picture" && safeStr(employeePic) && !isHttpUrl(employeePic)) {
      M?.toast?.({ html: "Employee picture must be a full http(s) URL.", classes: "red" });
      return;
    }
    if (key === "linkedin_url" && safeStr(linkedinUrl) && !isHttpUrl(linkedinUrl)) {
      M?.toast?.({ html: "LinkedIn URL must be a full http(s) URL.", classes: "red" });
      return;
    }
    if (key === "discord_url" && safeStr(discordUrl) && !isHttpUrl(discordUrl)) {
      M?.toast?.({ html: "Discord URL must be a full http(s) URL.", classes: "red" });
      return;
    }

    setSavingKey(key);
    try {
      const patch: any = { username };
      if (key === "employee_profilepicture") patch.employee_profilepicture = safeStr(pic) || undefined;
      if (key === "employee_picture") patch.employee_picture = safeStr(employeePic) || undefined;
      if (key === "linkedin_url") patch.linkedin_url = safeStr(linkedinUrl) || undefined;
      if (key === "discord_url") patch.discord_url = safeStr(discordUrl) || undefined;
      if (key === "employee_phonenumber") patch.employee_phonenumber = safeStr(phone) || undefined;
      if (key === "location") patch.location = safeStr(location) || undefined;
      if (key === "employee_dob") patch.employee_dob = safeStr(dob) || undefined;
      if (key === "employee_address") patch.employee_address = safeStr(address) || undefined;
      await api.updateUser(patch);
      // Update only the field we just saved rather than refetching + resyncing
      // all 8 fields from the server - a full resync would overwrite whatever
      // is currently typed (but not yet saved) into any other open field,
      // making it impossible to fill in more than one field before saving.
      setMe((prev: any) => ({ ...(prev || {}), [key]: nextValue }));
      setInitialProfile((prev) => ({ ...prev, [key]: nextValue }));
      setEdit(key, false);
      setPulse(true);
      setTimeout(() => setPulse(false), 900);
      M?.toast?.({ html: "Saved.", classes: "green" });
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Update failed.", classes: "red" });
    } finally {
      setSavingKey("");
    }
  }

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
        Profile & personal details
      </div>
      <div style={{ color: "#475569", lineHeight: 1.7 }}>
        Please complete the editable profile fields now. We prefill what we already know and use this step to capture anything missing.
      </div>

      <div style={{
        borderRadius: 18,
        border: "1px solid rgba(37,99,235,.16)",
        background: "rgba(37,99,235,.06)",
        padding: 14,
        color: "#1e3a8a",
        fontWeight: 800,
        lineHeight: 1.6,
      }} className={pulse ? "pulse" : ""}>
        {missingFields.length ? (
          <>
            <div style={{ fontWeight: 1000, marginBottom: 6 }}>Missing profile values: {missingFields.length}</div>
            <div>Fill the editable fields below so the journey can continue with a complete profile.</div>
          </>
        ) : (
          "All editable profile fields are complete. You can continue to the next step."
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Pill icon="verified" text={displayName || "Profile"} tone="blue" />
        <Pill icon="badge" text={role || "Employee"} tone="green" />
        <Pill icon="apartment" text={dept !== "—" ? dept : "Department"} tone="grey" />
        <Pill icon="work_outline" text={employmentType !== "—" ? employmentType : "Employment"} tone="amber" />
        <Pill icon="title" text={title !== "—" ? title : "Title"} tone="grey" />
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {[
          { key: "employee_profilepicture", icon: "image", label: "Profile Picture (DP)", value: pic, setter: setPic, placeholder: "https://..." },
          { key: "employee_picture", icon: "portrait", label: "Employee Picture", value: employeePic, setter: setEmployeePic, placeholder: "https://..." },
          { key: "linkedin_url", icon: "link", label: "LinkedIn URL", value: linkedinUrl, setter: setLinkedinUrl, placeholder: "https://www.linkedin.com/in/..." },
          { key: "discord_url", icon: "sports_esports", label: "Discord URL", value: discordUrl, setter: setDiscordUrl, placeholder: "https://discord.com/users/..." },
          { key: "employee_phonenumber", icon: "call", label: "Phone", value: phone, setter: setPhone, placeholder: "+1-555-888-1212" },
          { key: "employee_dob", icon: "event", label: "Date of Birth", value: dob, setter: setDob, placeholder: "YYYY-MM-DD" },
          { key: "employee_address", icon: "home", label: "Address", value: address, setter: setAddress, placeholder: "Street address" },
          { key: "location", icon: "location_on", label: "Location", value: location, setter: setLocation, placeholder: "Toronto" },
        ].map((item) => {
          const open = Boolean(editing[item.key]);
          const originalMissing = !safeStr(initialProfile[item.key]);
          return (
            <EditableDropdown
              key={item.key}
              open={open}
              onToggle={(next) => setEdit(item.key, next)}
              summary={
                <InfoTile
                  icon={item.icon}
                  label={item.label}
                  value={item.value || "—"}
                  right={
                    originalMissing ? (
                      <Pill icon="priority_high" text="Required" tone="amber" />
                    ) : open ? (
                      <Pill icon="expand_less" text="Open" tone="blue" />
                    ) : (
                      <Pill icon="check" text="Saved" tone="green" />
                    )
                  }
                />
              }
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 13 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    {originalMissing ? "This field is required to complete onboarding." : "Edit or confirm the saved value."}
                  </div>
                </div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "center",
                }}>
                  <div className="input-field" style={{ margin: 0 }}>
                    <input
                      id={`onboard_${item.key}`}
                      value={item.value}
                      onChange={(e) => {
                        item.setter(e.target.value);
                      }}
                      placeholder={item.placeholder}
                    />
                    <label htmlFor={`onboard_${item.key}`} className={safeStr(item.value) ? "active" : ""}>
                      {item.label}
                    </label>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <SmallAction icon="close" text="Cancel" subtle onClick={() => setEdit(item.key, false)} disabled={!!savingKey} />
                    <SmallAction
                      icon="save"
                      text={savingKey === item.key ? "Saving..." : "Save"}
                      onClick={() => void saveOne(item.key)}
                      disabled={!!savingKey}
                    />
                  </div>
                </div>
              </div>
            </EditableDropdown>
          );
        })}
      </div>

      <div style={{
        borderRadius: 18,
        border: "1px solid #e6edf2",
        background: "linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%)",
        padding: 14,
        display: "grid",
        gap: 10,
      }}>
        <div style={{ fontWeight: 1000, color: "#0f172a" }}>Locked fields for transparency</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <InfoTile icon="alternate_email" label="Email (Locked)" value={email} muted mono right={<Pill icon="lock" text="Locked" tone="grey" />} />
          <InfoTile icon="person" label="Username (Locked)" value={username} muted mono right={<Pill icon="lock" text="Locked" tone="grey" />} />
          <InfoTile icon="badge" label="Employee ID (Locked)" value={employeeId || "—"} muted right={<Pill icon="lock" text="Locked" tone="grey" />} />
          <InfoTile icon="event_available" label="Start Date (Locked)" value={started} muted right={<Pill icon="lock" text="Locked" tone="grey" />} />
          <InfoTile icon="schedule" label="Created (Locked)" value={createdAt} muted right={<Pill icon="lock" text="Locked" tone="grey" />} />
          <InfoTile icon="update" label="Updated (Locked)" value={updatedAt} muted right={<Pill icon="lock" text="Locked" tone="grey" />} />
        </div>
        <div style={{ color: "#607d8b", fontWeight: 800, fontSize: 12, lineHeight: 1.6 }}>
          Locked fields stay visible for transparency, but only the editable cards above can be updated here.
        </div>
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
