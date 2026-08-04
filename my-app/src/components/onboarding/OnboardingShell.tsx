import type { ReactNode } from "react";
import type { OnboardingChapterStatus } from "./types";

function stepPill(active: boolean, complete: boolean, label: string) {
  return (
    <div
      key={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "8px 12px",
        border: active
          ? "1px solid rgba(37,99,235,.28)"
          : complete
            ? "1px solid rgba(34,197,94,.22)"
            : "1px solid rgba(148,163,184,.16)",
        background: active
          ? "rgba(37,99,235,.10)"
          : complete
            ? "rgba(34,197,94,.08)"
            : "rgba(255,255,255,.82)",
        color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
        fontWeight: 900,
        fontSize: 12,
        letterSpacing: ".06em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          display: "inline-grid",
          placeItems: "center",
          width: 20,
          height: 20,
          borderRadius: 999,
          background: active ? "#dbeafe" : complete ? "#dcfce7" : "#e2e8f0",
          color: active ? "#1d4ed8" : complete ? "#166534" : "#64748b",
          fontSize: 11,
        }}
      >
        {complete ? "✓" : label.slice(0, 1)}
      </span>
      {label}
    </div>
  );
}

export default function OnboardingShell({
  title,
  subtitle,
  chapters,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  chapters: OnboardingChapterStatus[];
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(2,6,23,.78)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(940px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          borderRadius: 30,
          border: "1px solid rgba(255,255,255,.10)",
          background: "linear-gradient(180deg, rgba(255,255,255,.97) 0%, rgba(248,250,252,.99) 100%)",
          boxShadow: "0 28px 80px rgba(15,23,42,.28)",
        }}
      >
        <div style={{ padding: "24px 24px 18px", borderBottom: "1px solid rgba(148,163,184,.16)", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 30, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.03em" }}>
                {title}
              </div>
              <div style={{ marginTop: 8, maxWidth: 760, fontSize: 14, color: "#475569", lineHeight: 1.7 }}>
                {subtitle}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {chapters.map((chapter) => stepPill(chapter.active, chapter.complete, chapter.label))}
            </div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {children}
        </div>

        {footer ? <div style={{ padding: "0 24px 24px" }}>{footer}</div> : null}
      </div>
    </div>
  );
}
