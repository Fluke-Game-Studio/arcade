// src/components/ApplicantDetailsModal.tsx
import { useEffect, useMemo, useRef } from "react";
import type { ReactElement } from "react";
import type { ApiApplicantDetails } from "../api";
import type { ApplicantRowLite, Stage } from "./ApplicantComposerModal";

declare const M: any;

// ------------------------------------------------------------
// Tiny utils (local)
// ------------------------------------------------------------
function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function isObject(v: any) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseDateSafe(iso?: string) {
  const s = safeStr(iso);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDate(iso?: string) {
  const d = parseDateSafe(iso);
  if (!d) return "—";
  try {
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString();
  }
}

function renderValue(v: any): ReactElement {
  if (v === null || v === undefined) return <span className="grey-text">—</span>;
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  if (typeof v === "number") return <span>{String(v)}</span>;

  if (typeof v === "string") {
    const s = v.trim();
    const isUrl = /^https?:\/\//i.test(s);
    if (isUrl) {
      return (
        <a href={s} target="_blank" rel="noreferrer">
          {s}
        </a>
      );
    }
    return <span style={{ whiteSpace: "pre-wrap" }}>{s || "—"}</span>;
  }

  if (Array.isArray(v)) {
    if (!v.length) return <span className="grey-text">—</span>;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {v.map((x, i) => (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.10)",
              background: "rgba(0,0,0,0.03)",
              fontWeight: 800,
              fontSize: 12,
              lineHeight: "12px",
            }}
          >
            {safeStr(x) || "—"}
          </span>
        ))}
      </div>
    );
  }

  return (
    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
      {JSON.stringify(v, null, 2)}
    </pre>
  );
}

function guessStageFromStatus(statusRaw: string): Stage | "Unknown" {
  const s = safeStr(statusRaw).toLowerCase();
  if (!s) return "Unknown";
  if (s.includes("reject")) return "Reject";
  if (s.includes("welcome")) return "Welcome";
  if (s.includes("offer")) return "Offer";
  if (s.includes("nda")) return "NDA";
  if (s.includes("confirm")) return "Confirmation";
  if (s.includes("tech")) return "Technical Interview";
  if (s.includes("intro")) return "Introduction";
  return "Unknown";
}

type BadgeStyle = { bg: string; border: string; fg: string };

const STAGE_BADGE: Record<Stage, BadgeStyle> = {
  Reject: { bg: "#FDE8E8", border: "#F9B4B4", fg: "#8B1E1E" },
  Introduction: { bg: "#f7d699", border: "#ffbc6f", fg: "#8a641e" },
  "Technical Interview": { bg: "#E3EEFF", border: "#94BFFF", fg: "#163A8A" },
  Confirmation: { bg: "#F2E8FF", border: "#CFA7FF", fg: "#4B1E8B" },
  NDA: { bg: "#E8E8FF", border: "#A7A6FF", fg: "#2B2B8A" },
  Offer: { bg: "#E6FAFF", border: "#86DFF5", fg: "#0B4B5A" },
  Welcome: { bg: "#E9F9EF", border: "#9FE0B5", fg: "#14532D" },
};

function StatusPill({ status }: { status: string }) {
  const s = safeStr(status) || "—";
  const stageGuess = guessStageFromStatus(s);
  const stg: Stage = stageGuess === "Unknown" ? "Introduction" : (stageGuess as Stage);
  const css = STAGE_BADGE[stg];

  return (
    <span
      title={s}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 11px",
        borderRadius: 999,
        border: `1px solid ${css.border}`,
        background: css.bg,
        color: css.fg,
        fontWeight: 1000,
        lineHeight: "16px",
        maxWidth: 260,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: css.fg,
          opacity: 0.9,
          flex: "0 0 auto",
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
    </span>
  );
}

// ------------------------------------------------------------
// Readable answers handling
// ------------------------------------------------------------
function normalizeReadableAnswers(details: ApiApplicantDetails) {
  const payload = (details as any).payload || {};

  const readable =
    payload?.answersReadable ||
    payload?.answers_readable ||
    payload?.answers_readable_map ||
    (details as any).answersReadable ||
    null;

  const raw =
    payload?.answersRaw ||
    payload?.answers_raw ||
    payload?.answers ||
    (details as any).answers ||
    null;

  return {
    answersReadable: isObject(readable) ? (readable as Record<string, any>) : null,
    answersRaw: isObject(raw) ? (raw as Record<string, any>) : null,
  };
}

