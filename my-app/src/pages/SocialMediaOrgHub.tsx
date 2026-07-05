import SocialPostStudio from "./SocialPostStudio";

export default function SocialMediaOrgHub() {
  return (
    <div style={{ padding: 20, maxWidth: 1240, margin: "0 auto", display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 1000 }}>Social Media</h2>
        <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>
          Create social drafts, track your submissions, and follow organization review progress from one place.
        </p>
      </div>

      <section
        style={{
          borderRadius: 24,
          border: "1px solid rgba(148,163,184,.16)",
          background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.94))",
          boxShadow: "0 22px 50px rgba(15,23,42,.06)",
          padding: 18,
        }}
      >
        <SocialPostStudio embedded includeReviewTab />
      </section>
    </div>
  );
}
