import { useEffect, useMemo, useState } from "react";

type UnlockItem = {
  kind?: "achievement" | "trophy";
  id?: string;
  title?: string;
  description?: string;
  tier?: string;
  imageUrl?: string;
  metric?: string;
  threshold?: number;
  setKey?: string;
  awardedAt?: string;
};

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function titleCase(v: string) {
  return safeStr(v)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function itemTone(kind?: string) {
  return kind === "trophy" ? "amber" : "blue";
}

function itemIcon(item: UnlockItem) {
  if (safeStr(item.imageUrl)) return "image";
  return item.kind === "trophy" ? "emoji_events" : "military_tech";
}

export default function AwardUnlockModal({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: UnlockItem[];
  onClose: () => void;
}) {
  const normalized = useMemo(
    () =>
      (Array.isArray(items) ? items : [])
        .filter((item) => safeStr(item?.id) || safeStr(item?.title))
        .map((item) => ({
          ...item,
          kind: item.kind || (safeStr(item.tier) ? "trophy" : "achievement"),
        })),
    [items]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open, normalized.length]);

  if (!open || !normalized.length) return null;

  const current = normalized[index] || normalized[0];
  const tone = itemTone(current.kind);
  const total = normalized.length;

  function step(delta: number) {
    setIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return total - 1;
      if (next >= total) return 0;
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New unlocks"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(8,15,30,0.72)",
        backdropFilter: "blur(10px)",
        display: "grid",
        placeItems: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          borderRadius: 26,
          background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
          boxShadow: "0 30px 80px rgba(2,8,23,0.38)",
          border: "1px solid rgba(148,163,184,0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px 12px",
            borderBottom: "1px solid rgba(148,163,184,0.16)",
          }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.18em", color: "#64748b" }}>
              NEW UNLOCKS
            </div>
            <div style={{ fontSize: 24, fontWeight: 1000, color: "#0f172a", marginTop: 4 }}>
              You unlocked {total} reward{total === 1 ? "" : "s"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              background: "rgba(15,23,42,0.06)",
              color: "#0f172a",
              width: 40,
              height: 40,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <i className="material-icons">close</i>
          </button>
        </div>

        <div style={{ padding: 20, display: "grid", gap: 16 }}>
          {total > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => step(-1)}
                style={{
                  border: "1px solid rgba(59,130,246,0.18)",
                  background: "rgba(59,130,246,0.08)",
                  color: "#1d4ed8",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <i className="material-icons" style={{ fontSize: 18 }}>
                  chevron_left
                </i>
                Prev
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {normalized.map((item, i) => (
                  <button
                    key={`${safeStr(item.id)}-${i}`}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show unlock ${i + 1}`}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      border: 0,
                      cursor: "pointer",
                      background: i === index ? "#2563eb" : "rgba(148,163,184,0.4)",
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => step(1)}
                style={{
                  border: "1px solid rgba(59,130,246,0.18)",
                  background: "rgba(59,130,246,0.08)",
                  color: "#1d4ed8",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Next
                <i className="material-icons" style={{ fontSize: 18 }}>
                  chevron_right
                </i>
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "120px 1fr",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: 28,
                display: "grid",
                placeItems: "center",
                background:
                  tone === "amber"
                    ? "linear-gradient(180deg, rgba(245,158,11,0.16), rgba(255,255,255,0.96))"
                    : "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(255,255,255,0.96))",
                border: `1px solid ${tone === "amber" ? "rgba(245,158,11,0.22)" : "rgba(59,130,246,0.22)"}`,
                boxShadow:
                  tone === "amber"
                    ? "0 18px 36px rgba(245,158,11,0.18)"
                    : "0 18px 36px rgba(59,130,246,0.14)",
                overflow: "hidden",
              }}
            >
              {safeStr(current.imageUrl) ? (
                <img
                  src={safeStr(current.imageUrl)}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "86%", height: "86%", objectFit: "contain", display: "block" }}
                />
              ) : (
                <i
                  className="material-icons"
                  style={{
                    fontSize: 56,
                    color: tone === "amber" ? "#b45309" : "#1d4ed8",
                  }}
                >
                  {itemIcon(current)}
                </i>
              )}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 950,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    background: tone === "amber" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)",
                    color: tone === "amber" ? "#92400e" : "#1d4ed8",
                  }}
                >
                  {current.kind === "trophy" ? "Trophy" : "Achievement"}
                </span>
                {!!safeStr(current.tier) && (
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 900,
                      background: "rgba(15,23,42,0.06)",
                      color: "#334155",
                    }}
                  >
                    Tier: {titleCase(safeStr(current.tier))}
                  </span>
                )}
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 900,
                    background: "rgba(15,23,42,0.06)",
                    color: "#334155",
                  }}
                >
                  {index + 1} / {total}
                </span>
              </div>

              <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a", lineHeight: 1.05 }}>
                {safeStr(current.title) || "Unlocked reward"}
              </div>

              {!!safeStr(current.description) && (
                <div style={{ color: "#475569", lineHeight: 1.6, fontSize: 16 }}>
                  {safeStr(current.description)}
                </div>
              )}

              <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                {!!safeStr(current.setKey) && (
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                    Set: {safeStr(current.setKey)}
                  </div>
                )}
                {!!safeStr(current.metric) && (
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                    Metric: {safeStr(current.metric)}
                    {safeNum(current.threshold) ? ` • Threshold ${safeNum(current.threshold)}` : ""}
                  </div>
                )}
                {!!safeStr(current.awardedAt) && (
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 800 }}>
                    Awarded: {new Date(current.awardedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
