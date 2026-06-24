import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import SocialPostCard, { type SocialPostCardData } from "../components/SocialPostCard";

type EditForm = {
  title: string;
  content: string;
  imageUrl: string;
  channels: string[];
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

function toneFor(status?: string) {
  const s = safeStr(status).toLowerCase();
  if (s.includes("approve")) return { border: "rgba(34,197,94,.40)", bg: "rgba(34,197,94,.08)", text: "#166534", label: "APPROVED" };
  if (s.includes("request")) return { border: "rgba(236,72,153,.45)", bg: "rgba(236,72,153,.08)", text: "#be185d", label: "CHANGES REQUESTED" };
  if (s.includes("reject")) return { border: "rgba(239,68,68,.45)", bg: "rgba(239,68,68,.08)", text: "#b91c1c", label: "REJECTED" };
  return { border: "rgba(245,158,11,.45)", bg: "rgba(245,158,11,.10)", text: "#b45309", label: "PENDING REVIEW" };
}

function channelMeta(channel: string) {
  const c = safeStr(channel).toLowerCase();
  if (c === "instagram") return { label: "Instagram", icon: "◉" };
  if (c === "facebook") return { label: "Facebook", icon: "f" };
  if (c === "linkedin") return { label: "LinkedIn", icon: "in" };
  if (c === "discord") return { label: "Discord", icon: "⌁" };
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
        border: "1px solid rgba(148,163,184,.2)",
        background: active ? "rgba(59,130,246,.12)" : "#fff",
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
          fontSize: 11,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        {meta.icon}
      </span>
      <span style={{ textTransform: "capitalize" }}>{meta.label}</span>
    </button>
  );
}

