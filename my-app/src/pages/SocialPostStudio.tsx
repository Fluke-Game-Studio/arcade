import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import MentionTextarea from "../components/MentionTextarea";
import SocialPostCard, { type SocialPostCardData } from "../components/SocialPostCard";
import SocialMediaReviewAdmin from "./SocialMediaReviewAdmin";
import { uploadFileToWeeklyBucket } from "../lib/socialUploads";
import type { ApiUser } from "../api/types";

type EditForm = {
  title: string;
  content: string;
  internalReviewNote: string;
  imageUrl: string;
  channels: string[];
  reviewerUsernames: string[];
};

type ReviewTodo = {
  id?: string;
  text: string;
  done?: boolean;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normalizeUserRole(row?: Partial<ApiUser> | null) {
  const direct = safeStr((row as any)?.employee_role || (row as any)?.role).toLowerCase().replace(/_/g, "-");
  const scope = safeStr((row as any)?.read_only_scope).toLowerCase().replace(/_/g, "-");
  const resolved = direct || scope;
  if (resolved === "super" || resolved === "super-readonly") return "super";
  if (resolved === "admin" || resolved === "admin-readonly") return "admin";
  return "employee";
}

function isTeamMember(row?: Partial<ApiUser> | null) {
  const role = normalizeUserRole(row);
  return role === "employee" || role === "admin" || role === "super";
}

function isAdminReviewer(row?: Partial<ApiUser> | null) {
  const role = normalizeUserRole(row);
  return role === "admin" || role === "super";
}

function reviewerRoleLabel(row?: Partial<ApiUser> | null) {
  const role = normalizeUserRole(row);
  if (role === "super") return "Super";
  if (role === "admin") return "Admin";
  return "Team";
}

function toIsoFromDateTimeLocal(value: string) {
  const raw = safeStr(value);
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function previewSrc(url: string) {
  const s = safeStr(url);
  return /^https?:\/\//i.test(s) ? s : "";
}

function toneFor(status?: string) {
  const s = safeStr(status).toLowerCase();
  if (s.includes("approve")) return { border: "rgba(34,197,94,.40)", bg: "rgba(34,197,94,.08)", text: "#166534", label: "APPROVED" };
  if (s.includes("request")) return { border: "rgba(236,72,153,.45)", bg: "rgba(236,72,153,.08)", text: "#be185d", label: "CHANGES REQUESTED" };
  if (s.includes("reject")) return { border: "rgba(239,68,68,.45)", bg: "rgba(239,68,68,.08)", text: "#b91c1c", label: "REJECTED" };
  return { border: "rgba(245,158,11,.45)", bg: "rgba(245,158,11,.10)", text: "#b45309", label: "PENDING REVIEW" };
}

function parseTodos(post: SocialPostCardData): ReviewTodo[] {
  const todos = Array.isArray((post as any).reviewTodos) ? ((post as any).reviewTodos as any[]) : [];
  if (todos.length) {
    return todos
      .map((todo) => ({
        id: safeStr(todo?.id),
        text: safeStr(todo?.text),
        done: !!todo?.done,
        author: safeStr(todo?.author),
        createdAt: safeStr(todo?.createdAt),
        updatedAt: safeStr(todo?.updatedAt),
      }))
      .filter((todo) => todo.text);
  }

  return safeStr(post.reviewNote)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      id: "",
      text: line.replace(/^\[[^\]]+\]\s*[^:]+:\s*/, ""),
      done: /^\[x\]/i.test(line),
      author: line.match(/^\[[^\]]+\]\s*([^:]+):/) ? safeStr(RegExp.$1) : "",
      createdAt: line.match(/^\[([^\]]+)\]/) ? safeStr(RegExp.$1) : "",
    }));
}

function channelMeta(channel: string) {
  const c = safeStr(channel).toLowerCase();
  if (c === "instagram") return { label: "Instagram", icon: "ig" };
  if (c === "facebook") return { label: "Facebook", icon: "f" };
  if (c === "linkedin") return { label: "LinkedIn", icon: "in" };
  if (c === "discord") return { label: "Discord", icon: "#" };
  return { label: channel, icon: "•" };
}

