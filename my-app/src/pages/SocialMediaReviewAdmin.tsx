import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import MentionTextarea from "../components/MentionTextarea";
import SocialPostCard, { type SocialPostCardData } from "../components/SocialPostCard";
import type { ApiUser } from "../api/types/users";

declare const M: any;

type TopTab = "requests" | "media";
type RequestTab = "pending" | "approved" | "published";
type MediaTab = "discord" | "linkedin" | "instagram" | "facebook";

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

function isReviewTeamMember(row?: Partial<ApiUser> | null) {
  const role = normalizeUserRole(row);
  return role === "employee" || role === "admin" || role === "super";
}

function toIsoFromDateTimeLocal(value?: string) {
  const raw = safeStr(value);
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function toDateTimeLocalInput(value?: string) {
  const raw = safeStr(value);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function parseDate(value?: string) {
  const raw = safeStr(value);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPastDate(value?: string) {
  const d = parseDate(value);
  return !!d && d.getTime() <= Date.now();
}

function isFutureDate(value?: string) {
  const d = parseDate(value);
  return !!d && d.getTime() > Date.now();
}

function isPostedPost(post?: SocialPostCardData | null) {
  const status = safeStr(post?.status).toLowerCase();
  if (status === "published") return true;
  return !!safeStr(post?.publishResult?.publishedAt) && !safeStr(post?.scheduledAt);
}

type ReviewTodo = {
  id?: string;
  text: string;
  done?: boolean;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
};

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

function previewSrc(url: string) {
  const s = safeStr(url);
  return /^https?:\/\//i.test(s) ? s : "";
}

function statusTone(status?: string) {
  const s = safeStr(status).toLowerCase();
  if (s.includes("approve")) return { border: "rgba(34,197,94,.45)", bg: "rgba(34,197,94,.08)", text: "#166534", label: "APPROVED" };
  if (s.includes("request")) return { border: "rgba(236,72,153,.45)", bg: "rgba(236,72,153,.08)", text: "#be185d", label: "CHANGES REQUESTED" };
  if (s.includes("reject")) return { border: "rgba(239,68,68,.45)", bg: "rgba(239,68,68,.08)", text: "#b91c1c", label: "REJECTED" };
  return { border: "rgba(245,158,11,.45)", bg: "rgba(245,158,11,.10)", text: "#b45309", label: "PENDING REVIEW" };
}

function tabButton(active: boolean) {
  return {
    border: "1px solid rgba(148,163,184,.18)",
    borderRadius: 999,
    padding: "10px 16px",
    fontWeight: 900 as const,
    cursor: "pointer" as const,
    background: active ? "linear-gradient(135deg,rgba(59,130,246,.18),rgba(37,99,235,.12))" : "transparent",
    color: active ? "#1d4ed8" : "#1e293b",
    boxShadow: active ? "inset 0 0 0 1px rgba(59,130,246,.22)" : "none",
  };
}

function reviewActionButton(tone: "blue" | "green" | "red") {
  const palette = tone === "green"
    ? {
        border: "1px solid rgba(34,197,94,.24)",
        background: "rgba(34,197,94,.10)",
        color: "#166534",
      }
    : tone === "red"
      ? {
          border: "1px solid rgba(239,68,68,.24)",
          background: "rgba(239,68,68,.10)",
          color: "#b91c1c",
        }
      : {
          border: "1px solid rgba(37,99,235,.24)",
          background: "rgba(59,130,246,.10)",
          color: "#1d4ed8",
        };

  return {
    border: palette.border,
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 900 as const,
    cursor: "pointer" as const,
    background: palette.background,
    color: palette.color,
    textAlign: "center" as const,
  };
}

type AdminEditDraft = {
  title: string;
  content: string;
  imageUrl: string;
  channels: string[];
};

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
        padding: "8px 12px",
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

function toast(message: string, classes = "red") {
  if (typeof M !== "undefined" && M?.toast) {
    M.toast({ html: message, classes });
  }
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

export default function SocialMediaReviewAdmin({
  mode = "admin",
  embedded = false,
  onlyTaggedUsername = "",
}: {
  mode?: "admin" | "org";
  embedded?: boolean;
  onlyTaggedUsername?: string;
}) {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const isOrgMode = mode === "org";
  const [posts, setPosts] = useState<SocialPostCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, AdminEditDraft>>({});
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [approvalPrompts, setApprovalPrompts] = useState<Record<string, boolean>>({});
  const [topTab, setTopTab] = useState<TopTab>("requests");
  const [requestTab, setRequestTab] = useState<RequestTab>("pending");
  const [mediaTab, setMediaTab] = useState<MediaTab>("discord");
  const [mentionUsers, setMentionUsers] = useState<ApiUser[]>([]);

  useEffect(() => {
    const requestedTop = safeStr(searchParams.get("topTab")).toLowerCase();
    const requestedRequest = safeStr(searchParams.get("requestTab")).toLowerCase();
    const requestedMedia = safeStr(searchParams.get("mediaTab")).toLowerCase();

    if (!isOrgMode && (requestedTop === "requests" || requestedTop === "media")) {
      setTopTab(requestedTop as TopTab);
    }
    if (requestedRequest === "pending" || requestedRequest === "approved" || requestedRequest === "published") {
      setRequestTab(requestedRequest as RequestTab);
    }
    if (requestedMedia === "discord" || requestedMedia === "linkedin" || requestedMedia === "instagram" || requestedMedia === "facebook") {
      setMediaTab(requestedMedia as MediaTab);
    }
  }, [isOrgMode, searchParams]);

  async function load() {
    setLoading(true);
    try {
      const resp = isOrgMode ? await api.getSocialPostsOrg() : await api.getSocialPosts();
      const items = Array.isArray(resp?.items) ? resp.items : [];
      setPosts(items);
      setNoteDrafts((prev) => {
        const next = { ...prev };
        for (const p of items) {
          if (!(p.post_id in next)) next[p.post_id] = "";
        }
        return next;
      });
      setScheduleDrafts((prev) => {
        const next = { ...prev };
        for (const p of items) {
          if (!(p.post_id in next)) next[p.post_id] = toDateTimeLocalInput(p.scheduledAt);
        }
        return next;
      });
      setEditDrafts((prev) => {
        const next = { ...prev };
        for (const p of items) {
          if (!(p.post_id in next)) {
            next[p.post_id] = {
              title: safeStr(p.title),
              content: safeStr(p.content),
              imageUrl: safeStr(p.imageUrl),
              channels: Array.isArray(p.channels) ? p.channels.map(safeStr).filter(Boolean) : [],
            };
          }
        }
        return next;
      });
    } catch (e: any) {
      toast(e?.message || "Failed to load review queue", "red");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOrgMode]);

  useEffect(() => {
    let mounted = true;
    async function loadMentionUsers() {
      try {
        const rows = await api.getUsers();
        if (!mounted) return;
        setMentionUsers(
          (Array.isArray(rows) ? rows : [])
            .filter((row) => isReviewTeamMember(row) && !!safeStr(row.username))
            .sort((a, b) =>
              safeStr(a.employee_name || a.username || "Unknown teammate").localeCompare(
                safeStr(b.employee_name || b.username || "Unknown teammate")
              )
            )
        );
      } catch {
        if (!mounted) return;
        setMentionUsers([]);
      }
    }
    void loadMentionUsers();
    return () => {
      mounted = false;
    };
  }, [api]);

  async function decide(postId: string, decision: string, opts?: { forceNow?: boolean }) {
    const post = posts.find((item) => item.post_id === postId);
    const editDraft = editDrafts[postId] || {
      title: safeStr(post?.title),
      content: safeStr(post?.content),
      imageUrl: safeStr(post?.imageUrl),
      channels: Array.isArray(post?.channels) ? post.channels.map(safeStr).filter(Boolean) : [],
    };
    const note = safeStr(noteDrafts[postId]);
    const scheduledAt = safeStr(scheduleDrafts[postId]);
    const existingScheduledAt = safeStr(post?.scheduledAt);
    const effectiveScheduledAt = scheduledAt || existingScheduledAt;
    if (decision === "request_changes" && !note) {
      toast("Add a comment for request changes on this post.", "red");
      return;
    }
    if (decision === "approve") {
      if (scheduledAt && !isFutureDate(scheduledAt)) {
        setApprovalPrompts((prev) => ({ ...prev, [postId]: true }));
        toast("Pick a future publish time, or use Submit now for this post.", "orange");
        return;
      }
      if (!scheduledAt && existingScheduledAt && isPastDate(existingScheduledAt) && !opts?.forceNow) {
        setApprovalPrompts((prev) => ({ ...prev, [postId]: true }));
        toast("This scheduled time has already passed. Choose a new future time or submit now.", "orange");
        return;
      }
    }
    try {
      await api.reviewSocialPost({
        postId,
        decision,
        reviewNote: note,
        scheduledAt: opts?.forceNow ? "" : toIsoFromDateTimeLocal(scheduledAt) || effectiveScheduledAt,
        title: editDraft.title,
        content: editDraft.content,
        caption: editDraft.content,
        imageUrl: editDraft.imageUrl,
        channels: editDraft.channels,
      });
      setNoteDrafts((prev) => ({ ...prev, [postId]: "" }));
      setScheduleDrafts((prev) => ({ ...prev, [postId]: opts?.forceNow ? "" : prev[postId] }));
      setApprovalPrompts((prev) => ({ ...prev, [postId]: false }));
      toast(
        decision === "approve"
          ? (opts?.forceNow ? "Post approved and submitted now." : "Post approved.")
          : decision === "request_changes"
            ? "Edit request sent to submitter."
            : "Post rejected.",
        decision === "approve" ? "green" : decision === "request_changes" ? "orange" : "red"
      );
      await load();
    } catch (e: any) {
      toast(e?.message || "Review action failed", "red");
    }
  }

  async function retryChannel(postId: string, channel: string) {
    try {
      await api.retrySocialPostChannel({ postId, channel });
      toast(`${channel} retried successfully.`, "green");
      await load();
    } catch (e: any) {
      toast(e?.message || "Channel retry failed", "red");
    }
  }

  async function addOrgComment(postId: string, requestEdits = false) {
    const note = safeStr(noteDrafts[postId]);
    if (!note) {
      toast(requestEdits ? "Add a request note before asking for edits." : "Add a comment before posting it.", "red");
      return;
    }
    try {
      await api.addSocialPostComment({
        postId,
        comment: note,
        requestEdits,
      });
      setNoteDrafts((prev) => ({ ...prev, [postId]: "" }));
      toast(requestEdits ? "Edit request added to the post." : "Comment added to the post.", requestEdits ? "orange" : "green");
      await load();
    } catch (e: any) {
      toast(e?.message || "Failed to add comment", "red");
    }
  }

  async function saveApprovedScheduleChanges(postId: string) {
    const post = posts.find((item) => item.post_id === postId);
    if (!post) return;
    const editDraft = editDrafts[postId] || {
      title: safeStr(post.title),
      content: safeStr(post.content),
      imageUrl: safeStr(post.imageUrl),
      channels: Array.isArray(post.channels) ? post.channels.map(safeStr).filter(Boolean) : [],
    };
    const scheduledAt = safeStr(scheduleDrafts[postId]);

    if (scheduledAt && !isFutureDate(scheduledAt)) {
      toast("Pick a future publish time before saving schedule changes.", "orange");
      return;
    }

    try {
      await api.adminUpdateScheduledSocialPost({
        postId,
        title: editDraft.title,
        content: editDraft.content,
        caption: editDraft.content,
        imageUrl: editDraft.imageUrl,
        channels: editDraft.channels,
        scheduledAt: toIsoFromDateTimeLocal(scheduledAt) || safeStr(post.scheduledAt),
      });
      toast("Scheduled post updated.", "green");
      await load();
    } catch (e: any) {
      toast(e?.message || "Failed to update scheduled post", "red");
    }
  }

  async function cancelScheduledPost(postId: string) {
    const post = posts.find((item) => item.post_id === postId);
    if (!post) return;
    const editDraft = editDrafts[postId] || {
      title: safeStr(post.title),
      content: safeStr(post.content),
      imageUrl: safeStr(post.imageUrl),
      channels: Array.isArray(post.channels) ? post.channels.map(safeStr).filter(Boolean) : [],
    };
    try {
      await api.adminUpdateScheduledSocialPost({
        postId,
        title: editDraft.title,
        content: editDraft.content,
        caption: editDraft.content,
        imageUrl: editDraft.imageUrl,
        channels: editDraft.channels,
        cancelSchedule: true,
      });
      setScheduleDrafts((prev) => ({ ...prev, [postId]: "" }));
      toast("Schedule cancelled. Post stays approved but will not auto-publish.", "orange");
      await load();
    } catch (e: any) {
      toast(e?.message || "Failed to cancel schedule", "red");
    }
  }

  async function saveInlineAdminEdits(postId: string) {
    const post = posts.find((item) => item.post_id === postId);
    if (!post) return;
    const editDraft = editDrafts[postId] || {
      title: safeStr(post.title),
      content: safeStr(post.content),
      imageUrl: safeStr(post.imageUrl),
      channels: Array.isArray(post.channels) ? post.channels.map(safeStr).filter(Boolean) : [],
    };
    try {
      await api.adminUpdateScheduledSocialPost({
        postId,
        title: editDraft.title,
        content: editDraft.content,
        caption: editDraft.content,
        imageUrl: editDraft.imageUrl,
        channels: editDraft.channels,
      });
      setEditingCardId((curr) => (curr === postId ? null : curr));
      toast("Draft edits saved to backend.", "green");
      await load();
    } catch (e: any) {
      toast(e?.message || "Failed to save draft edits", "red");
    }
  }

  const allEmpty = useMemo(() => !loading && !posts.length, [loading, posts.length]);

  const requests = useMemo(() => {
    return posts.filter((p) => {
      const s = safeStr(p.status).toLowerCase();
      if (isOrgMode) {
        const tagged = !safeStr(onlyTaggedUsername)
          || (Array.isArray((p as any).reviewerUsernames) ? (p as any).reviewerUsernames : [])
            .map((value: any) => safeStr(value).toLowerCase())
            .includes(safeStr(onlyTaggedUsername).toLowerCase());
        return tagged && (s.includes("pending") || s.includes("request"));
      }
      if (requestTab === "pending") return s.includes("pending") || s.includes("request");
      if (requestTab === "published") return s.includes("publish");
      return s.includes("approve") && !s.includes("publish");
    });
  }, [isOrgMode, onlyTaggedUsername, posts, requestTab]);

  const media = useMemo(() => {
    const selected = mediaTab.toLowerCase();
    return posts.filter((p) => {
      const isApproved = safeStr(p.status).toLowerCase().includes("approve");
      const hasChannel = (p.channels || []).map((c) => safeStr(c).toLowerCase()).includes(selected);
      return isApproved && hasChannel;
    });
  }, [posts, mediaTab]);

  const requestTabs: Array<{ key: RequestTab; label: string }> = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "published", label: "Published" },
  ];

  const mediaTabs: Array<{ key: MediaTab; label: string }> = [
    { key: "discord", label: "Discord" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "instagram", label: "Instagram" },
    { key: "facebook", label: "Facebook" },
  ];

  const statBox = (label: string, value: string) => (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 12px",
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,.18)",
        background: "rgba(255,255,255,.86)",
        minWidth: 86,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{value}</span>
    </span>
  );

  const statsSidebar = (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
        Post stats
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {statBox("Likes", "—")}
        {statBox("Comments", "—")}
        {statBox("Shares", "—")}
        {statBox("Reach", "—")}
      </div>
    </div>
  );

  return (
    <div style={{ padding: embedded ? 0 : 20, maxWidth: 1200, margin: "0 auto" }}>
      {!embedded ? (
        <>
          <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>
            {isOrgMode ? "Social Media Review" : "Social Media Admin"}
          </h2>
          <p style={{ color: "#64748b", fontWeight: 700 }}>
            {isOrgMode
              ? "Browse request progress, media previews, and review notes without admin controls."
              : "Review requests or browse media by channel. Todos stay attached to each post."}
          </p>
        </>
      ) : null}

      {!isOrgMode ? (
        <div style={{ display: "inline-flex", gap: 0, padding: 6, borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.82)", boxShadow: "0 8px 24px rgba(15,23,42,.05)", marginBottom: 16, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setTopTab("requests")} style={{ ...tabButton(topTab === "requests"), border: "none" }}>Requests</button>
          <button type="button" onClick={() => setTopTab("media")} style={{ ...tabButton(topTab === "media"), border: "none" }}>Media</button>
        </div>
      ) : null}

      {isOrgMode || topTab === "requests" ? (
        <section style={{ display: "grid", gap: 12 }}>
          {!isOrgMode ? (
            <div style={{ display: "inline-flex", gap: 0, padding: 5, borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.82)", boxShadow: "0 8px 24px rgba(15,23,42,.05)", flexWrap: "wrap" }}>
              {requestTabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => setRequestTab(tab.key)} style={{ ...tabButton(requestTab === tab.key), border: "none" }}>
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 12 }}>
            {requests.map((p) => {
              const tone = statusTone(p.status);
              const todos = parseTodos(p);
              const draft = noteDrafts[p.post_id] || "";
              const editDraft = editDrafts[p.post_id] || {
                title: safeStr(p.title),
                content: safeStr(p.content),
                imageUrl: safeStr(p.imageUrl),
                channels: Array.isArray(p.channels) ? p.channels.map(safeStr).filter(Boolean) : [],
              };
              const needsScheduleDecision = !!approvalPrompts[p.post_id];
              const hasPastSchedule = !!safeStr(p.scheduledAt) && isPastDate(p.scheduledAt) && !safeStr(scheduleDrafts[p.post_id]);
              const isPosted = isPostedPost(p);
              const canEditApproved = safeStr(p.status).toLowerCase().includes("approve") && !isPosted;
              const isInlineEditing = editingCardId === p.post_id;
              const scheduleStatusText = safeStr(scheduleDrafts[p.post_id])
                ? isFutureDate(scheduleDrafts[p.post_id])
                  ? `Will schedule for ${safeStr(scheduleDrafts[p.post_id]).replace("T", " ")}`
                  : "Selected time is in the past. Pick a future time."
                : safeStr(p.scheduledAt)
                  ? hasPastSchedule
                    ? `Previous schedule ${safeStr(p.scheduledAt).replace("T", " ")} has already passed.`
                    : `Current schedule: ${safeStr(p.scheduledAt).replace("T", " ")}`
                  : "No schedule set. Approval will publish now.";

              return (
                <SocialPostCard
                  key={p.post_id}
                  post={{ ...p, title: editDraft.title, content: editDraft.content, imageUrl: editDraft.imageUrl, channels: editDraft.channels }}
                  tone={tone}
                  previewUrl={previewSrc(safeStr(editDraft.imageUrl || p.imageUrl || editDraft.content || p.content))}
                  onChannelRetry={isOrgMode ? undefined : (channel) => void retryChannel(p.post_id, channel)}
                  sidebarContent={
                    <div style={{ display: "grid", gap: 10 }}>
                      {safeStr((p as any).internalReviewNote) ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
                            Internal review note
                          </div>
                          <div
                            style={{
                              borderRadius: 12,
                              border: "1px solid rgba(148,163,184,.18)",
                              background: "rgba(248,250,252,.92)",
                              padding: "10px 11px",
                              color: "#0f172a",
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: 1.55,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {safeStr((p as any).internalReviewNote)}
                          </div>
                        </div>
                      ) : null}
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
                          Review history
                        </div>
                        {todos.length ? (
                          todos.map((todo, idx) => (
                            <label
                              key={`${p.post_id}-${todo.id || idx}`}
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
                                cursor: !isOrgMode && todo.id ? "pointer" : "default",
                              }}
                            >
                              {!isOrgMode && todo.id ? (
                                <input
                                  type="checkbox"
                                  checked={!!todo.done}
                                  onChange={async () => {
                                    try {
                                      await api.toggleSocialPostTodo({ postId: p.post_id, todoId: todo.id, done: !todo.done });
                                      await load();
                                    } catch (e: any) {
                                      toast(e?.message || "Failed to update todo", "red");
                                    }
                                  }}
                                  style={{ marginTop: 3, flex: "0 0 auto" }}
                                />
                              ) : <span style={{ width: 14, flex: "0 0 auto" }} />}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal" }}>{todo.text}</div>
                                {[todo.author, todo.createdAt].filter(Boolean).length ? (
                                  <div style={{ marginTop: 3, fontSize: 10, color: "#64748b", fontWeight: 700, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    {[todo.author, todo.createdAt].filter(Boolean).join(" · ")}
                                  </div>
                                ) : null}
                              </div>
                            </label>
                          ))
                        ) : (
                          <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>No review history yet.</div>
                        )}
                      </div>
                    </div>
                  }
                  headerActions={!isOrgMode && !isPosted ? (
                        isInlineEditing ? (
                          <button
                            type="button"
                            onClick={() => void (canEditApproved ? saveApprovedScheduleChanges(p.post_id) : saveInlineAdminEdits(p.post_id))}
                            aria-label="Save post"
                            title="Save post"
                            style={editIconButton(true)}
                          >
                        ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCardId(p.post_id)}
                        aria-label="Edit post"
                        title="Edit post"
                        style={editIconButton(false)}
                      >
                        ✎
                      </button>
                    )
                  ) : undefined}
                  headerEditor={
                    !isOrgMode && isInlineEditing ? (
                      <>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Title</span>
                          <input
                            value={editDraft.title}
                            onChange={(e) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [p.post_id]: { ...editDraft, title: e.target.value },
                              }))
                            }
                            style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff" }}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / content</span>
                          <textarea
                            value={editDraft.content}
                            onChange={(e) =>
                              setEditDrafts((prev) => ({
                                ...prev,
                                [p.post_id]: { ...editDraft, content: e.target.value },
                              }))
                            }
                            rows={5}
                            style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff", resize: "vertical" }}
                          />
                        </label>
                        <div style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Channels</span>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {["instagram", "facebook", "linkedin", "discord"].map((channel) => (
                              <ChannelChip
                                key={`${p.post_id}-header-${channel}`}
                                channel={channel}
                                active={editDraft.channels.includes(channel)}
                                onClick={() =>
                                  setEditDrafts((prev) => {
                                    const current = prev[p.post_id] || editDraft;
                                    const nextChannels = current.channels.includes(channel)
                                      ? current.channels.filter((item) => item !== channel)
                                      : [...current.channels, channel];
                                    return {
                                      ...prev,
                                      [p.post_id]: { ...current, channels: nextChannels },
                                    };
                                  })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    ) : undefined
                  }
                  comments={todos.map((todo) => ({
                    text: todo.text,
                    checked: !!todo.done,
                    onToggle: isOrgMode
                      ? undefined
                      : async () => {
                          try {
                            await api.toggleSocialPostTodo({ postId: p.post_id, todoId: todo.id, done: !todo.done });
                            await load();
                          } catch (e: any) {
                            toast(e?.message || "Failed to update todo", "red");
                          }
                        },
                    meta: [todo.author, todo.createdAt].filter(Boolean).join(" · ") || undefined,
                  }))}
                  editor={
                    isOrgMode ? (
                      !isPosted ? (
                        <div style={{ display: "grid", gap: 10 }}>
                          <label style={{ display: "grid", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Team comment</span>
                            <MentionTextarea
                              value={draft}
                              onChange={(next) => setNoteDrafts((prev) => ({ ...prev, [p.post_id]: next }))}
                              placeholder="Write the edit request for this post. Use @username or @email to notify someone."
                              rows={3}
                              users={mentionUsers}
                            />
                          </label>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void addOrgComment(p.post_id, true)} style={reviewActionButton("blue")}>
                              Request edits
                            </button>
                          </div>
                        </div>
                      ) : undefined
                    ) : <div style={{ display: "grid", gap: 10 }}>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Request changes comment</span>
                        <MentionTextarea
                          value={draft}
                          onChange={(next) => setNoteDrafts((prev) => ({ ...prev, [p.post_id]: next }))}
                          placeholder="Write the change request for this post. Use @username or @email to notify someone."
                          rows={3}
                          users={mentionUsers}
                        />
                      </label>
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Schedule publish time</span>
                        <input
                          type="datetime-local"
                          value={scheduleDrafts[p.post_id] || ""}
                          onChange={(e) => setScheduleDrafts((prev) => ({ ...prev, [p.post_id]: e.target.value }))}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff" }}
                        />
                        <div style={{ color: hasPastSchedule || (safeStr(scheduleDrafts[p.post_id]) && !isFutureDate(scheduleDrafts[p.post_id])) ? "#b45309" : "#64748b", fontSize: 12, fontWeight: 800 }}>
                          {scheduleStatusText}
                        </div>
                      </label>

                      {needsScheduleDecision ? (
                        <div
                          style={{
                            borderRadius: 14,
                            border: "1px solid rgba(245,158,11,.28)",
                            background: "rgba(254,243,199,.55)",
                            padding: 12,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          <div style={{ color: "#92400e", fontWeight: 900 }}>
                            This scheduled time has passed. Pick a new future time or publish immediately.
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => void decide(p.post_id, "approve", { forceNow: true })} style={reviewActionButton("green")}>
                              Submit now
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setApprovalPrompts((prev) => ({ ...prev, [p.post_id]: false }));
                              }}
                              style={tabButton(false)}
                            >
                              Pick new time
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        {canEditApproved ? (
                          <>
                            <button type="button" onClick={() => void saveApprovedScheduleChanges(p.post_id)} style={tabButton(true)}>Save changes</button>
                            {safeStr(p.scheduledAt) || safeStr(scheduleDrafts[p.post_id]) ? (
                              <button type="button" onClick={() => void cancelScheduledPost(p.post_id)} style={tabButton(false)}>Cancel schedule</button>
                            ) : null}
                          </>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              width: "100%",
                              justifyContent: "space-between",
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button type="button" onClick={() => void decide(p.post_id, "request_changes")} style={reviewActionButton("blue")}>Request edits</button>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <button type="button" onClick={() => void decide(p.post_id, "approve")} style={reviewActionButton("green")}>Approve</button>
                              <button type="button" onClick={() => void decide(p.post_id, "reject")} style={reviewActionButton("red")}>Reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  }
                />
              );
            })}
            {!requests.length && <div style={{ color: "#64748b" }}>{loading ? "Loading..." : "No request items."}</div>}
          </div>
        </section>
      ) : (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "inline-flex", gap: 0, padding: 5, borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.82)", boxShadow: "0 8px 24px rgba(15,23,42,.05)", flexWrap: "wrap" }}>
            {mediaTabs.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setMediaTab(tab.key)} style={{ ...tabButton(mediaTab === tab.key), border: "none" }}>
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {media.map((p) => {
              const tone = statusTone(p.status);

              return (
                <SocialPostCard
                  key={p.post_id}
                  post={p}
                  tone={tone}
                  previewUrl={previewSrc(safeStr(p.imageUrl || p.content))}
                  previewCaption={p.content}
                  sidebarContent={statsSidebar}
                />
              );
            })}
            {!media.length && <div style={{ color: "#64748b" }}>{loading ? "Loading..." : "No media items for this channel."}</div>}
          </div>
        </section>
      )}

      {allEmpty ? <div style={{ color: "#64748b", marginTop: 12 }}>{loading ? "Loading..." : "No posts available."}</div> : null}
    </div>
  );
}
