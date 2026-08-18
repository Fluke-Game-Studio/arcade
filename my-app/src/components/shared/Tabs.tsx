// Shared pill-style tab bar, styled after the original Account page tabs.
// Purely presentational — pair with `useTabState` (src/lib/useTabState.ts) to
// back the active tab with a URL query param so pages can be deep-linked to a
// specific tab (e.g. from a notification), not just the page itself.

export type TabDef<T extends string = string> = {
  key: T;
  label: string;
  icon?: string; // material-icons ligature name, optional
  badge?: number;
};

type Props<T extends string> = {
  tabs: TabDef<T>[];
  activeKey: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
  /** "light" (default) matches the Account page; "dark" is for pages with a dark shell (e.g. Agent Builder). */
  variant?: "light" | "dark";
};

export default function Tabs<T extends string>({ tabs, activeKey, onChange, ariaLabel, variant = "light" }: Props<T>) {
  return (
    <div className={`fgTabBar fgTabBar--${variant}`} role="tablist" aria-label={ariaLabel || "Tabs"}>
      <style>{`
        .fgTabBar {
          display: flex;
          align-items: stretch;
          justify-content: flex-start;
          gap: 10px;
          flex-wrap: wrap;
          margin: 0 0 14px 0;
          padding: 6px;
          border-radius: 999px;
          width: 100%;
        }
        .fgTabBar--light {
          border: 1px solid #dbe5ef;
          background: #f8fbff;
        }
        .fgTabBar--dark {
          border: 1px solid rgba(148,163,184,0.28);
          background: rgba(15,23,42,0.6);
        }
        .fgTabBtn {
          border: 0;
          border-radius: 999px;
          padding: 9px 14px;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          background: transparent;
          transition: all .15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          white-space: nowrap;
          flex: 1 1 auto;
        }
        .fgTabBar--light .fgTabBtn { color: #334155; }
        .fgTabBar--light .fgTabBtn:hover { color: #1d4ed8; }
        .fgTabBar--light .fgTabBtn.active {
          background: rgba(59,130,246,.16);
          color: #1d4ed8;
          box-shadow: inset 0 0 0 1px rgba(59,130,246,.12);
        }
        .fgTabBar--dark .fgTabBtn { color: #cbd5e1; }
        .fgTabBar--dark .fgTabBtn:hover { color: #e0f2fe; }
        .fgTabBar--dark .fgTabBtn.active {
          background: linear-gradient(180deg, rgba(56,189,248,0.28), rgba(37,99,235,0.20));
          color: #e0f2fe;
          box-shadow: inset 0 0 0 1px rgba(56,189,248,.42);
        }
        .fgTabBtn .material-icons {
          font-size: 16px;
        }
        .fgTabBadge {
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: linear-gradient(135deg,#ef4444,#f97316);
          color: #fff;
          font-size: 10px;
          font-weight: 950;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeKey === t.key}
          className={`fgTabBtn ${activeKey === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.icon ? <i className="material-icons">{t.icon}</i> : null}
          {t.label}
          {typeof t.badge === "number" && t.badge > 0 ? <span className="fgTabBadge">{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
