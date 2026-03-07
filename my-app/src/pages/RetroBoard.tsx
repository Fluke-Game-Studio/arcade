// src/pages/RetroBoard.tsx
import React, { useMemo, useState } from "react";
import { useUpdates } from "./UpdatesContext";

type RetroKind = "worked" | "didnt" | "improve";

type RetroOnlySubmission = {
  id: string;
  userId?: string;
  userName?: string;
  weekStart: string;
  retrospective: {
    worked: string[];
    didnt: string[];
    improve: string[];
  };
};

type RetroNote = {
  id: string;
  text: string;
  who: string;
  week: string;
  kind: RetroKind;
};

const boardCard: React.CSSProperties = {
  borderRadius: 24,
  overflow: "hidden",
  border: "1px solid rgba(148,163,184,.14)",
  boxShadow: "0 16px 40px rgba(15,23,42,.08)",
  background:
    "linear-gradient(180deg, rgba(248,250,252,1) 0%, rgba(255,255,255,1) 100%)",
};

const columnStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.72)",
  border: "1px solid rgba(148,163,184,.14)",
  borderRadius: 20,
  padding: 14,
  minHeight: 420,
  boxShadow: "0 10px 24px rgba(15,23,42,.05)",
};

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function toneFor(kind: RetroKind) {
  if (kind === "worked") {
    return {
      bg: "linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)",
      border: "rgba(34,197,94,.22)",
      title: "#166534",
      chipBg: "rgba(34,197,94,.12)",
      chipText: "#166534",
      heading: "What Worked",
      emoji: "✅",
    };
  }
  if (kind === "didnt") {
    return {
      bg: "linear-gradient(135deg, #ffe4e6 0%, #fecdd3 100%)",
      border: "rgba(244,63,94,.20)",
      title: "#be123c",
      chipBg: "rgba(244,63,94,.10)",
      chipText: "#be123c",
      heading: "What Didn’t",
      emoji: "❌",
    };
  }
  return {
    bg: "linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)",
    border: "rgba(245,158,11,.22)",
    title: "#92400e",
    chipBg: "rgba(245,158,11,.12)",
    chipText: "#92400e",
    heading: "Improve",
    emoji: "🛠️",
  };
}

function HeaderChip({
  label,
  value,
  tint,
  color,
}: {
  label: string;
  value: string;
  tint: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: tint,
        color,
        fontWeight: 800,
        fontSize: 12,
      }}
    >
      <span>{label}</span>
      <span style={{ opacity: 0.95 }}>{value}</span>
    </div>
  );
}

function PersonChip({
  who,
  toneBg,
  toneText,
}: {
  who: string;
  toneBg: string;
  toneText: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 999,
        background: toneBg,
        color: toneText,
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        maxWidth: "100%",
      }}
      title={who}
    >
      <i className="material-icons" style={{ fontSize: 14 }}>
        person
      </i>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {who}
      </span>
    </span>
  );
}

