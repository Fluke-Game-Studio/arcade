import { useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type ApiUpdateSummary,
  type ApiUpdatesResponse,
  type ApiUser,
} from "../api";

declare const M: any;

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function norm(v: any) {
  return safeStr(v).toLowerCase();
}

function mondayISO(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalISO(iso: string) {
  const raw = safeStr(iso);
  if (!raw) return null;
  const [y, m, d] = raw.split("-").map((part) => Number(part));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toLocalISODate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatWeekLabel(weekStart: string) {
  const start = parseLocalISO(weekStart);
  if (!start) return weekStart || "No week selected";
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameMonth ? undefined : "numeric",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} - ${endLabel}`;
}

function toMaterializeEventDate(dateIso: string) {
  const date = parseLocalISO(dateIso);
  return date ? date.toDateString() : "";
}

function restorePageScroll() {
  try {
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  } catch {}
}

function decorateMaterializeCalendar(instance: any, highlightedDateSet: Set<string>) {
  const root = instance?.calendarEl as HTMLElement | null;
  if (!root) return;

  const rows = Array.from(root.querySelectorAll("tbody tr"));

  rows.forEach((row) => {
    row.classList.remove("activity-week-row", "activity-week-row--submitted", "activity-week-row--selected");

    const cells = Array.from(row.querySelectorAll("td"));

    cells.forEach((cell) => {
      cell.classList.remove("activity-submit-day");
      const button = cell.querySelector<HTMLButtonElement>(".datepicker-day-button");
      if (!button) return;

      const year = Number(button.getAttribute("data-year"));
      const month = Number(button.getAttribute("data-month"));
      const day = Number(button.getAttribute("data-day"));
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return;

      const date = new Date(year, month, day);
      const dateIso = toLocalISODate(date);
      if (highlightedDateSet.has(dateIso)) {
        cell.classList.add("activity-submit-day");
      }
    });
  });
}

function normalizeAttachments(value: any) {
  if (!Array.isArray(value)) return [];
  return value
    .map((a: any, idx: number) => {
      const name = safeStr(a?.name || a?.fileName || a?.title || `Attachment ${idx + 1}`);
      const publicUrl = safeStr(a?.publicUrl || a?.url);
      const youtubeUrl = safeStr(a?.youtubeUrl);
      const youtubeVideoId = safeStr(a?.youtubeVideoId);
      const s3Key = safeStr(a?.s3Key);
      if (!name && !publicUrl && !youtubeUrl && !youtubeVideoId && !s3Key) return null;
      return {
        name: name || `Attachment ${idx + 1}`,
        mimeType: safeStr(a?.mimeType),
        size: safeNum(a?.size),
        s3Key,
        publicUrl,
        youtubeUrl,
        youtubeVideoId,
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    mimeType?: string;
    size?: number;
    s3Key?: string;
    publicUrl?: string;
    youtubeUrl?: string;
    youtubeVideoId?: string;
  }>;
}

function attachmentHref(a: {
  publicUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
}) {
  if (safeStr(a?.publicUrl)) return safeStr(a?.publicUrl);
  if (safeStr(a?.youtubeUrl)) return safeStr(a?.youtubeUrl);
  if (safeStr(a?.youtubeVideoId)) return `https://www.youtube.com/watch?v=${safeStr(a?.youtubeVideoId)}`;
  return "";
}

function isLikelyUnsignedPrivateS3Url(url: string) {
  const u = safeStr(url);
  if (!u) return false;
  try {
    const parsed = new URL(u);
    const host = parsed.hostname.toLowerCase();
    const looksLikeS3 =
      host.endsWith(".s3.amazonaws.com") ||
      host.includes(".s3.") ||
      host === "s3.amazonaws.com";
    if (!looksLikeS3) return false;
    const hasSignature =
      parsed.searchParams.has("X-Amz-Signature") ||
      parsed.searchParams.has("x-amz-signature");
    return !hasSignature;
  } catch {
    return false;
  }
}

function attachmentPreviewKind(a: {
  mimeType?: string;
  publicUrl?: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
}) {
  const mime = safeStr(a?.mimeType).toLowerCase();
  const href = attachmentHref(a).toLowerCase();
  if (safeStr(a?.youtubeUrl) || safeStr(a?.youtubeVideoId)) return "youtube";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(href)) return "image";
  if (mime.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(href)) return "video";
  if (mime.includes("pdf") || /\.pdf(\?|$)/i.test(href)) return "pdf";
  return "none";
}

function activityYoutubeEmbed(a: { youtubeUrl?: string; youtubeVideoId?: string }) {
  const id = safeStr(a?.youtubeVideoId);
  if (id) return `https://www.youtube.com/embed/${id}`;
  const raw = safeStr(a?.youtubeUrl);
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const v = safeStr(u.searchParams.get("v"));
    if (v) return `https://www.youtube.com/embed/${v}`;
  } catch {}
  return "";
}

function toast(html: string, classes = "") {
  try {
    M?.toast?.({ html, classes });
  } catch {
    console.log(html);
  }
}

function colorForHours(hours: number) {
  if (hours >= 5) {
    return {
      bg: "linear-gradient(135deg, #166534 0%, #15803d 100%)",
      text: "#ecfdf5",
      border: "rgba(22,101,52,.40)",
    };
  }
  if (hours >= 3) {
    return {
      bg: "linear-gradient(135deg, #86efac 0%, #4ade80 100%)",
      text: "#14532d",
      border: "rgba(34,197,94,.35)",
    };
  }
  if (hours >= 1) {
    return {
      bg: "linear-gradient(135deg, #d9f99d 0%, #bef264 100%)",
      text: "#365314",
      border: "rgba(132,204,22,.35)",
    };
  }
  return {
    bg: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    text: "#64748b",
    border: "rgba(148,163,184,.28)",
  };
}

