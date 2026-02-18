// src/components/EventHero.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

type EventHeroProps = {
  title?: string;
  subtitle?: string;
  at?: Date;

  // visuals
  poster?: string;
  posterAlt?: string;

  // meta
  location?: string;
  host?: string;
  tags?: string[];

  // URLs / callbacks
  joinHref?: string;
  agendaHref?: string;
  calendarHref?: string;
  shareHref?: string; // optional (if you want a landing page)
  onJoin?: () => void;
  onAgenda?: () => void;
  onAddToCalendar?: () => void;
  onShare?: () => void;

  // badges
  status?: "AUTO" | "SCHEDULED" | "LIVE" | "ENDED";

  // enhancements
  timezoneLabel?: string; // e.g. "ET"
  accent?: "auto" | "blue" | "red" | "green" | "purple";
  showProgress?: boolean; // progress bar to start time
  showRemindMe?: boolean; // local reminder toggle (localStorage)
  showMuteMotion?: boolean; // reduces animations if user wants
  storageKey?: string; // unique per event

  // NEW: multiple events
  events?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    at: Date;
    poster?: string;
    location?: string;
    host?: string;
    tags?: string[];
    joinHref?: string;
    agendaHref?: string;
    calendarHref?: string;
    shareHref?: string;
    status?: "AUTO" | "SCHEDULED" | "LIVE" | "ENDED";
  }>;
  activeEventId?: string; // controlled
  defaultActiveIndex?: number; // uncontrolled
  onEventChange?: (eventId: string) => void;

  // NEW: motion that actually happens
  showParallax?: boolean; // pointer parallax + tilt
  showShine?: boolean; // sweeping highlight
  showGlow?: boolean; // subtle animated glow ring
  autoRotateMs?: number; // rotate through events automatically (0 = off)
};

// Default: ~38 days + 15 minutes from now
const DEFAULT_EVENT_AT = new Date(Date.now() + 38 * 86400_000 + 15 * 60_000);

function makeRandomPoster() {
  const sig = Math.floor(Math.random() * 10_000);
  return `https://source.unsplash.com/random/1600x900?team,office,event&sig=${sig}`;
}
const FALLBACK_POSTER = (sig: number) =>
  `https://picsum.photos/seed/event-${sig}/1600/900`;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatWhen(d: Date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();

    timerRef.current = window.setInterval(tick, 1000);

    const onVis = () => {
      if (document.hidden) return;
      tick();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [target.getTime()]);

  const diff = Math.max(0, target.getTime() - now);
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return { d, h, m, s, over: diff <= 0, diffMs: diff, nowMs: now };
}

