import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import SocialPostCard, { type SocialPostCardData } from "../components/SocialPostCard";

declare const M: any;

type TopTab = "requests" | "media";
type RequestTab = "pending" | "approved" | "published";
type MediaTab = "discord" | "linkedin" | "instagram" | "facebook";

function safeStr(v: any) {
  return String(v ?? "").trim();
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

export default function SocialMediaReviewAdmin() {
  const { api } = useAuth();
  const [posts, setPosts] = useState<SocialPostCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [editDrafts, setEditDrafts] = useState<Record<string, AdminEditDraft>>({});
  const [approvalPrompts, setApprovalPrompts] = useState<Record<string, boolean>>({});
  const [topTab, setTopTab] = useState<TopTab>("requests");
  const [requestTab, setRequestTab] = useState<RequestTab>("pending");
  const [mediaTab, setMediaTab] = useState<MediaTab>("discord");

  async function load() {
    setLoading(true);
    try {
      const resp = await api.getSocialPosts();
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
  }, []);

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

  const allEmpty = useMemo(() => !loading && !posts.length, [loading, posts.length]);

  const requests = useMemo(() => {
    return posts.filter((p) => {
      const s = safeStr(p.status).toLowerCase();
      if (requestTab === "pending") return s.includes("pending") || s.includes("request");
      if (requestTab === "published") return s.includes("publish");
      return s.includes("approve") && !s.includes("publish");
    });
  }, [posts, requestTab]);

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
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>Social Media Admin</h2>
      <p style={{ color: "#64748b", fontWeight: 700 }}>Review requests or browse media by channel. Todos stay attached to each post.</p>

      <div style={{ display: "inline-flex", gap: 0, padding: 6, borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.82)", boxShadow: "0 8px 24px rgba(15,23,42,.05)", marginBottom: 16, flexWrap: "wrap" }}>
        <button type="button" onClick={() => setTopTab("requests")} style={{ ...tabButton(topTab === "requests"), border: "none" }}>Requests</button>
        <button type="button" onClick={() => setTopTab("media")} style={{ ...tabButton(topTab === "media"), border: "none" }}>Media</button>
      </div>

      {topTab === "requests" ? (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "inline-flex", gap: 0, padding: 5, borderRadius: 999, border: "1px solid rgba(148,163,184,.18)", background: "rgba(255,255,255,.82)", boxShadow: "0 8px 24px rgba(15,23,42,.05)", flexWrap: "wrap" }}>
            {requestTabs.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setRequestTab(tab.key)} style={{ ...tabButton(requestTab === tab.key), border: "none" }}>
                {tab.label}
              </button>
            ))}
          </div>

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
                  previewCaption={editDraft.content || p.content}
                  onChannelRetry={(channel) => void retryChannel(p.post_id, channel)}
                  comments={todos.map((todo) => ({
                    text: todo.text,
                    checked: !!todo.done,
                    onToggle: async () => {
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
                    <div style={{ display: "grid", gap: 10 }}>
                      <label style={{ display: "grid", gap: 8 }}>
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
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / content</span>
                        <textarea
                          value={editDraft.content}
                          onChange={(e) =>
                            setEditDrafts((prev) => ({
                              ...prev,
                              [p.post_id]: { ...editDraft, content: e.target.value },
                            }))
                          }
                          rows={4}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff", resize: "vertical" }}
                        />
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["instagram", "facebook", "linkedin", "discord"].map((channel) => (
                          <ChannelChip
                            key={`${p.post_id}-${channel}`}
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
                      <label style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Request changes comment</span>
                        <textarea
                          value={draft}
                          onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [p.post_id]: e.target.value }))}
                          placeholder="Write the change request for this post"
                          rows={3}
                          style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)", background: "#fff" }}
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
                            <button type="button" onClick={() => void decide(p.post_id, "approve", { forceNow: true })} style={tabButton(true)}>
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

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {canEditApproved ? (
                          <>
                            <button type="button" onClick={() => void saveApprovedScheduleChanges(p.post_id)} style={tabButton(true)}>Save changes</button>
                            {safeStr(p.scheduledAt) || safeStr(scheduleDrafts[p.post_id]) ? (
                              <button type="button" onClick={() => void cancelScheduledPost(p.post_id)} style={tabButton(false)}>Cancel schedule</button>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => void decide(p.post_id, "approve")} style={tabButton(true)}>Approve</button>
                            <button type="button" onClick={() => void decide(p.post_id, "request_changes")} style={tabButton(false)}>Request edits</button>
                            <button type="button" onClick={() => void decide(p.post_id, "reject")} style={tabButton(false)}>Reject</button>
                          </>
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
