import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TimeSheet from "../components/Timesheet";
import FgcAmount from "../components/credits/FgcAmount";
import FrozenFgcAmount from "../components/credits/FrozenFgcAmount";
import { useUpdates, startOfWeekMonday, toISODate } from "./UpdatesContext";
import { useAuth } from "../auth/AuthContext";
import type { UpdateSubmission } from "./UpdatesContext";
import type { ApiProject } from "../api/types/projects";
import type { ApiCreditConfig } from "../api/types/gamification";
import type {
  PresignedUploadItem,
  SubmitUpdateResponse,
  UploadedFileRef,
} from "../api/types/updates";

declare const M: any;

const shellCard: React.CSSProperties = {
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,.14)",
  boxShadow: "0 16px 40px rgba(15,23,42,.08)",
  background:
    "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
};

const sectionCard: React.CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,.14)",
  background: "rgba(255,255,255,.86)",
  boxShadow: "0 10px 24px rgba(15,23,42,.05)",
  padding: 18,
  marginTop: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

const sectionSubStyle: React.CSSProperties = {
  color: "#64748b",
  marginTop: 0,
  marginBottom: 14,
  fontSize: 13,
};

type SelectedFile = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress: number;
  s3Key?: string;
  publicUrl?: string;
  error?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function makeRandomId() {
  if (
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return makeId();
}

function normalizeMimeType(file: File) {
  return file.type?.trim() || "application/octet-stream";
}

function MetaChip({
  icon,
  label,
  value,
  tint,
  color,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  tint: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: tint,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <i className="material-icons" style={{ fontSize: 16 }}>
        {icon}
      </i>
      <span>{label}</span>
      <span style={{ opacity: 0.95 }}>{value}</span>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div style={sectionTitleStyle}>
        <i className="material-icons">{icon}</i>
        <span>{title}</span>
      </div>
      <p style={sectionSubStyle}>{subtitle}</p>
    </>
  );
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function parseProjectIds(value: any): string[] {
  if (Array.isArray(value)) return Array.from(new Set(value.map((x) => String(x || "").trim()).filter(Boolean)));
  const s = String(value || "").trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return Array.from(new Set(parsed.map((x) => String(x || "").trim()).filter(Boolean)));
  } catch {}
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}

async function uploadFileWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void
) {
  const contentType = normalizeMimeType(file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(
        0,
        Math.min(100, Math.round((evt.loaded / evt.total) * 100))
      );
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(
          new Error(
            `Upload failed with status ${xhr.status}: ${
              xhr.responseText || "unknown error"
            }`
          )
        );
      }
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Network error while uploading file. Check S3 bucket CORS and presigned upload configuration."
        )
      );

    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(file);
  });
}

