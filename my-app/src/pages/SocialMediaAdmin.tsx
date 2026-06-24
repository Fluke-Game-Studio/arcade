import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from "react";
import { useAuth } from "../auth/AuthContext";

type InstagramStatus = {
  ok?: boolean;
  configured?: boolean;
  accountId?: string;
  pageId?: string;
  pageName?: string;
  tokenSource?: string;
  tokenExpiresAt?: string;
  metaUserTokenExpiresAt?: string;
  graphVersion?: string;
  tokenPresent?: boolean;
  refreshable?: boolean;
  canQueue?: boolean;
};

type FacebookStatus = {
  ok?: boolean;
  configured?: boolean;
  pageName?: string;
  tokenSource?: string;
  tokenExpiresAt?: string;
  metaUserTokenExpiresAt?: string;
  graphVersion?: string;
  tokenPresent?: boolean;
  refreshable?: boolean;
};

type LinkedInOrgStatus = {
  ok?: boolean;
  configured?: boolean;
  organizationUrn?: string;
  organizationName?: string;
  tokenSource?: string;
  tokenExpiresAt?: string;
  tokenPresent?: boolean;
};

type DiscordWebhookStatus = {
  ok?: boolean;
  configured?: boolean;
  webhookConfigured?: boolean;
};

type LinkedInOrgPost = {
  id: string;
  commentary: string;
  createdAt: string;
  lifecycleState: string;
  visibility: string;
  mediaType: string;
  mediaUrl: string;
  permalink: string;
};

type ConfigDraft = {
  accessToken: string;
  graphVersion: string;
  exchangeLongLived: boolean;
  resolveFromPage: boolean;
  resolveInstagramAccount: boolean;
};

type FacebookDraft = {
  accessToken: string;
  graphVersion: string;
  metaUserAccessToken: string;
  exchangeLongLived: boolean;
  resolveFromPage: boolean;
};

type SharedComposerDraft = {
  imageUrl: string;
  caption: string;
  includeImage: boolean;
  includeCaption: boolean;
};

type TestResult = {
  kind: "success" | "error" | "info";
  title: string;
  message: string;
  raw?: any;
  at: string;
};

type PlatformKey = "instagram" | "facebook" | "linkedin" | "discord";
type PlatformTab = "debug" | "setup" | "test";

