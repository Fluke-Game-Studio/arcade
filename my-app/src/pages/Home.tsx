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
  // Docs (employee-relevant: keep admin items but badge them clearly)
  // ------------------------------------------------------------
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

    // If you keep admin-only docs, tag them clearly:
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
  }, [docQuery]);

  // ------------------------------------------------------------
  // Updates
  // ------------------------------------------------------------
  const updates: UpdateItem[] = [
    { icon: "group_add", title: "Applicants pipeline upgraded", detail: "Stage-based flow (Intro → Tech → NDA → Offer → Welcome) with email history + previews.", when: "Feb 2026" },
    { icon: "mail", title: "Doc emails now include PDFs", detail: "NDA / Offer / Experience / Welcome emails support PDF attachments with shared vars + optional CC.", when: "Feb 2026" },
    { icon: "verified_user", title: "Auth & roles hardened", detail: "JWT login, role checks, safe self-updates, and admin create/update/revoke.", when: "Feb 2026" },
    { icon: "dns", title: "API modules cleaned up", detail: "Projects, updates, retro, timesheet, applicants are routed via a stable Lambda entrypoint.", when: "Feb 2026" },
    { icon: "notifications_active", title: "Email templates standardized", detail: "Consistent INTRO/TECH/REJECT HTML + admin notifications and applicant thank-you emails.", when: "Feb 2026" },
    { icon: "admin_panel_settings", title: "Admin panel improved", detail: "Employee management (CRUD) + project/manager assignment + certificate composer consolidated.", when: "Feb 2026" },
  ];

  // ------------------------------------------------------------
  // Materialize init
  // ------------------------------------------------------------
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

  return (
    <>
      <style>{`
        :root{
          --cardR: 18px;
          --border: rgba(2,6,23,0.08);
          --muted: rgba(2,6,23,0.60);
          --bg: #f6f8fb;
        }

        body { background: var(--bg); }

        .portalWrap { padding: 18px 0 28px; }
        .portalGridGap { margin-top: 6px; }

        .pCard { border-radius: var(--cardR); overflow: hidden; border: 1px solid var(--border); box-shadow: 0 14px 36px rgba(2,6,23,0.06); }
        .pCard .card-content { padding: 18px 18px; }
        .pCardTight .card-content { padding: 14px 16px; }

        .pHeader {
          padding: 16px 18px 14px;
          border-bottom: 1px solid var(--border);
          background:
            radial-gradient(800px 240px at 10% 0%, rgba(59,130,246,0.12), transparent 55%),
            radial-gradient(680px 240px at 90% 50%, rgba(34,197,94,0.10), transparent 60%),
            linear-gradient(135deg, #ffffff, #fbfdff);
        }

        .pTitleRow { display:flex; align-items:flex-end; justify-content:space-between; gap:12px; }
        .pTitle { font-weight: 950; font-size: 18px; color: #0f172a; letter-spacing: -0.2px; }
        .pSub { font-size: 12px; color: var(--muted); margin-top: 4px; font-weight: 800; }

        .pSectionTitle { font-weight: 950; font-size: 16px; color:#0f172a; }
        .pTiny { font-size: 12px; color: var(--muted); font-weight: 800; }

        .softDivider { height: 1px; background: var(--border); margin: 12px 0; }

        .mediaFrame {
          position: relative; width: 100%;
          padding-top: 56.25%;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: rgba(2,6,23,0.02);
        }
        .mediaFrame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }

        .kpiGrid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 600px) { .kpiGrid { grid-template-columns: 1fr; } }

        .kpiCard {
          border-radius: 16px;
          border: 1px solid var(--border);
          background: #fff;
          padding: 14px 14px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          box-shadow: 0 10px 26px rgba(2,6,23,0.06);
        }
        .kpiLeft { display:flex; align-items:center; gap: 12px; min-width:0; }
        .kpiIcon {
          width: 40px; height: 40px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(2,6,23,0.04);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .kpiIcon i { font-size: 22px; opacity: 0.78; }
        .kpiValue { font-weight: 950; font-size: 18px; color:#0f172a; }
        .kpiLabel { font-size: 12px; font-weight: 900; color: var(--muted); }

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
          background: rgba(2,6,23,0.04);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .docIco i { font-size: 20px; opacity: 0.78; }
        .docMain { flex:1; min-width:0; }
        .docTitle { font-weight: 950; color:#0f172a; display:flex; gap:10px; align-items:center; flex-wrap: wrap; }
        .docSub { margin-top: 3px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow:hidden; text-overflow: ellipsis; }
        .chip.tiny { height: 22px; line-height: 22px; font-size: 11px; font-weight: 900; }
        .docOpen {
          width: 34px; height: 34px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background:#fff;
          display:flex; align-items:center; justify-content:center;
        }
        .docOpen i { font-size: 18px; opacity: 0.75; }

        .updatesBox { border: 1px solid var(--border); border-radius: 16px; overflow:hidden; background:#fff; }
        .uRow { padding: 14px 14px; border-bottom: 1px solid var(--border); display:flex; gap: 12px; align-items:flex-start; }
        .uRow:last-child { border-bottom: 0; }
        .uIco {
          width: 36px; height: 36px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: rgba(2,6,23,0.04);
          display:flex; align-items:center; justify-content:center;
          flex: 0 0 auto;
        }
        .uIco i { font-size: 18px; opacity: 0.78; }
        .uTitle { font-weight: 950; color:#0f172a; }
        .uDetail { margin-top: 4px; font-size: 13px; color: var(--muted); line-height: 1.45; }
        .uWhen { margin-top: 8px; display:flex; align-items:center; gap:6px; font-size: 12px; color: var(--muted); font-weight: 900; }

        .scrollBox {
          max-height: 260px;
          overflow:auto;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid var(--border);
          background:#fff;
        }

        .tabs { background: transparent; }
        .tabs .tab a { font-weight: 950; }
        .tabs .indicator { height: 3px; }

        /* make center column feel less “tall” */
        .stack { display: grid; gap: 12px; }

        /* keep Materialize forms clean */
        .input-field input { border-bottom: 1px solid rgba(2,6,23,0.20) !important; }
        .input-field input:focus { border-bottom: 1px solid rgba(37,99,235,0.80) !important; box-shadow: 0 1px 0 0 rgba(37,99,235,0.80) !important; }
      `}</style>

      <div className="container portalWrap">
        <div className="row portalGridGap">
          {/* LEFT */}
          <div className="col s12 m3">
            <div className="stack">
              <ProfileCard />
              {/* EmployeeActions should be employee-friendly now (not admin-only). */}
              <EmployeeActions />
            </div>
          </div>

          {/* CENTER */}
          <div className="col s12 m6">
            <div className="stack">
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
                          <img src={`https://picsum.photos/seed/${x.seed}/600/360`} alt={x.title} style={{ borderRadius: 14 }} />
                          <div
                            style={{
                              position: "absolute",
                              left: 10,
                              bottom: 10,
                              right: 10,
                              padding: "8px 10px",
                              borderRadius: 14,
                              background: "rgba(2,6,23,0.62)",
                              color: "white",
                              border: "1px solid rgba(255,255,255,0.10)",
                            }}
                          >
                            <div style={{ fontWeight: 950, fontSize: 13 }}>{x.title}</div>
                            <div style={{ fontSize: 12, opacity: 0.92 }}>{x.sub}</div>
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
                            <span className="card-title" style={{ fontWeight: 950 }}>Portal Album {i}</span>
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

                  <div style={{ borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden", background: "#fff" }}>
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
                                if (typeof M !== "undefined") M.toast({ html: "Route not wired yet.", classes: "blue-grey darken-1" });
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
            <RightRail />
          </div>
        </div>
      </div>
    </>
  );
}
