import { useState } from "react";

type Props = {
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
  onContinue: () => void;
};

type ProcessCard = {
  step: string;
  icon: string;
  title: string;
  summary: string;
  accent: string;
  details: string[];
  disabled?: boolean;
};

export default function CommitmentStep({ accepted, onAcceptedChange, onContinue }: Props) {
  const [openStep, setOpenStep] = useState<string>("1");
  const stepOrder = ["1", "2", "3", "4"];
  const currentIndex = Math.max(0, stepOrder.indexOf(openStep));
  const isFinalStep = openStep === "4";

  function goBack() {
    setOpenStep((current) => {
      const idx = stepOrder.indexOf(current);
      return idx <= 0 ? "1" : stepOrder[idx - 1];
    });
  }

  function goNext() {
    if (isFinalStep) {
      if (accepted) onContinue();
      return;
    }
    setOpenStep(stepOrder[Math.min(currentIndex + 1, stepOrder.length - 1)]);
  }

  const process: ProcessCard[] = [
    {
      step: "1",
      icon: "visibility",
      title: "Why we collect commitment funds",
      summary: "The commitment creates the starting frozen balance and keeps the vesting model tied to real participation.",
      accent: "#2563eb",
      details: [
        "Commitment money is the starting pool that gets held back as Frozen FGC.",
        "It is a 1:1 starting record in the wallet model, before weekly release math is applied.",
        "Diligent weekly updates can let the released value grow over time, so the original commitment can be earned back and more.",
        "This keeps the program fair: participation creates the path to unlock value.",
      ],
    },
    {
      step: "2",
      icon: "swap_horiz",
      title: "How money becomes credits",
      summary: "Real money is tracked as Frozen FGC first, then weekly vesting releases portions into spendable FGC.",
      accent: "#0f766e",
      details: [
        "At intake, the commitment amount is recorded as Frozen FGC in the wallet ledger.",
        "Weekly release starts at 5% of the remaining frozen balance and increases by 2.5% each successful streak week.",
        "Example: a 1,000 commitment releases 50 FGC in week 1, then 71.25 FGC in week 2, then 92.87 FGC in week 3 if the streak continues.",
        "This is how diligence and weekly updates can let the released spendable balance outgrow the original commitment over time.",
      ],
    },
    {
      step: "3",
      icon: "qr_code_2",
      title: "Earn and spend path",
      summary: "Weekly updates add frozen FGC first, then vesting releases part of it into spendable FGC.",
      accent: "#0f766e",
      details: [
        "Weekly update credits create Frozen FGC first: 20 FGC for the update, 20 FGC for retro, and 10 FGC for timesheet.",
        "Awards, achievements, onboarding bonuses, and similar rewards also go to Frozen FGC unless the rule says otherwise.",
        "Spendable FGC is the released balance used in the Fluke Store, while Frozen FGC stays locked until vesting or program completion rules apply.",
        "This split keeps spending separate from long-term incentive rewards.",
      ],
    },
    {
      step: "4",
      icon: "qr_code_2",
      title: "QR payment coming soon",
      summary: "This will later handle the initial payment handoff that creates the frozen pool. It stays disabled for now.",
      accent: "#b45309",
      disabled: true,
      details: [
        "This step is reserved for the onboarding commitment payment flow.",
        "When enabled, it will seed the initial Frozen FGC pool.",
        "For now it is shown only as a disabled preview.",
      ],
    },
  ];

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
        Commitment
      </div>
      <div style={{ color: "#475569", lineHeight: 1.7 }}>
        This is a four-part walkthrough for the credit model before you continue:
        commitment rationale, credit math, earn/spend path, and QR payment.
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {process.map((card) => {
          const expanded = openStep === card.step;
          return (
            <div
              key={card.title}
              style={{
                borderRadius: 20,
                border: expanded ? `1px solid ${card.accent}33` : "1px solid rgba(148,163,184,.16)",
                background: expanded ? `${card.accent}08` : "#fff",
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenStep((current) => (current === card.step ? "" : card.step))}
                aria-expanded={expanded}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 14,
                    display: "grid",
                    placeItems: "center",
                    background: `${card.accent}12`,
                    color: card.accent,
                    fontWeight: 1000,
                    flex: "0 0 auto",
                  }}
                >
                  {card.step}
                </div>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    display: "grid",
                    placeItems: "center",
                    background: `${card.accent}12`,
                    color: card.accent,
                    flex: "0 0 auto",
                  }}
                >
                  <i className="material-icons">{card.icon}</i>
                </div>
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a" }}>{card.title}</div>
                    {card.disabled ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "5px 9px",
                          border: "1px solid rgba(180,83,9,.22)",
                          background: "rgba(180,83,9,.08)",
                          color: "#b45309",
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        Disabled
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.6, fontSize: 13 }}>{card.summary}</div>
                </div>
                <i
                  className="material-icons"
                  style={{
                    marginLeft: "auto",
                    color: card.accent,
                    fontSize: 22,
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 160ms ease",
                  }}
                >
                  expand_more
                </i>
              </button>

              {expanded ? (
                <div style={{ padding: "0 16px 16px 76px", color: "#334155", lineHeight: 1.7 }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    {card.details.map((line) => (
                      <div key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            marginTop: 10,
                            borderRadius: 999,
                            background: card.accent,
                            flex: "0 0 auto",
                          }}
                        />
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "#334155", fontWeight: 800, lineHeight: 1.5 }}>
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          style={{ marginTop: 4, width: 18, height: 18, accentColor: "#2563eb" }}
        />
        <span>I understand the commitment model, the 1:1 starting commitment pool, and how vesting can increase released value over time.</span>
      </label>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={goBack}
          disabled={currentIndex === 0}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            borderRadius: 16,
            border: "1px solid rgba(148,163,184,.22)",
            background: currentIndex === 0 ? "rgba(148,163,184,.12)" : "#fff",
            color: currentIndex === 0 ? "#94a3b8" : "#0f172a",
            padding: "12px 18px",
            fontWeight: 900,
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            boxShadow: "none",
          }}
        >
          <i className="material-icons" style={{ fontSize: 18 }}>arrow_back</i>
          Back
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={isFinalStep ? !accepted : false}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            borderRadius: 16,
            border: "1px solid rgba(37,99,235,.18)",
            background: isFinalStep
              ? accepted
                ? "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)"
                : "rgba(148,163,184,.16)"
              : "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
            color: isFinalStep ? (accepted ? "#fff" : "#94a3b8") : "#fff",
            padding: "12px 18px",
            fontWeight: 900,
            cursor: isFinalStep && !accepted ? "not-allowed" : "pointer",
            boxShadow: isFinalStep && accepted ? "0 16px 34px rgba(37,99,235,.18)" : "none",
          }}
        >
          {isFinalStep ? "Continue" : "Next"}
          <i className="material-icons" style={{ fontSize: 18 }}>
            {isFinalStep ? "check_circle" : "arrow_forward"}
          </i>
        </button>
      </div>
    </section>
  );
}