function safeOpen(href?: string) {
  if (!href) return;
  window.open(href, "_blank", "noopener,noreferrer");
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function buildIcsBlobUrl(args: {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  url?: string;
}) {
  const dt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const yy = d.getUTCFullYear();
    const mm = pad(d.getUTCMonth() + 1);
    const dd = pad(d.getUTCDate());
    const hh = pad(d.getUTCHours());
    const mi = pad(d.getUTCMinutes());
    const ss = pad(d.getUTCSeconds());
    return `${yy}${mm}${dd}T${hh}${mi}${ss}Z`;
  };

  const uid = `event-${Math.random().toString(16).slice(2)}@flukegames`;
  const end = args.end || new Date(args.start.getTime() + 60 * 60_000);

  const escape = (s?: string) =>
    (s || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  const ics =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Fluke Games//EventHero//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dt(new Date())}`,
      `DTSTART:${dt(args.start)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${escape(args.title)}`,
      args.location ? `LOCATION:${escape(args.location)}` : "",
      args.description ? `DESCRIPTION:${escape(args.description)}` : "",
      args.url ? `URL:${escape(args.url)}` : "",
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n") + "\r\n";

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  return URL.createObjectURL(blob);
}

function getAccentGradient(accent: EventHeroProps["accent"]) {
  switch (accent) {
    case "red":
      return "linear-gradient(135deg, rgba(244,67,54,0.26), rgba(244,67,54,0.06))";
    case "green":
      return "linear-gradient(135deg, rgba(76,175,80,0.24), rgba(76,175,80,0.06))";
    case "purple":
      return "linear-gradient(135deg, rgba(156,39,176,0.24), rgba(156,39,176,0.06))";
    case "blue":
      return "linear-gradient(135deg, rgba(33,150,243,0.24), rgba(33,150,243,0.06))";
    case "auto":
    default:
      return "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.04))";
  }
}

/* ============================================================
   REAL MOTION: Parallax + Tilt (smooth rAF)
============================================================ */
function useParallaxTilt(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const raf = useRef<number | null>(null);
  const target = useRef({ rx: 0, ry: 0, tx: 0, ty: 0 });
  const current = useRef({ rx: 0, ry: 0, tx: 0, ty: 0 });

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / Math.max(1, r.width);
      const ny = (e.clientY - r.top) / Math.max(1, r.height);

      // tilt (deg)
      const ry = (nx - 0.5) * 10;
      const rx = -(ny - 0.5) * 8;

      // translation (px)
      const tx = (nx - 0.5) * 12;
      const ty = (ny - 0.5) * 10;

      target.current = { rx, ry, tx, ty };
      el.style.setProperty("--mx", `${nx}`);
      el.style.setProperty("--my", `${ny}`);
    };

    const onLeave = () => {
      target.current = { rx: 0, ry: 0, tx: 0, ty: 0 };
      el.style.setProperty("--mx", `0.5`);
      el.style.setProperty("--my", `0.5`);
    };

    const animate = () => {
      const c = current.current;
      const t = target.current;
      c.rx += (t.rx - c.rx) * 0.14;
      c.ry += (t.ry - c.ry) * 0.14;
      c.tx += (t.tx - c.tx) * 0.12;
      c.ty += (t.ty - c.ty) * 0.12;

      el.style.setProperty("--rx", `${c.rx.toFixed(2)}deg`);
      el.style.setProperty("--ry", `${c.ry.toFixed(2)}deg`);
      el.style.setProperty("--tx", `${c.tx.toFixed(2)}px`);
      el.style.setProperty("--ty", `${c.ty.toFixed(2)}px`);

      raf.current = window.requestAnimationFrame(animate);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    raf.current = window.requestAnimationFrame(animate);

    // init
    el.style.setProperty("--mx", `0.5`);
    el.style.setProperty("--my", `0.5`);
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
    el.style.setProperty("--tx", `0px`);
    el.style.setProperty("--ty", `0px`);

    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf.current) window.cancelAnimationFrame(raf.current);
    };
  }, [enabled]);

  return ref;
}