function safeStr(value: any) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function formatDateTime(value: string) {
  const raw = safeStr(value);
  if (!raw) return "Not stored";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function cardStyle(active = false): CSSProperties {
  return {
    borderRadius: 28,
    border: active ? "1px solid rgba(37,99,235,.55)" : "1px solid rgba(148,163,184,.18)",
    background: "rgba(255,255,255,.92)",
    boxShadow: active ? "0 24px 60px rgba(15,23,42,.12)" : "0 18px 40px rgba(15,23,42,.08)",
    overflow: "hidden",
  };
}

function chipStyle(tone: "green" | "blue" | "amber" | "slate" = "slate"): CSSProperties {
  const tones = {
    green: { background: "rgba(34,197,94,.12)", color: "#166534" },
    blue: { background: "rgba(59,130,246,.12)", color: "#1d4ed8" },
    amber: { background: "rgba(245,158,11,.14)", color: "#92400e" },
    slate: { background: "rgba(15,23,42,.06)", color: "#334155" },
  } as const;
  return {
    ...tones[tone],
    border: "1px solid rgba(148,163,184,.16)",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    padding: "8px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
  };
}

function fullRowCardStyle(active = false, accent = "#2563eb"): CSSProperties {
  return {
    ...cardStyle(active),
    borderLeft: `6px solid ${accent}`,
  };
}

function RowStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon: string;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(148,163,184,.14)",
        background: "linear-gradient(180deg, rgba(248,250,252,.96), rgba(241,245,249,.88))",
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div>
        <div style={{ color: "#64748b", fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a", lineHeight: 1.05, marginTop: 6 }}>{value}</div>
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 14, display: "grid", placeItems: "center", background: "rgba(59,130,246,.12)", color: "#2563eb" }}>
        <i className="material-icons" style={{ fontSize: 22 }}>{icon}</i>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 999,
        padding: "9px 14px",
        fontWeight: 900,
        cursor: "pointer",
        background: active ? "linear-gradient(135deg, rgba(59,130,246,.16), rgba(37,99,235,.10))" : "#fff",
        color: active ? "#1d4ed8" : "#334155",
        boxShadow: active ? "0 10px 24px rgba(37,99,235,.10)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function ResponsePreview({ result }: { result: TestResult | null }) {
  if (!result) {
    return (
      <div style={{ borderRadius: 18, border: "1px dashed rgba(148,163,184,.28)", background: "rgba(248,250,252,.8)", padding: 14, color: "#64748b", fontWeight: 700, lineHeight: 1.6 }}>
        No test submitted yet. Run a test from the Test tab and the backend response will appear here.
      </div>
    );
  }

  const tone =
    result.kind === "success"
      ? { bg: "rgba(34,197,94,.10)", fg: "#166534", border: "rgba(34,197,94,.22)" }
      : result.kind === "error"
        ? { bg: "rgba(248,113,113,.10)", fg: "#991b1b", border: "rgba(248,113,113,.22)" }
        : { bg: "rgba(59,130,246,.10)", fg: "#1d4ed8", border: "rgba(59,130,246,.22)" };

  return (
    <div style={{ borderRadius: 18, background: tone.bg, border: `1px solid ${tone.border}`, padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ color: tone.fg, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8 }}>{result.title}</div>
          <div style={{ marginTop: 4, color: "#0f172a", fontWeight: 800, lineHeight: 1.5 }}>{result.message}</div>
        </div>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{formatDateTime(result.at)}</div>
      </div>
      {result.raw !== undefined ? (
        <pre style={{ margin: 0, padding: 12, borderRadius: 14, background: "rgba(15,23,42,.92)", color: "#e2e8f0", overflowX: "auto", fontSize: 12, lineHeight: 1.6 }}>
          {JSON.stringify(result.raw, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function PlatformTestComposer({
  accent,
  connected,
  platformName,
  actionLabel,
  actionIcon,
  actionDisabledText,
  actionPendingText,
  actionBusy,
  onAction,
  draft,
  setDraft,
  note,
}: {
  accent: string;
  connected: boolean;
  platformName: string;
  actionLabel: string;
  actionIcon: string;
  actionDisabledText: string;
  actionPendingText: string;
  actionBusy: boolean;
  onAction?: () => void;
  draft: SharedComposerDraft;
  setDraft: Dispatch<SetStateAction<SharedComposerDraft>>;
  note: ReactNode;
}) {
  const fieldLocked = !connected || actionBusy;
  const buttonLocked = !connected || !onAction || actionBusy;
  return (
    <div
      style={{
        borderRadius: 24,
        border: "1px solid rgba(148,163,184,.18)",
        background: connected ? "linear-gradient(180deg, rgba(59,130,246,.06), rgba(255,255,255,.92))" : "rgba(248,250,252,.94)",
        padding: 16,
        display: "grid",
        gap: 12,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.6)",
      }}
    >
      <div>
        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>{platformName} test post</div>
        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 1000, color: "#0f172a" }}>Image, caption, and toggles</div>
        <p style={{ margin: "8px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>
          {connected ? "Use the same draft controls across every platform card." : actionDisabledText}
        </p>
      </div>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Test image URL</span>
        <input
          type="text"
          value={draft.imageUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, imageUrl: e.target.value }))}
          placeholder="https://example.com/test-image.jpg"
          disabled={fieldLocked}
          style={{ width: "100%", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none", opacity: fieldLocked ? 0.6 : 1 }}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Caption</span>
        <textarea
          value={draft.caption}
          onChange={(e) => setDraft((prev) => ({ ...prev, caption: e.target.value }))}
          rows={4}
          placeholder="Write the test caption..."
          disabled={fieldLocked}
          style={{ width: "100%", resize: "vertical", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none", lineHeight: 1.5, opacity: fieldLocked ? 0.6 : 1 }}
        />
      </label>

      <div style={{ display: "grid", gap: 10, padding: "10px 12px", borderRadius: 18, background: "rgba(248,250,252,.9)", border: "1px solid rgba(148,163,184,.14)" }}>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 800, color: "#0f172a", opacity: fieldLocked ? 0.55 : 1 }}>
          <input
            type="checkbox"
            checked={draft.includeImage}
            disabled={fieldLocked}
            onChange={(e) => setDraft((prev) => ({ ...prev, includeImage: e.target.checked }))}
          />
          Include image
        </label>
        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 800, color: "#0f172a", opacity: fieldLocked ? 0.55 : 1 }}>
          <input
            type="checkbox"
            checked={draft.includeCaption}
            disabled={fieldLocked}
            onChange={(e) => setDraft((prev) => ({ ...prev, includeCaption: e.target.checked }))}
          />
          Include caption
        </label>
      </div>

      <div style={{ borderRadius: 18, padding: 14, background: "rgba(255,255,255,.9)", border: "1px solid rgba(148,163,184,.14)" }}>
        <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Composer note</div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.6 }}>
          {note}
        </div>
      </div>

      <button
        type="button"
        className="btn"
        onClick={onAction}
        disabled={buttonLocked}
        style={{
          borderRadius: 999,
          fontWeight: 900,
          textTransform: "none",
          background: connected ? `linear-gradient(135deg, ${accent}, rgba(15,23,42,.86))` : "linear-gradient(135deg, #cbd5e1, #94a3b8)",
          width: "fit-content",
          opacity: 1,
        }}
      >
        <i className="material-icons left">{actionIcon}</i>
        {actionBusy ? actionPendingText : actionLabel}
      </button>
    </div>
  );
}

