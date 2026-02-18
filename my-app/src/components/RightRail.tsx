import { useEffect, useMemo, useState } from "react";

declare const M: any;

// ============================================================
// RightRail v2 — "actually fun" interactive rail
// Features:
// 1) Live “Weekly Picks” carousel w/ expand drawer, filters, like/save, slideshow
// 2) Professional Events w/ add/edit/delete, tags, countdown, compact/expanded toggle
// 3) Team Notes upgraded: sections (Backlog / Today / Done), drag-free quick move,
//    priorities, due date, search, bulk actions, persistent local storage
// 4) Micro “Pulse” widget: focus timer + quick stats (purely client-side)
//
// Notes:
// - Everything persists to localStorage (no backend needed today).
// - Works with Materialize classes + inline styles (no extra libs).
// ============================================================

// ---------------------------
// Live Games (FreeToGame API)
// ---------------------------
type F2TGame = {
  id: number;
  title: string;
  thumbnail: string;
  short_description: string;
  genre: string;
  platform: string;
  publisher: string;
  developer: string;
  release_date: string; // YYYY-MM-DD
  game_url: string;
};

function weekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDay(iso: string) {
  const d = safeDate(iso);
  if (!d) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "2-digit" });
}

function daysUntil(iso: string) {
  const d = safeDate(iso);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / 86400000);
}

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function tryJsonParse<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// Storage Keys
// ============================================================
const RR_KEY = {
  notes: "fluke_rr_notes_v2",
  events: "fluke_rr_events_v2",
  savedGames: "fluke_rr_saved_games_v2",
  likedGames: "fluke_rr_liked_games_v2",
  ui: "fluke_rr_ui_v2",
  focus: "fluke_rr_focus_v2",
} as const;

// ============================================================
// Professional Events (editable)
// ============================================================
type ProEventKind = "birthday" | "anniversary" | "company";
type ProEvent = {
  id: string;
  title: string;
  dateISO: string;
  kind: ProEventKind;
  note?: string;
  pinned?: boolean;
};

function KindPill({ kind }: { kind: ProEventKind }) {
  const map: Record<ProEventKind, { bg: string; border: string; fg: string; icon: string; label: string }> = {
    birthday: { bg: "#fff7ed", border: "#ffedd5", fg: "#9a3412", icon: "cake", label: "Birthday" },
    anniversary: { bg: "#f0fdf4", border: "#dcfce7", fg: "#166534", icon: "workspace_premium", label: "Work Anniversary" },
    company: { bg: "#eef2ff", border: "#e0e7ff", fg: "#1e40af", icon: "business", label: "Company" },
  };
  const t = map[kind];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.fg,
        fontSize: 11,
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
      title={t.label}
    >
      <i className="material-icons" style={{ fontSize: 14, lineHeight: "14px" }}>
        {t.icon}
      </i>
      {t.label}
    </span>
  );
}

function EventRow({
  e,
  onPin,
  onEdit,
  onDelete,
}: {
  e: ProEvent;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dleft = daysUntil(e.dateISO);
  const badge =
    dleft === null ? "—" : dleft < 0 ? "Past" : dleft === 0 ? "Today" : dleft === 1 ? "Tomorrow" : `In ${dleft}d`;

  return (
    <li className="collection-item" style={{ padding: "10px 12px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 58, flex: "0 0 auto" }}>
          <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 12 }}>{fmtDay(e.dateISO)}</div>
          <div style={{ marginTop: 2, fontSize: 11, color: "#607d8b", fontWeight: 800 }}>{badge}</div>
        </div>

        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: 13.5,
                color: "#263238",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={e.title}
            >
              {e.title}
              {e.pinned ? (
                <i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginLeft: 6, color: "#f59e0b" }}>
                  push_pin
                </i>
              ) : null}
            </div>
            <KindPill kind={e.kind} />
          </div>

          {e.note ? (
            <div style={{ marginTop: 4, fontSize: 12, color: "#607d8b" }}>
              <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4 }}>
                notes
              </i>
              {e.note}
            </div>
          ) : null}

          <div style={{ marginTop: 8, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn-flat waves-effect" type="button" onClick={onPin} style={{ borderRadius: 10 }} title="Pin">
              <i className="material-icons" style={{ color: "#f59e0b" }}>
                push_pin
              </i>
            </button>
            <button className="btn-flat waves-effect" type="button" onClick={onEdit} style={{ borderRadius: 10 }} title="Edit">
              <i className="material-icons" style={{ color: "#2563eb" }}>
                edit
              </i>
            </button>
            <button className="btn-flat waves-effect" type="button" onClick={onDelete} style={{ borderRadius: 10 }} title="Delete">
              <i className="material-icons" style={{ color: "#ef4444" }}>
                delete
              </i>
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

// ============================================================
// Team Notes v2 (kanban-lite)
// ============================================================
type NotePriority = "low" | "med" | "high";
type NoteLane = "backlog" | "today" | "done";
type NoteItem = {
  id: string;
  text: string;
  lane: NoteLane;
  priority: NotePriority;
  dueISO?: string; // optional
  createdAt: number;
};

function priorityPill(p: NotePriority) {
  const map: Record<NotePriority, { bg: string; border: string; fg: string; label: string }> = {
    low: { bg: "#f1f5f9", border: "#e2e8f0", fg: "#334155", label: "Low" },
    med: { bg: "rgba(245,158,11,0.14)", border: "rgba(245,158,11,0.24)", fg: "#92400e", label: "Medium" },
    high: { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.24)", fg: "#991b1b", label: "High" },
  };
  const t = map[p];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 900,
        padding: "3px 8px",
        borderRadius: 999,
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.fg,
        whiteSpace: "nowrap",
      }}
      title={`Priority: ${t.label}`}
    >
      {t.label}
    </span>
  );
}

function laneTitle(l: NoteLane) {
  if (l === "backlog") return "Backlog";
  if (l === "today") return "Today";
  return "Done";
}

// ============================================================
// Focus Timer (Pulse)
// ============================================================
type FocusState = {
  running: boolean;
  mode: "focus" | "break";
  endsAt: number; // epoch ms
  focusMin: number;
  breakMin: number;
};

function nowMs() {
  return Date.now();
}