/* ============================================================
   MAIN
============================================================ */
export default function EventHero({
  // single event inputs (fallback when events not provided)
  title = "Quarterly Company Update",
  subtitle = "Town Hall • Roadmap • AMA",
  at = DEFAULT_EVENT_AT,
  poster,
  posterAlt = "Event banner",
  location = "Online",
  host = "Leadership Team",
  tags = ["Town Hall", "Roadmap", "AMA"],
  joinHref,
  agendaHref,
  calendarHref,
  shareHref,
  onJoin,
  onAgenda,
  onAddToCalendar,
  onShare,
  status = "AUTO",
  timezoneLabel,
  accent = "auto",
  showProgress = true,
  showRemindMe = true,
  showMuteMotion = true,
  storageKey = "eventhero-default",

  // multi events
  events,
  activeEventId,
  defaultActiveIndex = 0,
  onEventChange,

  // motion
  showParallax = true,
  showShine = true,
  showGlow = true,
  autoRotateMs = 0,
}: EventHeroProps) {
  const reducedMotionPref = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  const [muteMotion, setMuteMotion] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(`${storageKey}:muteMotion`);
      return v === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}:muteMotion`, muteMotion ? "1" : "0");
    } catch {}
  }, [muteMotion, storageKey]);

  const motionOff = reducedMotionPref || (showMuteMotion && muteMotion);

  // -------- normalize events --------
  const normalizedEvents = useMemo(() => {
    if (events && events.length) {
      return events.map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: e.subtitle || "",
        at: e.at,
        poster: e.poster,
        location: e.location || "Online",
        host: e.host || "Leadership Team",
        tags: e.tags || [],
        joinHref: e.joinHref,
        agendaHref: e.agendaHref,
        calendarHref: e.calendarHref,
        shareHref: e.shareHref,
        status: e.status || "AUTO",
      }));
    }
    return [
      {
        id: "single",
        title,
        subtitle,
        at,
        poster,
        location,
        host,
        tags,
        joinHref,
        agendaHref,
        calendarHref,
        shareHref,
        status,
      },
    ];
  }, [
    events,
    title,
    subtitle,
    at,
    poster,
    location,
    host,
    tags,
    joinHref,
    agendaHref,
    calendarHref,
    shareHref,
    status,
  ]);

  const isControlled = typeof activeEventId === "string" && activeEventId.length > 0;

  const [internalIndex, setInternalIndex] = useState(() => {
    const i = Math.max(0, Math.min(normalizedEvents.length - 1, defaultActiveIndex));
    return i;
  });

  // keep internal index valid when list changes
  useEffect(() => {
    setInternalIndex((i) => Math.max(0, Math.min(normalizedEvents.length - 1, i)));
  }, [normalizedEvents.length]);

  const controlledIndex = useMemo(() => {
    if (!isControlled) return null;
    const idx = normalizedEvents.findIndex((e) => e.id === activeEventId);
    return idx >= 0 ? idx : 0;
  }, [isControlled, activeEventId, normalizedEvents]);

  const activeIndex = isControlled ? (controlledIndex ?? 0) : internalIndex;
  const active = normalizedEvents[activeIndex];

  const setActiveIndex = (idx: number) => {
    const clamped = Math.max(0, Math.min(normalizedEvents.length - 1, idx));
    if (!isControlled) setInternalIndex(clamped);
    onEventChange?.(normalizedEvents[clamped].id);
  };

  // auto rotate through events
  useEffect(() => {
    if (!autoRotateMs || normalizedEvents.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((activeIndex + 1) % normalizedEvents.length);
    }, autoRotateMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotateMs, normalizedEvents.length, activeIndex]);

  // countdown for active event
  const { d, h, m, s, over, diffMs, nowMs } = useCountdown(active.at);

  // resolved status
  const resolvedStatus: "SCHEDULED" | "LIVE" | "ENDED" = useMemo(() => {
    if (active.status === "LIVE") return "LIVE";
    if (active.status === "ENDED") return "ENDED";
    return over ? "LIVE" : "SCHEDULED";
  }, [active.status, over]);

  // image url + fallback
  const [imgUrl, setImgUrl] = useState<string>(() => active.poster || makeRandomPoster());
  useEffect(() => {
    setImgUrl(active.poster || makeRandomPoster());
  }, [active.poster, active.id]);

  const onImgError = () => {
    const sig = Math.floor(Math.random() * 10_000);
    setImgUrl(FALLBACK_POSTER(sig));
  };

  const whenText = useMemo(() => formatWhen(active.at), [active.at]);
  const whenWithTz = timezoneLabel ? `${whenText} (${timezoneLabel})` : whenText;

  // ---- progress window (7 days) ----
  const progress = useMemo(() => {
    const windowMs = 7 * 86400_000;
    const startWindow = active.at.getTime() - windowMs;
    const p = (nowMs - startWindow) / windowMs;
    return clamp01(p);
  }, [active.at, nowMs]);

  // ---- Remind Me (local only) ----
  const [remindOn, setRemindOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`${storageKey}:remindOn`) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(`${storageKey}:remindOn`, remindOn ? "1" : "0");
    } catch {}
  }, [remindOn, storageKey]);

  const reminderState = useMemo(() => {
    if (!remindOn) return "OFF" as const;
    if (resolvedStatus !== "SCHEDULED") return "OFF" as const;
    if (diffMs <= 10 * 60_000) return "NOW" as const;
    if (diffMs <= 60 * 60_000) return "SOON" as const;
    return "ON" as const;
  }, [remindOn, resolvedStatus, diffMs]);

  // ---- Calendar: auto-generate .ics if no calendarHref ----
  const [icsUrl, setIcsUrl] = useState<string | null>(null);
  useEffect(() => {
    if (active.calendarHref) return;

    const url = buildIcsBlobUrl({
      title: active.title,
      description: active.subtitle,
      location: active.location,
      start: active.at,
      end: new Date(active.at.getTime() + 60 * 60_000),
      url: active.shareHref || active.joinHref,
    });
    setIcsUrl(url);

    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };
  }, [
    active.calendarHref,
    active.title,
    active.subtitle,
    active.location,
    active.at,
    active.shareHref,
    active.joinHref,
    active.id,
  ]);

  const doAddToCalendar = () => {
    if (onAddToCalendar) return onAddToCalendar();
    if (active.calendarHref) return safeOpen(active.calendarHref);
    if (icsUrl) return safeOpen(icsUrl);
  };

  const [copied, setCopied] = useState(false);

  const doShare = async () => {
    if (onShare) return onShare();
    const url = active.shareHref || shareHref || window.location.href;
    const text = `${active.title} — ${whenText}`;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav: any = navigator;
      if (nav.share) {
        await nav.share({ title: active.title, text, url });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      safeOpen(url);
    }
  };

  const joinDisabled = resolvedStatus === "ENDED";
  const joinTone: "red" | "blue" | "grey" =
    resolvedStatus === "LIVE" ? "red" : resolvedStatus === "SCHEDULED" ? "blue" : "grey";

  const accentBg = getAccentGradient(accent);

  // REAL motion hooks
  const tiltRef = useParallaxTilt(!motionOff && showParallax);

  // small helper to switch events
  const gotoPrev = () => setActiveIndex(activeIndex - 1);
  const gotoNext = () => setActiveIndex(activeIndex + 1);

  // title/meta derived from active event
  const displayTitle = active.title;
  const displaySubtitle = active.subtitle || "";
  const displayLocation = active.location || "Online";
  const displayHost = active.host || "Leadership Team";
  const displayTags = active.tags || [];

  // button handlers (prefer callbacks from props; then active)
  const doJoin = () => (onJoin ? onJoin() : safeOpen(active.joinHref));
  const doAgenda = () => (onAgenda ? onAgenda() : safeOpen(active.agendaHref));

  return (
    <div
      ref={tiltRef}
      className="card hoverable"
      style={{
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 14px 34px rgba(0,0,0,0.10), 0 3px 12px rgba(0,0,0,0.08)",
        transform: !motionOff && showParallax
          ? "perspective(900px) rotateX(var(--rx)) rotateY(var(--ry))"
          : undefined,
        transition: motionOff ? undefined : "transform 180ms ease, box-shadow 180ms ease",
        willChange: motionOff ? undefined : "transform",
      }}
    >
      {/* Real animations (shine, glow, live pulse) */}
      <style>
        {`
          @keyframes eh_shineSweep {
            0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
            18%  { opacity: 0.22; }
            55%  { opacity: 0.22; }
            100% { transform: translateX(140%) skewX(-18deg); opacity: 0; }
          }
          @keyframes eh_glow {
            0%,100% { opacity: 0.45; filter: blur(10px); }
            50%     { opacity: 0.75; filter: blur(14px); }
          }
          @keyframes eh_livePulse {
            0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,82,82,0.35); }
            70%  { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255,82,82,0.00); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,82,82,0.00); }
          }
          .eh-bg {
            transform: scale(1.04) translate3d(var(--tx), var(--ty), 0);
            transition: ${motionOff ? "none" : "transform 350ms ease"};
            will-change: transform;
          }
        `}
      </style>

      {/* Banner */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 320,
          overflow: "hidden",
          background: "#eee",
        }}
      >
        {/* background image */}
        <img
          className="eh-bg"
          src={imgUrl}
          onError={onImgError}
          alt={posterAlt}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(1.05) contrast(1.02)",
          }}
        />

        {/* overlays */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(1200px 520px at 18% 12%, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0.02) 72%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.35) 48%, rgba(0,0,0,0.82) 100%)",
          }}
        />

        {/* glow ring */}
        {!motionOff && showGlow && (
          <div
            style={{
              position: "absolute",
              inset: -30,
              pointerEvents: "none",
              background:
                "radial-gradient(600px 300px at calc(var(--mx,0.5) * 100%) calc(var(--my,0.5) * 100%), rgba(255,255,255,0.18), rgba(255,255,255,0.00) 60%)",
              animation: "eh_glow 3.6s ease-in-out infinite",
              mixBlendMode: "screen",
            }}
          />
        )}

        {/* shine sweep */}
        {!motionOff && showShine && (
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "40%",
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.18), rgba(255,255,255,0.00))",
                animation: "eh_shineSweep 4.8s ease-in-out infinite",
              }}
            />
          </div>
        )}

        {/* Top row: status + controls */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <StatusPill status={resolvedStatus} livePulse={!motionOff} />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* multi-event nav */}
            {normalizedEvents.length > 1 && (
              <>
                <IconBtn
                  icon="chevron_left"
                  label="Previous event"
                  onClick={gotoPrev}
                  disabled={activeIndex <= 0}
                />
                <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 900 }}>
                  {activeIndex + 1}/{normalizedEvents.length}
                </div>
                <IconBtn
                  icon="chevron_right"
                  label="Next event"
                  onClick={gotoNext}
                  disabled={activeIndex >= normalizedEvents.length - 1}
                />
              </>
            )}

            {showMuteMotion && (
              <IconToggle
                icon={muteMotion ? "motion_photos_off" : "motion_photos_on"}
                label={muteMotion ? "Motion off" : "Motion on"}
                active={muteMotion}
                onClick={() => setMuteMotion((v) => !v)}
              />
            )}
            {showRemindMe && (
              <IconToggle
                icon={remindOn ? "notifications_active" : "notifications_none"}
                label={remindOn ? "Remind on" : "Remind me"}
                active={remindOn}
                onClick={() => setRemindOn((v) => !v)}
              />
            )}
            <IconBtn
              icon={copied ? "check" : "share"}
              label={copied ? "Copied" : "Share"}
              onClick={doShare}
            />
          </div>
        </div>

        {/* Bottom content */}
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 16,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 14,
            alignItems: "end",
            color: "white",
          }}
        >
          {/* Title stack */}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 950,
                fontSize: 24,
                letterSpacing: 0.2,
                lineHeight: 1.12,
                textShadow: "0 2px 10px rgba(0,0,0,0.35)",
              }}
            >
              {displayTitle}
            </div>
            <div
              style={{
                marginTop: 6,
                opacity: 0.92,
                fontSize: 13,
                lineHeight: 1.35,
                textShadow: "0 2px 10px rgba(0,0,0,0.25)",
              }}
            >
              {displaySubtitle}
            </div>

            {/* Meta chips */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                opacity: 0.95,
              }}
            >
              <MetaChip icon="schedule" text={whenWithTz} />
              <MetaChip icon="place" text={displayLocation} />
              <MetaChip icon="groups" text={displayHost} />
            </div>

            {/* Tags */}
            {!!displayTags?.length && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {displayTags.slice(0, 6).map((t) => (
                  <TagPill key={t} text={t} />
                ))}
              </div>
            )}

            {/* NEW: quick selector pills */}
            {normalizedEvents.length > 1 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {normalizedEvents.slice(0, 5).map((e, idx) => {
                  const activePill = idx === activeIndex;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className="btn-flat"
                      onClick={() => setActiveIndex(idx)}
                      title={e.title}
                      style={{
                        height: 30,
                        padding: "0 10px",
                        borderRadius: 999,
                        background: activePill ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        color: "white",
                        fontSize: 11,
                        fontWeight: 900,
                        letterSpacing: 0.2,
                        cursor: "pointer",
                      }}
                    >
                      {idx + 1}. {e.title.length > 18 ? e.title.slice(0, 18) + "…" : e.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: countdown + progress */}
          <div
            style={{
              background: accentBg,
              border: "1px solid rgba(255,255,255,0.24)",
              borderRadius: 16,
              padding: "12px 12px",
              backdropFilter: "blur(10px)",
              minWidth: 320,
              boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
            }}
          >
            {resolvedStatus === "LIVE" ? (
              <LiveRow livePulse={!motionOff} />
            ) : resolvedStatus === "ENDED" ? (
              <EndedRow when={whenText} />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontSize: 11, opacity: 0.9 }}>Starts in</div>
                  {reminderState === "NOW" && <InlineBadge text="Starting very soon" tone="red" />}
                  {reminderState === "SOON" && <InlineBadge text="Within 1 hour" tone="amber" />}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <TimeBox label="Days" value={d} wide />
                  <TimeBox label="Hours" value={h} />
                  <TimeBox label="Mins" value={m} />
                  <TimeBox label="Secs" value={s} />
                </div>

                {showProgress && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 10,
                        opacity: 0.9,
                      }}
                    >
                      <span>Countdown window</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        marginTop: 6,
                        background: "rgba(255,255,255,0.18)",
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(4, progress * 100)}%`,
                          borderRadius: 999,
                          background:
                            "linear-gradient(90deg, rgba(255,255,255,0.65), rgba(255,255,255,0.22))",
                          transition: motionOff ? undefined : "width 500ms ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Remind banner */}
      {showRemindMe && remindOn && resolvedStatus === "SCHEDULED" && reminderState !== "ON" && (
        <div
          style={{
            padding: "10px 14px",
            background: reminderState === "NOW" ? "rgba(244,67,54,0.10)" : "rgba(255,193,7,0.10)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <i className="material-icons" style={{ fontSize: 18, opacity: 0.8 }}>
            {reminderState === "NOW" ? "campaign" : "notifications"}
          </i>
          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.78)" }}>
            {reminderState === "NOW"
              ? "Reminder: the event starts very soon."
              : "Reminder: the event starts within the next hour."}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button
              type="button"
              className="btn-flat"
              style={{ fontWeight: 800 }}
              onClick={() => setRemindOn(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "rgba(0,0,0,0.70)", fontSize: 13 }}>
            {resolvedStatus === "SCHEDULED" ? (
              <>Join on time — updates, roadmap, and Q&amp;A.</>
            ) : resolvedStatus === "LIVE" ? (
              <>We’re live. Jump in and ask questions in chat.</>
            ) : (
              <>Event ended. Use agenda for recap / notes.</>
            )}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <ActionBtn
              tone={joinTone}
              icon="ondemand_video"
              label={resolvedStatus === "LIVE" ? "Join Live" : "Join Stream"}
              disabled={joinDisabled}
              onClick={doJoin}
            />
            <ActionBtn tone="grey" icon="description" label="Agenda" onClick={doAgenda} />
            <ActionBtn tone="light" icon="event" label="Calendar (.ics)" onClick={doAddToCalendar} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ components ------------------------------ */

function StatusPill({
  status,
  livePulse,
}: {
  status: "SCHEDULED" | "LIVE" | "ENDED";
  livePulse: boolean;
}) {
  const cfg =
    status === "LIVE"
      ? { bg: "rgba(244,67,54,0.92)", icon: "radio_button_checked", text: "LIVE" }
      : status === "ENDED"
      ? { bg: "rgba(0,0,0,0.58)", icon: "done", text: "ENDED" }
      : { bg: "rgba(255,255,255,0.16)", icon: "schedule", text: "UPCOMING" };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        background: cfg.bg,
        border: "1px solid rgba(255,255,255,0.26)",
        color: "white",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
      }}
    >
      {status === "LIVE" ? (
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "#ff5252",
            animation: livePulse ? "eh_livePulse 1.4s ease-out infinite" : undefined,
          }}
        />
      ) : (
        <i className="material-icons" style={{ fontSize: 16 }}>
          {cfg.icon}
        </i>
      )}
      <span style={{ fontWeight: 950, fontSize: 12, letterSpacing: 0.7 }}>{cfg.text}</span>
    </div>
  );
}