export default function SocialMediaAdmin() {
  const { api } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState("");
  const [activeTabs, setActiveTabs] = useState<Record<PlatformKey, PlatformTab>>({
    instagram: "debug",
    facebook: "debug",
    linkedin: "debug",
    discord: "debug",
  });

  const [status, setStatus] = useState<InstagramStatus | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookStatus | null>(null);
  const [linkedinOrgStatus, setLinkedinOrgStatus] = useState<LinkedInOrgStatus | null>(null);
  const [discordWebhookStatus, setDiscordWebhookStatus] = useState<DiscordWebhookStatus | null>(null);
  const [instagramPosts, setInstagramPosts] = useState<any[]>([]);
  const [facebookPosts, setFacebookPosts] = useState<any[]>([]);
  const [linkedinOrgPosts, setLinkedinOrgPosts] = useState<LinkedInOrgPost[]>([]);

  const [loadError, setLoadError] = useState("");

  const [configDraft, setConfigDraft] = useState<ConfigDraft>({
    accessToken: "",
    graphVersion: "v25.0",
    exchangeLongLived: false,
    resolveFromPage: false,
    resolveInstagramAccount: false,
  });
  const [facebookDraft, setFacebookDraft] = useState<FacebookDraft>({
    accessToken: "",
    graphVersion: "v25.0",
    metaUserAccessToken: "",
    exchangeLongLived: false,
    resolveFromPage: false,
  });
  const [testDraft, setTestDraft] = useState<SharedComposerDraft>({
    imageUrl: "",
    caption: "Test post from Arcade Admin",
    includeImage: true,
    includeCaption: true,
  });

  const [instagramSaving, setInstagramSaving] = useState(false);
  const [instagramRefreshing, setInstagramRefreshing] = useState(false);
  const [instagramPublishing, setInstagramPublishing] = useState(false);
  const [facebookSaving, setFacebookSaving] = useState(false);
  const [facebookRefreshing, setFacebookRefreshing] = useState(false);
  const [facebookPublishing, setFacebookPublishing] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [discordPosting, setDiscordPosting] = useState(false);

  const [instagramOk, setInstagramOk] = useState("");
  const [instagramError, setInstagramError] = useState("");
  const [instagramRefreshOk, setInstagramRefreshOk] = useState("");
  const [instagramRefreshError, setInstagramRefreshError] = useState("");

  const [facebookOk, setFacebookOk] = useState("");
  const [facebookError, setFacebookError] = useState("");
  const [facebookRefreshOk, setFacebookRefreshOk] = useState("");
  const [facebookRefreshError, setFacebookRefreshError] = useState("");
  const [instagramTestResult, setInstagramTestResult] = useState<TestResult | null>(null);
  const [facebookTestResult, setFacebookTestResult] = useState<TestResult | null>(null);
  const [discordTestResult, setDiscordTestResult] = useState<TestResult | null>(null);

  const [linkedinOk, setLinkedinOk] = useState("");
  const [linkedinError, setLinkedinError] = useState("");

  const [discordOk, setDiscordOk] = useState("");
  const [discordError, setDiscordError] = useState("");

  const setPlatformTab = (platform: PlatformKey, tab: PlatformTab) => {
    setActiveTabs((prev) => ({ ...prev, [platform]: tab }));
  };

  async function load() {
    setLoading(true);
    setLoadError("");
    const results = await Promise.allSettled([
      api.getInstagramStatus(),
      api.getInstagramPosts(24),
      api.getFacebookPageStatus(),
      api.getFacebookPagePosts(24),
      api.getLinkedInOrgStatus(),
      api.getDiscordWebhookStatus(),
      api.getLinkedInOrgPosts(12),
    ]);

    const [instagramResult, instagramPostsResult, facebookResult, facebookPostsResult, linkedinResult, discordResult, linkedinPostsResult] = results;

    if (instagramResult.status === "fulfilled") {
      setStatus(instagramResult.value);
      setConfigDraft((prev) => ({
        ...prev,
        graphVersion: safeStr(instagramResult.value?.graphVersion) || prev.graphVersion,
      }));
    } else {
      setStatus(null);
      setLoadError((prev) => prev || `Instagram: ${instagramResult.reason?.message || "failed to load"}`);
    }

    if (instagramPostsResult.status === "fulfilled") {
      setInstagramPosts(Array.isArray(instagramPostsResult.value?.items) ? instagramPostsResult.value.items : []);
    } else {
      setInstagramPosts([]);
    }

    if (facebookResult.status === "fulfilled") {
      setFacebookStatus(facebookResult.value);
      setFacebookDraft((prev) => ({
        ...prev,
        graphVersion: safeStr(facebookResult.value?.graphVersion) || prev.graphVersion,
      }));
    } else {
      setFacebookStatus(null);
      setLoadError((prev) => prev || `Facebook: ${facebookResult.reason?.message || "failed to load"}`);
    }

    if (facebookPostsResult.status === "fulfilled") {
      setFacebookPosts(Array.isArray(facebookPostsResult.value?.items) ? facebookPostsResult.value.items : []);
    } else {
      setFacebookPosts([]);
    }

    if (linkedinResult.status === "fulfilled") {
      setLinkedinOrgStatus(linkedinResult.value);
    } else {
      setLinkedinOrgStatus(null);
      setLoadError((prev) => prev || `LinkedIn: ${linkedinResult.reason?.message || "failed to load"}`);
    }

    if (discordResult.status === "fulfilled") {
      setDiscordWebhookStatus(discordResult.value);
    } else {
      setDiscordWebhookStatus(null);
    }

    if (linkedinPostsResult.status === "fulfilled") {
      setLinkedinOrgPosts(Array.isArray(linkedinPostsResult.value?.items) ? linkedinPostsResult.value.items : []);
    } else {
      setLinkedinOrgPosts([]);
    }

    setLoadedAt(new Date().toISOString());
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const instagramStats = useMemo(() => {
    const images = instagramPosts.filter((p) => safeStr(p?.mediaType).toUpperCase() === "IMAGE").length;
    const videos = instagramPosts.filter((p) => safeStr(p?.mediaType).toUpperCase() === "VIDEO").length;
    const carousels = instagramPosts.filter((p) => safeStr(p?.mediaType).toUpperCase() === "CAROUSEL_ALBUM").length;
    return {
      total: instagramPosts.length,
      images,
      videos,
      carousels,
    };
  }, [instagramPosts]);

  async function onSaveInstagram(forceResolve = false) {
    setInstagramSaving(true);
    setInstagramError("");
    setInstagramOk("");
    try {
      const resp = await api.saveInstagramConfig({
        accessToken: configDraft.accessToken,
        graphVersion: configDraft.graphVersion,
        exchangeLongLived: configDraft.exchangeLongLived,
        resolveFromPage: forceResolve || configDraft.resolveFromPage,
        resolveInstagramAccount: forceResolve || configDraft.resolveInstagramAccount,
      });
      setStatus(resp);
      setInstagramOk("Saved the Instagram token to SSM.");
      setConfigDraft((prev) => ({ ...prev, accessToken: "" }));
      await load();
    } catch (e: any) {
      setInstagramError(e?.message || "Save failed");
    } finally {
      setInstagramSaving(false);
    }
  }

  async function onRefreshInstagram() {
    setInstagramRefreshing(true);
    setInstagramRefreshOk("");
    setInstagramRefreshError("");
    try {
      const resp = await api.refreshInstagramConfig();
      setStatus(resp);
      setInstagramRefreshOk("Refreshed the stored Meta and Instagram tokens.");
      await load();
    } catch (e: any) {
      setInstagramRefreshError(e?.message || "Refresh failed");
    } finally {
      setInstagramRefreshing(false);
    }
  }

  async function onSendInstagramTest() {
    setInstagramPublishing(true);
    setInstagramOk("");
    setInstagramError("");
    try {
      let debugResp: any = null;
      try {
        debugResp = await api.debugInstagramPublish({
          caption: testDraft.includeCaption ? testDraft.caption : "",
          imageUrl: testDraft.includeImage ? testDraft.imageUrl : "",
          graphVersion: status?.graphVersion,
        });
      } catch (debugErr: any) {
        debugResp = { error: debugErr?.message || "debug failed" };
      }
      const resp = await api.publishInstagramPost({
        caption: testDraft.includeCaption ? testDraft.caption : "",
        imageUrl: testDraft.includeImage ? testDraft.imageUrl : "",
        queue: false,
        async: false,
        preview: false,
      });
      setInstagramTestResult({
        kind: "success",
        title: "Instagram response",
        message: resp?.ok ? "Instagram test post sent." : "Instagram test request completed.",
        raw: {
          debug: debugResp,
          publish: resp,
        },
        at: new Date().toISOString(),
      });
      setInstagramOk(resp?.queued ? "Queued the Instagram test post." : resp?.ok ? "Instagram test post sent." : "Instagram test post request sent.");
      await load();
    } catch (e: any) {
      const message = e?.message || "Instagram test publish failed";
      setInstagramError(message);
      setInstagramTestResult({
        kind: "error",
        title: "Instagram error",
        message,
        raw: { error: message },
        at: new Date().toISOString(),
      });
    } finally {
      setInstagramPublishing(false);
    }
  }

  async function onSendFacebookTest() {
    setFacebookPublishing(true);
    setFacebookOk("");
    setFacebookError("");
    try {
      const resp = await api.publishFacebookPagePost({
        caption: testDraft.includeCaption ? testDraft.caption : "",
        imageUrl: testDraft.includeImage ? testDraft.imageUrl : "",
        preview: false,
        dryRun: false,
      });
      setFacebookTestResult({
        kind: "success",
        title: "Facebook response",
        message: resp?.ok ? "Facebook test post sent." : "Facebook request completed.",
        raw: resp,
        at: new Date().toISOString(),
      });
      setFacebookOk(resp?.ok ? "Facebook test post sent." : "Facebook post request completed.");
      await load();
    } catch (e: any) {
      const message = e?.message || "Facebook test publish failed";
      setFacebookError(message);
      setFacebookTestResult({
        kind: "error",
        title: "Facebook error",
        message,
        raw: { error: message },
        at: new Date().toISOString(),
      });
    } finally {
      setFacebookPublishing(false);
    }
  }

  async function onSaveFacebook() {
    setFacebookSaving(true);
    setFacebookError("");
    setFacebookOk("");
    try {
      const resp = await api.saveFacebookPageConfig({
        accessToken: facebookDraft.accessToken,
        graphVersion: facebookDraft.graphVersion,
        metaUserAccessToken: facebookDraft.metaUserAccessToken,
        exchangeLongLived: facebookDraft.exchangeLongLived,
        resolveFromPage: facebookDraft.resolveFromPage,
      });
      setFacebookStatus(resp);
      setFacebookOk("Saved the Facebook Page token to SSM.");
      setFacebookDraft((prev) => ({ ...prev, accessToken: "", metaUserAccessToken: "" }));
      await load();
    } catch (e: any) {
      setFacebookError(e?.message || "Save failed");
    } finally {
      setFacebookSaving(false);
    }
  }

  async function onRefreshFacebook() {
    setFacebookRefreshing(true);
    setFacebookRefreshOk("");
    setFacebookRefreshError("");
    try {
      const resp = await api.refreshFacebookPageConfig();
      setFacebookStatus(resp);
      setFacebookRefreshOk("Refreshed the Facebook Page token from the stored Meta user token.");
      await load();
    } catch (e: any) {
      setFacebookRefreshError(e?.message || "Refresh failed");
    } finally {
      setFacebookRefreshing(false);
    }
  }

  async function onConnectLinkedInOrg() {
    setLinkedinLoading(true);
    setLinkedinError("");
    setLinkedinOk("");
    const popup = window.open("", "linkedin-org-connect", "width=560,height=760,left=160,top=120");
    if (!popup) {
      setLinkedinLoading(false);
      setLinkedinError("Popup blocked. Please allow popups and try again.");
      return;
    }

    try {
      popup.document.write("<p style='font-family:Arial,sans-serif;padding:20px'>Opening LinkedIn organization connect...</p>");
      const resp = await api.startLinkedInOrgConnect({ returnTo: window.location.href });
      if (!resp?.authorizeUrl) throw new Error("Missing LinkedIn organization authorize URL.");
      popup.location.href = resp.authorizeUrl;
      popup.focus();
      const monitor = window.setInterval(() => {
        try {
            if (popup.closed) {
              window.clearInterval(monitor);
              setLinkedinLoading(false);
              void load().then(() => setLinkedinOk("LinkedIn organization connection updated."));
            }
        } catch {
          window.clearInterval(monitor);
          setLinkedinLoading(false);
        }
      }, 500);
    } catch (e: any) {
      setLinkedinLoading(false);
      setLinkedinError(e?.message || "Failed to start LinkedIn organization connect");
      try {
        popup.close();
      } catch {}
    }
  }

  async function onPostDiscord() {
    setDiscordPosting(true);
    setDiscordOk("");
    setDiscordError("");
    try {
      const content = [
        testDraft.includeCaption ? testDraft.caption : "",
        testDraft.includeImage && testDraft.imageUrl ? testDraft.imageUrl : "",
      ]
        .filter(Boolean)
        .join("\n");
      const resp = await api.postDiscordWebhookMessage({ content: content || testDraft.caption });
      setDiscordTestResult({
        kind: "success",
        title: "Discord response",
        message: resp?.delivered ? "Sent the Discord webhook message." : "Discord webhook request completed.",
        raw: resp,
        at: new Date().toISOString(),
      });
      setDiscordOk(resp?.delivered ? "Sent the Discord webhook message." : "Discord webhook request completed.");
      setTestDraft((prev) => ({ ...prev, caption: "" }));
      await load();
    } catch (e: any) {
      const message = e?.message || "Failed to send Discord webhook message";
      setDiscordError(message);
      setDiscordTestResult({
        kind: "error",
        title: "Discord error",
        message,
        raw: { error: message },
        at: new Date().toISOString(),
      });
    } finally {
      setDiscordPosting(false);
    }
  }

  const instagramConfigured = Boolean(status?.configured);
  const facebookConfigured = Boolean(facebookStatus?.configured || facebookStatus?.tokenPresent);
  const linkedInConfigured = Boolean(linkedinOrgStatus?.configured);
  const discordConfigured = Boolean(discordWebhookStatus?.configured);
  const instagramPageLabel = safeStr(status?.pageName) || "Instagram not resolved yet";
  const facebookPageLabel = safeStr(facebookStatus?.pageName) || "Facebook Page not resolved yet";
  const linkedInLabel = safeStr(linkedinOrgStatus?.organizationName) || safeStr(linkedinOrgStatus?.organizationUrn) || "LinkedIn org not connected yet";
  const facebookComposerEnabled = facebookConfigured;

  return (
    <div style={{ width: "100%", maxWidth: 1520, margin: "0 auto", padding: "24px 20px 36px" }}>
      <div
        style={{
          ...cardStyle(),
          background:
            "radial-gradient(circle at top left, rgba(14,165,233,.16), transparent 28%), radial-gradient(circle at top right, rgba(168,85,247,.16), transparent 24%), linear-gradient(135deg, rgba(15,23,42,.98), rgba(15,23,42,.90) 38%, rgba(30,41,59,.96))",
          color: "#f8fafc",
          padding: 26,
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 900 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.10)", marginBottom: 14 }}>
              <i className="material-icons" style={{ fontSize: 18 }}>share</i>
              <span style={{ fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", fontSize: 12 }}>Super · Social Media</span>
            </div>
            <h2 style={{ margin: 0, fontSize: 36, lineHeight: 1.05, fontWeight: 1000 }}>Social media control room</h2>
            <p style={{ marginTop: 12, marginBottom: 0, color: "rgba(226,232,240,.90)", fontSize: 15, lineHeight: 1.7, maxWidth: 980 }}>
              Summary-only dashboard. Each integration is a full-width row card that shows the key numbers first and opens only when you need to seed or refresh credentials.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => void load()}
              className="btn"
              disabled={loading}
              style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #38bdf8, #2563eb)" }}
            >
              <i className="material-icons left">refresh</i>
              {loading ? "Loading..." : "Refresh page"}
            </button>
            <a
              href="/admin"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.16)",
                color: "#e2e8f0",
                textDecoration: "none",
                fontWeight: 900,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <i className="material-icons" style={{ fontSize: 18 }}>arrow_back</i>
              Back to Admin
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 18 }}>
        <section style={{ ...cardStyle(), padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 1000, color: "#0f172a" }}>Connection overview</h3>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>
                Last loaded {loadedAt ? formatDateTime(loadedAt) : "just now"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={chipStyle(instagramConfigured ? "green" : "amber")}>{instagramConfigured ? "Instagram configured" : "Instagram needs attention"}</span>
              <span style={chipStyle(facebookConfigured ? "green" : "amber")}>{facebookConfigured ? "Facebook connected" : "Facebook needs token"}</span>
              <span style={chipStyle(linkedInConfigured ? "green" : "amber")}>{linkedInConfigured ? "LinkedIn connected" : "LinkedIn needs connect"}</span>
              <span style={chipStyle(discordConfigured ? "green" : "amber")}>{discordConfigured ? "Discord webhook present" : "Discord webhook missing"}</span>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <RowStat label="Instagram posts" value={instagramStats.total} icon="photo_library" />
            <RowStat label="Facebook posts" value={facebookPosts.length} icon="facebook" />
            <RowStat label="LinkedIn posts" value={linkedinOrgPosts.length} icon="work" />
            <RowStat label="Discord" value={discordConfigured ? "Ready" : "Needs setup"} icon="send" />
          </div>

          {loadError ? (
            <div style={{ marginTop: 14, borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 700 }}>
              {loadError}
            </div>
          ) : null}
        </section>

        <section style={fullRowCardStyle(activeTabs.instagram !== "debug", "#2563eb")}>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>Instagram</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>
                  Meta token chain and Instagram publishing readiness.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TabButton active={activeTabs.instagram === "debug"} onClick={() => setPlatformTab("instagram", "debug")}>Debug</TabButton>
                <TabButton active={activeTabs.instagram === "setup"} onClick={() => setPlatformTab("instagram", "setup")}>Setup</TabButton>
                <TabButton active={activeTabs.instagram === "test"} onClick={() => setPlatformTab("instagram", "test")}>Test</TabButton>
              </div>
            </div>

            {activeTabs.instagram === "debug" ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.3fr) minmax(260px, 1fr) minmax(260px, 1fr)", gap: 12 }}>
                <div style={{ borderRadius: 20, background: "rgba(37,99,235,.08)", padding: 16 }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Account</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>{instagramPageLabel}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={chipStyle(status?.refreshable ? "blue" : "amber")}>{status?.refreshable ? "Auto-refresh ready" : "Seed required"}</span>
                    <span style={chipStyle(instagramConfigured ? "green" : "amber")}>{instagramConfigured ? "Configured" : "Needs token"}</span>
                  </div>
                </div>
                <RowStat label="Images" value={instagramStats.images} icon="image" />
                <RowStat label="Videos" value={instagramStats.videos} icon="smart_display" />
              </div>
            ) : null}

            {activeTabs.instagram === "setup" ? (
              <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, .9fr)", gap: 12 }}>
                  <label style={{ display: "grid", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Meta generated token</span>
                    <textarea
                      value={configDraft.accessToken}
                      onChange={(e) => setConfigDraft((prev) => ({ ...prev, accessToken: e.target.value }))}
                      rows={4}
                      placeholder="Paste the token from Meta's Generate token action"
                      style={{ width: "100%", resize: "vertical", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none", lineHeight: 1.5 }}
                    />
                  </label>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Graph version</span>
                      <input
                        type="text"
                        value={configDraft.graphVersion}
                        onChange={(e) => setConfigDraft((prev) => ({ ...prev, graphVersion: e.target.value }))}
                        placeholder="v25.0"
                        style={{ width: "100%", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(248,250,252,.92)" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Refresh mode</span>
                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
                          <input type="checkbox" checked={configDraft.exchangeLongLived} onChange={(e) => setConfigDraft((prev) => ({ ...prev, exchangeLongLived: e.target.checked }))} />
                          Exchange long-lived
                        </label>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
                          <input type="checkbox" checked={configDraft.resolveFromPage && configDraft.resolveInstagramAccount} onChange={(e) => setConfigDraft((prev) => ({ ...prev, resolveFromPage: e.target.checked, resolveInstagramAccount: e.target.checked }))} />
                          Resolve page + IG
                        </label>
                      </div>
                    </label>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="btn" onClick={() => void onRefreshInstagram()} disabled={instagramRefreshing} style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #14b8a6, #0f766e)" }}>
                    <i className="material-icons left">autorenew</i>
                    {instagramRefreshing ? "Refreshing..." : "Refresh stored tokens"}
                  </button>
                  <button type="button" className="btn" onClick={() => void onSaveInstagram()} disabled={instagramSaving || !configDraft.accessToken} style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
                    <i className="material-icons left">save</i>
                    {instagramSaving ? "Saving..." : "Save token"}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void onSaveInstagram(true)}
                    disabled={instagramSaving || !configDraft.accessToken}
                    style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}
                  >
                    <i className="material-icons left">hub</i>
                    {instagramSaving ? "Resolving..." : "Save + resolve page + IG"}
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <RowStat label="Token source" value={safeStr(status?.tokenSource) || "Not seeded"} icon="vpn_key" />
                  <RowStat label="Meta expiry" value={safeStr(status?.metaUserTokenExpiresAt) ? formatDateTime(safeStr(status?.metaUserTokenExpiresAt)) : "Not stored"} icon="schedule" />
                  <RowStat label="Saved expiry" value={safeStr(status?.tokenExpiresAt) ? formatDateTime(safeStr(status?.tokenExpiresAt)) : "Not stored"} icon="calendar_month" />
                </div>

                <div style={{ borderRadius: 16, padding: 14, background: "rgba(15,23,42,.04)", border: "1px solid rgba(148,163,184,.16)", color: "#0f172a", fontWeight: 700, lineHeight: 1.6 }}>
                  For Instagram publishing, use the Meta-generated token from the Instagram use case screen. The resolve step is only for page and account metadata, and the backend now keeps the direct Instagram publish token intact.
                </div>

                  {instagramOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(34,197,94,.10)", color: "#166534", border: "1px solid rgba(34,197,94,.22)", fontWeight: 800 }}>{instagramOk}</div> : null}
                  {instagramRefreshOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(59,130,246,.10)", color: "#1d4ed8", border: "1px solid rgba(59,130,246,.22)", fontWeight: 800 }}>{instagramRefreshOk}</div> : null}
                  {instagramError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800 }}>{instagramError}</div> : null}
                  {instagramRefreshError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800 }}>{instagramRefreshError}</div> : null}
                </div>
            ) : null}

            {activeTabs.instagram === "test" ? (
              <>
                <PlatformTestComposer
                  accent="#2563eb"
                  connected={instagramConfigured}
                  platformName="Instagram"
                  actionLabel="Run Instagram test"
                  actionIcon="photo_camera"
                  actionDisabledText="The composer stays locked until Instagram is connected."
                  actionPendingText="Running..."
                  actionBusy={instagramPublishing}
                  onAction={instagramConfigured ? () => void onSendInstagramTest() : undefined}
                  draft={testDraft}
                  setDraft={setTestDraft}
                  note="This first runs a debug echo so we can confirm the exact image URL and caption the backend sees, then it hits the publish endpoint."
                />
                <div style={{ marginTop: 12 }}>
                  <ResponsePreview result={instagramTestResult} />
                </div>
              </>
            ) : null}
          </div>
        </section>

        <section style={fullRowCardStyle(activeTabs.facebook !== "debug", "#1877f2")}>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>Facebook page</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>Page token controls plus a visible post count and a locked test composer.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TabButton active={activeTabs.facebook === "debug"} onClick={() => setPlatformTab("facebook", "debug")}>Debug</TabButton>
                <TabButton active={activeTabs.facebook === "setup"} onClick={() => setPlatformTab("facebook", "setup")}>Setup</TabButton>
                <TabButton active={activeTabs.facebook === "test"} onClick={() => setPlatformTab("facebook", "test")}>Test</TabButton>
              </div>
            </div>

            {activeTabs.facebook === "debug" ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.3fr) minmax(260px, 1fr) minmax(260px, 1fr)", gap: 12 }}>
                <div style={{ borderRadius: 20, background: "rgba(24,119,242,.08)", padding: 16 }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Page</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>{facebookPageLabel}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={chipStyle(facebookConfigured ? "green" : "amber")}>{facebookConfigured ? "Configured" : "Needs token"}</span>
                    <span style={chipStyle("blue")}>{facebookPosts.length} posts seen</span>
                  </div>
                </div>
                <RowStat label="Token source" value={safeStr(facebookStatus?.tokenSource) || "Not seeded"} icon="vpn_key" />
                <RowStat label="Graph version" value={safeStr(facebookStatus?.graphVersion) || "v25.0"} icon="api" />
              </div>
            ) : null}

            {activeTabs.facebook === "setup" ? (
              <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: 12 }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Facebook Page token</span>
                      <textarea
                        value={facebookDraft.accessToken}
                        onChange={(e) => setFacebookDraft((prev) => ({ ...prev, accessToken: e.target.value }))}
                        rows={3}
                        placeholder="Paste the Facebook Page access token"
                        style={{ width: "100%", resize: "vertical", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none", lineHeight: 1.5 }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Meta generated token seed</span>
                      <textarea
                        value={facebookDraft.metaUserAccessToken}
                        onChange={(e) => setFacebookDraft((prev) => ({ ...prev, metaUserAccessToken: e.target.value }))}
                        rows={3}
                        placeholder="Optional: paste the Meta user token so refresh can rehydrate the page token later"
                        style={{ width: "100%", resize: "vertical", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none", lineHeight: 1.5 }}
                      />
                    </label>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ display: "grid", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Graph version</span>
                      <input
                        type="text"
                        value={facebookDraft.graphVersion}
                        onChange={(e) => setFacebookDraft((prev) => ({ ...prev, graphVersion: e.target.value }))}
                        placeholder="v25.0"
                        style={{ width: "100%", borderRadius: 14, border: "1px solid rgba(148,163,184,.26)", padding: "12px 14px", fontSize: 14, outline: "none" }}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(148,163,184,.18)", background: "rgba(248,250,252,.92)" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>Refresh mode</span>
                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
                          <input type="checkbox" checked={facebookDraft.exchangeLongLived} onChange={(e) => setFacebookDraft((prev) => ({ ...prev, exchangeLongLived: e.target.checked }))} />
                          Exchange long-lived
                        </label>
                        <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 700 }}>
                          <input type="checkbox" checked={facebookDraft.resolveFromPage} onChange={(e) => setFacebookDraft((prev) => ({ ...prev, resolveFromPage: e.target.checked }))} />
                          Resolve page token
                        </label>
                      </div>
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button type="button" className="btn" onClick={() => void onRefreshFacebook()} disabled={facebookRefreshing} style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #14b8a6, #0f766e)" }}>
                        <i className="material-icons left">autorenew</i>
                        {facebookRefreshing ? "Refreshing..." : "Refresh page token"}
                      </button>
                      <button type="button" className="btn" onClick={() => void onSaveFacebook()} disabled={facebookSaving || (!facebookDraft.accessToken && !facebookDraft.metaUserAccessToken)} style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}>
                        <i className="material-icons left">save</i>
                        {facebookSaving ? "Saving..." : "Save token"}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <RowStat label="Posts detected" value={facebookPosts.length} icon="table_chart" />
                  <RowStat label="Refresh state" value={facebookStatus?.refreshable ? "Ready" : "Seed first"} icon="sync" />
                  <RowStat label="Expiry" value={safeStr(facebookStatus?.metaUserTokenExpiresAt) ? formatDateTime(safeStr(facebookStatus?.metaUserTokenExpiresAt)) : (safeStr(facebookStatus?.tokenExpiresAt) ? formatDateTime(safeStr(facebookStatus?.tokenExpiresAt)) : "Not stored")} icon="schedule" />
                </div>

                {facebookOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(34,197,94,.10)", color: "#166534", border: "1px solid rgba(34,197,94,.22)", fontWeight: 800 }}>{facebookOk}</div> : null}
                {facebookRefreshOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(59,130,246,.10)", color: "#1d4ed8", border: "1px solid rgba(59,130,246,.22)", fontWeight: 800 }}>{facebookRefreshOk}</div> : null}
                {facebookError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800 }}>{facebookError}</div> : null}
                {facebookRefreshError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800 }}>{facebookRefreshError}</div> : null}
                <div style={{ borderRadius: 16, padding: 14, background: "rgba(15,23,42,.04)", border: "1px solid rgba(148,163,184,.16)", color: "#0f172a", fontWeight: 700, lineHeight: 1.6 }}>
                  Paste the Facebook Page token if you only want to seed once. Paste the Meta-generated user token in the seed field too if you want refresh to re-resolve the page token later.
                </div>
              </div>
            ) : null}

            {activeTabs.facebook === "test" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <PlatformTestComposer
                  accent="#1877f2"
                  connected={facebookComposerEnabled}
                  platformName="Facebook"
                  actionLabel="Publish test post"
                  actionIcon="photo_camera"
                  actionDisabledText="Facebook is connected for token checks, and the publish action is available now."
                  actionPendingText="Publishing..."
                  actionBusy={facebookPublishing}
                  onAction={facebookComposerEnabled ? () => void onSendFacebookTest() : undefined}
                  draft={testDraft}
                  setDraft={setTestDraft}
                  note="This uses the same composer controls and now sends directly to the Facebook Page publish endpoint."
                />
                <ResponsePreview result={facebookTestResult} />
              </div>
            ) : null}
          </div>
        </section>

        <section style={fullRowCardStyle(activeTabs.linkedin !== "debug", "#0a66c2")}>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>LinkedIn org</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>Organization posting credential only. Employee sign-in stays separate.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TabButton active={activeTabs.linkedin === "debug"} onClick={() => setPlatformTab("linkedin", "debug")}>Debug</TabButton>
                <TabButton active={activeTabs.linkedin === "setup"} onClick={() => setPlatformTab("linkedin", "setup")}>Setup</TabButton>
                <TabButton active={activeTabs.linkedin === "test"} onClick={() => setPlatformTab("linkedin", "test")}>Test</TabButton>
              </div>
            </div>

            {activeTabs.linkedin === "debug" ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.3fr) minmax(260px, 1fr) minmax(260px, 1fr)", gap: 12 }}>
                <div style={{ borderRadius: 20, background: "rgba(10,102,194,.08)", padding: 16 }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Organization</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>{linkedInLabel}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={chipStyle(linkedInConfigured ? "green" : "amber")}>{linkedInConfigured ? "Connected" : "Needs connect"}</span>
                  </div>
                </div>
                <RowStat label="Posts" value={linkedinOrgPosts.length} icon="work" />
                <RowStat label="Token expiry" value={safeStr(linkedinOrgStatus?.tokenExpiresAt) ? formatDateTime(safeStr(linkedinOrgStatus?.tokenExpiresAt)) : "Not stored"} icon="schedule" />
              </div>
            ) : null}

            {activeTabs.linkedin === "setup" ? (
              <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
                <button type="button" className="btn" onClick={() => void onConnectLinkedInOrg()} disabled={linkedinLoading} style={{ borderRadius: 999, fontWeight: 900, textTransform: "none", background: "linear-gradient(135deg, #0a66c2, #004182)", width: "fit-content" }}>
                  <i className="material-icons left">business</i>
                  {linkedinLoading ? "Connecting..." : linkedInConfigured ? "Reconnect organization" : "Connect LinkedIn org"}
                </button>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, fontWeight: 700 }}>
                  Redirect URI for this flow:
                  <code style={{ display: "block", marginTop: 6, padding: "8px 10px", borderRadius: 12, background: "rgba(15,23,42,.05)", color: "#0f172a" }}>
                    /integrations/linkedin/org/callback
                  </code>
                </div>
                {linkedinOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(34,197,94,.10)", color: "#166534", border: "1px solid rgba(34,197,94,.22)", fontWeight: 800 }}>{linkedinOk}</div> : null}
                {linkedinError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800, lineHeight: 1.5 }}>{linkedinError}</div> : null}
              </div>
            ) : null}

            {activeTabs.linkedin === "test" ? (
              <div style={{ display: "grid", gap: 12 }}>
                <PlatformTestComposer
                  accent="#0a66c2"
                  connected={linkedInConfigured}
                  platformName="LinkedIn"
                  actionLabel="Publish test post"
                  actionIcon="work"
                  actionDisabledText="LinkedIn org posting is still gated while the publish flow is being wired."
                  actionPendingText="Publishing..."
                  actionBusy={false}
                  draft={testDraft}
                  setDraft={setTestDraft}
                  note="This keeps the common composer visible here too, even though LinkedIn publish still needs the dedicated endpoint."
                />
                <ResponsePreview
                  result={{
                    kind: "info",
                    title: "LinkedIn status",
                    message: "LinkedIn org posting is still waiting on a dedicated publish endpoint. You can still use Debug and Setup here.",
                    raw: { configured: linkedInConfigured, posts: linkedinOrgPosts.length },
                    at: loadedAt || new Date().toISOString(),
                  }}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section style={fullRowCardStyle(activeTabs.discord !== "debug", "#5865f2")}>
          <div style={{ padding: 18, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 1000, color: "#0f172a" }}>Discord webhook</h3>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>Outbound announcement posting only. No bot commands or moderation.</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <TabButton active={activeTabs.discord === "debug"} onClick={() => setPlatformTab("discord", "debug")}>Debug</TabButton>
                <TabButton active={activeTabs.discord === "setup"} onClick={() => setPlatformTab("discord", "setup")}>Setup</TabButton>
                <TabButton active={activeTabs.discord === "test"} onClick={() => setPlatformTab("discord", "test")}>Test</TabButton>
              </div>
            </div>

            {activeTabs.discord === "debug" ? (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1.3fr) minmax(260px, 1fr) minmax(260px, 1fr)", gap: 12 }}>
                <div style={{ borderRadius: 20, background: "rgba(88,101,242,.08)", padding: 16 }}>
                  <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>Webhook</div>
                  <div style={{ marginTop: 8, fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>{discordConfigured ? "Present in SSM" : "Missing"}</div>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span style={chipStyle(discordConfigured ? "green" : "amber")}>{discordConfigured ? "Ready" : "Needs URL"}</span>
                    <span style={chipStyle("slate")}>SSM: /ue-auth/discord-webhook-url</span>
                  </div>
                </div>
                <RowStat label="Route" value="/integrations/discord/webhook/post" icon="send" />
                <RowStat label="Note" value="Outbound only" icon="info" />
              </div>
            ) : null}

            {activeTabs.discord === "setup" ? (
              <div style={{ borderRadius: 18, padding: 14, background: "rgba(255,255,255,.9)", border: "1px solid rgba(148,163,184,.14)" }}>
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 900, textTransform: "uppercase" }}>Webhook URL note</div>
                <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.6 }}>
                  The backend reads the webhook URL from SSM. No client-side secret is needed.
                </div>
              </div>
            ) : null}

            {activeTabs.discord === "test" ? (
              <div style={{ display: "grid", gap: 12, paddingTop: 4 }}>
                <PlatformTestComposer
                  accent="#5865f2"
                  connected={discordConfigured}
                  platformName="Discord"
                  actionLabel="Send Discord test"
                  actionIcon="send"
                  actionDisabledText="Discord is locked until the webhook URL is present in SSM."
                  actionPendingText="Sending..."
                  actionBusy={discordPosting}
                  onAction={discordConfigured ? () => void onPostDiscord() : undefined}
                  draft={testDraft}
                  setDraft={setTestDraft}
                  note="Discord uses the same shared bottom controls. The webhook only needs the caption/message part, but the image URL stays available for testing."
                />
                <ResponsePreview result={discordTestResult} />
                {discordOk ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(34,197,94,.10)", color: "#166534", border: "1px solid rgba(34,197,94,.22)", fontWeight: 800 }}>{discordOk}</div> : null}
                {discordError ? <div style={{ borderRadius: 16, padding: 14, background: "rgba(248,113,113,.10)", color: "#991b1b", border: "1px solid rgba(248,113,113,.22)", fontWeight: 800, lineHeight: 1.5 }}>{discordError}</div> : null}
              </div>
            ) : null}
          </div>
        </section>

        <section style={{ ...cardStyle(), padding: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>What this page manages</h3>
          <ul style={{ margin: "14px 0 0", paddingLeft: 18, color: "#334155", lineHeight: 1.8, fontWeight: 600 }}>
            <li>Seeds the Meta token chain into SSM.</li>
            <li>Shows summary stats only, not full post feeds.</li>
            <li>Uses full-width row cards with setup sections on demand.</li>
            <li>Posts Discord announcements through a webhook only.</li>
            <li>Separates employee sign-in from LinkedIn organization posting.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
