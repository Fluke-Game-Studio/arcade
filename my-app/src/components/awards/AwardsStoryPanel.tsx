import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type StudioRecentItem = {
  id?: string;
  type?: string;
  eventType?: string;
  username?: string;
  title?: string;
  description?: string;
  tier?: string;
  weekStart?: string;
  score?: number;
  awardedAt?: string;
  at?: string;
  awardedBy?: string;
  by?: string;
  metric?: string;
  threshold?: number;
  requirement?: string;
  notes?: string;
  [k: string]: any;
};

type StudioSummary = {
  ok?: boolean;
  weekStart?: string;
  totals?: {
    users?: number;
    achievements?: number;
    trophies?: number;
    awards?: number;
    mvpAwards?: number;
    [k: string]: any;
  };
  recentAchievements?: StudioRecentItem[];
  recentTrophies?: StudioRecentItem[];
  recentAwards?: StudioRecentItem[];
  weeklyMvp?: {
    username?: string;
    weekStart?: string;
    score?: number;
    notes?: string;
    breakdown?: Record<string, number>;
  } | null;
  leaderboards?: {
    byAwards?: any[];
    byAchievements?: any[];
    byTrophies?: any[];
    byScore?: any[];
    [k: string]: any;
  };
  [k: string]: any;
};

type BadgeKey =
  | "bronze3"
  | "bronze2"
  | "bronzePro"
  | "silver3"
  | "silver2"
  | "silverPro"
  | "gold3"
  | "gold2"
  | "goldPro";

type LegendEntry = {
  key: BadgeKey;
  label: string;
  requirement: string;
  type: string;
  tier: string;
};

const BADGE_FILE_MAP: Record<BadgeKey, string> = {
  bronze3: "/awards/bronze 3.png",
  bronze2: "/awards/bronze 2.png",
  bronzePro: "/awards/bronze pro.png",
  silver3: "/awards/silver 3.png",
  silver2: "/awards/silver 2.png",
  silverPro: "/awards/silver pro.png",
  gold3: "/awards/gold 3.png",
  gold2: "/awards/gold 2.png",
  goldPro: "/awards/gold pro.png",
};

const BADGE_LEGEND: LegendEntry[] = [
  {
    key: "bronze3",
    label: "Bronze III",
    tier: "Bronze III",
    type: "tier",
    requirement: "Entry bronze milestone. First recognition level in the bronze ladder.",
  },
  {
    key: "bronze2",
    label: "Bronze II",
    tier: "Bronze II",
    type: "tier",
    requirement: "Second bronze milestone. Awarded after progressing beyond Bronze III.",
  },
  {
    key: "bronzePro",
    label: "Bronze Pro",
    tier: "Bronze Pro",
    type: "tier",
    requirement: "Top bronze tier. Final bronze recognition before silver progression.",
  },
  {
    key: "silver3",
    label: "Silver III",
    tier: "Silver III",
    type: "tier",
    requirement: "Entry silver milestone. Indicates stronger sustained contribution.",
  },
  {
    key: "silver2",
    label: "Silver II",
    tier: "Silver II",
    type: "tier",
    requirement: "Second silver milestone. Awarded after advancing beyond Silver III.",
  },
  {
    key: "silverPro",
    label: "Silver Pro",
    tier: "Silver Pro",
    type: "tier",
    requirement: "Top silver tier. Final silver recognition before gold progression.",
  },
  {
    key: "gold3",
    label: "Gold III",
    tier: "Gold III",
    type: "tier",
    requirement: "Entry gold milestone. High recognition tier for standout impact.",
  },
  {
    key: "gold2",
    label: "Gold II",
    tier: "Gold II",
    type: "tier",
    requirement: "Second gold milestone. Awarded after continued excellence beyond Gold III.",
  },
  {
    key: "goldPro",
    label: "Gold Pro",
    tier: "Gold Pro",
    type: "tier",
    requirement: "Top gold tier. Highest visible rank in the current award ladder.",
  },
];

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(v?: string) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtShortDate(v?: string) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
  });
}

