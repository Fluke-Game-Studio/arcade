import { useEffect, useRef, useState } from "react";
import type { ApiUser } from "../../api";
import { API_BASE } from "../../api/config";
import { useAuth } from "../../auth/AuthContext";
import { DRAFT_LENGTH_OPTIONS, draftLengthMaxTokens, draftLengthWordsHint, type DraftLength } from "../../lib/aiDraftLength";

declare const M: any;

type EmployeeDocType = "EXPERIENCE" | "RECOMMENDATION" | "TERMINATION";

type Props = {
  api: any;
  open: boolean;
  onClose: () => void;
  employee: Pick<ApiUser, "username" | "employee_email" | "employee_title"> | null;
};

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function initialState() {
  return {
    docType: "EXPERIENCE" as EmployeeDocType,
    roleTitle: "",
    subject: "Experience Certificate | Fluke Games",
    status: "experience_sent",
    dateStarted: "",
    dateEnded: "",
    currentDate: new Date().toISOString().slice(0, 10),
    extraInfo: "",
    coreSkills: "",
    peopleSkills: "",
    wordCount: "220",
    recommendationBody: "",
    terminationReason: "",
    terminationBody: "",
    terminationDraftLength: "medium" as DraftLength,
  };
}

function formatPreview(state: ReturnType<typeof initialState>, username: string, email: string) {
  const vars: Record<string, any> = {
    ...(state.extraInfo.trim() ? { extraInfo: state.extraInfo.trim(), EXTRA_INFO: state.extraInfo.trim() } : {}),
    ...(state.currentDate ? { CURRENT_DATE: state.currentDate } : {}),
  };

  if (state.docType === "EXPERIENCE") {
    if (state.dateStarted) {
      vars.START_DATE = state.dateStarted;
      vars.dateStarted = state.dateStarted;
    }
    if (state.dateEnded) {
      vars.END_DATE = state.dateEnded;
      vars.dateEnded = state.dateEnded;
    }
  } else if (state.docType === "RECOMMENDATION") {
    if (state.coreSkills.trim()) {
      vars.coreSkills = state.coreSkills.trim();
      vars.CORE_SKILLS = state.coreSkills.trim();
    }
    if (state.peopleSkills.trim()) {
      vars.peopleSkills = state.peopleSkills.trim();
      vars.PEOPLE_SKILLS = state.peopleSkills.trim();
    }
    if (state.wordCount.trim()) {
      vars.wordCount = String(Number(state.wordCount));
      vars.WORD_COUNT = String(Number(state.wordCount));
    }
    if (state.recommendationBody.trim()) {
      vars.recommendationBody = state.recommendationBody.trim();
      vars.RECOMMENDATION_BODY = state.recommendationBody.trim();
    }
  } else {
    if (state.terminationReason.trim()) {
      vars.terminationReason = state.terminationReason.trim();
      vars.TERMINATION_REASON = state.terminationReason.trim();
    }
    if (state.terminationBody.trim()) {
      vars.terminationBody = state.terminationBody.trim();
      vars.TERMINATION_BODY = state.terminationBody.trim();
    }
  }

  return JSON.stringify(
    {
      endpoint: "POST /admin/employees/{username}/send-doc-email",
      username,
      to: email,
      body: {
        type: state.docType,
        roleTitle: state.roleTitle || undefined,
        subjectOverride: state.subject || undefined,
        setStatus: state.status || undefined,
        dateStarted: state.docType === "EXPERIENCE" ? state.dateStarted || undefined : undefined,
        dateEnded: state.docType === "EXPERIENCE" ? state.dateEnded || undefined : undefined,
        coreSkills: state.docType === "RECOMMENDATION" ? state.coreSkills.trim() || undefined : undefined,
        peopleSkills: state.docType === "RECOMMENDATION" ? state.peopleSkills.trim() || undefined : undefined,
        recommendationBody: state.docType === "RECOMMENDATION" ? state.recommendationBody.trim() || undefined : undefined,
        terminationReason: state.docType === "TERMINATION" ? state.terminationReason.trim() || undefined : undefined,
        terminationBody: state.docType === "TERMINATION" ? state.terminationBody.trim() || undefined : undefined,
        vars: Object.keys(vars).length ? vars : undefined,
      },
    },
    null,
    2
  );
}

