// src/components/ApplicantComposerModal.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import type {
  ApplicantRichEmailType,
  ApplicantDocEmailType,
  SendApplicantRichEmailBody,
  SendApplicantDocEmailBody,
  SendApplicantWelcomeEmailBody,
} from "../api";

declare const M: any;

// ------------------------------------------------------------
// Stages
// ------------------------------------------------------------
export type Stage =
  | "Introduction"
  | "Technical Interview"
  | "Confirmation"
  | "Reject"
  | "NDA"
  | "Offer"
  | "Welcome";

const STAGES: Stage[] = [
  "Introduction",
  "Technical Interview",
  "Confirmation",
  "Reject",
  "NDA",
  "Offer",
  "Welcome",
];

// ✅ Widen local rich type so TS compiles even if ../api isn't updated yet
type RichType = ApplicantRichEmailType | "CONFIRMATION";

// ✅ Widen body shape for confirmation fields
type RichBody = Omit<SendApplicantRichEmailBody, "type"> & {
  type: RichType;
  meetingTitle?: string;
  meetingWhen?: string;
  meetingLink?: string;
  subjectOverride?: string;
};

// Mapping to backend action types
const STAGE_TO_RICH_TYPE: Record<Stage, RichType | null> = {
  Introduction: "INTRO",
  "Technical Interview": "TECH",
  Confirmation: "CONFIRMATION",
  Reject: "REJECT",
  NDA: null,
  Offer: null,
  Welcome: null,
};

const STAGE_TO_DOC_TYPE: Record<Stage, ApplicantDocEmailType | null> = {
  Introduction: null,
  "Technical Interview": null,
  Confirmation: null,
  Reject: null,
  NDA: "NDA",
  Offer: "OFFER",
  Welcome: null,
};

const DEFAULT_SET_STATUS: Record<Stage, string> = {
  Introduction: "intro_sent",
  "Technical Interview": "tech_sent",
  Confirmation: "confirmation_sent",
  Reject: "rejected",
  NDA: "nda_sent",
  Offer: "offer_sent",
  Welcome: "welcome_sent",
};

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
export type ApplicantRowLite = {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  roleId: string;
};

type ComposerState = {
  stage: Stage;
  roleTitle: string;
  setStatus: string;

  // vars.common
  vars_extraInfo: string;

  // INTRO
  calendlyUrl: string;

  // CONFIRMATION
  meetingTitle: string;
  meetingWhen: string;
  meetingLink: string;
  confirmationSubjectOverride: string;

  // DOC
  subjectOverride: string;
  address: string;
  vars_city: string;
  vars_country: string;

  // OFFER
  dateStarted: string; // YYYY-MM-DD
  employment_type: string;
  employee_role: "employee" | "admin" | "super";
  createEmployeeUser: boolean;
  vars_stipend: string;
  vars_workMode: string;
  vars_weeklyHours: string;

  // WELCOME
  welcome_department: string;
  welcome_address: string;
  welcome_city: string;
  welcome_dateStarted: string; // YYYY-MM-DD
  welcome_subjectOverride: string;
};

function defaultComposer(stage: Stage): ComposerState {
  return {
    stage,
    roleTitle: "",
    setStatus: DEFAULT_SET_STATUS[stage] || "",

    vars_extraInfo: "",

    calendlyUrl: "https://calendly.com/flukegames/talent-intro",

    meetingTitle: "Fluke Games — Interview",
    meetingWhen: "",
    meetingLink: "",
    confirmationSubjectOverride: "",

    subjectOverride: "",
    address: "",
    vars_city: "",
    vars_country: "",

    dateStarted: "",
    employment_type: "intern",
    employee_role: "employee",
    createEmployeeUser: true,
    vars_stipend: "₹5000/month",
    vars_workMode: "Remote",
    vars_weeklyHours: "10-15",

    welcome_department: "Engineering",
    welcome_address: "",
    welcome_city: "",
    welcome_dateStarted: "",
    welcome_subjectOverride: "Welcome to Fluke Games!",
  };
}

