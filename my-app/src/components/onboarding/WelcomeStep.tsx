import ReleaseHighlightsPanel from "../ReleaseHighlightsPanel";

type Props = {
  releaseVersion: string;
  releaseNotes: string;
  onContinue: () => void;
};

export default function WelcomeStep({ releaseVersion, releaseNotes, onContinue }: Props) {
  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          borderRadius: 24,
          border: "1px solid rgba(59,130,246,.18)",
          background: "linear-gradient(180deg, rgba(255,255,255,.98) 0%, rgba(239,246,255,.96) 100%)",
          padding: 22,
          display: "grid",
          gap: 14,
        }}
      >
        <ReleaseHighlightsPanel
          title="What's new"
          subtitle="Start with the latest release context before we continue onboarding."
          releaseVersion={releaseVersion}
          releaseNotes={releaseNotes}
          compact
        />

        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ color: "#475569", lineHeight: 1.7, maxWidth: 640 }}>
            This step only needs to be reviewed once per release. After you continue, it stays hidden until the next major portal update.
          </div>
          <button
            type="button"
            onClick={onContinue}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              minHeight: 48,
              borderRadius: 16,
              border: "1px solid rgba(37,99,235,.18)",
              background: "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)",
              color: "#fff",
              padding: "12px 18px",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow: "0 16px 34px rgba(37,99,235,.18)",
            }}
          >
            Continue
            <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
          </button>
        </div>
      </div>
    </section>
  );
}