async function callAdminActivityReportReminders(body: any) {
  const anyApi = api as any;

  if (typeof anyApi.sendAdminActivityReportReminders === "function") {
    return await anyApi.sendAdminActivityReportReminders(body);
  }

  if (typeof anyApi.post === "function") {
    return await anyApi.post("/admin/mail/activity-report-reminders", body);
  }

  if (typeof anyApi.request === "function") {
    return await anyApi.request("/admin/mail/activity-report-reminders", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  throw new Error("Activity report reminder API is not wired on the client.");
}

function getUserKey(user: Partial<ApiUser>) {
  return (
    norm((user as any)?.username) ||
    norm((user as any)?.employee_username) ||
    norm((user as any)?.employee_email) ||
    norm((user as any)?.email)
  );
}

function getUserName(user: Partial<ApiUser>) {
  return (
    safeStr((user as any)?.employee_name) ||
    safeStr((user as any)?.name) ||
    safeStr((user as any)?.username) ||
    safeStr((user as any)?.employee_email) ||
    "Unknown"
  );
}

function getUserEmail(user: Partial<ApiUser>) {
  return (
    safeStr((user as any)?.employee_email) ||
    safeStr((user as any)?.email) ||
    ""
  );
}

function getUserRole(user: Partial<ApiUser>) {
  return norm((user as any)?.employee_role || (user as any)?.role || "employee");
}

function isRevoked(user: Partial<ApiUser>) {
  return (
    (user as any)?.revoked === true ||
    (user as any)?.is_revoked === true ||
    norm((user as any)?.status) === "revoked" ||
    norm((user as any)?.employment_status) === "revoked"
  );
}

function getSummaryKey(summary: Partial<ApiUpdateSummary>) {
  return norm((summary as any)?.userId || (summary as any)?.userName);
}

function hasTimesheet(summary: Partial<ApiUpdateSummary>) {
  const rows = Array.isArray((summary as any)?.timesheet)
    ? (summary as any).timesheet
    : [];

  if (rows.length > 0) {
    const total = rows.reduce(
      (acc: number, row: any) => acc + safeNum(row?.hours),
      0
    );
    if (total > 0) return true;
  }

  return safeNum((summary as any)?.totalHours) > 0;
}

function hasRetro(summary: Partial<ApiUpdateSummary>) {
  const retro = (summary as any)?.retrospective || {};
  const worked = Array.isArray(retro?.worked) ? retro.worked : [];
  const didnt = Array.isArray(retro?.didnt) ? retro.didnt : [];
  const improve = Array.isArray(retro?.improve) ? retro.improve : [];
  return worked.length > 0 || didnt.length > 0 || improve.length > 0;
}

function MetricChip({
  icon,
  label,
  value,
  tint = "#e2e8f0",
  color = "#0f172a",
}: {
  icon: string;
  label: string;
  value: string;
  tint?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: tint,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <i className="material-icons" style={{ fontSize: 16 }}>
        {icon}
      </i>
      <span>{label}</span>
      <span style={{ opacity: 0.9 }}>{value}</span>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  sublabel,
  tone = "blue",
}: {
  label: string;
  value: number | string;
  sublabel?: string;
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "purple";
}) {
  const toneBg =
    tone === "green"
      ? "rgba(34,197,94,.10)"
      : tone === "amber"
      ? "rgba(245,158,11,.10)"
      : tone === "red"
      ? "rgba(239,68,68,.10)"
      : tone === "purple"
      ? "rgba(168,85,247,.10)"
      : tone === "slate"
      ? "rgba(100,116,139,.10)"
      : "rgba(59,130,246,.10)";

  const toneBorder =
    tone === "green"
      ? "rgba(34,197,94,.18)"
      : tone === "amber"
      ? "rgba(245,158,11,.18)"
      : tone === "red"
      ? "rgba(239,68,68,.18)"
      : tone === "purple"
      ? "rgba(168,85,247,.18)"
      : tone === "slate"
      ? "rgba(100,116,139,.18)"
      : "rgba(59,130,246,.18)";

  return (
    <div
      style={{
        borderRadius: 18,
        border: `1px solid ${toneBorder}`,
        background: `linear-gradient(180deg, ${toneBg}, #fff 76%)`,
        padding: 14,
        boxShadow: "0 10px 22px rgba(15,23,42,.04)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 900,
          letterSpacing: 0.08,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          lineHeight: 1,
          fontWeight: 1000,
          color: "#0f172a",
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      {!!sublabel && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#64748b",
            fontWeight: 700,
            lineHeight: 1.45,
          }}
        >
          {sublabel}
        </div>
      )}
    </div>
  );
}

function DonutChart({
  value,
  total,
  label,
  sublabel,
  tone = "blue",
}: {
  value: number;
  total: number;
  label: string;
  sublabel?: string;
  tone?: "blue" | "green" | "amber" | "purple" | "red";
}) {
  const pct = total > 0 ? clamp01(value / total) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;

  const color =
    tone === "green"
      ? "#22c55e"
      : tone === "amber"
      ? "#f59e0b"
      : tone === "purple"
      ? "#a855f7"
      : tone === "red"
      ? "#ef4444"
      : "#3b82f6";

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10, minWidth: 0 }}>
      <div style={{ position: "relative", width: 112, height: 112 }}>
        <svg width="112" height="112" viewBox="0 0 112 112">
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke="rgba(148,163,184,0.18)"
            strokeWidth="12"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform="rotate(-90 56 56)"
          />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            textAlign: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, color: "#0f172a", lineHeight: 1 }}>
              {Math.round(pct * 100)}%
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 0.08,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              {value}/{total}
            </div>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#102033" }}>{label}</div>
        {!!sublabel && (
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  items,
  valueKey,
  labelKey,
  color = "linear-gradient(90deg,#60a5fa,#3b82f6)",
  suffix = "",
}: {
  title: string;
  items: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  suffix?: string;
}) {
  const rows = items.slice(0, 5);
  const max = Math.max(1, ...rows.map((x) => safeNum(x[valueKey])));

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #e5edf4",
        background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 12 }}>
        {title}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((row, idx) => {
          const raw = safeNum(row[valueKey]);
          const pct = clamp01(raw / max);
          const label = safeStr(row[labelKey]) || `Item ${idx + 1}`;

          return (
            <div key={`${label}-${idx}`} style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 5,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    color: "#334155",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                  title={label}
                >
                  {label}
                </span>
                <span style={{ color: "#64748b", fontWeight: 900, whiteSpace: "nowrap" }}>
                  {raw}
                  {suffix}
                </span>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.15)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.max(6, pct * 100)}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function weekDatesFromMonday(mondayIso: string) {
  const start = new Date(`${mondayIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return [];

  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

function weekdayShort(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function formatDateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function HeatmapGrid({
  weekStart,
  timesheet,
}: {
  weekStart: string;
  timesheet: { date: string; hours: number }[];
}) {
  const byDate = new Map<string, number>();

  for (const row of timesheet || []) {
    const date = safeStr(row?.date);
    const hours = Number(row?.hours || 0) || 0;
    if (!date) continue;
    byDate.set(date, (byDate.get(date) || 0) + hours);
  }

  const days = weekDatesFromMonday(weekStart);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0,1fr))",
        gap: 8,
      }}
    >
      {days.map((date) => {
        const hours = Number(byDate.get(date) || 0);
        const tone = colorForHours(hours);

        return (
          <div
            key={date}
            style={{
              borderRadius: 14,
              border: `1px solid ${tone.border}`,
              background: tone.bg,
              color: tone.text,
              minHeight: 56,
              padding: "6px 4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 800 }}>{weekdayShort(date)}</div>
            <div style={{ fontSize: 12, fontWeight: 900 }}>
              {hours > 0 ? hours.toFixed(1) : "—"}
            </div>
            <div style={{ fontSize: 10 }}>{formatDateLabel(date)}</div>
          </div>
        );
      })}
    </div>
  );
}

function HeatmapPopover({
  weekStart,
  timesheet,
}: {
  weekStart: string;
  timesheet: { date: string; hours: number }[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "calc(100% + 10px)",
        width: 300,
        zIndex: 9999,
        background: "rgba(255,255,255,.98)",
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
        }}
      >
        Weekly Time Heatmap
      </div>
      <HeatmapGrid weekStart={weekStart} timesheet={timesheet} />
    </div>
  );
}

function CompactListCell({
  count,
  tone = "blue",
}: {
  count: number;
  tone?: "blue" | "amber" | "green" | "red" | "slate";
}) {
  const bg =
    tone === "amber"
      ? "rgba(245,158,11,.12)"
      : tone === "green"
      ? "rgba(34,197,94,.12)"
      : tone === "red"
      ? "rgba(239,68,68,.12)"
      : tone === "slate"
      ? "rgba(148,163,184,.12)"
      : "rgba(59,130,246,.10)";

  const color =
    tone === "amber"
      ? "#b45309"
      : tone === "green"
      ? "#166534"
      : tone === "red"
      ? "#b91c1c"
      : tone === "slate"
      ? "#475569"
      : "#1d4ed8";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        padding: "7px 11px",
        borderRadius: 999,
        background: bg,
        color,
        fontWeight: 900,
        fontSize: 12,
      }}
    >
      {count}
    </span>
  );
}

type MissingSection = "update" | "timesheet" | "retro";

type MissingReasons = {
  update: boolean;
  timesheet: boolean;
  retro: boolean;
};

function InfoBlock({
  title,
  value,
}: {
  title: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,.14)",
        background: "#fff",
        padding: 18,
        width: 300
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          color: "#64748b",
          fontWeight: 900,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  );
}

function DetailList({
  title,
  items,
  empty = "No items",
}: {
  title: string;
  items: string[];
  empty?: string;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.14)",
        background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
        padding: 14,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>
        {title}
      </div>

      {!items.length ? (
        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>{empty}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item, idx) => (
            <div
              key={`${title}-${idx}`}
              style={{
                padding: "9px 11px",
                borderRadius: 12,
                background: "#f8fafc",
                border: "1px solid rgba(148,163,184,.12)",
                fontSize: 13,
                color: "#334155",
                fontWeight: 700,
                lineHeight: 1.45,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
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

function SubmissionWeekCalendar({
  highlightedDates,
  selectedWeek,
  visibleMonth,
  onSelectDate,
  onRequestClose,
}: {
  highlightedDates: string[];
  selectedWeek: string;
  visibleMonth: Date;
  onSelectDate: (dateIso: string) => void;
  onRequestClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const instanceRef = useRef<any>(null);
  const highlightedDateSet = useMemo(
    () => new Set(highlightedDates.map(safeStr).filter(Boolean)),
    [highlightedDates]
  );
  const highlightedDateSetRef = useRef(highlightedDateSet);
  const onSelectDateRef = useRef(onSelectDate);
  const onRequestCloseRef = useRef(onRequestClose);

  useEffect(() => {
    highlightedDateSetRef.current = highlightedDateSet;
    onSelectDateRef.current = onSelectDate;
    onRequestCloseRef.current = onRequestClose;
  }, [highlightedDateSet, onRequestClose, onSelectDate]);

  useEffect(() => {
    if (!inputRef.current || typeof M === "undefined" || !M?.Datepicker) return;

    const initialDate = parseLocalISO(selectedWeek) || visibleMonth || new Date();
    const instance = M.Datepicker.init(inputRef.current, {
      autoClose: true,
      format: "yyyy-mm-dd",
      defaultDate: initialDate,
      setDefaultDate: true,
      firstDay: 1,
      showDaysInNextAndPreviousMonths: true,
      yearRange: [2024, 2030],
      events: Array.from(highlightedDateSetRef.current).map(toMaterializeEventDate).filter(Boolean),
      onDraw(instance: any) {
        decorateMaterializeCalendar(instance, highlightedDateSetRef.current);
      },
      onOpen() {
        decorateMaterializeCalendar(this, highlightedDateSetRef.current);
      },
      onClose() {
        restorePageScroll();
        onRequestCloseRef.current();
      },
      onSelect(selectedDate: Date) {
        onSelectDateRef.current(toLocalISODate(selectedDate));
      },
    });

    instanceRef.current = instance;
    try {
      instance.gotoDate(initialDate);
      instance.open();
    } catch {}

    return () => {
      try {
        restorePageScroll();
        instanceRef.current?.destroy?.();
      } catch {}
      restorePageScroll();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;

    const nextDate = parseLocalISO(selectedWeek) || visibleMonth || new Date();
    instance.options.events = Array.from(highlightedDateSet).map(toMaterializeEventDate).filter(Boolean);
    try {
      instance.gotoDate(nextDate);
      instance.draw?.(true);
      decorateMaterializeCalendar(instance, highlightedDateSet);
    } catch {}
  }, [highlightedDateSet, selectedWeek, visibleMonth]);

  return (
    <>
      <style>{`
        .activity-materialize-anchor {
          position: fixed;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }
        .activity-calendar-toggle,
        .activity-calendar-toggle:hover,
        .activity-calendar-toggle:focus,
        .activity-calendar-toggle:active {
          border: 0 !important;
          background: linear-gradient(135deg, #2db7ad 0%, #1fa99f 100%) !important;
          background-color: #2db7ad !important;
          color: #ffffff !important;
          box-shadow: 0 10px 18px rgba(31, 169, 159, 0.24) !important;
          border-radius: 12px !important;
          text-transform: none !important;
          font-weight: 900 !important;
          height: auto !important;
          line-height: 1.2 !important;
          padding: 0 16px !important;
        }
        .activity-calendar-toggle i,
        .activity-calendar-toggle:hover i,
        .activity-calendar-toggle:focus i,
        .activity-calendar-toggle:active i {
          color: #ffffff !important;
        }
        .activity-calendar-toggle:hover {
          filter: brightness(0.98);
        }
        .datepicker-modal {
          border-radius: 22px;
          overflow: hidden;
        }
        .datepicker-modal .modal-content {
          overflow: visible;
        }
        .datepicker-modal .datepicker-date-display {
          background: linear-gradient(160deg, #0f766e 0%, #14b8a6 100%);
        }
        .datepicker-modal .datepicker-table td.has-event button.datepicker-day-button::after {
          display: none;
        }
        .datepicker-modal .datepicker-table td.activity-submit-day button.datepicker-day-button {
          position: relative;
          color: #059669;
          font-weight: 900;
        }
        .datepicker-modal .datepicker-table td.activity-submit-day button.datepicker-day-button::after {
          content: "";
          position: absolute;
          bottom: 5px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #10b981;
          box-shadow: 0 0 0 3px rgba(16,185,129,.10);
        }
        .datepicker-modal .datepicker-table td.activity-submit-day.is-selected button.datepicker-day-button {
          color: #ffffff;
        }
        .datepicker-modal .datepicker-table td.activity-submit-day.is-selected button.datepicker-day-button::after {
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(255,255,255,.16);
        }
      `}</style>
      <input ref={inputRef} className="activity-materialize-anchor" readOnly value={selectedWeek} onChange={() => {}} />
    </>
  );
}

export default function ActivityReport({ embedded = false }: { embedded?: boolean } = {}) {
  const [summaries, setSummaries] = useState<ApiUpdateSummary[]>([]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [error, setError] = useState("");
  const [highlightedDates, setHighlightedDates] = useState<string[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [pageSize, setPageSize] = useState(25);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [hoveredHoursKey, setHoveredHoursKey] = useState<string | null>(null);
  const [detailAttachmentPreviewKey, setDetailAttachmentPreviewKey] = useState("");
  const [detailSignedAttachmentUrls, setDetailSignedAttachmentUrls] = useState<Record<string, string>>({});

  const modalRef = useRef<HTMLDivElement | null>(null);
  const detailModalRef = useRef<HTMLDivElement | null>(null);

  const [selectedRecipients, setSelectedRecipients] = useState<Record<string, boolean>>({});
  const [selectedDetailRow, setSelectedDetailRow] = useState<ApiUpdateSummary | null>(null);

  useEffect(() => {
    if (modalRef.current && typeof M !== "undefined") {
      M.Modal.init(modalRef.current, {
        dismissible: true,
        opacity: 0.45,
        inDuration: 140,
        outDuration: 120,
      });
    }

    if (detailModalRef.current && typeof M !== "undefined") {
      M.Modal.init(detailModalRef.current, {
        dismissible: true,
        opacity: 0.45,
        inDuration: 140,
        outDuration: 120,
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof (api as any).getUsers !== "function") return;
        const usersResp: ApiUser[] = await (api as any).getUsers();
        if (!mounted) return;
        setUsers(Array.isArray(usersResp) ? usersResp : []);
      } catch {
        if (!mounted) return;
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const foundWeeks = new Set<string>();
        const foundDates = new Set<string>();
        let cursor: string | undefined;
        let pages = 0;

        do {
          const resp: ApiUpdatesResponse = await api.getUpdates({
            limit: 200,
            cursor,
          });

          (Array.isArray(resp?.summaries) ? resp.summaries : []).forEach((row) => {
            const week = safeStr((row as any)?.weekStart);
            if (week) foundWeeks.add(week);
          });

          (Array.isArray(resp?.items) ? resp.items : []).forEach((row) => {
            const week = safeStr((row as any)?.weekStart);
            if (week) foundWeeks.add(week);
            const createdAt = safeStr((row as any)?.createdAt);
            if (createdAt) {
              const createdDate = new Date(createdAt);
              if (!Number.isNaN(createdDate.getTime())) {
                foundDates.add(toLocalISODate(createdDate));
              }
            }
          });

          cursor = resp?.nextCursor || undefined;
          pages += 1;
        } while (cursor && pages < 100);

        if (cancelled) return;

        const sortedWeeks = Array.from(foundWeeks).sort((a, b) => b.localeCompare(a));
        const sortedDates = Array.from(foundDates).sort((a, b) => b.localeCompare(a));
        setHighlightedDates(sortedDates);

        const preferredWeek = sortedWeeks[0] || "";

        if (preferredWeek) {
          setSelectedWeek(preferredWeek);
          const preferredDate = parseLocalISO(preferredWeek);
          if (preferredDate) {
            setCalendarMonth(new Date(preferredDate.getFullYear(), preferredDate.getMonth(), 1));
          }
        } else {
          setSelectedWeek("");
        }
      } catch (err: any) {
        if (cancelled) return;
        setError((prev) => prev || err?.message || "Failed to load submission dates.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    const picked = parseLocalISO(selectedWeek);
    if (!picked) return;
    setCalendarMonth((prev) => {
      if (
        prev.getFullYear() === picked.getFullYear() &&
        prev.getMonth() === picked.getMonth()
      ) {
        return prev;
      }
      return new Date(picked.getFullYear(), picked.getMonth(), 1);
    });
  }, [selectedWeek]);

  async function loadWeekPage(cursor?: string | null, resetPaging?: boolean) {
    if (!selectedWeek) {
      setSummaries([]);
      setNextCursor(null);
      return;
    }
    try {
      setLoading(true);
      setError("");

      const resp: ApiUpdatesResponse = await api.getUpdates({
        weekStart: selectedWeek,
        limit: pageSize,
        cursor: cursor || undefined,
      });

      const normalized = Array.isArray(resp?.summaries) ? resp.summaries : [];
      setSummaries(normalized);
      setNextCursor(typeof resp?.nextCursor === "string" ? resp.nextCursor : null);
      if (resetPaging) {
        setCursorStack([]);
        setPageIndex(0);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load week data.");
      setSummaries([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWeekPage(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeek, pageSize]);

  const rows = useMemo(() => {
    return [...summaries].sort((a, b) => {
      return String((a as any).userName || (a as any).userId || "").localeCompare(
        String((b as any).userName || (b as any).userId || "")
      );
    });
  }, [summaries]);

  const eligibleUsers = useMemo(() => {
    return (Array.isArray(users) ? users : []).filter((u) => {
      if (isRevoked(u)) return false;
      return !!getUserKey(u);
    });
  }, [users]);

  const summaryMap = useMemo(() => {
    const map = new Map<string, ApiUpdateSummary>();
    for (const row of rows) {
      const key = getSummaryKey(row);
      if (!key) continue;
      map.set(key, row);
    }
    return map;
  }, [rows]);

  const userMap = useMemo(() => {
    const map = new Map<string, ApiUser>();
    for (const u of users) {
      const key = getUserKey(u);
      if (!key) continue;
      map.set(key, u);
    }
    return map;
  }, [users]);

  const missingState = useMemo(() => {
    const missingUpdates: ApiUser[] = [];
    const missingTimesheets: ApiUser[] = [];
    const missingRetro: ApiUser[] = [];
    const reasonsMap = new Map<string, MissingReasons>();

    for (const user of eligibleUsers) {
      const key = getUserKey(user);
      const row = summaryMap.get(key);

      const missingUpdate = !row;
      const missingTimesheet = !row || !hasTimesheet(row);
      const missingRetrospective = !row || !hasRetro(row);

      reasonsMap.set(key, {
        update: missingUpdate,
        timesheet: missingTimesheet,
        retro: missingRetrospective,
      });

      if (missingUpdate) missingUpdates.push(user);
      if (missingTimesheet) missingTimesheets.push(user);
      if (missingRetrospective) missingRetro.push(user);
    }

    return {
      missingUpdates,
      missingTimesheets,
      missingRetro,
      reasonsMap,
    };
  }, [eligibleUsers, summaryMap]);

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const user of [
      ...missingState.missingUpdates,
      ...missingState.missingTimesheets,
      ...missingState.missingRetro,
    ]) {
      const key = getUserKey(user);
      if (key) next[key] = true;
    }
    setSelectedRecipients(next);
  }, [missingState, selectedWeek]);

  const totals = useMemo(() => {
    const employees = new Set(rows.map((r) => (r as any).userId || (r as any).userName || "Anon"));
    const totalEntries = rows.reduce((acc, r) => acc + safeNum((r as any).totalEntries), 0);
    const totalHours = rows.reduce((acc, r) => acc + safeNum((r as any).totalHours), 0);
    const submittedUpdates = rows.filter((r) => safeNum((r as any).totalEntries) > 0).length;
    const contributors = rows.filter((r) => safeNum((r as any).totalHours) > 0).length;
    const noHours = rows.filter((r) => safeNum((r as any).totalHours) <= 0).length;
    const underThree = rows.filter(
      (r) => safeNum((r as any).totalHours) > 0 && safeNum((r as any).totalHours) < 3
    ).length;

    return {
      employees: employees.size,
      totalEntries,
      totalHours,
      submittedUpdates,
      contributors,
      noHours,
      underThree,
    };
  }, [rows]);


  const contributorSeries = useMemo(() => {
    return rows
      .map((r) => ({
        name: safeStr((r as any).userName || (r as any).userId) || "Anon",
        totalHours: safeNum((r as any).totalHours),
        updates: safeNum((r as any).totalEntries),
      }))
      .sort((a, b) => b.totalHours - a.totalHours || b.updates - a.updates);
  }, [rows]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, { day: string; totalHours: number; contributors: Set<string> }>();

    for (const r of rows) {
      const userKey = safeStr((r as any).userId || (r as any).userName) || "Anon";
      const timesheet = Array.isArray((r as any).timesheet) ? (r as any).timesheet : [];

      for (const t of timesheet) {
        const day = safeStr((t as any)?.date);
        const hours = safeNum((t as any)?.hours);
        if (!day) continue;

        if (!map.has(day)) {
          map.set(day, {
            day,
            totalHours: 0,
            contributors: new Set(),
          });
        }

        const item = map.get(day)!;
        item.totalHours += hours;
        if (hours > 0) item.contributors.add(userKey);
      }
    }

    return Array.from(map.values())
      .map((x) => ({
        day: x.day,
        totalHours: Number(x.totalHours.toFixed(1)),
        contributors: x.contributors.size,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  function openMissingModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    inst.open();
  }

  function closeMissingModal() {
    if (!modalRef.current || typeof M === "undefined") return;
    const inst = M.Modal.getInstance(modalRef.current) || M.Modal.init(modalRef.current);
    inst.close();
  }

  function openDetailsModal(row: ApiUpdateSummary) {
    setSelectedDetailRow(row);
    setDetailAttachmentPreviewKey("");
    setDetailSignedAttachmentUrls({});
    if (!detailModalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(detailModalRef.current) || M.Modal.init(detailModalRef.current);
    inst.open();
  }

  function closeDetailsModal() {
    setDetailAttachmentPreviewKey("");
    setDetailSignedAttachmentUrls({});
    if (!detailModalRef.current || typeof M === "undefined") return;
    const inst =
      M.Modal.getInstance(detailModalRef.current) || M.Modal.init(detailModalRef.current);
    inst.close();
  }

  function toggleUser(user: ApiUser, checked: boolean) {
    const key = getUserKey(user);
    if (!key) return;
    setSelectedRecipients((prev) => ({ ...prev, [key]: checked }));
  }

  function setSectionChecked(section: MissingSection, checked: boolean) {
    const list =
      section === "update"
        ? missingState.missingUpdates
        : section === "timesheet"
        ? missingState.missingTimesheets
        : missingState.missingRetro;

    setSelectedRecipients((prev) => {
      const next = { ...prev };
      for (const user of list) {
        const key = getUserKey(user);
        if (!key) continue;
        next[key] = checked;
      }
      return next;
    });
  }

  const selectedMailUsers = useMemo(() => {
    const union = new Map<string, ApiUser>();
    for (const user of [
      ...missingState.missingUpdates,
      ...missingState.missingTimesheets,
      ...missingState.missingRetro,
    ]) {
      const key = getUserKey(user);
      if (!key) continue;
      if (selectedRecipients[key]) union.set(key, user);
    }
    return Array.from(union.values());
  }, [missingState, selectedRecipients]);

  const selectedDetailUser = useMemo(() => {
    if (!selectedDetailRow) return null;
    const key = getSummaryKey(selectedDetailRow);
    return userMap.get(key) || null;
  }, [selectedDetailRow, userMap]);

  const selectedDetailTimesheet = useMemo(() => {
    if (!selectedDetailRow) return [];
    const ts = Array.isArray((selectedDetailRow as any).timesheet)
      ? (selectedDetailRow as any).timesheet
      : [];
    return [...ts].sort((a: any, b: any) => String(a?.date || "").localeCompare(String(b?.date || "")));
  }, [selectedDetailRow]);

  const selectedDetailAttachments = useMemo(() => {
    if (!selectedDetailRow) return [];
    return normalizeAttachments(
      (selectedDetailRow as any).attachments ||
        (selectedDetailRow as any).uploadedFiles ||
        (selectedDetailRow as any).files
    );
  }, [selectedDetailRow]);

  function detailAttachmentKey(a: any, idx: number) {
    const rowUser = safeStr((selectedDetailRow as any)?.userId || (selectedDetailRow as any)?.userName);
    const rowWeek = safeStr((selectedDetailRow as any)?.weekStart);
    return `${rowUser}::${rowWeek}::${safeStr(a?.s3Key) || safeStr(a?.name) || idx}`;
  }

  async function ensureDetailAttachmentUrl(a: any, idx: number): Promise<string> {
    const key = detailAttachmentKey(a, idx);
    const existing = safeStr(detailSignedAttachmentUrls[key]);
    if (existing) return existing;

    const raw = attachmentHref(a);
    if (raw && !isLikelyUnsignedPrivateS3Url(raw)) return raw;

    const s3Key = safeStr(a?.s3Key);
    if (!s3Key) return "";

    try {
      const resp = await (api as any).getWeeklyUpdateAttachmentUrl?.({
        s3Key,
        userId: safeStr((selectedDetailRow as any)?.userId),
        weekStart: safeStr((selectedDetailRow as any)?.weekStart),
      });
      const url = safeStr(resp?.url);
      if (!url) return "";
      setDetailSignedAttachmentUrls((prev) => ({ ...prev, [key]: url }));
      return url;
    } catch {
      return "";
    }
  }

  async function sendMissingReminderEmail() {
    if (!selectedWeek) {
      toast("Please select a week first", "red");
      return;
    }

    const selected = selectedMailUsers
      .map((user) => {
        const key = getUserKey(user);
        const reasons = missingState.reasonsMap.get(key) || {
          update: false,
          timesheet: false,
          retro: false,
        };

        const missingWeeks = [selectedWeek];
        const email = getUserEmail(user);

        if (!email) return null;

        return {
          username: safeStr((user as any)?.username),
          email,
          fullName: getUserName(user),
          roleTitle: safeStr((user as any)?.employee_title || (user as any)?.role || ""),
          missingWeeks,
          missingItems: [
            reasons.update ? "update" : "",
            reasons.timesheet ? "timesheet" : "",
            reasons.retro ? "retro" : "",
          ].filter(Boolean),
        };
      })
      .filter(Boolean) as Array<{
      username: string;
      email: string;
      fullName: string;
      roleTitle: string;
      missingWeeks: string[];
      missingItems: string[];
    }>;

    if (!selected.length) {
      toast("No selected users with valid email addresses", "red");
      return;
    }

    try {
      setSendingReminder(true);

      const resp = await callAdminActivityReportReminders({
        selectedWeek,
        recipients: selected,
        dryRun: false,
        autoCc: false,
      });

      toast(String(resp?.message || "Reminder emails sent"), "green");
      closeMissingModal();
    } catch (e: any) {
      toast(e?.message || "Failed to send reminder email", "red");
    } finally {
      setSendingReminder(false);
    }
  }

  function renderMissingSection(
    title: string,
    section: MissingSection,
    usersList: ApiUser[],
    tone: "blue" | "amber" | "red"
  ) {
    const checkedCount = usersList.filter((u) => selectedRecipients[getUserKey(u)]).length;
    const bg =
      tone === "red"
        ? "rgba(239,68,68,.05)"
        : tone === "amber"
        ? "rgba(245,158,11,.05)"
        : "rgba(59,130,246,.05)";

    const border =
      tone === "red"
        ? "rgba(239,68,68,.18)"
        : tone === "amber"
        ? "rgba(245,158,11,.18)"
        : "rgba(59,130,246,.18)";

    return (
      <div
        style={{
          borderRadius: 18,
          border: `1px solid ${border}`,
          background: `linear-gradient(180deg, ${bg}, #fff 80%)`,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {checkedCount}/{usersList.length} selected
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-flat"
              onClick={() => setSectionChecked(section, true)}
              style={{
                borderRadius: 999,
                background: "rgba(15,23,42,.06)",
                fontWeight: 900,
                textTransform: "none",
              }}
            >
              Select all
            </button>
            <button
              type="button"
              className="btn-flat"
              onClick={() => setSectionChecked(section, false)}
              style={{
                borderRadius: 999,
                background: "rgba(15,23,42,.06)",
                fontWeight: 900,
                textTransform: "none",
              }}
            >
              Clear
            </button>
          </div>
        </div>

        {!usersList.length ? (
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
            No one missing this item.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
            {usersList.map((user) => {
              const key = getUserKey(user);
              const checked = !!selectedRecipients[key];
              return (
                <label
                  key={`${section}-${key}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.14)",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleUser(user, e.target.checked)}
                    />
                    <span style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: "#0f172a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {getUserName(user)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748b",
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {getUserEmail(user) || safeStr((user as any)?.username) || "No email"}
                      </div>
                    </span>
                  </span>

                  <span
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontWeight: 800,
                      textTransform: "capitalize",
                    }}
                  >
                    {getUserRole(user) || "employee"}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={embedded ? undefined : "container"}
      style={
        embedded
          ? { width: "100%", maxWidth: "none", paddingTop: 0, paddingBottom: 0, margin: 0 }
          : { paddingTop: 24, paddingBottom: 24 }
      }
    >
      <div
        className={embedded ? undefined : "card"}
        style={{
          borderRadius: embedded ? 0 : 24,
          overflow: "visible",
          border: embedded ? "none" : "1px solid rgba(148,163,184,.14)",
          boxShadow: embedded ? "none" : "0 16px 40px rgba(15,23,42,.08)",
          background: embedded
            ? "transparent"
            : "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
        }}
      >
        <div
          style={{
            padding: embedded ? 0 : 22,
            borderBottom: "1px solid rgba(148,163,184,.12)",
            background:
              "radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 30%), radial-gradient(circle at top left, rgba(59,130,246,.07), transparent 28%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 1000,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                Activity Report
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#475569",
                  fontSize: 14,
                  maxWidth: 720,
                }}
              >
                Weekly employee summaries with snapshot cards, charts, and reminder actions.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <MetricChip
                icon="groups"
                label="Employees"
                value={String(totals.employees)}
                tint="rgba(59,130,246,.10)"
                color="#1d4ed8"
              />
              <MetricChip
                icon="article"
                label="Entries"
                value={String(totals.totalEntries)}
                tint="rgba(245,158,11,.12)"
                color="#b45309"
              />
              <MetricChip
                icon="schedule"
                label="Hours"
                value={totals.totalHours.toFixed(1)}
                tint="rgba(34,197,94,.12)"
                color="#166534"
              />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0, marginTop: 14 }}>
            <div className="col s12 m6 l4">
              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,.16)",
                  background: "linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)",
                  padding: 14,
                }}
              >
                <div
                  style={{
                    marginBottom: 8,
                    color: "#475569",
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                  }}
                >
                  Activity Week
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
                  {selectedWeek ? formatWeekLabel(selectedWeek) : "No week selected"}
                </div>
                <div style={{ marginTop: 4, color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                  {selectedWeek || "Choose any highlighted date from the calendar."}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    type="button"
                    className="waves-effect waves-light activity-calendar-toggle"
                    onClick={() => setCalendarOpen((open) => !open)}
                    style={{}}
                  >
                    <i className="material-icons left">calendar_month</i>
                    {calendarOpen ? "Hide Calendar" : "Open Calendar"}
                  </button>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      borderRadius: 999,
                      padding: "8px 12px",
                      background: "rgba(34,197,94,.10)",
                      color: "#166534",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {highlightedDates.length} submit day{highlightedDates.length === 1 ? "" : "s"} found
                  </span>
                </div>
              </div>
            </div>

            <div className="col s12 m6 l8">
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  paddingTop: 4,
                }}
              >
                <MetricChip
                  icon="assignment_late"
                  label="Missing Updates"
                  value={String(missingState.missingUpdates.length)}
                  tint="rgba(59,130,246,.10)"
                  color="#1d4ed8"
                />
                <MetricChip
                  icon="pending_actions"
                  label="Missing Timesheets"
                  value={String(missingState.missingTimesheets.length)}
                  tint="rgba(245,158,11,.12)"
                  color="#b45309"
                />
                <MetricChip
                  icon="fact_check"
                  label="Missing Retro"
                  value={String(missingState.missingRetro.length)}
                  tint="rgba(239,68,68,.10)"
                  color="#b91c1c"
                />

                <button
                  type="button"
                  className="btn waves-effect waves-light"
                  onClick={openMissingModal}
                  style={{
                    borderRadius: 12,
                    textTransform: "none",
                    fontWeight: 900,
                  }}
                >
                  <i className="material-icons left">mail</i>
                  Review Missing + Send Mail
                </button>
              </div>
            </div>
          </div>

          {calendarOpen ? (
            <div style={{ marginTop: 14 }}>
              <SubmissionWeekCalendar
                highlightedDates={highlightedDates}
                selectedWeek={selectedWeek}
                visibleMonth={calendarMonth}
                onSelectDate={(dateIso) => {
                  const picked = parseLocalISO(dateIso) || new Date(dateIso);
                  setSelectedWeek(mondayISO(picked));
                  setCalendarMonth(new Date(picked.getFullYear(), picked.getMonth(), 1));
                  setCalendarOpen(false);
                }}
                onRequestClose={() => setCalendarOpen(false)}
              />
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 8,
            }}
          >
            <div className="grey-text" style={{ fontWeight: 800, fontSize: 12 }}>
              Page {pageIndex + 1} • Showing {rows.length} summaries (paginated)
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select
                className="browser-default"
                value={String(pageSize)}
                onChange={(e) => setPageSize(Number(e.target.value) || 50)}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(148,163,184,.25)",
                  padding: "2px 8px",
                }}
              >
                {[25, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>

              <button
                type="button"
                className={`btn-small grey darken-2 ${pageIndex === 0 || loading ? "disabled" : ""}`}
                disabled={pageIndex === 0 || loading}
                onClick={() => {
                  const prevCursor = cursorStack[pageIndex - 1] || null;
                  setPageIndex((p) => Math.max(0, p - 1));
                  loadWeekPage(prevCursor, false);
                }}
              >
                <i className="material-icons left">chevron_left</i>Prev
              </button>

              <button
                type="button"
                className={`btn-small ${!nextCursor || loading ? "disabled" : ""}`}
                disabled={!nextCursor || loading}
                onClick={() => {
                  const currentCursor = cursorStack[pageIndex] || "";
                  const newStack = [...cursorStack];
                  newStack[pageIndex] = currentCursor;
                  newStack[pageIndex + 1] = nextCursor || "";
                  setCursorStack(newStack);
                  setPageIndex((p) => p + 1);
                  loadWeekPage(nextCursor, false);
                }}
              >
                Next<i className="material-icons right">chevron_right</i>
              </button>
            </div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 18, overflow: "visible" }}>
          {loading ? (
            <div
              style={{
                border: "1px dashed #d9e5ee",
                borderRadius: 20,
                padding: 24,
                textAlign: "center",
                color: "#64748b",
                background: "linear-gradient(180deg,#fcfdff 0%,#f8fbfe 100%)",
                fontWeight: 700,
              }}
            >
              Loading...
            </div>
          ) : error ? (
            <div
              style={{
                border: "1px dashed #fecaca",
                borderRadius: 20,
                padding: 24,
                textAlign: "center",
                color: "#dc2626",
                background: "#fff7f7",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5,minmax(0,1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <SnapshotCard
                  label="Employees"
                  value={totals.employees}
                  sublabel="In selected week"
                  tone="slate"
                />
                <SnapshotCard
                  label="Contributors"
                  value={totals.contributors}
                  sublabel="Logged hours > 0"
                  tone="blue"
                />
                <SnapshotCard
                  label="Updates"
                  value={totals.submittedUpdates}
                  sublabel="Rows with entries"
                  tone="green"
                />
                <SnapshotCard
                  label="Hours"
                  value={totals.totalHours.toFixed(1)}
                  sublabel="Total reported this week"
                  tone="purple"
                />
                <SnapshotCard
                  label="No Hours"
                  value={totals.noHours}
                  sublabel="Employees with 0h"
                  tone="amber"
                />
              </div>

              <div
                style={{
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    borderRadius: 20,
                    border: "1px solid #e5edf4",
                    background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                    padding: 16,
                    boxShadow: "0 10px 22px rgba(15,23,42,.04)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 950,
                      color: "#0f172a",
                      marginBottom: 14,
                    }}
                  >
                    Weekly Compliance Snapshot
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                      gap: 16,
                    }}
                  >
                    <DonutChart
                      value={totals.submittedUpdates}
                      total={Math.max(1, totals.employees)}
                      label="Update Coverage"
                      sublabel="Employees with weekly entries"
                      tone="blue"
                    />
                    <DonutChart
                      value={totals.contributors}
                      total={Math.max(1, totals.employees)}
                      label="Hours Coverage"
                      sublabel="Employees with logged hours"
                      tone="green"
                    />
                    <DonutChart
                      value={missingState.missingTimesheets.length}
                      total={Math.max(1, eligibleUsers.length)}
                      label="Missing Timesheets"
                      sublabel="From current team"
                      tone="amber"
                    />
                    <DonutChart
                      value={missingState.missingRetro.length}
                      total={Math.max(1, eligibleUsers.length)}
                      label="Missing Retro"
                      sublabel="From current team"
                      tone="red"
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 18,
                }}
              >

                <MiniBarChart
                  title="Updates by Contributor"
                  items={contributorSeries}
                  valueKey="updates"
                  labelKey="name"
                  color="linear-gradient(90deg,#60a5fa,#2563eb)"
                />
                <MiniBarChart
                  title="Daily Hours"
                  items={dailySeries}
                  valueKey="totalHours"
                  labelKey="day"
                  color="linear-gradient(90deg,#fbbf24,#f59e0b)"
                  suffix="h"
                />
              </div>

              <div className="responsive-table" style={{ overflowX: "auto", overflowY: "visible" }}>
                <table
                  className="highlight"
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Week", "Employee", "Entries", "Accomplishments", "Blockers", "Next", "Attachments", "Hours"].map(
                        (h) => (
                          <th
                            key={h}
                            style={{
                              background: "#f8fafc",
                              color: "#334155",
                              fontSize: 12,
                              textTransform: "uppercase",
                              letterSpacing: ".06em",
                              fontWeight: 900,
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.14)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: 24, color: "#64748b" }}>
                          No data
                        </td>
                      </tr>
                    )}

                    {rows.map((r, idx) => {
                      const rowKey = `${(r as any).weekStart}__${(r as any).userId || (r as any).userName || idx}`;
                      const hoursTone = colorForHours(Number((r as any).totalHours || 0));

                      return (
                        <tr key={rowKey} style={{ background: idx % 2 === 0 ? "#ffffff" : "#fcfdff" }}>
                          <td
                            style={{
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.10)",
                              whiteSpace: "nowrap",
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {(r as any).weekStart}
                          </td>

                          <td
                            style={{
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.10)",
                              minWidth: 220,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => openDetailsModal(r)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                border: "1px solid rgba(59,130,246,.16)",
                                background: "linear-gradient(180deg, rgba(59,130,246,.06), rgba(255,255,255,1))",
                                borderRadius: 14,
                                padding: "10px 12px",
                                cursor: "pointer",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 900,
                                      color: "#0f172a",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {(r as any).userName || (r as any).userId || "Anon"}
                                  </div>
                                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                                    {(r as any).employee_id || (r as any).employee_manager || "—"}
                                  </div>
                                </div>

                                <i
                                  className="material-icons"
                                  style={{ fontSize: 18, color: "#2563eb", flex: "0 0 auto" }}
                                >
                                  open_in_new
                                </i>
                              </div>
                            </button>
                          </td>

                          <td
                            style={{
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.10)",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                minWidth: 40,
                                justifyContent: "center",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(99,102,241,.10)",
                                color: "#4338ca",
                                fontWeight: 900,
                              }}
                            >
                              {(r as any).totalEntries}
                            </span>
                          </td>

                          <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                            <CompactListCell
                              count={Array.isArray((r as any).accomplishments) ? (r as any).accomplishments.length : 0}
                              tone="blue"
                            />
                          </td>

                          <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                            <CompactListCell
                              count={Array.isArray((r as any).blockers) ? (r as any).blockers.length : 0}
                              tone="amber"
                            />
                          </td>

                          <td style={{ padding: "16px 14px", borderBottom: "1px solid rgba(148,163,184,.10)" }}>
                            <CompactListCell
                              count={Array.isArray((r as any).next) ? (r as any).next.length : 0}
                              tone="green"
                            />
                          </td>

                          <td
                            style={{
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.10)",
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                minWidth: 40,
                                justifyContent: "center",
                                padding: "6px 10px",
                                borderRadius: 999,
                                background: "rgba(59,130,246,.10)",
                                color: "#1d4ed8",
                                fontWeight: 900,
                              }}
                              title="Attachments"
                            >
                              {normalizeAttachments(
                                (r as any).attachments ||
                                  (r as any).uploadedFiles ||
                                  (r as any).files
                              ).length}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: "16px 14px",
                              borderBottom: "1px solid rgba(148,163,184,.10)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <div
                              style={{ position: "relative", display: "inline-block" }}
                              onMouseEnter={() => setHoveredHoursKey(rowKey)}
                              onMouseLeave={() =>
                                setHoveredHoursKey((curr) => (curr === rowKey ? null : curr))
                              }
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "8px 12px",
                                  borderRadius: 999,
                                  background: hoursTone.bg,
                                  color: hoursTone.text,
                                  fontWeight: 900,
                                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)",
                                  cursor: "default",
                                }}
                              >
                                <i className="material-icons" style={{ fontSize: 16 }}>
                                  schedule
                                </i>
                                {Number((r as any).totalHours || 0).toFixed(1)}
                              </span>

                              {hoveredHoursKey === rowKey && (
                                <HeatmapPopover
                                  weekStart={(r as any).weekStart}
                                  timesheet={Array.isArray((r as any).timesheet) ? (r as any).timesheet : []}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <div ref={modalRef} className="modal modal-fixed-footer">
        <div className="modal-content">
          <h5 style={{ fontWeight: 1000, marginBottom: 6 }}>Missing Submission Review</h5>
          <p className="grey-text" style={{ marginTop: 0, fontWeight: 700 }}>
            Select exactly who should receive the reminder for week {selectedWeek || "—"}.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 16,
              marginTop: 14,
            }}
          >
            {renderMissingSection("Missing Updates", "update", missingState.missingUpdates, "blue")}
            {renderMissingSection("Missing Timesheets", "timesheet", missingState.missingTimesheets, "amber")}
            {renderMissingSection("Missing Retro", "retro", missingState.missingRetro, "red")}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,.14)",
              background: "#f8fafc",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
              Selected recipients
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
              {selectedMailUsers.length}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              {selectedMailUsers.length
                ? selectedMailUsers.map(getUserName).join(", ")
                : "No one selected"}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-flat" onClick={closeMissingModal}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn waves-effect waves-light ${sendingReminder ? "disabled" : ""}`}
            onClick={sendMissingReminderEmail}
            disabled={sendingReminder}
            style={{ borderRadius: 12, textTransform: "none", fontWeight: 900 }}
          >
            <i className="material-icons left">
              {sendingReminder ? "hourglass_empty" : "send"}
            </i>
            {sendingReminder ? "Sending..." : "Send Reminder Email"}
          </button>
        </div>
      </div>

      <div ref={detailModalRef} className="modal modal-fixed-footer" style={{ maxHeight: "88%" }}>
        <div className="modal-content" style={{ paddingBottom: 8 }}>
          {!selectedDetailRow ? (
            <div style={{ color: "#64748b", fontWeight: 700 }}>No employee selected.</div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <div>
                  <h5 style={{ fontWeight: 1000, margin: 0 }}>
                    {safeStr((selectedDetailRow as any).userName || (selectedDetailRow as any).userId || "Employee")}
                  </h5>
                  <div style={{ marginTop: 6, color: "#64748b", fontWeight: 700 }}>
                    Week {safeStr((selectedDetailRow as any).weekStart) || "—"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <MetricChip
                    icon="article"
                    label="Entries"
                    value={String(safeNum((selectedDetailRow as any).totalEntries))}
                    tint="rgba(99,102,241,.10)"
                    color="#4338ca"
                  />
                  <MetricChip
                    icon="schedule"
                    label="Hours"
                    value={safeNum((selectedDetailRow as any).totalHours).toFixed(1)}
                    tint="rgba(34,197,94,.12)"
                    color="#166534"
                  />
                  <MetricChip
                    icon="attach_file"
                    label="Attachments"
                    value={String(selectedDetailAttachments.length)}
                    tint="rgba(59,130,246,.10)"
                    color="#1d4ed8"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3,minmax(0,1fr))",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <InfoBlock
                  title="Email"
                  value={getUserEmail(selectedDetailUser || {}) || "—"}
                />
                <InfoBlock
                  title="Role"
                  value={
                    safeStr((selectedDetailUser as any)?.employee_title) ||
                    safeStr((selectedDetailUser as any)?.employee_role) ||
                    safeStr((selectedDetailUser as any)?.role) ||
                    "—"
                  }
                />
                <InfoBlock
                  title="Username"
                  value={
                    safeStr((selectedDetailUser as any)?.username) ||
                    safeStr((selectedDetailRow as any)?.userId) ||
                    "—"
                  }
                />
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,.14)",
                  background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>
                  Weekly Time Heatmap
                </div>
                <HeatmapGrid
                  weekStart={safeStr((selectedDetailRow as any).weekStart)}
                  timesheet={selectedDetailTimesheet}
                />
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,.14)",
                  background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>
                  Timesheet Rows
                </div>

                {!selectedDetailTimesheet.length ? (
                  <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                    No timesheet rows found.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          {["Date", "Project", "Hours"].map((h) => (
                            <th
                              key={h}
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                fontSize: 11,
                                textTransform: "uppercase",
                                letterSpacing: ".06em",
                                color: "#64748b",
                                borderBottom: "1px solid rgba(148,163,184,.14)",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDetailTimesheet.map((t: any, idx: number) => (
                          <tr key={`${t?.date || "d"}-${idx}`}>
                            <td
                              style={{
                                padding: "11px 12px",
                                borderBottom: "1px solid rgba(148,163,184,.10)",
                                color: "#0f172a",
                                fontWeight: 800,
                              }}
                            >
                              {safeStr(t?.date) || "—"}
                            </td>
                            <td
                              style={{
                                padding: "11px 12px",
                                borderBottom: "1px solid rgba(148,163,184,.10)",
                                color: "#334155",
                                fontWeight: 700,
                              }}
                            >
                              {safeStr(t?.projectId) || safeStr((selectedDetailRow as any)?.projectId) || "Unassigned"}
                            </td>
                            <td
                              style={{
                                padding: "11px 12px",
                                borderBottom: "1px solid rgba(148,163,184,.10)",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  background: "rgba(34,197,94,.12)",
                                  color: "#166534",
                                  fontWeight: 900,
                                }}
                              >
                                {safeNum(t?.hours).toFixed(1)}h
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(148,163,184,.14)",
                  background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                  padding: 14,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a", marginBottom: 10 }}>
                  Attachments
                </div>

                {!selectedDetailAttachments.length ? (
                  safeStr((selectedDetailRow as any)?.driveFolderLink) ? (
                    <a
                      href={safeStr((selectedDetailRow as any)?.driveFolderLink)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 13, fontWeight: 900 }}
                    >
                      Open drive folder
                    </a>
                  ) : (
                    <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700 }}>
                      No attachments found.
                    </div>
                  )
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedDetailAttachments.map((a, idx) => {
                      const dKey = detailAttachmentKey(a, idx);
                      const hrefRaw = attachmentHref(a);
                      const href =
                        safeStr(detailSignedAttachmentUrls[dKey]) ||
                        (isLikelyUnsignedPrivateS3Url(hrefRaw) ? "" : hrefRaw);
                      const kind = attachmentPreviewKind(a);
                      const previewKey = dKey;
                      const canPreview = kind !== "none" && (!!href || !!safeStr((a as any)?.s3Key));
                      const isPreviewing = detailAttachmentPreviewKey === previewKey;
                      return (
                        <div
                          key={previewKey}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            border: "1px solid rgba(148,163,184,.14)",
                            borderRadius: 12,
                            background: "#fff",
                            padding: "10px 12px",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                color: "#0f172a",
                                fontWeight: 900,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={safeStr(a.name)}
                            >
                              {safeStr(a.name) || `Attachment ${idx + 1}`}
                            </div>
                            <div style={{ marginTop: 2, fontSize: 12, color: "#64748b", fontWeight: 700 }}>
                              {safeStr(a.mimeType) || (safeNum(a.size) > 0 ? `${safeNum(a.size)} bytes` : "Attachment")}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            {canPreview ? (
                              <button
                                type="button"
                                className="btn-flat"
                                onClick={async () => {
                                  const resolved = href || (await ensureDetailAttachmentUrl(a, idx));
                                  if (!resolved) return;
                                  setDetailAttachmentPreviewKey((curr) =>
                                    curr === previewKey ? "" : previewKey
                                  );
                                }}
                                style={{ fontWeight: 900, textTransform: "none" }}
                              >
                                {isPreviewing ? "Hide Preview" : "Preview"}
                              </button>
                            ) : null}

                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontWeight: 900, textDecoration: "none" }}
                              >
                                Open
                              </a>
                            ) : safeStr((a as any)?.s3Key) ? (
                              <button
                                type="button"
                                className="btn-flat"
                                style={{ fontWeight: 900, textTransform: "none" }}
                                onClick={async () => {
                                  const resolved = await ensureDetailAttachmentUrl(a, idx);
                                  if (resolved) window.open(resolved, "_blank", "noopener,noreferrer");
                                }}
                              >
                                Open
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 800 }}>
                                {safeStr((a as any)?.s3Key) ? "Private file (needs signed URL)" : "No URL"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {!!selectedDetailAttachments.length &&
                selectedDetailAttachments.map((a, idx) => {
                  const previewKey = detailAttachmentKey(a, idx);
                  const hrefRaw = attachmentHref(a);
                  const href =
                    safeStr(detailSignedAttachmentUrls[previewKey]) ||
                    (isLikelyUnsignedPrivateS3Url(hrefRaw) ? "" : hrefRaw);
                  const kind = attachmentPreviewKind(a);
                  if (detailAttachmentPreviewKey !== previewKey || !href || kind === "none") return null;
                  return (
                    <div
                      key={`${previewKey}-panel`}
                      style={{
                        borderRadius: 18,
                        border: "1px solid rgba(148,163,184,.14)",
                        background: "linear-gradient(180deg,#ffffff 0%,#fbfdff 100%)",
                        padding: 14,
                        marginBottom: 16,
                      }}
                    >
                      {kind === "image" && (
                        <img
                          src={href}
                          alt={safeStr((a as any)?.name) || "Attachment preview"}
                          style={{ maxWidth: "100%", maxHeight: 380, borderRadius: 8 }}
                        />
                      )}
                      {kind === "video" && (
                        <video
                          controls
                          src={href}
                          style={{ width: "100%", maxHeight: 400, borderRadius: 8, background: "#000" }}
                        />
                      )}
                      {kind === "pdf" && (
                        <iframe
                          title={`preview-${previewKey}`}
                          src={href}
                          style={{ width: "100%", height: 460, border: "1px solid #e8eef3", borderRadius: 8 }}
                        />
                      )}
                      {kind === "youtube" && (
                        <iframe
                          title={`yt-${previewKey}`}
                          src={activityYoutubeEmbed(a as any)}
                          style={{ width: "100%", height: 360, border: "1px solid #e8eef3", borderRadius: 8 }}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      )}
                    </div>
                  );
                })}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 16,
                }}
              >
                <DetailList
                  title="Accomplishments"
                  items={Array.isArray((selectedDetailRow as any).accomplishments) ? (selectedDetailRow as any).accomplishments : []}
                />
                <DetailList
                  title="Blockers"
                  items={Array.isArray((selectedDetailRow as any).blockers) ? (selectedDetailRow as any).blockers : []}
                />
                <DetailList
                  title="Next"
                  items={Array.isArray((selectedDetailRow as any).next) ? (selectedDetailRow as any).next : []}
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-flat" onClick={closeDetailsModal}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
