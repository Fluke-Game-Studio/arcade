import { useEffect, useMemo, useState } from "react";

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
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
    <span className={"accPill " + tone}>
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
    totalEntries: Number(x?.totalEntries || 0) || 0,
    totalHours: Number(x?.totalHours || 0) || 0,
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
      ? x.timesheet.map((t: any) => ({
          date: safeStr(t?.date || t?.day || t?.workDate),
          hours: Number(t?.hours || t?.time || t?.value || 0) || 0,
        }))
      : [],
  };
}

function ListPopover({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 10px)",
        left: 0,
        width: 320,
        maxWidth: "min(320px, 75vw)",
        zIndex: 20,
        background: "rgba(255,255,255,.98)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(148,163,184,.18)",
        borderRadius: 16,
        boxShadow: "0 18px 50px rgba(15,23,42,.18)",
        padding: 12,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 10,
          letterSpacing: ".03em",
        }}
      >
        {title}
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
          No items
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                fontSize: 12,
                color: "#334155",
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                padding: "8px 10px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid rgba(148,163,184,.12)",
              }}
            >
              {idx + 1}. {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CountHover({
  title,
  items,
  tone = "blue",
}: {
  title: string;
  items: string[];
  tone?: "blue" | "amber" | "green" | "grey";
}) {
  const [open, setOpen] = useState(false);

  const toneStyles =
    tone === "amber"
      ? { bg: "rgba(245,158,11,.10)", color: "#b45309" }
      : tone === "green"
      ? { bg: "rgba(34,197,94,.10)", color: "#166534" }
      : tone === "grey"
      ? { bg: "rgba(148,163,184,.10)", color: "#64748b" }
      : { bg: "rgba(59,130,246,.10)", color: "#1d4ed8" };

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 42,
          padding: "7px 11px",
          borderRadius: 999,
          background: toneStyles.bg,
          color: toneStyles.color,
          fontWeight: 900,
          fontSize: 12,
          cursor: "default",
        }}
        title={`${items.length} item${items.length === 1 ? "" : "s"}`}
      >
        {items.length}
      </span>

      {open && <ListPopover title={title} items={items} />}
    </div>
  );
}

export default function AccountMyUpdates({ api }: { api: any }) {
  const apiAny = api as any;

  const [weeks, setWeeks] = useState<UpdateSummary[]>([]);
  const [loadingUpdates, setLoadingUpdates] = useState(true);
  const [updatesError, setUpdatesError] = useState("");
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

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
          .filter((x) => x.weekStart || x.totalEntries || x.totalHours || x.timesheet.length);

        setWeeks(normalized);

        setOpenWeeks((prev) => {
          const next: Record<string, boolean> = {};
          normalized.forEach((w, idx) => {
            next[w.weekStart] = prev[w.weekStart] ?? idx === 0;
          });
          return next;
        });
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

  function toggleWeek(weekStart: string) {
    setOpenWeeks((prev) => ({
      ...prev,
      [weekStart]: !prev[weekStart],
    }));
  }

  return (
    <div className="card z-depth-1 panelCard" style={{ marginTop: 14 }}>
      <div className="panelHead">
        <div>
          <div className="h">My Updates</div>
          <div className="p">
            One cumulative summary per week from all submissions made in that week.
          </div>
        </div>
        <Pill icon="history" text={`${sortedWeeks.length} weeks`} tone="green" />
      </div>

      <div className="card-content" style={{ padding: 16 }}>
        {loadingUpdates ? (
          <div className="emptyState">Loading your updates…</div>
        ) : updatesError ? (
          <div className="emptyState">{updatesError}</div>
        ) : sortedWeeks.length === 0 ? (
          <div className="emptyState">No updates submitted yet.</div>
        ) : (
          sortedWeeks.map((week) => {
            const isOpen = !!openWeeks[week.weekStart];

            return (
              <div key={week.weekStart} className="weekGroup">
                <div className="weekCard">
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.weekStart)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div className="weekHeader">
                      <div>
                        <div className="weekHeaderTitle">Week of {week.weekStart}</div>
                        <div className="weekHeaderSub">
                          {week.totalEntries} submission{week.totalEntries !== 1 ? "s" : ""} combined
                        </div>
                      </div>
                      <div
                        className="weekMeta"
                        style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
                      >
                        <Pill icon="schedule" text={`${week.totalHours.toFixed(1)}h`} tone="blue" />
                        <Pill icon="article" text={`${week.totalEntries} updates`} tone="amber" />
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 34,
                            height: 34,
                            borderRadius: 999,
                            background: "#eef2ff",
                            color: "#334155",
                          }}
                        >
                          <i className="material-icons" style={{ fontSize: 20 }}>
                            {isOpen ? "expand_less" : "expand_more"}
                          </i>
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div style={{ padding: 14 }}>
                      <div className="updateCols">
                        <div className="updateBox">
                          <div className="k">Accomplishments</div>
                          <div className="v">
                            <CountHover
                              title="Accomplishments"
                              items={week.accomplishments}
                              tone="blue"
                            />
                          </div>
                        </div>
                        <div className="updateBox">
                          <div className="k">Blockers</div>
                          <div className="v">
                            <CountHover
                              title="Blockers"
                              items={week.blockers}
                              tone="amber"
                            />
                          </div>
                        </div>
                        <div className="updateBox">
                          <div className="k">Next</div>
                          <div className="v">
                            <CountHover
                              title="Next"
                              items={week.next}
                              tone="green"
                            />
                          </div>
                        </div>
                      </div>

                      {/* <div className="updateCols" style={{ marginTop: 10 }}>
                        <div className="updateBox">
                          <div className="k">Worked</div>
                          <div className="v">
                            <CountHover
                              title="Worked"
                              items={week.retrospective?.worked || []}
                              tone="green"
                            />
                          </div>
                        </div>
                        <div className="updateBox">
                          <div className="k">Didn’t work</div>
                          <div className="v">
                            <CountHover
                              title="Didn’t work"
                              items={week.retrospective?.didnt || []}
                              tone="amber"
                            />
                          </div>
                        </div>
                        <div className="updateBox">
                          <div className="k">Improve</div>
                          <div className="v">
                            <CountHover
                              title="Improve"
                              items={week.retrospective?.improve || []}
                              tone="blue"
                            />
                          </div>
                        </div>
                      </div> */}

                      <div
                        style={{
                          marginTop: 16,
                          fontWeight: 1000,
                          color: "#0f172a",
                          fontSize: 13.5,
                        }}
                      >
                        Day-wise time
                      </div>

                      {week.timesheet.length ? (
                        <div className="hoursGrid">
                          {week.timesheet.map((t, i) => (
                            <div key={`${week.weekStart}-${t.date}-${i}`} className="hoursChip">
                              <div className="d">{weekdayLabel(t.date)}</div>
                              <div className="h">{(Number(t.hours) || 0).toFixed(1)}h</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="emptyState" style={{ marginTop: 10 }}>
                          No time recorded for this week.
                        </div>
                      )}

                      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Pill
                          icon="event"
                          text={week.createdAtFirst ? `First: ${fmtDateTime(week.createdAtFirst)}` : "First: —"}
                          tone="grey"
                        />
                        <Pill
                          icon="update"
                          text={week.createdAtLast ? `Last: ${fmtDateTime(week.createdAtLast)}` : "Last: —"}
                          tone="grey"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}