function fmtWeekLabel(iso?: string) {
  const s = safeStr(iso);
  if (!s) return "All Time";
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getRecipientName(item: StudioRecentItem) {
  const personName = safeStr((item as any)?.person?.name);
  if (personName) return personName;
  return safeStr(item.username);
}

function normalizeRecent(summary: StudioSummary | null): StudioRecentItem[] {
  if (!summary) return [];

  const merged = [
    ...(Array.isArray(summary.recentAwards) ? summary.recentAwards : []),
    ...(Array.isArray(summary.recentAchievements) ? summary.recentAchievements : []),
    ...(Array.isArray(summary.recentTrophies) ? summary.recentTrophies : []),
  ];

  const seen = new Set<string>();
  const out: StudioRecentItem[] = [];

  for (const item of merged) {
    const key =
      safeStr(item.id) ||
      [
        safeStr(item.type || item.eventType),
        getRecipientName(item),
        safeStr(item.title),
        safeStr(item.awardedAt || item.at),
      ].join("|");

    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out.sort((a, b) => {
    const da = new Date(safeStr(a.awardedAt || a.at) || 0).getTime();
    const db = new Date(safeStr(b.awardedAt || b.at) || 0).getTime();
    return db - da;
  });
}

function normalizeTierText(v?: string) {
  return safeStr(v)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\blevel\b/g, " ")
    .replace(/\btier\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasTokens(s: string, ...tokens: string[]) {
  return tokens.every((token) => s.includes(token));
}

function getItemType(item: StudioRecentItem) {
  const t = safeStr(item.type || item.eventType).toLowerCase();
  if (t.includes("troph")) return "trophy";
  if (t.includes("mvp")) return "mvp";
  if (t.includes("tier")) return "tier";
  return "achievement";
}

function getItemTone(item: StudioRecentItem): "green" | "amber" | "purple" | "blue" {
  const kind = getItemType(item);
  if (kind === "trophy") return "amber";
  if (kind === "mvp") return "purple";
  if (kind === "tier") return "blue";
  return "green";
}

function getItemTitle(item: StudioRecentItem) {
  const title = safeStr(item.title);
  if (title) return title;
  const kind = getItemType(item);
  if (kind === "trophy") return "Trophy";
  if (kind === "mvp") return "Weekly MVP";
  if (kind === "tier") return safeStr(item.tier) || "Award Tier";
  return "Achievement";
}

function getItemMeta(item: StudioRecentItem) {
  const parts = [getRecipientName(item), safeStr(item.description || item.tier)].filter(Boolean);
  return parts.join(" • ");
}

function getTierLevel(v?: string): BadgeKey | "" {
  const s = normalizeTierText(v);
  if (!s) return "";

  if (hasTokens(s, "bronze", "iii") || hasTokens(s, "bronze", "3") || s === "bronze3") return "bronze3";
  if (hasTokens(s, "bronze", "ii") || hasTokens(s, "bronze", "2") || s === "bronze2") return "bronze2";
  if (
    hasTokens(s, "bronze", "pro") ||
    hasTokens(s, "bronze", "i") ||
    hasTokens(s, "bronze", "1") ||
    s === "bronze1" ||
    s === "bronzepro"
  ) {
    return "bronzePro";
  }

  if (hasTokens(s, "silver", "iii") || hasTokens(s, "silver", "3") || s === "silver3") return "silver3";
  if (hasTokens(s, "silver", "ii") || hasTokens(s, "silver", "2") || s === "silver2") return "silver2";
  if (
    hasTokens(s, "silver", "pro") ||
    hasTokens(s, "silver", "i") ||
    hasTokens(s, "silver", "1") ||
    s === "silver1" ||
    s === "silverpro"
  ) {
    return "silverPro";
  }

  if (hasTokens(s, "gold", "iii") || hasTokens(s, "gold", "3") || s === "gold3") return "gold3";
  if (hasTokens(s, "gold", "ii") || hasTokens(s, "gold", "2") || s === "gold2") return "gold2";
  if (
    hasTokens(s, "gold", "pro") ||
    hasTokens(s, "gold", "i") ||
    hasTokens(s, "gold", "1") ||
    s === "gold1" ||
    s === "goldpro"
  ) {
    return "goldPro";
  }

  return "";
}

function getBadgeKeyForItem(item: StudioRecentItem): BadgeKey | "" {
  return (
    getTierLevel(item.tier) ||
    getTierLevel(item.title) ||
    getTierLevel(item.description) ||
    getTierLevel(item.notes) ||
    getTierLevel(item.id)
  );
}

function getRequirementText(item: StudioRecentItem) {
  const explicit =
    safeStr(item.requirement) ||
    safeStr(item.notes) ||
    safeStr(item.description);

  if (explicit) return explicit;

  const metric = safeStr(item.metric);
  const threshold = safeNum(item.threshold);

  if (metric && threshold) {
    return `Requirement: ${threshold} ${metric}.`;
  }
  if (metric) {
    return `Requirement metric: ${metric}.`;
  }
  if (getItemType(item) === "trophy" && safeStr(item.tier)) {
    return `Tier awarded: ${safeStr(item.tier)}.`;
  }
  if (getItemType(item) === "mvp" && safeNum(item.score)) {
    return `Awarded with score ${safeNum(item.score).toFixed(1)}.`;
  }
  if (getItemType(item) === "tier" && safeStr(item.tier)) {
    return `${safeStr(item.tier)} requirement details are not wired from backend yet.`;
  }
  return "No requirement details available for this award yet.";
}

function buildHeroSummary(summary: StudioSummary | null, weekStart?: string) {
  const totals = summary?.totals || {};
  const users = safeNum(totals.users);
  const achievements = safeNum(totals.achievements);
  const trophies = safeNum(totals.trophies);
  const recognition = safeNum(totals.awards) || achievements + trophies;
  const weekText = weekStart ? `for the week of ${fmtWeekLabel(weekStart)}` : "across all available data";

  if (!summary) {
    return {
      title: "Recognition snapshot",
      body: "Recognition data is not available yet.",
      bullets: [
        "No summary payload loaded",
        "Recent cards will appear once data is returned",
        "Tier legend remains available for reference",
      ],
    };
  }

  if (!recognition) {
    return {
      title: "Recognition snapshot",
      body: `No recognition items are recorded ${weekText} yet. The panel is ready, contributors are visible, and new achievements or trophies will appear here as soon as they are awarded.`,
      bullets: [
        `${users} contributors currently tracked`,
        "0 achievements recorded",
        "0 trophies recorded",
      ],
    };
  }

  return {
    title: "Recognition snapshot",
    body: `A total of ${recognition} recognition item${recognition === 1 ? "" : "s"} are recorded ${weekText}, spanning ${users} contributor${users === 1 ? "" : "s"}. The strip below highlights the latest visible recognition events.`,
    bullets: [
      `${achievements} achievement${achievements === 1 ? "" : "s"}`,
      `${trophies} troph${trophies === 1 ? "y" : "ies"}`,
      `${users} active contributor${users === 1 ? "" : "s"} in scope`,
    ],
  };
}

function Pill({
  icon,
  text,
  tone = "blue",
}: {
  icon: string;
  text: string;
  tone?: "blue" | "green" | "amber" | "purple" | "grey";
}) {
  return (
    <span className={`arsPill ${tone}`}>
      <i className="material-icons">{icon}</i>
      <span>{text}</span>
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="arsStatCard">
      <div className="arsStatTop">
        <div className="arsStatIcon">
          <i className="material-icons">{icon}</i>
        </div>
        <div className="arsStatLabel">{label}</div>
      </div>
      <div className="arsStatValue">{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
  icon = "info",
}: {
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <div className="arsEmpty">
      <div className="arsEmptyIcon">
        <i className="material-icons">{icon}</i>
      </div>
      <div className="arsEmptyTitle">{title}</div>
      {!!subtitle && <div className="arsEmptySub">{subtitle}</div>}
    </div>
  );
}

function BadgeIcon({
  badge,
  size = 72,
  glow = false,
}: {
  badge: BadgeKey;
  size?: number;
  glow?: boolean;
}) {
  const src = BADGE_FILE_MAP[badge];
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(180deg, rgba(255,255,255,.95), rgba(248,250,252,.9))",
          border: "1px solid rgba(226,232,240,.95)",
          boxShadow: glow
            ? "0 12px 24px rgba(245,158,11,.18), inset 0 1px 0 rgba(255,255,255,.8)"
            : "0 8px 18px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.8)",
          overflow: "hidden",
          flex: "0 0 auto",
          color: "#475569",
        }}
      >
        <i className="material-icons" style={{ fontSize: Math.max(24, Math.floor(size * 0.42)) }}>
          emoji_events
        </i>
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg, rgba(255,255,255,.95), rgba(248,250,252,.9))",
        border: "1px solid rgba(226,232,240,.95)",
        boxShadow: glow
          ? "0 12px 24px rgba(245,158,11,.18), inset 0 1px 0 rgba(255,255,255,.8)"
          : "0 8px 18px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.8)",
        overflow: "hidden",
        flex: "0 0 auto",
      }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setImgError(true)}
        style={{
          width: "84%",
          height: "84%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

function RecognitionIcon({ item }: { item: StudioRecentItem }) {
  const badge = getBadgeKeyForItem(item);
  const tone = getItemTone(item);
  const imageUrl = safeStr((item as any).imageUrl);

  if (badge) {
    return <BadgeIcon badge={badge} size={72} glow={getItemType(item) === "trophy"} />;
  }

  if (imageUrl) {
    return (
      <div
        className={`arsFallbackIcon ${tone}`}
        style={{ overflow: "hidden", padding: 8, background: "rgba(255,255,255,.95)" }}
      >
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
          }}
          style={{ width: "88%", height: "88%", objectFit: "contain", display: "block" }}
        />
      </div>
    );
  }

  const icon =
    getItemType(item) === "mvp"
      ? "workspace_premium"
      : getItemType(item) === "trophy"
      ? "emoji_events"
      : "military_tech";

  return (
    <div className={`arsFallbackIcon ${tone}`}>
      <i className="material-icons">{icon}</i>
    </div>
  );
}

