// src/components/RightRail.tsx
import { useEffect, useMemo, useState } from "react";

declare const M: any;

// ============================================================
// RightRail v4.1 — Pulse (top) + New Joins (tabs: Upcoming / Joined)
// - No game hub
// - Clean UI: Materialize-safe inputs/buttons (no underline/label conflicts)
// - Responsive grids that don't look broken on mobile
// ============================================================

// ---------------------------
// Helpers
// ---------------------------
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
// Storage Keys
// ============================================================
const RR_KEY = {
  ui: "fluke_rr_ui_v4_1",
  focus: "fluke_rr_focus_v4_1",
  joins: "fluke_rr_joins_v4_1",
} as const;

// ============================================================
// Pulse (Focus Timer)
// ============================================================
type FocusState = {
  running: boolean;
  mode: "focus" | "break";
  endsAt: number; // epoch ms
  focusMin: number;
  breakMin: number;
};

// ============================================================
// New Joins
// ============================================================
type JoinRole = "3D Artist" | "Animator" | "Programmer" | "Designer" | "QA" | "PM" | "Other";
type JoinItem = {
  id: string;
  name: string;
  role: JoinRole;
  startISO: string; // YYYY-MM-DD
  location?: string;
  note?: string;
  pinned?: boolean;
};

type JoinTab = "upcoming" | "joined";

function RolePill({ role }: { role: JoinRole }) {
  const map: Record<JoinRole, { bg: string; border: string; fg: string; icon: string }> = {
    "3D Artist": { bg: "#fff7ed", border: "#ffedd5", fg: "#9a3412", icon: "brush" },
    Animator: { bg: "#f0fdf4", border: "#dcfce7", fg: "#166534", icon: "movie" },
    Programmer: { bg: "#eef2ff", border: "#e0e7ff", fg: "#1e40af", icon: "code" },
    Designer: { bg: "#fdf2f8", border: "#fce7f3", fg: "#9d174d", icon: "architecture" },
    QA: { bg: "#f1f5f9", border: "#e2e8f0", fg: "#334155", icon: "fact_check" },
    PM: { bg: "#ecfeff", border: "#cffafe", fg: "#155e75", icon: "event_note" },
    Other: { bg: "#f8fafc", border: "#e2e8f0", fg: "#334155", icon: "person" },
  };
  const t = map[role] ?? map.Other;
  return (
    <span className="rrPillRole" style={{ background: t.bg, borderColor: t.border, color: t.fg }} title={role}>
      <i className="material-icons">{t.icon}</i>
      {role}
    </span>
  );
}