export default function EmployeeDocComposerModal({ api, open, onClose, employee }: Props) {
  const { user } = useAuth() as any;
  const modalRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [state, setState] = useState(() => initialState());
  const [previewJson, setPreviewJson] = useState("{}");

  const employeeUsername = safeStr(employee?.username);
  const employeeEmail = safeStr(employee?.employee_email);
  const authToken = String(user?.token || "").trim();

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
    if (!open || !employeeUsername) return;
    const next = initialState();
    next.roleTitle = safeStr(employee?.employee_title);
    setState(next);
    setPreviewJson(formatPreview(next, employeeUsername, employeeEmail));
  }, [employee?.employee_title, employeeEmail, employeeUsername, open]);

  function updateState(patch: Partial<ReturnType<typeof initialState>>) {
    const next = { ...state, ...patch };
    setState(next);
    setPreviewJson(formatPreview(next, employeeUsername, employeeEmail));
  }

  function closeModal() {
    const instance = M?.Modal?.getInstance?.(modalRef.current) || M?.Modal?.init?.(modalRef.current);
    instance?.close?.();
  }

  async function generateRecommendationPreview() {
    if (!employeeUsername) return;
    try {
      setGenerating(true);
      const resp = await api.previewEmployeeRecommendation(employeeUsername, {
        roleTitle: state.roleTitle || undefined,
        coreSkills: state.coreSkills.trim() || undefined,
        peopleSkills: state.peopleSkills.trim() || undefined,
        wordCount: Number(state.wordCount || "220"),
        vars: {
          coreSkills: state.coreSkills.trim() || undefined,
          peopleSkills: state.peopleSkills.trim() || undefined,
          wordCount: String(Number(state.wordCount || "220")),
        },
      });
      updateState({ recommendationBody: safeStr(resp?.recommendationBody || "") });
      M?.toast?.({ html: "Recommendation draft generated.", classes: "green" });
    } catch (error: any) {
      M?.toast?.({ html: error?.message || "Failed to generate recommendation", classes: "red" });
    } finally {
      setGenerating(false);
    }
  }

  async function generateTerminationPreview() {
    if (!employeeUsername) return;
    try {
      setGenerating(true);
      const lengthHint = draftLengthWordsHint(state.terminationDraftLength);
      const prompt = [
        "Write a professional employee termination letter for internal HR use.",
        `Employee username: ${employeeUsername}`,
        `Employee email: ${employeeEmail || "N/A"}`,
        `Role title: ${safeStr(state.roleTitle) || "N/A"}`,
        `Reason/context: ${safeStr(state.terminationReason) || "Provide a neutral, concise reason if not specified."}`,
        `Tone: respectful, concise, and formal.`,
        `Target length: ${lengthHint}.`,
        "Stay close to the target length, but always finish your last sentence completely —",
        "never stop mid-sentence or mid-thought. A slightly shorter, complete letter is better",
        "than a longer one that cuts off.",
        `Output only the body of the letter in plain text, no markdown headings.`,
      ].join("\n");

      const runId = `termination_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const postRes = await fetch(`${API_BASE}/ai/chat/internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          clientId: runId,
          requestId: runId,
          context: "internal",
          question: prompt,
          maxTokens: draftLengthMaxTokens(state.terminationDraftLength),
        }),
      });
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error(String(err?.error || err?.message || `HTTP ${postRes.status}`));
      }

      let attempts = 0;
      const reply = await new Promise<string>((resolve, reject) => {
        const tick = async () => {
          attempts += 1;
          if (attempts > 60) {
            reject(new Error("Timed out waiting for AI response."));
            return;
          }
          try {
            const r = await fetch(`${API_BASE}/admin/ai/runs?runId=${encodeURIComponent(runId)}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (r.status === 404) {
              window.setTimeout(tick, 2000);
              return;
            }
            const data = await r.json().catch(() => ({}));
            const run = data?.run || {};
            const status = String(run?.status || "").toLowerCase();
            if (status === "done") {
              resolve(String(run?.resultPayload?.reply || run?.reply || run?.replySummary || ""));
            } else if (status === "error") {
              reject(new Error(String(run?.errorPayload?.error || run?.deniedReason || "AI run failed.")));
            } else {
              window.setTimeout(tick, 2000);
            }
          } catch (e: any) {
            if (attempts > 60) reject(e);
            else window.setTimeout(tick, 2000);
          }
        };
        tick();
      });

      updateState({ terminationBody: reply });
      M?.toast?.({ html: "Termination draft generated.", classes: "green" });
    } catch (error: any) {
      M?.toast?.({ html: error?.message || "Failed to generate termination", classes: "red" });
    } finally {
      setGenerating(false);
    }
  }

  async function sendNow() {
    if (!employeeUsername) return;
    if (state.docType === "EXPERIENCE" && (!state.dateStarted || !state.dateEnded)) {
      M?.toast?.({ html: "Experience requires start and end dates.", classes: "red" });
      return;
    }

    setSending(true);
    try {
      const vars: Record<string, any> = {
        ...(state.extraInfo.trim() ? { extraInfo: state.extraInfo.trim(), EXTRA_INFO: state.extraInfo.trim() } : {}),
        ...(state.currentDate ? { CURRENT_DATE: state.currentDate } : {}),
        ...(state.docType === "EXPERIENCE" && state.dateStarted
          ? { START_DATE: state.dateStarted, dateStarted: state.dateStarted }
          : {}),
        ...(state.docType === "EXPERIENCE" && state.dateEnded
          ? { END_DATE: state.dateEnded, dateEnded: state.dateEnded }
          : {}),
        ...(state.docType === "RECOMMENDATION" && state.coreSkills.trim()
          ? { coreSkills: state.coreSkills.trim(), CORE_SKILLS: state.coreSkills.trim() }
          : {}),
        ...(state.docType === "RECOMMENDATION" && state.peopleSkills.trim()
          ? { peopleSkills: state.peopleSkills.trim(), PEOPLE_SKILLS: state.peopleSkills.trim() }
          : {}),
        ...(state.docType === "RECOMMENDATION" && state.wordCount.trim()
          ? { wordCount: String(Number(state.wordCount)), WORD_COUNT: String(Number(state.wordCount)) }
          : {}),
        ...(state.docType === "RECOMMENDATION" && state.recommendationBody.trim()
          ? {
              recommendationBody: state.recommendationBody.trim(),
              RECOMMENDATION_BODY: state.recommendationBody.trim(),
            }
          : {}),
        ...(state.docType === "TERMINATION" && state.terminationReason.trim()
          ? { terminationReason: state.terminationReason.trim(), TERMINATION_REASON: state.terminationReason.trim() }
          : {}),
        ...(state.docType === "TERMINATION" && state.terminationBody.trim()
          ? { terminationBody: state.terminationBody.trim(), TERMINATION_BODY: state.terminationBody.trim() }
          : {}),
      };

      await api.sendEmployeeDocEmail(employeeUsername, {
        type: state.docType,
        roleTitle: state.roleTitle || undefined,
        subjectOverride: state.subject || undefined,
        setStatus: state.status || undefined,
        dateStarted: state.docType === "EXPERIENCE" ? state.dateStarted || undefined : undefined,
        dateEnded: state.docType === "EXPERIENCE" ? state.dateEnded || undefined : undefined,
        coreSkills: state.docType === "RECOMMENDATION" ? state.coreSkills.trim() || undefined : undefined,
        peopleSkills: state.docType === "RECOMMENDATION" ? state.peopleSkills.trim() || undefined : undefined,
        recommendationBody: state.docType === "RECOMMENDATION" ? state.recommendationBody.trim() || undefined : undefined,
        terminationReason: state.docType === "TERMINATION" ? state.terminationReason.trim() || undefined : undefined,
        terminationBody: state.docType === "TERMINATION" ? state.terminationBody.trim() || undefined : undefined,
        vars,
      });

      M?.toast?.({ html: "Employee document sent.", classes: "green" });
      closeModal();
    } catch (error: any) {
      M?.toast?.({ html: error?.message || "Failed to send document", classes: "red" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={modalRef} className="modal modal-fixed-footer" style={{ maxHeight: "90%" }}>
      <div className="modal-content">
        <h5 style={{ fontWeight: 1000, marginBottom: 6 }}>Employee Letter Composer</h5>
        <p className="grey-text" style={{ marginTop: 0, fontWeight: 700 }}>
          Experience, Recommendation, and Termination letters for the selected employee.
        </p>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m6">
            <input value={employeeEmail} disabled />
            <label className="active">To</label>
          </div>
          <div className="input-field col s12 m6">
            <input value={employeeUsername} disabled />
            <label className="active">Studio Email</label>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 0 }}>
          <div className="input-field col s12 m4">
            <select
              className="browser-default"
              value={state.docType}
              onChange={(e) => {
                const next = e.target.value as EmployeeDocType;
                const nextState = {
                  ...state,
                  docType: next,
                  subject: next === "EXPERIENCE"
                    ? "Experience Certificate | Fluke Games"
                    : "Letter of Recommendation | Fluke Games",
                  status: next === "EXPERIENCE" ? "experience_sent" : next === "RECOMMENDATION" ? "recommendation_sent" : "termination_sent",
                };
                setState(nextState);
                setPreviewJson(formatPreview(nextState, employeeUsername, employeeEmail));
              }}
            >
              <option value="EXPERIENCE">EXPERIENCE</option>
              <option value="RECOMMENDATION">RECOMMENDATION</option>
              <option value="TERMINATION">TERMINATION</option>
            </select>
            <label className="active" style={{ position: "relative", top: -24 }}>
              docType
            </label>
          </div>

          <div className="input-field col s12 m4">
            <input value={state.roleTitle} onChange={(e) => updateState({ roleTitle: e.target.value })} />
            <label className="active">roleTitle</label>
          </div>

          <div className="input-field col s12 m4">
            <input value={state.status} onChange={(e) => updateState({ status: e.target.value })} />
            <label className="active">setStatus</label>
          </div>
        </div>

        <div className="input-field">
          <input value={state.subject} onChange={(e) => updateState({ subject: e.target.value })} />
          <label className="active">subjectOverride</label>
        </div>

        {state.docType === "EXPERIENCE" ? (
          <div className="row" style={{ marginTop: 8 }}>
            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateStarted</div>
              <input type="date" value={state.dateStarted} onChange={(e) => updateState({ dateStarted: e.target.value })} />
            </div>
            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>dateEnded</div>
              <input type="date" value={state.dateEnded} onChange={(e) => updateState({ dateEnded: e.target.value })} />
            </div>
            <div className="col s12 m4">
              <div className="grey-text" style={{ fontWeight: 700, marginBottom: 6 }}>CURRENT_DATE</div>
              <input type="date" value={state.currentDate} onChange={(e) => updateState({ currentDate: e.target.value })} />
            </div>
          </div>
        ) : state.docType === "RECOMMENDATION" ? (
          <>
            <div className="row" style={{ marginTop: 8 }}>
              <div className="input-field col s12 m6">
                <textarea
                  className="materialize-textarea"
                  value={state.coreSkills}
                  onChange={(e) => updateState({ coreSkills: e.target.value })}
                  style={{ minHeight: 90 }}
                />
                <label className="active">Core Skills</label>
              </div>
              <div className="input-field col s12 m6">
                <textarea
                  className="materialize-textarea"
                  value={state.peopleSkills}
                  onChange={(e) => updateState({ peopleSkills: e.target.value })}
                  style={{ minHeight: 90 }}
                />
                <label className="active">People Skills</label>
              </div>
            </div>
            <div className="input-field">
              <input type="number" min={120} max={600} value={state.wordCount} onChange={(e) => updateState({ wordCount: e.target.value })} />
              <label className="active">Word Count (120-600)</label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button type="button" className={`btn ${generating ? "disabled" : ""}`} disabled={generating} onClick={generateRecommendationPreview}>
                <i className="material-icons left">{generating ? "hourglass_empty" : "auto_awesome"}</i>
                {generating ? "Generating..." : "Generate Recommendation"}
              </button>
            </div>
            <div className="input-field">
              <textarea
                className="materialize-textarea"
                value={state.recommendationBody}
                onChange={(e) => updateState({ recommendationBody: e.target.value })}
                style={{ minHeight: 220 }}
              />
              <label className="active">Recommendation Draft (Editable)</label>
            </div>
          </>
        ) : (
          <>
            <div className="input-field" style={{ marginTop: 8 }}>
              <textarea
                className="materialize-textarea"
                value={state.terminationReason}
                onChange={(e) => updateState({ terminationReason: e.target.value })}
                style={{ minHeight: 90 }}
                placeholder="Reason for termination, if you want it reflected in the draft."
              />
              <label className="active">Termination Reason</label>
            </div>
            <div className="row" style={{ marginBottom: 0, marginTop: 4, alignItems: "center" }}>
              <div className="input-field col s12 m5">
                <select
                  className="browser-default"
                  value={state.terminationDraftLength}
                  onChange={(e) => updateState({ terminationDraftLength: e.target.value as DraftLength })}
                >
                  {DRAFT_LENGTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label} ({o.words})</option>
                  ))}
                </select>
                <label className="active" style={{ position: "relative", top: -24 }}>Draft length</label>
              </div>
              <div className="col s12 m7" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                <button
                  type="button"
                  className={`btn ${generating ? "disabled" : ""}`}
                  disabled={generating}
                  onClick={generateTerminationPreview}
                >
                  <i className="material-icons left">{generating ? "hourglass_empty" : "auto_awesome"}</i>
                  {generating ? "Generating..." : "Generate Termination"}
                </button>
              </div>
            </div>
            <div className="input-field">
              <textarea
                className="materialize-textarea"
                value={state.terminationBody}
                onChange={(e) => updateState({ terminationBody: e.target.value })}
                style={{ minHeight: 220 }}
                placeholder="Generated termination letter will appear here. You can edit it before sending."
              />
              <label className="active">Termination Draft (Editable)</label>
            </div>
          </>
        )}

        <div className="input-field">
          <textarea
            className="materialize-textarea"
            value={state.extraInfo}
            onChange={(e) => updateState({ extraInfo: e.target.value })}
            style={{ minHeight: 90 }}
          />
          <label className="active">vars.extraInfo (optional)</label>
        </div>

        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>Preview vars sent</summary>
          <pre style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{previewJson}</pre>
        </details>
      </div>

      <div className="modal-footer">
        <a className="btn-flat" href="#!" onClick={closeModal}>
          Cancel
        </a>
        <button className={`btn ${sending ? "disabled" : ""}`} disabled={sending} onClick={sendNow}>
          <i className="material-icons left">{sending ? "hourglass_empty" : "send"}</i>
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
