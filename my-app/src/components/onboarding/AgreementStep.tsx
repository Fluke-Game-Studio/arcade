type Props = {
  timesheetAccepted: boolean;
  discordAccepted: boolean;
  onTimesheetChange: (value: boolean) => void;
  onDiscordChange: (value: boolean) => void;
};

export default function AgreementStep({
  timesheetAccepted,
  discordAccepted,
  onTimesheetChange,
  onDiscordChange,
}: Props) {
  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
        Agreement
      </div>
      <div style={{ color: "#475569", lineHeight: 1.7 }}>
        Confirm the weekly operating rules before we unlock the rest of the journey.
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {[
          {
            checked: timesheetAccepted,
            setChecked: onTimesheetChange,
            title: "Update time sheet weekly.",
            detail: "This keeps delivery and accountability visible across the team every week.",
          },
          {
            checked: discordAccepted,
            setChecked: onDiscordChange,
            title: "Enable Discord notifications.",
            detail: "Discord is used for notification delivery, workflow coordination, and timely review responsiveness.",
          },
        ].map((item) => (
          <label
            key={item.title}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              width: "100%",
              borderRadius: 20,
              border: item.checked ? "1px solid rgba(37,99,235,.26)" : "1px solid rgba(148,163,184,.18)",
              background: item.checked ? "rgba(37,99,235,.07)" : "#fff",
              padding: 18,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => item.setChecked(e.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2, flex: "0 0 20px", accentColor: "#2563eb" }}
            />
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a", lineHeight: 1.3 }}>{item.title}</div>
              <div style={{ marginTop: 6, color: "#64748b", lineHeight: 1.6 }}>{item.detail}</div>
            </div>
          </label>
        ))}
      </div>

      <div style={{ borderRadius: 18, border: "1px solid rgba(16,185,129,.18)", background: "rgba(16,185,129,.06)", padding: 16, color: "#14532d", fontWeight: 800, lineHeight: 1.6 }}>
        LinkedIn may be used for employee performance metrics and identity alignment. Discord is used for notifications and timely review
        responsiveness.
      </div>
    </section>
  );
}
