import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";

declare const M: any;

type MailStage = "Newsletter" | "Generic" | "Activity Report Reminder";

const STAGES: MailStage[] = ["Newsletter", "Generic", "Activity Report Reminder"];

type ComposerState = {
  stage: MailStage;

  // Common
  to: string;
  cc: string;
  bcc: string;
  autoCc: boolean;

  // Newsletter
  newsletterSubject: string;
  newsletterHeading: string;
  newsletterPreheader: string;
  newsletterIntro: string;
  newsletterBodyHtml: string;
  newsletterFooterNote: string;
  newsletterCtaText: string;
  newsletterCtaUrl: string;
  newsletterTextBody: string;

  // Generic
  genericSubject: string;
  genericHtmlBody: string;
  genericTextBody: string;

  // Activity reminder
  reminderUsernames: string;
  reminderSubjectOverride: string;
  reminderDryRun: boolean;
};

function defaultComposer(stage: MailStage): ComposerState {
  return {
    stage,

    to: "",
    cc: "",
    bcc: "",
    autoCc: false,

    newsletterSubject: "Fluke Games Newsletter",
    newsletterHeading: "Fluke Games Newsletter",
    newsletterPreheader: "Latest updates from Fluke Games",
    newsletterIntro: "Hello team, here are the latest updates from Fluke Games.",
    newsletterBodyHtml:
      "<p>Write your newsletter content here.</p><p>You can include sections, links, and formatted HTML.</p>",
    newsletterFooterNote:
      "You are receiving this because you are part of the Fluke Games network.",
    newsletterCtaText: "Open Portal",
    newsletterCtaUrl: "https://arcade.flukegamestudio.com",
    newsletterTextBody: "Please view this newsletter in HTML format.",

    genericSubject: "",
    genericHtmlBody: "<p>Write custom HTML here.</p>",
    genericTextBody: "Please view this email in HTML format.",

    reminderUsernames: "",
    reminderSubjectOverride: "",
    reminderDryRun: true,
  };
}

