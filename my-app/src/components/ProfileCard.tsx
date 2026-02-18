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

function fmtMaybeDate(v: any) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }
  return s; // already a formatted string
}

function FieldRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <li className="collection-item" style={{ padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <i
          className="material-icons"
          style={{
            fontSize: 18,
            lineHeight: "22px",
            marginTop: 2,
            color: "#607d8b",
            flex: "0 0 auto",
          }}
        >
          {icon}
        </i>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 0.4, color: "#78909c", textTransform: "uppercase" }}>
            {label}
          </div>
          <div
            style={{
              marginTop: 2,
              color: value === "—" ? "#90a4ae" : "#263238",
              wordBreak: "break-word",
              fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" : undefined,
              fontSize: mono ? 12.5 : 13.5,
            }}
            title={value}
          >
            {value}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function ProfileCard() {
  const { api } = useAuth();
  const [me, setMe] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  const dob = me?.employee_dob ? fmtMaybeDate(me.employee_dob) : "—";
  const empType = safeStr(me?.employment_type) || "—";
  const dept = safeStr(me?.department) || "—";
  const phone = safeStr(me?.employee_phonenumber) || "—";
  const location = safeStr(me?.location) || "—";
  const role = (safeStr(me?.employee_role) || "employee").toUpperCase();

  const avatarFallback = useMemo(() => initials(displayName !== "—" ? displayName : safeStr(me?.username)), [displayName, me?.username]);

  const hasAvatar = !!safeStr(me?.employee_profilepicture);

  return (
    <div
      className="card z-depth-1"
      style={{
        position: "sticky",
        top: 16,
        borderRadius: 14,
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "18px 16px 14px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0b1220 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {/* Avatar */}
          <div style={{ position: "relative", width: 64, height: 64, flex: "0 0 auto" }}>
            {hasAvatar ? (
              <img
                src={me!.employee_profilepicture}
                alt="avatar"
                className="circle"
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.7)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                }}
              />
            ) : (
              <div
                className="circle"
                style={{
                  width: 64,
                  height: 64,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  letterSpacing: 1,
                  background: "rgba(255,255,255,0.12)",
                  border: "2px solid rgba(255,255,255,0.35)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                }}
                aria-label="avatar-fallback"
                title={displayName}
              >
                {avatarFallback}
              </div>
            )}

            {/* Online dot (optional visual polish) */}
            <span
              style={{
                position: "absolute",
                right: 2,
                bottom: 2,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#22c55e",
                border: "2px solid rgba(15, 23, 42, 0.9)",
              }}
              title="Active"
            />
          </div>

          {/* Identity */}
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: "20px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
                title={displayName}
              >
                {loading ? "Loading…" : displayName}
              </div>

              <span
                className="chip"
                style={{
                  height: 26,
                  lineHeight: "26px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "white",
                  fontWeight: 700,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {role}
              </span>
            </div>

            <div style={{ marginTop: 4, color: "rgba(255,255,255,0.78)", fontSize: 12.5 }}>
              {title !== "—" ? title : "—"}
            </div>

            {/* Secondary line */}
            <div style={{ marginTop: 6, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
              {email !== "—" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <i className="material-icons" style={{ fontSize: 16, opacity: 0.9 }}>
                    alternate_email
                  </i>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                </span>
              ) : (
                <span style={{ opacity: 0.8 }}>—</span>
              )}
            </div>
          </div>
        </div>

        {/* Skeleton shimmer */}
        {loading && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.18)", width: "72%" }} />
            <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.14)", width: "54%", marginTop: 8 }} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="card-content" style={{ padding: 0 }}>
        <ul className="collection" style={{ margin: 0, border: "none" }}>
          <FieldRow icon="event" label="Date of birth" value={dob} />
          <FieldRow icon="work" label="Employment" value={empType} />
          <FieldRow icon="account_tree" label="Department" value={dept} />
          <FieldRow icon="location_on" label="Location" value={location} />
          <FieldRow icon="call" label="Phone" value={phone} />
          <FieldRow icon="alternate_email" label="Email" value={email} mono />
        </ul>
      </div>

      {/* Footer actions (optional but pro) */}
      <div
        className="card-action"
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          borderTop: "1px solid #eceff1",
          background: "#fafafa",
        }}
      >
        <span style={{ fontSize: 12, color: "#607d8b" }}>
          {me?.username ? (
            <>
              Username:{" "}
              <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                {me.username}
              </span>
            </>
          ) : (
            "—"
          )}
        </span>

        <button
          className="btn-flat"
          type="button"
          onClick={() => {
            if (typeof M !== "undefined") M.toast({ html: "Profile is read-only.", classes: "blue-grey darken-1" });
          }}
          style={{
            borderRadius: 10,
            fontWeight: 700,
            textTransform: "none",
            padding: "0 10px",
          }}
          title="Edit (coming soon)"
        >
          <i className="material-icons left">edit</i>
          Edit
        </button>
      </div>
    </div>
  );
}
