import type { ReactNode } from "react";

export type SocialPostCardData = {
  post_id: string;
  title?: string;
  content?: string;
  imageUrl?: string;
  channels?: string[];
  status?: string;
  reviewNote?: string;
  publishResult?: {
    ok?: boolean;
    publishedAt?: string;
    channels?: Array<{
      channel?: string;
      ok?: boolean;
      error?: string;
      result?: any;
    }>;
  };
  reviewTodos?: Array<{
    id?: string;
    text?: string;
    done?: boolean;
    author?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  author?: string;
  authorRole?: string;
  createdAt?: string;
  updatedAt?: string;
};

type CommentEntry = {
  text: string;
  checked?: boolean;
  onToggle?: () => void;
  meta?: string;
};

type Props = {
  post: SocialPostCardData;
  tone: { border: string; bg: string; text: string; label: string };
  previewUrl?: string;
  previewFallbackLabel?: string;
  previewCaption?: ReactNode;
  subMeta?: ReactNode;
  sidebarContent?: ReactNode;
  comments?: CommentEntry[];
  actions?: ReactNode;
  editor?: ReactNode;
  onChannelRetry?: (channel: string) => void | Promise<void>;
};

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function formatDate(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? safeStr(v) : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

function channelMeta(channel: string) {
  const c = safeStr(channel).toLowerCase();
  if (c === "instagram") return { label: "Instagram", icon: "ig" };
  if (c === "facebook") return { label: "Facebook", icon: "f" };
  if (c === "linkedin") return { label: "LinkedIn", icon: "in" };
  if (c === "discord") return { label: "Discord", icon: "#" };
  return { label: channel, icon: "•" };
}

export default function SocialPostCard({
  post,
  tone,
  previewUrl,
  previewFallbackLabel = "No preview yet",
  previewCaption,
  subMeta,
  sidebarContent,
  comments = [],
  actions,
  editor,
  onChannelRetry,
}: Props) {
  const isApproved = safeStr(post.status).toLowerCase().includes("approve");
  const publishMap = new Map(
    (Array.isArray(post.publishResult?.channels) ? post.publishResult.channels : [])
      .map((item) => ({
        channel: safeStr(item?.channel).toLowerCase(),
        ok: !!item?.ok,
      }))
      .filter((item) => item.channel)
      .map((item) => [item.channel, item] as const)
  );

  return (
    <section
      style={{
        borderRadius: 18,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        padding: 14,
        display: "grid",
        gap: 14,
        boxShadow: "0 12px 26px rgba(15,23,42,.05)",
      }}
    >
      <header style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", color: "#64748b" }}>
            {post.title || "Untitled"}
          </div>
          <div style={{ marginTop: 4, color: "#0f172a", fontSize: 15, fontWeight: 700, lineHeight: 1.45, wordBreak: "break-word" }}>
            {post.content}
          </div>
          {post.author ? (
            <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              By {post.author} · {formatDate(safeStr(post.updatedAt || post.createdAt))}
            </div>
          ) : null}
          {(Array.isArray(post.channels) && post.channels.length) || subMeta ? (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {Array.isArray(post.channels) && post.channels.length ? post.channels.map((channel) => {
                const meta = channelMeta(channel);
                const publishState = publishMap.get(safeStr(channel).toLowerCase());
                const isSuccess = publishState?.ok;
                const isFailed = publishState ? !publishState.ok : false;
                const canRetry = isApproved && !!onChannelRetry;

                return (
                  <button
                    key={channel}
                    type="button"
                    onClick={canRetry ? () => void onChannelRetry(safeStr(channel).toLowerCase()) : undefined}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 9px",
                      borderRadius: 999,
                      border: isSuccess
                        ? "1px solid rgba(34,197,94,.38)"
                        : isFailed
                          ? "1px solid rgba(239,68,68,.38)"
                          : "1px solid rgba(148,163,184,.18)",
                      background: isSuccess
                        ? "rgba(34,197,94,.12)"
                        : isFailed
                          ? "rgba(239,68,68,.10)"
                          : "rgba(255,255,255,.8)",
                      color: isSuccess ? "#166534" : isFailed ? "#b91c1c" : "#334155",
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: "capitalize",
                      cursor: canRetry ? "pointer" : "default",
                      appearance: "none",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 999,
                        display: "inline-grid",
                        placeItems: "center",
                        background: isSuccess
                          ? "rgba(34,197,94,.15)"
                          : isFailed
                            ? "rgba(239,68,68,.12)"
                            : "rgba(148,163,184,.12)",
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    >
                      {meta.icon}
                    </span>
                    {meta.label}
                  </button>
                );
              }) : null}
              {subMeta ? <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{subMeta}</div> : null}
            </div>
          ) : null}
        </div>

        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            color: tone.text,
            background: "#fff",
            border: `1px solid ${tone.border}`,
            borderRadius: 999,
            padding: "6px 10px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {tone.label}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 4fr) minmax(0, 8fr)", gap: 12, alignItems: "stretch" }}>
        <aside
          style={{
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,.18)",
            background: "rgba(255,255,255,.72)",
            padding: 10,
            display: "grid",
            gap: 8,
            alignContent: "start",
            maxHeight: 280,
            height: 280,
            overflowY: "auto",
          }}
        >
          {sidebarContent ? (
            sidebarContent
          ) : (
            <>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Review history
              </div>
              {comments.length ? (
                comments.map((c, idx) => {
                  const label = safeStr(c.meta);
                  return (
                    <label
                      key={`${post.post_id}-${idx}`}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "10px 11px",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,.18)",
                        background: c.checked ? "rgba(34,197,94,.08)" : "rgba(248,250,252,.92)",
                        color: "#334155",
                        fontSize: 12,
                        fontWeight: 700,
                        lineHeight: 1.45,
                        textDecoration: c.checked ? "line-through" : "none",
                        opacity: c.checked ? 0.72 : 1,
                        cursor: c.onToggle ? "pointer" : "default",
                      }}
                    >
                      {c.onToggle ? <input type="checkbox" checked={!!c.checked} onChange={c.onToggle} style={{ marginTop: 3, flex: "0 0 auto" }} /> : <span style={{ width: 14, flex: "0 0 auto" }} />}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal" }}>{c.text}</div>
                        {label ? (
                          <div style={{ marginTop: 3, fontSize: 10, color: "#64748b", fontWeight: 700, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {label}
                          </div>
                        ) : null}
                      </div>
                    </label>
                  );
                })
              ) : (
                <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>No review history yet.</div>
              )}
            </>
          )}
        </aside>

        <article style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              borderRadius: 16,
              overflow: "hidden",
              border: "1px solid rgba(148,163,184,.18)",
              background: "#fff",
              height: 280,
              display: "grid",
              gridTemplateRows: "1fr auto",
            }}
          >
            {previewUrl ? (
              <div style={{ background: "#e2e8f0", overflow: "hidden" }}>
                <img
                  src={previewUrl}
                  alt={post.title || "Preview"}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#e2e8f0" }}
                />
              </div>
            ) : (
              <div
                style={{
                  minHeight: 180,
                  display: "grid",
                  placeItems: "center",
                  padding: 16,
                  background: "linear-gradient(135deg, #f8fafc, #eef2ff)",
                  color: "#64748b",
                  fontWeight: 800,
                  textAlign: "center",
                }}
              >
                {previewFallbackLabel}
              </div>
            )}

            {previewCaption ? (
              <div style={{ padding: "10px 12px", borderTop: "1px solid rgba(148,163,184,.14)", color: "#334155", fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
                {previewCaption}
              </div>
            ) : null}
          </div>
        </article>
      </div>

      {!isApproved ? (
        <div style={{ display: "grid", gap: 12 }}>
          {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
          {editor ? <div>{editor}</div> : null}
        </div>
      ) : null}
    </section>
  );
}