export default function SocialPostStudio() {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState<"submit" | "mine">("submit");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [channels, setChannels] = useState<string[]>(["facebook", "instagram"]);
  const [mine, setMine] = useState<SocialPostCardData[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({});
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState("");
  const [editMessages, setEditMessages] = useState<Record<string, { type: "error" | "ok"; text: string }>>({});

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
              imageUrl: safeStr(p.imageUrl),
              channels: Array.isArray(p.channels) ? p.channels : [],
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitDraft() {
    setSubmitError("");
    setSubmitOk("");
    setSaving(true);
    try {
      await api.submitSocialPost({ title, content, imageUrl, caption: content, channels });
      setTitle("");
      setContent("");
      setImageUrl("");
      setSubmitOk("Draft submitted for review.");
      setActiveTab("mine");
      await loadMine();
    } catch (e: any) {
      setSubmitError(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(postId: string) {
    const form = editForms[postId];
    if (!form?.content.trim()) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: "Caption cannot be empty." } }));
      return;
    }
    setEditMessages((prev) => ({ ...prev, [postId]: { type: "ok", text: "Saving..." } }));
    setSaving(true);
    try {
      await api.updateSocialPost({ postId, title: form.title, content: form.content, caption: form.content, imageUrl: form.imageUrl, channels: form.channels });
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "ok", text: "Draft updated and sent back to review." } }));
      setEditingPostId(null);
      await loadMine();
    } catch (e: any) {
      setEditMessages((prev) => ({ ...prev, [postId]: { type: "error", text: e?.message || "Edit save failed" } }));
    } finally {
      setSaving(false);
    }
  }

  const tabs = useMemo(
    () => [
      { key: "submit" as const, label: "Submit draft" },
      { key: "mine" as const, label: "My submissions" },
    ],
    []
  );

  const submitPreview = useMemo(
    () => ({
      title: title || "Preview title",
      caption: content || "Preview caption",
      imageUrl: previewSrc(imageUrl),
    }),
    [content, imageUrl, title]
  );

  return (
    <div style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>Social Post Studio</h2>
      <p style={{ color: "#64748b", fontWeight: 700 }}>Submit a draft, then track and edit your own submissions from the second tab.</p>
      <div style={{ marginBottom: 16, borderRadius: 16, padding: 12, border: "1px solid rgba(148,163,184,.18)", background: "rgba(248,250,252,.85)", color: "#475569", fontWeight: 700, lineHeight: 1.6 }}>
        Tip: the edit form sends a fresh version back to review. Review comments appear as a tiny checklist.
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} style={{
            border: "1px solid rgba(148,163,184,.22)",
            borderRadius: 999,
            padding: "10px 16px",
            background: activeTab === tab.key ? "linear-gradient(135deg,#2563eb,#0f766e)" : "#fff",
            color: activeTab === tab.key ? "#fff" : "#1e293b",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: activeTab === tab.key ? "0 10px 18px rgba(37,99,235,.16)" : "none",
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === "submit" ? (
        <section style={{ borderRadius: 20, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 16 }}>
          <SocialPostCard
            post={{ post_id: "draft-preview", title: submitPreview.title, content: submitPreview.caption, imageUrl: submitPreview.imageUrl }}
            tone={{ border: "rgba(148,163,184,.18)", bg: "linear-gradient(180deg, #fff, #f8fafc)", text: "#475569", label: "LIVE PREVIEW" }}
            previewUrl={submitPreview.imageUrl}
            previewCaption={submitPreview.caption}
          />

          <form onSubmit={(e) => { e.preventDefault(); void submitDraft(); }} style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Submit draft</h3>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
            </label>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / content</span>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
            </label>
            <label style={{ display: "grid", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Content / URL</span>
              <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {["instagram", "facebook", "linkedin", "discord"].map((c) => (
                <ChannelChip
                  key={c}
                  channel={c}
                  active={channels.includes(c)}
                  onClick={() => setChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                />
              ))}
            </div>
            <button type="submit" disabled={!content.trim() || saving} style={{ border: 0, borderRadius: 999, padding: "12px 16px", background: !content.trim() || saving ? "#94a3b8" : "linear-gradient(135deg,#2563eb,#0f766e)", color: "#fff", fontWeight: 900, cursor: !content.trim() || saving ? "not-allowed" : "pointer" }}>
              {saving ? "Submitting..." : "Submit for review"}
            </button>
            {submitOk ? <div style={{ marginTop: 12, borderRadius: 14, padding: 12, background: "rgba(34,197,94,.10)", color: "#166534", fontWeight: 800 }}>{submitOk}</div> : null}
            {submitError ? <div style={{ marginTop: 12, borderRadius: 14, padding: 12, background: "rgba(248,113,113,.10)", color: "#991b1b", fontWeight: 800 }}>{submitError}</div> : null}
          </form>
        </section>
      ) : (
        <section style={{ borderRadius: 20, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>My submissions</h3>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12, fontWeight: 800, color: "#475569" }}>
            <input type="checkbox" checked={showOnlyPending} onChange={(e) => setShowOnlyPending(e.target.checked)} />
            Show only pending
          </label>
          <div style={{ display: "grid", gap: 10 }}>
            {mine.filter((p) => !showOnlyPending || safeStr(p.status).toLowerCase().includes("pending")).map((p) => {
              const tone = toneFor(p.status);
              const todos = parseTodos(p);
              const form = editForms[p.post_id] || { title: safeStr(p.title), content: safeStr(p.content), imageUrl: safeStr(p.imageUrl), channels: Array.isArray(p.channels) ? p.channels : [] };
              const isEditing = editingPostId === p.post_id;

              return (
                <SocialPostCard
                  key={p.post_id}
                  post={p}
                  tone={tone}
                  previewUrl={previewSrc(form.imageUrl || p.imageUrl || p.content || "")}
                  previewCaption={form.content || p.content}
                  comments={todos.map((todo) => ({
                    text: todo.text,
                    checked: !!todo.done,
                    onToggle: async () => {
                      try {
                        await api.toggleSocialPostTodo({ postId: p.post_id, todoId: todo.id, done: !todo.done });
                        await loadMine();
                      } catch (e: any) {
                        setEditMessages((prev) => ({ ...prev, [p.post_id]: { type: "error", text: e?.message || "Failed to update todo" } }));
                      }
                    },
                    meta: [todo.author, todo.createdAt].filter(Boolean).join(" · ") || undefined,
                  }))}
                  actions={
                    <button type="button" onClick={() => setEditingPostId((curr) => (curr === p.post_id ? null : p.post_id))} style={{ padding: "8px 12px", borderRadius: 999, border: "1px solid rgba(148,163,184,.2)", background: isEditing ? "rgba(59,130,246,.12)" : "#fff", fontWeight: 800, cursor: "pointer" }}>
                      {isEditing ? "Close edit" : "Edit post"}
                    </button>
                  }
                  editor={isEditing ? (
                    <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Title</span>
                        <input value={form.title} onChange={(e) => setEditForms((prev) => ({ ...prev, [p.post_id]: { ...form, title: e.target.value } }))} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Caption / text</span>
                        <textarea value={form.content} onChange={(e) => setEditForms((prev) => ({ ...prev, [p.post_id]: { ...form, content: e.target.value } }))} rows={4} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
                      </label>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, textTransform: "uppercase", color: "#475569" }}>Fresh content / URL</span>
                        <input value={form.imageUrl} onChange={(e) => setEditForms((prev) => ({ ...prev, [p.post_id]: { ...form, imageUrl: e.target.value } }))} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(148,163,184,.26)" }} />
                      </label>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {["instagram", "facebook", "linkedin", "discord"].map((c) => (
                          <ChannelChip
                            key={c}
                            channel={c}
                            active={form.channels.includes(c)}
                            onClick={() => setEditForms((prev) => {
                              const current = prev[p.post_id] || form;
                              const nextChannels = current.channels.includes(c) ? current.channels.filter((x) => x !== c) : [...current.channels, c];
                              return { ...prev, [p.post_id]: { ...current, channels: nextChannels } };
                            })}
                          />
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" disabled={saving} onClick={() => void saveEdit(p.post_id)} style={{ border: 0, borderRadius: 999, padding: "12px 16px", background: saving ? "#94a3b8" : "linear-gradient(135deg,#2563eb,#0f766e)", color: "#fff", fontWeight: 900, cursor: saving ? "not-allowed" : "pointer" }}>
                          {saving ? "Saving..." : "Save update"}
                        </button>
                      </div>
                      {editMessages[p.post_id] ? (
                        <div style={{ borderRadius: 12, padding: 10, background: editMessages[p.post_id].type === "error" ? "rgba(248,113,113,.10)" : "rgba(34,197,94,.10)", color: editMessages[p.post_id].type === "error" ? "#991b1b" : "#166534", fontWeight: 800 }}>
                          {editMessages[p.post_id].text}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                />
              );
            })}
            {!mine.length && <div style={{ color: "#64748b" }}>{loading ? "Loading..." : "No submissions yet."}</div>}
          </div>
        </section>
      )}
    </div>
  );
}