function stageIsWired(stage: Stage) {
  return stage === "Welcome" || !!STAGE_TO_RICH_TYPE[stage] || !!STAGE_TO_DOC_TYPE[stage];
}

// ------------------------------------------------------------
// Component
// ------------------------------------------------------------
export default function ApplicantComposerModal({
  api,
  open,
  onClose,
  applicant,
  prefillAddress,
  prefillCity,
}: {
  api: any;
  open: boolean;
  onClose: () => void;
  applicant: ApplicantRowLite | null;
  prefillAddress?: string;
  prefillCity?: string;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [sending, setSending] = useState(false);
  const [toEmail, setToEmail] = useState("");
  const [composerApplicantId, setComposerApplicantId] = useState<string>("");
  const [composer, setComposer] = useState<ComposerState>(() => defaultComposer("Introduction"));
  const [previewJson, setPreviewJson] = useState<string>("{}");

  // init Materialize modal once
  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;

    M.Modal.init(modalRef.current, {
      dismissible: true,
      opacity: 0.45,
      inDuration: 140,
      outDuration: 120,
      onCloseEnd: () => onClose(),
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
  }, [onClose]);

  // open/close imperatively
  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    if (open) inst.open();
    else inst.close();
  }, [open]);

  // when applicant changes, lock target
  useEffect(() => {
    if (!applicant?.id) return;

    const base = defaultComposer("Introduction");
    base.roleTitle = applicant.roleTitle || "";
    base.setStatus = DEFAULT_SET_STATUS["Introduction"];

    // best-effort prefills
    if (prefillAddress) base.address = prefillAddress;
    if (prefillCity) base.vars_city = prefillCity;
    if (prefillAddress) base.welcome_address = prefillAddress;
    if (prefillCity) base.welcome_city = prefillCity;

    setComposer(base);
    setToEmail(applicant.email || "");
    setComposerApplicantId(applicant.id);
    buildPreview(base, applicant.email || "", applicant.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicant?.id]);

  function buildPreview(c: ComposerState, email: string, applicantId: string) {
    const stage = c.stage;

    if (stage === "Welcome") {
      const note = c.vars_extraInfo?.trim() ? c.vars_extraInfo.trim() : undefined;

      const vars: Record<string, any> = {
        APPLICANT_ID: applicantId,
        department: c.welcome_department || "",
        address: c.welcome_address || "",
        city: c.welcome_city || "",
        dateStarted: c.welcome_dateStarted || "",
        DEPARTMENT: c.welcome_department || "",
        ADDRESS: c.welcome_address || "",
        CITY: c.welcome_city || "",
        START_DATE: c.welcome_dateStarted || "",
        ...(note
          ? { extraInfo: note, EXTRA_INFO: note, DOC_NOTES: note, WELCOME_NOTES: note }
          : {}),
      };

      const body: SendApplicantWelcomeEmailBody = {
        type: "WELCOME",
        roleTitle: c.roleTitle || "",
        department: c.welcome_department || "",
        address: c.welcome_address || "",
        city: c.welcome_city || "",
        dateStarted: c.welcome_dateStarted || "",
        subjectOverride: c.welcome_subjectOverride || "",
        applicantId: applicantId || undefined,
        extraInfo: note,
        vars,
        setStatus: c.setStatus?.trim() ? c.setStatus.trim() : undefined,
      };

      setPreviewJson(
        JSON.stringify(
          {
            endpoint: "POST /admin/applicants/{applicantId}/send-welcome-email",
            applicantId,
            to: email,
            body,
          },
          null,
          2
        )
      );
      return;
    }

    const richType = STAGE_TO_RICH_TYPE[stage];
    const docType = STAGE_TO_DOC_TYPE[stage];

    if (richType) {
      const body: RichBody = {
        type: richType,
        roleTitle: c.roleTitle || "",
        ...(richType === "INTRO" ? { calendlyUrl: c.calendlyUrl || "" } : {}),
        ...(richType === "CONFIRMATION"
          ? {
              meetingTitle: c.meetingTitle || "",
              meetingWhen: c.meetingWhen || "",
              meetingLink: c.meetingLink || "",
              subjectOverride: c.confirmationSubjectOverride?.trim()
                ? c.confirmationSubjectOverride.trim()
                : undefined,
            }
          : {}),
        vars: c.vars_extraInfo?.trim() ? { extraInfo: c.vars_extraInfo.trim() } : undefined,
        setStatus: c.setStatus?.trim() ? c.setStatus.trim() : undefined,
      };

      setPreviewJson(
        JSON.stringify(
          {
            endpoint: "POST /admin/applicants/{applicantId}/send-rich-email",
            applicantId,
            to: email,
            body,
          },
          null,
          2
        )
      );
      return;
    }

    if (docType) {
      const vars: Record<string, any> = {};
      if (c.vars_extraInfo?.trim()) vars.extraInfo = c.vars_extraInfo.trim();

      if (docType === "NDA") {
        if (c.address?.trim()) vars.address = c.address.trim();
        if (c.vars_city?.trim()) vars.city = c.vars_city.trim();
        if (c.vars_country?.trim()) vars.country = c.vars_country.trim();
      }

      if (docType === "OFFER") {
        if (c.vars_stipend?.trim()) vars.stipend = c.vars_stipend.trim();
        if (c.vars_workMode?.trim()) vars.workMode = c.vars_workMode.trim();
        if (c.vars_weeklyHours?.trim()) vars.weeklyHours = c.vars_weeklyHours.trim();
      }

      const body: SendApplicantDocEmailBody = {
        type: docType,
        roleTitle: c.roleTitle || "",
        subjectOverride: c.subjectOverride?.trim() ? c.subjectOverride.trim() : undefined,
        setStatus: c.setStatus?.trim() ? c.setStatus.trim() : undefined,
        vars: Object.keys(vars).length ? vars : undefined,
        ...(docType === "OFFER"
          ? {
              dateStarted: c.dateStarted || "",
              employment_type: c.employment_type || "intern",
              employee_role: c.employee_role,
              createEmployeeUser: !!c.createEmployeeUser,
            }
          : {}),
      };

      setPreviewJson(
        JSON.stringify(
          {
            endpoint: "POST /admin/applicants/{applicantId}/send-doc-email",
            applicantId,
            to: email,
            body,
          },
          null,
          2
        )
      );
      return;
    }

    setPreviewJson(JSON.stringify({ endpoint: "NOT WIRED", applicantId, to: email, body: { stage } }, null, 2));
  }

  function updateComposer(patch: Partial<ComposerState>) {
    const next = { ...composer, ...patch };
    setComposer(next);
    buildPreview(next, toEmail, composerApplicantId || "");
  }

  async function sendNow() {
    const applicantId = composerApplicantId;

    if (!applicantId) return M?.toast?.({ html: "Missing applicant id", classes: "red" });
    if (!toEmail.trim()) return M?.toast?.({ html: "Recipient email missing", classes: "red" });
    if (!composer.roleTitle.trim()) return M?.toast?.({ html: "Role Title is required", classes: "red" });

    if (!stageIsWired(composer.stage)) {
      return M?.toast?.({ html: "This action is not wired.", classes: "orange darken-2" });
    }

    setSending(true);
    try {
      if (composer.stage === "Welcome") {
        if (!composer.welcome_dateStarted) {
          M?.toast?.({ html: "Welcome: dateStarted is required", classes: "red" });
          return;
        }

        const note = composer.vars_extraInfo.trim() ? composer.vars_extraInfo.trim() : undefined;

        const vars: Record<string, any> = {
          APPLICANT_ID: applicantId,
          department: composer.welcome_department.trim(),
          address: composer.welcome_address.trim(),
          city: composer.welcome_city.trim(),
          dateStarted: composer.welcome_dateStarted,
          DEPARTMENT: composer.welcome_department.trim(),
          ADDRESS: composer.welcome_address.trim(),
          CITY: composer.welcome_city.trim(),
          START_DATE: composer.welcome_dateStarted,
          ...(note ? { extraInfo: note, EXTRA_INFO: note, DOC_NOTES: note, WELCOME_NOTES: note } : {}),
        };

        const body: SendApplicantWelcomeEmailBody = {
          type: "WELCOME",
          roleTitle: composer.roleTitle.trim(),
          department: composer.welcome_department.trim(),
          address: composer.welcome_address.trim(),
          city: composer.welcome_city.trim(),
          dateStarted: composer.welcome_dateStarted,
          subjectOverride: composer.welcome_subjectOverride.trim(),
          applicantId,
          extraInfo: note,
          vars,
          setStatus: composer.setStatus.trim() ? composer.setStatus.trim() : undefined,
        };

        const resp = await (api as any).sendApplicantWelcomeEmail(applicantId, body);
        M?.toast?.({ html: String(resp?.message || resp?.status || "Sent"), classes: "green" });
        onClose();
        return;
      }

      const richType = STAGE_TO_RICH_TYPE[composer.stage];
      const docType = STAGE_TO_DOC_TYPE[composer.stage];

      if (richType) {
        if (richType === "CONFIRMATION") {
          if (!composer.meetingWhen.trim() || !composer.meetingLink.trim()) {
            M?.toast?.({ html: "Confirmation: meetingWhen + meetingLink required", classes: "red" });
            return;
          }
        }

        const body: RichBody = {
          type: richType,
          roleTitle: composer.roleTitle.trim(),
          ...(richType === "INTRO" ? { calendlyUrl: composer.calendlyUrl.trim() } : {}),
          ...(richType === "CONFIRMATION"
            ? {
                meetingTitle: composer.meetingTitle.trim(),
                meetingWhen: composer.meetingWhen.trim(),
                meetingLink: composer.meetingLink.trim(),
                subjectOverride: composer.confirmationSubjectOverride.trim()
                  ? composer.confirmationSubjectOverride.trim()
                  : undefined,
              }
            : {}),
          vars: composer.vars_extraInfo.trim() ? { extraInfo: composer.vars_extraInfo.trim() } : undefined,
          setStatus: composer.setStatus.trim() ? composer.setStatus.trim() : undefined,
        };

        // ✅ Cast at boundary (your api typing may not accept CONFIRMATION yet)
        const resp = await (api as any).sendApplicantRichEmail(applicantId, body as any);
        M?.toast?.({ html: String(resp?.message || resp?.status || "Sent"), classes: "green" });
        onClose();
        return;
      }

      if (docType) {
        if (docType === "OFFER" && !composer.dateStarted) {
          M?.toast?.({ html: "Offer: dateStarted is required", classes: "red" });
          return;
        }

        const vars: Record<string, any> = {};
        if (composer.vars_extraInfo.trim()) vars.extraInfo = composer.vars_extraInfo.trim();

        if (docType === "NDA") {
          if (composer.address.trim()) vars.address = composer.address.trim();
          if (composer.vars_city.trim()) vars.city = composer.vars_city.trim();
          if (composer.vars_country.trim()) vars.country = composer.vars_country.trim();
        }

        if (docType === "OFFER") {
          if (composer.vars_stipend.trim()) vars.stipend = composer.vars_stipend.trim();
          if (composer.vars_workMode.trim()) vars.workMode = composer.vars_workMode.trim();
          if (composer.vars_weeklyHours.trim()) vars.weeklyHours = composer.vars_weeklyHours.trim();
        }

        const body: SendApplicantDocEmailBody = {
          type: docType,
          roleTitle: composer.roleTitle.trim(),
          subjectOverride: composer.subjectOverride.trim() ? composer.subjectOverride.trim() : undefined,
          setStatus: composer.setStatus.trim() ? composer.setStatus.trim() : undefined,
          vars: Object.keys(vars).length ? vars : undefined,
          ...(docType === "OFFER"
            ? {
                dateStarted: composer.dateStarted,
                employment_type: composer.employment_type || "intern",
                employee_role: composer.employee_role,
                createEmployeeUser: !!composer.createEmployeeUser,
              }
            : {}),
        };

        const resp = await api.sendApplicantDocEmail(applicantId, body);
        M?.toast?.({ html: String(resp?.message || resp?.status || "Sent"), classes: "green" });
        onClose();
        return;
      }
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Send failed", classes: "red" });
    } finally {
      setSending(false);
    }
  }

  const wiredNote = useMemo(() => {
    if (!stageIsWired(composer.stage)) return "This stage is not wired yet.";
    if (composer.stage === "Confirmation")
      return "Sends a confirmation email with Yes/No/Reschedule actions (handled by backend).";
    return "";
  }, [composer.stage]);

  function renderComposerFields(): ReactElement {
    const stage = composer.stage;
    const richType = STAGE_TO_RICH_TYPE[stage];
    const docType = STAGE_TO_DOC_TYPE[stage];

    return (
      <>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m8">
            <input value={composer.roleTitle} onChange={(e) => updateComposer({ roleTitle: e.target.value })} />
            <label className="active">roleTitle</label>
          </div>
          <div className="input-field col s12 m4">
            <input value={composer.setStatus} onChange={(e) => updateComposer({ setStatus: e.target.value })} />
            <label className="active">setStatus</label>
          </div>
        </div>

        {wiredNote ? (
          <div className="card-panel" style={{ borderRadius: 14, background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div className="grey-text" style={{ fontWeight: 1000 }}>
              {wiredNote}
            </div>
          </div>
        ) : null}

        {/* RICH */}
        {richType && (
          <>
            {richType === "INTRO" && (
              <div className="input-field" style={{ marginTop: 6 }}>
                <input value={composer.calendlyUrl} onChange={(e) => updateComposer({ calendlyUrl: e.target.value })} />
                <label className="active">calendlyUrl</label>
              </div>
            )}

            {richType === "CONFIRMATION" && (
              <>
                <div className="row" style={{ marginBottom: 0 }}>
                  <div className="input-field col s12 m6">
                    <input value={composer.meetingTitle} onChange={(e) => updateComposer({ meetingTitle: e.target.value })} />
                    <label className="active">meetingTitle</label>
                  </div>
                  <div className="input-field col s12 m6">
                    <input
                      value={composer.confirmationSubjectOverride}
                      onChange={(e) => updateComposer({ confirmationSubjectOverride: e.target.value })}
                    />
                    <label className="active">subjectOverride (optional)</label>
                  </div>
                </div>

                <div className="row" style={{ marginBottom: 0 }}>
                  <div className="input-field col s12 m6">
                    <input value={composer.meetingWhen} onChange={(e) => updateComposer({ meetingWhen: e.target.value })} />
                    <label className="active">meetingWhen (e.g., Feb 14, 7:30 PM IST)</label>
                  </div>
                  <div className="input-field col s12 m6">
                    <input value={composer.meetingLink} onChange={(e) => updateComposer({ meetingLink: e.target.value })} />
                    <label className="active">meetingLink</label>
                  </div>
                </div>
              </>
            )}

            <div className="input-field" style={{ marginTop: 14 }}>
              <textarea
                className="materialize-textarea"
                value={composer.vars_extraInfo}
                onChange={(e) => updateComposer({ vars_extraInfo: e.target.value })}
                style={{ minHeight: 90 }}
              />
              <label className="active">vars.extraInfo</label>
            </div>
          </>
        )}

        {/* DOC */}
        {docType && (
          <>
            <div className="input-field" style={{ marginTop: 6 }}>
              <input value={composer.subjectOverride} onChange={(e) => updateComposer({ subjectOverride: e.target.value })} />
              <label className="active">subjectOverride (optional)</label>
            </div>

            <div className="input-field" style={{ marginTop: 14 }}>
              <textarea
                className="materialize-textarea"
                value={composer.vars_extraInfo}
                onChange={(e) => updateComposer({ vars_extraInfo: e.target.value })}
                style={{ minHeight: 90 }}
              />
              <label className="active">vars.extraInfo</label>
            </div>
          </>
        )}

        {docType === "NDA" && (
          <>
            <div className="input-field" style={{ marginTop: 6 }}>
              <input value={composer.address} onChange={(e) => updateComposer({ address: e.target.value })} />
              <label className="active">address (optional)</label>
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m6">
                <input value={composer.vars_city} onChange={(e) => updateComposer({ vars_city: e.target.value })} />
                <label className="active">vars.city</label>
              </div>
              <div className="input-field col s12 m6">
                <input value={composer.vars_country} onChange={(e) => updateComposer({ vars_country: e.target.value })} />
                <label className="active">vars.country</label>
              </div>
            </div>
          </>
        )}

        {docType === "OFFER" && (
          <>
            <div className="row" style={{ marginBottom: 0 }}>
              <div className="col s12 m4" style={{ marginTop: 6 }}>
                <div className="grey-text" style={{ fontWeight: 1000, marginBottom: 6 }}>
                  dateStarted
                </div>
                <input type="date" value={composer.dateStarted} onChange={(e) => updateComposer({ dateStarted: e.target.value })} />
              </div>

              <div className="input-field col s12 m4">
                <input value={composer.employment_type} onChange={(e) => updateComposer({ employment_type: e.target.value })} />
                <label className="active">employment_type</label>
              </div>

              <div className="input-field col s12 m4">
                <select
                  className="browser-default"
                  value={composer.employee_role}
                  onChange={(e) => updateComposer({ employee_role: e.target.value as any })}
                >
                  <option value="employee">employee</option>
                  <option value="admin">admin</option>
                  <option value="super">super</option>
                </select>
                <label className="active" style={{ position: "relative", top: -24 }}>
                  employee_role
                </label>
              </div>
            </div>

            <p style={{ marginTop: 10 }}>
              <label>
                <input
                  type="checkbox"
                  checked={composer.createEmployeeUser}
                  onChange={(e) => updateComposer({ createEmployeeUser: e.target.checked })}
                />
                <span>createEmployeeUser</span>
              </label>
            </p>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m4">
                <input value={composer.vars_stipend} onChange={(e) => updateComposer({ vars_stipend: e.target.value })} />
                <label className="active">vars.stipend</label>
              </div>
              <div className="input-field col s12 m4">
                <input value={composer.vars_workMode} onChange={(e) => updateComposer({ vars_workMode: e.target.value })} />
                <label className="active">vars.workMode</label>
              </div>
              <div className="input-field col s12 m4">
                <input value={composer.vars_weeklyHours} onChange={(e) => updateComposer({ vars_weeklyHours: e.target.value })} />
                <label className="active">vars.weeklyHours</label>
              </div>
            </div>
          </>
        )}

        {/* WELCOME */}
        {stage === "Welcome" && (
          <>
            <div className="card-panel blue lighten-5" style={{ marginTop: 10, marginBottom: 10, borderRadius: 16 }}>
              <b>Tip:</b> This email includes <code>applicantId</code> automatically.
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m6">
                <input value={composer.welcome_department} onChange={(e) => updateComposer({ welcome_department: e.target.value })} />
                <label className="active">department</label>
              </div>
              <div className="input-field col s12 m6">
                <input value={composer.welcome_subjectOverride} onChange={(e) => updateComposer({ welcome_subjectOverride: e.target.value })} />
                <label className="active">subjectOverride</label>
              </div>
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="input-field col s12 m6">
                <input value={composer.welcome_address} onChange={(e) => updateComposer({ welcome_address: e.target.value })} />
                <label className="active">address</label>
              </div>
              <div className="input-field col s12 m6">
                <input value={composer.welcome_city} onChange={(e) => updateComposer({ welcome_city: e.target.value })} />
                <label className="active">city</label>
              </div>
            </div>

            <div className="row" style={{ marginBottom: 0 }}>
              <div className="col s12 m6" style={{ marginTop: 6 }}>
                <div className="grey-text" style={{ fontWeight: 1000, marginBottom: 6 }}>
                  dateStarted
                </div>
                <input
                  type="date"
                  value={composer.welcome_dateStarted}
                  onChange={(e) => updateComposer({ welcome_dateStarted: e.target.value })}
                />
              </div>

              <div className="col s12 m6" style={{ marginTop: 6 }}>
                <div className="grey-text" style={{ fontWeight: 1000, marginBottom: 6 }}>
                  vars.extraInfo (optional)
                </div>
                <textarea
                  className="materialize-textarea"
                  value={composer.vars_extraInfo}
                  onChange={(e) => updateComposer({ vars_extraInfo: e.target.value })}
                  style={{ minHeight: 90 }}
                />
              </div>
            </div>
          </>
        )}

        {!stageIsWired(stage) && (
          <div className="card-panel orange lighten-4" style={{ marginTop: 10, borderRadius: 16 }}>
            <b>Not wired:</b> No backend mapping for <code>{stage}</code>.
          </div>
        )}
      </>
    );
  }

  return (
    <div ref={modalRef} className="modal modal-fixed-footer">
      <div className="modal-content">
        <h5 style={{ marginBottom: 6, fontWeight: 1100 }}>Composer</h5>
        <p className="grey-text" style={{ marginTop: 0, fontWeight: 800 }}>
          Edit fields → Send. Templates are rendered server-side.
        </p>

        {/* Locked target */}
        <div className="card-panel" style={{ borderRadius: 14, background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="grey-text" style={{ fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Sending for applicantId
          </div>
          <div style={{ fontWeight: 1100 }}>
            <code>{composerApplicantId || "—"}</code>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input
              value={toEmail}
              onChange={(e) => {
                setToEmail(e.target.value);
                buildPreview(composer, e.target.value, composerApplicantId || "");
              }}
            />
            <label className={toEmail ? "active" : ""}>To</label>
          </div>

          <div className="input-field col s12 m6">
            <select
              className="browser-default"
              value={composer.stage}
              onChange={(e) => {
                const nextStage = e.target.value as Stage;
                const next = {
                  ...composer,
                  stage: nextStage,
                  setStatus: DEFAULT_SET_STATUS[nextStage] || composer.setStatus,
                };

                if (nextStage === "NDA" && !next.subjectOverride) next.subjectOverride = "Non-Disclosure Agreement | Fluke Games";
                if (nextStage === "Offer" && !next.subjectOverride) next.subjectOverride = "Offer Letter | Fluke Games";
                if (nextStage === "Welcome" && !next.welcome_subjectOverride) next.welcome_subjectOverride = "Welcome to Fluke Games!";
                if (nextStage === "Confirmation" && !next.meetingTitle) next.meetingTitle = "Fluke Games — Interview";

                setComposer(next);
                buildPreview(next, toEmail, composerApplicantId || "");
              }}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s} {!stageIsWired(s) ? " (not wired)" : ""}
                </option>
              ))}
            </select>
            <label className="active" style={{ position: "relative", top: -24 }}>
              Action Type
            </label>
          </div>
        </div>

        <div className="card-panel" style={{ padding: 0, borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(0,0,0,0.08)", fontWeight: 1100 }}>
            Editable Fields
          </div>
          <div style={{ padding: "12px 14px" }}>{renderComposerFields()}</div>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 1000 }}>Preview POST JSON</summary>
          <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{previewJson}</pre>
        </details>
      </div>

      <div className="modal-footer">
        <a className="btn-flat" href="#!" onClick={onClose}>
          Cancel
        </a>

        <button
          className={`btn ${sending ? "disabled" : ""}`}
          onClick={sendNow}
          disabled={sending || !toEmail || !stageIsWired(composer.stage) || !composerApplicantId}
        >
          <i className="material-icons left">{sending ? "hourglass_empty" : "send"}</i>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