function AwardDetailsModal({
  item,
  onClose,
}: {
  item: StudioRecentItem | null;
  onClose: () => void;
}) {
  if (!item) return null;

  const tone = getItemTone(item);
  const title = getItemTitle(item);
  const meta = getItemMeta(item);
  const requirement = getRequirementText(item);

  return (
    <div className="arsModalBackdrop" onClick={onClose}>
      <div className="arsModalCard" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="arsModalClose" onClick={onClose}>
          <i className="material-icons">close</i>
        </button>

        <div className="arsModalTop">
          <RecognitionIcon item={item} />
          <div>
            <div className={`arsModalBadge ${tone}`}>
              {safeStr(item.type || item.eventType || "award")}
            </div>
            <div className="arsModalTitle">{title}</div>
            <div className="arsModalMeta">{meta || "Recognition event"}</div>
          </div>
        </div>

        <div className="arsModalGrid">
          <div className="arsModalInfo">
            <div className="arsModalInfoLabel">Awarded</div>
            <div className="arsModalInfoValue">{fmtDateTime(safeStr(item.awardedAt || item.at))}</div>
          </div>

          <div className="arsModalInfo">
            <div className="arsModalInfoLabel">Recipient</div>
            <div className="arsModalInfoValue">{getRecipientName(item) || "System / Tier Info"}</div>
          </div>

          {!!safeStr(item.tier) && (
            <div className="arsModalInfo">
              <div className="arsModalInfoLabel">Tier</div>
              <div className="arsModalInfoValue">{safeStr(item.tier)}</div>
            </div>
          )}

          {!!safeStr(item.awardedBy || item.by) && (
            <div className="arsModalInfo">
              <div className="arsModalInfoLabel">Awarded By</div>
              <div className="arsModalInfoValue">{safeStr(item.awardedBy || item.by)}</div>
            </div>
          )}
        </div>

        <div className="arsRequirementCard">
          <div className="arsRequirementLabel">Requirement / Details</div>
          <div className="arsRequirementText">{requirement}</div>
        </div>
      </div>
    </div>
  );
}

