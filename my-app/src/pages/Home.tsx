// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import ProfileCard from "../components/ProfileCard";
import RightRail from "../components/RightRail";
import EventHero from "../components/EventHero";
import EmployeeActions from "../components/EmployeeActions";
import { useAuth } from "../auth/AuthContext";

declare const M: any;

type DocLink = {
  title: string;
  sub: string;
  icon: string;
  href: string;
  badge?: string;
};

type DocCategory = {
  id: string;
  title: string;
  sub: string;
  icon: string;
  items: DocLink[];
};

type UpdateItem = {
  title: string;
  detail: string;
  when: string;
  icon: string;
};

export default function Home() {
  const { user } = useAuth();
  const [docQuery, setDocQuery] = useState("");
  const [activeDocCategory, setActiveDocCategory] = useState<string | null>(null);
  const role = String(user?.role || "").toUpperCase();
  const isAdminOrSuper = role === "ADMIN" || role === "SUPER";
  const releaseVersion = "v2026.04.12";
  const releaseStorageKey = `fg_home_whats_new_seen_${releaseVersion}`;
  const [showReleaseCard, setShowReleaseCard] = useState(false);

  // Day/Night (persisted)
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = (localStorage.getItem("fg_theme") || "").toLowerCase();
    return saved === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem("fg_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const seen = localStorage.getItem(releaseStorageKey);
    if (seen === "1") return;
    setShowReleaseCard(true);
  }, [releaseStorageKey]);

  const docCategories: DocCategory[] = useMemo(() => {
    const categories: DocCategory[] = [
      {
        id: "onboarding",
        title: "Onboarding",
        sub: "Start here for first-week setup and weekly cadence",
        icon: "rocket_launch",
        items: [
          { title: "Onboarding Guide", sub: "Accounts, tools, and first-week checklist", icon: "menu_book", href: "#", badge: "Start" },
          { title: "Weekly Updates", sub: "Submit progress and view team cadence", icon: "event_note", href: "/updates/new", badge: "Core" },
          { title: "Retro & Timesheet", sub: "Weekly retro + timesheet submissions", icon: "assignment", href: "#", badge: "Core" },
        ],
      },
      {
        id: "engineering",
        title: "Engineering",
        sub: "Technical standards and project docs",
        icon: "terminal",
        items: [
          { title: "Engineering Playbook", sub: "Branch rules, PR standards, CI/CD", icon: "build", href: "#" },
          { title: "Design System", sub: "Tokens, components, UI guidelines", icon: "palette", href: "#" },
          { title: "Projects", sub: "View assigned work and project status", icon: "dashboard_customize", href: "#" },
          {
            title: "API Endpoints Docs",
            sub: "Read-only endpoint registry and request schemas",
            icon: "api",
            href: "/docs/endpoints",
            badge: "Docs",
          },
        ],
      },
      {
        id: "operations",
        title: "Operations",
        sub: "Security, policy, and lifecycle documents",
        icon: "policy",
        items: [
          { title: "Security Policies", sub: "MFA, credentials, data handling rules", icon: "lock", href: "#", badge: "Required" },
          { title: "Incident Runbook", sub: "SEV process, comms, templates", icon: "warning_amber", href: "#" },
          { title: "Access & Roles", sub: "Auth, roles, and account lifecycle", icon: "verified_user", href: "#" },
          { title: "Data Retention", sub: "Backups, privacy, retention policy", icon: "inventory_2", href: "#" },
        ],
      },
    ];

    if (isAdminOrSuper) {
      categories.push({
        id: "admin",
        title: "Admin",
        sub: "Admin-focused docs and controls",
        icon: "admin_panel_settings",
        items: [
          { title: "Applicants Admin", sub: "Hiring pipeline and email actions", icon: "group_add", href: "#", badge: "Admin" },
          { title: "Email Templates", sub: "Standard comms formats used by the team", icon: "mail", href: "#" },
        ],
      });
    }

    return categories;
  }, [isAdminOrSuper]);

  useEffect(() => {
    if (!activeDocCategory) return;
    if (!docCategories.some((c) => c.id === activeDocCategory)) {
      setActiveDocCategory(null);
    }
  }, [activeDocCategory, docCategories]);

  const filteredCategories = useMemo(() => {
    const q = docQuery.trim().toLowerCase();
    if (!q) return docCategories;
    return docCategories.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.sub.toLowerCase().includes(q) ||
        c.items.some(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.sub.toLowerCase().includes(q) ||
            (d.badge || "").toLowerCase().includes(q)
        )
    );
  }, [docQuery, docCategories]);

  const activeCategory = useMemo(
    () => docCategories.find((c) => c.id === activeDocCategory) || null,
    [activeDocCategory, docCategories]
  );

  const filteredActiveDocs = useMemo(() => {
    if (!activeCategory) return [];
    const q = docQuery.trim().toLowerCase();
    if (!q) return activeCategory.items;
    return activeCategory.items.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.sub.toLowerCase().includes(q) ||
        (d.badge || "").toLowerCase().includes(q)
    );
  }, [activeCategory, docQuery]);

  const updates: UpdateItem[] = [
    { icon: "group_add", title: "Applicants pipeline upgraded", detail: "Stage-based flow (Intro â†’ Tech â†’ NDA â†’ Offer â†’ Welcome) with email history + previews.", when: "Feb 2026" },
    { icon: "mail", title: "Doc emails now include PDFs", detail: "NDA / Offer / Experience / Welcome emails support PDF attachments with shared vars + optional CC.", when: "Feb 2026" },
    { icon: "verified_user", title: "Auth & roles hardened", detail: "JWT login, role checks, safe self-updates, and admin create/update/revoke.", when: "Feb 2026" },
    { icon: "dns", title: "API modules cleaned up", detail: "Projects, updates, retro, timesheet, applicants are routed via a stable Lambda entrypoint.", when: "Feb 2026" },
    { icon: "notifications_active", title: "Email templates standardized", detail: "Consistent INTRO/TECH/REJECT HTML + admin notifications and applicant thank-you emails.", when: "Feb 2026" },
    { icon: "admin_panel_settings", title: "Admin panel improved", detail: "Employee management (CRUD) + project/manager assignment + certificate composer consolidated.", when: "Feb 2026" },
  ];

  const quarterEvents = useMemo(
    () => [
      {
        id: "quarter-random-snapshot",
        title: "Quarterly Company Update",
        subtitle: "Random snapshot first, then featured trailers",
        at: new Date(Date.now() + 21 * 86400_000),
        poster: `https://picsum.photos/seed/quarter-${Date.now()}/1600/900`,
        location: "Online",
        host: "Leadership Team",
        tags: ["Quarter Update", "Town Hall"],
      },
      {
        id: "quarter-trailer-pavan",
        title: "Featured Trailer",
        subtitle: "Project Pavan gameplay showcase",
        at: new Date(Date.now() + 22 * 86400_000),
        poster: "https://img.youtube.com/vi/LwVUdcShfzI/maxresdefault.jpg",
        youtubeEmbedUrl:
          "https://www.youtube.com/embed/LwVUdcShfzI?autoplay=1&mute=1&controls=1&rel=0&playsinline=1",
        location: "Studio Channel",
        host: "Creative Team",
        tags: ["Trailer", "Project Pavan"],
        joinHref: "https://www.youtube.com/watch?v=LwVUdcShfzI",
        shareHref: "https://www.youtube.com/watch?v=LwVUdcShfzI",
      },
      {
        id: "quarter-trailer-cops",
        title: "Featured Trailer",
        subtitle: "Crazzy Cops V2 teaser",
        at: new Date(Date.now() + 23 * 86400_000),
        poster: "https://picsum.photos/seed/crazzy-cops-v2-trailer/1600/900",
        youtubeEmbedUrl:
          "https://www.youtube.com/embed/LwVUdcShfzI?start=42&autoplay=1&mute=1&controls=1&rel=0&playsinline=1",
        location: "Studio Channel",
        host: "Creative Team",
        tags: ["Trailer", "Crazzy Cops V2"],
      },
    ],
    []
  );

  useEffect(() => {
    if (typeof M === "undefined") return;

    const t = window.setTimeout(() => {
      try {
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

        /* âœ… FIX: Theme pill moved OUT of left column flow so it doesn't push the
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

        .homeNavGrid {
          display: grid;
          gap: 10px;
        }
        .homeNavCard {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 12px;
          background: var(--card);
          text-decoration: none;
          color: var(--text);
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .homeNavCard:hover {
          border-color: rgba(37,99,235,0.28);
          box-shadow: 0 14px 30px rgba(37,99,235,0.10);
          transform: translateY(-1px);
        }
        .homeNavIcon {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: rgba(37,99,235,0.08);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }
        .homeNavIcon i { color: var(--blue); font-size: 20px; }
        .homeNavTitle { font-size: 14px; font-weight: 950; line-height: 1.2; color: var(--text); }
        .homeNavSub { font-size: 12px; color: var(--muted); margin-top: 3px; line-height: 1.4; }
        .homeNavCard.disabled {
          cursor: not-allowed;
          opacity: 0.72;
          pointer-events: none;
        }
        .releaseOverlay {
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(2,6,23,0.42);
          display: grid;
          place-items: center;
          padding: 14px;
        }
        .releaseCard {
          width: min(560px, 100%);
          border-radius: 18px;
          border: 1px solid var(--border);
          background: var(--cardSolid);
          box-shadow: 0 26px 70px rgba(2,6,23,0.34);
          overflow: hidden;
        }
        .releaseHead {
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
          background:
            radial-gradient(700px 220px at 0% 0%, rgba(37,99,235,0.16), transparent 58%),
            linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.76));
        }
        [data-theme="dark"] .releaseHead{
          background:
            radial-gradient(700px 220px at 0% 0%, rgba(96,165,250,0.22), transparent 58%),
            linear-gradient(135deg, rgba(10,16,32,0.95), rgba(10,16,32,0.76));
        }
        .releaseBody { padding: 16px 18px 18px; }
        .releaseBadge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          border: 1px solid var(--chipBd);
          background: var(--chipBg);
          color: var(--blue);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .8px;
          text-transform: uppercase;
          padding: 5px 10px;
        }
        [data-theme="dark"] .releaseBadge { color: rgba(255,255,255,0.94); }
        .releaseList {
          margin: 10px 0 0 0;
          padding: 0 0 0 18px;
          color: var(--muted);
          line-height: 1.6;
          font-size: 13px;
          font-weight: 700;
        }
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

        .docCategoryGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .docCategoryTile {
          border: 1px solid var(--border);
          border-radius: 14px;
          background: var(--card);
          padding: 12px;
          display: flex;
          gap: 10px;
          cursor: pointer;
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .docCategoryTile:hover {
          border-color: rgba(37,99,235,0.28);
          box-shadow: 0 14px 30px rgba(37,99,235,0.10);
          transform: translateY(-1px);
        }
        .docCategoryMeta { flex: 1; min-width: 0; }
        .docCategoryTitle { font-weight: 950; color: var(--text); display:flex; align-items:center; gap:8px; flex-wrap: wrap; }
        .docCategorySub { margin-top: 4px; font-size: 12px; color: var(--muted); line-height: 1.4; }
        .docCount {
          font-size: 11px;
          font-weight: 950;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-top: 7px;
        }
        .docBackBtn {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: var(--cardSolid);
          height: 32px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 900;
          color: var(--text);
          cursor: pointer;
        }
        .docBackBtn:hover { border-color: rgba(37,99,235,0.28); box-shadow: 0 10px 24px rgba(37,99,235,0.10); }

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
      {showReleaseCard && (
        <div className="releaseOverlay" role="dialog" aria-modal="true" aria-label="What's new in this release">
          <div className="releaseCard">
            <div className="releaseHead">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div className="releaseBadge">
                    <i className="material-icons" style={{ fontSize: 14 }}>new_releases</i>
                    {releaseVersion}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 1000, letterSpacing: "-.02em", color: "var(--text)" }}>
                    What's New In This Release
                  </div>
                </div>
              </div>
            </div>
            <div className="releaseBody">
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>
                Release highlights (core features only).
              </div>
              <ul className="releaseList">
                <li>Auth boot: validate saved token before entering the app (no Home flash + no bad-token toast loop).</li>
                <li>Login UX: branded loader under the Fluke logo, then auto-flip to the form only when the token is invalid.</li>
                <li>AI Chat routing: requests carry context + agent identity (Project Manager for internal/public, default assistant for personal).</li>
                <li>WebSocket reliability: `ai-result` frames include `clientId` so responses attach to the correct request.</li>
                <li>Update summaries: admin queries resolve the correct employee and summarize real submissions instead of generic JSON-style replies.</li>
                <li>Summary tone: deterministic summaries now return smooth “pattern/themes” answers by default (raw lists only when requested).</li>
              </ul>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn blue"
                  onClick={() => {
                    localStorage.setItem(releaseStorageKey, "1");
                    setShowReleaseCard(false);
                  }}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container portalWrap">
        {/* âœ… Theme toggle is now global (doesn't affect column alignment) */}
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
                  {theme === "dark" ? "Night mode" : "Day mode"} â€¢ click to toggle
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
              <EventHero events={quarterEvents} autoRotateMs={8000} />

              {/* Docs Resources */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow" style={{ alignItems: "center" }}>
                    <div>
                      <div className="pTitle">Docs</div>
                      <div className="pSub">
                        {activeCategory ? `${activeCategory.title} docs` : "Browse docs by category"}
                      </div>
                    </div>
                    <span className="pTiny">Browse</span>
                  </div>
                </div>

                <div className="card-content" style={{ paddingTop: 8 }}>
                  <div className="input-field" style={{ marginTop: 0 }}>
                    <input
                      id="doc-search"
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                      placeholder="Search docs by title or topic..."
                    />
                    <label htmlFor="doc-search" className="active">Search</label>
                  </div>

                  <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden", background: "var(--cardSolid)" }}>
                    <div style={{ padding: 12 }}>
                      {activeCategory ? (
                        <>
                          <div style={{ marginBottom: 10 }}>
                            <button
                              type="button"
                              className="docBackBtn"
                              onClick={() => setActiveDocCategory(null)}
                            >
                              <i className="material-icons" style={{ fontSize: 16 }}>arrow_back</i>
                              Back to categories
                            </button>
                          </div>

                          <ul className="docList">
                            {filteredActiveDocs.map((d) => (
                              <li key={`${activeCategory.id}-${d.title}`} className="docRow">
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

                            {!filteredActiveDocs.length && (
                              <li style={{ textAlign: "center", color: "var(--muted)", padding: "14px 0", fontWeight: 900 }}>
                                No docs in this category match your search
                              </li>
                            )}
                          </ul>
                        </>
                      ) : (
                        <div className="docCategoryGrid">
                          {filteredCategories.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className="docCategoryTile"
                              onClick={() => setActiveDocCategory(c.id)}
                              style={{ textAlign: "left" }}
                            >
                              <div className="docIco">
                                <i className="material-icons">{c.icon}</i>
                              </div>
                              <div className="docCategoryMeta">
                                <div className="docCategoryTitle">
                                  <span>{c.title}</span>
                                </div>
                                <div className="docCategorySub">{c.sub}</div>
                                <div className="docCount">{c.items.length} docs</div>
                              </div>
                            </button>
                          ))}

                          {!filteredCategories.length && (
                            <div style={{ textAlign: "center", color: "var(--muted)", padding: "14px 0", fontWeight: 900 }}>
                              No categories match your search
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Updates */}
              <div className="card pCard">
                <div className="pHeader">
                  <div className="pTitleRow">
                    <div>
                      <div className="pTitle">New Updates</div>
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

