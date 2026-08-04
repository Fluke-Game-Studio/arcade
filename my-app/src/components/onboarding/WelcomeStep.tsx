import ReleaseHighlightsPanel from "../ReleaseHighlightsPanel";

type Props = {
  releaseVersion: string;
  releaseNotes: string;
};

export default function WelcomeStep({ releaseVersion, releaseNotes }: Props) {
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
        <div style={{ color: "#475569", lineHeight: 1.7, maxWidth: 760 }}>
          This step only needs to be reviewed once per release. After you continue, it stays hidden until the next major portal update.
        </div>
      </div>
    </section>
  );
}
