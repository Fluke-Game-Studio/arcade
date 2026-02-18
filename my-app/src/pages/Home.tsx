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

  // ------------------------------------------------------------
  // Docs (replace href when routes exist)
  // ------------------------------------------------------------
  const docs: DocLink[] = [
    { title: "Onboarding Guide", sub: "Accounts, tools, and first-week checklist", icon: "menu_book", href: "#", badge: "Start" },
    { title: "Security Policies", sub: "MFA, credentials, data handling rules", icon: "lock", href: "#", badge: "Required" },
    { title: "Engineering Playbook", sub: "Branch rules, PR standards, CI/CD", icon: "build", href: "#" },
    { title: "Incident Runbook", sub: "SEV process, comms, templates", icon: "warning_amber", href: "#" },
    { title: "Design System", sub: "Tokens, components, UI guidelines", icon: "palette", href: "#" },
    { title: "Projects", sub: "Create, update, assign projects", icon: "dashboard_customize", href: "#" },
    { title: "Weekly Updates", sub: "Submit and review weekly progress", icon: "event_note", href: "#" },
    { title: "Retro & Timesheet", sub: "Retro + timesheet submission flow", icon: "assignment", href: "#" },
    { title: "Applicants Admin", sub: "Stages, email actions, and history", icon: "group_add", href: "#" },
    { title: "Email Templates", sub: "INTRO/TECH/REJECT + doc email formats", icon: "mail", href: "#" },
    { title: "Access & Roles", sub: "Auth, roles, account lifecycle", icon: "verified_user", href: "#" },
    { title: "Data Retention", sub: "Backups, privacy, retention policy", icon: "inventory_2", href: "#" },
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
  }, [docQuery]);

  // ------------------------------------------------------------
  // Meaningful updates (no lorem)
  // ------------------------------------------------------------
  const updates: UpdateItem[] = [
    {
      icon: "group_add",
      title: "Applicants pipeline upgraded",
      detail: "Stage-based flow (Intro → Tech → NDA → Offer → Welcome) with email history + previews.",
      when: "Feb 2026",
    },
    {
      icon: "mail",
      title: "Doc emails now include PDFs",
      detail: "NDA / Offer / Experience / Welcome emails support PDF attachments with shared vars + optional CC.",
      when: "Feb 2026",
    },
    {
      icon: "verified_user",
      title: "Auth & roles hardened",
      detail: "JWT login, role checks, safe self-updates, and admin create/update/revoke.",
      when: "Feb 2026",
    },
    {
      icon: "dns",
      title: "API modules cleaned up",
      detail: "Projects, updates, retro, timesheet, applicants are routed via a stable Lambda entrypoint.",
      when: "Feb 2026",
    },
    {
      icon: "notifications_active",
      title: "Email templates standardized",
      detail: "Consistent INTRO/TECH/REJECT HTML + admin notifications and applicant thank-you emails.",
      when: "Feb 2026",
    },
    {
      icon: "admin_panel_settings",
      title: "Admin panel improved",
      detail: "Employee management (CRUD) + project/manager assignment + certificate composer consolidated.",
      when: "Feb 2026",
    },
  ];

  // ------------------------------------------------------------
  // Materialize init (tabs/collapsible/carousel/tooltips)
  // ------------------------------------------------------------
  useEffect(() => {
    if (typeof M === "undefined") return;

    const t = setTimeout(() => {
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

    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Light modern polish while staying Materialize-friendly */}
      <style>{`
        .portal-wrap { padding-top: 16px; padding-bottom: 28px; }
        .portal-card { border-radius: 16px; overflow: hidden; }
        .portal-title { display:flex; align-items:baseline; justify-content:space-between; gap:12px; }
        .muted { color: rgba(0,0,0,0.60); }
        .soft-divider { height:1px; background: rgba(0,0,0,0.08); margin: 10px 0; }
        .media-frame { position: relative; width: 100%; padding-top: 56.25%; border-radius: 14px; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); background: rgba(0,0,0,0.02); }
        .media-frame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
        .kpi-value { font-weight: 900; font-size: 18px; margin-top: 6px; }
        .kpi-label { font-size: 12px; color: rgba(0,0,0,0.55); }
        .list-clean { list-style:none; margin:0; padding:0; }
        .doc-row { display:flex; align-items:center; gap:12px; padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,0.08); }
        .doc-row:last-child { border-bottom: 0; }
        .doc-ico { width:36px; height:36px; border-radius:50%; background: rgba(0,0,0,0.06); display:flex; align-items:center; justify-content:center; }
        .doc-ico i { font-size:20px; opacity:0.72; }
        .doc-main { flex:1; min-width:0; }
        .doc-title { font-weight: 900; }
        .doc-sub { font-size: 12px; color: rgba(0,0,0,0.62); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chip.tiny { height: 22px; line-height: 22px; font-size: 11px; font-weight: 800; }
        .updates-box { border-radius: 14px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; }
        .updates-item { padding: 12px 14px; border-bottom: 1px solid rgba(0,0,0,0.08); display:flex; gap: 12px; align-items:flex-start; }
        .updates-item:last-child { border-bottom: 0; }
        .updates-ico { width: 34px; height: 34px; border-radius: 10px; background: rgba(0,0,0,0.06); display:flex; align-items:center; justify-content:center; flex: 0 0 auto; }
        .updates-ico i { font-size: 18px; opacity: 0.75; }
        .updates-title { font-weight: 900; margin-bottom: 2px; }
        .updates-when { font-size: 12px; color: rgba(0,0,0,0.55); margin-top: 6px; display:flex; align-items:center; gap:6px; }
        .scroll-box { max-height: 280px; overflow:auto; padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); }
        .tabs .tab a { font-weight: 900; }
        .tabs .tab a:focus, .tabs .tab a:focus.active { background: transparent; }
      `}</style>

      <div className="container portal-wrap">
        <div className="row">
          {/* LEFT */}
          <div className="col s12 m3">
            <ProfileCard />
            <EmployeeActions />
          </div>

          {/* CENTER */}
          <div className="col s12 m6">
            <EventHero />

            {/* ✅ KEEP: Featured trailer video */}
            <div className="card portal-card">
              <div className="card-content" style={{ paddingBottom: 10 }}>
                <div className="portal-title">
                  <span style={{ fontWeight: 900, fontSize: 18 }}>Featured Trailer</span>
                  <span className="muted" style={{ fontSize: 12 }}>Latest showcase</span>
                </div>
              </div>
              <div className="card-image" style={{ padding: "0 16px 16px" }}>
                <div className="media-frame">
                  <iframe
                    src="https://www.youtube.com/embed/LwVUdcShfzI"
                    title="Featured"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>

            {/* KPIs (kept) */}
            <div className="row">
              {[
                { icon: "groups", label: "Active Employees", value: "42" },
                { icon: "how_to_reg", label: "Applicants In Review", value: "18" },
                { icon: "verified_user", label: "Auth Status", value: "Healthy" },
              ].map((k) => (
                <div className="col s12 m4" key={k.label}>
                  <div className="card hoverable portal-card">
                    <div className="card-content center" style={{ padding: 16 }}>
                      <i className="material-icons" style={{ fontSize: 30, opacity: 0.82 }}>
                        {k.icon}
                      </i>
                      <div className="kpi-value">{k.value}</div>
                      <div className="kpi-label">{k.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel (kept but made purposeful) */}
            <div className="card portal-card">
              <div className="card-content">
                <div className="portal-title">
                  <span style={{ fontWeight: 900, fontSize: 18 }}>Highlights</span>
                  <span className="muted" style={{ fontSize: 12 }}>Recent demos & portal milestones</span>
                </div>
                <div className="soft-divider" />
                <div className="carousel">
                  {[
                    { seed: "portal-auth", title: "Auth + Roles", sub: "JWT + role checks" },
                    { seed: "portal-applicants", title: "Applicants", sub: "Stages + email history" },
                    { seed: "portal-docs", title: "Doc Emails", sub: "PDF attachments" },
                    { seed: "portal-projects", title: "Projects", sub: "Assign + track" },
                    { seed: "portal-updates", title: "Weekly Updates", sub: "Visibility & cadence" },
                    { seed: "portal-admin", title: "Admin UI", sub: "Employee management" },
                  ].map((x, idx) => (
                    <a className="carousel-item" key={idx} href="#!">
                      <div style={{ position: "relative" }}>
                        <img
                          src={`https://picsum.photos/seed/${x.seed}/600/360`}
                          alt={x.title}
                          style={{ borderRadius: 12 }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            left: 10,
                            bottom: 10,
                            right: 10,
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: "rgba(0,0,0,0.55)",
                            color: "white",
                          }}
                        >
                          <div style={{ fontWeight: 900, fontSize: 13 }}>{x.title}</div>
                          <div style={{ fontSize: 12, opacity: 0.9 }}>{x.sub}</div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabs: Media + Docs (kept) */}
            <div className="card portal-card">
              <div className="card-content" style={{ paddingBottom: 0 }}>
                <ul className="tabs tabs-fixed-width">
                  <li className="tab col s3">
                    <a className="active" href="#tab-media">
                      Media
                    </a>
                  </li>
                  <li className="tab col s3">
                    <a href="#tab-docs">Docs</a>
                  </li>
                </ul>
              </div>

              <div id="tab-media" className="card-content">
                <div className="row" style={{ marginBottom: 0 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <div className="col s12 m6" key={i}>
                      <div className="card small hoverable portal-card">
                        <div className="card-image">
                          <img src={`https://picsum.photos/seed/media${i}/600/340`} alt={`media-${i}`} />
                          <span className="card-title" style={{ fontWeight: 900 }}>
                            Portal Album {i}
                          </span>
                        </div>
                        <div className="card-content">
                          <p className="muted" style={{ margin: 0 }}>
                            Internal showcases, team moments, and build milestones.
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="tab-docs" className="card-content" style={{ paddingTop: 12 }}>
                <div className="input-field" style={{ marginTop: 0 }}>
                  <input
                    id="doc-search"
                    value={docQuery}
                    onChange={(e) => setDocQuery(e.target.value)}
                    placeholder="Search docs by title or topic…"
                  />
                  <label htmlFor="doc-search" className="active">
                    Search
                  </label>
                </div>

                <div
                  style={{
                    maxHeight: 340,
                    overflowY: "auto",
                    paddingRight: 6,
                    WebkitOverflowScrolling: "touch",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <ul className="list-clean">
                    {filteredDocs.map((d) => (
                      <li key={d.title} className="doc-row">
                        <div className="doc-ico">
                          <i className="material-icons">{d.icon}</i>
                        </div>
                        <div className="doc-main">
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div className="doc-title">{d.title}</div>
                            {d.badge ? <span className="chip tiny" style={{ margin: 0 }}>{d.badge}</span> : null}
                          </div>
                          <div className="doc-sub" title={d.sub}>
                            {d.sub}
                          </div>
                        </div>
                        <a href={d.href} className="tooltipped" data-tooltip="Open">
                          <i className="material-icons">open_in_new</i>
                        </a>
                      </li>
                    ))}
                    {!filteredDocs.length && (
                      <li style={{ textAlign: "center", color: "rgba(0,0,0,0.55)", padding: "14px 0" }}>
                        No results
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* FAQs (kept, cleaner) */}
            <div className="card portal-card">
              <div className="card-content">
                <div className="portal-title">
                  <span style={{ fontWeight: 900, fontSize: 18 }}>FAQs</span>
                  <span className="muted" style={{ fontSize: 12 }}>Quick answers</span>
                </div>
                <div className="soft-divider" />
                <ul className="collapsible">
                  <li>
                    <div className="collapsible-header">
                      <i className="material-icons">help_outline</i>How do I reset my password?
                    </div>
                    <div className="collapsible-body">
                      <span>
                        Use <b>Forgot Password</b> on the login page. If access is blocked, ask an admin to verify your role and re-enable your account.
                      </span>
                    </div>
                  </li>
                  <li>
                    <div className="collapsible-header">
                      <i className="material-icons">apps</i>Where do I manage applicants?
                    </div>
                    <div className="collapsible-body">
                      <span>
                        Go to <b>Applicants Admin</b> to move candidates through stages and send INTRO/TECH/REJECT or NDA/OFFER/WELCOME emails with history tracking.
                      </span>
                    </div>
                  </li>
                  <li>
                    <div className="collapsible-header">
                      <i className="material-icons">policy</i>What are the data policies?
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

            {/* Updates (kept, now meaningful) */}
            <div className="card portal-card">
              <div className="card-content">
                <div className="portal-title">
                  <span style={{ fontWeight: 900, fontSize: 18 }}>Updates</span>
                  <span className="muted" style={{ fontSize: 12 }}>What changed recently</span>
                </div>

                <div className="soft-divider" />

                <div className="updates-box">
                  {updates.map((u, idx) => (
                    <div key={idx} className="updates-item">
                      <div className="updates-ico">
                        <i className="material-icons">{u.icon}</i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="updates-title">{u.title}</div>
                        <div className="muted" style={{ fontSize: 13, lineHeight: 1.4 }}>
                          {u.detail}
                        </div>
                        <div className="updates-when">
                          <i className="material-icons" style={{ fontSize: 16, opacity: 0.7 }}>schedule</i>
                          {u.when}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                    Quick notes
                  </div>
                  <div className="scroll-box">
                    <ul className="browser-default" style={{ margin: 0 }}>
                      <li>Applicants emails now record history for audit and follow-ups.</li>
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

          {/* RIGHT */}
          <div className="col s12 m3">
            <RightRail />
          </div>
        </div>
      </div>
    </>
  );
}
