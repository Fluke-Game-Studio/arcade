import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthContext";
import type { ApiUserProgress } from "../../api/types";

type TimelineItem = {
  id: string;
  at: string;
  icon: string;
  tone: "amber" | "green" | "purple";
  title: string;
  subtitle: string;
  meta?: string;
  imageUrl?: string;
};

type StatItem = {
  label: string;
  value: number | string;
  icon?: string;
};

type TimesheetEntry = {
  date: string;
  hours: number;
};

type UpdateSummary = {
  weekStart: string;
  totalEntries: number;
  totalHours: number;
  accomplishments: string[];
  blockers: string[];
  next: string[];
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
  timesheet: TimesheetEntry[];
};

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(v?: string) {
  if (!v) return "Unknown time";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneStyles(tone: TimelineItem["tone"]) {
  if (tone === "green") {
    return {
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.24)",
      color: "#166534",
      glow: "rgba(34,197,94,0.16)",
    };
  }
  if (tone === "amber") {
    return {
      bg: "rgba(245,158,11,0.14)",
      border: "rgba(245,158,11,0.24)",
      color: "#92400e",
      glow: "rgba(245,158,11,0.16)",
    };
  }
  return {
    bg: "rgba(147,51,234,0.12)",
    border: "rgba(147,51,234,0.24)",
    color: "#6b21a8",
    glow: "rgba(147,51,234,0.16)",
  };
}

function buildTimeline(progress: ApiUserProgress | null): TimelineItem[] {
  if (!progress) return [];

  const achievements = Array.isArray((progress as any).achievements)
    ? (progress as any).achievements
    : [];
  const trophies = Array.isArray((progress as any).trophies)
    ? (progress as any).trophies
    : [];
  const history = Array.isArray((progress as any).history) ? (progress as any).history : [];

  const items: TimelineItem[] = [];

  for (const a of achievements) {
    items.push({
      id: `ach_${safeStr((a as any).id)}_${safeStr((a as any).awardedAt) || Math.random()
        .toString(36)
        .slice(2)}`,
      at: safeStr((a as any).awardedAt),
      icon: "military_tech",
      tone: "green",
      title: safeStr((a as any).title || (a as any).id || "Achievement awarded"),
      subtitle: safeStr((a as any).description || "Achievement unlocked"),
      meta: safeStr((a as any).awardedBy)
        ? `Awarded by ${safeStr((a as any).awardedBy)}`
        : "System awarded",
    });
  }

  for (const t of trophies) {
    items.push({
      id: `tro_${safeStr((t as any).id)}_${safeStr((t as any).awardedAt) || Math.random()
        .toString(36)
        .slice(2)}`,
      at: safeStr((t as any).awardedAt),
      icon: "emoji_events",
      tone: "amber",
      title: safeStr((t as any).title || (t as any).id || "Trophy awarded"),
      subtitle: safeStr(
        (t as any).description || `${safeStr((t as any).tier || "bronze")} trophy unlocked`
      ),
      meta: safeStr((t as any).awardedBy)
        ? `Awarded by ${safeStr((t as any).awardedBy)}`
        : "System awarded",
      imageUrl: safeStr((t as any).imageUrl),
    });
  }

  for (const h of history) {
    const type = safeStr((h as any).type).toLowerCase();
    if (type.includes("weekly_mvp")) {
      items.push({
        id: safeStr((h as any).id) || `mvp_${Math.random().toString(36).slice(2)}`,
        at: safeStr((h as any).at),
        icon: "workspace_premium",
        tone: "purple",
        title: "Weekly MVP",
        subtitle: (h as any).weekStart
          ? `Week of ${safeStr((h as any).weekStart)}`
          : "Weekly MVP awarded",
        meta: (h as any).score
          ? `Score: ${safeStr((h as any).score)}`
          : (h as any).by
          ? `Assigned by ${safeStr((h as any).by)}`
          : "",
      });
    }
  }

  return items.sort((a, b) => {
    const da = new Date(a.at || 0).getTime();
    const db = new Date(b.at || 0).getTime();
    return db - da;
  });
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: string;
}) {
  return (
    <div className="agStatCard">
      <div className="agStatTop">
        <div className="agStatLabel">{label}</div>
        {!!icon && (
          <span className="agStatIcon">
            <i className="material-icons">{icon}</i>
          </span>
        )}
      </div>
      <div className="agStatValue">{value}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <section className="agSectionCard">
      <div className="agSectionHead">
        <div className="agSectionHeadLeft">
          {!!icon && (
            <span className="agSectionIcon">
              <i className="material-icons">{icon}</i>
            </span>
          )}
          <div>
            <div className="agSectionTitle">{title}</div>
            {!!subtitle && <div className="agSectionSub">{subtitle}</div>}
          </div>
        </div>
      </div>
      <div className="agSectionBody">{children}</div>
    </section>
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
    <div className="agEmpty">
      <div className="agEmptyIcon">
        <i className="material-icons">{icon}</i>
      </div>
      <div className="agEmptyTitle">{title}</div>
      {!!subtitle && <div className="agEmptySub">{subtitle}</div>}
    </div>
  );
}

