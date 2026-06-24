import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import SocialPostCard, { type SocialPostCardData } from "../components/SocialPostCard";

type TopTab = "requests" | "media";
type RequestTab = "pending" | "approved";
type MediaTab = "discord" | "linkedin" | "instagram" | "facebook";

function safeStr(v: any) {
  return String(v ?? "").trim();
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

export default function SocialMediaReviewAdmin() {
  const { api } = useAuth();
  const [posts, setPosts] = useState<SocialPostCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [topTab, setTopTab] = useState<TopTab>("requests");
  const [requestTab, setRequestTab] = useState<RequestTab>("pending");
  const [mediaTab, setMediaTab] = useState<MediaTab>("discord");

  async function load() {
    setLoading(true);
    setError("");
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
    } catch (e: any) {
      setError(e?.message || "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(postId: string, decision: string) {
    const note = safeStr(noteDrafts[postId]);
    if (decision === "request_changes" && !note) {
      setError("Add a comment for request changes on this post.");
      return;
    }
    setError("");
    try {
      await api.reviewSocialPost({ postId, decision, reviewNote: note });
      setNoteDrafts((prev) => ({ ...prev, [postId]: "" }));
      await load();
    } catch (e: any) {
      setError(e?.message || "Review action failed");
    }
  }

  async function retryChannel(postId: string, channel: string) {
    setError("");
    try {
      await api.retrySocialPostChannel({ postId, channel });
      await load();
    } catch (e: any) {
      setError(e?.message || "Channel retry failed");
    }
  }

  const allEmpty = useMemo(() => !loading && !posts.length, [loading, posts.length]);

  const requests = useMemo(() => {
    return posts.filter((p) => {
      const s = safeStr(p.status).toLowerCase();
      return requestTab === "pending" ? s.includes("pending") || s.includes("request") : s.includes("approve");
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

              return (
                <SocialPostCard
                  key={p.post_id}
                  post={p}
                  tone={tone}
                  previewUrl={previewSrc(safeStr(p.imageUrl || p.content))}
                  previewCaption={p.content}
                  onChannelRetry={(channel) => void retryChannel(p.post_id, channel)}
                  comments={todos.map((todo) => ({
                    text: todo.text,
                    checked: !!todo.done,
                    onToggle: async () => {
                      try {
                        await api.toggleSocialPostTodo({ postId: p.post_id, todoId: todo.id, done: !todo.done });
                        await load();
                      } catch (e: any) {
                        setError(e?.message || "Failed to update todo");
                      }
                    },
                    meta: [todo.author, todo.createdAt].filter(Boolean).join(" · ") || undefined,
                  }))}
                  editor={
                    <div style={{ display: "grid", gap: 10 }}>
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

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => void decide(p.post_id, "approve")} style={tabButton(true)}>Approve</button>
                        <button type="button" onClick={() => void decide(p.post_id, "request_changes")} style={tabButton(false)}>Request edits</button>
                        <button type="button" onClick={() => void decide(p.post_id, "reject")} style={tabButton(false)}>Reject</button>
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

      {error ? (
        <div style={{ marginTop: 12, borderRadius: 14, padding: 12, background: "rgba(248,113,113,.10)", color: "#991b1b", fontWeight: 800 }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
