import { useMemo, useState } from "react";
import { useUpdates } from "./UpdatesContext";

type Row = {
  id: string;
  week: string;
  user: string;
  accomplishments: string;
  blockers: string;
  next: string;
  hours: number;
};

export default function ActivityReport() {
  const { submissions, allWeeks, byWeek } = useUpdates();
  const [selectedWeek, setSelectedWeek] = useState(allWeeks[0] || "");

  const subs = useMemo(
    () => (selectedWeek ? byWeek(selectedWeek) : submissions),
    [selectedWeek, byWeek, submissions]
  );

  const rows: Row[] = useMemo(
    () =>
      subs.map((s) => ({
        id: s.id,
        week: s.weekStart,
        user: s.userName || s.userId || "Anon",
        accomplishments: s.accomplishments || "—",
        blockers: s.blockers || "—",
        next: s.next || "—",
        hours: s.timesheet.reduce((a, t) => a + (Number(t.hours) || 0), 0),
      })),
    [subs]
  );

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="card">
        <div className="card-content">
          <span className="card-title">Activity Report</span>

          <div className="row" style={{ marginBottom: 12 }}>
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

          <div className="responsive-table">
            <table className="striped highlight">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Employee</th>
                  <th>Accomplishments</th>
                  <th>Blockers</th>
                  <th>Next Week</th>
                  <th>Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="grey-text">
                      No data
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.week}</td>
                    <td>{r.user}</td>
                    <td style={{ maxWidth: 360, whiteSpace: "pre-wrap" }}>{r.accomplishments}</td>
                    <td style={{ maxWidth: 300, whiteSpace: "pre-wrap" }}>{r.blockers}</td>
                    <td style={{ maxWidth: 300, whiteSpace: "pre-wrap" }}>{r.next}</td>
                    <td>{r.hours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