export default function WeeklyUpdate() {
  const { save } = useUpdates();
  const { user, api } = useAuth();
  const navigate = useNavigate();

  const mondayISO = useMemo(() => toISODate(startOfWeekMonday(new Date())), []);
  const [weekStart, setWeekStart] = useState(mondayISO);
  const isBackdatedWeek = Boolean(weekStart && mondayISO && weekStart !== mondayISO);

  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [next, setNext] = useState("");

  const [worked, setWorked] = useState<string[]>([""]);
  const [didnt, setDidnt] = useState<string[]>([""]);
  const [improve, setImprove] = useState<string[]>([""]);

  const [hours, setHours] = useState<Record<string, number>>({});
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionPhase, setSubmissionPhase] = useState<"idle" | "validating" | "success" | "error">("idle");
  const [, setSubmissionTick] = useState(0);
  const [, setSubmissionMessage] = useState("");
  const validationTimerRef = useRef<number | null>(null);
  const successTimerRef = useRef<number | null>(null);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [creditConfig, setCreditConfig] = useState<ApiCreditConfig | null>(null);
  const [jiraTickets, setJiraTickets] = useState<
    Array<{ key: string; summary?: string; status?: string; assignee?: string; updated?: string }>
  >([]);
  const [selectedJiraTicketKeys, setSelectedJiraTicketKeys] = useState<string[]>([]);
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState("");
  const [jiraInfo, setJiraInfo] = useState("");
  const [weeklyBlockOpen, setWeeklyBlockOpen] = useState(false);
  const [bonusBlockOpen, setBonusBlockOpen] = useState(false);
  const [penaltyBlockOpen, setPenaltyBlockOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const ALL_ASSIGNED_PROJECTS = "__all_assigned__";
  const wizardSteps = [
    { title: "Welcome & Details", icon: "info", subtitle: "Review the reward summary and the submission context before you start." },
    { title: "Activity Update", icon: "assignment_turned_in", subtitle: "Capture accomplishments, blockers, Jira links, and supporting files." },
    { title: "TimeSheet Update", icon: "schedule", subtitle: "Log the day-by-day hours for the selected week." },
    { title: "Retro Update", icon: "history_edu", subtitle: "Add worked, didn’t work, and improve notes before submitting." },
    { title: "Review & Submit", icon: "send", subtitle: "Confirm everything and send the weekly update." },
  ] as const;
  const currentWizardStep = wizardSteps[wizardStep] || wizardSteps[0];
  const lastWizardStep = wizardSteps.length - 1;

  const totalHours = Object.values(hours).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );

  function goNextStep() {
    setWizardStep((current) => Math.min(wizardSteps.length - 1, current + 1));
  }

  function goBackStep() {
    setWizardStep((current) => Math.max(0, current - 1));
  }

  const weeklyCreditPreview = useMemo(() => {
    const cfg = creditConfig?.weeklyUpdate || {};
    const base = Number(cfg.base ?? 20) || 0;
    const retro = Number(cfg.retro ?? 20) || 0;
    const fileUpload = Number(cfg.fileUpload ?? 10) || 0;
    const timesheet = Number(cfg.timesheet ?? 10) || 0;
    const aiBonus = Number(cfg.aiBonus ?? cfg.webrtcBonus ?? 25) || 0;
    const awardsBonus = Number(
      (cfg as any).awardsBonus ??
        (cfg as any).awardBonus ??
        (cfg as any).awards?.creditAmount ??
        (cfg as any).awards?.amount ??
        0
    ) || 0;
    const missingUpdatePenalty = Number(cfg.missingUpdatePenalty ?? 200);

    const retroCount = [worked, didnt, improve].reduce((sum, list) => {
      return sum + list.map((x) => String(x || "").trim()).filter(Boolean).length;
    }, 0);
    const hasFiles = selectedFiles.length > 0;
    const hasTimesheet = Object.values(hours).some((h) => Number(h) > 0);

    const updateItems: Array<{ label: string; amount: number }> = [
      { label: "Weekly update", amount: base },
      { label: "Retro", amount: retroCount > 0 ? retro : 0 },
      { label: "Timesheet", amount: hasTimesheet ? timesheet : 0 },
    ];
    const extraFrozenItems: Array<{ label: string; amount: number }> = [
      { label: "AI submit", amount: aiBonus },
      { label: "File upload", amount: hasFiles ? fileUpload : 0 },
      { label: "Awards won", amount: awardsBonus },
    ];

    const updateTotal = updateItems.reduce((sum, item) => sum + item.amount, 0);
    const extraFrozenTotal = extraFrozenItems.reduce((sum, item) => sum + item.amount, 0);
    const frozenTotal = updateTotal + extraFrozenTotal;
    return {
      updateItems,
      extraFrozenItems,
      updateTotal,
      extraFrozenTotal,
      frozenTotal,
      total: updateTotal,
      spendableItems: updateItems,
      spendableTotal: updateTotal,
      frozenItems: extraFrozenItems,
      aiBonus,
      awardsBonus,
      missingUpdatePenalty,
    };
  }, [creditConfig, worked, didnt, improve, selectedFiles, hours]);

  const weeklyRuleSummary = useMemo(() => {
    const cfg = creditConfig?.weeklyUpdate || {};
    const base = Number(cfg.base ?? 20) || 0;
    const retro = Number(cfg.retro ?? 20) || 0;
    const fileUpload = Number(cfg.fileUpload ?? 10) || 0;
    const timesheet = Number(cfg.timesheet ?? 10) || 0;
    const aiBonus = Number(cfg.aiBonus || cfg.webrtcBonus || 25) || 0;
    const awardsBonus = Number(
      (cfg as any).awardsBonus ??
        (cfg as any).awardBonus ??
        (cfg as any).awards?.creditAmount ??
        (cfg as any).awards?.amount ??
        0
    ) || 0;
    const missingUpdatePenalty = Number(cfg.missingUpdatePenalty ?? 200);
    return {
      weeklyRows: [
        { label: "Weekly update", amount: base, note: "Frozen weekly reward" },
        { label: "Retro", amount: retro, note: "Frozen when the retro step is completed" },
        { label: "Timesheet", amount: timesheet, note: "Frozen when the timesheet step is completed" },
      ],
      frozenBonusRows: [
        { label: "AI submit", amount: aiBonus, note: "Frozen bonus for AI-assisted submission" },
        { label: "File upload", amount: fileUpload, note: "Frozen bonus for supporting files" },
      ],
      awardRows: [
        { label: "Awards won", amount: awardsBonus, note: "Spendable reward from awards and achievements" },
      ],
      weeklyTotal: base + retro + timesheet,
      frozenBonusTotal: aiBonus + fileUpload,
      awardTotal: awardsBonus,
      missingUpdatePenalty,
    };
  }, [creditConfig]);

  const displayedCreditPreview = useMemo(() => {
    if (!isBackdatedWeek) return weeklyCreditPreview;
    const lateMultiplier = 0.4;
    const scaleAmount = (value: number) => Math.max(1, Math.round(Number(value || 0) * lateMultiplier));
    return {
      ...weeklyCreditPreview,
      updateItems: weeklyCreditPreview.updateItems
        .map((item) => ({ ...item, amount: scaleAmount(item.amount) }))
        .filter((item) => item.amount > 0),
      extraFrozenItems: weeklyCreditPreview.extraFrozenItems
        .map((item) => ({ ...item, amount: scaleAmount(item.amount) }))
        .filter((item) => item.amount > 0),
      updateTotal: scaleAmount(weeklyCreditPreview.updateTotal),
      extraFrozenTotal: scaleAmount(weeklyCreditPreview.extraFrozenTotal),
      frozenTotal: scaleAmount(weeklyCreditPreview.frozenTotal),
      total: scaleAmount(weeklyCreditPreview.total),
      spendableTotal: scaleAmount(weeklyCreditPreview.spendableTotal),
    };
  }, [isBackdatedWeek, weeklyCreditPreview]);

  useEffect(() => {
    try {
      M.CharacterCounter?.init(
        document.querySelectorAll("input[data-length], textarea[data-length]")
      );
      M.updateTextFields?.();
      document
        .querySelectorAll<HTMLTextAreaElement>("textarea.materialize-textarea")
        .forEach((t) => M.textareaAutoResize?.(t));
      M.Tooltip?.init(document.querySelectorAll(".tooltipped"));
    } catch {}
  }, [accomplishments, blockers, next, worked, didnt, improve, selectedFiles]);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.getProjects();
        setProjects(Array.isArray(list) ? list : []);
        const fromUserSingle = String((user as any)?.project_id || "").trim();
        const fromUserMulti = parseProjectIds((user as any)?.project_ids);
        if (fromUserMulti.length > 1) setProjectId(ALL_ASSIGNED_PROJECTS);
        else if (fromUserMulti.length === 1) setProjectId(fromUserMulti[0]);
        else if (fromUserSingle) setProjectId(fromUserSingle);
      } catch {
        setProjects([]);
      }
    })();
  }, [api, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cfg = await api.getCreditConfig?.();
        if (!cancelled) setCreditConfig(cfg || null);
      } catch {
        if (!cancelled) setCreditConfig(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const pid = String(projectId || "").trim();
    if (!pid) {
      setJiraTickets([]);
      setSelectedJiraTicketKeys([]);
      setJiraError("");
      setJiraInfo("");
      return;
    }
    (async () => {
      try {
        setJiraLoading(true);
        setJiraError("");
        setJiraInfo("");
        const useProjectId = pid && pid !== ALL_ASSIGNED_PROJECTS ? pid : "";
        let resp = await api.getJiraTickets({
          ...(useProjectId ? { projectId: useProjectId } : {}),
          weekStart,
          limit: 40,
        });
        let items = Array.isArray(resp?.items) ? resp.items : [];
        if (!items.length && weekStart) {
          resp = await api.getJiraTickets({
            ...(useProjectId ? { projectId: useProjectId } : {}),
            limit: 40,
          });
          items = Array.isArray(resp?.items) ? resp.items : [];
          if (items.length) {
            setJiraInfo("No current-week Jira updates found; showing active assigned tickets instead.");
          }
        }
        setJiraTickets(items);
        setSelectedJiraTicketKeys((prev) =>
          prev.filter((k) => items.some((x) => String(x.key) === String(k)))
        );
      } catch (err: any) {
        setJiraTickets([]);
        setSelectedJiraTicketKeys([]);
        setJiraError(String(err?.message || "Could not load Jira tickets."));
        setJiraInfo("");
      } finally {
        setJiraLoading(false);
      }
    })();
  }, [api, projectId, weekStart]);

  const addRow = (list: string[], set: (x: string[]) => void) =>
    set([...list, ""]);

  const removeRow = (
    list: string[],
    i: number,
    set: (x: string[]) => void
  ) => {
    const copy = list.slice();
    copy.splice(i, 1);
    set(copy.length ? copy : [""]);
  };

  const trimList = (list: string[]) =>
    list.map((s) => s.trim()).filter(Boolean);

  function toggleJiraTicket(key: string) {
    const normalized = String(key || "").trim().toUpperCase();
    if (!normalized) return;
    setSelectedJiraTicketKeys((prev) => {
      if (prev.includes(normalized)) return prev.filter((x) => x !== normalized);
      return [...prev, normalized];
    });
  }

  function tagJiraInAccomplishments(key: string) {
    const normalized = String(key || "").trim().toUpperCase();
    if (!normalized) return;
    const token = `@${normalized}`;
    setAccomplishments((prev) => {
      const base = String(prev || "");
      if (base.includes(token)) return base;
      const needsSpace = base.length > 0 && !base.endsWith("\n");
      return `${base}${needsSpace ? "\n" : ""}${token} `;
    });
  }

  function ingestFiles(files: File[]) {
    if (!files.length) return;

    const incoming: SelectedFile[] = files.map((file) => ({
      id: makeId(),
      file,
      status: "pending",
      progress: 0,
    }));

    setSelectedFiles((prev) => {
      const existingSignatures = new Set(
        prev.map(
          (x) => `${x.file.name}__${x.file.size}__${x.file.lastModified}`
        )
      );

      const deduped = incoming.filter((x) => {
        const sig = `${x.file.name}__${x.file.size}__${x.file.lastModified}`;
        return !existingSignatures.has(sig);
      });

      return [...prev, ...deduped];
    });
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    ingestFiles(files);

    e.target.value = "";
  }

  function handleAttachmentPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(e.clipboardData?.items || []);
    if (!items.length) return;

    const pastedImages: File[] = items
      .filter((it) => it.kind === "file" && String(it.type || "").startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter(Boolean) as File[];

    if (!pastedImages.length) return;
    e.preventDefault();
    ingestFiles(pastedImages);
    M?.toast?.({ html: `${pastedImages.length} image${pastedImages.length > 1 ? "s" : ""} pasted.` });
  }

  function removeSelectedFile(id: string) {
    setSelectedFiles((prev) => prev.filter((x) => x.id !== id));
  }

  async function uploadSelectedFilesToS3(): Promise<UploadedFileRef[]> {
    if (!selectedFiles.length) return [];

    const fileDescriptors = selectedFiles.map((x) => ({
      fileName: x.file.name,
      mimeType: normalizeMimeType(x.file),
      size: x.file.size,
    }));

    const presignedResp = await api.createWeeklyUpdateUploadUrls({
      weekStart,
      files: fileDescriptors,
    });

    const presignedFiles: PresignedUploadItem[] = Array.isArray(
      presignedResp?.files
    )
      ? presignedResp.files
      : [];

    if (presignedFiles.length !== selectedFiles.length) {
      throw new Error("Presigned upload response count mismatch.");
    }

    const uploadedFiles: UploadedFileRef[] = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const selected = selectedFiles[i];
      const presigned = presignedFiles[i];

      setSelectedFiles((prev) =>
        prev.map((x) =>
          x.id === selected.id
            ? { ...x, status: "uploading", progress: 0, error: "" }
            : x
        )
      );

      try {
        await uploadFileWithProgress(
          presigned.uploadUrl,
          selected.file,
          (pct) => {
            setSelectedFiles((prev) =>
              prev.map((x) =>
                x.id === selected.id ? { ...x, progress: pct } : x
              )
            );
          }
        );

        setSelectedFiles((prev) =>
          prev.map((x) =>
            x.id === selected.id
              ? {
                  ...x,
                  status: "uploaded",
                  progress: 100,
                  s3Key: presigned.s3Key,
                  publicUrl: presigned.publicUrl,
                }
              : x
          )
        );

        uploadedFiles.push({
          name: selected.file.name,
          mimeType: normalizeMimeType(selected.file),
          size: selected.file.size,
          s3Key: presigned.s3Key,
          publicUrl: presigned.publicUrl,
        });
      } catch (err: any) {
        setSelectedFiles((prev) =>
          prev.map((x) =>
            x.id === selected.id
              ? {
                  ...x,
                  status: "failed",
                  error: String(err?.message || "Upload failed"),
                }
              : x
          )
        );
        throw err;
      }
    }

    return uploadedFiles;
  }

  async function performWeeklyUpdateSubmission() {
    if (!weekStart) {
      M?.toast?.({ html: "Please select week start (Monday)." });
      return;
    }

    const timesheet = Object.entries(hours)
      .filter(([, v]) => Number(v) > 0)
      .map(([date, v]) => ({ date, hours: Number(v) }));

    const submission: UpdateSubmission = {
      id: makeRandomId(),
      userId: user?.username || "unknown",
      userName: user?.name || user?.username || "Anonymous",
      weekStart,
      accomplishments,
      blockers,
      next,
      retrospective: {
        worked: trimList(worked),
        didnt: trimList(didnt),
        improve: trimList(improve),
      },
      timesheet,
      createdAt: new Date().toISOString(),
    };

    const uploadedFiles = await uploadSelectedFilesToS3();

    const submitResp: SubmitUpdateResponse = await api.submitUpdate({
        weekStart,
        accomplishments,
        blockers,
        next,
        submissionSource: "manual",
        retrospective: submission.retrospective,
        timesheet,
        uploadedFiles,
        projectId,
        jiraTicketKeys: selectedJiraTicketKeys,
        jiraTickets: jiraTickets
          .filter((t) => selectedJiraTicketKeys.includes(String(t.key)))
          .map((t) => ({
            key: String(t.key || "").trim().toUpperCase(),
            summary: String(t.summary || ""),
            status: String(t.status || ""),
            assignee: String(t.assignee || ""),
            updated: String(t.updated || ""),
          })),
      });

    save({
      ...submission,
      attachments: uploadedFiles,
      uploadStatus:
        submitResp?.uploadStatus || (uploadedFiles.length ? "queued" : "none"),
      driveFolderLink: submitResp?.driveFolderLink || "",
    } as any);

    if (user) {
      try {
        await api.updateUser({
          username: user.username,
          employee_last_update_week: weekStart,
          employee_last_update_hours: String(totalHours),
          employee_last_update_summary: accomplishments.slice(0, 140),
        });
      } catch (err) {
        console.warn("Profile update failed:", err);
      }
    }

    M?.toast?.({
      html:
        submitResp?.uploadStatus === "queued"
          ? "Update submitted. Files are being processed in background."
          : "Update submitted!",
    });

    setAccomplishments("");
    setBlockers("");
    setNext("");
    setWorked([""]);
    setDidnt([""]);
    setImprove([""]);
    setHours({});
    setSelectedFiles([]);
  }

  function clearSubmissionTimers() {
    if (validationTimerRef.current) {
      window.clearInterval(validationTimerRef.current);
      validationTimerRef.current = null;
    }
    if (successTimerRef.current) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearSubmissionTimers();
    };
  }, []);

  async function submitWeeklyUpdate() {
    if (submitting || submissionPhase !== "idle") return;
    if (!weekStart) {
      M?.toast?.({ html: "Please select week start (Monday)." });
      return;
    }

    setSubmitting(true);
    setSubmissionPhase("validating");
    setSubmissionTick(0);
    setSubmissionMessage("AI is validating your update.");
    clearSubmissionTimers();

    const validationDuration = 5000 + Math.floor(Math.random() * 5001);
    const validationStepCount = 4;
    const tickDuration = Math.max(900, Math.floor(validationDuration / validationStepCount));

    validationTimerRef.current = window.setInterval(() => {
      setSubmissionTick((current) => Math.min(validationStepCount - 1, current + 1));
    }, tickDuration);

    successTimerRef.current = window.setTimeout(async () => {
      clearSubmissionTimers();
      setSubmissionPhase("success");
      setSubmissionMessage("AI validated your update. Granting rewards now...");

      try {
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      await performWeeklyUpdateSubmission();
      setWizardStep(0);
      setSubmissionMessage("Success. Your update has been saved and rewards have been granted.");
    } catch (err: any) {
        console.error("submitUpdate failed", err);
        setSubmissionPhase("error");
        setSubmissionMessage(`Failed to submit. ${err?.message || "Please try again."}`);
        M?.toast?.({
          html: `Failed to submit. ${err?.message || "Please try again."}`,
        });
      } finally {
        setSubmitting(false);
        window.setTimeout(() => {
          setSubmissionPhase("idle");
          setSubmissionTick(0);
          setSubmissionMessage("");
        }, 2200);
      }
    }, validationDuration);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submitWeeklyUpdate();
  }

  const totalFileBytes = selectedFiles.reduce(
    (sum, item) => sum + (item.file.size || 0),
    0
  );

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <form onSubmit={handleSubmit}>
        <div className="card" style={shellCard}>
          <div
            style={{
              padding: 22,
              borderBottom: "1px solid rgba(148,163,184,.12)",
              background:
                "radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 30%), radial-gradient(circle at top left, rgba(59,130,246,.07), transparent 28%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 1000,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <i className="material-icons">event_note</i>
                  Weekly Update
                </div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#475569",
                    fontSize: 14,
                    maxWidth: 720,
                  }}
                >
                  Fill your weekly summary, retrospective notes, day-wise hours,
                  and upload supporting files.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate("/updates/ai-intake?ctx=weekly_update")}
                  style={{ borderRadius: 999, fontWeight: 800 }}
                  title="Use AI WebRTC intake flow for guided submission"
                >
                  <i className="material-icons left">headset_mic</i>
                  Try The AI Way To Submit
                </button>
                <MetaChip
                  icon="event"
                  label="Week"
                  value={weekStart || "—"}
                  tint="rgba(59,130,246,.10)"
                  color="#1d4ed8"
                />
                <MetaChip
                  icon="person"
                  label="Employee"
                  value={user?.name || user?.username || "—"}
                  tint="rgba(99,102,241,.10)"
                  color="#4338ca"
                />
                <MetaChip
                  icon="schedule"
                  label="Hours"
                  value={String(totalHours)}
                  tint="rgba(34,197,94,.12)"
                  color="#166534"
                />
                <MetaChip
                  icon="stars"
                  label="Frozen award"
                  value={
                    <FgcAmount
                      amount={displayedCreditPreview.updateTotal}
                      divisor={1}
                      fractionDigits={0}
                      style={{ fontSize: 12, fontWeight: 900, color: "#b45309" }}
                      iconSize={30}
                    />
                  }
                  tint="rgba(245,158,11,.14)"
                  color="#b45309"
                />
              </div>
            </div>
          </div>

          <div className="card-content" style={{ padding: 18 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${wizardSteps.length}, minmax(0, 1fr))`,
                gap: 10,
                marginBottom: 14,
              }}
            >
              {wizardSteps.map((step, index) => {
                const active = index === wizardStep;
                const done = index < wizardStep;
                return (
                  <button
                    key={step.title}
                    type="button"
                    onClick={() => setWizardStep(index)}
                    style={{
                      textAlign: "left",
                      borderRadius: 18,
                      border: `1px solid ${
                        active
                          ? "rgba(37,99,235,.36)"
                          : done
                          ? "rgba(16,185,129,.30)"
                          : "rgba(148,163,184,.18)"
                      }`,
                      background: active
                        ? "linear-gradient(180deg, rgba(239,246,255,.98) 0%, rgba(255,255,255,.98) 100%)"
                        : done
                        ? "linear-gradient(180deg, rgba(240,253,244,.96) 0%, rgba(255,255,255,.98) 100%)"
                        : "rgba(255,255,255,.96)",
                      padding: 14,
                      cursor: "pointer",
                      boxShadow: active ? "0 10px 26px rgba(37,99,235,.10)" : "none",
                      minHeight: 104,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 999,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: active
                            ? "#2563eb"
                            : done
                            ? "#16a34a"
                            : "#e2e8f0",
                          color: active || done ? "#fff" : "#475569",
                          fontWeight: 1000,
                          fontSize: 12,
                          flex: "0 0 auto",
                        }}
                      >
                        {done ? <i className="material-icons" style={{ fontSize: 16 }}>check</i> : index + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 1000,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                            color: active ? "#1d4ed8" : done ? "#166534" : "#64748b",
                          }}
                        >
                          Step {index + 1} of {wizardSteps.length}
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a", marginTop: 2 }}>
                          {step.title}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        color: "#64748b",
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {step.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            {isBackdatedWeek ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(245,158,11,.28)",
                  background: "rgba(255,247,237,.95)",
                  color: "#92400e",
                  fontWeight: 800,
                  lineHeight: 1.5,
                }}
              >
                This update is for an earlier week. It will still save, but it only earns 40% of the normal update credits and does not add to streak release for that week.
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase", color: "#64748b" }}>
                  {currentWizardStep.title}
                </div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 950, color: "#0f172a" }}>
                  {currentWizardStep.subtitle}
                </div>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => navigate("/updates/ai-intake?ctx=weekly_update")}
                style={{ borderRadius: 999, fontWeight: 800 }}
              >
                <i className="material-icons left">headset_mic</i>
                Try The AI Way To Submit
              </button>
            </div>

            {wizardStep === 0 && (
              <>
                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div
                    style={{
                      borderRadius: 18,
                      border: "1px solid rgba(245,158,11,.18)",
                      background: "linear-gradient(180deg, rgba(255,251,235,.98) 0%, rgba(255,255,255,.98) 100%)",
                      padding: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setWeeklyBlockOpen((v) => !v)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase", color: "#b45309" }}>
                            Block 1
                          </div>
                          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 950, color: "#92400e" }}>
                            Current weekly reward split
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                            Weekly update rewards move into Frozen FGC first.
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 1000, color: "#b45309" }}>
                          <FrozenFgcAmount
                            amount={displayedCreditPreview.updateTotal}
                            divisor={1}
                            fractionDigits={0}
                            style={{ fontWeight: 1000, color: "#b45309" }}
                            iconSize={26}
                          />
                          <i className="material-icons" style={{ color: "#b45309" }}>
                            {weeklyBlockOpen ? "expand_less" : "expand_more"}
                          </i>
                        </div>
                      </div>
                    </button>
                    {weeklyBlockOpen && (
                      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                        {displayedCreditPreview.updateItems.map((item) => (
                          <div
                            key={item.label}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 12,
                              background: "rgba(255,255,255,.92)",
                              border: "1px solid rgba(245,158,11,.10)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#7c2d12", fontWeight: 900, minWidth: 0 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b", flex: "0 0 auto" }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ minWidth: 0 }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: "#8a4a11", fontWeight: 700, marginTop: 2 }}>
                                  {item.label === "Weekly update"
                                    ? "Base weekly reward"
                                    : item.label === "Retro"
                                    ? "Added when the retro step is completed"
                                    : "Added when the timesheet step is completed"}
                                </div>
                              </div>
                            </div>
                            <FrozenFgcAmount
                              amount={item.amount}
                              divisor={1}
                              fractionDigits={0}
                              style={{ fontWeight: 1000, color: "#b45309", justifySelf: "end" }}
                              iconSize={22}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: 18,
                      border: "1px solid rgba(59,130,246,.18)",
                      background: "linear-gradient(180deg, rgba(239,246,255,.98) 0%, rgba(255,255,255,.98) 100%)",
                      padding: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setBonusBlockOpen((v) => !v)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase", color: "#1d4ed8" }}>
                            Block 2
                          </div>
                          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 950, color: "#1e40af" }}>
                            Bonus reward
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                            AI submit and file upload go to Frozen FGC. Awards won go to spendable FGC.
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 1000, color: "#1d4ed8" }}>
                          <FrozenFgcAmount
                            amount={weeklyRuleSummary.frozenBonusTotal}
                            divisor={1}
                            fractionDigits={0}
                            style={{ fontWeight: 1000, color: "#1d4ed8" }}
                            iconSize={26}
                          />
                          <i className="material-icons" style={{ color: "#1d4ed8" }}>
                            {bonusBlockOpen ? "expand_less" : "expand_more"}
                          </i>
                        </div>
                      </div>
                    </button>
                    {bonusBlockOpen && (
                      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                        {weeklyRuleSummary.frozenBonusRows.map((item) => (
                          <div
                            key={item.label}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 12,
                              background: "rgba(255,255,255,.92)",
                              border: "1px solid rgba(59,130,246,.10)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#1e40af", fontWeight: 900, minWidth: 0 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#3b82f6", flex: "0 0 auto" }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ minWidth: 0 }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: "#5973b9", fontWeight: 700, marginTop: 2 }}>{item.note}</div>
                              </div>
                            </div>
                            <FrozenFgcAmount
                              amount={item.amount}
                              divisor={1}
                              fractionDigits={0}
                              style={{ fontWeight: 1000, color: "#1d4ed8", justifySelf: "end" }}
                              iconSize={22}
                            />
                          </div>
                        ))}
                        {weeklyRuleSummary.awardRows.map((item) => (
                          <div
                            key={item.label}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr auto",
                              alignItems: "center",
                              gap: 12,
                              padding: "10px 12px",
                              borderRadius: 12,
                              background: "rgba(239,246,255,.95)",
                              border: "1px solid rgba(37,99,235,.14)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#1d4ed8", fontWeight: 900, minWidth: 0 }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#2563eb", flex: "0 0 auto" }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ minWidth: 0 }}>{item.label}</div>
                                <div style={{ fontSize: 11, color: "#5973b9", fontWeight: 700, marginTop: 2 }}>{item.note}</div>
                              </div>
                            </div>
                            <FgcAmount
                              amount={item.amount}
                              divisor={1}
                              fractionDigits={0}
                              style={{ fontWeight: 1000, color: "#1d4ed8", justifySelf: "end" }}
                              iconSize={22}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: 18,
                      border: "1px solid rgba(248,113,113,.20)",
                      background: "linear-gradient(180deg, rgba(254,242,242,.98) 0%, rgba(255,255,255,.98) 100%)",
                      padding: 14,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setPenaltyBlockOpen((v) => !v)}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: ".08em", textTransform: "uppercase", color: "#b91c1c" }}>
                            Block 3
                          </div>
                          <div style={{ marginTop: 4, fontSize: 16, fontWeight: 950, color: "#991b1b" }}>
                            Penalty
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", fontWeight: 700, lineHeight: 1.55 }}>
                            Late submissions only receive 40% of the weekly reward split. Missed weeks are deducted from live FGC first, then Frozen FGC if needed.
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 1000, color: "#b91c1c" }}>
                          <FgcAmount
                            amount={-weeklyRuleSummary.missingUpdatePenalty}
                            divisor={1}
                            fractionDigits={0}
                            style={{ fontWeight: 1000, color: "#b91c1c" }}
                            iconSize={26}
                          />
                          <i className="material-icons" style={{ color: "#b91c1c" }}>
                            {penaltyBlockOpen ? "expand_less" : "expand_more"}
                          </i>
                        </div>
                      </div>
                    </button>
                    {penaltyBlockOpen && (
                      <div style={{ marginTop: 12, borderRadius: 14, padding: 12, background: "rgba(255,255,255,.92)", border: "1px solid rgba(248,113,113,.12)", display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontWeight: 900, color: "#7f1d1d", fontSize: 13, flexWrap: "wrap" }}>
                          <span>Late submission rule</span>
                          <span>40% of weekly rewards</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", fontWeight: 900, color: "#7f1d1d", fontSize: 13, flexWrap: "wrap" }}>
                          <span>Missing weekly update penalty</span>
                          <FgcAmount amount={weeklyRuleSummary.missingUpdatePenalty} divisor={1} fractionDigits={0} style={{ fontWeight: 1000, color: "#b91c1c" }} iconSize={22} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="row" style={{ marginBottom: 0, marginTop: 14 }}>
                  <div className="col s12 m6">
                    <div className="input-field" style={{ marginTop: 0 }}>
                      <input
                        id="weekStart"
                        type="date"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                        style={{ borderRadius: 12 }}
                      />
                      <label className="active" htmlFor="weekStart">
                        Week Start (Monday)
                      </label>
                      <span className="helper-text">
                        Choose the Monday of the week you are reporting. Same-week submissions earn full rewards; late submissions earn 40% and do not advance the streak.
                      </span>
                    </div>
                  </div>

                  <div className="col s12 m6">
                    <div className="input-field" style={{ marginTop: 0 }}>
                      <input
                        id="employeeName"
                        value={user?.name || user?.username || ""}
                        readOnly
                      />
                      <label className="active" htmlFor="employeeName">
                        Employee
                      </label>
                    </div>
                  </div>

                  <div className="col s12 m6">
                    <div className="input-field" style={{ marginTop: 0 }}>
                      <select
                        className="browser-default"
                        value={projectId}
                        onChange={(e) => setProjectId(String(e.target.value || ""))}
                        style={{ borderRadius: 12 }}
                      >
                        <option value="">Select project</option>
                        <option value={ALL_ASSIGNED_PROJECTS}>All Assigned Projects</option>
                        {projects.map((p) => (
                          <option key={String(p.projectId)} value={String(p.projectId)}>
                            {String(p.name || p.projectId)} ({String(p.projectId)})
                          </option>
                        ))}
                      </select>
                      <span className="helper-text">Project used for update and Jira ticket lookup.</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {wizardStep === 1 && (
              <div style={sectionCard}>
                <SectionHeader
                  icon="assignment_turned_in"
                  title="Activity Summary"
                  subtitle="These appear in Activity Report. Keep them crisp, scannable, and manager-friendly."
                />

                <div className="row" style={{ marginBottom: 10 }}>
                  <div className="col s12">
                    <label style={{ fontWeight: 800, color: "#0f172a", display: "block", marginBottom: 8 }}>
                      Jira Tickets (optional)
                    </label>
                    <div
                      style={{
                        border: "1px solid rgba(148,163,184,.25)",
                        borderRadius: 12,
                        padding: 10,
                        minHeight: 56,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        background: "#fff",
                      }}
                    >
                      {jiraTickets.map((t) => {
                        const key = String(t.key || "").trim().toUpperCase();
                        if (!key) return null;
                        const selected = selectedJiraTicketKeys.includes(key);
                        const summary = String(t.summary || "").trim();
                        return (
                          <button
                            key={key}
                            type="button"
                            title={summary || key}
                            onClick={() => {
                              toggleJiraTicket(key);
                              tagJiraInAccomplishments(key);
                            }}
                            style={{
                              border: selected
                                ? "1px solid rgba(16,185,129,.45)"
                                : "1px solid rgba(59,130,246,.32)",
                              background: selected
                                ? "rgba(16,185,129,.14)"
                                : "rgba(59,130,246,.08)",
                              color: selected ? "#065f46" : "#1d4ed8",
                              borderRadius: 999,
                              padding: "6px 10px",
                              fontWeight: 900,
                              fontSize: 12,
                              lineHeight: 1,
                              cursor: "pointer",
                            }}
                          >
                            {key}
                          </button>
                        );
                      })}
                      {!jiraLoading && !jiraTickets.length && (
                        <span style={{ color: "#64748b", fontSize: 12 }}>
                          No tickets available.
                        </span>
                      )}
                    </div>
                    <div className="helper-text">
                      {jiraLoading
                        ? "Loading Jira tickets..."
                        : jiraError
                        ? jiraError
                        : jiraTickets.length
                        ? `${jiraTickets.length} ticket(s) available. Click chips to select and auto-tag in Accomplishments.${jiraInfo ? ` ${jiraInfo}` : ""}`
                        : "No Jira tickets found or Jira not configured for this project."}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ marginBottom: 0 }}>
                  <div className="col s12">
                    <div className="input-field">
                      <textarea
                        id="accomplishments"
                        className="materialize-textarea"
                        data-length={600}
                        value={accomplishments}
                        onChange={(e) => setAccomplishments(e.target.value)}
                        placeholder="- Merged PR #142: combat tweaks&#10;- Completed EQS heatmap prototype"
                        style={{
                          minHeight: 120,
                          borderRadius: 14,
                        }}
                      />
                      <label className="active" htmlFor="accomplishments">
                        Accomplishments
                      </label>
                      <span className="helper-text">
                        What did you complete?
                      </span>
                    </div>
                  </div>

                  <div className="col s12 m6">
                    <div className="input-field">
                      <textarea
                        id="blockers"
                        className="materialize-textarea"
                        data-length={400}
                        value={blockers}
                        onChange={(e) => setBlockers(e.target.value)}
                        placeholder="- Waiting on art export&#10;- Build pipeline flaky on Mac"
                        style={{ minHeight: 110 }}
                      />
                      <label className="active" htmlFor="blockers">
                        Blockers
                      </label>
                    </div>
                  </div>

                  <div className="col s12 m6">
                    <div className="input-field">
                      <textarea
                        id="next"
                        className="materialize-textarea"
                        data-length={400}
                        value={next}
                        onChange={(e) => setNext(e.target.value)}
                        placeholder="- Refactor AI budget director&#10;- Write regression tests"
                        style={{ minHeight: 110 }}
                      />
                      <label className="active" htmlFor="next">
                        Next Week
                      </label>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <SectionHeader
                    icon="attach_file"
                    title="Attachments"
                    subtitle="Files upload directly to S3 from the browser, then the update stores their S3 references for background Drive processing."
                  />

                  <div
                    style={{
                      border: "1px dashed rgba(148,163,184,.35)",
                      borderRadius: 16,
                      padding: 16,
                      background: "rgba(248,250,252,.8)",
                    }}
                    onPaste={handleAttachmentPaste}
                    tabIndex={0}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#0f172a",
                            marginBottom: 4,
                          }}
                        >
                          Add supporting files
                        </div>
                        <div style={{ color: "#64748b", fontSize: 13 }}>
                          Screenshots, docs, videos, zips, builds, or other weekly
                          evidence.
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                          Tip: click this box and press Ctrl/Cmd+V to paste copied screenshots.
                        </div>
                      </div>

                      <label
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 8,
                          borderRadius: 999,
                          padding: "10px 14px",
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          fontWeight: 900,
                          cursor: "pointer",
                          border: "1px solid rgba(59,130,246,.18)",
                        }}
                      >
                        <i className="material-icons" style={{ fontSize: 18 }}>
                          upload_file
                        </i>
                        Choose files
                        <input
                          type="file"
                          multiple
                          onChange={handleFilePick}
                          style={{ display: "none" }}
                        />
                      </label>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <MetaChip
                        icon="folder"
                        label="Files"
                        value={String(selectedFiles.length)}
                        tint="rgba(59,130,246,.10)"
                        color="#1d4ed8"
                      />
                      <MetaChip
                        icon="storage"
                        label="Total Size"
                        value={formatBytes(totalFileBytes)}
                        tint="rgba(34,197,94,.10)"
                        color="#166534"
                      />
                    </div>

                    {!!selectedFiles.length && (
                      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                        {selectedFiles.map((item) => (
                          <div
                            key={item.id}
                            style={{
                              borderRadius: 14,
                              border: "1px solid rgba(148,163,184,.16)",
                              background: "rgba(255,255,255,.92)",
                              padding: 12,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 12,
                                alignItems: "center",
                                flexWrap: "wrap",
                              }}
                            >
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    color: "#0f172a",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {item.file.name}
                                </div>
                                <div
                                  style={{
                                    color: "#64748b",
                                    fontSize: 12,
                                    marginTop: 2,
                                  }}
                                >
                                  {normalizeMimeType(item.file)} •{" "}
                                  {formatBytes(item.file.size)}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 800,
                                    fontSize: 12,
                                    color:
                                      item.status === "uploaded"
                                        ? "#166534"
                                        : item.status === "failed"
                                        ? "#b91c1c"
                                        : item.status === "uploading"
                                        ? "#1d4ed8"
                                        : "#475569",
                                  }}
                                >
                                  {item.status === "pending" && "Pending"}
                                  {item.status === "uploading" &&
                                    `Uploading ${item.progress}%`}
                                  {item.status === "uploaded" && "Uploaded to S3"}
                                  {item.status === "failed" && "Failed"}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => removeSelectedFile(item.id)}
                                  disabled={
                                    submitting || item.status === "uploading"
                                  }
                                  style={{
                                    border: "none",
                                    background: "rgba(255,255,255,.72)",
                                    width: 38,
                                    height: 38,
                                    borderRadius: 999,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    boxShadow:
                                      "0 6px 14px rgba(15,23,42,.06)",
                                  }}
                                >
                                  <i
                                    className="material-icons"
                                    style={{ color: "#dc2626" }}
                                  >
                                    close
                                  </i>
                                </button>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                height: 8,
                                borderRadius: 999,
                                background: "rgba(148,163,184,.18)",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${item.progress}%`,
                                  height: "100%",
                                  borderRadius: 999,
                                  background:
                                    item.status === "failed"
                                      ? "#ef4444"
                                      : item.status === "uploaded"
                                      ? "#22c55e"
                                      : "#3b82f6",
                                  transition: "width .18s ease",
                                }}
                              />
                            </div>

                            {item.error && (
                              <div
                                style={{
                                  marginTop: 8,
                                  color: "#b91c1c",
                                  fontSize: 12,
                                  fontWeight: 700,
                                }}
                              >
                                {item.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {wizardStep === 2 && (
              <div style={sectionCard}>
                <SectionHeader
                  icon="schedule"
                  title="Timesheet"
                  subtitle="Capture the actual hours you logged for each day of the selected week."
                />
                <TimeSheet
                  weekStartISO={weekStart}
                  value={hours}
                  onChange={setHours}
                />
              </div>
            )}

            {wizardStep === 3 && (
              <div style={sectionCard}>
                <SectionHeader
                  icon="sticky_note_2"
                  title="Retrospective"
                  subtitle="Add concise points. These will appear as cards on the Retro Board."
                />

                <RetroList
                  title="What worked"
                  icon="check_circle"
                  accent="#166534"
                  tint="linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)"
                  items={worked}
                  onChange={setWorked}
                  onAdd={() => addRow(worked, setWorked)}
                  onRemove={(i) => removeRow(worked, i, setWorked)}
                />

                <RetroList
                  title="What didn’t work"
                  icon="cancel"
                  accent="#be123c"
                  tint="linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)"
                  items={didnt}
                  onChange={setDidnt}
                  onAdd={() => addRow(didnt, setDidnt)}
                  onRemove={(i) => removeRow(didnt, i, setDidnt)}
                />

                <RetroList
                  title="Improve"
                  icon="build"
                  accent="#92400e"
                  tint="linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)"
                  items={improve}
                  onChange={setImprove}
                  onAdd={() => addRow(improve, setImprove)}
                  onRemove={(i) => removeRow(improve, i, setImprove)}
                />
              </div>
            )}

            {wizardStep === 4 && (
              <div style={sectionCard}>
                <SectionHeader
                  icon="fact_check"
                  title="Review & Submit"
                  subtitle="Check the summary below before sending the weekly update."
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <MetaChip
                    icon="event"
                    label="Week"
                    value={weekStart || "—"}
                    tint="rgba(59,130,246,.10)"
                    color="#1d4ed8"
                  />
                  <MetaChip
                    icon="schedule"
                    label="Hours"
                    value={String(totalHours)}
                    tint="rgba(34,197,94,.12)"
                    color="#166534"
                  />
                  <MetaChip
                    icon="folder"
                    label="Files"
                    value={String(selectedFiles.length)}
                    tint="rgba(59,130,246,.10)"
                    color="#1d4ed8"
                  />
                  <MetaChip
                    icon="stars"
                    label="Frozen award"
                    value={
                      <FgcAmount
                        amount={displayedCreditPreview.updateTotal}
                        divisor={1}
                        fractionDigits={0}
                        style={{ fontSize: 12, fontWeight: 900, color: "#b45309" }}
                        iconSize={28}
                      />
                    }
                    tint="rgba(245,158,11,.14)"
                    color="#b45309"
                  />
                </div>

                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    border: "1px solid rgba(148,163,184,.14)",
                    background: "rgba(248,250,252,.86)",
                    padding: 14,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    Ready to submit the following:
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.7 }}>
                    • Activity summary and supporting notes<br />
                    • TimeSheet entries for the selected week<br />
                    • Retrospective items for worked, didn’t work, and improve<br />
                    • Any uploaded evidence files
                  </div>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 18,
                borderRadius: 18,
                padding: 16,
                border: "1px solid rgba(148,163,184,.14)",
                background:
                  "linear-gradient(180deg, rgba(248,250,252,.92) 0%, rgba(255,255,255,.98) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ color: "#475569", fontWeight: 800 }}>
                Step {wizardStep + 1} of {wizardSteps.length}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {wizardStep > 0 ? (
                  <button
                    className="btn-flat"
                    type="button"
                    onClick={goBackStep}
                    style={{
                      borderRadius: 999,
                      fontWeight: 900,
                    }}
                  >
                    <i className="material-icons left">arrow_back</i>
                    Back
                  </button>
                ) : null}

                {wizardStep < lastWizardStep ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={goNextStep}
                    style={{
                      borderRadius: 999,
                      paddingLeft: 18,
                      paddingRight: 18,
                      boxShadow: "0 10px 24px rgba(37,99,235,.20)",
                    }}
                  >
                    <i className="material-icons left">arrow_forward</i>
                    Next
                  </button>
                ) : (
                  <button
                    className="btn"
                    type="submit"
                    disabled={submitting}
                    style={{
                      borderRadius: 999,
                      paddingLeft: 18,
                      paddingRight: 18,
                      boxShadow: "0 10px 24px rgba(37,99,235,.20)",
                    }}
                  >
                    <i className="material-icons left">
                      {submitting ? "hourglass_top" : "send"}
                    </i>
                    {submitting ? "Submitting..." : "Submit Weekly Update"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function RetroList({
  title,
  icon,
  accent,
  tint,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: string;
  accent: string;
  tint: string;
  items: string[];
  onChange: (items: string[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,.14)",
        background: tint,
        boxShadow: "0 10px 20px rgba(15,23,42,.04)",
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          color: accent,
          fontWeight: 900,
        }}
      >
        <i className="material-icons">{icon}</i>
        <span>{title}</span>
      </div>

      {items.map((value, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <input
            type="text"
            className="browser-default"
            value={value}
            onChange={(e) => {
              const copy = items.slice();
              copy[idx] = e.target.value;
              onChange(copy);
            }}
            placeholder="Short, punchy point…"
            style={{
              flex: 1,
              border: "1px solid rgba(148,163,184,.22)",
              borderRadius: 12,
              padding: "10px 12px",
              background: "rgba(255,255,255,.88)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            title="Remove"
            style={{
              border: "none",
              background: "rgba(255,255,255,.72)",
              width: 40,
              height: 40,
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 6px 14px rgba(15,23,42,.06)",
            }}
          >
            <i className="material-icons" style={{ color: "#dc2626" }}>
              remove_circle
            </i>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 6,
          border: "none",
          background: "rgba(255,255,255,.78)",
          color: accent,
          padding: "8px 12px",
          borderRadius: 999,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          boxShadow: "0 6px 14px rgba(15,23,42,.05)",
        }}
      >
        <i className="material-icons" style={{ fontSize: 18 }}>
          add
        </i>
        Add row
      </button>
    </div>
  );
}
