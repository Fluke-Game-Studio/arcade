// src/pages/WeeklyUpdate.tsx
import React, { useEffect, useMemo, useState } from "react";
import TimeSheet from "../components/Timesheet";
import { useUpdates, startOfWeekMonday, toISODate } from "./UpdatesContext";
import { useAuth } from "../auth/AuthContext";
import type { UpdateSubmission } from "./UpdatesContext";

declare const M: any;

export default function WeeklyUpdate() {
  const { save } = useUpdates();
  const { user, api } = useAuth();

  const mondayISO = useMemo(
    () => toISODate(startOfWeekMonday(new Date())),
    []
  );
  const [weekStart, setWeekStart] = useState(mondayISO);

  // Primary text sections
  const [accomplishments, setAccomplishments] = useState("");
  const [blockers, setBlockers] = useState("");
  const [next, setNext] = useState("");

  // Retro: multiple entries
  const [worked, setWorked] = useState<string[]>([""]);
  const [didnt, setDidnt] = useState<string[]>([""]);
  const [improve, setImprove] = useState<string[]>([""]);

  // Timesheet: map ISO → hours
  const [hours, setHours] = useState<{ [isoDate: string]: number }>({});
  const totalHours = Object.values(hours).reduce(
    (a, b) => a + (Number(b) || 0),
    0
  );

  // Materialize helpers
  useEffect(() => {
    try {
      M.CharacterCounter?.init(
        document.querySelectorAll("input[data-length], textarea[data-length]")
      );
      M.updateTextFields?.();
      document
        .querySelectorAll<HTMLTextAreaElement>("textarea.materialize-textarea")
        .forEach((t) => M.textareaAutoResize?.(t));
      M.Tooltip?.init(document.querySelectorAll(".tooltipped"));
    } catch {}
  }, [accomplishments, blockers, next, worked, didnt, improve]);

  const addRow = (list: string[], set: (x: string[]) => void) =>
    set([...list, ""]);

  const removeRow = (
    list: string[],
    i: number,
    set: (x: string[]) => void
  ) => {
    const copy = list.slice();
    copy.splice(i, 1);
    set(copy.length ? copy : [""]);
  };

  const trimList = (list: string[]) =>
    list
      .map((s) => s.trim())
      .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!weekStart) {
      M?.toast?.({ html: "Please select week start (Monday)." });
      return;
    }

    const timesheet = Object.entries(hours)
      .filter(([, v]) => Number(v) > 0)
      .map(([date, v]) => ({ date, hours: Number(v) }));

    const submission: UpdateSubmission = {
      id: crypto.randomUUID(),
      userId: user?.username || "unknown",
      userName: user?.name || user?.username || "Anonymous",
      weekStart,
      accomplishments,
      blockers,
      next,
      retrospective: {
        worked: trimList(worked),
        didnt: trimList(didnt),
        improve: trimList(improve),
      },
      timesheet,
      createdAt: new Date().toISOString(),
    };

    try {
      // 1) Send to backend (canonical store)
      await api.submitUpdate({
        weekStart,
        accomplishments,
        blockers,
        next,
        retrospective: submission.retrospective,
        timesheet,
      });

      // 2) Update in-memory context so RetroBoard / ActivityReport update instantly
      save(submission);

      // 3) Sync profile summary (non-blocking)
      if (user) {
        try {
          await api.updateUser({
            username: user.username,
            employee_last_update_week: weekStart,
            employee_last_update_hours: String(totalHours),
            employee_last_update_summary: accomplishments.slice(0, 140),
          });
        } catch (err) {
          console.warn("Profile update failed:", err);
        }
      }

      M?.toast?.({ html: "Update submitted!" });

      // Reset form (keep same week)
      setAccomplishments("");
      setBlockers("");
      setNext("");
      setWorked([""]);
      setDidnt([""]);
      setImprove([""]);
      setHours({});
    } catch (err: any) {
      console.error("submitUpdate failed", err);
      M?.toast?.({
        html: `Failed to submit. ${err?.message || "Please try again."}`,
      });
    }
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="card">
        <div className="card-content">
          <span
            className="card-title"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            <i className="material-icons">event_note</i>
            Weekly Update
          </span>

          {/* Meta row */}
          <div className="row" style={{ marginBottom: 0 }}>
            <div className="col s12 m6">
              <div className="input-field">
                <input
                  id="weekStart"
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                />
                <label className="active" htmlFor="weekStart">
                  Week Start (Monday)
                </label>
                <span className="helper-text">
                  Choose the Monday of the week you are reporting
                </span>
              </div>
            </div>
            <div className="col s12 m6">
              <div className="input-field">
                <input
                  id="employeeName"
                  value={user?.name || user?.username || ""}
                  readOnly
                />
                <label className="active" htmlFor="employeeName">
                  Employee
                </label>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="divider" style={{ margin: "8px 0 20px" }} />

          {/* Section: Activity Summary */}
          <h6 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="material-icons">assignment_turned_in</i> Activity
            Summary
          </h6>
          <p
            className="grey-text"
            style={{ marginTop: -4, marginBottom: 12 }}
          >
            These appear in <b>Activity Report</b> for managers. Use short,
            scannable bullet points.
          </p>

          <div className="row" style={{ marginBottom: 0 }}>
            <div className="col s12">
              <div className="input-field">
                <textarea
                  id="accomplishments"
                  className="materialize-textarea"
                  data-length={600}
                  value={accomplishments}
                  onChange={(e) => setAccomplishments(e.target.value)}
                  placeholder="- Merged PR #142: combat tweaks\n- Completed EQS heatmap prototype"
                />
                <label className="active" htmlFor="accomplishments">
                  Accomplishments
                </label>
                <span className="helper-text">
                  What did you complete? Include links to PRs/tickets.
                </span>
              </div>
            </div>

            <div className="col s12 m6">
              <div className="input-field">
                <textarea
                  id="blockers"
                  className="materialize-textarea"
                  data-length={400}
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="- Waiting on art export\n- Build pipeline flaky on Mac"
                />
                <label className="active" htmlFor="blockers">
                  Blockers
                </label>
              </div>
            </div>

            <div className="col s12 m6">
              <div className="input-field">
                <textarea
                  id="next"
                  className="materialize-textarea"
                  data-length={400}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="- Refactor AI budget director\n- Write regression tests"
                />
                <label className="active" htmlFor="next">
                  Next Week
                </label>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="divider" style={{ margin: "8px 0 20px" }} />

          {/* Section: Retrospective */}
          <h6 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="material-icons">sticky_note_2</i> Retrospective
          </h6>
          <p
            className="grey-text"
            style={{ marginTop: -4, marginBottom: 12 }}
          >
            Add multiple succinct points; these will render as sticky notes on
            the Retro Board.
          </p>

          {/* Worked */}
          <RetroList
            title="What worked"
            icon="check_circle"
            colorClass="green lighten-5"
            items={worked}
            onChange={setWorked}
            onAdd={() => addRow(worked, setWorked)}
            onRemove={(i) => removeRow(worked, i, setWorked)}
          />

          {/* Didn't work */}
          <RetroList
            title="What didn’t work"
            icon="cancel"
            colorClass="red lighten-5"
            items={didnt}
            onChange={setDidnt}
            onAdd={() => addRow(didnt, setDidnt)}
            onRemove={(i) => removeRow(didnt, i, setDidnt)}
          />

          {/* Improve */}
          <RetroList
            title="Improve"
            icon="build"
            colorClass="amber lighten-5"
            items={improve}
            onChange={setImprove}
            onAdd={() => addRow(improve, setImprove)}
            onRemove={(i) => removeRow(improve, i, setImprove)}
          />

          {/* Divider */}
          <div className="divider" style={{ margin: "8px 0 20px" }} />

          {/* Section: Timesheet */}
          <h6 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className="material-icons">schedule</i> Timesheet
          </h6>
          <TimeSheet
            weekStartISO={weekStart}
            value={hours}
            onChange={setHours}
          />

          {/* Footer actions */}
          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button className="btn" type="submit" onClick={handleSubmit}>
              <i className="material-icons left">send</i> Submit
            </button>
            <span className="grey-text">
              Total this week: <b>{totalHours}</b> hrs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- RetroList subcomponent ---------- */

function RetroList({
  title,
  icon,
  colorClass,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  icon: string;
  colorClass: string;
  items: string[];
  onChange: (items: string[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className={`card-content ${colorClass}`}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <i className="material-icons">{icon}</i>
          <span style={{ fontWeight: 600 }}>{title}</span>
        </div>

        {items.map((value, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <input
              type="text"
              className="browser-default"
              value={value}
              onChange={(e) => {
                const copy = items.slice();
                copy[idx] = e.target.value;
                onChange(copy);
              }}
              placeholder="Short, punchy point…"
            />
            <button
              type="button"
              className="btn-flat"
              onClick={() => onRemove(idx)}
              title="Remove"
            >
              <i className="material-icons red-text text-darken-1">
                remove_circle
              </i>
            </button>
          </div>
        ))}

        <button
          type="button"
          className="btn-flat"
          onClick={onAdd}
          style={{ marginTop: 4 }}
        >
          <i className="material-icons left">add</i>Add row
        </button>
      </div>
    </div>
  );
}
