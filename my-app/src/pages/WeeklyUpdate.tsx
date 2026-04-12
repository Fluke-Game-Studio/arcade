import React, { useEffect, useMemo, useState } from "react";
import TimeSheet from "../components/Timesheet";
import { useUpdates, startOfWeekMonday, toISODate } from "./UpdatesContext";
import { useAuth } from "../auth/AuthContext";
import type { UpdateSubmission } from "./UpdatesContext";
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
  value: string;
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

  const mondayISO = useMemo(() => toISODate(startOfWeekMonday(new Date())), []);
  const [weekStart, setWeekStart] = useState(mondayISO);

  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [next, setNext] = useState("");

  const [worked, setWorked] = useState<string[]>([""]);
  const [didnt, setDidnt] = useState<string[]>([""]);
  const [improve, setImprove] = useState<string[]>([""]);

  const [hours, setHours] = useState<Record<string, number>>({});
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const totalHours = Object.values(hours).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

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

    try {
      setSubmitting(true);

      const uploadedFiles = await uploadSelectedFilesToS3();

      const submitResp: SubmitUpdateResponse = await api.submitUpdate({
        weekStart,
        accomplishments,
        blockers,
        next,
        retrospective: submission.retrospective,
        timesheet,
        uploadedFiles,
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
    } catch (err: any) {
      console.error("submitUpdate failed", err);
      M?.toast?.({
        html: `Failed to submit. ${err?.message || "Please try again."}`,
      });
    } finally {
      setSubmitting(false);
    }
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
                    Choose the Monday of the week you are reporting
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
            </div>
          </div>

          <div className="card-content" style={{ padding: 18 }}>
            <div style={sectionCard}>
              <SectionHeader
                icon="assignment_turned_in"
                title="Activity Summary"
                subtitle="These appear in Activity Report. Keep them crisp, scannable, and manager-friendly."
              />

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
                Total this week:{" "}
                <span style={{ color: "#0f172a" }}>{totalHours}</span> hrs
              </div>

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