function MetaChip({ icon, text }: { icon: string; text: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.22)",
        backdropFilter: "blur(8px)",
        maxWidth: "100%",
      }}
      title={text}
    >
      <i className="material-icons" style={{ fontSize: 16, opacity: 0.95 }}>
        {icon}
      </i>
      <span
        style={{
          fontSize: 12,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          opacity: 0.95,
        }}
      >
        {text}
      </span>
    </div>
  );
}

function TagPill({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.20)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.2,
        backdropFilter: "blur(8px)",
      }}
    >
      {text}
    </div>
  );
}

function TimeBox({
  label,
  value,
  wide,
}: {
  label: string;
  value: number;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        minWidth: wide ? 78 : 58,
        background: "rgba(255,255,255,0.14)",
        borderRadius: 12,
        padding: "8px 10px",
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1, letterSpacing: 0.6 }}>
        {pad2(value)}
      </div>
      <div style={{ fontSize: 10, opacity: 0.95, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function InlineBadge({ text, tone }: { text: string; tone: "red" | "amber" }) {
  const bg = tone === "red" ? "rgba(244,67,54,0.35)" : "rgba(255,193,7,0.35)";
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 0.4,
        background: bg,
        border: "1px solid rgba(255,255,255,0.22)",
      }}
    >
      {text}
    </span>
  );
}

