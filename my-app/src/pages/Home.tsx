// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import ProfileCard from "../components/ProfileCard";
import RightRail from "../components/RightRail";
import EventHero from "../components/EventHero";
import EmployeeActions from "../components/EmployeeActions";

declare const M: any;

type DocLink = {
  title: string;
  sub: string;
  icon: string;
  href: string;
  badge?: string;
};

type UpdateItem = {
  title: string;
  detail: string;
  when: string;
  icon: string;
};

export default function Home() {
  const [docQuery, setDocQuery] = useState("");

  // Day/Night (persisted)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = (localStorage.getItem("fg_theme") || "").toLowerCase();
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("fg_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const docs: DocLink[] = [
    { title: "Onboarding Guide", sub: "Accounts, tools, and first-week checklist", icon: "menu_book", href: "#", badge: "Start" },
    { title: "Security Policies", sub: "MFA, credentials, data handling rules", icon: "lock", href: "#", badge: "Required" },
    { title: "Engineering Playbook", sub: "Branch rules, PR standards, CI/CD", icon: "build", href: "#" },
    { title: "Incident Runbook", sub: "SEV process, comms, templates", icon: "warning_amber", href: "#" },
    { title: "Design System", sub: "Tokens, components, UI guidelines", icon: "palette", href: "#" },
    { title: "Projects", sub: "View assigned work and project status", icon: "dashboard_customize", href: "#" },
    { title: "Weekly Updates", sub: "Submit progress and view team cadence", icon: "event_note", href: "#" },
    { title: "Retro & Timesheet", sub: "Weekly retro + timesheet submissions", icon: "assignment", href: "#" },
    { title: "Email Templates", sub: "Standard comms formats used by the team", icon: "mail", href: "#" },
    { title: "Access & Roles", sub: "Auth, roles, and account lifecycle", icon: "verified_user", href: "#" },
    { title: "Data Retention", sub: "Backups, privacy, retention policy", icon: "inventory_2", href: "#" },
    { title: "Applicants Admin", sub: "Hiring pipeline and email actions", icon: "group_add", href: "#", badge: "Admin" },
  ];

  const filteredDocs = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.sub.toLowerCase().includes(q) ||
        (d.badge || "").toLowerCase().includes(q)
    );
  }, [docQuery, docs]);

  const updates: UpdateItem[] = [
    { icon: "group_add", title: "Applicants pipeline upgraded", detail: "Stage-based flow (Intro → Tech → NDA → Offer → Welcome) with email history + previews.", when: "Feb 2026" },
    { icon: "mail", title: "Doc emails now include PDFs", detail: "NDA / Offer / Experience / Welcome emails support PDF attachments with shared vars + optional CC.", when: "Feb 2026" },
    { icon: "verified_user", title: "Auth & roles hardened", detail: "JWT login, role checks, safe self-updates, and admin create/update/revoke.", when: "Feb 2026" },
    { icon: "dns", title: "API modules cleaned up", detail: "Projects, updates, retro, timesheet, applicants are routed via a stable Lambda entrypoint.", when: "Feb 2026" },
    { icon: "notifications_active", title: "Email templates standardized", detail: "Consistent INTRO/TECH/REJECT HTML + admin notifications and applicant thank-you emails.", when: "Feb 2026" },
    { icon: "admin_panel_settings", title: "Admin panel improved", detail: "Employee management (CRUD) + project/manager assignment + certificate composer consolidated.", when: "Feb 2026" },
  ];

  useEffect(() => {
    if (typeof M === "undefined") return;

    const t = window.setTimeout(() => {
      try {
        M.Tabs.init(document.querySelectorAll(".tabs"));
        M.Carousel.init(document.querySelectorAll(".carousel"), {
          indicators: true,
          numVisible: 5,
          padding: 20,
          shift: 10,
        });
        M.Collapsible.init(document.querySelectorAll(".collapsible"), { accordion: false });
        M.Tooltip.init(document.querySelectorAll(".tooltipped"), { margin: 6 });
      } catch {}
    }, 0);

    return () => window.clearTimeout(t);
  }, []);

  function toastRouteNotWired() {
    if (typeof M !== "undefined") M.toast({ html: "Route not wired yet.", classes: "blue-grey darken-1" });
  }

  return (
    <>
      <style>{`
        :root{
          --bg: #f7f9fc;
          --bg2: #ffffff;
          --card: rgba(255,255,255,0.88);
          --cardSolid: #ffffff;

          --text: #0f172a;
          --muted: rgba(15,23,42,0.62);

          --border: rgba(2,6,23,0.10);
          --shadow: 0 16px 50px rgba(2,6,23,0.08);

          --blue: #2563eb;
          --blue2: #60a5fa;

          --chipBg: rgba(37,99,235,0.10);
          --chipBd: rgba(37,99,235,0.20);

          --ring: 0 0 0 3px rgba(37,99,235,0.22);

          --r: 18px;
        }

        [data-theme="dark"]{
          --bg: #070b15;
          --bg2: #0a1020;
          --card: rgba(10,16,32,0.70);
          --cardSolid: rgba(10,16,32,0.95);

          --text: rgba(255,255,255,0.92);
          --muted: rgba(148,163,184,0.88);

          --border: rgba(148,163,184,0.18);
          --shadow: 0 22px 70px rgba(0,0,0,0.55);

          --chipBg: rgba(96,165,250,0.14);
          --chipBd: rgba(96,165,250,0.24);

          --ring: 0 0 0 3px rgba(96,165,250,0.22);
        }

        body{
          background: var(--bg) !important;
          color: var(--text) !important;
        }

        .portalBg{
          position: fixed;
          inset: 0;
          z-index: -10;
          background:
            radial-gradient(900px 420px at 15% 10%, rgba(37,99,235,0.10), transparent 60%),
            radial-gradient(800px 420px at 85% 25%, rgba(96,165,250,0.10), transparent 62%),
            linear-gradient(180deg, var(--bg2) 0%, var(--bg) 70%, var(--bg) 100%);
        }
        [data-theme="dark"] .portalBg{
          background:
            radial-gradient(900px 420px at 15% 10%, rgba(96,165,250,0.14), transparent 60%),
            radial-gradient(800px 420px at 85% 25%, rgba(37,99,235,0.12), transparent 62%),
            linear-gradient(180deg, var(--bg2) 0%, var(--bg) 70%, var(--bg) 100%);
        }

        .portalWrap { padding: 18px 0 28px; }
        .portalGridGap { margin-top: 10px; }
        .stack, .stackTight { display: grid; gap: 12px; }

        @media (min-width: 993px) {
          .stickyCol { position: sticky; top: 12px; }
        }

        /* ✅ FIX: Theme pill moved OUT of left column flow so it doesn't push the
           left stack down and break alignment with the center column. */
        .portalTopBar{
          display:flex;
          justify-content:flex-end;
          align-items:center;
          gap: 12px;
          margin-bottom: 12px;
        }
        @media (max-width: 600px){
          .portalTopBar{ justify-content: stretch; }
        }

        .themePill {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.70);
          backdrop-filter: blur(10px);
          box-shadow: 0 10px 26px rgba(2,6,23,0.06);
          width: 100%;
          max-width: 420px;
        }
        [data-theme="dark"] .themePill{
          background: rgba(10,16,32,0.60);
          box-shadow: 0 20px 55px rgba(0,0,0,0.40);
        }

        .themePillLeft{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
          flex: 1 1 auto;
        }
        .themeDot{
          width: 34px; height: 34px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: linear-gradient(135deg, var(--blue), var(--blue2));
          box-shadow: 0 12px 30px rgba(37,99,235,0.20);
          display:flex; align-items:center; justify-content:center;
          color: white;
          flex: 0 0 auto;
        }
        .themeTitle{
          font-weight: 950;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text);
          opacity: 0.92;
          line-height: 1.1;
        }
        .themeSub{
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .themeBtn{
          border: 1px solid var(--border);
          background: var(--cardSolid);
          color: var(--text);
          border-radius: 999px;
          padding: 9px 12px;
          font-weight: 950;
          cursor: pointer;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
          flex: 0 0 auto;
          min-width: 112px; /* keeps the pill stable between Day/Night */
          justify-content: center;
          white-space: nowrap;
        }
        .themeBtn:hover{
          transform: translateY(-1px);
          border-color: rgba(37,99,235,0.28);
          box-shadow: 0 18px 40px rgba(37,99,235,0.10);
        }
        .themeBtn:focus{
          outline: none;
          box-shadow: var(--ring);
        }

        /* Cards */
        .pCard {
          border-radius: var(--r);
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--card);
          backdrop-filter: blur(14px);
          box-shadow: var(--shadow);
        }
        .pCard:hover {
          border-color: rgba(37,99,235,0.22);
          box-shadow: 0 20px 60px rgba(37,99,235,0.10), var(--shadow);
          transform: translateY(-1px);
          transition: all 180ms ease;
        }
        .pCard .card-content { padding: 18px 18px; }
        .pCardTight .card-content { padding: 14px 16px; }

        .pHeader {
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--border);
          background:
            radial-gradient(700px 240px at 10% 0%, rgba(37,99,235,0.10), transparent 60%),
            radial-gradient(600px 240px at 90% 50%, rgba(96,165,250,0.10), transparent 60%),
            linear-gradient(135deg, rgba(255,255,255,0.90), rgba(255,255,255,0.70));
        }
        [data-theme="dark"] .pHeader{
          background:
            radial-gradient(700px 240px at 10% 0%, rgba(96,165,250,0.14), transparent 60%),
            radial-gradient(600px 240px at 90% 50%, rgba(37,99,235,0.12), transparent 60%),
            linear-gradient(135deg, rgba(10,16,32,0.92), rgba(10,16,32,0.65));
        }

        .pTitleRow { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
        .pTitle { font-weight: 950; font-size: 18px; color: var(--text); letter-spacing: -0.2px; }
        .pSub { font-size: 12px; color: var(--muted); margin-top: 4px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .pTiny { font-size: 12px; color: var(--muted); font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }

        .mediaFrame {
          position: relative;
          width: 100%;
          padding-top: 56.25%;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: rgba(2,6,23,0.02);
        }
        [data-theme="dark"] .mediaFrame{ background: rgba(0,0,0,0.28); }
        .mediaFrame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }

        .kpiGrid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 600px) { .kpiGrid { grid-template-columns: 1fr; } }

        .kpiCard {
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--card);
          backdrop-filter: blur(14px);
          padding: 14px 14px;
          display:flex;
          align-items:center;
          gap: 12px;
          box-shadow: 0 14px 36px rgba(2,6,23,0.06);
        }
        [data-theme="dark"] .kpiCard{ box-shadow: 0 22px 55px rgba(0,0,0,0.45); }
        .kpiLeft { display:flex; align-items:center; gap: 12px; min-width:0; }
        .kpiIcon {
          width: 40px; height: 40px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(37,99,235,0.10);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .kpiIcon i { font-size: 22px; opacity: 0.88; color: var(--blue); }
        [data-theme="dark"] .kpiIcon i { color: rgba(255,255,255,0.92); opacity: 0.92; }
        .kpiValue { font-weight: 950; font-size: 18px; color: var(--text); }
        .kpiLabel { font-size: 12px; font-weight: 900; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; }

        .carousel .carousel-item img {
          border-radius: 14px !important;
          border: 1px solid var(--border);
          box-shadow: 0 18px 40px rgba(2,6,23,0.08);
        }

        .tabs { background: transparent; }
        .tabs .tab a { font-weight: 950; color: rgba(15,23,42,0.70); }
        [data-theme="dark"] .tabs .tab a { color: rgba(148,163,184,0.88); }
        .tabs .tab a.active { color: var(--blue) !important; }
        .tabs .indicator { height: 3px; background: linear-gradient(135deg, var(--blue), var(--blue2)); }

        .docList { list-style:none; margin:0; padding:0; }
        .docRow {
          display:flex; align-items:flex-start; gap:12px;
          padding: 12px 10px;
          border-bottom: 1px solid var(--border);
        }
        .docRow:last-child { border-bottom: 0; }

        .docIco {
          width: 38px; height: 38px; border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(37,99,235,0.08);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .docIco i { font-size: 20px; opacity: 0.88; color: var(--blue); }
        [data-theme="dark"] .docIco i { color: rgba(255,255,255,0.92); opacity: 0.92; }

        .docMain { flex:1; min-width:0; }
        .docTitle { font-weight: 950; color: var(--text); display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
        .docSub { margin-top: 3px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }

        .chip.tiny {
          height: 22px; line-height: 22px;
          font-size: 11px;
          font-weight: 950;
          border-radius: 999px;
          padding: 0 10px;
          background: var(--chipBg);
          border: 1px solid var(--chipBd);
          color: var(--blue);
          text-transform: uppercase;
          letter-spacing: 0.8px;
        }
        [data-theme="dark"] .chip.tiny{ color: rgba(255,255,255,0.92); }

        .docOpen {
          width: 36px; height: 36px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--cardSolid);
          display:flex; align-items:center; justify-content:center;
        }
        .docOpen i { font-size: 18px; opacity: 0.78; color: var(--text); }
        .docOpen:hover { border-color: rgba(37,99,235,0.28); box-shadow: 0 14px 30px rgba(37,99,235,0.10); }

        .input-field input {
          border-bottom: 1px solid rgba(2,6,23,0.20) !important;
          color: var(--text) !important;
        }
        [data-theme="dark"] .input-field input{
          border-bottom: 1px solid rgba(148,163,184,0.28) !important;
        }
        .input-field input:focus {
          border-bottom: 1px solid rgba(37,99,235,0.80) !important;
          box-shadow: 0 1px 0 0 rgba(37,99,235,0.80) !important;
        }

        .updatesBox {
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow:hidden;
          background: var(--card);
          backdrop-filter: blur(14px);
        }
        .uRow { padding: 14px 14px; border-bottom: 1px solid var(--border); display:flex; gap: 12px; align-items:flex-start; }
        .uRow:last-child { border-bottom: 0; }
        .uIco {
          width: 36px; height: 36px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(37,99,235,0.08);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .uIco i { font-size: 18px; opacity: 0.88; color: var(--blue); }
        [data-theme="dark"] .uIco i { color: rgba(255,255,255,0.92); opacity: 0.92; }

        .uTitle { font-weight: 950; color: var(--text); }
        .uDetail { margin-top: 4px; font-size: 13px; color: var(--muted); line-height: 1.5; }
        .uWhen { margin-top: 8px; display:flex; align-items:center; gap:6px; font-size: 12px; color: var(--muted); font-weight: 950; text-transform: uppercase; letter-spacing: 1px; }

        .scrollBox {
          max-height: 260px;
          overflow:auto;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: var(--cardSolid);
        }
        [data-theme="dark"] .scrollBox{ background: rgba(10,16,32,0.62); }

        .collapsible { border: 1px solid var(--border); border-radius: 16px; overflow:hidden; }
        .collapsible-header { background: transparent !important; color: var(--text) !important; font-weight: 950 !important; }
        .collapsible-body { background: transparent !important; color: var(--muted) !important; }
      `}</style>

      <div className="portalBg" />

      <div className="container portalWrap">
        {/* ✅ Theme toggle is now global (doesn't affect column alignment) */}
        <div className="portalTopBar">
          <div className="themePill">
            <div className="themePillLeft">
              <div className="themeDot" aria-hidden="true">
                <i className="material-icons" style={{ fontSize: 18 }}>
                  {theme === "dark" ? "dark_mode" : "light_mode"}
                </i>
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="themeTitle">Theme</div>
                <div className="themeSub">
                  {theme === "dark" ? "Night mode" : "Day mode"} • click to toggle
                </div>
              </div>
            </div>

            <button
              type="button"
              className="themeBtn"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              aria-label="Toggle day/night mode"
              title="Toggle day/night mode"
            >
              <i className="material-icons" style={{ fontSize: 18 }}>
                {theme === "dark" ? "wb_sunny" : "nightlight_round"}
              </i>
              {theme === "dark" ? "Day" : "Night"}
            </button>
          </div>
        </div>

        <div className="row portalGridGap">
          {/* LEFT */}
          <div className="col s12 m3">
            <div className="stack stickyCol">
              <ProfileCard />
              <EmployeeActions />
            </div>
          </div>

          {/* CENTER */}
          <div className="col s12 m6">
            <div className="stackTight">
              <EventHero />

              {/* Featured Trailer */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow">
                    <div>
                      <div className="pTitle">Featured Trailer</div>
                      <div className="pSub">Latest showcase • internal share</div>
                    </div>
                    <span className="pTiny">Latest</span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="mediaFrame">
                    <iframe
                      src="https://www.youtube.com/embed/LwVUdcShfzI"
                      title="Featured"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </div>
              </div>

              {/* KPIs */}
              <div className="kpiGrid">
                {[
                  { icon: "groups", label: "Team Members", value: "42" },
                  { icon: "event_note", label: "Updates This Week", value: "18" },
                  { icon: "verified_user", label: "Portal Status", value: "Healthy" },
                ].map((k) => (
                  <div key={k.label} className="kpiCard">
                    <div className="kpiLeft">
                      <div className="kpiIcon">
                        <i className="material-icons">{k.icon}</i>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="kpiValue">{k.value}</div>
                        <div className="kpiLabel">{k.label}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Highlights carousel */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow">
                    <div>
                      <div className="pTitle">Highlights</div>
                      <div className="pSub">Milestones and demos</div>
                    </div>
                    <span className="pTiny">Swipe</span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="carousel">
                    {[
                      { seed: "portal-auth", title: "Auth + Roles", sub: "JWT + role checks" },
                      { seed: "portal-applicants", title: "Applicants", sub: "Stages + email history" },
                      { seed: "portal-docs", title: "Doc Emails", sub: "PDF attachments" },
                      { seed: "portal-projects", title: "Projects", sub: "Assign + track" },
                      { seed: "portal-updates", title: "Weekly Updates", sub: "Visibility & cadence" },
                      { seed: "portal-admin", title: "Admin UI", sub: "Employee management" },
                    ].map((x, idx) => (
                      <a className="carousel-item" key={idx} href="#!" onClick={(e) => e.preventDefault()}>
                        <div style={{ position: "relative" }}>
                          <img src={`https://picsum.photos/seed/${x.seed}/600/360`} alt={x.title} />
                          <div
                            style={{
                              position: "absolute",
                              left: 10,
                              bottom: 10,
                              right: 10,
                              padding: "9px 10px",
                              borderRadius: 14,
                              background: theme === "dark" ? "rgba(10,16,32,0.72)" : "rgba(255,255,255,0.78)",
                              color: "var(--text)",
                              border: "1px solid var(--border)",
                              backdropFilter: "blur(12px)",
                            }}
                          >
                            <div style={{ fontWeight: 950, fontSize: 13 }}>{x.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.92, color: "var(--muted)" }}>{x.sub}</div>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabs: Media + Docs */}
              <div className="card pCard">
                <div className="pHeader" style={{ paddingBottom: 0 }}>
                  <div className="pTitleRow" style={{ alignItems: "center" }}>
                    <div>
                      <div className="pTitle">Resources</div>
                      <div className="pSub">Docs and internal media</div>
                    </div>
                    <span className="pTiny">Browse</span>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <ul className="tabs tabs-fixed-width">
                      <li className="tab col s3">
                        <a className="active" href="#tab-media">Media</a>
                      </li>
                      <li className="tab col s3">
                        <a href="#tab-docs">Docs</a>
                      </li>
                    </ul>
                  </div>
                </div>

                <div id="tab-media" className="card-content">
                  <div className="row" style={{ marginBottom: 0 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div className="col s12 m6" key={i}>
                        <div className="card pCard pCardTight hoverable">
                          <div className="card-image">
                            <img src={`https://picsum.photos/seed/media${i}/600/340`} alt={`media-${i}`} />
                            <span className="card-title" style={{ fontWeight: 950 }}>
                              Portal Album {i}
                            </span>
                          </div>
                          <div className="card-content">
                            <p className="pTiny" style={{ margin: 0 }}>
                              Showcases, team moments, and build milestones.
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div id="tab-docs" className="card-content" style={{ paddingTop: 14 }}>
                  <div className="input-field" style={{ marginTop: 0 }}>
                    <input
                      id="doc-search"
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                      placeholder="Search docs by title or topic…"
                    />
                    <label htmlFor="doc-search" className="active">Search</label>
                  </div>

                  <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden", background: "var(--cardSolid)" }}>
                    <ul className="docList">
                      {filteredDocs.map((d) => (
                        <li key={d.title} className="docRow">
                          <div className="docIco">
                            <i className="material-icons">{d.icon}</i>
                          </div>
                          <div className="docMain">
                            <div className="docTitle">
                              <span>{d.title}</span>
                              {d.badge ? <span className="chip tiny" style={{ margin: 0 }}>{d.badge}</span> : null}
                            </div>
                            <div className="docSub" title={d.sub}>{d.sub}</div>
                          </div>
                          <a
                            href={d.href}
                            className="tooltipped docOpen"
                            data-tooltip="Open"
                            onClick={(e) => {
                              if (d.href === "#") {
                                e.preventDefault();
                                toastRouteNotWired();
                              }
                            }}
                            style={{ textDecoration: "none" }}
                          >
                            <i className="material-icons">open_in_new</i>
                          </a>
                        </li>
                      ))}

                      {!filteredDocs.length && (
                        <li style={{ textAlign: "center", color: "var(--muted)", padding: "14px 0", fontWeight: 900 }}>
                          No results
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* FAQs */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow">
                    <div>
                      <div className="pTitle">FAQs</div>
                      <div className="pSub">Quick answers for everyone</div>
                    </div>
                    <span className="pTiny">Help</span>
                  </div>
                </div>
                <div className="card-content">
                  <ul className="collapsible">
                    <li>
                      <div className="collapsible-header">
                        <i className="material-icons">help_outline</i>
                        How do I reset my password?
                      </div>
                      <div className="collapsible-body">
                        <span>
                          Use <b>Forgot Password</b> on the login page. If you’re blocked, ask your project lead to re-enable access.
                        </span>
                      </div>
                    </li>
                    <li>
                      <div className="collapsible-header">
                        <i className="material-icons">event_note</i>
                        Where do I submit weekly updates?
                      </div>
                      <div className="collapsible-body">
                        <span>
                          Go to <b>Weekly Updates</b> and submit your progress. This helps project leads keep scope and blockers visible.
                        </span>
                      </div>
                    </li>
                    <li>
                      <div className="collapsible-header">
                        <i className="material-icons">policy</i>
                        What are the data policies?
                      </div>
                      <div className="collapsible-body">
                        <span>
                          Follow <b>Security Policies</b> for MFA and data handling, and <b>Data Retention</b> for storage and cleanup rules.
                        </span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Updates */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow">
                    <div>
                      <div className="pTitle">Updates</div>
                      <div className="pSub">What changed recently</div>
                    </div>
                    <span className="pTiny">Changelog</span>
                  </div>
                </div>
                <div className="card-content">
                  <div className="updatesBox">
                    {updates.map((u, idx) => (
                      <div key={idx} className="uRow">
                        <div className="uIco">
                          <i className="material-icons">{u.icon}</i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="uTitle">{u.title}</div>
                          <div className="uDetail">{u.detail}</div>
                          <div className="uWhen">
                            <i className="material-icons" style={{ fontSize: 16, opacity: 0.75 }}>schedule</i>
                            {u.when}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="pTiny" style={{ marginBottom: 8 }}>Quick notes</div>
                    <div className="scrollBox">
                      <ul className="browser-default" style={{ margin: 0 }}>
                        <li>Emails now record history for audit and follow-ups.</li>
                        <li>WELCOME flow can create employees and optionally remove applicants after onboarding.</li>
                        <li>Raw SES mailer supports logo, shared variables, and PDF generation templates.</li>
                        <li>Core APIs share consistent CORS handling and Dynamo helpers.</li>
                        <li>Admin panel consolidates employee CRUD and project/manager assignment.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* RIGHT */}
          <div className="col s12 m3">
            <div className="stickyCol">
              <RightRail />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}