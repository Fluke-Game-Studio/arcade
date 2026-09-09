import { useState } from "react";

// Shared responsive tab navigation for account and workspace sections.
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
  const [compactOpen, setCompactOpen] = useState(false);
  const activeTab = tabs.find((tab) => tab.key === activeKey) || tabs[0];

  function selectTab(key: T) {
    onChange(key);
    setCompactOpen(false);
  }

  return (
    <>
      <div className={`fgTabBar fgTabBar--${variant}`} role="tablist" aria-label={ariaLabel || "Tabs"}>
      <style>{`
        .fgTabBar {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin: 0 0 14px 0;
          padding: 6px;
          border-radius: 18px;
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
          border-radius: 12px;
          min-height: 46px;
          padding: 8px 10px;
          font-weight: 900;
          font-size: 13px;
          cursor: pointer;
          background: transparent;
          transition: background .15s ease, color .15s ease, box-shadow .15s ease, transform .15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          line-height: 1.15;
          text-align: center;
          white-space: normal;
          width: 100%;
          min-width: 0;
        }
        .fgTabBtn:hover { transform: translateY(-1px); }
        .fgTabBtn:focus-visible {
          outline: 3px solid rgba(37,99,235,.24);
          outline-offset: 2px;
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
          flex: 0 0 auto;
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
        .fgTabCompact {
          display: none;
          position: relative;
          margin: 0 0 14px;
        }
        .fgTabCompactTrigger {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 13px;
          border-radius: 14px;
          border: 1px solid #dbe5ef;
          background: #f8fbff;
          color: #0f172a;
          font: inherit;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 5px 14px rgba(15,23,42,.06);
        }
        .fgTabCompact--dark .fgTabCompactTrigger {
          border-color: rgba(148,163,184,.28);
          background: #0f172a;
          color: #e2e8f0;
        }
        .fgTabCompactCurrent,
        .fgTabCompactItem { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
        .fgTabCompactCurrent span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fgTabCompactTrigger .material-icons,
        .fgTabCompactItem .material-icons { font-size: 17px; flex: 0 0 auto; }
        .fgTabCompactChevron { color: #64748b; }
        .fgTabCompactMenu {
          position: absolute;
          z-index: 20;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          display: grid;
          gap: 4px;
          padding: 6px;
          border: 1px solid #dbe5ef;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 18px 34px rgba(15,23,42,.16);
        }
        .fgTabCompactItem {
          width: 100%;
          min-height: 42px;
          padding: 9px 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #334155;
          font: inherit;
          font-size: 12px;
          font-weight: 850;
          text-align: left;
          cursor: pointer;
        }
        .fgTabCompactItem:hover,
        .fgTabCompactItem.active { background: #e8f1ff; color: #1d4ed8; }
        .fgTabCompactItem .check { margin-left: auto; font-size: 16px; }
        @media (max-width: 900px) {
          .fgTabBar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .fgTabBar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
            padding: 6px;
            border-radius: 16px;
          }
          .fgTabBtn {
            min-height: 50px;
            padding: 8px 7px;
            font-size: 12px;
          }
          .fgTabBtn .material-icons { font-size: 15px; }
        }
        /* At tablet/narrow layouts, keep the page content visible instead of
           spending the first screenful on a multi-row navigation grid. */
        @media (max-width: 960px) {
          .fgTabBar { display: none; }
          .fgTabCompact { display: block; }
        }
      `}</style>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={activeKey === t.key}
          className={`fgTabBtn ${activeKey === t.key ? "active" : ""}`}
          onClick={() => selectTab(t.key)}
        >
          {t.icon ? <i className="material-icons">{t.icon}</i> : null}
          {t.label}
          {typeof t.badge === "number" && t.badge > 0 ? <span className="fgTabBadge">{t.badge}</span> : null}
        </button>
      ))}
      </div>

      <div className={`fgTabCompact fgTabCompact--${variant}`}>
        <button
          type="button"
          className="fgTabCompactTrigger"
          aria-expanded={compactOpen}
          aria-haspopup="menu"
          onClick={() => setCompactOpen((open) => !open)}
        >
          <span className="fgTabCompactCurrent">
            {activeTab?.icon ? <i className="material-icons">{activeTab.icon}</i> : null}
            <span>{activeTab?.label || "Select section"}</span>
          </span>
          <i className="material-icons fgTabCompactChevron">{compactOpen ? "expand_less" : "expand_more"}</i>
        </button>
        {compactOpen ? (
          <div className="fgTabCompactMenu" role="menu">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitem"
                className={`fgTabCompactItem ${activeKey === t.key ? "active" : ""}`}
                onClick={() => selectTab(t.key)}
              >
                {t.icon ? <i className="material-icons">{t.icon}</i> : null}
                <span>{t.label}</span>
                {activeKey === t.key ? <i className="material-icons check">check</i> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
