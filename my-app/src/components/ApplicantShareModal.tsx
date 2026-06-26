import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiApplicantDetails, ApiUser } from "../api";

declare const M: any;

type ShareRecipient = Pick<ApiUser, "username" | "employee_name" | "employee_email">;

type Props = {
  api: any;
  open: boolean;
  onClose: () => void;
  applicantId: string;
  applicantName: string;
  applicantEmail: string;
  employeeOptions: ShareRecipient[];
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function isObject(v: any) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function renderAny(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim() || "—";
  if (Array.isArray(value)) return value.map((item) => renderAny(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildApplicantHtml(details: any) {
  const payload = details?.payload || {};
  const answersReadable = payload?.answersReadable || payload?.answers_readable || payload?.answers_readable_map;
  const answersRaw = payload?.answersRaw || payload?.answers_raw || payload?.answers;
  const applicant = payload?.applicant || {};
  const role = payload?.role || {};

  const rows: Array<[string, any]> = [
    ["Applicant ID", details?.id || details?.applicant_id || details?.applicantId],
    ["Name", details?.fullName || details?.name || applicant?.fullName],
    ["Email", details?.email || applicant?.email],
    ["Role", details?.roleTitle || role?.title],
    ["Role ID", details?.roleId || role?.id],
    ["Status", details?.status],
    ["Submitted", details?.submittedAt],
    ["Created", details?.createdAt],
    ["Updated", details?.updatedAt],
    ["Source", details?.source || payload?.meta?.source],
    ["Form Version", details?.formVersion || payload?.meta?.formVersion],
    ["Source IP", details?.sourceIp],
    ["User Agent", details?.userAgent],
    ["Address", details?.address || applicant?.address || payload?.address],
    ["City", details?.city || applicant?.city || payload?.city],
    ["Resume", details?.resumeLink],
    ["Portfolio", details?.portfolioLink],
    ["LinkedIn", details?.linkedinLink || applicant?.linkedinUrl || applicant?.linkedin_url],
  ];

  const answerBlocks: Array<[string, any]> = [];
  if (isObject(answersReadable)) answerBlocks.push(["Readable Answers", answersReadable]);
  if (isObject(answersRaw)) answerBlocks.push(["Raw Answers", answersRaw]);

  const tableRows = rows
    .filter(([, value]) => safeStr(value))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:700;background:#f8fafc;vertical-align:top;">${label}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;vertical-align:top;">${renderAny(value)}</td></tr>`
    )
    .join("");

  const answerHtml = answerBlocks
    .map(([label, value]) => {
      const entries = Object.entries(value || {});
      const body = entries
        .map(
          ([key, entryValue]) =>
            `<tr><td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:700;background:#fff;vertical-align:top;">${key}</td><td style="padding:8px 10px;border:1px solid #e5e7eb;vertical-align:top;">${renderAny(entryValue)}</td></tr>`
        )
        .join("");
      return `
        <h3 style="margin:24px 0 10px;font-size:16px;">${label}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">${body}</table>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; color:#0f172a;">
      <h2 style="margin:0 0 12px;font-size:20px;">Applicant shared from Arcade</h2>
      <p style="margin:0 0 16px;color:#475569;">The selected applicant details are below.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${tableRows}</table>
      ${answerHtml}
    </div>
  `;
}

export default function ApplicantShareModal({
  api,
  open,
  onClose,
  applicantId,
  applicantName,
  applicantEmail,
  employeeOptions,
}: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [details, setDetails] = useState<ApiApplicantDetails | null>(null);
  const [recipientUsername, setRecipientUsername] = useState("");
  const [subject, setSubject] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;
    const instance = M.Modal.init(modalRef.current, {
      dismissible: true,
      opacity: 0.45,
      inDuration: 140,
      outDuration: 120,
      onCloseEnd: () => {
        try {
          onCloseRef.current?.();
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
        instance?.destroy?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;
    const instance = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    if (open) instance.open();
    else instance.close();
  }, [open]);

  useEffect(() => {
    if (!open || !applicantId) return;
    let mounted = true;
    setLoading(true);
    setDetails(null);
    setRecipientUsername("");
    setSubject(`Shared applicant: ${applicantName || applicantEmail || applicantId}`);
    setNote("");
    (async () => {
      try {
        const resp = await api.getApplicantById(applicantId);
        if (!mounted) return;
        setDetails(resp);
      } catch (error: any) {
        if (!mounted) return;
        M?.toast?.({ html: error?.message || "Failed to load applicant details", classes: "red" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [api, applicantEmail, applicantId, applicantName, open]);

  const previewHtml = useMemo(() => buildApplicantHtml(details || {}), [details]);

  async function sendNow() {
    if (!applicantId) return;
    if (!recipientUsername) {
      M?.toast?.({ html: "Choose an employee recipient.", classes: "red" });
      return;
    }

    const recipient = employeeOptions.find((user) => user.username === recipientUsername);
    if (!recipient?.employee_email) {
      M?.toast?.({ html: "Recipient email is missing.", classes: "red" });
      return;
    }

    setSending(true);
    try {
      const htmlBody = `
        ${note.trim() ? `<div style="margin-bottom:24px;padding:12px;border-left:4px solid #2563eb;background:#eff6ff;"><b>Note</b><div style="margin-top:6px;">${note.trim()}</div></div>` : ""}
        ${previewHtml}
      `;
      const textBody = [
        `Applicant shared from Arcade`,
        `Applicant ID: ${applicantId}`,
        `Name: ${applicantName || "—"}`,
        `Email: ${applicantEmail || "—"}`,
        note.trim() ? `Note: ${note.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await api.sendAdminGenericEmail({
        to: [recipient.employee_email],
        subject: subject.trim() || `Shared applicant: ${applicantName || applicantEmail || applicantId}`,
        htmlBody,
        textBody,
        autoCc: false,
      });

      M?.toast?.({ html: "Applicant shared.", classes: "green" });
      onClose();
    } catch (error: any) {
      M?.toast?.({ html: error?.message || "Failed to share applicant", classes: "red" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={modalRef} className="modal modal-fixed-footer" style={{ maxHeight: "90%" }}>
      <div className="modal-content">
        <h5 style={{ fontWeight: 1000, marginBottom: 6 }}>Share Applicant</h5>
        <p className="grey-text" style={{ marginTop: 0, fontWeight: 700 }}>
          Email this applicant package to a current employee.
        </p>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input value={applicantName || applicantId} disabled />
            <label className="active">Applicant</label>
          </div>
          <div className="input-field col s12 m6">
            <input value={applicantEmail} disabled />
            <label className="active">Applicant Email</label>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <select
              className="browser-default"
              value={recipientUsername}
              onChange={(e) => setRecipientUsername(e.target.value)}
            >
              <option value="">Select employee</option>
              {employeeOptions.map((employee) => (
                <option key={employee.username} value={employee.username}>
                  {employee.employee_name || employee.username} ({employee.employee_email})
                </option>
              ))}
            </select>
            <label className="active" style={{ position: "relative", top: -24 }}>
              Share with
            </label>
          </div>

          <div className="input-field col s12 m6">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            <label className="active">Subject</label>
          </div>
        </div>

        <div className="input-field">
          <textarea
            className="materialize-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ minHeight: 90 }}
          />
          <label className="active">Internal note (optional)</label>
        </div>

        <div className="card-panel" style={{ borderRadius: 14, background: "#FAFAFA", border: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="grey-text" style={{ fontWeight: 1000, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Preview
          </div>
          <div style={{ marginTop: 10, maxHeight: 300, overflow: "auto" }}>
            {loading ? (
              <div style={{ fontWeight: 800, color: "#64748b" }}>Loading applicant details...</div>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            )}
          </div>
        </div>
      </div>

      <div className="modal-footer">
        <a className="btn-flat" href="#!" onClick={onClose}>
          Cancel
        </a>
        <button className={`btn ${sending ? "disabled" : ""}`} disabled={sending || loading} onClick={sendNow}>
          <i className="material-icons left">{sending ? "hourglass_empty" : "send"}</i>
          {sending ? "Sending..." : "Share"}
        </button>
      </div>
    </div>
  );
}
