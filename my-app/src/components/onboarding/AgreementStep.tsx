import { useEffect, useRef } from "react";
import { CONDUCT_ACKNOWLEDGMENT, CONDUCT_REQUIRED_IDS, CONDUCT_SECTIONS, isConductSectionComplete } from "./codeOfConduct";

type Props = {
  accepted: Record<string, boolean>;
  onAcceptanceChange: (id: string, checked: boolean) => void;
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
};

export default function AgreementStep({ accepted, onAcceptanceChange, activeId, onActiveChange }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const panelButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousId = useRef<string | null>(null);
  const active = CONDUCT_SECTIONS.find(section => section.id === activeId);
  useEffect(() => {
    if (activeId) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "nearest" });
    } else if (previousId.current) {
      panelButtons.current[previousId.current]?.focus();
    }
    previousId.current = activeId;
  }, [activeId]);
  const checkedCount = CONDUCT_REQUIRED_IDS.filter(id => accepted[id]).length;
  function checkbox(id: string, text: string, nested = false) {
    return (
      <label key={id} className={`conductCheck${nested ? " conductNested" : ""}`}>
        <input type="checkbox" checked={accepted[id] === true} onChange={event => onAcceptanceChange(id, event.target.checked)} />
        <span>{text}</span>
      </label>
    );
  }
  return (
    <section className="conductStep" style={{ display: "grid", gap: 18 }}>
      <style>{`
        .conductPanel { display: flex; align-items: center; justify-content: space-between; gap: 14px; width: 100%; border-radius: 20px; border: 1px solid rgba(148,163,184,.25); background: #fff; padding: 18px; cursor: pointer; text-align: left; color: #0f172a; font: inherit; }
        .conductPanel[data-complete="true"] { border-color: rgba(16,185,129,.4); background: #ecfdf5; }
        .conductPanel:hover { border-color: #2563eb; }
        .conductPanel:focus-visible, .conductCheck input:focus-visible { outline: 3px solid #2563eb; outline-offset: 3px; }
        .conductStep .conductCheck { display: flex; align-items: flex-start; gap: 12px; padding: 14px; border: 1px solid #dbe3ef; border-radius: 12px; background: #fff; color: #334155; font-size: 15px; line-height: 1.7; cursor: pointer; }
        .conductStep .conductCheck input[type="checkbox"] { position: static; opacity: 1; pointer-events: auto; appearance: auto; width: 20px; height: 20px; margin: 3px 0 0; flex: 0 0 20px; accent-color: #2563eb; }
        .conductStep .conductCheck input[type="checkbox"] + span { padding-left: 0; height: auto; line-height: inherit; color: inherit; }
        .conductStep .conductCheck input[type="checkbox"] + span::before, .conductStep .conductCheck input[type="checkbox"] + span::after { display: none; }
        .conductNested { margin-left: 24px; }
        .conductHeading { margin: 0; font-size: 26px; font-weight: 1000; color: #0f172a; letter-spacing: -.02em; }
        @media (max-width: 600px) { .conductNested { margin-left: 12px; } }
      `}</style>
      {active ? (
        <>
          <h2 ref={heading} tabIndex={-1} className="conductHeading">{CONDUCT_SECTIONS.indexOf(active) + 1}. {active.title}</h2>
          <p style={{ margin: 0, color: "#64748b" }}>Read the terms and check each acknowledgment below.</p>
          {active.blocks.map((block, index) => block.type === "check"
            ? checkbox(block.id, block.text, block.nested)
            : <p key={index} style={{ margin: 0, color: "#475569", lineHeight: 1.8 }}>{block.text}</p>)}
        </>
      ) : (
        <>
          <h2 className="conductHeading">Code of Conduct</h2>
          <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>Review each section and acknowledge every requirement before continuing.</p>
          <div role="status" style={{ color: "#475569", fontWeight: 700 }}>{checkedCount} of {CONDUCT_REQUIRED_IDS.length} acknowledgments complete</div>
          {CONDUCT_SECTIONS.map((section, index) => {
            const required = section.blocks.filter(block => block.type === "check");
            const count = required.filter(block => block.type === "check" && accepted[block.id]).length;
            const complete = isConductSectionComplete(section, accepted);
            return (
              <button type="button" key={section.id} className="conductPanel" data-complete={complete}
                ref={node => { panelButtons.current[section.id] = node; }} onClick={() => onActiveChange(section.id)}>
                <span>
                  <span style={{ display: "block", fontSize: 18, fontWeight: 900 }}>{index + 1}. {section.title}</span>
                  <span style={{ display: "block", marginTop: 6, color: "#64748b" }}>{complete ? "Complete" : `${count} of ${required.length} acknowledged`}</span>
                </span>
                <i className="material-icons" aria-hidden="true">{complete ? "check_circle" : "chevron_right"}</i>
              </button>
            );
          })}
          {checkbox("conduct-acknowledgment", CONDUCT_ACKNOWLEDGMENT)}
        </>
      )}
    </section>
  );
}