function ChannelChip({ channel, active, onClick }: { channel: string; active: boolean; onClick: () => void }) {
  const meta = channelMeta(channel);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 13px",
        borderRadius: 999,
        border: active ? "1px solid rgba(37,99,235,.24)" : "1px solid rgba(148,163,184,.2)",
        background: active ? "rgba(59,130,246,.12)" : "#fff",
        color: active ? "#1d4ed8" : "#1e293b",
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          display: "inline-grid",
          placeItems: "center",
          background: active ? "rgba(37,99,235,.16)" : "rgba(148,163,184,.12)",
          color: "#1e293b",
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1,
          textTransform: "lowercase",
        }}
      >
        {meta.icon}
      </span>
      <span>{meta.label}</span>
    </button>
  );
}

function SectionCard({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "warning" }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: tone === "warning" ? "1px solid rgba(239,68,68,.18)" : "1px solid rgba(148,163,184,.16)",
        background: tone === "warning" ? "rgba(254,242,242,.88)" : "rgba(248,250,252,.92)",
        padding: 12,
        display: "grid",
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>{title}</div>
      {children}
    </div>
  );
}

function editIconButton(active: boolean) {
  return {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: active ? "1px solid rgba(37,99,235,.26)" : "1px solid rgba(148,163,184,.2)",
    background: active ? "linear-gradient(135deg,rgba(59,130,246,.14),rgba(37,99,235,.08))" : "#fff",
    color: active ? "#1d4ed8" : "#334155",
    display: "inline-grid",
    placeItems: "center",
    cursor: "pointer" as const,
    fontSize: 16,
    fontWeight: 900,
    boxShadow: active ? "0 10px 20px rgba(37,99,235,.12)" : "none",
  };
}