function pickFirstLinkByNeedle(
  readable: Record<string, any> | null,
  raw: Record<string, any> | null,
  needles: string[]
) {
  const ns = needles.map((x) => x.toLowerCase());

  const scan = (obj: Record<string, any> | null) => {
    if (!obj) return "";
    for (const [k, v] of Object.entries(obj)) {
      const kk = String(k || "").toLowerCase();
      const vv = safeStr(v).trim();
      if (!vv) continue;
      const isUrl = /^https?:\/\//i.test(vv);
      if (!isUrl) continue;
      if (ns.some((n) => kk.includes(n))) return vv;
    }
    return "";
  };

  return scan(readable) || scan(raw) || "";
}

type ApplicantDetailsView = {
  id: string;
  fullName: string;
  email: string;

  roleId: string;
  roleTitle: string;
  status: string;

  submittedAt: string;
  createdAt: string;
  updatedAt: string;

  source: string;
  formVersion: string;
  sourceIp: string;
  userAgent: string;

  googleName: string;
  googleEmail: string;
  googleImageUrl: string;

  resumeLink: string;
  portfolioLink: string;

  answersReadable: Record<string, any> | null;
  answersRaw: Record<string, any> | null;

  address?: string;
  city?: string;

  raw: ApiApplicantDetails;
};

function normalizeDetails(d: ApiApplicantDetails): ApplicantDetailsView {
  const payload = (d as any).payload || {};
  const applicant = payload?.applicant || {};
  const role = payload?.role || {};
  const google = payload?.google || {};

  const { answersReadable, answersRaw } = normalizeReadableAnswers(d);

  const roleId = safeStr((d as any).roleId || role?.id || (answersRaw as any)?.roleId);
  const roleTitle = safeStr((d as any).roleTitle || role?.title || (answersRaw as any)?.roleTitle);

  const addr =
    payload?.applicant?.address ||
    payload?.general?.address ||
    payload?.address ||
    (d as any).address ||
    "";

  const city =
    payload?.applicant?.city ||
    payload?.general?.city ||
    payload?.city ||
    (d as any).city ||
    "";

  const resumeFromApplicant = safeStr(applicant?.resumeLink).trim();
  const portfolioFromApplicant = safeStr(applicant?.portfolioLink).trim();

  const resumeLink =
    resumeFromApplicant ||
    pickFirstLinkByNeedle(answersReadable, answersRaw, ["resume", "cv"]) ||
    "";

  const portfolioLink =
    portfolioFromApplicant ||
    pickFirstLinkByNeedle(answersReadable, answersRaw, ["portfolio", "website"]) ||
    "";

  return {
    id: safeStr((d as any).applicant_id || (d as any).id || (d as any).applicantId),
    fullName: safeStr((d as any).fullName || applicant?.fullName),
    email: safeStr((d as any).email || applicant?.email),

    roleId,
    roleTitle,
    status: safeStr((d as any).status),

    source: safeStr((d as any).source || payload?.meta?.source),
    formVersion: safeStr((d as any).formVersion || payload?.meta?.formVersion),
    submittedAt: safeStr((d as any).submittedAt || payload?.meta?.submittedAt),
    createdAt: safeStr((d as any).createdAt),
    updatedAt: safeStr((d as any).updatedAt),

    sourceIp: safeStr((d as any).sourceIp),
    userAgent: safeStr((d as any).userAgent),

    googleName: safeStr(google?.name),
    googleEmail: safeStr(google?.email),
    googleImageUrl: safeStr(google?.imageUrl),

    resumeLink,
    portfolioLink,

    answersReadable,
    answersRaw,

    address: safeStr(addr) || undefined,
    city: safeStr(city) || undefined,

    raw: d,
  };
}

