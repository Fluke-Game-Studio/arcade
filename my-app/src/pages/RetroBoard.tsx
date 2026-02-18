// src/pages/RetroBoard.tsx
import React, { useMemo, useState } from "react";
import { useUpdates } from "./UpdatesContext";

const base: React.CSSProperties = {
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  boxShadow: "0 6px 14px rgba(0,0,0,0.12)",
  transform: "rotate(-0.6deg)",
  position: "relative",
};
const noteGreen: React.CSSProperties = { ...base, background: "#e6ffed" };
const notePink: React.CSSProperties = {
  ...base,
  background: "#ffe1ea",
  transform: "rotate(0.8deg)",
};
const noteYellow: React.CSSProperties = { ...base, background: "#fff8c6" };

function Pill({ text }: { text: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.08)",
        marginLeft: 8,
      }}
    >
      {text}
    </span>
  );
}

export default function RetroBoard() {
  const { submissions, allWeeks, loading, error, unauthenticated } =
    useUpdates();

  // Default = all weeks; user can pick a specific week
  const [selectedWeek, setSelectedWeek] = useState<string>("");

  const filteredSubs = useMemo(
    () =>
      selectedWeek
        ? submissions.filter((s) => s.weekStart === selectedWeek)
        : submissions,
    [submissions, selectedWeek]
  );

  const makeNotes = (
    kind: "worked" | "didnt" | "improve"
  ): { id: string; text: string; who: string; hours: number; week: string }[] =>
    filteredSubs.flatMap((s) =>
      (s.retrospective[kind] || []).map((text, idx) => ({
        id: `${s.id}-${kind}-${idx}`, // ensure unique key
        text,
        who: s.userName || s.userId || "Anon",
        hours: s.timesheet.reduce(
          (a, t) => a + (Number(t.hours) || 0),
          0
        ),
        week: s.weekStart,
      }))
    );

  const worked = makeNotes("worked");
  const didnt = makeNotes("didnt");
  const improve = makeNotes("improve");

  const pillText = (n: { hours: number; week: string }) =>
    n.week ? `${n.hours}h • ${n.week}` : `${n.hours}h`;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="card">
        <div className="card-content">
          <span className="card-title">Retrospective Board</span>

          {loading && (
            <p className="grey-text" style={{ marginTop: 8 }}>
              Loading weekly updates…
            </p>
          )}

          {unauthenticated && !loading && (
            <p className="grey-text" style={{ marginTop: 8 }}>
              Please log in to view team retros.
            </p>
          )}

          {error && !unauthenticated && (
            <p className="red-text" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}

          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col s12 m6">
              <div className="input-field">
                <select
                  className="browser-default"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                >
                  <option value="">All weeks</option>
                  {allWeeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <label className="active" style={{ display: "block" }}>
                  Week (Monday)
                </label>
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="col s12 m4">
              <h6>✅ What worked</h6>
              {worked.length === 0 && <p className="grey-text">—</p>}
              {worked.map((n) => (
                <div key={n.id} style={noteGreen}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {n.who} <Pill text={pillText(n)} />
                  </div>
                  <div>{n.text}</div>
                </div>
              ))}
            </div>

            <div className="col s12 m4">
              <h6>❌ What didn’t</h6>
              {didnt.length === 0 && <p className="grey-text">—</p>}
              {didnt.map((n) => (
                <div key={n.id} style={notePink}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {n.who} <Pill text={pillText(n)} />
                  </div>
                  <div>{n.text}</div>
                </div>
              ))}
            </div>

            <div className="col s12 m4">
              <h6>🛠️ Improve</h6>
              {improve.length === 0 && <p className="grey-text">—</p>}
              {improve.map((n) => (
                <div key={n.id} style={noteYellow}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {n.who} <Pill text={pillText(n)} />
                  </div>
                  <div>{n.text}</div>
                </div>
              ))}
            </div>
          </div>

          {filteredSubs.length === 0 && !loading && !unauthenticated && (
            <p className="grey-text">No submissions yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