function fmtMMSS(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

// ============================================================
// Component
// ============================================================
export default function RightRail() {
  // ---------------------------
  // UI prefs
  // ---------------------------
  const [compactEvents, setCompactEvents] = useState<boolean>(() => {
    const ui = tryJsonParse<{ compactEvents?: boolean }>(localStorage.getItem(RR_KEY.ui), {});
    return !!ui.compactEvents;
  });
  const [autoSlide, setAutoSlide] = useState<boolean>(() => {
    const ui = tryJsonParse<{ autoSlide?: boolean }>(localStorage.getItem(RR_KEY.ui), {});
    return ui.autoSlide ?? true;
  });
  const [autoSlideMs, setAutoSlideMs] = useState<number>(() => {
    const ui = tryJsonParse<{ autoSlideMs?: number }>(localStorage.getItem(RR_KEY.ui), {});
    return ui.autoSlideMs ?? 3500;
  });

  useEffect(() => {
    localStorage.setItem(RR_KEY.ui, JSON.stringify({ compactEvents, autoSlide, autoSlideMs }));
  }, [compactEvents, autoSlide, autoSlideMs]);

  // ---------------------------
  // Live Games
  // ---------------------------
  const [games, setGames] = useState<F2TGame[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesErr, setGamesErr] = useState<string>("");
  const [mode, setMode] = useState<"release-date" | "popularity">("release-date");

  // Drawer / carousel state
  const [activeIdx, setActiveIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string>("ALL");
  const [platformFilter, setPlatformFilter] = useState<string>("ALL");
  const [query, setQuery] = useState("");

  const [likedIds, setLikedIds] = useState<number[]>(() => tryJsonParse<number[]>(localStorage.getItem(RR_KEY.likedGames), []));
  const [savedIds, setSavedIds] = useState<number[]>(() => tryJsonParse<number[]>(localStorage.getItem(RR_KEY.savedGames), []));

  useEffect(() => localStorage.setItem(RR_KEY.likedGames, JSON.stringify(likedIds)), [likedIds]);
  useEffect(() => localStorage.setItem(RR_KEY.savedGames, JSON.stringify(savedIds)), [savedIds]);

  async function fetchGames(sortBy: "release-date" | "popularity") {
    setGamesErr("");
    setGamesLoading(true);
    try {
      const url = `https://www.freetogame.com/api/games?sort-by=${encodeURIComponent(sortBy)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as F2TGame[];
      if (!Array.isArray(data)) throw new Error("Bad response");

      // weekly deterministic slice
      const wk = weekKey();
      const seed = Array.from(wk).reduce((a, c) => a + c.charCodeAt(0), 0);
      const start = seed % Math.max(1, data.length - 18);
      const slice = data.slice(start, start + 14);

      setGames(slice);
      setActiveIdx(0);
    } catch {
      setGames([]);
      setGamesErr("Could not load live games right now.");
      if (typeof M !== "undefined") M.toast({ html: "Live games failed to load.", classes: "red" });
    } finally {
      setGamesLoading(false);
    }
  }

  useEffect(() => {
    fetchGames(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Auto slideshow
  useEffect(() => {
    if (!autoSlide) return;
    if (!games || games.length === 0) return;
    const t = window.setInterval(() => {
      setActiveIdx((i) => (i + 1) % games.length);
    }, clamp(autoSlideMs, 1200, 12000));
    return () => window.clearInterval(t);
  }, [autoSlide, autoSlideMs, games]);

  const genres = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => g.genre && s.add(g.genre));
    return ["ALL", ...Array.from(s).sort()];
  }, [games]);

  const platforms = useMemo(() => {
    const s = new Set<string>();
    games.forEach((g) => g.platform && s.add(g.platform));
    return ["ALL", ...Array.from(s).sort()];
  }, [games]);

  const filteredGames = useMemo(() => {
    let out = games.slice();
    if (genreFilter !== "ALL") out = out.filter((g) => g.genre === genreFilter);
    if (platformFilter !== "ALL") out = out.filter((g) => g.platform === platformFilter);
    const q = query.trim().toLowerCase();
    if (q) out = out.filter((g) => `${g.title} ${g.publisher} ${g.developer} ${g.short_description}`.toLowerCase().includes(q));
    return out;
  }, [games, genreFilter, platformFilter, query]);

  // keep activeIdx in bounds if filtering changes list
  useEffect(() => {
    if (filteredGames.length === 0) return;
    setActiveIdx((i) => clamp(i, 0, filteredGames.length - 1));
  }, [filteredGames.length]);

  function toggleLike(gameId: number) {
    setLikedIds((prev) => {
      const has = prev.includes(gameId);
      const next = has ? prev.filter((x) => x !== gameId) : [gameId, ...prev];
      if (typeof M !== "undefined") M.toast({ html: has ? "Unliked" : "Liked", classes: "blue-grey darken-1" });
      return next;
    });
  }
  function toggleSave(gameId: number) {
    setSavedIds((prev) => {
      const has = prev.includes(gameId);
      const next = has ? prev.filter((x) => x !== gameId) : [gameId, ...prev];
      if (typeof M !== "undefined") M.toast({ html: has ? "Removed from Saved" : "Saved", classes: "blue-grey darken-1" });
      return next;
    });
  }

  // Active game derived from filtered list
  const activeGame = filteredGames[activeIdx];

  // ---------------------------
  // Professional Events (editable)
  // ---------------------------
  const [events, setEvents] = useState<ProEvent[]>(() => {
    const existing = tryJsonParse<ProEvent[]>(localStorage.getItem(RR_KEY.events), []);
    if (existing.length) return existing;

    // seed defaults (you can replace later)
    const seed: ProEvent[] = [
      { id: id(), title: "Company All-Hands", dateISO: "2026-02-20", kind: "company", note: "Monthly updates + roadmap", pinned: true },
      { id: id(), title: "Release Planning", dateISO: "2026-02-24", kind: "company", note: "Scope lock + tasks" },
      { id: id(), title: "HR: Team Birthdays (Roundup)", dateISO: "2026-03-01", kind: "company", note: "Send wishes + shoutouts" },
      { id: id(), title: "Founder Birthday", dateISO: "2026-06-18", kind: "birthday", note: "Announcement + post" },
      { id: id(), title: "Work Anniversary (Placeholder)", dateISO: "2026-04-12", kind: "anniversary", note: "Certificate + shoutout" },
    ];
    return seed;
  });

  useEffect(() => {
    localStorage.setItem(RR_KEY.events, JSON.stringify(events));
  }, [events]);

  const sortedEvents = useMemo(() => {
    const list = events.slice();
    list.sort((a, b) => {
      const ap = a.pinned ? 0 : 1;
      const bp = b.pinned ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (safeDate(a.dateISO)?.getTime() ?? 0) - (safeDate(b.dateISO)?.getTime() ?? 0);
    });
    return list;
  }, [events]);

  const [eventDraft, setEventDraft] = useState<{ id?: string; title: string; dateISO: string; kind: ProEventKind; note: string }>({
    title: "",
    dateISO: "",
    kind: "company",
    note: "",
  });

  function openNewEvent() {
    setEventDraft({ title: "", dateISO: "", kind: "company", note: "" });
    setDrawerOpen((x) => x); // no-op, keeps TS happy
    if (typeof M !== "undefined") M.toast({ html: "Add event below.", classes: "blue-grey darken-1" });
  }

  function submitEvent() {
    const t = eventDraft.title.trim();
    const d = eventDraft.dateISO.trim();
    if (!t || !d) {
      if (typeof M !== "undefined") M.toast({ html: "Title + date required.", classes: "red" });
      return;
    }

    setEvents((prev) => {
      if (eventDraft.id) {
        return prev.map((e) =>
          e.id === eventDraft.id ? { ...e, title: t, dateISO: d, kind: eventDraft.kind, note: eventDraft.note.trim() || undefined } : e
        );
      }
      return [{ id: id(), title: t, dateISO: d, kind: eventDraft.kind, note: eventDraft.note.trim() || undefined }, ...prev];
    });

    setEventDraft({ title: "", dateISO: "", kind: "company", note: "" });
    if (typeof M !== "undefined") M.toast({ html: eventDraft.id ? "Event updated." : "Event added.", classes: "green" });
  }

  // ---------------------------
  // Notes v2 (lanes + priority + due)
  // ---------------------------
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    const existing = tryJsonParse<NoteItem[]>(localStorage.getItem(RR_KEY.notes), []);
    if (existing.length) return existing;

    // seed defaults
    return [
      { id: id(), text: "Prep weekly build", lane: "today", priority: "high", dueISO: "", createdAt: nowMs() },
      { id: id(), text: "Review applicant emails", lane: "backlog", priority: "med", dueISO: "", createdAt: nowMs() },
      { id: id(), text: "Retro notes cleanup", lane: "backlog", priority: "low", dueISO: "", createdAt: nowMs() },
    ];
  });
  const [noteText, setNoteText] = useState("");
  const [notePriority, setNotePriority] = useState<NotePriority>("med");
  const [noteDue, setNoteDue] = useState<string>("");

  const [noteSearch, setNoteSearch] = useState("");
  const [laneView, setLaneView] = useState<"board" | "list">("board");

  useEffect(() => {
    localStorage.setItem(RR_KEY.notes, JSON.stringify(notes));
  }, [notes]);

  const lanes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    const filtered = q ? notes.filter((n) => n.text.toLowerCase().includes(q)) : notes;

    const byLane: Record<NoteLane, NoteItem[]> = { backlog: [], today: [], done: [] };
    for (const n of filtered) byLane[n.lane].push(n);

    // sort: high -> low, then due date, then newest
    const prioScore: Record<NotePriority, number> = { high: 0, med: 1, low: 2 };
    (Object.keys(byLane) as NoteLane[]).forEach((l) => {
      byLane[l].sort((a, b) => {
        const pa = prioScore[a.priority] - prioScore[b.priority];
        if (pa !== 0) return pa;

        const da = a.dueISO ? safeDate(a.dueISO)?.getTime() ?? 9e15 : 9e15;
        const db = b.dueISO ? safeDate(b.dueISO)?.getTime() ?? 9e15 : 9e15;
        if (da !== db) return da - db;

        return b.createdAt - a.createdAt;
      });
    });

    return byLane;
  }, [notes, noteSearch]);

  const counts = useMemo(() => {
    const total = notes.length;
    const done = notes.filter((n) => n.lane === "done").length;
    const today = notes.filter((n) => n.lane === "today").length;
    return { total, done, today, pct: total ? clamp((done / total) * 100, 0, 100) : 0 };
  }, [notes]);

  function addNote() {
    const t = noteText.trim();
    if (!t) return;
    setNotes((prev) => [
      { id: id(), text: t, lane: "backlog", priority: notePriority, dueISO: noteDue || undefined, createdAt: nowMs() },
      ...prev,
    ]);
    setNoteText("");
    setNoteDue("");
    if (typeof M !== "undefined") M.toast({ html: "Added.", classes: "blue-grey darken-1" });
  }

  function move(nid: string, lane: NoteLane) {
    setNotes((prev) => prev.map((n) => (n.id === nid ? { ...n, lane } : n)));
  }

  function toggleDone(nid: string) {
    setNotes((prev) => prev.map((n) => (n.id === nid ? { ...n, lane: n.lane === "done" ? "today" : "done" } : n)));
  }

  function bumpPriority(nid: string) {
    const order: NotePriority[] = ["low", "med", "high"];
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== nid) return n;
        const idx = order.indexOf(n.priority);
        return { ...n, priority: order[(idx + 1) % order.length] };
      })
    );
  }

  function removeNote(nid: string) {
    setNotes((prev) => prev.filter((n) => n.id !== nid));
  }

  function clearDone() {
    setNotes((prev) => prev.filter((n) => n.lane !== "done"));
    if (typeof M !== "undefined") M.toast({ html: "Cleared done.", classes: "blue-grey darken-1" });
  }

  function moveAllTodayToDone() {
    setNotes((prev) => prev.map((n) => (n.lane === "today" ? { ...n, lane: "done" } : n)));
    if (typeof M !== "undefined") M.toast({ html: "Closed today.", classes: "blue-grey darken-1" });
  }

  // ---------------------------
  // Focus Timer (Pulse)
  // ---------------------------
  const [focus, setFocus] = useState<FocusState>(() => {
    const existing = tryJsonParse<FocusState | null>(localStorage.getItem(RR_KEY.focus), null);
    if (existing) return existing;
    return {
      running: false,
      mode: "focus",
      endsAt: 0,
      focusMin: 25,
      breakMin: 5,
    };
  });

  useEffect(() => {
    localStorage.setItem(RR_KEY.focus, JSON.stringify(focus));
  }, [focus]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 250);
    return () => window.clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    if (!focus.running) return 0;
    return Math.max(0, focus.endsAt - nowMs());
  }, [focus, tick]);

  useEffect(() => {
    if (!focus.running) return;
    if (remaining > 0) return;

    // auto switch mode
    const nextMode = focus.mode === "focus" ? "break" : "focus";
    const mins = nextMode === "focus" ? focus.focusMin : focus.breakMin;
    const endsAt = nowMs() + mins * 60 * 1000;

    setFocus((p) => ({ ...p, mode: nextMode, endsAt, running: true }));
    if (typeof M !== "undefined") M.toast({ html: nextMode === "focus" ? "Back to focus." : "Take a break.", classes: "blue-grey darken-1" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function startFocus() {
    const mins = focus.mode === "focus" ? focus.focusMin : focus.breakMin;
    setFocus((p) => ({ ...p, running: true, endsAt: nowMs() + mins * 60 * 1000 }));
    if (typeof M !== "undefined") M.toast({ html: "Timer started.", classes: "blue-grey darken-1" });
  }
  function stopFocus() {
    setFocus((p) => ({ ...p, running: false }));
    if (typeof M !== "undefined") M.toast({ html: "Timer paused.", classes: "blue-grey darken-1" });
  }
  function resetFocus() {
    setFocus((p) => ({ ...p, running: false, endsAt: 0 }));
    if (typeof M !== "undefined") M.toast({ html: "Reset.", classes: "blue-grey darken-1" });
  }

  // ============================================================
  // Styles (inline <style/> so you paste once)
  // ============================================================
  const style = (
    <style>{`
      .rrCard { border-radius: 16px; overflow: hidden; }
      .rrHeadDark {
        padding: 14px 14px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
        background:
          radial-gradient(850px 240px at 15% 10%, rgba(59,130,246,0.32), transparent 55%),
          radial-gradient(780px 260px at 90% 45%, rgba(34,197,94,0.18), transparent 62%),
          linear-gradient(135deg, #0b1220 0%, #111827 50%, #0b1220 100%);
        color: white;
        position: relative;
      }
      .rrHeadDark::after {
        content:"";
        position:absolute; inset:0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
        transform: translateX(-60%);
        animation: rrShimmer 4.2s ease-in-out infinite;
        pointer-events:none;
        opacity: .45;
      }
      @keyframes rrShimmer { 0%{ transform: translateX(-60%);} 50%{ transform: translateX(60%);} 100%{ transform: translateX(60%);} }

      .rrHeadLight {
        padding: 14px 14px 12px;
        border-bottom: 1px solid #eceff1;
        background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
      }

      .rrTitle { font-weight: 900; font-size: 14.5px; line-height: 18px; }
      .rrSub { font-size: 12px; margin-top: 2px; color: rgba(255,255,255,0.75); }
      .rrSubLight { font-size: 12px; margin-top: 2px; color: #607d8b; }

      .rrBtnGhost {
        border-radius: 10px;
        height: 30px;
        line-height: 30px;
        padding: 0 10px;
        color: white;
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.16);
        text-transform: none;
        font-weight: 900;
      }
      .rrBtnGhost:hover { background: rgba(255,255,255,0.14); }

      .rrChip {
        font-size: 11px; font-weight: 900;
        padding: 3px 9px; border-radius: 999px;
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.16);
        color: rgba(255,255,255,0.92);
        white-space: nowrap;
      }

      .rrTile {
        border: 1px solid #e6edf2;
        border-radius: 14px;
        overflow: hidden;
        background: #fff;
        transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
      }
      .rrTile:hover {
        transform: translateY(-1px);
        box-shadow: 0 12px 24px rgba(0,0,0,0.10);
        border-color: rgba(37,99,235,0.26);
      }

      .rrThumb { background: #0b1220; }
      .rrThumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

      .rrPill {
        font-size: 11px; font-weight: 900;
        padding: 3px 8px;
        border-radius: 999px;
        background: #eef2ff;
        border: 1px solid #e0e7ff;
        color: #1e40af;
        white-space: nowrap;
      }

      .rrPill2 {
        font-size: 11px; font-weight: 900;
        padding: 3px 8px;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        color: #334155;
        white-space: nowrap;
      }

      .rrBar {
        height: 8px; border-radius: 999px;
        background: rgba(255,255,255,0.16);
        overflow: hidden;
      }
      .rrBar > div {
        height: 100%;
        width: var(--w);
        background: rgba(34,197,94,0.70);
        border-radius: 999px;
        transition: width 140ms ease;
      }

      .rrDrawer {
        border-top: 1px solid rgba(255,255,255,0.12);
        padding-top: 12px;
        margin-top: 12px;
        animation: rrFade 160ms ease both;
      }
      @keyframes rrFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0);} }

      .rrMiniSelect {
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.92);
        padding: 0 10px;
        font-weight: 900;
        font-size: 12px;
        outline: none;
      }

      .rrMiniInput {
        height: 30px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.92);
        padding: 0 10px;
        font-weight: 800;
        font-size: 12px;
        outline: none;
      }
      .rrMiniInput::placeholder { color: rgba(255,255,255,0.55); }

      .rrLane {
        border: 1px solid #e6edf2;
        border-radius: 14px;
        overflow: hidden;
        background: #fff;
      }
      .rrLaneHead {
        padding: 10px 12px;
        border-bottom: 1px solid #eceff1;
        background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
        display:flex; align-items:center; justify-content:space-between; gap:10px;
      }
      .rrLaneHead .h { font-weight: 900; color:#0f172a; font-size: 13px; }
      .rrLaneHead .c { font-weight: 900; font-size: 11px; color:#607d8b; }
      .rrLaneBody { padding: 10px 12px; display: grid; gap: 10px; }

      .rrNote {
        border: 1px solid #e6edf2;
        border-radius: 12px;
        padding: 10px 10px;
        background: #fff;
        transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
      }
      .rrNote:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(0,0,0,0.08);
        border-color: rgba(37,99,235,0.22);
      }

      .rrNoteText { font-weight: 900; color:#0f172a; font-size: 13px; line-height: 16px; }
      .rrNoteMeta { margin-top: 6px; display:flex; justify-content:space-between; align-items:center; gap:10px; }

      .rrDue {
        font-size: 11px; font-weight: 900;
        color: #607d8b;
      }

      .rrIconBtn {
        width: 34px; height: 34px;
        border-radius: 12px;
        border: 1px solid #e6edf2;
        background: #fff;
        display:inline-flex; align-items:center; justify-content:center;
        transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
      }
      .rrIconBtn:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 22px rgba(0,0,0,0.10);
        border-color: rgba(37,99,235,0.24);
      }

      @media (prefers-reduced-motion: reduce) {
        .rrHeadDark::after, .rrTile, .rrDrawer, .rrNote, .rrIconBtn { animation: none !important; transition: none !important; }
      }
    `}</style>
  );

  // ============================================================
  // Render
  // ============================================================
  const likedSet = useMemo(() => new Set(likedIds), [likedIds]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const selectedGame = activeGame;

  return (
    <div className="sticky-panel">
      {style}

      {/* =========================
          1) LIVE WEEKLY PICKS (carousel + drawer + likes/saves)
         ========================= */}
      <div className="card z-depth-1 rrCard">
        <div className="rrHeadDark">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="rrTitle">Weekly Game Picks</div>
              <div className="rrSub">Live feed • FreeToGame • {weekKey()}</div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className="btn-flat waves-effect rrBtnGhost"
                type="button"
                onClick={() => setMode((m) => (m === "release-date" ? "popularity" : "release-date"))}
                title="Toggle sort"
              >
                <i className="material-icons left" style={{ marginRight: 6 }}>
                  swap_vert
                </i>
                {mode === "release-date" ? "Newest" : "Popular"}
              </button>

              <button
                className="btn-flat waves-effect rrBtnGhost"
                type="button"
                onClick={() => fetchGames(mode)}
                title="Refresh"
              >
                <i className="material-icons">refresh</i>
              </button>

              <button
                className="btn-flat waves-effect rrBtnGhost"
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                title="Filters & controls"
              >
                <i className="material-icons">{drawerOpen ? "expand_less" : "tune"}</i>
              </button>
            </div>
          </div>

          {/* Progress: likes/saved */}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span className="rrChip">
              <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                favorite
              </i>
              Liked: {likedIds.length}
            </span>
            <span className="rrChip">
              <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                bookmark
              </i>
              Saved: {savedIds.length}
            </span>
            <span className="rrChip">
              <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                slideshow
              </i>
              Auto: {autoSlide ? "On" : "Off"}
            </span>
          </div>

          {drawerOpen ? (
            <div className="rrDrawer">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select className="rrMiniSelect" value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} title="Genre">
                    {genres.map((g) => (
                      <option key={g} value={g} style={{ color: "#0f172a" }}>
                        {g}
                      </option>
                    ))}
                  </select>

                  <select className="rrMiniSelect" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} title="Platform">
                    {platforms.map((p) => (
                      <option key={p} value={p} style={{ color: "#0f172a" }}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <input
                    className="rrMiniInput"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title/publisher…"
                    title="Search"
                  />

                  <button
                    className="btn-flat waves-effect rrBtnGhost"
                    type="button"
                    onClick={() => setAutoSlide((v) => !v)}
                    title="Toggle autoplay"
                  >
                    <i className="material-icons left" style={{ marginRight: 6 }}>
                      {autoSlide ? "pause" : "play_arrow"}
                    </i>
                    {autoSlide ? "Pause" : "Play"}
                  </button>

                  <button
                    className="btn-flat waves-effect rrBtnGhost"
                    type="button"
                    onClick={() => {
                      setGenreFilter("ALL");
                      setPlatformFilter("ALL");
                      setQuery("");
                      if (typeof M !== "undefined") M.toast({ html: "Filters cleared.", classes: "blue-grey darken-1" });
                    }}
                    title="Clear"
                  >
                    <i className="material-icons left" style={{ marginRight: 6 }}>
                      backspace
                    </i>
                    Clear
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 900 }}>
                    Slide speed
                  </span>
                  <input
                    type="range"
                    min={1200}
                    max={12000}
                    step={100}
                    value={autoSlideMs}
                    onChange={(e) => setAutoSlideMs(Number(e.target.value))}
                    style={{ width: 220 }}
                    title="Autoplay speed"
                  />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 900 }}>
                    {autoSlideMs}ms
                  </span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                    Results: <b style={{ color: "white" }}>{filteredGames.length}</b>
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div style={{ padding: 14 }}>
          {gamesLoading ? (
            <div style={{ display: "grid", gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rrTile">
                  <div style={{ height: 110, background: "#eef2f7" }} />
                  <div style={{ padding: 10 }}>
                    <div style={{ height: 10, background: "#eef2f7", borderRadius: 999, width: "70%" }} />
                    <div style={{ height: 10, background: "#eef2f7", borderRadius: 999, width: "48%", marginTop: 8 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : gamesErr ? (
            <div
              style={{
                border: "1px solid #fee2e2",
                background: "#fff1f2",
                color: "#9f1239",
                padding: "10px 12px",
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              {gamesErr}
            </div>
          ) : filteredGames.length === 0 ? (
            <div
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: 12,
                padding: "12px 12px",
                color: "#607d8b",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              No games match your filters.
            </div>
          ) : (
            <>
              {/* Carousel Main Tile */}
              {selectedGame ? (
                <div className="rrTile" style={{ marginBottom: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
                    <div className="rrThumb">
                      <img src={selectedGame.thumbnail} alt={selectedGame.title} loading="lazy" />
                    </div>

                    <div style={{ padding: "10px 12px 10px 0", minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 900,
                              fontSize: 14,
                              color: "#0f172a",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={selectedGame.title}
                          >
                            {selectedGame.title}
                          </div>

                          <div style={{ marginTop: 5, display: "flex", flexWrap: "wrap", gap: 6 }}>
                            <span className="rrPill">{selectedGame.genre}</span>
                            <span className="rrPill2">{selectedGame.platform}</span>
                          </div>

                          <div style={{ marginTop: 7, fontSize: 12, color: "#607d8b" }}>
                            <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 4 }}>
                              event
                            </i>
                            {selectedGame.release_date} • {selectedGame.publisher}
                          </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                          <button
                            className="rrIconBtn waves-effect"
                            type="button"
                            onClick={() => toggleLike(selectedGame.id)}
                            title="Like"
                          >
                            <i className="material-icons" style={{ color: likedSet.has(selectedGame.id) ? "#ef4444" : "#90a4ae" }}>
                              favorite
                            </i>
                          </button>

                          <button
                            className="rrIconBtn waves-effect"
                            type="button"
                            onClick={() => toggleSave(selectedGame.id)}
                            title="Save"
                          >
                            <i className="material-icons" style={{ color: savedSet.has(selectedGame.id) ? "#2563eb" : "#90a4ae" }}>
                              bookmark
                            </i>
                          </button>

                          <a
                            className="rrIconBtn waves-effect"
                            href={selectedGame.game_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open"
                            style={{ textDecoration: "none" }}
                          >
                            <i className="material-icons" style={{ color: "#0f172a" }}>
                              open_in_new
                            </i>
                          </a>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 12, color: "#607d8b", lineHeight: "16px" }}>
                        {selectedGame.short_description}
                      </div>

                      {/* Carousel controls */}
                      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                        <button
                          className="btn-flat waves-effect"
                          type="button"
                          onClick={() => setActiveIdx((i) => (i - 1 + filteredGames.length) % filteredGames.length)}
                          style={{ borderRadius: 10, fontWeight: 900, textTransform: "none" }}
                          title="Previous"
                        >
                          <i className="material-icons left" style={{ marginRight: 6 }}>
                            chevron_left
                          </i>
                          Prev
                        </button>

                        <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>
                          {activeIdx + 1}/{filteredGames.length}
                        </div>

                        <button
                          className="btn-flat waves-effect"
                          type="button"
                          onClick={() => setActiveIdx((i) => (i + 1) % filteredGames.length)}
                          style={{ borderRadius: 10, fontWeight: 900, textTransform: "none" }}
                          title="Next"
                        >
                          Next
                          <i className="material-icons right" style={{ marginLeft: 6 }}>
                            chevron_right
                          </i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Thumbnails strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
                {filteredGames.slice(0, 8).map((g) => {
                  const idx = filteredGames.findIndex((x) => x.id === g.id);
                  const active = idx === activeIdx;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className="waves-effect"
                      onClick={() => setActiveIdx(idx)}
                      style={{
                        border: active ? "2px solid rgba(37,99,235,0.65)" : "1px solid #e6edf2",
                        borderRadius: 12,
                        overflow: "hidden",
                        padding: 0,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                      title={g.title}
                    >
                      <div style={{ height: 58, background: "#0b1220" }}>
                        <img src={g.thumbnail} alt={g.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                      <div
                        style={{
                          padding: "8px 8px",
                          fontSize: 11,
                          fontWeight: 900,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textAlign: "left",
                        }}
                      >
                        {g.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* =========================
          2) PROFESSIONAL EVENTS (editable)
         ========================= */}
      <div className="card z-depth-1 rrCard" style={{ marginTop: 12 }}>
        <div className="rrHeadLight">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div>
              <div className="rrTitle" style={{ color: "#263238" }}>
                Upcoming (Professional)
              </div>
              <div className="rrSubLight">Company events • birthdays • work anniversaries</div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn-flat waves-effect"
                type="button"
                onClick={() => setCompactEvents((v) => !v)}
                style={{ borderRadius: 10, fontWeight: 900, textTransform: "none" }}
                title="Toggle compact"
              >
                <i className="material-icons left" style={{ marginRight: 6, color: "#607d8b" }}>
                  {compactEvents ? "unfold_more" : "unfold_less"}
                </i>
                {compactEvents ? "Expand" : "Compact"}
              </button>

              <button
                className="btn waves-effect waves-light"
                type="button"
                onClick={openNewEvent}
                style={{ borderRadius: 10, fontWeight: 900 }}
                title="Add event"
              >
                <i className="material-icons left">add</i>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Add / Edit form */}
        <div style={{ padding: 14, borderBottom: "1px solid #eceff1", background: "#fafafa" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 10 }}>
              <input
                value={eventDraft.title}
                onChange={(e) => setEventDraft((p) => ({ ...p, title: e.target.value }))}
                placeholder="Event title (e.g., All-hands, Birthday, Anniversary)"
                style={{
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e6edf2",
                  padding: "0 12px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />
              <input
                value={eventDraft.dateISO}
                onChange={(e) => setEventDraft((p) => ({ ...p, dateISO: e.target.value }))}
                placeholder="YYYY-MM-DD"
                style={{
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e6edf2",
                  padding: "0 12px",
                  fontWeight: 900,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 130px", gap: 10 }}>
              <select
                value={eventDraft.kind}
                onChange={(e) => setEventDraft((p) => ({ ...p, kind: e.target.value as ProEventKind }))}
                style={{
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e6edf2",
                  padding: "0 10px",
                  fontWeight: 900,
                  outline: "none",
                  background: "#fff",
                }}
                title="Kind"
              >
                <option value="company">Company</option>
                <option value="birthday">Birthday</option>
                <option value="anniversary">Work Anniversary</option>
              </select>

              <input
                value={eventDraft.note}
                onChange={(e) => setEventDraft((p) => ({ ...p, note: e.target.value }))}
                placeholder="Note (optional)"
                style={{
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #e6edf2",
                  padding: "0 12px",
                  fontWeight: 800,
                  outline: "none",
                }}
              />

              <button
                className="btn waves-effect waves-light"
                type="button"
                onClick={submitEvent}
                style={{ borderRadius: 10, fontWeight: 900 }}
                title="Save event"
              >
                <i className="material-icons left">save</i>
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 0 }}>
          <ul className="collection" style={{ margin: 0, border: "none" }}>
            {sortedEvents.slice(0, compactEvents ? 4 : 8).map((e) => (
              <EventRow
                key={e.id}
                e={e}
                onPin={() => setEvents((prev) => prev.map((x) => (x.id === e.id ? { ...x, pinned: !x.pinned } : x)))}
                onEdit={() => setEventDraft({ id: e.id, title: e.title, dateISO: e.dateISO, kind: e.kind, note: e.note || "" })}
                onDelete={() => setEvents((prev) => prev.filter((x) => x.id !== e.id))}
              />
            ))}
          </ul>
        </div>

        <div className="card-action" style={{ padding: "12px 14px", borderTop: "1px solid #eceff1", background: "#fafafa" }}>
          <span style={{ fontSize: 12, color: "#607d8b" }}>
            Next step: swap localStorage with DynamoDB “Company Calendar” table.
          </span>
        </div>
      </div>

      {/* =========================
          3) TEAM NOTES v2 (board + list, priorities, due, bulk actions)
         ========================= */}
      <div className="card z-depth-1 rrCard" style={{ marginTop: 12 }}>
        <div className="rrHeadDark">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div>
              <div className="rrTitle">Team Notes</div>
              <div className="rrSub">Kanban-lite • priorities • due dates • saved locally</div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 14.5 }}>{counts.done}/{counts.total || 0}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 800 }}>Done</div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="rrBar" style={{ ["--w" as any]: `${counts.pct}%` }}>
              <div />
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className="rrMiniInput"
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              placeholder="Search notes…"
              title="Search"
              style={{ minWidth: 160 }}
            />

            <select className="rrMiniSelect" value={notePriority} onChange={(e) => setNotePriority(e.target.value as NotePriority)} title="New note priority">
              <option value="low" style={{ color: "#0f172a" }}>Low</option>
              <option value="med" style={{ color: "#0f172a" }}>Medium</option>
              <option value="high" style={{ color: "#0f172a" }}>High</option>
            </select>

            <input
              className="rrMiniInput"
              value={noteDue}
              onChange={(e) => setNoteDue(e.target.value)}
              placeholder="Due (YYYY-MM-DD)"
              title="Due date"
              style={{ width: 150 }}
            />

            <button
              className="btn-flat waves-effect rrBtnGhost"
              type="button"
              onClick={() => setLaneView((v) => (v === "board" ? "list" : "board"))}
              title="Toggle view"
            >
              <i className="material-icons left" style={{ marginRight: 6 }}>
                {laneView === "board" ? "view_list" : "view_kanban"}
              </i>
              {laneView === "board" ? "List" : "Board"}
            </button>

            <button className="btn-flat waves-effect rrBtnGhost" type="button" onClick={clearDone} title="Clear done">
              <i className="material-icons left" style={{ marginRight: 6 }}>
                delete_sweep
              </i>
              Clear done
            </button>

            <button className="btn-flat waves-effect rrBtnGhost" type="button" onClick={moveAllTodayToDone} title="Close today">
              <i className="material-icons left" style={{ marginRight: 6 }}>
                done_all
              </i>
              Close today
            </button>
          </div>

          {/* Add note */}
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="rrMiniInput"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a team note… (Enter to add)"
              title="New note"
              style={{ flex: "1 1 auto", minWidth: 0 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNote();
              }}
            />
            <button className="btn waves-effect waves-light" type="button" onClick={addNote} style={{ borderRadius: 10, fontWeight: 900 }} title="Add">
              <i className="material-icons">add</i>
            </button>
          </div>
        </div>

        <div style={{ padding: 14 }}>
          {laneView === "board" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div className="rrLane">
                <div className="rrLaneHead">
                  <div className="h">{laneTitle("backlog")}</div>
                  <div className="c">{lanes.backlog.length}</div>
                </div>
                <div className="rrLaneBody">
                  {lanes.backlog.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>Empty</div>
                  ) : (
                    lanes.backlog.map((n) => (
                      <div key={n.id} className="rrNote">
                        <div className="rrNoteText">{n.text}</div>
                        <div className="rrNoteMeta">
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {priorityPill(n.priority)}
                            <span className="rrDue">{n.dueISO ? `Due: ${n.dueISO}` : "No due"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => bumpPriority(n.id)} title="Cycle priority">
                              <i className="material-icons" style={{ color: "#f59e0b" }}>
                                priority_high
                              </i>
                            </button>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => move(n.id, "today")} title="Move to Today">
                              <i className="material-icons" style={{ color: "#2563eb" }}>
                                arrow_forward
                              </i>
                            </button>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => removeNote(n.id)} title="Delete">
                              <i className="material-icons" style={{ color: "#ef4444" }}>
                                delete
                              </i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rrLane">
                <div className="rrLaneHead">
                  <div className="h">{laneTitle("today")}</div>
                  <div className="c">{lanes.today.length}</div>
                </div>
                <div className="rrLaneBody">
                  {lanes.today.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>Empty</div>
                  ) : (
                    lanes.today.map((n) => (
                      <div key={n.id} className="rrNote">
                        <div className="rrNoteText">{n.text}</div>
                        <div className="rrNoteMeta">
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {priorityPill(n.priority)}
                            <span className="rrDue">{n.dueISO ? `Due: ${n.dueISO}` : "No due"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => bumpPriority(n.id)} title="Cycle priority">
                              <i className="material-icons" style={{ color: "#f59e0b" }}>
                                priority_high
                              </i>
                            </button>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => toggleDone(n.id)} title="Mark done">
                              <i className="material-icons" style={{ color: "#16a34a" }}>
                                check_circle
                              </i>
                            </button>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => move(n.id, "backlog")} title="Back to Backlog">
                              <i className="material-icons" style={{ color: "#64748b" }}>
                                undo
                              </i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rrLane">
                <div className="rrLaneHead">
                  <div className="h">{laneTitle("done")}</div>
                  <div className="c">{lanes.done.length}</div>
                </div>
                <div className="rrLaneBody">
                  {lanes.done.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#607d8b", fontWeight: 900 }}>Empty</div>
                  ) : (
                    lanes.done.map((n) => (
                      <div key={n.id} className="rrNote" style={{ opacity: 0.82 }}>
                        <div className="rrNoteText" style={{ textDecoration: "line-through", color: "#64748b" }}>
                          {n.text}
                        </div>
                        <div className="rrNoteMeta">
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {priorityPill(n.priority)}
                            <span className="rrDue">{n.dueISO ? `Due: ${n.dueISO}` : "No due"}</span>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => toggleDone(n.id)} title="Reopen">
                              <i className="material-icons" style={{ color: "#2563eb" }}>
                                replay
                              </i>
                            </button>
                            <button className="rrIconBtn waves-effect" type="button" onClick={() => removeNote(n.id)} title="Delete">
                              <i className="material-icons" style={{ color: "#ef4444" }}>
                                delete
                              </i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rrLane">
              <div className="rrLaneHead">
                <div className="h">All Notes</div>
                <div className="c">{notes.length}</div>
              </div>
              <div className="rrLaneBody">
                {Object.entries(lanes).flatMap(([_lane, list]) =>
                  list.map((n) => (
                    <div key={n.id} className="rrNote">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                          <div className="rrNoteText" style={{ textDecoration: n.lane === "done" ? "line-through" : "none", color: n.lane === "done" ? "#64748b" : "#0f172a" }}>
                            {n.text}
                          </div>
                          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="rrPill2">{laneTitle(n.lane)}</span>
                            {priorityPill(n.priority)}
                            <span className="rrDue">{n.dueISO ? `Due: ${n.dueISO}` : "No due"}</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
                          <button className="rrIconBtn waves-effect" type="button" onClick={() => bumpPriority(n.id)} title="Cycle priority">
                            <i className="material-icons" style={{ color: "#f59e0b" }}>
                              priority_high
                            </i>
                          </button>

                          <button className="rrIconBtn waves-effect" type="button" onClick={() => move(n.id, "backlog")} title="Backlog">
                            <i className="material-icons" style={{ color: "#64748b" }}>
                              inbox
                            </i>
                          </button>
                          <button className="rrIconBtn waves-effect" type="button" onClick={() => move(n.id, "today")} title="Today">
                            <i className="material-icons" style={{ color: "#2563eb" }}>
                              today
                            </i>
                          </button>
                          <button className="rrIconBtn waves-effect" type="button" onClick={() => move(n.id, "done")} title="Done">
                            <i className="material-icons" style={{ color: "#16a34a" }}>
                              check
                            </i>
                          </button>

                          <button className="rrIconBtn waves-effect" type="button" onClick={() => removeNote(n.id)} title="Delete">
                            <i className="material-icons" style={{ color: "#ef4444" }}>
                              delete
                            </i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================
          4) PULSE (focus timer + quick stats)
         ========================= */}
      <div className="card z-depth-1 rrCard" style={{ marginTop: 12 }}>
        <div className="rrHeadDark">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div className="rrTitle">Pulse</div>
              <div className="rrSub">Focus timer + quick weekly rhythm</div>
            </div>
            <span className="rrChip">
              <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                timeline
              </i>
              Today: {counts.today}
            </span>
          </div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span className="rrChip">
                <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                  {focus.mode === "focus" ? "center_focus_strong" : "coffee"}
                </i>
                {focus.mode === "focus" ? "Focus" : "Break"}
              </span>

              <span style={{ fontWeight: 900, fontSize: 18, color: "white" }}>
                {focus.running ? fmtMMSS(remaining) : `${focus.mode === "focus" ? focus.focusMin : focus.breakMin}:00`}
              </span>

              <span className="rrChip">
                <i className="material-icons" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 6 }}>
                  check_circle
                </i>
                Done: {counts.done}
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button className="btn-flat waves-effect rrBtnGhost" type="button" onClick={focus.running ? stopFocus : startFocus} title="Start/Pause">
                <i className="material-icons left" style={{ marginRight: 6 }}>
                  {focus.running ? "pause" : "play_arrow"}
                </i>
                {focus.running ? "Pause" : "Start"}
              </button>

              <button className="btn-flat waves-effect rrBtnGhost" type="button" onClick={resetFocus} title="Reset">
                <i className="material-icons left" style={{ marginRight: 6 }}>
                  restart_alt
                </i>
                Reset
              </button>

              <button
                className="btn-flat waves-effect rrBtnGhost"
                type="button"
                onClick={() => setFocus((p) => ({ ...p, mode: p.mode === "focus" ? "break" : "focus", running: false, endsAt: 0 }))}
                title="Switch mode"
              >
                <i className="material-icons left" style={{ marginRight: 6 }}>
                  swap_horiz
                </i>
                Switch
              </button>

              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 10 }}>
                Focus
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={focus.focusMin}
                  onChange={(e) => setFocus((p) => ({ ...p, focusMin: Number(e.target.value), running: false, endsAt: 0 }))}
                />
                {focus.focusMin}m
              </span>

              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 10 }}>
                Break
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={focus.breakMin}
                  onChange={(e) => setFocus((p) => ({ ...p, breakMin: Number(e.target.value), running: false, endsAt: 0 }))}
                />
                {focus.breakMin}m
              </span>
            </div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 14 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              className="rrTile"
              style={{
                padding: 12,
                display: "flex",
                gap: 10,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ fontWeight: 900, color: "#0f172a" }}>Quick Stats</div>
                <div style={{ fontSize: 12, color: "#607d8b", marginTop: 2 }}>
                  Notes: <b>{counts.total}</b> • Today: <b>{counts.today}</b> • Done: <b>{counts.done}</b>
                </div>
              </div>
              <button
                className="btn-flat waves-effect"
                type="button"
                onClick={() => {
                  setNotes([]);
                  setEvents([]);
                  setLikedIds([]);
                  setSavedIds([]);
                  if (typeof M !== "undefined") M.toast({ html: "Reset all local widgets.", classes: "red" });
                }}
                style={{ borderRadius: 10, fontWeight: 900, textTransform: "none" }}
                title="Reset everything (local)"
              >
                <i className="material-icons left" style={{ marginRight: 6, color: "#ef4444" }}>
                  warning
                </i>
                Reset local
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