function renderQACards(title: string, qa: Record<string, any> | null) {
  const entries = Object.entries(qa || {}).filter(([_, v]) => {
    if (v === undefined || v === null) return false;
    if (typeof v === "string") return !!safeStr(v).trim();
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });

  if (!entries.length) return null;

  return (
    <div className="fg-card" style={{ marginTop: 14 }}>
      <div className="fg-card-h">
        <div style={{ fontWeight: 1000 }}>{title}</div>
      </div>
      <div className="fg-card-b">
        <div style={{ display: "grid", gap: 10 }}>
          {entries.map(([k, v]) => (
            <div
              key={k}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.07)",
                background: "rgba(0,0,0,0.02)",
              }}
            >
              <div style={{ fontWeight: 1000, marginBottom: 6 }}>{k}</div>
              <div style={{ color: "rgba(0,0,0,0.72)" }}>{renderValue(v)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderMetaTable(details: ApplicantDetailsView) {
  const meta: Record<string, any> = {
    source: details.source,
    formVersion: details.formVersion,
    updatedAt: details.updatedAt,
    sourceIp: details.sourceIp,
    userAgent: details.userAgent,
    googleEmail: details.googleEmail,
    googleName: details.googleName,
  };

  const entries = Object.entries(meta).filter(([_, v]) => safeStr(v).trim());
  if (!entries.length) return <div className="grey-text">—</div>;

  return (
    <table className="striped" style={{ marginTop: 8 }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k}>
            <td style={{ width: 240, fontWeight: 900 }}>{k}</td>
            <td>{renderValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ------------------------------------------------------------
// Component (FIXED lifecycle)
// ------------------------------------------------------------
export default function ApplicantDetailsModal({
  open,
  loading,
  detailsRaw,
  onClose,
  onOpenComposer,
}: {
  open: boolean;
  loading: boolean;
  detailsRaw: ApiApplicantDetails | null;
  onClose: () => void;
  onOpenComposer: (lite: ApplicantRowLite, prefill?: { address?: string; city?: string }) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const instRef = useRef<any>(null);

  // keep latest onClose without re-init loops
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const details = useMemo(() => (detailsRaw ? normalizeDetails(detailsRaw) : null), [detailsRaw]);

  // init ONCE
  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;

    instRef.current = M.Modal.init(modalRef.current, {
      dismissible: true,
      opacity: 0.45,
      inDuration: 140,
      outDuration: 120,
      // IMPORTANT: don't call prop onClose directly (avoids re-init loops)
      onCloseEnd: () => {
        try {
          onCloseRef.current?.();
        } catch {}
      },
      onOpenStart: () => {
        try {
          modalRef.current!.style.left = "0px";
          modalRef.current!.style.right = "0px";
          modalRef.current!.style.margin = "auto";
        } catch {}
      },
      onOpenEnd: () =>
        setTimeout(() => {
          try {
            M.updateTextFields();
          } catch {}
        }, 0),
    });

    return () => {
      try {
        instRef.current?.destroy?.();
      } catch {}
      instRef.current = null;
    };
  }, []);

  // drive open/close safely (no extra close at mount)
  useEffect(() => {
    const inst = instRef.current;
    if (!inst) return;

    if (open) {
      try {
        inst.open();
      } catch {}
      return;
    }

    // only close if it *is* open (prevents close->callback loops on init)
    try {
      const isOpen = !!(inst && (inst.isOpen === true || inst._isOpen === true));
      if (isOpen) inst.close();
    } catch {
      // fallback: don't force close
    }
  }, [open]);

  const Css = (
    <style>{`
      .fg-card {
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 14px 34px rgba(0,0,0,0.06);
        border: 1px solid rgba(0,0,0,0.06);
        background: #fff;
      }
      .fg-card-h {
        padding: 12px 14px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        background: linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.00));
      }
      .fg-card-b { padding: 14px; }
      .fg-btn { border-radius: 12px !important; font-weight: 900 !important; }
      .fg-kpi {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }
      @media (max-width: 900px) { .fg-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (max-width: 620px) { .fg-kpi { grid-template-columns: 1fr; } }
      .fg-kpi .box{
        padding: 12px;
        border-radius: 16px;
        background: rgba(0,0,0,0.02);
        border: 1px solid rgba(0,0,0,0.06);
      }
      .fg-kpi .k { font-size: 12px; font-weight: 1000; opacity: 0.65; text-transform: uppercase; letter-spacing: 0.6px; }
      .fg-kpi .v { font-size: 16px; font-weight: 1100; margin-top: 6px; }
      .modal {
        left: 0 !important;
        right: 0 !important;
        margin: auto !important;
        border-radius: 18px !important;
        max-width: 980px !important;
      }
      .modal.modal-fixed-footer { height: 85% !important; }
    `}</style>
  );

  return (
    <div ref={modalRef} className="modal modal-fixed-footer">
      {Css}
      <div className="modal-content">
        <h5 style={{ marginBottom: 6, fontWeight: 1100 }}>Applicant Details</h5>

        {loading ? (
          <p className="grey-text">Loading details…</p>
        ) : !details ? (
          <p className="grey-text">No applicant selected.</p>
        ) : (
          <>
            <div className="fg-card" style={{ marginTop: 14 }}>
              <div className="fg-card-b">
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {details.googleImageUrl ? (
                    <img
                      src={details.googleImageUrl}
                      alt="profile"
                      style={{ width: 52, height: 52, borderRadius: 999, border: "1px solid rgba(0,0,0,0.10)" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.06)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 1100,
                      }}
                    >
                      {safeStr(details.fullName).slice(0, 1).toUpperCase() || "A"}
                    </div>
                  )}

                  <div style={{ flex: "1 1 auto" }}>
                    <div style={{ fontWeight: 1100, fontSize: 18 }}>{details.fullName || "—"}</div>
                    <div className="grey-text" style={{ fontWeight: 1000 }}>{details.email || "—"}</div>
                  </div>

                  <div style={{ flex: "0 0 auto" }}>
                    <StatusPill status={details.status || "—"} />
                  </div>
                </div>

                <div className="fg-kpi" style={{ marginTop: 12 }}>
                  <div className="box">
                    <div className="k">Role</div>
                    <div className="v">{details.roleTitle || "—"}</div>
                    {details.roleId ? <div className="grey-text" style={{ fontWeight: 900 }}>{details.roleId}</div> : null}
                  </div>
                  <div className="box"><div className="k">Submitted</div><div className="v">{fmtDate(details.submittedAt)}</div></div>
                  <div className="box"><div className="k">Created</div><div className="v">{fmtDate(details.createdAt)}</div></div>
                  <div className="box"><div className="k">Updated</div><div className="v">{fmtDate(details.updatedAt)}</div></div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {details.portfolioLink ? (
                    <a className="btn-flat" href={details.portfolioLink} target="_blank" rel="noreferrer">
                      <i className="material-icons left">open_in_new</i>Portfolio
                    </a>
                  ) : (
                    <span className="grey-text">No portfolio link</span>
                  )}

                  {details.resumeLink ? (
                    <a className="btn-flat" href={details.resumeLink} target="_blank" rel="noreferrer">
                      <i className="material-icons left">description</i>Resume
                    </a>
                  ) : (
                    <span className="grey-text">No resume link</span>
                  )}

                  <span style={{ flex: "1 1 auto" }} />

                  <button
                    className="btn fg-btn"
                    type="button"
                    onClick={() => {
                      const lite: ApplicantRowLite = {
                        id: details.id,
                        name: details.fullName,
                        email: details.email,
                        roleTitle: details.roleTitle,
                        roleId: details.roleId,
                      };
                      onOpenComposer(lite, { address: details.address, city: details.city });
                    }}
                  >
                    <i className="material-icons left">send</i>
                    Open Composer
                  </button>
                </div>
              </div>
            </div>

            {renderQACards("Readable Questions & Answers", details.answersReadable)}
            {details.answersReadable ? null : renderQACards("Captured Fields (raw keys)", details.answersRaw)}

            <div className="fg-card" style={{ marginTop: 14 }}>
              <div className="fg-card-h"><div style={{ fontWeight: 1100 }}>System / Meta</div></div>
              <div className="fg-card-b">
                {renderMetaTable(details)}
                <details style={{ marginTop: 18 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 1000 }}>Raw JSON</summary>
                  <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{JSON.stringify(details.raw, null, 2)}</pre>
                </details>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="modal-footer">
        <a href="#!" className="btn-flat" onClick={() => onCloseRef.current?.()}>
          Close
        </a>
      </div>
    </div>
  );
}