function JoinRow({
  j,
  tab,
  onPin,
  onEdit,
  onDelete,
}: {
  j: JoinItem;
  tab: JoinTab;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dleft = daysUntil(j.startISO);
  const badge =
    dleft === null
      ? "Fix date"
      : tab === "upcoming"
        ? dleft === 0
          ? "Starts Today"
          : dleft === 1
            ? "Starts Tomorrow"
            : `Starts in ${dleft}d`
        : dleft < 0
          ? `Joined ${Math.abs(dleft)}d ago`
          : dleft === 0
            ? "Joined Today"
            : `Joins in ${dleft}d`;

  return (
    <li className="rrJoinRow">
      <div className="rrJoinLeft">
        <div className="rrJoinDay">{fmtDay(j.startISO)}</div>
        <div className="rrJoinBadge">{badge}</div>
      </div>

      <div className="rrJoinMain">
        <div className="rrJoinTop">
          <div className="rrJoinName" title={j.name}>
            {j.name}
            {j.pinned ? (
              <i className="material-icons rrPinIcon" title="Pinned">
                push_pin
              </i>
            ) : null}
          </div>

          <div className="rrJoinTopRight">
            <RolePill role={j.role} />
            <div className="rrJoinActions">
              <button className="rrIconBtn" type="button" onClick={onPin} title="Pin">
                <i className="material-icons">push_pin</i>
              </button>
              <button className="rrIconBtn" type="button" onClick={onEdit} title="Edit">
                <i className="material-icons">edit</i>
              </button>
              <button className="rrIconBtn rrDanger" type="button" onClick={onDelete} title="Delete">
                <i className="material-icons">delete</i>
              </button>
            </div>
          </div>
        </div>

        <div className="rrJoinMeta">
          {j.location ? (
            <span className="rrMetaLine">
              <i className="material-icons">place</i>
              {j.location}
            </span>
          ) : null}

          {j.note ? (
            <span className="rrMetaLine">
              <i className="material-icons">notes</i>
              {j.note}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ============================================================
// Component
// ============================================================
export default function RightRail() {
  // ---------------------------
  // UI prefs
  // ---------------------------
  const [compactJoins, setCompactJoins] = useState<boolean>(() => {
    const ui = tryJsonParse<{ compactJoins?: boolean; tab?: JoinTab }>(localStorage.getItem(RR_KEY.ui), {});
    return ui.compactJoins ?? true;
  });

  const [joinTab, setJoinTab] = useState<JoinTab>(() => {
    const ui = tryJsonParse<{ compactJoins?: boolean; tab?: JoinTab }>(localStorage.getItem(RR_KEY.ui), {});
    return ui.tab ?? "upcoming";
  });

  useEffect(() => {
    localStorage.setItem(RR_KEY.ui, JSON.stringify({ compactJoins, tab: joinTab }));
  }, [compactJoins, joinTab]);

  // ---------------------------
  // Focus (Pulse)
  // ---------------------------
  const [focus, setFocus] = useState<FocusState>(() => {
    const existing = tryJsonParse<FocusState | null>(localStorage.getItem(RR_KEY.focus), null);
    if (existing) return existing;
    return { running: false, mode: "focus", endsAt: 0, focusMin: 25, breakMin: 5 };
  });
  useEffect(() => localStorage.setItem(RR_KEY.focus, JSON.stringify(focus)), [focus]);

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

  // ---------------------------
  // New Joins
  // ---------------------------
  const [joins, setJoins] = useState<JoinItem[]>(() => {
    const existing = tryJsonParse<JoinItem[]>(localStorage.getItem(RR_KEY.joins), []);
    if (existing.length) return existing;

    return [
      { id: id(), name: "Aarav", role: "3D Artist", startISO: "2026-02-18", location: "Chandigarh", note: "Environment scene test + lighting", pinned: true },
      { id: id(), name: "Meera", role: "Animator", startISO: "2026-02-26", location: "Remote", note: "Victim reactions from combo" },
      { id: id(), name: "Zoya", role: "Programmer", startISO: "2026-03-01", location: "Remote", note: "Portal fixes + admin tooling" },
    ];
  });
  useEffect(() => localStorage.setItem(RR_KEY.joins, JSON.stringify(joins)), [joins]);

  const split = useMemo(() => {
    const upcoming: JoinItem[] = [];
    const joined: JoinItem[] = [];
    for (const j of joins) {
      const dleft = daysUntil(j.startISO);
      if (dleft === null) upcoming.push(j);
      else if (dleft >= 0) upcoming.push(j);
      else joined.push(j);
    }

    const pinScore = (x: JoinItem) => (x.pinned ? 0 : 1);

    upcoming.sort((a, b) => {
      const p = pinScore(a) - pinScore(b);
      if (p !== 0) return p;
      return (safeDate(a.startISO)?.getTime() ?? 9e15) - (safeDate(b.startISO)?.getTime() ?? 9e15);
    });

    joined.sort((a, b) => {
      const p = pinScore(a) - pinScore(b);
      if (p !== 0) return p;
      return (safeDate(b.startISO)?.getTime() ?? 0) - (safeDate(a.startISO)?.getTime() ?? 0);
    });

    return { upcoming, joined };
  }, [joins]);

  const counts = useMemo(() => {
    return { upcoming: split.upcoming.length, joined: split.joined.length, total: joins.length };
  }, [split.upcoming.length, split.joined.length, joins.length]);

  const list = joinTab === "upcoming" ? split.upcoming : split.joined;

  const [joinDraft, setJoinDraft] = useState<{ id?: string; name: string; role: JoinRole; startISO: string; location: string; note: string }>({
    name: "",
    role: "Other",
    startISO: "",
    location: "",
    note: "",
  });

  function openNewJoin() {
    setJoinDraft({ name: "", role: "Other", startISO: "", location: "", note: "" });
    if (typeof M !== "undefined") M.toast({ html: "Add a new join below.", classes: "blue-grey darken-1" });
  }

  function submitJoin() {
    const name = joinDraft.name.trim();
    const startISO = joinDraft.startISO.trim();
    if (!name || !startISO) {
      if (typeof M !== "undefined") M.toast({ html: "Name + start date required.", classes: "red" });
      return;
    }

    setJoins((prev) => {
      if (joinDraft.id) {
        return prev.map((j) =>
          j.id === joinDraft.id
            ? {
                ...j,
                name,
                role: joinDraft.role,
                startISO,
                location: joinDraft.location.trim() || undefined,
                note: joinDraft.note.trim() || undefined,
              }
            : j
        );
      }
      return [
        {
          id: id(),
          name,
          role: joinDraft.role,
          startISO,
          location: joinDraft.location.trim() || undefined,
          note: joinDraft.note.trim() || undefined,
        },
        ...prev,
      ];
    });

    setJoinDraft({ name: "", role: "Other", startISO: "", location: "", note: "" });
    if (typeof M !== "undefined") M.toast({ html: joinDraft.id ? "Updated." : "Added.", classes: "green" });
  }

  // ============================================================
  // Styles (Materialize-safe)
  // ============================================================
  const style = (
    <style>{`
      /* --- Global safety vs Materialize input/btn weirdness --- */
      .sticky-panel * { box-sizing: border-box; }
      .sticky-panel input, .sticky-panel select, .sticky-panel button {
        font-family: inherit;
      }
      .sticky-panel input:focus, .sticky-panel select:focus, .sticky-panel button:focus {
        outline: none !important;
      }
      /* Kill Materialize underline + focus shadows on inputs/selects */
      .sticky-panel input:not([type]), 
      .sticky-panel input[type=text],
      .sticky-panel input[type=date],
      .sticky-panel input[type=tel],
      .sticky-panel input[type=email],
      .sticky-panel input[type=number],
      .sticky-panel select {
        border-bottom: none !important;
        box-shadow: none !important;
      }

      .rrCard { border-radius: 18px; overflow: hidden; }
      .rrHeadDark {
        padding: 14px 14px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.10);
        background:
          radial-gradient(850px 240px at 15% 10%, rgba(59,130,246,0.28), transparent 55%),
          radial-gradient(780px 260px at 90% 45%, rgba(34,197,94,0.16), transparent 62%),
          linear-gradient(135deg, #0b1220 0%, #111827 50%, #0b1220 100%);
        color: white;
        position: relative;
      }
      .rrHeadDark::after {
        content:"";
        position:absolute; inset:0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        transform: translateX(-60%);
        animation: rrShimmer 4.6s ease-in-out infinite;
        pointer-events:none;
        opacity: .45;
      }
      @keyframes rrShimmer { 0%{ transform: translateX(-60%);} 50%{ transform: translateX(60%);} 100%{ transform: translateX(60%);} }

      .rrHeadLight {
        padding: 14px 14px 12px;
        border-bottom: 1px solid #edf2f7;
        background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
      }

      .rrTitle { font-weight: 900; font-size: 15px; line-height: 18px; letter-spacing: .1px; }
      .rrSub { font-size: 12px; margin-top: 2px; color: rgba(255,255,255,0.72); font-weight: 700; }
      .rrSubLight { font-size: 12px; margin-top: 2px; color: #607d8b; font-weight: 700; }

      .rrChip {
        font-size: 11px; font-weight: 900;
        padding: 6px 10px; border-radius: 999px;
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.16);
        color: rgba(255,255,255,0.92);
        white-space: nowrap;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .rrChip i { font-size: 16px; line-height: 16px; }

      .rrBtnGhost {
        border-radius: 12px;
        height: 34px;
        padding: 0 12px;
        color: white;
        background: rgba(255,255,255,0.10);
        border: 1px solid rgba(255,255,255,0.16);
        font-weight: 900;
        text-transform: none;
        display: inline-flex; align-items: center; gap: 8px;
        cursor: pointer;
      }
      .rrBtnGhost:hover { background: rgba(255,255,255,0.14); }
      .rrBtnGhost i { font-size: 18px; line-height: 18px; }

      .rrSeg {
        display: inline-flex;
        gap: 6px;
        padding: 6px;
        border-radius: 999px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
      }
      .rrSegBtn {
        height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid transparent;
        background: transparent;
        font-weight: 900;
        color: #0f172a;
        cursor: pointer;
        white-space: nowrap;
      }
      .rrSegBtnActive {
        background: #ffffff;
        border-color: rgba(37,99,235,0.25);
        box-shadow: 0 8px 18px rgba(37,99,235,0.10);
      }

      .rrPrimaryBtn {
        height: 36px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid rgba(16,185,129,0.35);
        background: linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95));
        color: white;
        font-weight: 900;
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 8px;
        box-shadow: 0 10px 22px rgba(16,185,129,0.18);
      }
      .rrPrimaryBtn:hover { filter: brightness(1.02); }

      .rrForm {
        padding: 14px;
        border-bottom: 1px solid #edf2f7;
        background: #fafafa;
      }
      .rrFormGrid {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr;
      }
      @media (min-width: 520px) {
        .rrFormGrid { grid-template-columns: 1fr 1fr; }
      }

      .rrInput, .rrSelect {
        width: 100%;
        height: 40px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        padding: 0 12px;
        font-weight: 800;
        color: #0f172a;
      }
      .rrInput::placeholder { color: #94a3b8; font-weight: 800; }

      .rrFormRow2 {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr;
        margin-top: 10px;
      }
      @media (min-width: 520px) {
        .rrFormRow2 { grid-template-columns: 180px 1fr 140px; }
      }

      .rrSaveBtn {
        height: 40px;
        border-radius: 12px;
        border: 1px solid rgba(37,99,235,0.25);
        background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(29,78,216,0.95));
        color: white;
        font-weight: 900;
        cursor: pointer;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      }

      .rrJoinList { margin: 0; padding: 0; list-style: none; }
      .rrJoinRow {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid #edf2f7;
        background: #fff;
      }
      .rrJoinLeft { padding-top: 2px; }
      .rrJoinDay { font-weight: 900; color: #0f172a; font-size: 12px; }
      .rrJoinBadge { margin-top: 4px; font-size: 11px; color: #64748b; font-weight: 900; }

      .rrJoinMain { min-width: 0; }
      .rrJoinTop {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
      }
      .rrJoinName {
        font-weight: 900;
        color: #0f172a;
        font-size: 13.5px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      .rrPinIcon { font-size: 16px; margin-left: 6px; color: #f59e0b; vertical-align: middle; }

      .rrJoinTopRight {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
      }

      .rrPillRole {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
      }
      .rrPillRole i { font-size: 14px; line-height: 14px; }

      .rrJoinActions {
        display: inline-flex;
        gap: 6px;
      }
      .rrIconBtn {
        width: 34px;
        height: 34px;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        background: #fff;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 18px rgba(0,0,0,0.06);
      }
      .rrIconBtn i { font-size: 18px; color: #2563eb; }
      .rrIconBtn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(0,0,0,0.10); }
      .rrDanger i { color: #ef4444; }

      .rrJoinMeta {
        margin-top: 8px;
        display: grid;
        gap: 6px;
      }
      .rrMetaLine {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #64748b;
        font-weight: 800;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rrMetaLine i { font-size: 16px; line-height: 16px; color: #94a3b8; }

      /* Pulse layout */
      .rrPulseGrid {
        margin-top: 12px;
        display: grid;
        gap: 10px;
      }
      .rrPulseTop {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .rrTimer {
        font-weight: 1000;
        font-size: 22px;
        letter-spacing: .5px;
      }
      .rrPulseBtns {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .rrSliderRow {
        display: grid;
        gap: 10px;
      }
      .rrSliderLine {
        display: grid;
        grid-template-columns: 64px 1fr 48px;
        align-items: center;
        gap: 10px;
        color: rgba(255,255,255,0.80);
        font-weight: 900;
        font-size: 12px;
      }
      .rrSliderLine input[type="range"] { width: 100%; }

      @media (prefers-reduced-motion: reduce) {
        .rrHeadDark::after { animation: none !important; }
        .rrIconBtn { transition: none !important; }
      }
    `}</style>
  );

  return (
    <div className="sticky-panel">
      {style}

      {/* =========================
          1) PULSE (TOP)
         ========================= */}
      <div className="card z-depth-1 rrCard">
        <div className="rrHeadDark">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div className="rrTitle">Pulse</div>
              <div className="rrSub">Focus timer • onboarding rhythm</div>
            </div>
            <span className="rrChip">
              <i className="material-icons">group_add</i>
              Upcoming: {counts.upcoming}
            </span>
          </div>

          <div className="rrPulseGrid">
            <div className="rrPulseTop">
              <span className="rrChip">
                <i className="material-icons">{focus.mode === "focus" ? "center_focus_strong" : "coffee"}</i>
                {focus.mode === "focus" ? "Focus" : "Break"}
              </span>

              <div className="rrTimer">{focus.running ? fmtMMSS(remaining) : `${focus.mode === "focus" ? focus.focusMin : focus.breakMin}:00`}</div>

              <span className="rrChip">
                <i className="material-icons">checklist</i>
                Total: {counts.total}
              </span>
            </div>

            <div className="rrPulseBtns">
              <button className="rrBtnGhost" type="button" onClick={focus.running ? stopFocus : startFocus} title="Start/Pause">
                <i className="material-icons">{focus.running ? "pause" : "play_arrow"}</i>
                {focus.running ? "Pause" : "Start"}
              </button>

              <button className="rrBtnGhost" type="button" onClick={resetFocus} title="Reset">
                <i className="material-icons">restart_alt</i>
                Reset
              </button>

              <button
                className="rrBtnGhost"
                type="button"
                onClick={() => setFocus((p) => ({ ...p, mode: p.mode === "focus" ? "break" : "focus", running: false, endsAt: 0 }))}
                title="Switch mode"
              >
                <i className="material-icons">swap_horiz</i>
                Switch
              </button>
            </div>

            <div className="rrSliderRow">
              <div className="rrSliderLine">
                <span>Focus</span>
                <input
                  type="range"
                  min={10}
                  max={60}
                  step={5}
                  value={focus.focusMin}
                  onChange={(e) => setFocus((p) => ({ ...p, focusMin: Number(e.target.value), running: false, endsAt: 0 }))}
                />
                <span>{focus.focusMin}m</span>
              </div>

              <div className="rrSliderLine">
                <span>Break</span>
                <input
                  type="range"
                  min={3}
                  max={20}
                  step={1}
                  value={focus.breakMin}
                  onChange={(e) => setFocus((p) => ({ ...p, breakMin: Number(e.target.value), running: false, endsAt: 0 }))}
                />
                <span>{focus.breakMin}m</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================
          2) NEW JOINS
         ========================= */}
      <div className="card z-depth-1 rrCard" style={{ marginTop: 12 }}>
        <div className="rrHeadLight">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div className="rrTitle" style={{ color: "#0f172a" }}>
                New Joins
              </div>
              <div className="rrSubLight">Upcoming + Joined history</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div className="rrSeg" role="tablist" aria-label="New Joins Tabs">
                <button
                  className={`rrSegBtn ${joinTab === "upcoming" ? "rrSegBtnActive" : ""}`}
                  type="button"
                  onClick={() => setJoinTab("upcoming")}
                  role="tab"
                  aria-selected={joinTab === "upcoming"}
                >
                  Upcoming ({counts.upcoming})
                </button>
                <button
                  className={`rrSegBtn ${joinTab === "joined" ? "rrSegBtnActive" : ""}`}
                  type="button"
                  onClick={() => setJoinTab("joined")}
                  role="tab"
                  aria-selected={joinTab === "joined"}
                >
                  Joined ({counts.joined})
                </button>
              </div>

              <button className="rrBtnGhost" type="button" onClick={() => setCompactJoins((v) => !v)} title="Toggle compact">
                <i className="material-icons">{compactJoins ? "unfold_more" : "unfold_less"}</i>
                {compactJoins ? "Expand" : "Compact"}
              </button>

              <button className="rrPrimaryBtn" type="button" onClick={openNewJoin} title="Add join">
                <i className="material-icons">person_add</i>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Add / Edit form */}
        <div className="rrForm">
          <div className="rrFormGrid">
            <input className="rrInput" value={joinDraft.name} onChange={(e) => setJoinDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Name" />
            <input className="rrInput" value={joinDraft.startISO} onChange={(e) => setJoinDraft((p) => ({ ...p, startISO: e.target.value }))} placeholder="Start (YYYY-MM-DD)" />
          </div>

          <div className="rrFormRow2">
            <select className="rrSelect" value={joinDraft.role} onChange={(e) => setJoinDraft((p) => ({ ...p, role: e.target.value as JoinRole }))}>
              {(["3D Artist", "Animator", "Programmer", "Designer", "QA", "PM", "Other"] as JoinRole[]).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <input className="rrInput" value={joinDraft.location} onChange={(e) => setJoinDraft((p) => ({ ...p, location: e.target.value }))} placeholder="Location (optional)" />

            <button className="rrSaveBtn" type="button" onClick={submitJoin} title="Save">
              <i className="material-icons">save</i>
              Save
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <input className="rrInput" value={joinDraft.note} onChange={(e) => setJoinDraft((p) => ({ ...p, note: e.target.value }))} placeholder="Note (optional)" />
          </div>
        </div>

        {/* List */}
        <div className="card-content" style={{ padding: 0 }}>
          <ul className="rrJoinList">
            {list.length === 0 ? (
              <li className="rrJoinRow" style={{ gridTemplateColumns: "1fr" }}>
                <div style={{ fontWeight: 900, color: "#607d8b" }}>{joinTab === "upcoming" ? "No upcoming joins." : "No joined history yet."}</div>
              </li>
            ) : (
              list.slice(0, compactJoins ? 5 : 20).map((j) => (
                <JoinRow
                  key={j.id}
                  j={j}
                  tab={joinTab}
                  onPin={() => setJoins((prev) => prev.map((x) => (x.id === j.id ? { ...x, pinned: !x.pinned } : x)))}
                  onEdit={() =>
                    setJoinDraft({
                      id: j.id,
                      name: j.name,
                      role: j.role,
                      startISO: j.startISO,
                      location: j.location || "",
                      note: j.note || "",
                    })
                  }
                  onDelete={() => setJoins((prev) => prev.filter((x) => x.id !== j.id))}
                />
              ))
            )}
          </ul>
        </div>

        <div className="card-action" style={{ padding: "12px 14px", borderTop: "1px solid #edf2f7", background: "#fafafa" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#607d8b", fontWeight: 800 }}>
              Tip: Start dates automatically move people between Upcoming ↔ Joined.
            </span>

            <button
              className="rrIconBtn rrDanger"
              type="button"
              onClick={() => {
                setJoins([]);
                if (typeof M !== "undefined") M.toast({ html: "Cleared joins list.", classes: "red" });
              }}
              title="Reset joins"
            >
              <i className="material-icons">delete_sweep</i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}