type Props = {
  qrMatrix: boolean[][];
  acknowledged: boolean;
  onAcknowledgedChange: (value: boolean) => void;
  onFinish: () => void;
};

export default function PaymentStep({ qrMatrix, acknowledged, onAcknowledgedChange, onFinish }: Props) {
  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a", letterSpacing: "-.02em" }}>
          QR payment and initial frozen credits
        </div>
        <div style={{ marginTop: 8, color: "#475569", lineHeight: 1.7 }}>
          Scan the QR code to process the commitment payment. After payment is confirmed, the initial Frozen FGC batch can be recorded.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
        <div style={{ borderRadius: 24, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 18, display: "grid", gap: 14, placeItems: "center" }}>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 20,
              background: "#fff",
              border: "1px solid #e2e8f0",
              padding: 12,
              display: "grid",
              gridTemplateColumns: "repeat(21, 1fr)",
              gap: 2,
            }}
            aria-label="Commitment QR code"
          >
            {qrMatrix.flatMap((row, y) =>
              row.map((filled, x) => (
                <span key={`${x}-${y}`} style={{ width: "100%", height: "100%", borderRadius: 2, background: filled ? "#0f172a" : "#fff" }} />
              ))
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Commitment QR
          </div>
        </div>

        <div style={{ borderRadius: 24, border: "1px solid rgba(148,163,184,.18)", background: "#fff", padding: 18, display: "grid", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }}>What the QR does</div>
          <div style={{ color: "#475569", lineHeight: 1.7 }}>
            The QR step is the payment handoff for the onboarding commitment. It is where the initial Frozen FGC amount is created after the
            commitment payment is processed.
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              "Scan the code with the approved payment flow.",
              "Confirm the payment amount for the onboarding commitment.",
              "Sync the initial Frozen FGC amount into the wallet after payment clears.",
            ].map((line) => (
              <div key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "#334155", lineHeight: 1.6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, marginTop: 8, background: "#0f766e" }} />
                <span>{line}</span>
              </div>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 12, color: "#334155", fontWeight: 800, lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledgedChange(e.target.checked)}
              style={{ marginTop: 4, width: 18, height: 18, accentColor: "#2563eb" }}
            />
            <span>I have scanned the QR and the initial Frozen FGC payment is ready to be recorded.</span>
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onFinish}
          disabled={!acknowledged}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 48,
            borderRadius: 16,
            border: "1px solid rgba(37,99,235,.18)",
            background: acknowledged ? "linear-gradient(135deg, #2563eb 0%, #0f766e 100%)" : "rgba(148,163,184,.16)",
            color: acknowledged ? "#fff" : "#94a3b8",
            padding: "12px 18px",
            fontWeight: 900,
            cursor: acknowledged ? "pointer" : "not-allowed",
            boxShadow: acknowledged ? "0 16px 34px rgba(37,99,235,.18)" : "none",
          }}
        >
          Enter portal
          <i className="material-icons" style={{ fontSize: 18 }}>arrow_forward</i>
        </button>
      </div>
    </section>
  );
}