function ReviewerPicker({
  reviewerOptions,
  selected,
  onToggle,
  helperText,
  errorText,
}: {
  reviewerOptions: ApiUser[];
  selected: string[];
  onToggle: (username: string) => void;
  helperText?: string;
  errorText?: string;
}) {
  const selectedUsers = reviewerOptions.filter((row) => selected.includes(safeStr(row.username)));

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <details
        style={{
          borderRadius: 12,
          border: `1px solid ${errorText ? "rgba(239,68,68,.28)" : "rgba(148,163,184,.26)"}`,
          background: "#fff",
          overflow: "hidden",
        }}
      >
        <summary
          style={{
            listStyle: "none",
            cursor: "pointer",
            padding: 12,
            fontWeight: 700,
            color: selectedUsers.length ? "#0f172a" : "#94a3b8",
          }}
        >
          {selectedUsers.length ? `${selectedUsers.length} reviewer${selectedUsers.length === 1 ? "" : "s"} selected` : "Choose teammates"}
        </summary>
        <div style={{ padding: 12, borderTop: "1px solid rgba(148,163,184,.16)", display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
          {reviewerOptions.map((row) => {
            const username = safeStr(row.username);
            const checked = selected.includes(username);
            const roleLabel = reviewerRoleLabel(row);

            return (
              <label
                key={username}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 11px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,.18)",
                  background: checked ? "rgba(59,130,246,.08)" : "rgba(248,250,252,.92)",
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(username)} style={{ marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{safeStr(row.employee_name || row.username)}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                    {roleLabel}
                    {safeStr(row.employee_email) ? ` · ${safeStr(row.employee_email)}` : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </details>
      {helperText ? <div style={{ color: "#64748b", fontWeight: 700, fontSize: 12 }}>{helperText}</div> : null}
      {errorText ? <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 12 }}>{errorText}</div> : null}
      {selectedUsers.length ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {selectedUsers.map((row) => (
            <span
              key={row.username}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 10px",
                borderRadius: 999,
                border: "1px solid rgba(37,99,235,.18)",
                background: "rgba(59,130,246,.10)",
                color: "#1d4ed8",
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              <span>{safeStr(row.employee_name || row.username)}</span>
              <button
                type="button"
                onClick={() => onToggle(safeStr(row.username))}
                style={{ border: 0, background: "transparent", color: "#1d4ed8", cursor: "pointer", fontWeight: 900, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SocialPostStudio({
  embedded = false,
  includeReviewTab = false,
}: {
  embedded?: boolean;
  includeReviewTab?: boolean;
}) {
  const { api, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"submit" | "mine" | "reviews">("submit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [internalReviewNote, setInternalReviewNote] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [draftLocalFile, setDraftLocalFile] = useState<File | null>(null);
  const [draftUploadName, setDraftUploadName] = useState("");
  const [draftUploadProgress, setDraftUploadProgress] = useState(0);
  const [draftUploading, setDraftUploading] = useState(false);
  const [draftUploadError, setDraftUploadError] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [channels, setChannels] = useState<string[]>(["facebook", "instagram"]);
  const [reviewerOptions, setReviewerOptions] = useState<ApiUser[]>([]);
  const [taggedReviewers, setTaggedReviewers] = useState<string[]>([]);
  const [submitReviewerError, setSubmitReviewerError] = useState("");
  const [mine, setMine] = useState<SocialPostCardData[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  const [editUploadStates, setEditUploadStates] = useState<Record<string, { uploading: boolean; progress: number; name: string; error: string; file?: File | null }>>({});
  const [editMessages, setEditMessages] = useState<Record<string, { type: "error" | "ok"; text: string }>>({});

  useEffect(() => {
    const requested = safeStr(searchParams.get("tab")).toLowerCase();
    if (requested === "mine") {
      setActiveTab("mine");
      return;
    }
    if (requested === "reviews" && includeReviewTab) {
      setActiveTab("reviews");
      return;
    }
    if (requested === "submit") {
      setActiveTab("submit");
    }
  }, [includeReviewTab, searchParams]);

  async function loadMine() {
    setLoading(true);
    try {
      const resp = await api.getMySocialPosts();
      const items = Array.isArray(resp?.items) ? resp.items : [];
      setMine(items);
      setEditForms((prev) => {
        const next = { ...prev };
        for (const p of items) {
          if (!next[p.post_id]) {
            next[p.post_id] = {
              title: safeStr(p.title),
              content: safeStr(p.content),
              internalReviewNote: safeStr((p as any).internalReviewNote),
              imageUrl: safeStr(p.imageUrl),
              channels: Array.isArray(p.channels) ? p.channels : [],
              reviewerUsernames: Array.isArray((p as any).reviewerUsernames) ? (p as any).reviewerUsernames.map(safeStr).filter(Boolean) : [],
            };
          }
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMine();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadReviewerOptions() {
      try {
        const rows = await api.getUsers();
        if (!mounted) return;
        setReviewerOptions(
          (Array.isArray(rows) ? rows : [])
            .filter((row) => isTeamMember(row))
            .sort((a, b) => safeStr(a.employee_name || a.username).localeCompare(safeStr(b.employee_name || b.username)))
        );
      } catch {
        if (!mounted) return;
        setReviewerOptions([]);
      }
    }
    void loadReviewerOptions();
    return () => {
      mounted = false;
    };
  }, [api]);

  const submitPreview = useMemo(
    () => ({
      title: title || "Preview title",
      caption: content || "Preview caption",
      imageUrl: previewSrc(imageUrl),
    }),
    [content, imageUrl, title]
  );

  const taggedReviewerUsers = useMemo(
    () => reviewerOptions.filter((row) => taggedReviewers.includes(safeStr(row.username))),
    [reviewerOptions, taggedReviewers]
  );
  const hasAdminTaggedReviewer = useMemo(
    () => taggedReviewerUsers.some((row) => isAdminReviewer(row)),
    [taggedReviewerUsers]
  );

  function selectionHasAdminReviewer(selected: string[]) {
    return reviewerOptions
      .filter((row) => selected.includes(safeStr(row.username)))
      .some((row) => isAdminReviewer(row));
  }

  function toggleDraftChannel(channel: string) {
    setChannels((prev) => (prev.includes(channel) ? prev.filter((item) => item !== channel) : [...prev, channel]));
  }

  function toggleDraftReviewer(username: string) {
    setSubmitReviewerError("");
    setTaggedReviewers((prev) => (prev.includes(username) ? prev.filter((item) => item !== username) : [...prev, username]));
  }

  function updateEditForm(postId: string, patch: Partial<EditForm>) {
    setEditForms((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      return { ...prev, [postId]: { ...current, ...patch } };
    });
  }

  function toggleEditChannel(postId: string, channel: string) {
    setEditForms((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      const nextChannels = current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];
      return { ...prev, [postId]: { ...current, channels: nextChannels } };
    });
  }

  function toggleEditReviewer(postId: string, username: string) {
    setEditMessages((prev) => ({ ...prev, [postId]: { type: "ok", text: "" } }));
    setEditForms((prev) => {
      const current = prev[postId];
      if (!current) return prev;
      const nextReviewers = current.reviewerUsernames.includes(username)
        ? current.reviewerUsernames.filter((item) => item !== username)
        : [...current.reviewerUsernames, username];
      return { ...prev, [postId]: { ...current, reviewerUsernames: nextReviewers } };
    });
  }

  async function submitDraft() {
    setSubmitError("");
    setSubmitOk("");
    setSubmitReviewerError("");

    if (!content.trim()) {
      setSubmitError("Caption/content cannot be empty.");
      return;
    }
    if (!taggedReviewers.length) {
      setSubmitReviewerError("Select reviewers before submitting.");
      return;
    }
    if (!hasAdminTaggedReviewer) {
      setSubmitReviewerError("Select at least one admin or super reviewer before submitting.");
      return;
    }

    setSaving(true);
    try {
      let finalImageUrl = imageUrl;
      if (draftLocalFile) {
        setDraftUploading(true);
        setDraftUploadError("");
        const uploaded = await uploadFileToWeeklyBucket(api, draftLocalFile, (pct) => setDraftUploadProgress(pct));
        finalImageUrl = uploaded.publicUrl || finalImageUrl;
      }
      await api.submitSocialPost({
        title,
        content,
        internalReviewNote,
        imageUrl: finalImageUrl,
        caption: content,
        channels,
        scheduledAt: toIsoFromDateTimeLocal(scheduledAt),
        reviewerUsernames: taggedReviewers,
      });
      setTitle("");
      setContent("");
      setInternalReviewNote("");
      setImageUrl("");
      setDraftLocalFile(null);
      setDraftUploadName("");
      setDraftUploadProgress(0);
      setDraftUploadError("");
      setScheduledAt("");
      setTaggedReviewers([]);
      setSubmitOk("Draft submitted for review.");
      setActiveTab("mine");
      await loadMine();
    } catch (e: any) {
      setSubmitError(e?.message || "Submit failed");
    } finally {
      setDraftUploading(false);
      setSaving(false);
    }
  }

  async function saveEdit(postId: string) {
    const form = editForms[postId];
    if (!form?.content.trim()) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: "Caption cannot be empty." } }));
      return;
    }
    if (!form?.reviewerUsernames?.length) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: "Select reviewers before sending this back to review." } }));
      return;
    }
    if (!selectionHasAdminReviewer(form.reviewerUsernames)) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: "Select at least one admin or super reviewer before sending this back to review." } }));
      return;
    }

    setEditMessages((prev) => ({ ...prev, [postId]: { type: "ok", text: "Saving..." } }));
    setSaving(true);
    try {
      let nextImageUrl = form.imageUrl;
      const queuedFile = editUploadStates[postId]?.file;
      if (queuedFile) {
        setEditUploadStates((prev) => ({
          ...prev,
          [postId]: { ...(prev[postId] || { uploading: false, progress: 0, name: queuedFile.name, error: "" }), uploading: true, progress: 0, name: queuedFile.name, error: "", file: queuedFile },
        }));
        const uploaded = await uploadFileToWeeklyBucket(api, queuedFile, (pct) => {
          setEditUploadStates((prev) => ({
            ...prev,
            [postId]: { ...(prev[postId] || { uploading: true, progress: 0, name: queuedFile.name, error: "", file: queuedFile }), uploading: true, progress: pct, name: queuedFile.name, error: "", file: queuedFile },
          }));
        });
        nextImageUrl = uploaded.publicUrl || nextImageUrl;
      }

      await api.updateSocialPost({
        postId,
        title: form.title,
        content: form.content,
        caption: form.content,
        internalReviewNote: form.internalReviewNote,
        imageUrl: nextImageUrl,
        channels: form.channels,
        reviewerUsernames: form.reviewerUsernames,
      });

      if (queuedFile) {
        updateEditForm(postId, { imageUrl: nextImageUrl });
      }

      setEditMessages((prev) => ({ ...prev, [postId]: { type: "ok", text: "Draft updated and sent back to review." } }));
      setEditUploadStates((prev) => ({ ...prev, [postId]: { uploading: false, progress: 0, name: "", error: "", file: null } }));
      setEditingPostId(null);
      await loadMine();
    } catch (e: any) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: e?.message || "Edit save failed" } }));
      setEditUploadStates((prev) => ({
        ...prev,
        [postId]: { ...(prev[postId] || { uploading: false, progress: 0, name: "", error: "" }), uploading: false, error: e?.message || "Edit save failed" },
      }));
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { key: "submit" as const, label: "Submit draft" },
    { key: "mine" as const, label: "My submissions" },
    ...(includeReviewTab ? [{ key: "reviews" as const, label: "My reviews" }] : []),
  ];

  return (
    <div style={{ padding: embedded ? 0 : 20, maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
      {!embedded ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>Social Post Studio</h2>
          <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>
            Submit a draft, tag reviewers, then track and edit your own submissions from the second tab.
          </p>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              border: "1px solid rgba(148,163,184,.22)",
              borderRadius: 999,
              padding: "10px 16px",
              background: activeTab === tab.key ? "linear-gradient(135deg,#2563eb,#0f766e)" : "#fff",
              color: activeTab === tab.key ? "#fff" : "#1e293b",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: activeTab === tab.key ? "0 10px 18px rgba(37,99,235,.16)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "submit" ? (
        <section style={{ display: "grid", gap: 16 }}>
          <SocialPostCard
            post={{ post_id: "draft-preview", title: submitPreview.title, content: submitPreview.caption, internalReviewNote, imageUrl: submitPreview.imageUrl, channels }}
            tone={{ border: "rgba(148,163,184,.18)", bg: "linear-gradient(180deg, #fff, #f8fafc)", text: "#475569", label: "LIVE PREVIEW" }}
            previewUrl={submitPreview.imageUrl}
            sidebarContent={
              <div style={{ display: "grid", gap: 10 }}>
                {internalReviewNote ? (
                  <SectionCard title="Internal review note">
                    <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {internalReviewNote}
                    </div>
                  </SectionCard>
                ) : null}
                <SectionCard title="Reviewers" tone={taggedReviewerUsers.length ? "default" : "warning"}>
                  {taggedReviewerUsers.length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {taggedReviewerUsers.map((row) => (
                        <span
                          key={row.username}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "7px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(37,99,235,.18)",
                            background: "rgba(59,130,246,.10)",
                            color: "#1d4ed8",
                            fontWeight: 800,
                            fontSize: 12,
                          }}
                        >
                          {safeStr(row.employee_name || row.username)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>Pick at least one admin or super reviewer.</div>
                  )}
                </SectionCard>

                <SectionCard title="Channels">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["instagram", "facebook", "linkedin", "discord"].map((channel) => (
                      <ChannelChip key={channel} channel={channel} active={channels.includes(channel)} onClick={() => toggleDraftChannel(channel)} />
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="Schedule">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff", width: "100%" }}
                  />
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                    {scheduledAt ? `Queued for ${scheduledAt.replace("T", " ")}` : "Leave blank to publish immediately after approval."}
                  </div>
                </SectionCard>

                <SectionCard title="Upload local file">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setDraftLocalFile(file);
                        setDraftUploadName(file.name);
                        setDraftUploadProgress(0);
                        setDraftUploadError("");
                      }
                      e.target.value = "";
                    }}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff", width: "100%" }}
                  />
                  {draftLocalFile ? (
                    <div style={{ color: "#475569", fontSize: 12, fontWeight: 700 }}>
                      Selected: <b>{draftUploadName}</b>. Upload will run only when you submit.
                    </div>
                  ) : (
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>Or keep using a public URL from the form below.</div>
                  )}
                  {draftUploading ? <div style={{ color: "#1d4ed8", fontSize: 12, fontWeight: 800 }}>Uploading {draftUploadName}... {draftUploadProgress}%</div> : null}
                  {draftUploadError ? <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800 }}>{draftUploadError}</div> : null}
                </SectionCard>
              </div>
            }
          />

          <section
            style={{
              borderRadius: 20,
              border: "1px solid rgba(148,163,184,.18)",
              background: "#fff",
              padding: 18,
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>Submit draft</h3>
              <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>
                Tag teammates for review access. The submitter goes in To, tagged reviewers go in CC, and at least one selected reviewer must be an admin or super.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void submitDraft(); }} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Title</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
                </label>

                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Content / URL</span>
                  <input
                    value={draftLocalFile ? "" : imageUrl}
                    onChange={(e) => {
                      setDraftLocalFile(null);
                      setImageUrl(e.target.value);
                    }}
                    placeholder="https://..."
                    disabled={!!draftLocalFile}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid rgba(148,163,184,.26)",
                      background: draftLocalFile ? "rgba(148,163,184,.14)" : "#fff",
                      color: draftLocalFile ? "#94a3b8" : "#0f172a",
                    }}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / content</span>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", resize: "vertical" }} />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Internal review note</span>
                <MentionTextarea
                  value={internalReviewNote}
                  onChange={setInternalReviewNote}
                  placeholder="Private note for reviewers. Use @username or @email to tag teammates."
                  rows={4}
                  users={reviewerOptions}
                />
              </label>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Tag reviewers</span>
                <ReviewerPicker
                  reviewerOptions={reviewerOptions}
                  selected={taggedReviewers}
                  onToggle={toggleDraftReviewer}
                  helperText="Tagged teammates can see this post on the Organisation review page. At least one selected reviewer must still be an admin or super."
                  errorText={submitReviewerError}
                />
              </label>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="submit"
                  disabled={!content.trim() || !taggedReviewers.length || !hasAdminTaggedReviewer || saving}
                  style={{
                    border: 0,
                    borderRadius: 999,
                    padding: "12px 18px",
                    background: !content.trim() || !taggedReviewers.length || !hasAdminTaggedReviewer || saving ? "#94a3b8" : "linear-gradient(135deg,#2563eb,#0f766e)",
                    color: "#fff",
                    fontWeight: 900,
                    cursor: !content.trim() || !taggedReviewers.length || !hasAdminTaggedReviewer || saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Submitting..." : "Submit for review"}
                </button>
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                  {draftLocalFile ? `Local file queued: ${draftUploadName}` : imageUrl ? "Using public URL media" : "No media selected yet"}
                </div>
              </div>

              {submitOk ? <div style={{ borderRadius: 14, padding: 12, background: "rgba(34,197,94,.10)", color: "#166534", fontWeight: 800 }}>{submitOk}</div> : null}
              {submitError ? <div style={{ borderRadius: 14, padding: 12, background: "rgba(248,113,113,.10)", color: "#991b1b", fontWeight: 800 }}>{submitError}</div> : null}
            </form>
          </section>
        </section>
      ) : activeTab === "mine" ? (
        <section style={{ borderRadius: 20, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 16, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000 }}>My submissions</h3>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 800, color: "#475569" }}>
              <input type="checkbox" checked={showOnlyPending} onChange={(e) => setShowOnlyPending(e.target.checked)} />
              Show only pending
            </label>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {mine
              .filter((post) => !showOnlyPending || safeStr(post.status).toLowerCase().includes("pending"))
              .map((post) => {
                const tone = toneFor(post.status);
                const todos = parseTodos(post);
                const form = editForms[post.post_id] || {
                  title: safeStr(post.title),
                  content: safeStr(post.content),
                  internalReviewNote: safeStr((post as any).internalReviewNote),
                  imageUrl: safeStr(post.imageUrl),
                  channels: Array.isArray(post.channels) ? post.channels : [],
                  reviewerUsernames: Array.isArray((post as any).reviewerUsernames) ? (post as any).reviewerUsernames.map(safeStr).filter(Boolean) : [],
                };
                  const isEditing = editingPostId === post.post_id;

                  return (
                    <SocialPostCard
                      key={post.post_id}
                      post={{ ...post, internalReviewNote: form.internalReviewNote }}
                      tone={tone}
                      previewUrl={previewSrc(form.imageUrl || post.imageUrl || "")}
                      subMeta={safeStr(post.scheduledAt) ? `Requested publish: ${safeStr(post.scheduledAt)}` : undefined}
                      sidebarContent={
                        <div style={{ display: "grid", gap: 10 }}>
                          {safeStr(form.internalReviewNote) ? (
                            <SectionCard title="Internal review note">
                              <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                {form.internalReviewNote}
                              </div>
                            </SectionCard>
                          ) : null}
                          <SectionCard title="Review history">
                            {todos.length ? (
                              <div style={{ display: "grid", gap: 8 }}>
                                {todos.map((todo) => (
                                  <label
                                    key={`${post.post_id}-${todo.id || todo.text}`}
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: 10,
                                      padding: "10px 11px",
                                      borderRadius: 12,
                                      border: "1px solid rgba(148,163,184,.18)",
                                      background: todo.done ? "rgba(34,197,94,.08)" : "rgba(248,250,252,.92)",
                                      color: "#334155",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      lineHeight: 1.45,
                                      textDecoration: todo.done ? "line-through" : "none",
                                      opacity: todo.done ? 0.72 : 1,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!todo.done}
                                      onChange={async () => {
                                        try {
                                          await api.toggleSocialPostTodo({ postId: post.post_id, todoId: todo.id, done: !todo.done });
                                          await loadMine();
                                        } catch (e: any) {
                                          setEditMessages((prev) => ({ ...prev, [post.post_id]: { type: "error", text: e?.message || "Failed to update todo" } }));
                                        }
                                      }}
                                      style={{ marginTop: 3, flex: "0 0 auto" }}
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                      <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal" }}>{todo.text}</div>
                                      {[todo.author, todo.createdAt].filter(Boolean).length ? (
                                        <div style={{ marginTop: 3, fontSize: 10, color: "#64748b", fontWeight: 700, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                          {[todo.author, todo.createdAt].filter(Boolean).join(" · ")}
                                        </div>
                                      ) : null}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>No review history yet.</div>
                            )}
                          </SectionCard>
                        </div>
                      }
                      headerActions={!safeStr(post.status).toLowerCase().includes("approve") ? (
                        isEditing ? (
                          <button
                            type="button"
                            onClick={() => void saveEdit(post.post_id)}
                            aria-label="Save post"
                            title="Save post"
                            style={editIconButton(true)}
                          >
                            ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingPostId(post.post_id)}
                            aria-label="Edit post"
                            title="Edit post"
                            style={editIconButton(false)}
                          >
                            ✎
                          </button>
                        )
                      ) : undefined}
                      headerEditor={
                        isEditing ? (
                          <>
                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Title</span>
                              <input value={form.title} onChange={(e) => updateEditForm(post.post_id, { title: e.target.value })} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
                            </label>
                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / text</span>
                              <textarea value={form.content} onChange={(e) => updateEditForm(post.post_id, { content: e.target.value })} rows={5} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", resize: "vertical" }} />
                            </label>
                            <label style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Internal review note</span>
                              <MentionTextarea
                                value={form.internalReviewNote}
                                onChange={(next) => updateEditForm(post.post_id, { internalReviewNote: next })}
                                placeholder="Private note for reviewers. Use @username or @email to tag teammates."
                                rows={4}
                                users={reviewerOptions}
                              />
                            </label>
                            <div style={{ display: "grid", gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Channels</span>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {["instagram", "facebook", "linkedin", "discord"].map((channel) => (
                                  <ChannelChip key={`${post.post_id}-header-${channel}`} channel={channel} active={form.channels.includes(channel)} onClick={() => toggleEditChannel(post.post_id, channel)} />
                                ))}
                              </div>
                            </div>
                          </>
                        ) : undefined
                      }
                      comments={todos.map((todo) => ({
                      text: todo.text,
                      checked: !!todo.done,
                      onToggle: async () => {
                        try {
                          await api.toggleSocialPostTodo({ postId: post.post_id, todoId: todo.id, done: !todo.done });
                          await loadMine();
                        } catch (e: any) {
                          setEditMessages((prev) => ({ ...prev, [post.post_id]: { type: "error", text: e?.message || "Failed to update todo" } }));
                        }
                      },
                      meta: [todo.author, todo.createdAt].filter(Boolean).join(" · ") || undefined,
                    }))}
                      editor={
                        isEditing ? (
                          <div style={{ display: "grid", gap: 12, marginTop: 6 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                              <label style={{ display: "grid", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Fresh content / URL</span>
                                <input
                                value={editUploadStates[post.post_id]?.file ? "" : form.imageUrl}
                                onChange={(e) => updateEditForm(post.post_id, { imageUrl: e.target.value })}
                                disabled={!!editUploadStates[post.post_id]?.file}
                                placeholder="https://..."
                                style={{
                                  padding: 12,
                                  borderRadius: 12,
                                  border: "1px solid rgba(148,163,184,.26)",
                                  background: editUploadStates[post.post_id]?.file ? "rgba(148,163,184,.14)" : "#fff",
                                  color: editUploadStates[post.post_id]?.file ? "#94a3b8" : "#0f172a",
                                }}
                              />
                            </label>
                          </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                              <label style={{ display: "grid", gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Upload local file</span>
                              <input
                                type="file"
                                accept="image/*,video/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setEditUploadStates((prev) => ({
                                      ...prev,
                                      [post.post_id]: { uploading: false, progress: 0, name: file.name, error: "", file },
                                    }));
                                  }
                                  e.target.value = "";
                                }}
                                style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff" }}
                              />
                              {editUploadStates[post.post_id]?.file ? <div style={{ color: "#475569", fontWeight: 700, fontSize: 12 }}>Selected: {editUploadStates[post.post_id].name}. Upload will run on save.</div> : null}
                              {editUploadStates[post.post_id]?.uploading ? <div style={{ color: "#1d4ed8", fontWeight: 800, fontSize: 12 }}>Uploading {editUploadStates[post.post_id].name}... {editUploadStates[post.post_id].progress}%</div> : null}
                              {editUploadStates[post.post_id]?.error ? <div style={{ color: "#b91c1c", fontWeight: 800, fontSize: 12 }}>{editUploadStates[post.post_id].error}</div> : null}
                              </label>
                            </div>

                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Tag reviewers</span>
                            <ReviewerPicker
                              reviewerOptions={reviewerOptions}
                              selected={form.reviewerUsernames}
                              onToggle={(username) => toggleEditReviewer(post.post_id, username)}
                              helperText="Tagged teammates can still view this post on the Organisation review page after you send the updated draft back."
                              errorText={!form.reviewerUsernames.length ? "Select reviewers for this draft." : !selectionHasAdminReviewer(form.reviewerUsernames) ? "At least one selected reviewer must be an admin or super." : ""}
                            />
                          </label>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              disabled={saving || !form.reviewerUsernames.length || !selectionHasAdminReviewer(form.reviewerUsernames)}
                              onClick={() => void saveEdit(post.post_id)}
                              style={{
                                border: 0,
                                borderRadius: 999,
                                padding: "12px 16px",
                                background: saving || !form.reviewerUsernames.length ? "#94a3b8" : "linear-gradient(135deg,#2563eb,#0f766e)",
                                color: "#fff",
                                fontWeight: 900,
                                cursor: saving || !form.reviewerUsernames.length ? "not-allowed" : "pointer",
                              }}
                            >
                              {saving ? "Saving..." : "Save update"}
                            </button>
                          </div>

                          {editMessages[post.post_id]?.text ? (
                            <div
                              style={{
                                borderRadius: 12,
                                padding: 10,
                                background: editMessages[post.post_id].type === "error" ? "rgba(248,113,113,.10)" : "rgba(34,197,94,.10)",
                                color: editMessages[post.post_id].type === "error" ? "#991b1b" : "#166534",
                                fontWeight: 800,
                              }}
                            >
                              {editMessages[post.post_id].text}
                            </div>
                          ) : null}
                        </div>
                      ) : null
                    }
                  />
                );
              })}

            {!mine.length ? <div style={{ color: "#64748b", fontWeight: 700 }}>{loading ? "Loading..." : "No submissions yet."}</div> : null}
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 12 }}>
          <SocialMediaReviewAdmin mode="org" embedded onlyTaggedUsername={safeStr((user as any)?.username)} />
        </section>
      )}
    </div>
  );
}