function LiveRow({ livePulse }: { livePulse: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: "#ff5252",
          animation: livePulse ? "eh_livePulse 1.4s ease-out infinite" : undefined,
        }}
      />
      <div style={{ fontWeight: 950, letterSpacing: 0.6 }}>LIVE NOW</div>
      <div style={{ marginLeft: "auto", opacity: 0.9, fontSize: 12 }}>Join anytime</div>
    </div>
  );
}

function EndedRow({ when }: { when: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <i className="material-icons" style={{ fontSize: 18, opacity: 0.95 }}>
        done_all
      </i>
      <div style={{ fontWeight: 950 }}>Event ended</div>
      <div style={{ marginLeft: "auto", opacity: 0.9, fontSize: 12 }}>{when}</div>
    </div>
  );
}

function ActionBtn({
  tone,
  icon,
  label,
  disabled,
  onClick,
}: {
  tone: "red" | "blue" | "grey" | "light";
  icon: string;
  label: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className =
    tone === "red"
      ? "btn waves-effect waves-light red lighten-1"
      : tone === "blue"
      ? "btn waves-effect waves-light blue"
      : tone === "grey"
      ? "btn waves-effect waves-light grey lighten-1 black-text"
      : "btn waves-effect waves-light white black-text";

  const style: React.CSSProperties =
    tone === "light" ? { border: "1px solid rgba(0,0,0,0.12)", boxShadow: "none" } : {};

  return (
    <button
      type="button"
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 12,
        paddingLeft: 14,
        paddingRight: 14,
        ...style,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      <i className="material-icons" style={{ fontSize: 18 }}>
        {icon}
      </i>
      <span style={{ fontWeight: 900 }}>{label}</span>
    </button>
  );
}

function IconBtn({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-flat"
      onClick={disabled ? undefined : onClick}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: 999,
        background: disabled ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        backdropFilter: "blur(8px)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      disabled={disabled}
    >
      <i className="material-icons" style={{ fontSize: 20 }}>
        {icon}
      </i>
    </button>
  );
}

function IconToggle({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="btn-flat"
      onClick={onClick}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: 999,
        background: active ? "rgba(33,150,243,0.26)" : "rgba(255,255,255,0.14)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "white",
        backdropFilter: "blur(8px)",
        cursor: "pointer",
      }}
    >
      <i className="material-icons" style={{ fontSize: 18 }}>
        {icon}
      </i>
    </button>
  );
}
