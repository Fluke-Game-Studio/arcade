import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiUser } from "../api/types/users";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function mentionLabel(row?: Partial<ApiUser> | null) {
  return safeStr(row?.employee_name || row?.username || "Unknown teammate");
}

function mentionSubLabel(row?: Partial<ApiUser> | null) {
  const username = safeStr(row?.username);
  const email = safeStr(row?.employee_email);
  if (username && email) return `@${username} · ${email}`;
  if (username) return `@${username}`;
  return email;
}

function findMentionQuery(value: string, caret: number) {
  const uptoCaret = String(value || "").slice(0, Math.max(0, caret));
  const match = uptoCaret.match(/(^|\s)@([A-Za-z0-9._%+-]*)$/);
  if (!match) return null;
  const query = safeStr(match[2] || "");
  const tokenStart = uptoCaret.length - query.length - 1;
  if (tokenStart < 0) return null;
  return { query: query.toLowerCase(), start: tokenStart, end: uptoCaret.length };
}

function matchesMentionQuery(row: ApiUser, query: string) {
  if (!query) return true;
  const q = safeStr(query).toLowerCase();
  return [
    safeStr(row.username),
    safeStr(row.employee_name),
    safeStr(row.employee_email),
  ].some((value) => value.toLowerCase().includes(q));
}

export default function MentionTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  users,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
  users: ApiUser[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mentionState, setMentionState] = useState<{ query: string; start: number; end: number } | null>(null);

  const suggestions = useMemo(() => {
    if (!mentionState) return [];
    return users.filter((row) => matchesMentionQuery(row, mentionState.query)).slice(0, 6);
  }, [mentionState, users]);

  useEffect(() => {
    setActiveIndex((curr) => {
      if (!suggestions.length) return 0;
      return Math.min(curr, suggestions.length - 1);
    });
  }, [suggestions]);

  function refreshMentionState(nextValue: string, caret: number) {
    const state = findMentionQuery(nextValue, caret);
    setMentionState(state);
  }

  function applyMention(row: ApiUser) {
    if (!mentionState) return;
    const username = safeStr(row.username);
    if (!username) return;
    const nextValue = `${value.slice(0, mentionState.start)}@${username} ${value.slice(mentionState.end)}`;
    const nextCaret = mentionState.start + username.length + 2;
    onChange(nextValue);
    setMentionState(null);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
    });
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const nextValue = e.target.value;
          onChange(nextValue);
          refreshMentionState(nextValue, e.target.selectionStart ?? nextValue.length);
        }}
        onClick={(e) => {
          const el = e.currentTarget;
          refreshMentionState(el.value, el.selectionStart ?? el.value.length);
        }}
        onKeyUp={(e) => {
          const el = e.currentTarget;
          refreshMentionState(el.value, el.selectionStart ?? el.value.length);
        }}
        onBlur={() => {
          window.setTimeout(() => setMentionState(null), 120);
        }}
        onKeyDown={(e) => {
          if (!suggestions.length || !mentionState) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((curr) => (curr + 1) % suggestions.length);
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((curr) => (curr - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            applyMention(suggestions[activeIndex] || suggestions[0]);
            return;
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setMentionState(null);
          }
        }}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 12,
          border: "1px solid rgba(148,163,184,.26)",
          background: "#fff",
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />
      {mentionState && suggestions.length ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 8px)",
            zIndex: 30,
            borderRadius: 14,
            border: "1px solid rgba(148,163,184,.18)",
            background: "rgba(255,255,255,.98)",
            boxShadow: "0 18px 38px rgba(15,23,42,.16)",
            overflow: "hidden",
            maxHeight: 280,
            overflowY: "auto",
            backdropFilter: "blur(10px)",
          }}
        >
          {suggestions.map((row, idx) => (
            <button
              key={safeStr(row.username)}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applyMention(row);
              }}
              onMouseEnter={() => setActiveIndex(idx)}
              style={{
                width: "100%",
                textAlign: "left",
                border: 0,
                borderTop: idx ? "1px solid rgba(148,163,184,.12)" : "none",
                background: idx === activeIndex ? "rgba(59,130,246,.10)" : "#fff",
                padding: "10px 12px",
                cursor: "pointer",
                display: "grid",
                gap: 2,
              }}
            >
              <span style={{ fontWeight: 900, color: "#0f172a" }}>{mentionLabel(row)}</span>
              <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{mentionSubLabel(row)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