export default function AwardsSummaryPanel() {
  const { api } = useAuth();
  const [summary, setSummary] = useState<StudioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [selectedAward, setSelectedAward] = useState<StudioRecentItem | null>(null);

  async function loadSummary(activeWeekStart?: string) {
    setLoading(true);
    setError("");

    try {
      if (typeof (api as any)?.getStudioSummary === "function") {
        const resp = await (api as any).getStudioSummary(activeWeekStart || undefined);
        setSummary(resp || null);
      } else if (typeof (api as any)?.getRecentAwards === "function") {
        const recentResp = await (api as any).getRecentAwards({
          limit: 24,
          weekStart: activeWeekStart || undefined,
        });

        setSummary({
          ok: true,
          weekStart: activeWeekStart || "",
          totals: {
            users: 0,
            achievements: 0,
            trophies: 0,
            awards: Array.isArray(recentResp?.items) ? recentResp.items.length : 0,
            mvpAwards: 0,
          },
          recentAwards: Array.isArray(recentResp?.items) ? recentResp.items : [],
          recentAchievements: [],
          recentTrophies: [],
          leaderboards: {
            byAwards: [],
            byAchievements: [],
            byTrophies: [],
            byScore: [],
          },
          weeklyMvp: null,
        });
      } else {
        setError("Awards summary API is not wired.");
        setSummary(null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load awards summary.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary(weekStart || undefined);
  }, [weekStart]);

  const recentItems = useMemo(() => normalizeRecent(summary), [summary]);
  const derivedAchievements = Array.isArray(summary?.recentAchievements)
    ? summary!.recentAchievements.length
    : 0;

  const derivedTrophies = Array.isArray(summary?.recentTrophies)
    ? summary!.recentTrophies.length
    : 0;

  const derivedAwards = Array.isArray(summary?.recentAwards)
    ? summary!.recentAwards.length
    : derivedAchievements + derivedTrophies;

  const derivedUsers = new Set(
    normalizeRecent(summary)
      .map((x) => safeStr(getRecipientName(x)).toLowerCase())
      .filter(Boolean)
  ).size;

  const rawTotals = summary?.totals || {};

  const totals = {
    users: safeNum(rawTotals.users) || derivedUsers,
    achievements: safeNum(rawTotals.achievements) || derivedAchievements,
    trophies: safeNum(rawTotals.trophies) || derivedTrophies,
    awards:
      safeNum(rawTotals.awards) ||
      safeNum(rawTotals.achievements) + safeNum(rawTotals.trophies) ||
      derivedAwards,
  };

  const awardCount = safeNum(totals.awards);

  const recentStrip = useMemo(() => recentItems.slice(0, 8), [recentItems]);
  const heroSummary = useMemo(
    () => buildHeroSummary(summary, weekStart || undefined),
    [summary, weekStart]
  );

  const openLegendDetails = (entry: LegendEntry) => {
    setSelectedAward({
      id: `legend-${entry.key}`,
      type: "tier",
      eventType: "tier",
      title: entry.label,
      tier: entry.tier,
      description: entry.requirement,
      requirement: entry.requirement,
      awardedAt: "",
      username: "",
      notes: entry.requirement,
    });
  };

  return (
    <div className="arsWrap">
      <style>{`
        .arsWrap{
          margin-top:14px;
        }

        .arsRoot{
          border-radius:30px;
          overflow:hidden;
          border:1px solid #e6edf4;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          box-shadow:0 22px 50px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.9);
        }

        .arsHero{
          position:relative;
          overflow:visible;
          border-bottom:1px solid #e9eef5;
          background:
            radial-gradient(900px 320px at -5% -10%, rgba(250,204,21,.11), transparent 50%),
            radial-gradient(760px 260px at 100% 0%, rgba(99,102,241,.14), transparent 58%),
            linear-gradient(135deg, #091423 0%, #0f2238 52%, #173a5f 100%);
          color:#fff;
        }

        .arsHero:before{
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(90deg, rgba(255,255,255,.04), transparent 20%, transparent 80%, rgba(255,255,255,.04)),
            radial-gradient(circle at 20% 15%, rgba(255,255,255,.08), transparent 18%);
          pointer-events:none;
        }

        .arsHeroInner{
          position:relative;
          z-index:1;
          padding:24px;
          display:grid;
          grid-template-columns:minmax(0,1.2fr) minmax(280px,.9fr);
          gap:18px;
          align-items:start;
        }

        .arsHeroLeft{
          min-width:0;
          display:grid;
          gap:14px;
        }

        .arsKicker{
          font-size:11px;
          font-weight:900;
          letter-spacing:.16em;
          text-transform:uppercase;
          color:rgba(191,219,254,.86);
        }

        .arsTitle{
          margin-top:2px;
          font-size:30px;
          line-height:1.02;
          font-weight:1000;
          letter-spacing:-.03em;
          max-width:320px;
        }

        .arsSub{
          color:rgba(226,232,240,.88);
          font-size:14px;
          line-height:1.55;
          max-width:560px;
        }

        .arsTopMeta{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
          align-items:center;
        }

        .arsPill{
          display:inline-flex;
          align-items:center;
          gap:7px;
          max-width:100%;
          padding:8px 12px;
          border-radius:999px;
          font-size:11px;
          font-weight:900;
          white-space:normal;
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08);
        }

        .arsPill span{
          white-space:normal;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
        }

        .arsPill i{ font-size:15px; flex:0 0 auto; }
        .arsPill.blue{ background:rgba(59,130,246,.16); color:#dbeafe; border:1px solid rgba(59,130,246,.18); }
        .arsPill.green{ background:rgba(34,197,94,.16); color:#dcfce7; border:1px solid rgba(34,197,94,.18); }
        .arsPill.amber{ background:rgba(245,158,11,.18); color:#fef3c7; border:1px solid rgba(245,158,11,.18); }
        .arsPill.purple{ background:rgba(168,85,247,.18); color:#f3e8ff; border:1px solid rgba(168,85,247,.18); }
        .arsPill.grey{ background:rgba(255,255,255,.10); color:#e2e8f0; border:1px solid rgba(255,255,255,.14); }

        .arsSummaryCard{
          min-width:0;
          border-radius:24px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.08);
          box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 16px 30px rgba(2,6,23,.15);
          backdrop-filter:blur(14px);
          -webkit-backdrop-filter:blur(14px);
          padding:18px;
        }

        .arsSummaryKicker{
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.14em;
          color:rgba(191,219,254,.84);
        }

        .arsSummaryTitle{
          margin-top:10px;
          font-size:20px;
          font-weight:950;
          line-height:1.15;
          color:#ffffff;
        }

        .arsSummaryText{
          margin-top:10px;
          font-size:14px;
          line-height:1.7;
          color:#f8fafc;
        }

        .arsSummaryBullets{
          margin-top:14px;
          display:grid;
          gap:9px;
        }

        .arsSummaryBullet{
          display:flex;
          align-items:flex-start;
          gap:8px;
          font-size:13px;
          line-height:1.5;
          color:rgba(226,232,240,.94);
        }

        .arsSummaryBullet i{
          font-size:16px;
          margin-top:1px;
          color:#93c5fd;
          flex:0 0 auto;
        }

        .arsHeroStats{
          padding:16px;
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px;
        }

        .arsStatCard{
          border-radius:22px;
          padding:15px;
          border:1px solid #e4edf4;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          box-shadow:0 10px 24px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.85);
          min-width:0;
        }

        .arsStatTop{
          display:flex;
          flex-direction:column;
          align-items:flex-start;
          gap:10px;
          min-width:0;
        }

        .arsStatIcon{
          width:36px;
          height:36px;
          border-radius:12px;
          display:grid;
          place-items:center;
          background:#f4f8fb;
          color:#5c7283;
          border:1px solid #e2ebf3;
          flex:0 0 auto;
        }

        .arsStatIcon i{ font-size:18px; }

        .arsStatLabel{
          font-size:11px;
          color:#64748b;
          font-weight:900;
          letter-spacing:.08em;
          text-transform:uppercase;
          white-space:normal;
          line-height:1.2;
          word-break:break-word;
          overflow-wrap:anywhere;
        }

        .arsStatValue{
          margin-top:12px;
          font-size:32px;
          line-height:1;
          font-weight:1000;
          color:#0f172a;
          letter-spacing:-.03em;
          overflow:hidden;
          text-overflow:ellipsis;
        }

        @supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
          .arsPill{
            background:rgba(15,23,42,.55) !important;
            border:1px solid rgba(255,255,255,.18) !important;
          }
          .arsSummaryCard{
            background:rgba(15,23,42,.52) !important;
            border:1px solid rgba(255,255,255,.16) !important;
          }
        }

        .arsBody{
          padding:16px;
          display:grid;
          gap:16px;
        }

        .arsStack{
          display:grid;
          gap:16px;
        }

        .arsCard{
          border-radius:26px;
          border:1px solid #e6edf4;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          box-shadow:0 16px 34px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.85);
          overflow:visible;
        }

        .arsCardHead{
          padding:18px 18px 0 18px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }

        .arsCardTitle{
          font-size:18px;
          line-height:1.2;
          font-weight:950;
          color:#0f172a;
          letter-spacing:-.01em;
        }

        .arsCardSub{
          margin-top:4px;
          font-size:12.5px;
          color:#64748b;
          line-height:1.45;
          max-width:520px;
        }

        .arsCardBody{
          padding:18px;
        }

        .arsToolbar{
          display:flex;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          position:relative;
          z-index:40;
        }

        .arsSelect{
          height:42px;
          padding:0 12px;
          border-radius:14px;
          border:1px solid #dbe5ef;
          background:#fff;
          color:#0f172a;
          font-weight:800;
          outline:none;
          box-shadow:none;
          max-width:100%;
        }

        .arsLegendWrap{
          position:relative;
          display:inline-flex;
          align-items:center;
          padding-bottom:10px;
          margin-bottom:-10px;
        }

        .arsLegendBtn{
          width:42px;
          height:42px;
          display:grid;
          place-items:center;
          border-radius:999px;
          border:1px solid #dbe5ef;
          background:#fff;
          color:#334155;
          cursor:pointer;
          box-shadow:0 6px 14px rgba(15,23,42,.05);
          position:relative;
          z-index:2;
        }

        .arsLegendBtn:hover{
          border-color:#cddaea;
          box-shadow:0 10px 18px rgba(15,23,42,.08);
        }

        .arsLegendPopover{
          position:absolute;
          top:42px;
          right:0;
          width:336px;
          padding:14px;
          padding-top:18px;
          border-radius:20px;
          border:1px solid #e5ecf3;
          background:rgba(255,255,255,.98);
          backdrop-filter:blur(14px);
          box-shadow:0 22px 40px rgba(15,23,42,.14);
          opacity:0;
          visibility:hidden;
          transform:translateY(8px);
          transition:all .18s ease;
          z-index:50;
          pointer-events:none;
        }

        .arsLegendWrap:hover .arsLegendPopover,
        .arsLegendWrap:focus-within .arsLegendPopover{
          opacity:1;
          visibility:visible;
          transform:translateY(0);
          pointer-events:auto;
        }

        .arsLegendTitle{
          font-size:16px;
          font-weight:950;
          color:#0f172a;
          margin-bottom:6px;
        }

        .arsLegendSub{
          font-size:12px;
          color:#64748b;
          line-height:1.45;
          margin-bottom:12px;
        }

        .arsLegendGrid{
          display:grid;
          grid-template-columns:repeat(3,minmax(0,1fr));
          gap:12px;
        }

        .arsLegendItem{
          border:1px solid #e6edf4;
          border-radius:18px;
          padding:12px 10px;
          text-align:center;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
          min-height:128px;
          width:100%;
        }

        .arsLegendItem:hover{
          transform:translateY(-2px);
          box-shadow:0 12px 22px rgba(15,23,42,.08);
          border-color:#d5e3f1;
        }

        .arsLegendLabel{
          margin-top:10px;
          font-size:13px;
          font-weight:900;
          color:#475569;
          line-height:1.25;
          text-align:center;
          width:100%;
        }

        .arsRecentStrip{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px;
        }

        .arsRecentMini{
          border:1px solid #e4edf4;
          border-radius:18px;
          padding:12px;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          box-shadow:0 8px 20px rgba(15,23,42,.04);
          cursor:pointer;
          transition:transform .16s ease, box-shadow .16s ease;
          min-width:0;
          display:flex;
          flex-direction:column;
          justify-content:flex-start;
          align-items:stretch;
          overflow:hidden;
        }

        .arsRecentMini:hover{
          transform:translateY(-2px);
          box-shadow:0 14px 26px rgba(15,23,42,.08);
        }

        .arsRecentMiniTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:8px;
          min-width:0;
        }

        .arsRecentMiniTitle{
          margin-top:10px;
          font-size:13px;
          font-weight:900;
          color:#0f172a;
          line-height:1.25;
          word-break:break-word;
          overflow-wrap:anywhere;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          min-height:2.6em;
        }

        .arsRecentMiniMeta{
          margin-top:5px;
          font-size:11px;
          color:#64748b;
          font-weight:700;
          line-height:1.4;
          word-break:break-word;
          overflow-wrap:anywhere;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          min-height:2.8em;
        }

        .arsMiniStamp{
          border-radius:999px;
          padding:6px 9px;
          font-size:10px;
          font-weight:900;
          color:#475569;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          white-space:nowrap;
          flex:0 0 auto;
        }

        .arsFallbackIcon{
          width:72px;
          height:72px;
          border-radius:20px;
          display:grid;
          place-items:center;
          background:#fff;
          border:1px solid #e2ebf3;
          box-shadow:0 8px 18px rgba(15,23,42,.08);
          flex:0 0 auto;
        }

        .arsFallbackIcon i{
          font-size:34px;
        }

        .arsFallbackIcon.green{ color:#166534; }
        .arsFallbackIcon.amber{ color:#92400e; }
        .arsFallbackIcon.purple{ color:#6b21a8; }
        .arsFallbackIcon.blue{ color:#1d4ed8; }

        .arsEmpty{
          border:1px dashed #d9e5ee;
          border-radius:20px;
          padding:28px 18px;
          text-align:center;
          background:linear-gradient(180deg,#fcfdff 0%,#f8fbfe 100%);
          color:#64748b;
        }

        .arsEmptyIcon{
          width:52px;
          height:52px;
          border-radius:16px;
          margin:0 auto 10px auto;
          display:grid;
          place-items:center;
          background:#eef6fb;
          color:#4f6b7c;
        }

        .arsEmptyTitle{
          font-size:15px;
          font-weight:900;
          color:#1e293b;
        }

        .arsEmptySub{
          margin-top:6px;
          font-size:13px;
          color:#64748b;
        }

        .arsModalBackdrop{
          position:fixed;
          inset:0;
          background:rgba(2,6,23,.55);
          backdrop-filter:blur(6px);
          display:grid;
          place-items:center;
          z-index:2000;
          padding:20px;
        }

        .arsModalCard{
          position:relative;
          width:min(720px, 100%);
          border-radius:28px;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          border:1px solid #e4edf4;
          box-shadow:0 28px 60px rgba(15,23,42,.22);
          padding:22px;
        }

        .arsModalClose{
          position:absolute;
          top:14px;
          right:14px;
          width:38px;
          height:38px;
          border:none;
          border-radius:999px;
          background:#f8fafc;
          border:1px solid #e2e8f0;
          cursor:pointer;
          display:grid;
          place-items:center;
          color:#475569;
        }

        .arsModalTop{
          display:flex;
          gap:16px;
          align-items:flex-start;
          padding-right:40px;
        }

        .arsModalBadge{
          display:inline-flex;
          align-items:center;
          gap:6px;
          padding:6px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.06em;
        }

        .arsModalBadge.green{
          background:rgba(34,197,94,.10);
          color:#166534;
          border:1px solid rgba(34,197,94,.16);
        }
        .arsModalBadge.amber{
          background:rgba(245,158,11,.12);
          color:#92400e;
          border:1px solid rgba(245,158,11,.16);
        }
        .arsModalBadge.purple{
          background:rgba(168,85,247,.12);
          color:#6b21a8;
          border:1px solid rgba(168,85,247,.16);
        }
        .arsModalBadge.blue{
          background:rgba(59,130,246,.12);
          color:#1d4ed8;
          border:1px solid rgba(59,130,246,.16);
        }

        .arsModalTitle{
          margin-top:10px;
          font-size:24px;
          line-height:1.15;
          font-weight:1000;
          color:#0f172a;
          letter-spacing:-.02em;
        }

        .arsModalMeta{
          margin-top:8px;
          font-size:14px;
          color:#64748b;
          font-weight:700;
          line-height:1.5;
        }

        .arsModalGrid{
          margin-top:18px;
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        .arsModalInfo{
          border:1px solid #e6edf4;
          border-radius:18px;
          padding:14px;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
        }

        .arsModalInfoLabel{
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.08em;
          font-weight:900;
          color:#64748b;
        }

        .arsModalInfoValue{
          margin-top:8px;
          font-size:15px;
          font-weight:900;
          color:#0f172a;
          word-break:break-word;
        }

        .arsRequirementCard{
          margin-top:16px;
          border:1px solid #e6edf4;
          border-radius:22px;
          padding:16px;
          background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
        }

        .arsRequirementLabel{
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.08em;
          font-weight:900;
          color:#64748b;
        }

        .arsRequirementText{
          margin-top:10px;
          font-size:14px;
          line-height:1.65;
          color:#334155;
          font-weight:700;
          word-break:break-word;
        }

        @media (max-width: 980px){
          .arsHeroInner{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 760px){
          .arsHeroStats,
          .arsRecentStrip,
          .arsLegendGrid,
          .arsModalGrid{
            grid-template-columns:1fr 1fr;
          }

          .arsLegendPopover{
            width:300px;
          }
        }

        @media (max-width: 560px){
          .arsHeroStats,
          .arsRecentStrip,
          .arsLegendGrid,
          .arsModalGrid{
            grid-template-columns:1fr;
          }

          .arsStatValue{
            font-size:28px;
          }

          .arsLegendPopover{
            width:280px;
            right:-10px;
          }

          .arsModalTop{
            flex-direction:column;
          }
        }
      `}</style>

      <div className="arsRoot">
        <div className="arsHero">
          <div className="arsHeroInner">
            <div className="arsHeroLeft">
              <div className="arsKicker">Studio Recognition</div>
              <div className="arsTitle">Recognition Summary</div>
              <div className="arsSub">
                A compact view of awards, trophies, contributor recognition, and the most recent highlights.
              </div>

              <div className="arsTopMeta">
                <Pill
                  icon="calendar_month"
                  text={weekStart ? `Week of ${fmtWeekLabel(weekStart)}` : "All available data"}
                  tone="grey"
                />
                <Pill
                  icon="military_tech"
                  text={`${safeNum(totals.achievements)} achievements`}
                  tone="green"
                />
                <Pill
                  icon="emoji_events"
                  text={`${safeNum(totals.trophies)} trophies`}
                  tone="amber"
                />
              </div>
            </div>

            <div className="arsSummaryCard">
              <div className="arsSummaryKicker">Metrics Summary</div>
              <div className="arsSummaryTitle">{heroSummary.title}</div>
              <div className="arsSummaryText">{heroSummary.body}</div>

              <div className="arsSummaryBullets">
                {heroSummary.bullets.map((line, idx) => (
                  <div key={idx} className="arsSummaryBullet">
                    <i className="material-icons">check_circle</i>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="arsHeroStats">
          <StatCard icon="groups" label="Contributors" value={safeNum(totals.users)} />
          <StatCard icon="auto_awesome" label="Recognition" value={awardCount} />
          <StatCard icon="military_tech" label="Achievements" value={safeNum(totals.achievements)} />
          <StatCard icon="emoji_events" label="Trophies" value={safeNum(totals.trophies)} />
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              icon="hourglass_top"
              title="Loading recognition summary…"
              subtitle="Fetching studio recognition metrics."
            />
          </div>
        ) : error ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              icon="error_outline"
              title={error}
              subtitle="Check the awards summary API wiring."
            />
          </div>
        ) : (
          <div className="arsBody">
            <div className="arsStack">
              <section className="arsCard">
                <div className="arsCardHead">
                  <div>
                    <div className="arsCardTitle">Recognition Strip</div>
                    <div className="arsCardSub">
                      Recent recognition cards. Hover the info icon for award tier legend.
                    </div>
                  </div>

                  <div className="arsToolbar">
                    <div className="arsLegendWrap">
                      <button type="button" className="arsLegendBtn" aria-label="Award tier legend">
                        <i className="material-icons">info</i>
                      </button>

                      <div className="arsLegendPopover">
                        <div className="arsLegendTitle">Award Tier Legend</div>
                        <div className="arsLegendSub">
                          Click any tier to view requirement details.
                        </div>

                        <div className="arsLegendGrid">
                          {BADGE_LEGEND.map((entry) => (
                            <button
                              key={entry.key}
                              type="button"
                              className="arsLegendItem"
                              title={entry.requirement}
                              onClick={() => openLegendDetails(entry)}
                            >
                              <BadgeIcon badge={entry.key} size={56} />
                              <div className="arsLegendLabel">{entry.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <select
                      className="arsSelect"
                      value={weekStart}
                      onChange={(e) => setWeekStart(e.target.value)}
                    >
                      <option value="">All Time</option>
                      <option value="2026-03-09">2026-03-09</option>
                      <option value="2026-03-02">2026-03-02</option>
                      <option value="2026-02-23">2026-02-23</option>
                      <option value="2026-02-16">2026-02-16</option>
                    </select>
                  </div>
                </div>

                <div className="arsCardBody">
                  {!recentStrip.length ? (
                    <EmptyState
                      icon="history"
                      title="No recent activity."
                      subtitle="Recent recognition cards will appear here."
                    />
                  ) : (
                    <div className="arsRecentStrip">
                      {recentStrip.map((item, idx) => (
                        <button
                          key={`${safeStr(item.id) || idx}-mini`}
                          type="button"
                          className="arsRecentMini"
                          onClick={() => setSelectedAward(item)}
                        >
                          <div className="arsRecentMiniTop">
                            <RecognitionIcon item={item} />
                            <div className="arsMiniStamp">
                              {fmtShortDate(safeStr(item.awardedAt || item.at))}
                            </div>
                          </div>

                          <div className="arsRecentMiniTitle">{getItemTitle(item)}</div>
                          <div className="arsRecentMiniMeta">
                            {getRecipientName(item) || "Unknown"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      <AwardDetailsModal item={selectedAward} onClose={() => setSelectedAward(null)} />
    </div>
  );
}
