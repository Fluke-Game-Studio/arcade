// src/components/account/AccountMyUpdates.tsx
import { useEffect, useMemo, useState } from "react";

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDateTime(v: any) {
  const s = safeStr(v);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekdayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
  });
}

type TimesheetEntry = {
  date: string;
  hours: number;
};

type UpdateSummary = {
  userId?: string;
  userName?: string;
  employee_id?: string;
  employee_manager?: string;
  projectId?: string;
  weekStart: string;
  createdAtFirst?: string;
  createdAtLast?: string;
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

function Pill({
  icon,
  text,
  tone = "neutral",
}: {
  icon: string;
  text: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "grey";
}) {
  return (
    <span className={`amuPill ${tone}`}>
      <i className="material-icons">{icon}</i>
      {text}
    </span>
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
    userId: safeStr(x?.userId || x?.employeeId || x?.username),
    userName: safeStr(x?.userName || x?.employee_name || x?.name),
    employee_id: safeStr(x?.employee_id),
    employee_manager: safeStr(x?.employee_manager),
    projectId: safeStr(x?.projectId || x?.project_id),
    weekStart: safeStr(
      x?.weekStart || x?.weekOf || x?.week_start || x?.week || x?.weekLabel
    ),
    createdAtFirst: safeStr(x?.createdAtFirst),
    createdAtLast: safeStr(x?.createdAtLast),
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

function EmptyState({ text }: { text: string }) {
  return <div className="amuEmpty">{text}</div>;
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="amuStatChip">
      <div className="amuStatIcon">
        <i className="material-icons">{icon}</i>
      </div>
      <div className="amuStatText">
        <div className="amuStatLabel">{label}</div>
        <div className="amuStatValue">{value}</div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  items,
  tone = "blue",
}: {
  title: string;
  items: string[];
  tone?: "blue" | "amber" | "green";
}) {
  const toneClass =
    tone === "amber" ? "amber" : tone === "green" ? "green" : "blue";

  return (
    <div className={`amuSectionCard ${toneClass}`}>
      <div className="amuSectionHead">
        <div className="amuSectionTitle">{title}</div>
        <span className="amuCountBubble">{items.length}</span>
      </div>

      {!items.length ? (
        <div className="amuSectionEmpty">Nothing added</div>
      ) : (
        <div className="amuBulletList">
          {items.slice(0, 4).map((item, idx) => (
            <div key={`${title}-${idx}`} className="amuBulletItem" title={item}>
              <span className="amuBulletDot" />
              <span>{item}</span>
            </div>
          ))}
          {items.length > 4 && (
            <div className="amuMoreText">+{items.length - 4} more</div>
          )}
        </div>
      )}
    </div>
  );
}

function RetroMini({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="amuRetroMini">
      <div className="amuRetroTitle">{title}</div>
      <div className="amuRetroCount">{items.length}</div>
    </div>
  );
}

export default function AccountMyUpdates({ api }: { api: any }) {
  const apiAny = api as any;

  const [weeks, setWeeks] = useState<UpdateSummary[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [updatesError, setUpdatesError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoadingUpdates(true);
        setUpdatesError("");

        if (typeof apiAny.getMyUpdates !== "function") {
          if (mounted) {
            setWeeks([]);
            setUpdatesError("getMyUpdates() is not wired in the API client yet.");
          }
          return;
        }

        const resp = await apiAny.getMyUpdates();
        if (!mounted) return;

        const extracted = extractSummaries(resp);

        const normalized = extracted
          .map(normalizeSummary)
          .filter((x) => x.weekStart || x.totalEntries || x.totalHours || x.timesheet.length)
          .sort((a, b) => String(b.weekStart || "").localeCompare(String(a.weekStart || "")));

        setWeeks(normalized);

        if (normalized.length) {
          setSelectedWeek((prev) =>
            normalized.some((w) => w.weekStart === prev) ? prev : normalized[0].weekStart
          );
        } else {
          setSelectedWeek("");
        }
      } catch (err: any) {
        if (!mounted) return;
        setUpdatesError(err?.message || "Failed to load your updates.");
      } finally {
        if (mounted) setLoadingUpdates(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [apiAny, api]);

  const sortedWeeks = useMemo(() => {
    return [...weeks].sort((a, b) =>
      String(b.weekStart || "").localeCompare(String(a.weekStart || ""))
    );
  }, [weeks]);

  const currentWeek = useMemo(() => {
    return sortedWeeks.find((w) => w.weekStart === selectedWeek) || sortedWeeks[0] || null;
  }, [sortedWeeks, selectedWeek]);

  const totalHoursAll = useMemo(
    () => sortedWeeks.reduce((sum, w) => sum + safeNum(w.totalHours), 0),
    [sortedWeeks]
  );

  const totalEntriesAll = useMemo(
    () => sortedWeeks.reduce((sum, w) => sum + safeNum(w.totalEntries), 0),
    [sortedWeeks]
  );

  return (
    <div className="card z-depth-1 panelCard" style={{ marginTop: 14, overflow: "hidden" }}>
      <style>{`
        .amuWrap{
          display:grid;
          grid-template-columns: 300px minmax(0,1fr);
          min-height: 520px;
        }

        .amuSidebar{
          border-right:1px solid #e8eef3;
          background:
            linear-gradient(180deg, #fbfdff 0%, #f7fafc 100%);
          padding:16px;
        }

        .amuMain{
          background:linear-gradient(180deg, #ffffff 0%, #fcfdff 100%);
          padding:16px;
        }

        .amuTopStats{
          display:grid;
          grid-template-columns:1fr;
          gap:10px;
          margin-bottom:14px;
        }

        .amuStatChip{
          display:flex;
          align-items:center;
          gap:12px;
          border:1px solid #e6edf2;
          border-radius:16px;
          padding:12px;
          background:#fff;
          box-shadow:0 8px 20px rgba(15,23,42,.05);
        }
        .amuStatIcon{
          width:42px;
          height:42px;
          border-radius:14px;
          display:grid;
          place-items:center;
          background:#f1f5f9;
          border:1px solid #e6edf2;
          flex:0 0 auto;
        }
        .amuStatIcon i{
          font-size:18px;
          color:#0f172a;
        }
        .amuStatLabel{
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.06em;
          color:#64748b;
        }
        .amuStatValue{
          margin-top:3px;
          font-size:18px;
          font-weight:1000;
          color:#0f172a;
        }

        .amuWeekList{
          display:flex;
          flex-direction:column;
          gap:10px;
          max-height:520px;
          overflow:auto;
          padding-right:4px;
        }

        .amuWeekBtn{
          width:100%;
          border:none;
          cursor:pointer;
          text-align:left;
          padding:14px;
          border-radius:18px;
          background:#fff;
          border:1px solid #e6edf2;
          box-shadow:0 8px 20px rgba(15,23,42,.04);
          transition:transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
        }
        .amuWeekBtn:hover{
          transform:translateY(-1px);
          box-shadow:0 14px 28px rgba(15,23,42,.08);
        }
        .amuWeekBtn.active{
          border-color:rgba(59,130,246,.24);
          background:
            linear-gradient(135deg, rgba(59,130,246,.08), rgba(255,255,255,1));
          box-shadow:0 14px 28px rgba(59,130,246,.10);
        }

        .amuWeekTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:10px;
        }
        .amuWeekTitle{
          font-weight:1000;
          color:#0f172a;
          font-size:14px;
        }
        .amuWeekSub{
          margin-top:4px;
          font-size:12px;
          color:#64748b;
          font-weight:700;
        }

        .amuTinyPill{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width:32px;
          height:28px;
          padding:0 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:900;
          color:#1d4ed8;
          background:rgba(59,130,246,.10);
          border:1px solid rgba(59,130,246,.14);
          flex:0 0 auto;
        }

        .amuWeekMeta{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        }

        .amuPill{
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:6px 10px;
          border-radius:999px;
          font-size:11px;
          font-weight:900;
          white-space:nowrap;
          border:1px solid #e6edf2;
          background:#fff;
          color:#334155;
        }
        .amuPill i{ font-size:15px; }
        .amuPill.blue{
          background:rgba(59,130,246,.10);
          border-color:rgba(59,130,246,.16);
          color:#1d4ed8;
        }
        .amuPill.green{
          background:rgba(34,197,94,.10);
          border-color:rgba(34,197,94,.16);
          color:#166534;
        }
        .amuPill.amber{
          background:rgba(245,158,11,.10);
          border-color:rgba(245,158,11,.16);
          color:#b45309;
        }
        .amuPill.grey{
          background:rgba(148,163,184,.10);
          border-color:rgba(148,163,184,.16);
          color:#475569;
        }

        .amuHero{
          border:1px solid #e6edf2;
          border-radius:22px;
          padding:18px;
          background:
            radial-gradient(800px 380px at 0% 0%, rgba(59,130,246,.07), transparent 45%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow:0 14px 34px rgba(15,23,42,.05);
        }

        .amuHeroTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }
        .amuHeroTitle{
          font-size:20px;
          font-weight:1000;
          color:#0f172a;
          letter-spacing:-.02em;
        }
        .amuHeroSub{
          margin-top:4px;
          color:#64748b;
          font-size:13px;
          font-weight:700;
        }

        .amuHeroStats{
          display:grid;
          grid-template-columns:repeat(3, minmax(120px, 1fr));
          gap:10px;
          margin-top:16px;
        }
        .amuHeroStat{
          border:1px solid #e6edf2;
          border-radius:16px;
          padding:12px;
          background:#fff;
        }
        .amuHeroStatK{
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.06em;
          color:#64748b;
        }
        .amuHeroStatV{
          margin-top:4px;
          font-size:24px;
          font-weight:1000;
          color:#0f172a;
        }

        .amuBodyGrid{
          display:grid;
          grid-template-columns:1.1fr .9fr;
          gap:14px;
          margin-top:14px;
        }

        .amuCard{
          border:1px solid #e6edf2;
          border-radius:20px;
          background:#fff;
          box-shadow:0 10px 24px rgba(15,23,42,.04);
          overflow:hidden;
        }
        .amuCardHead{
          padding:14px 16px;
          border-bottom:1px solid #eef2f7;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }
        .amuCardTitle{
          font-size:14px;
          font-weight:1000;
          color:#0f172a;
        }
        .amuCardSub{
          margin-top:2px;
          font-size:12px;
          color:#64748b;
          font-weight:700;
        }
        .amuCardBody{
          padding:16px;
        }

        .amuSectionGrid{
          display:grid;
          grid-template-columns:1fr;
          gap:12px;
        }

        .amuSectionCard{
          border-radius:16px;
          border:1px solid #e6edf2;
          background:#fff;
          padding:14px;
        }
        .amuSectionCard.blue{ background:linear-gradient(180deg, rgba(59,130,246,.05), #fff); }
        .amuSectionCard.amber{ background:linear-gradient(180deg, rgba(245,158,11,.06), #fff); }
        .amuSectionCard.green{ background:linear-gradient(180deg, rgba(34,197,94,.05), #fff); }

        .amuSectionHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          margin-bottom:10px;
        }
        .amuSectionTitle{
          font-size:12px;
          font-weight:1000;
          text-transform:uppercase;
          letter-spacing:.06em;
          color:#0f172a;
        }
        .amuCountBubble{
          min-width:28px;
          height:28px;
          padding:0 8px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius:999px;
          background:#eff6ff;
          color:#1d4ed8;
          font-size:12px;
          font-weight:1000;
        }
        .amuSectionEmpty{
          color:#94a3b8;
          font-size:12px;
          font-weight:700;
        }

        .amuBulletList{
          display:flex;
          flex-direction:column;
          gap:8px;
        }
        .amuBulletItem{
          display:flex;
          align-items:flex-start;
          gap:8px;
          color:#334155;
          font-size:13px;
          line-height:1.45;
        }
        .amuBulletDot{
          width:7px;
          height:7px;
          border-radius:999px;
          background:#60a5fa;
          margin-top:6px;
          flex:0 0 auto;
        }
        .amuMoreText{
          color:#64748b;
          font-size:12px;
          font-weight:800;
          margin-top:2px;
        }

        .amuTimesheetGrid{
          display:grid;
          grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
          gap:10px;
        }
        .amuHourCard{
          border:1px solid #e6edf2;
          border-radius:16px;
          padding:12px;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }
        .amuHourDay{
          font-size:12px;
          font-weight:800;
          color:#64748b;
        }
        .amuHourVal{
          margin-top:4px;
          font-size:18px;
          font-weight:1000;
          color:#0f172a;
        }

        .amuRetroGrid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:10px;
          margin-top:12px;
        }
        .amuRetroMini{
          border:1px solid #e6edf2;
          border-radius:16px;
          padding:12px;
          background:linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }
        .amuRetroTitle{
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.06em;
          color:#64748b;
        }
        .amuRetroCount{
          margin-top:6px;
          font-size:22px;
          font-weight:1000;
          color:#0f172a;
        }

        .amuMetaRow{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:12px;
        }

        .amuEmpty{
          padding:14px;
          border-radius:14px;
          border:1px dashed #d7e0e7;
          background:#fbfdff;
          color:#607d8b;
          font-weight:800;
        }

        @media (max-width: 980px){
          .amuWrap{
            grid-template-columns:1fr;
          }
          .amuSidebar{
            border-right:none;
            border-bottom:1px solid #e8eef3;
          }
          .amuBodyGrid{
            grid-template-columns:1fr;
          }
        }

        @media (max-width: 760px){
          .amuHeroStats{
            grid-template-columns:1fr;
          }
          .amuSectionGrid{
            grid-template-columns:1fr;
          }
          .amuRetroGrid{
            grid-template-columns:1fr;
          }
        }
      `}</style>

      <div className="panelHead">
        <div>
          <div className="h">My Updates</div>
          <div className="p">
            Cleaner weekly summaries with a sidebar selector and focused detail panel.
          </div>
        </div>
        <Pill icon="history" text={`${sortedWeeks.length} weeks`} tone="green" />
      </div>

      <div className="card-content" style={{ padding: 0 }}>
        {loadingUpdates ? (
          <div style={{ padding: 16 }}>
            <EmptyState text="Loading your updates…" />
          </div>
        ) : updatesError ? (
          <div style={{ padding: 16 }}>
            <EmptyState text={updatesError} />
          </div>
        ) : sortedWeeks.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState text="No updates submitted yet." />
          </div>
        ) : (
          <div className="amuWrap">
            <aside className="amuSidebar">
              <div className="amuTopStats">
                <StatChip icon="calendar_month" label="Weeks" value={sortedWeeks.length} />
                <StatChip icon="article" label="Entries" value={totalEntriesAll} />
                <StatChip icon="schedule" label="Total Hours" value={totalHoursAll.toFixed(1)} />
              </div>

              <div className="amuWeekList">
                {sortedWeeks.map((week) => {
                  const isActive = currentWeek?.weekStart === week.weekStart;

                  return (
                    <button
                      key={week.weekStart}
                      type="button"
                      className={`amuWeekBtn ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedWeek(week.weekStart)}
                    >
                      <div className="amuWeekTop">
                        <div>
                          <div className="amuWeekTitle">Week of {week.weekStart}</div>
                          <div className="amuWeekSub">
                            {week.totalEntries} submission{week.totalEntries !== 1 ? "s" : ""}
                          </div>
                        </div>

                        <span className="amuTinyPill">
                          {week.totalHours.toFixed(1)}h
                        </span>
                      </div>

                      <div className="amuWeekMeta">
                        <Pill icon="article" text={`${week.accomplishments.length} done`} tone="blue" />
                        <Pill icon="warning_amber" text={`${week.blockers.length} blockers`} tone="amber" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="amuMain">
              {currentWeek ? (
                <>
                  <div className="amuHero">
                    <div className="amuHeroTop">
                      <div>
                        <div className="amuHeroTitle">Week of {currentWeek.weekStart}</div>
                        <div className="amuHeroSub">
                          Consolidated view of all submissions made in this week
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Pill
                          icon="event"
                          text={
                            currentWeek.createdAtFirst
                              ? `First: ${fmtDateTime(currentWeek.createdAtFirst)}`
                              : "First: —"
                          }
                          tone="grey"
                        />
                        <Pill
                          icon="update"
                          text={
                            currentWeek.createdAtLast
                              ? `Last: ${fmtDateTime(currentWeek.createdAtLast)}`
                              : "Last: —"
                          }
                          tone="grey"
                        />
                      </div>
                    </div>

                    <div className="amuHeroStats">
                      <div className="amuHeroStat">
                        <div className="amuHeroStatK">Total Entries</div>
                        <div className="amuHeroStatV">{currentWeek.totalEntries}</div>
                      </div>
                      <div className="amuHeroStat">
                        <div className="amuHeroStatK">Total Hours</div>
                        <div className="amuHeroStatV">{currentWeek.totalHours.toFixed(1)}</div>
                      </div>
                      <div className="amuHeroStat">
                        <div className="amuHeroStatK">Timesheet Days</div>
                        <div className="amuHeroStatV">{currentWeek.timesheet.length}</div>
                      </div>
                    </div>
                  </div>

                  <div className="amuBodyGrid">
                    <div className="amuCard">
                      <div className="amuCardHead">
                        <div>
                          <div className="amuCardTitle">Weekly Summary</div>
                          <div className="amuCardSub">Core work, blockers, and next focus</div>
                        </div>
                      </div>

                      <div className="amuCardBody">
                        <div className="amuSectionGrid">
                          <SectionCard
                            title="Accomplishments"
                            items={currentWeek.accomplishments}
                            tone="blue"
                          />
                          <SectionCard
                            title="Blockers"
                            items={currentWeek.blockers}
                            tone="amber"
                          />
                          <SectionCard
                            title="Next"
                            items={currentWeek.next}
                            tone="green"
                          />
                        </div>

                        <div className="amuRetroGrid">
                          <RetroMini
                            title="Worked"
                            items={currentWeek.retrospective?.worked || []}
                          />
                          <RetroMini
                            title="Didn’t Work"
                            items={currentWeek.retrospective?.didnt || []}
                          />
                          <RetroMini
                            title="Improve"
                            items={currentWeek.retrospective?.improve || []}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="amuCard">
                      <div className="amuCardHead">
                        <div>
                          <div className="amuCardTitle">Day-wise Time</div>
                          <div className="amuCardSub">Logged hours broken down by day</div>
                        </div>
                        <Pill
                          icon="schedule"
                          text={`${currentWeek.totalHours.toFixed(1)}h`}
                          tone="blue"
                        />
                      </div>

                      <div className="amuCardBody">
                        {currentWeek.timesheet.length ? (
                          <div className="amuTimesheetGrid">
                            {currentWeek.timesheet.map((t, i) => (
                              <div key={`${currentWeek.weekStart}-${t.date}-${i}`} className="amuHourCard">
                                <div className="amuHourDay">{weekdayLabel(t.date)}</div>
                                <div className="amuHourVal">{safeNum(t.hours).toFixed(1)}h</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <EmptyState text="No time recorded for this week." />
                        )}

                        <div className="amuMetaRow">
                          <Pill
                            icon="article"
                            text={`${currentWeek.totalEntries} updates`}
                            tone="amber"
                          />
                          <Pill
                            icon="task_alt"
                            text={`${currentWeek.accomplishments.length} accomplishments`}
                            tone="green"
                          />
                          <Pill
                            icon="flag"
                            text={`${currentWeek.next.length} next items`}
                            tone="blue"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState text="Select a week from the left." />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}