function HeroChip({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="agHeroChip">
      <div className="agHeroChipLabel">{label}</div>
      <div className="agHeroChipValue">{value}</div>
    </div>
  );
}

function extractSummaries(resp: any): any[] {
  if (!resp) return [];

  if (Array.isArray(resp?.summaries)) return resp.summaries;
  if (resp?.data && Array.isArray(resp.data.summaries)) return resp.data.summaries;

  if (resp.body) {
    try {
      const parsed = typeof resp.body === "string" ? JSON.parse(resp.body) : resp.body;
      return extractSummaries(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeSummary(x: any): UpdateSummary {
  return {
    weekStart: safeStr(
      x?.weekStart || x?.weekOf || x?.week_start || x?.week || x?.weekLabel
    ),
    totalEntries: safeNum(x?.totalEntries),
    totalHours: safeNum(x?.totalHours),
    accomplishments: Array.isArray(x?.accomplishments)
      ? x.accomplishments.map((v: any) => safeStr(v)).filter(Boolean)
      : [],
    blockers: Array.isArray(x?.blockers)
      ? x.blockers.map((v: any) => safeStr(v)).filter(Boolean)
      : [],
    next: Array.isArray(x?.next)
      ? x.next.map((v: any) => safeStr(v)).filter(Boolean)
      : [],
    retrospective: {
      worked: Array.isArray(x?.retrospective?.worked)
        ? x.retrospective.worked.map((v: any) => safeStr(v)).filter(Boolean)
        : [],
      didnt: Array.isArray(x?.retrospective?.didnt)
        ? x.retrospective.didnt.map((v: any) => safeStr(v)).filter(Boolean)
        : [],
      improve: Array.isArray(x?.retrospective?.improve)
        ? x.retrospective.improve.map((v: any) => safeStr(v)).filter(Boolean)
        : [],
    },
    timesheet: Array.isArray(x?.timesheet)
      ? x.timesheet
          .map((t: any) => ({
            date: safeStr(t?.date || t?.day || t?.workDate),
            hours: safeNum(t?.hours || t?.time || t?.value),
          }))
          .filter((t: TimesheetEntry) => t.date || t.hours)
      : [],
  };
}

function buildFallbackStatsFromUpdates(weeks: UpdateSummary[]) {
  const uniqueDays = new Set<string>();

  let totalHoursLogged = 0;
  let weeklySubmissions = 0;
  let timesheetSubmissions = 0;
  let retroSubmissions = 0;

  for (const week of weeks) {
    totalHoursLogged += safeNum(week.totalHours);

    if (safeNum(week.totalEntries) > 0) {
      weeklySubmissions += safeNum(week.totalEntries);
    }

    if (Array.isArray(week.timesheet) && week.timesheet.length > 0) {
      for (const t of week.timesheet) {
        const day = safeStr(t.date);
        if (day) uniqueDays.add(day);
      }
      timesheetSubmissions += 1;
    }

    const retro =
      (week.retrospective?.worked?.length || 0) +
      (week.retrospective?.didnt?.length || 0) +
      (week.retrospective?.improve?.length || 0);

    if (retro > 0) {
      retroSubmissions += 1;
    }
  }

  return {
    totalHoursLogged,
    weeklySubmissions,
    timesheetSubmissions,
    retroSubmissions,
    daysWithHoursLogged: uniqueDays.size,
  };
}

function coalesceStat(primary: unknown, fallback: unknown) {
  const p = safeNum(primary);
  if (p > 0) return p;
  return safeNum(fallback);
}

export default function AccountGamification() {
  const { api, user } = useAuth();
  const [progress, setProgress] = useState<ApiUserProgress | null>(null);
  const [updateWeeks, setUpdateWeeks] = useState<UpdateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const username =
    safeStr((user as any)?.username) ||
    safeStr((user as any)?.employee_email) ||
    safeStr((user as any)?.email);

  async function loadData() {
    if (!username) {
      setProgress(null);
      setUpdateWeeks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [progressResp, updatesResp] = await Promise.allSettled([
        typeof api?.getProgressAdmin === "function"
          ? api.getProgressAdmin(username)
          : Promise.resolve(null),
        typeof api?.getMyUpdates === "function" ? api.getMyUpdates() : Promise.resolve(null),
      ]);

      let nextProgress: ApiUserProgress | null = null;
      let nextWeeks: UpdateSummary[] = [];

      if (progressResp.status === "fulfilled") {
        nextProgress = (progressResp.value as any)?.progress || null;
      }

      if (updatesResp.status === "fulfilled") {
        const extracted = extractSummaries(updatesResp.value);
        nextWeeks = extracted
          .map(normalizeSummary)
          .filter((x) => x.weekStart || x.totalEntries || x.totalHours || x.timesheet.length)
          .sort((a, b) => String(b.weekStart || "").localeCompare(String(a.weekStart || "")));
      }

      setProgress(nextProgress);
      setUpdateWeeks(nextWeeks);

      if (!nextProgress && progressResp.status === "rejected") {
        throw progressResp.reason;
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load gamification.");
      setProgress(null);
      setUpdateWeeks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [username]);

  const timeline = useMemo(() => buildTimeline(progress), [progress]);
  const stats = (progress as any)?.stats || {};
  const fallbackStats = useMemo(() => buildFallbackStatsFromUpdates(updateWeeks), [updateWeeks]);

  const resolvedStats = useMemo(
    () => ({
      loginCount: safeNum((stats as any).loginCount),
      loginDaysCount: safeNum((stats as any).loginDaysCount),
      fileUploads: safeNum((stats as any).fileUploads),
      featureCompletions: safeNum((stats as any).featureCompletions),
      weeklySubmissions: coalesceStat(
        (stats as any).weeklySubmissions,
        fallbackStats.weeklySubmissions
      ),
      timesheetSubmissions: coalesceStat(
        (stats as any).timesheetSubmissions,
        fallbackStats.timesheetSubmissions
      ),
      retroSubmissions: coalesceStat(
        (stats as any).retroSubmissions,
        fallbackStats.retroSubmissions
      ),
      totalHoursLogged: coalesceStat(
        (stats as any).totalHoursLogged,
        fallbackStats.totalHoursLogged
      ),
      daysWithHoursLogged: coalesceStat(
        (stats as any).daysWithHoursLogged,
        fallbackStats.daysWithHoursLogged
      ),
    }),
    [stats, fallbackStats]
  );

  const statItems = useMemo<StatItem[]>(
    () => [
      {
        label: "Achievements",
        value: (progress as any)?.achievements?.length || 0,
        icon: "military_tech",
      },
      {
        label: "Trophies",
        value: (progress as any)?.trophies?.length || 0,
        icon: "emoji_events",
      },
      {
        label: "Login Count",
        value: resolvedStats.loginCount,
        icon: "login",
      },
      {
        label: "Login Days",
        value: resolvedStats.loginDaysCount,
        icon: "event_available",
      },
      {
        label: "File Uploads",
        value: resolvedStats.fileUploads,
        icon: "upload_file",
      },
      {
        label: "Feature Completions",
        value: resolvedStats.featureCompletions,
        icon: "task_alt",
      },
      {
        label: "Weekly Submissions",
        value: resolvedStats.weeklySubmissions,
        icon: "view_week",
      },
      {
        label: "Timesheet Weeks",
        value: resolvedStats.timesheetSubmissions,
        icon: "schedule",
      },
      {
        label: "Retro Weeks",
        value: resolvedStats.retroSubmissions,
        icon: "history_edu",
      },
      {
        label: "Hours Logged",
        value: resolvedStats.totalHoursLogged,
        icon: "hourglass_bottom",
      },
      {
        label: "Days Worked",
        value: resolvedStats.daysWithHoursLogged,
        icon: "calendar_month",
      },
    ],
    [progress, resolvedStats]
  );

  return (
    <div className="agWrap">
      <style>{`
        .agWrap{
          margin-top:14px;
        }

        .agRootCard{
          border-radius:26px;
          overflow:hidden;
          border:1px solid #e6edf4;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow:0 18px 42px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .agHero{
          position:relative;
          overflow:hidden;
          border-bottom:1px solid #e9eef5;
          background:
            radial-gradient(760px 260px at 10% -10%, rgba(56,189,248,0.18), transparent 58%),
            radial-gradient(680px 240px at 100% 0%, rgba(99,102,241,0.14), transparent 55%),
            linear-gradient(135deg, #071a33 0%, #0b2544 58%, #102a52 100%);
          color:#fff;
        }

        .agHeroInner{
          position:relative;
          z-index:1;
          padding:20px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          flex-wrap:wrap;
        }

        .agHeroContent{
          min-width:0;
        }

        .agKicker{
          font-size:11px;
          font-weight:900;
          letter-spacing:0.16em;
          text-transform:uppercase;
          color:rgba(191,219,254,0.82);
          margin-bottom:6px;
        }

        .agHeroTitle{
          font-size:24px;
          line-height:1.1;
          font-weight:1000;
          letter-spacing:-0.02em;
          color:#fff;
        }

        .agHeroSub{
          margin-top:7px;
          color:rgba(226,232,240,0.84);
          font-size:13px;
        }

        .agHeroStats{
          display:grid;
          grid-template-columns:repeat(3, minmax(110px, 1fr));
          gap:10px;
        }

        .agHeroChip{
          min-width:110px;
          border-radius:18px;
          border:1px solid rgba(255,255,255,0.12);
          background:rgba(255,255,255,0.08);
          backdrop-filter:blur(10px);
          box-shadow:inset 0 1px 0 rgba(255,255,255,0.08);
          padding:12px 14px;
        }

        .agHeroChipLabel{
          font-size:11px;
          font-weight:900;
          letter-spacing:0.08em;
          text-transform:uppercase;
          color:rgba(191,219,254,0.82);
        }

        .agHeroChipValue{
          margin-top:7px;
          font-size:22px;
          line-height:1;
          font-weight:1000;
          color:#fff;
        }

        .agContent{
          padding:16px;
          display:grid;
          gap:16px;
        }

        .agStateWrap{
          padding:4px 0;
        }

        .agEmpty{
          border:1px dashed #d9e5ee;
          border-radius:20px;
          padding:28px 18px;
          text-align:center;
          background:linear-gradient(180deg, #fcfdff 0%, #f8fbfe 100%);
          color:#64748b;
        }

        .agEmptyIcon{
          width:52px;
          height:52px;
          border-radius:16px;
          margin:0 auto 10px auto;
          display:grid;
          place-items:center;
          background:#eef6fb;
          color:#4f6b7c;
        }

        .agEmptyTitle{
          font-size:15px;
          font-weight:900;
          color:#1e293b;
        }

        .agEmptySub{
          margin-top:6px;
          font-size:13px;
          color:#64748b;
        }

        .agSectionCard{
          border-radius:22px;
          border:1px solid #e6edf4;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow:0 16px 34px rgba(15,23,42,0.05), inset 0 1px 0 rgba(255,255,255,0.8);
          overflow:hidden;
        }

        .agSectionHead{
          padding:16px 16px 0 16px;
        }

        .agSectionHeadLeft{
          display:flex;
          align-items:flex-start;
          gap:12px;
        }

        .agSectionIcon{
          width:38px;
          height:38px;
          flex:0 0 auto;
          border-radius:12px;
          display:grid;
          place-items:center;
          background:linear-gradient(180deg, #eff6ff 0%, #f5faff 100%);
          color:#2563eb;
          border:1px solid #dbeafe;
        }

        .agSectionTitle{
          font-size:17px;
          line-height:1.2;
          font-weight:950;
          color:#0f172a;
          letter-spacing:-0.01em;
        }

        .agSectionSub{
          margin-top:4px;
          font-size:12.5px;
          color:#64748b;
          line-height:1.45;
        }

        .agSectionBody{
          padding:16px;
        }

        .agStatsGrid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(185px, 1fr));
          gap:12px;
        }

        .agStatCard{
          border-radius:18px;
          padding:14px;
          border:1px solid #e4edf4;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow:0 10px 26px rgba(15,23,42,0.05);
        }

        .agStatTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }

        .agStatLabel{
          font-size:12px;
          color:#64748b;
          font-weight:900;
          letter-spacing:0.04em;
          text-transform:uppercase;
        }

        .agStatIcon{
          width:30px;
          height:30px;
          border-radius:10px;
          display:grid;
          place-items:center;
          background:#f4f8fb;
          color:#5c7283;
          border:1px solid #e2ebf3;
        }

        .agStatIcon i{
          font-size:17px;
        }

        .agStatValue{
          margin-top:10px;
          font-size:30px;
          line-height:1;
          font-weight:1000;
          color:#0f172a;
          letter-spacing:-0.03em;
        }

        .agTimelineWrap{
          position:relative;
          padding-left:18px;
        }

        .agTimelineRail{
          position:absolute;
          left:28px;
          top:0;
          bottom:0;
          width:2px;
          background:linear-gradient(180deg, #dbe7f0 0%, #eef4f8 100%);
        }

        .agTimelineList{
          display:grid;
          gap:14px;
        }

        .agTimelineRow{
          position:relative;
          display:grid;
          grid-template-columns:56px 1fr;
          gap:14px;
          align-items:start;
        }

        .agTimelineDot{
          position:relative;
          z-index:1;
          width:30px;
          height:30px;
          margin-top:14px;
          margin-left:-4px;
          border-radius:999px;
          display:grid;
          place-items:center;
          box-shadow:0 0 0 7px rgba(255,255,255,0.85);
        }

        .agTimelineDot i{
          font-size:16px;
        }

        .agTimelineCard{
          border:1px solid #e3edf4;
          border-radius:18px;
          background:#fff;
          padding:16px;
          box-shadow:0 10px 28px rgba(15,23,42,0.06);
        }

        .agTimelineTop{
          display:flex;
          justify-content:space-between;
          gap:12px;
          align-items:flex-start;
          flex-wrap:wrap;
        }

        .agTimelineTitle{
          font-weight:950;
          font-size:16px;
          color:#1f2d3a;
          line-height:1.2;
        }

        .agTimelineSub{
          color:#516270;
          font-weight:700;
          margin-top:4px;
          line-height:1.45;
        }

        .agTimelineStamp{
          border-radius:999px;
          padding:6px 10px;
          font-size:12px;
          font-weight:900;
          white-space:nowrap;
        }

        .agTimelineMeta{
          margin-top:10px;
          color:#78909c;
          font-weight:800;
          font-size:13px;
        }

        @media (max-width: 900px){
          .agHeroStats{
            grid-template-columns:repeat(3, minmax(100px, 1fr));
            width:100%;
          }
        }

        @media (max-width: 640px){
          .agHeroInner{
            padding:16px;
          }

          .agHeroTitle{
            font-size:20px;
          }

          .agHeroStats{
            grid-template-columns:1fr;
          }

          .agContent{
            padding:12px;
          }

          .agStatsGrid{
            grid-template-columns:1fr;
          }

          .agTimelineRow{
            grid-template-columns:40px 1fr;
            gap:10px;
          }

          .agTimelineRail{
            left:20px;
          }

          .agTimelineDot{
            width:24px;
            height:24px;
            margin-top:16px;
            margin-left:0;
          }

          .agTimelineDot i{
            font-size:13px;
          }
        }
      `}</style>

      <div className="agRootCard">
        <div className="agHero">
          <div className="agHeroInner">
            <div className="agHeroContent">
              <div className="agKicker">Personal Progress</div>
              <div className="agHeroTitle">Achievements & Progress</div>
              <div className="agHeroSub">
                Your gamification snapshot, activity stats, and earned awards timeline.
              </div>
            </div>

            <div className="agHeroStats">
              <HeroChip label="Achievements" value={(progress as any)?.achievements?.length || 0} />
              <HeroChip label="Trophies" value={(progress as any)?.trophies?.length || 0} />
              <HeroChip label="Moments" value={timeline.length} />
            </div>
          </div>
        </div>

        <div className="agContent">
          {loading ? (
            <div className="agStateWrap">
              <EmptyState
                icon="hourglass_top"
                title="Loading your achievements…"
                subtitle="Fetching your latest progress snapshot."
              />
            </div>
          ) : error ? (
            <div className="agStateWrap">
              <EmptyState icon="error_outline" title={error} subtitle="Please try again later." />
            </div>
          ) : (
            <>
              <SectionCard
                title="Current Progress Snapshot"
                subtitle="A quick view of your participation, consistency, and earned milestones."
                icon="analytics"
              >
                <div className="agStatsGrid">
                  {statItems.map((item) => (
                    <MetricCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      icon={item.icon}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Earned Awards Timeline"
                subtitle="A chronological feed of achievements, trophies, and MVP recognition."
                icon="timeline"
              >
                {!timeline.length ? (
                  <EmptyState
                    icon="emoji_events"
                    title="No earned awards yet."
                    subtitle="Your future achievements and trophies will appear here."
                  />
                ) : (
                  <div className="agTimelineWrap">
                    <div className="agTimelineRail" />

                    <div className="agTimelineList">
                      {timeline.map((item) => {
                        const tone = toneStyles(item.tone);

                        return (
                          <div key={item.id} className="agTimelineRow">
                            <div
                              className="agTimelineDot"
                              style={{
                                border: `2px solid ${tone.border}`,
                                background: tone.bg,
                                color: tone.color,
                                boxShadow: `0 0 0 7px rgba(255,255,255,0.85), 0 8px 20px ${tone.glow}`,
                              }}
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt=""
                                  aria-hidden="true"
                                  style={{
                                    width: "84%",
                                    height: "84%",
                                    objectFit: "contain",
                                    display: "block",
                                  }}
                                />
                              ) : (
                                <i className="material-icons">{item.icon}</i>
                              )}
                            </div>

                            <div className="agTimelineCard">
                              <div className="agTimelineTop">
                                <div>
                                  <div className="agTimelineTitle">{item.title}</div>
                                  <div className="agTimelineSub">{item.subtitle}</div>
                                </div>

                                <span
                                  className="agTimelineStamp"
                                  style={{
                                    background: tone.bg,
                                    border: `1px solid ${tone.border}`,
                                    color: tone.color,
                                  }}
                                >
                                  {fmtDate(item.at)}
                                </span>
                              </div>

                              {!!item.meta && (
                                <div className="agTimelineMeta">{item.meta}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