function NoteCard({ note }: { note: RetroNote }) {
  const tone = toneFor(note.kind);

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        marginBottom: 12,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        boxShadow: "0 10px 20px rgba(15,23,42,.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <PersonChip who={note.who} toneBg={tone.chipBg} toneText={tone.chipText} />
      </div>

      <div
        style={{
          color: "#0f172a",
          fontSize: 14,
          lineHeight: 1.5,
          fontWeight: 700,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {note.text}
      </div>
    </div>
  );
}

function EmptyColumn({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px dashed rgba(148,163,184,.35)",
        padding: 18,
        color: "#64748b",
        background: "rgba(248,250,252,.8)",
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}

export default function RetroBoard() {
  const raw = useUpdates();

  const loading = !!raw?.loading;
  const error = safeStr(raw?.error);
  const unauthenticated = !!raw?.unauthenticated;

  const retroSubs = useMemo<RetroOnlySubmission[]>(() => {
    const submissions = asArray<any>(raw?.submissions);

    return submissions.map((s, idx) => ({
      id: safeStr(s?.id) || `retro-${idx}`,
      userId: safeStr(s?.userId),
      userName: safeStr(s?.userName) || safeStr(s?.userId) || "Anon",
      weekStart: safeStr(s?.weekStart),
      retrospective: {
        worked: asArray<any>(s?.retrospective?.worked).map(safeStr).filter(Boolean),
        didnt: asArray<any>(s?.retrospective?.didnt).map(safeStr).filter(Boolean),
        improve: asArray<any>(s?.retrospective?.improve).map(safeStr).filter(Boolean),
      },
    }));
  }, [raw?.submissions]);

  const allWeeks = useMemo(() => {
    const set = new Set<string>();
    retroSubs.forEach((s) => {
      if (s.weekStart) set.add(s.weekStart);
    });
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [retroSubs]);

  const [selectedWeek, setSelectedWeek] = useState("");

  const filteredSubs = useMemo(() => {
    if (!selectedWeek) return retroSubs;
    return retroSubs.filter((s) => s.weekStart === selectedWeek);
  }, [retroSubs, selectedWeek]);

  const makeNotes = (kind: RetroKind): RetroNote[] => {
    return filteredSubs.reduce<RetroNote[]>((acc, s, sIdx) => {
      const notes = asArray<string>(s.retrospective?.[kind]);

      notes.forEach((text, idx) => {
        const clean = safeStr(text);
        if (!clean) return;

        acc.push({
          id: `${s.id}-${kind}-${sIdx}-${idx}`,
          text: clean,
          who: s.userName || s.userId || "Anon",
          week: s.weekStart,
          kind,
        });
      });

      return acc;
    }, []);
  };

  const worked = useMemo(() => makeNotes("worked"), [filteredSubs]);
  const didnt = useMemo(() => makeNotes("didnt"), [filteredSubs]);
  const improve = useMemo(() => makeNotes("improve"), [filteredSubs]);

  const stats = useMemo(() => {
    const people = new Set(filteredSubs.map((s) => s.userName || s.userId || "Anon"));
    return {
      members: people.size,
      worked: worked.length,
      didnt: didnt.length,
      improve: improve.length,
    };
  }, [filteredSubs, worked, didnt, improve]);

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <div className="card" style={boardCard}>
        <div
          style={{
            padding: 22,
            borderBottom: "1px solid rgba(148,163,184,.12)",
            background:
              "radial-gradient(circle at top right, rgba(34,197,94,.08), transparent 30%), radial-gradient(circle at top left, rgba(244,63,94,.06), transparent 28%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 1000,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                }}
              >
                Retrospective Board
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "#475569",
                  fontSize: 14,
                  maxWidth: 760,
                }}
              >
                Team retrospective view by week. Only retrospective notes are shown:
                what worked, what didn’t, and what to improve.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <HeaderChip
                label="Members"
                value={String(stats.members)}
                tint="rgba(59,130,246,.10)"
                color="#1d4ed8"
              />
              <HeaderChip
                label="Worked"
                value={String(stats.worked)}
                tint="rgba(34,197,94,.10)"
                color="#166534"
              />
              <HeaderChip
                label="Didn’t"
                value={String(stats.didnt)}
                tint="rgba(244,63,94,.10)"
                color="#be123c"
              />
              <HeaderChip
                label="Improve"
                value={String(stats.improve)}
                tint="rgba(245,158,11,.10)"
                color="#92400e"
              />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 0, marginTop: 14 }}>
            <div className="col s12 m6 l4">
              <div className="input-field" style={{ marginTop: 0 }}>
                <select
                  className="browser-default"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(148,163,184,.25)",
                    background: "#fff",
                    padding: "10px 12px",
                    height: 44,
                  }}
                >
                  <option value="">All weeks</option>
                  {allWeeks.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
                <label
                  className="active"
                  style={{
                    display: "block",
                    position: "static",
                    marginBottom: 6,
                    color: "#475569",
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: ".05em",
                    textTransform: "uppercase",
                  }}
                >
                  Week (Monday)
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 18 }}>
          {loading && (
            <div
              style={{
                borderRadius: 16,
                background: "rgba(248,250,252,.9)",
                border: "1px solid rgba(148,163,184,.12)",
                padding: 18,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Loading retrospective board…
            </div>
          )}

          {unauthenticated && !loading && (
            <div
              style={{
                borderRadius: 16,
                background: "rgba(248,250,252,.9)",
                border: "1px solid rgba(148,163,184,.12)",
                padding: 18,
                color: "#64748b",
                fontWeight: 700,
              }}
            >
              Please log in to view team retros.
            </div>
          )}

          {!!error && !unauthenticated && !loading && (
            <div
              style={{
                borderRadius: 16,
                background: "rgba(254,242,242,.9)",
                border: "1px solid rgba(248,113,113,.18)",
                padding: 18,
                color: "#b91c1c",
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          )}

          {!loading && !unauthenticated && !error && (
            <>
              <div className="row" style={{ marginTop: 4, marginBottom: 0 }}>
                <div className="col s12 m4">
                  <div style={columnStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 14,
                        color: toneFor("worked").title,
                        fontWeight: 1000,
                        fontSize: 18,
                      }}
                    >
                      <span>{toneFor("worked").emoji}</span>
                      <span>{toneFor("worked").heading}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: toneFor("worked").chipBg,
                          color: toneFor("worked").chipText,
                          fontWeight: 900,
                        }}
                      >
                        {worked.length}
                      </span>
                    </div>

                    {worked.length === 0 ? (
                      <EmptyColumn text="No notes in this column for the selected week." />
                    ) : (
                      worked.map((note) => <NoteCard key={note.id} note={note} />)
                    )}
                  </div>
                </div>

                <div className="col s12 m4">
                  <div style={columnStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 14,
                        color: toneFor("didnt").title,
                        fontWeight: 1000,
                        fontSize: 18,
                      }}
                    >
                      <span>{toneFor("didnt").emoji}</span>
                      <span>{toneFor("didnt").heading}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: toneFor("didnt").chipBg,
                          color: toneFor("didnt").chipText,
                          fontWeight: 900,
                        }}
                      >
                        {didnt.length}
                      </span>
                    </div>

                    {didnt.length === 0 ? (
                      <EmptyColumn text="No notes in this column for the selected week." />
                    ) : (
                      didnt.map((note) => <NoteCard key={note.id} note={note} />)
                    )}
                  </div>
                </div>

                <div className="col s12 m4">
                  <div style={columnStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 14,
                        color: toneFor("improve").title,
                        fontWeight: 1000,
                        fontSize: 18,
                      }}
                    >
                      <span>{toneFor("improve").emoji}</span>
                      <span>{toneFor("improve").heading}</span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 12,
                          padding: "6px 10px",
                          borderRadius: 999,
                          background: toneFor("improve").chipBg,
                          color: toneFor("improve").chipText,
                          fontWeight: 900,
                        }}
                      >
                        {improve.length}
                      </span>
                    </div>

                    {improve.length === 0 ? (
                      <EmptyColumn text="No notes in this column for the selected week." />
                    ) : (
                      improve.map((note) => <NoteCard key={note.id} note={note} />)
                    )}
                  </div>
                </div>
              </div>

              {filteredSubs.length === 0 && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 16,
                    background: "rgba(248,250,252,.9)",
                    border: "1px solid rgba(148,163,184,.12)",
                    padding: 18,
                    color: "#64748b",
                    fontWeight: 700,
                  }}
                >
                  No retrospective submissions yet for the selected range.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}