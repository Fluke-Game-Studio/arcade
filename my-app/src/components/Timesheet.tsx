// src/components/TimeSheet.tsx
import { useMemo } from "react";
import { addDaysISO } from "../pages/UpdatesContext";

type Props = {
  weekStartISO: string; // Monday
  value: { [isoDate: string]: number };
  onChange: (next: { [isoDate: string]: number }) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function prettyISO(iso: string) {
  // ISO date assumed: YYYY-MM-DD
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export default function TimeSheet({ weekStartISO, value, onChange }: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i)), [weekStartISO]);
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const total = useMemo(
    () => days.reduce((acc, d) => acc + (Number(value[d]) || 0), 0),
    [days, value]
  );

  const weekdayTotal = useMemo(() => {
    const wk = days.slice(0, 5);
    return wk.reduce((acc, d) => acc + (Number(value[d]) || 0), 0);
  }, [days, value]);

  const weekendTotal = useMemo(() => {
    const wknd = days.slice(5);
    return wknd.reduce((acc, d) => acc + (Number(value[d]) || 0), 0);
  }, [days, value]);

  const progressPct = useMemo(() => {
    // simple 40h progress bar
    return clamp((total / 40) * 100, 0, 140);
  }, [total]);

  return (
    <div className="card z-depth-1" style={{ marginTop: 12, borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "14px 14px 12px",
          borderBottom: "1px solid #eceff1",
          background: "linear-gradient(135deg, #0b1220 0%, #111827 50%, #0b1220 100%)",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 14.5, lineHeight: "18px" }}>Timesheet</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
              Week of <span style={{ fontWeight: 800 }}>{weekStartISO}</span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 14.5 }}>{total.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>Total</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "rgba(255,255,255,0.16)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "rgba(59,130,246,0.65)",
                borderRadius: 999,
                transition: "width 140ms ease",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 12,
              color: "rgba(255,255,255,0.78)",
            }}
          >
            <span>
              <i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>
                date_range
              </i>
              {weekdayTotal.toFixed(1)}h weekdays
            </span>
            <span>
              <i className="material-icons" style={{ fontSize: 16, verticalAlign: "middle", marginRight: 6 }}>
                weekend
              </i>
              {weekendTotal.toFixed(1)}h weekend
            </span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="card-content" style={{ padding: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {days.map((iso, idx) => {
            const v = value[iso];
            const shown = v === 0 || v ? String(v) : "";
            const isWeekend = idx >= 5;

            return (
              <div
                key={iso}
                style={{
                  border: "1px solid #e6edf2",
                  borderRadius: 12,
                  padding: "10px 10px 8px",
                  background: isWeekend ? "#f8fafc" : "#ffffff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 13, color: "#263238" }}>{names[idx]}</div>
                    <div style={{ fontSize: 12, color: "#607d8b" }}>
                      {prettyISO(iso)} <span style={{ opacity: 0.7 }}>({iso})</span>
                    </div>
                  </div>

                  {isWeekend ? (
                    <span
                      className="chip"
                      style={{
                        height: 24,
                        lineHeight: "24px",
                        fontSize: 11,
                        fontWeight: 800,
                        background: "#fff7ed",
                        color: "#9a3412",
                        border: "1px solid #ffedd5",
                      }}
                    >
                      Weekend
                    </span>
                  ) : (
                    <span
                      className="chip"
                      style={{
                        height: 24,
                        lineHeight: "24px",
                        fontSize: 11,
                        fontWeight: 800,
                        background: "#eef2ff",
                        color: "#1e40af",
                        border: "1px solid #e0e7ff",
                      }}
                    >
                      Weekday
                    </span>
                  )}
                </div>

                <div className="input-field" style={{ marginTop: 10, marginBottom: 0 }}>
                  <input
                    id={`ts-${iso}`}
                    type="number"
                    min={0}
                    step="0.5"
                    inputMode="decimal"
                    value={shown}
                    onChange={(e) => {
                      const nextStr = e.target.value;
                      const next = nextStr === "" ? 0 : Number(nextStr);
                      onChange({ ...value, [iso]: Number.isFinite(next) ? next : 0 });
                    }}
                    style={{
                      marginBottom: 0,
                      fontWeight: 800,
                      fontSize: 14,
                    }}
                  />
                  <label className="active" htmlFor={`ts-${iso}`} style={{ fontSize: 12, color: "#78909c" }}>
                    Hours (0.5 steps)
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer summary */}
        <div
          style={{
            marginTop: 14,
            padding: "12px 12px",
            borderRadius: 12,
            border: "1px solid #e6edf2",
            background: "linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#eef2f7",
              }}
            >
              <i className="material-icons" style={{ color: "#607d8b" }}>
                timer
              </i>
            </div>
            <div>
              <div style={{ fontWeight: 900, color: "#263238", fontSize: 13.5 }}>Weekly Total</div>
              <div style={{ color: "#607d8b", fontSize: 12 }}>Keep it consistent (target: 40h)</div>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: "#0f172a" }}>{total.toFixed(1)}h</div>
            <div style={{ fontSize: 12, color: "#607d8b" }}>{progressPct >= 100 ? "✅ Target met" : "In progress"}</div>
          </div>
        </div>
      </div>

      <div className="card-action" style={{ padding: "12px 14px", borderTop: "1px solid #eceff1", background: "#fafafa" }}>
        <span style={{ fontSize: 12, color: "#607d8b" }}>
          Tip: Use <b>0.5</b> increments for quick logging.
        </span>
      </div>
    </div>
  );
}
