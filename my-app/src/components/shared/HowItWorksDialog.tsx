import { createPortal } from "react-dom";
import { useState } from "react";

export type HowItWorksSlide = {
  title: string;
  eyebrow: string;
  subtitle: string;
  icon: string;
  bulletIcons?: string[];
  accent: string;
  tone: string;
  bullets: string[];
  note: string;
  sideTitle: string;
  sideRows: Array<{ label: string; value: string; color: string }>;
};

type HowItWorksDialogProps = {
  title: string;
  subtitle: string;
  slides: HowItWorksSlide[];
  triggerLabel?: string;
  triggerIcon?: string;
  triggerClassName?: string;
};

export default function HowItWorksDialog({
  title,
  subtitle,
  slides,
  triggerLabel = "How it works",
  triggerIcon = "help_outline",
  triggerClassName = "accBtn subtle",
}: HowItWorksDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const current = slides[Math.min(slides.length - 1, Math.max(0, step))];

  return (
    <>
      <style>{`
        .howItWorksButton{
          display:inline-flex;
          align-items:center;
          gap:8px;
        }
        .howItWorksOverlay{
          position:fixed;
          inset:0;
          background:rgba(15,23,42,.62);
          display:grid;
          place-items:center;
          z-index:3200;
          padding:18px;
        }
        .howItWorksModal{
          width:min(1120px, 100%);
          max-height:90vh;
          overflow:auto;
          border-radius:28px;
          border:1px solid rgba(148,163,184,.18);
          background:linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow:0 30px 90px rgba(15,23,42,.36);
          padding:18px;
          display:grid;
          gap:14px;
        }
        .howItWorksHeader{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap:12px;
          flex-wrap:wrap;
        }
        .howItWorksTitle{
          font-size:24px;
          font-weight:1000;
          color:#0f172a;
          line-height:1.05;
        }
        .howItWorksSub{
          margin-top:6px;
          color:#64748b;
          font-size:13px;
          line-height:1.55;
          max-width:820px;
        }
        .howItWorksClose{
          border:1px solid #dbe5ef;
          background:#fff;
          border-radius:14px;
          width:42px;
          height:42px;
          display:grid;
          place-items:center;
          cursor:pointer;
        }
        .howItWorksStepBadge{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:10px 14px;
          border-radius:999px;
          background:rgba(37,99,235,.08);
          border:1px solid rgba(37,99,235,.18);
          color:#1d4ed8;
          font-size:12px;
          font-weight:1000;
          width:fit-content;
        }
        .howItWorksTabs{
          display:grid;
          grid-template-columns:repeat(3, minmax(0, 1fr));
          gap:12px;
        }
        @media (max-width: 960px){
          .howItWorksTabs{ grid-template-columns:1fr; }
        }
        .howItWorksTab{
          border-radius:18px;
          border:1px solid #dbe5ef;
          background:#fff;
          padding:12px 14px;
          text-align:left;
          cursor:pointer;
          display:grid;
          gap:5px;
          min-height:88px;
        }
        .howItWorksTab.active{
          border-color: rgba(37,99,235,.35);
          background: linear-gradient(180deg, rgba(239,246,255,.98), rgba(255,255,255,.98));
          box-shadow: 0 8px 22px rgba(37,99,235,.08);
        }
        .howItWorksTab .k{
          font-size:11px;
          font-weight:1000;
          letter-spacing:.7px;
          text-transform:uppercase;
          color:#1d4ed8;
        }
        .howItWorksTab .t{
          font-size:14px;
          font-weight:1000;
          color:#0f172a;
        }
        .howItWorksTab .s{
          font-size:12px;
          line-height:1.45;
          color:#64748b;
        }
        .howItWorksStage{
          display:block;
        }
        .howItWorksPane{
          border-radius:20px;
          border:1px solid #dbe5ef;
          padding:14px;
          display:grid;
          gap:12px;
          min-height:unset;
        }
        .howItWorksKicker{
          font-size:11px;
          font-weight:1000;
          letter-spacing:.7px;
          text-transform:uppercase;
          color:#1d4ed8;
        }
        .howItWorksStepTitle{
          font-size:22px;
          font-weight:1000;
          color:#0f172a;
          line-height:1.1;
          margin-top:4px;
        }
        .howItWorksStepSub{
          margin-top:8px;
          color:#475569;
          font-size:13px;
          line-height:1.55;
        }
        .howItWorksBody{
          display:grid;
          grid-template-columns:minmax(0, 1.15fr) minmax(280px, 360px);
          gap:16px;
          align-items:start;
        }
        @media (max-width: 960px){
          .howItWorksBody{ grid-template-columns:1fr; }
        }
        .howItWorksCopy{
          display:grid;
          gap:10px;
          align-content:start;
        }
        .howItWorksBullets{
          margin:0;
          padding-left:20px;
          color:#334155;
          font-size:13px;
          line-height:1.65;
        }
        .howItWorksBullets li{ margin-bottom:6px; }
        .howItWorksBullets li::marker{ color:#1d4ed8; }
        .howItWorksHero{
          border-radius:20px;
          border:1px solid rgba(148,163,184,.18);
          background:#fff;
          padding:12px;
          display:grid;
          gap:9px;
        }
        .howItWorksHeroHead{
          display:flex;
          align-items:center;
          gap:10px;
        }
        .howItWorksHeroIcon{
          width:64px;
          height:64px;
          border-radius:20px;
          display:grid;
          place-items:center;
          background:rgba(37,99,235,.08);
          border:1px solid rgba(37,99,235,.15);
        }
        .howItWorksHeroIcon i{ font-size:30px; color:#1d4ed8; }
        .howItWorksMetricGrid{
          display:grid;
          gap:8px;
        }
        .howItWorksMetric{
          display:flex;
          justify-content:space-between;
          gap:12px;
          padding:8px 10px;
          border-radius:12px;
          background:rgba(249,250,251,.96);
          border:1px solid #e6edf2;
        }
        .howItWorksMetric .l{
          color:#475569;
          font-size:12px;
          font-weight:800;
        }
        .howItWorksMetric .r{
          font-size:12px;
          font-weight:1000;
        }
        .howItWorksFooter{
          display:flex;
          justify-content:space-between;
          align-items:flex-end;
          gap:12px;
          flex-wrap:wrap;
        }
        .howItWorksSummary{
          display:grid;
          gap:8px;
        }
        .howItWorksSummaryRow{
          display:flex;
          gap:10px;
          align-items:flex-start;
          color:#475569;
          font-size:12px;
          line-height:1.45;
        }
        .howItWorksSummaryRow i{
          color:#1d4ed8;
          font-size:18px;
          flex:0 0 auto;
          margin-top:1px;
        }
        .howItWorksActions{
          display:flex;
          gap:10px;
          width:100%;
          align-items:center;
          flex-wrap:wrap;
          justify-content:flex-start;
        }
        .howItWorksActions .howItWorksNav:last-child{
          margin-left:auto;
        }
        .howItWorksNav{
          display:inline-flex;
          align-items:center;
          gap:8px;
          min-height:44px;
          padding:10px 14px;
          border-radius:14px;
          border:1px solid #dbe5ef;
          background:#fff;
          color:#0f172a;
          font-weight:900;
          cursor:pointer;
        }
        .howItWorksNav.primary{
          background:linear-gradient(135deg, #2563eb 0%, #0f766e 100%);
          color:#fff;
          border-color:transparent;
        }
        @media (max-width: 720px){
          .howItWorksModal{
            padding:14px;
            gap:12px;
          }
          .howItWorksTabs{
            grid-template-columns:1fr;
          }
          .howItWorksBody{
            grid-template-columns:1fr;
          }
          .howItWorksFooter{
            align-items:stretch;
          }
          .howItWorksActions{
            width:100%;
            justify-content:stretch;
          }
          .howItWorksActions .howItWorksNav:last-child{
            margin-left:0;
          }
          .howItWorksActions .howItWorksNav{
            width:100%;
            justify-content:center;
            margin-left:0;
          }
        }
      `}</style>

      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        <i className="material-icons" style={{ fontSize: 18 }}>{triggerIcon}</i>
        {triggerLabel}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="howItWorksOverlay"
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={() => setOpen(false)}
            >
              <div className="howItWorksModal" onClick={(event) => event.stopPropagation()}>
                <div className="howItWorksHeader">
                  <div style={{ display: "grid", gap: 6, maxWidth: 820 }}>
                    <div className="howItWorksTitle">{title}</div>
                    <div className="howItWorksSub">{subtitle}</div>
                  </div>
                  <button type="button" className="howItWorksClose" onClick={() => setOpen(false)}>
                    <i className="material-icons">close</i>
                  </button>
                </div>

                <div className="howItWorksStepBadge">
                  <i className="material-icons" style={{ fontSize: 18 }}>auto_awesome</i>
                  Step {step + 1} of {slides.length}
                </div>

                <div className="howItWorksTabs">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.title}
                      type="button"
                      className={`howItWorksTab ${index === step ? "active" : ""}`}
                      onClick={() => setStep(index)}
                    >
                      <div className="k">{slide.eyebrow}</div>
                      <div className="t">{slide.title}</div>
                      <div className="s">{slide.subtitle}</div>
                    </button>
                  ))}
                </div>

                <div className="howItWorksStage">
                  <div className="howItWorksPane" style={{ background: current.tone }}>
                    <div className="howItWorksBody">
                      <div className="howItWorksCopy">
                        <div>
                          <div className="howItWorksKicker">{current.eyebrow}</div>
                          <div className="howItWorksStepTitle">{current.title}</div>
                          <div className="howItWorksStepSub">{current.subtitle}</div>
                        </div>
                        <div className="howItWorksBullets">
                          {current.bullets.map((bullet, index) => (
                            <div className="howItWorksBullet" key={bullet}>
                              <i className="material-icons">
                                {current.bulletIcons?.[index] || "check_circle"}
                              </i>
                              <span>{bullet}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="howItWorksHero">
                        <div className="howItWorksHeroHead">
                          <div className="howItWorksHeroIcon">
                            <i className="material-icons">{current.icon}</i>
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 }}>
                            {current.sideTitle}
                          </div>
                        </div>
                        <div className="howItWorksMetricGrid">
                          {current.sideRows.map((row) => (
                            <div className="howItWorksMetric" key={row.label}>
                              <div className="l">{row.label}</div>
                              <div className="r" style={{ color: row.color }}>{row.value}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5 }}>{current.note}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="howItWorksFooter">
                  <div className="howItWorksActions">
                    <button
                      type="button"
                      className="howItWorksNav"
                      onClick={() => setStep((value) => Math.max(0, value - 1))}
                      disabled={step === 0}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>arrow_back</i>
                      Back
                    </button>
                    <button
                      type="button"
                      className="howItWorksNav primary"
                      onClick={() => setStep((value) => Math.min(slides.length - 1, value + 1))}
                    >
                      {step === slides.length - 1 ? "Continue" : `Next: Step ${step + 2}`}
                      <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