function splitCsvLike(value: string) {
  return String(value || "")
    .split(/[\n,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function toPrettyJson(obj: unknown) {
  return JSON.stringify(obj, null, 2);
}

async function callAdminApi(api: any, route: string, body: any) {
  if (!api) throw new Error("API client missing");

  if (route === "newsletter") {
    if (typeof api.sendAdminNewsletter === "function") {
      return await api.sendAdminNewsletter(body);
    }
  }

  if (route === "generic") {
    if (typeof api.sendAdminGenericEmail === "function") {
      return await api.sendAdminGenericEmail(body);
    }
  }

  if (route === "activity-report-reminders") {
    if (typeof api.sendAdminActivityReportReminders === "function") {
      return await api.sendAdminActivityReportReminders(body);
    }
  }

  if (typeof api.post === "function") {
    return await api.post(`/admin/mail/${route}`, body);
  }

  if (typeof api.request === "function") {
    return await api.request(`/admin/mail/${route}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  throw new Error(`No API method available for /admin/mail/${route}`);
}

export default function AdminMailerComposerModal({
  api,
  open,
  onClose,
}: {
  api: any;
  open: boolean;
  onClose: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(() =>
    defaultComposer("Newsletter")
  );
  const [previewJson, setPreviewJson] = useState<string>("{}");

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
          modalRef.current!.style.width = "min(980px, 96%)";
          modalRef.current!.style.maxHeight = "88vh";
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

  useEffect(() => {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    if (open) inst.open();
    else inst.close();
  }, [open]);

  useEffect(() => {
    buildPreview(composer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildPreview(c: ComposerState) {
    if (c.stage === "Newsletter") {
      const body = {
        to: splitCsvLike(c.to),
        cc: splitCsvLike(c.cc),
        bcc: splitCsvLike(c.bcc),
        subject: c.newsletterSubject.trim(),
        heading: c.newsletterHeading.trim(),
        preheader: c.newsletterPreheader.trim(),
        intro: c.newsletterIntro.trim(),
        bodyHtml: c.newsletterBodyHtml,
        footerNote: c.newsletterFooterNote.trim(),
        ctaText: c.newsletterCtaText.trim(),
        ctaUrl: c.newsletterCtaUrl.trim(),
        textBody: c.newsletterTextBody.trim(),
        autoCc: !!c.autoCc,
      };

      setPreviewJson(
        toPrettyJson({
          endpoint: "POST /admin/mail/newsletter",
          body,
        })
      );
      return;
    }

    if (c.stage === "Generic") {
      const body = {
        to: splitCsvLike(c.to),
        cc: splitCsvLike(c.cc),
        bcc: splitCsvLike(c.bcc),
        subject: c.genericSubject.trim(),
        htmlBody: c.genericHtmlBody,
        textBody: c.genericTextBody.trim(),
        autoCc: !!c.autoCc,
      };

      setPreviewJson(
        toPrettyJson({
          endpoint: "POST /admin/mail/generic",
          body,
        })
      );
      return;
    }

    const body = {
      usernames: splitCsvLike(c.reminderUsernames),
      subjectOverride: c.reminderSubjectOverride.trim() || undefined,
      dryRun: !!c.reminderDryRun,
      cc: splitCsvLike(c.cc),
      bcc: splitCsvLike(c.bcc),
      autoCc: !!c.autoCc,
    };

    setPreviewJson(
      toPrettyJson({
        endpoint: "POST /admin/mail/activity-report-reminders",
        body,
      })
    );
  }

  function updateComposer(patch: Partial<ComposerState>) {
    const next = { ...composer, ...patch };
    setComposer(next);
    buildPreview(next);
  }

  async function sendNow() {
    setSending(true);
    try {
      if (composer.stage === "Newsletter") {
        const body = {
          to: splitCsvLike(composer.to),
          cc: splitCsvLike(composer.cc),
          bcc: splitCsvLike(composer.bcc),
          subject: composer.newsletterSubject.trim(),
          heading: composer.newsletterHeading.trim(),
          preheader: composer.newsletterPreheader.trim(),
          intro: composer.newsletterIntro.trim(),
          bodyHtml: composer.newsletterBodyHtml,
          footerNote: composer.newsletterFooterNote.trim(),
          ctaText: composer.newsletterCtaText.trim(),
          ctaUrl: composer.newsletterCtaUrl.trim(),
          textBody: composer.newsletterTextBody.trim(),
          autoCc: !!composer.autoCc,
        };

        if (!body.to.length) {
          M?.toast?.({ html: "Newsletter: at least one recipient is required", classes: "red" });
          return;
        }
        if (!body.subject) {
          M?.toast?.({ html: "Newsletter: subject is required", classes: "red" });
          return;
        }
        if (!body.heading) {
          M?.toast?.({ html: "Newsletter: heading is required", classes: "red" });
          return;
        }

        const resp = await callAdminApi(api, "newsletter", body);
        M?.toast?.({
          html: String(resp?.message || `Newsletter sent`),
          classes: "green",
        });
        onClose();
        return;
      }

      if (composer.stage === "Generic") {
        const body = {
          to: splitCsvLike(composer.to),
          cc: splitCsvLike(composer.cc),
          bcc: splitCsvLike(composer.bcc),
          subject: composer.genericSubject.trim(),
          htmlBody: composer.genericHtmlBody,
          textBody: composer.genericTextBody.trim(),
          autoCc: !!composer.autoCc,
        };

        if (!body.to.length) {
          M?.toast?.({ html: "Generic mail: at least one recipient is required", classes: "red" });
          return;
        }
        if (!body.subject) {
          M?.toast?.({ html: "Generic mail: subject is required", classes: "red" });
          return;
        }
        if (!body.htmlBody.trim()) {
          M?.toast?.({ html: "Generic mail: htmlBody is required", classes: "red" });
          return;
        }

        const resp = await callAdminApi(api, "generic", body);
        M?.toast?.({
          html: String(resp?.message || `Email sent`),
          classes: "green",
        });
        onClose();
        return;
      }

      const body = {
        usernames: splitCsvLike(composer.reminderUsernames),
        subjectOverride: composer.reminderSubjectOverride.trim() || undefined,
        dryRun: !!composer.reminderDryRun,
        cc: splitCsvLike(composer.cc),
        bcc: splitCsvLike(composer.bcc),
        autoCc: !!composer.autoCc,
      };

      const resp = await callAdminApi(api, "activity-report-reminders", body);
      const dryRunText = body.dryRun ? "Dry run complete" : "Reminder job sent";
      M?.toast?.({
        html: String(resp?.message || dryRunText),
        classes: body.dryRun ? "blue" : "green",
      });
      onClose();
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Send failed", classes: "red" });
    } finally {
      setSending(false);
    }
  }

  const stageNote = useMemo(() => {
    if (composer.stage === "Newsletter") {
      return "Uses templates/email/NEWSLETTER.html on the backend. You provide structured fields plus bodyHtml content.";
    }
    if (composer.stage === "Generic") {
      return "Direct HTML email. This one intentionally does not use a fixed template.";
    }
    return "Uses templates/email/ACTIVITY_REPORT_REMINDER.html on the backend. Usernames are optional; leave empty to target all eligible employees.";
  }, [composer.stage]);

  function renderCommonRecipientFields() {
    return (
      <>
        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m4">
            <textarea
              className="materialize-textarea"
              value={composer.to}
              onChange={(e) => updateComposer({ to: e.target.value })}
              style={{ minHeight: 84 }}
            />
            <label className="active">To (comma or newline separated)</label>
          </div>

          <div className="input-field col s12 m4">
            <textarea
              className="materialize-textarea"
              value={composer.cc}
              onChange={(e) => updateComposer({ cc: e.target.value })}
              style={{ minHeight: 84 }}
            />
            <label className="active">CC</label>
          </div>

          <div className="input-field col s12 m4">
            <textarea
              className="materialize-textarea"
              value={composer.bcc}
              onChange={(e) => updateComposer({ bcc: e.target.value })}
              style={{ minHeight: 84 }}
            />
            <label className="active">BCC</label>
          </div>
        </div>

        <p style={{ marginTop: 6 }}>
          <label>
            <input
              type="checkbox"
              checked={composer.autoCc}
              onChange={(e) => updateComposer({ autoCc: e.target.checked })}
            />
            <span>autoCc</span>
          </label>
        </p>
      </>
    );
  }

  function renderNewsletterFields(): ReactElement {
    return (
      <>
        {renderCommonRecipientFields()}

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input
              value={composer.newsletterSubject}
              onChange={(e) =>
                updateComposer({ newsletterSubject: e.target.value })
              }
            />
            <label className="active">subject</label>
          </div>

          <div className="input-field col s12 m6">
            <input
              value={composer.newsletterHeading}
              onChange={(e) =>
                updateComposer({ newsletterHeading: e.target.value })
              }
            />
            <label className="active">heading</label>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input
              value={composer.newsletterPreheader}
              onChange={(e) =>
                updateComposer({ newsletterPreheader: e.target.value })
              }
            />
            <label className="active">preheader</label>
          </div>

          <div className="input-field col s12 m6">
            <input
              value={composer.newsletterIntro}
              onChange={(e) =>
                updateComposer({ newsletterIntro: e.target.value })
              }
            />
            <label className="active">intro</label>
          </div>
        </div>

        <div className="input-field" style={{ marginTop: 10 }}>
          <textarea
            className="materialize-textarea"
            value={composer.newsletterBodyHtml}
            onChange={(e) =>
              updateComposer({ newsletterBodyHtml: e.target.value })
            }
            style={{ minHeight: 220, fontFamily: "monospace" }}
          />
          <label className="active">bodyHtml</label>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m4">
            <input
              value={composer.newsletterCtaText}
              onChange={(e) =>
                updateComposer({ newsletterCtaText: e.target.value })
              }
            />
            <label className="active">ctaText</label>
          </div>

          <div className="input-field col s12 m8">
            <input
              value={composer.newsletterCtaUrl}
              onChange={(e) =>
                updateComposer({ newsletterCtaUrl: e.target.value })
              }
            />
            <label className="active">ctaUrl</label>
          </div>
        </div>

        <div className="input-field" style={{ marginTop: 8 }}>
          <textarea
            className="materialize-textarea"
            value={composer.newsletterFooterNote}
            onChange={(e) =>
              updateComposer({ newsletterFooterNote: e.target.value })
            }
            style={{ minHeight: 90 }}
          />
          <label className="active">footerNote</label>
        </div>

        <div className="input-field" style={{ marginTop: 8 }}>
          <textarea
            className="materialize-textarea"
            value={composer.newsletterTextBody}
            onChange={(e) =>
              updateComposer({ newsletterTextBody: e.target.value })
            }
            style={{ minHeight: 90 }}
          />
          <label className="active">textBody</label>
        </div>
      </>
    );
  }

  function renderGenericFields(): ReactElement {
    return (
      <>
        {renderCommonRecipientFields()}

        <div className="input-field" style={{ marginTop: 10 }}>
          <input
            value={composer.genericSubject}
            onChange={(e) => updateComposer({ genericSubject: e.target.value })}
          />
          <label className="active">subject</label>
        </div>

        <div className="input-field" style={{ marginTop: 10 }}>
          <textarea
            className="materialize-textarea"
            value={composer.genericHtmlBody}
            onChange={(e) =>
              updateComposer({ genericHtmlBody: e.target.value })
            }
            style={{ minHeight: 260, fontFamily: "monospace" }}
          />
          <label className="active">htmlBody</label>
        </div>

        <div className="input-field" style={{ marginTop: 10 }}>
          <textarea
            className="materialize-textarea"
            value={composer.genericTextBody}
            onChange={(e) =>
              updateComposer({ genericTextBody: e.target.value })
            }
            style={{ minHeight: 100 }}
          />
          <label className="active">textBody</label>
        </div>
      </>
    );
  }

  function renderReminderFields(): ReactElement {
    return (
      <>
        <div className="card-panel blue lighten-5" style={{ borderRadius: 16 }}>
          <b>Tip:</b> Leave usernames empty to evaluate all active non-admin employees.
        </div>

        <div className="input-field" style={{ marginTop: 10 }}>
          <textarea
            className="materialize-textarea"
            value={composer.reminderUsernames}
            onChange={(e) =>
              updateComposer({ reminderUsernames: e.target.value })
            }
            style={{ minHeight: 120 }}
          />
          <label className="active">
            usernames (comma or newline separated, optional)
          </label>
        </div>

        <div className="input-field" style={{ marginTop: 10 }}>
          <input
            value={composer.reminderSubjectOverride}
            onChange={(e) =>
              updateComposer({ reminderSubjectOverride: e.target.value })
            }
          />
          <label className="active">subjectOverride (optional)</label>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <textarea
              className="materialize-textarea"
              value={composer.cc}
              onChange={(e) => updateComposer({ cc: e.target.value })}
              style={{ minHeight: 84 }}
            />
            <label className="active">CC</label>
          </div>

          <div className="input-field col s12 m6">
            <textarea
              className="materialize-textarea"
              value={composer.bcc}
              onChange={(e) => updateComposer({ bcc: e.target.value })}
              style={{ minHeight: 84 }}
            />
            <label className="active">BCC</label>
          </div>
        </div>

        <p style={{ marginTop: 6 }}>
          <label style={{ marginRight: 18 }}>
            <input
              type="checkbox"
              checked={composer.reminderDryRun}
              onChange={(e) =>
                updateComposer({ reminderDryRun: e.target.checked })
              }
            />
            <span>dryRun</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={composer.autoCc}
              onChange={(e) => updateComposer({ autoCc: e.target.checked })}
            />
            <span>autoCc</span>
          </label>
        </p>
      </>
    );
  }

  function renderStageFields(): ReactElement {
    if (composer.stage === "Newsletter") return renderNewsletterFields();
    if (composer.stage === "Generic") return renderGenericFields();
    return renderReminderFields();
  }

  const sendButtonLabel = useMemo(() => {
    if (sending) return "Sending…";
    if (composer.stage === "Activity Report Reminder" && composer.reminderDryRun) {
      return "Run Dry Check";
    }
    return "Send";
  }, [sending, composer.stage, composer.reminderDryRun]);

  return (
    <div ref={modalRef} className="modal modal-fixed-footer">
      <div className="modal-content">
        <h5 style={{ marginBottom: 6, fontWeight: 1100 }}>Admin Mail Composer</h5>
        <p className="grey-text" style={{ marginTop: 0, fontWeight: 800 }}>
          Compose and send Newsletter, Generic, or Activity Report Reminder emails.
        </p>

        <div
          className="card-panel"
          style={{
            borderRadius: 14,
            background: "#FAFAFA",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div
            className="grey-text"
            style={{
              fontWeight: 1000,
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.6,
            }}
          >
            Backend Template Mode
          </div>
          <div style={{ fontWeight: 1000 }}>{stageNote}</div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <select
              className="browser-default"
              value={composer.stage}
              onChange={(e) => {
                const nextStage = e.target.value as MailStage;
                const next = { ...composer, stage: nextStage };
                setComposer(next);
                buildPreview(next);
              }}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <label className="active" style={{ position: "relative", top: -24 }}>
              Action Type
            </label>
          </div>
        </div>

        <div
          className="card-panel"
          style={{ padding: 0, borderRadius: 16, overflow: "hidden" }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              fontWeight: 1100,
            }}
          >
            Editable Fields
          </div>
          <div style={{ padding: "12px 14px" }}>{renderStageFields()}</div>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 1000 }}>
            Preview POST JSON
          </summary>
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
          disabled={sending}
        >
          <i className="material-icons left">
            {sending ? "hourglass_empty" : "send"}
          </i>
          {sendButtonLabel}
        </button>
      </div>
    </div>
  );
}