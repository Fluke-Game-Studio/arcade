// src/pages/Employees.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiUser } from "../api";
import "./employees.css";

declare const M: any;

// ── helpers ───────────────────────────────────────────────────────────────
function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function initials(name: string) {
  const s = safeStr(name);
  if (!s) return "FG";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "").toUpperCase();
  const b = (parts[1]?.[0] || parts[0]?.[1] || "").toUpperCase();
  return (a + b) || "FG";
}

/** Reads employee_role then role as fallback — handles both field conventions */
function roleLower(u?: ApiUser | null): string {
  return safeStr((u as any)?.employee_role || (u as any)?.role).toLowerCase() || "employee";
}

function readBool(v: any, fallback = false) {
  if (typeof v === "boolean") return v;
  const s = safeStr(v).toLowerCase();
  if (!s) return fallback;
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

/** 0 = super*, 1 = admin*, 2 = employee — used for card colour only */
function roleTier(u: ApiUser): 0 | 1 | 2 {
  const r = roleLower(u);
  if (r.startsWith("super")) return 0;
  if (r.startsWith("admin")) return 1;
  return 2;
}

const TIER_COLOR:  Record<0|1|2,string> = { 0:"rgba(251,191,36,0.55)",  1:"rgba(99,102,241,0.55)", 2:"rgba(34,197,94,0.4)"  };
const TIER_ACCENT: Record<0|1|2,string> = { 0:"#fbbf24",                1:"#818cf8",               2:"#4ade80"              };
const TIER_BG:     Record<0|1|2,string> = { 0:"rgba(251,191,36,0.15)",  1:"rgba(99,102,241,0.16)", 2:"rgba(34,197,94,0.12)" };

// ── Tree building ──────────────────────────────────────────────────────────
interface OrgTreeNode {
  user: ApiUser;
  children: OrgTreeNode[];
  x: number;   // left of card
  y: number;   // top of card
  span: number; // total horizontal span (including HG padding) claimed by this subtree
}

/** Extract a canonical key (lowercase email or username) from the employee_manager field.
 *  The field might store: "P.Mathur@flukegamestudio.com", "p.mathur",
 *  or a display value like "Prachi Mathur (P.Mathur@flukegamestudio.com)". */
function extractManagerKey(raw: string): string {
  if (!raw) return "";
  // Look for an email inside parentheses first
  const m = raw.match(/\(([^)]+@[^)]+)\)/);
  if (m) return m[1].trim().toLowerCase();
  // Otherwise use the raw value (could be an email or username)
  return raw.trim().toLowerCase();
}

function buildOrgTree(employees: ApiUser[]): OrgTreeNode[] {
  const byEmail    = new Map<string, ApiUser>();
  const byUsername = new Map<string, ApiUser>();
  for (const u of employees) {
    const e = safeStr(u.employee_email).toLowerCase();
    const n = safeStr(u.username).toLowerCase();
    if (e) byEmail.set(e, u);
    if (n) byUsername.set(n, u);
  }

  const childrenOf = new Map<string, ApiUser[]>();
  const roots: ApiUser[] = [];

  for (const u of employees) {
    const raw = safeStr((u as any).employee_manager);
    const key = extractManagerKey(raw);
    const parent = key ? (byEmail.get(key) || byUsername.get(key)) : null;

    if (!parent || parent.username === u.username) {
      roots.push(u);
    } else {
      const pk = parent.username;
      if (!childrenOf.has(pk)) childrenOf.set(pk, []);
      childrenOf.get(pk)!.push(u);
    }
  }

  // Sort children within each parent by role tier then name
  childrenOf.forEach(kids =>
    kids.sort((a, b) => roleTier(a) - roleTier(b) || safeStr(a.employee_name).localeCompare(safeStr(b.employee_name)))
  );
  roots.sort((a, b) => roleTier(a) - roleTier(b) || safeStr(a.employee_name).localeCompare(safeStr(b.employee_name)));

  function mkNode(u: ApiUser): OrgTreeNode {
    const children = (childrenOf.get(u.username) || []).map(mkNode);
    return { user: u, children, x: 0, y: 0, span: 0 };
  }
  return roots.map(mkNode);
}

/** Recursively compute subtree horizontal span, then centre each node over its children. */
function layoutTree(nodes: OrgTreeNode[], startX: number, depth: number): number {
  let cursor = startX;
  for (const n of nodes) {
    const childSpan = n.children.length > 0 ? layoutTree(n.children, cursor, depth + 1) : 0;
    n.span = Math.max(childSpan, NW + HG);
    n.x    = cursor + (n.span - NW) / 2;
    n.y    = PAD + ROOT_H + ROOT_VG + depth * (NH + VG);
    cursor += n.span;
  }
  return cursor - startX;
}

function flattenTree(nodes: OrgTreeNode[]): OrgTreeNode[] {
  const out: OrgTreeNode[] = [];
  function walk(n: OrgTreeNode) { out.push(n); n.children.forEach(walk); }
  nodes.forEach(walk);
  return out;
}

// ── org chart layout constants ─────────────────────────────────────────────
const NW = 174;   // node width
const NH = 116;   // node height
const HG = 24;    // horizontal gap between siblings
const VG = 90;    // vertical gap between levels
const PAD = 60;   // outer horizontal padding
const ROOT_H = 74;
const ROOT_VG = 72;

// ── OrgNodeCard ────────────────────────────────────────────────────────────
function OrgNodeCard({ u, broken, onBroken }: {
  u: ApiUser; broken: boolean; onBroken: () => void;
}) {
  const tier = roleTier(u);
  const [hov, setHov] = useState(false);
  const name     = safeStr(u.employee_name) || safeStr(u.username) || "—";
  const title    = safeStr(u.employee_title) || "—";
  const dept     = safeStr((u as any).department) || "";
  const avatar   = safeStr((u as any).employee_profilepicture) || safeStr((u as any).employee_picture);
  const revoked  = readBool((u as any).revoked, false);
  const role     = roleLower(u);
  const badgeLabel = role.startsWith("super") ? "SUPER" : role.startsWith("admin") ? "ADMIN" : "STAFF";

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${name}\n${title}${dept ? `\n${dept}` : ""}`}
      style={{
        width: NW, height: NH, borderRadius: 14,
        background: hov ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.055)",
        border: `1px solid ${TIER_COLOR[tier]}`,
        boxShadow: hov
          ? `0 0 0 1px rgba(255,255,255,0.07), 0 10px 36px ${TIER_BG[tier]}`
          : `0 0 0 1px rgba(255,255,255,0.04), 0 4px 20px ${TIER_BG[tier]}`,
        backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
        padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4,
        position: "relative", overflow: "hidden",
        transform: hov ? "translateY(-2px)" : "none",
        transition: "all 0.16s ease",
        userSelect: "none", cursor: "default",
      }}
    >
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${TIER_ACCENT[tier]},transparent)`, opacity: 0.7 }} />

      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{
          width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
          background: TIER_BG[tier], border: `1.5px solid ${TIER_COLOR[tier]}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", fontSize: 13, fontWeight: 900, color: TIER_ACCENT[tier],
        }}>
          {avatar && !broken
            ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={onBroken} />
            : <span>{initials(name)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, color: "#f1f5f9", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.48)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        </div>
      </div>

      {dept && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 1 }}>{dept}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 800, letterSpacing: "0.6px", background: TIER_BG[tier], color: TIER_ACCENT[tier], border: `1px solid ${TIER_COLOR[tier]}` }}>
          {badgeLabel}
        </span>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: revoked ? "#ef4444" : "#22c55e", boxShadow: revoked ? "0 0 6px #ef4444" : "0 0 6px #22c55e" }} title={revoked ? "Revoked" : "Active"} />
      </div>
    </div>
  );
}

// ── OrgChart ───────────────────────────────────────────────────────────────
function OrgChart({ employees, brokenAvatarKeys, setBrokenAvatarKeys }: {
  employees: ApiUser[];
  brokenAvatarKeys: Record<string, boolean>;
  setBrokenAvatarKeys: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const dragRef       = useRef({ active: false, startX: 0, startY: 0, px: 0, py: 0 });
  const initialised   = useRef(false);

  const [zoom, setZoom]       = useState(0.85);
  const [pan, setPan]         = useState({ x: 50, y: 24 });
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Fullscreen events
  useEffect(() => {
    const h = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── Build & layout tree ─────────────────────────────────────────────────
  const roots = useMemo(() => buildOrgTree(employees), [employees]);

  // Compute layout: returns total span used
  const treeSpan = useMemo(() => {
    if (roots.length === 0) return 0;
    return layoutTree(roots, PAD, 0);
  }, [roots]);

  const allNodes  = useMemo(() => flattenTree(roots), [roots]);
  const maxDepth  = useMemo(() => allNodes.reduce((m, n) => Math.max(m, Math.round((n.y - (PAD + ROOT_H + ROOT_VG)) / (NH + VG))), 0), [allNodes]);

  const canvasW    = Math.max(treeSpan + PAD * 2, 700);
  const canvasH    = PAD + ROOT_H + ROOT_VG + (maxDepth + 1) * (NH + VG) + PAD;
  const rootStartY = PAD;
  const rootCX     = canvasW / 2;

  // Auto-centre on first load
  useEffect(() => {
    if (initialised.current || !containerRef.current || employees.length === 0) return;
    initialised.current = true;
    const cw = containerRef.current.offsetWidth;
    const z = 0.85;
    setZoom(z);
    setPan({ x: Math.max((cw - canvasW * z) / 2, 20), y: 28 });
  }, [employees.length, canvasW]);

  // ── Connections: company → roots, then parent → children ────────────────
  type Conn = { x1: number; y1: number; x2: number; y2: number; tier: 0 | 1 | 2 };
  const conns: Conn[] = useMemo(() => {
    const out: Conn[] = [];
    // Company root → each direct report (root-level employees)
    for (const r of roots) {
      out.push({ x1: rootCX, y1: rootStartY + ROOT_H, x2: r.x + NW / 2, y2: r.y, tier: roleTier(r.user) });
    }
    // Each node → its children
    function walk(n: OrgTreeNode) {
      for (const c of n.children) {
        out.push({ x1: n.x + NW / 2, y1: n.y + NH, x2: c.x + NW / 2, y2: c.y, tier: roleTier(n.user) });
        walk(c);
      }
    }
    roots.forEach(walk);
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, rootCX, rootStartY]);

  // ── Pan / Zoom handlers ─────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setPan({ x: dragRef.current.px + (e.clientX - dragRef.current.startX), y: dragRef.current.py + (e.clientY - dragRef.current.startY) });
  };
  const onPointerUp = () => { dragRef.current.active = false; setDragging(false); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cx = (mx - pan.x) / zoom, cy = (my - pan.y) / zoom;
    const newZ = Math.min(Math.max(zoom * (e.deltaY < 0 ? 1.1 : 0.9), 0.25), 2.5);
    setPan({ x: mx - cx * newZ, y: my - cy * newZ });
    setZoom(newZ);
  };

  const zoomBy = (delta: number) => {
    if (!containerRef.current) return;
    const cw = containerRef.current.offsetWidth, ch = containerRef.current.offsetHeight;
    const newZ = Math.min(Math.max(+(zoom + delta).toFixed(2), 0.25), 2.5);
    const cx = (cw / 2 - pan.x) / zoom, cy = (ch / 2 - pan.y) / zoom;
    setPan({ x: cw / 2 - cx * newZ, y: ch / 2 - cy * newZ });
    setZoom(newZ);
  };

  const resetView = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.offsetWidth;
    const z = 0.85;
    setZoom(z);
    setPan({ x: Math.max((cw - canvasW * z) / 2, 20), y: 28 });
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const ctrlBtn: React.CSSProperties = {
    height: 30, minWidth: 30, padding: "0 9px", borderRadius: 8,
    background: "rgba(255,255,255,0.09)", border: "1px solid rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.92)", cursor: "pointer", fontSize: 13, fontWeight: 800,
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
    transition: "background 0.12s",
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        height: fullscreen ? "100vh" : "70vh",
        overflow: "hidden",
        cursor: dragging ? "grabbing" : "grab",
        borderRadius: fullscreen ? 0 : 10,
        background: "linear-gradient(135deg,#060c18 0%,#0d1629 55%,#060c18 100%)",
        userSelect: "none",
        touchAction: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      {/* ── Controls overlay ── */}
      <div
        style={{ position: "absolute", top: 12, right: 12, zIndex: 20, display: "flex", gap: 6, alignItems: "center" }}
        onPointerDown={e => e.stopPropagation()}
      >
        <button style={ctrlBtn} onClick={() => zoomBy(-0.1)} title="Zoom out">−</button>
        <button style={{ ...ctrlBtn, minWidth: 46, fontSize: 11, letterSpacing: "0.3px" }} onClick={resetView} title="Reset view">
          {Math.round(zoom * 100)}%
        </button>
        <button style={ctrlBtn} onClick={() => zoomBy(0.1)} title="Zoom in">+</button>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.13)", margin: "0 2px" }} />
        <button style={ctrlBtn} onClick={toggleFullscreen} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
          <i className="material-icons" style={{ fontSize: 17 }}>{fullscreen ? "fullscreen_exit" : "fullscreen"}</i>
        </button>
      </div>

      {/* Legend */}
      <div
        style={{ position: "absolute", bottom: 12, right: 12, zIndex: 10, display: "flex", gap: 12, alignItems: "center" }}
        onPointerDown={e => e.stopPropagation()}
      >
        {([0, 1, 2] as const).map(t => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_ACCENT[t], boxShadow: `0 0 6px ${TIER_ACCENT[t]}` }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.38)", letterSpacing: "0.4px" }}>
              {t === 0 ? "Super" : t === 1 ? "Admin" : "Staff"}
            </span>
          </div>
        ))}
        <span style={{ fontSize: 9.5, color: "rgba(255,255,255,0.18)", marginLeft: 6 }}>Drag · Scroll to zoom</span>
      </div>

      {/* ── Pannable canvas ── */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        transformOrigin: "0 0",
        transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
        willChange: "transform",
      }}>
        <div style={{ position: "relative", width: canvasW, height: canvasH }}>

          {/* SVG connector layer */}
          <svg width={canvasW} height={canvasH} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
            <defs>
              {([0, 1, 2] as const).map(t => (
                <marker key={t} id={`dot-${t}`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6">
                  <circle cx="3" cy="3" r="2.5" fill={TIER_COLOR[t]} />
                </marker>
              ))}
            </defs>
            {conns.map((c, i) => {
              const midY = (c.y1 + c.y2) / 2;
              return (
                <path
                  key={i}
                  d={`M ${c.x1} ${c.y1} C ${c.x1} ${midY}, ${c.x2} ${midY}, ${c.x2} ${c.y2}`}
                  fill="none"
                  stroke={TIER_COLOR[c.tier]}
                  strokeWidth={1.5}
                  opacity={0.8}
                  markerEnd={`url(#dot-${c.tier})`}
                />
              );
            })}
          </svg>

          {/* Root / Company node */}
          <div style={{
            position: "absolute", top: rootStartY, left: rootCX - 82,
            width: 164, height: ROOT_H, borderRadius: 18,
            background: "linear-gradient(135deg,rgba(37,99,235,0.35),rgba(99,102,241,0.26))",
            border: "1px solid rgba(99,102,241,0.6)",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 8px 36px rgba(99,102,241,0.35)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(99,102,241,0.35)", border: "1px solid rgba(99,102,241,0.5)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
              <i className="material-icons" style={{ fontSize: 16, color: "#818cf8" }}>games</i>
            </div>
            <div style={{ fontSize: 16, fontWeight: 950, color: "#f8fafc", letterSpacing: "-0.4px", lineHeight: 1 }}>Fluke Games</div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", letterSpacing: "1px", marginTop: 2 }}>STUDIO</div>
          </div>

          {/* Depth labels (left gutter) — one per unique Y level */}
          {(() => {
            // Map each depth → the best tier label for that row
            const depthMap = new Map<number, { tier: 0|1|2; y: number }>();
            for (const n of allNodes) {
              const depth = Math.round((n.y - (PAD + ROOT_H + ROOT_VG)) / (NH + VG));
              const t = roleTier(n.user);
              const prev = depthMap.get(depth);
              // Keep the highest-ranking (lowest number) tier seen at this depth
              if (!prev || t < prev.tier) depthMap.set(depth, { tier: t, y: n.y });
            }
            const LABEL: Record<0|1|2,string> = { 0: "Leadership", 1: "Management", 2: "Contributors" };
            return Array.from(depthMap.entries()).map(([depth, { tier, y }]) => (
              <div key={depth} style={{
                position: "absolute",
                top: y + NH / 2 - 16,
                left: 4, width: PAD - 10,
                fontSize: 8, fontWeight: 900, letterSpacing: "0.8px",
                textTransform: "uppercase", lineHeight: 1.5, textAlign: "right",
                color: TIER_COLOR[tier],
              }}>
                {LABEL[tier]}
              </div>
            ));
          })()}

          {/* Employee cards — positioned by tree layout */}
          {allNodes.map(n => {
            const key = safeStr(n.user.username) || safeStr(n.user.employee_email);
            return (
              <div
                key={n.user.username}
                style={{ position: "absolute", top: n.y, left: n.x }}
                onPointerDown={e => e.stopPropagation()}
              >
                <OrgNodeCard
                  u={n.user}
                  broken={!!brokenAvatarKeys[key]}
                  onBroken={() => setBrokenAvatarKeys(p => ({ ...p, [key]: true }))}
                />
              </div>
            );
          })}

        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
type EmployeesProps = {
  initialView?: "list" | "org";
};

export default function Employees({ initialView = "list" }: EmployeesProps = {}) {
  const { api } = useAuth();

  const [query, setQuery]   = useState("");
  const [rows, setRows]     = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokenAvatarKeys, setBrokenAvatarKeys] = useState<Record<string, boolean>>({});
  const [view, setView]     = useState<"list" | "org">(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    let mount = true;
    (async () => {
      try {
        setLoading(true);
        const data = await api.getUsers();
        const list = Array.isArray((data as any)?.items) ? (data as any).items
          : Array.isArray(data) ? (data as any) : [];
        if (mount) setRows(list);
      } catch (e: any) {
        if (typeof M !== "undefined") M.toast({ html: e?.message || "Failed to load employees", classes: "red" });
        if (mount) setRows([]);
      } finally {
        if (mount) setLoading(false);
      }
    })();
    return () => { mount = false; };
  }, [api]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [safeStr(r.employee_name), safeStr(r.employee_email), safeStr(r.username),
        safeStr((r as any).department), safeStr(r.employee_title),
        safeStr((r as any).employee_id), safeStr((r as any).location)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  return (
    <main className="container emp-shell" style={{ paddingTop: 18, maxWidth: 1200 }}>
      <style>{`
        .emp-shell { animation: empFade .22s ease both; }
        @keyframes empFade { from{opacity:0;transform:translateY(6px);} to{opacity:1;transform:none;} }

        .emp-card { border-radius: 18px; overflow: hidden; border: 1px solid #e6edf2; background: #fff; box-shadow: 0 14px 30px rgba(0,0,0,.08); }

        .emp-topbar {
          padding: 16px 16px 14px;
          border-bottom: 1px solid #eef2f7;
          background:
            radial-gradient(900px 240px at 12% 10%, rgba(37,99,235,0.24), transparent 60%),
            radial-gradient(700px 260px at 85% 40%, rgba(34,197,94,0.14), transparent 60%),
            linear-gradient(135deg, #0b1220 0%, #111827 55%, #0b1220 100%);
          color: #fff; position: relative; overflow: hidden;
        }
        .emp-topbar::after {
          content:""; position:absolute; inset:-40%;
          background:linear-gradient(90deg,transparent,rgba(255,255,255,.10),transparent);
          transform:translateX(-40%) rotate(10deg);
          animation:empShimmer 4.2s ease-in-out infinite; pointer-events:none; opacity:.55;
        }
        @keyframes empShimmer{0%{transform:translateX(-45%) rotate(10deg);}55%{transform:translateX(45%) rotate(10deg);}100%{transform:translateX(45%) rotate(10deg);}}

        .emp-titleRow{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;position:relative;z-index:1;}
        .emp-title{font-weight:950;letter-spacing:-0.4px;font-size:20px;line-height:1.1;margin:0;}
        .emp-subtitle{margin-top:4px;font-size:12.5px;color:rgba(255,255,255,.78);font-weight:700;}
        .emp-countPill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.92);font-weight:900;font-size:12px;white-space:nowrap;}
        .emp-countPill i.material-icons{font-size:16px;opacity:.95;}

        .emp-viewToggle{display:inline-flex;border-radius:10px;border:1px solid rgba(255,255,255,0.16);overflow:hidden;}
        .emp-viewBtn{padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer;background:transparent;border:none;color:rgba(255,255,255,0.5);transition:all .15s;}
        .emp-viewBtn.active{background:rgba(255,255,255,0.14);color:#fff;}
        .emp-viewBtn:hover:not(.active){background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.82);}
        .emp-viewBtn i.material-icons{font-size:14px;vertical-align:middle;margin-right:5px;}

        .emp-searchWrap{position:relative;z-index:1;margin-top:12px;display:flex;gap:10px;align-items:center;}
        .emp-search{flex:1;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(10px);}
        .emp-search i.material-icons{font-size:20px;color:rgba(255,255,255,.88);}
        .emp-search input{border:none!important;box-shadow:none!important;outline:none!important;margin:0!important;height:26px!important;color:rgba(255,255,255,.95)!important;font-weight:900;}
        .emp-search input::placeholder{color:rgba(255,255,255,.60);font-weight:800;}
        .emp-clearBtn{height:42px;border-radius:14px;padding:0 12px;font-weight:900;text-transform:none;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.10);color:rgba(255,255,255,.92);display:inline-flex;align-items:center;gap:6px;cursor:pointer;}
        .emp-clearBtn:hover{background:rgba(255,255,255,.14);}
        .emp-clearBtn i.material-icons{font-size:18px;}

        .emp-body{padding:14px 14px 16px;}
        .emp-body--dark{padding:12px;}

        .emp-list{margin:0;border:1px solid #e6edf2!important;border-radius:16px!important;overflow:hidden;background:#fff;}
        .emp-item{display:flex!important;align-items:center;gap:14px;padding:14px 14px!important;border-bottom:1px solid #eef2f7!important;background:linear-gradient(135deg,#fff 0%,#fbfdff 60%,#f7fafc 100%);transition:transform .12s,box-shadow .12s;position:relative;}
        .emp-item:last-child{border-bottom:none!important;}
        .emp-item:hover{transform:translateY(-1px);box-shadow:0 12px 24px rgba(0,0,0,.08);background:#fff;}
        .emp-item::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:999px;background:transparent;transition:background .15s;}
        .emp-item:hover::before{background:rgba(37,99,235,.65);}

        .emp-avatarBox{width:74px;height:74px;min-width:74px;border-radius:22px;overflow:hidden;background:linear-gradient(135deg,rgba(37,99,235,0.14),rgba(34,197,94,0.10));border:2px solid rgba(255,255,255,.85);box-shadow:0 16px 30px rgba(0,0,0,.12);position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}
        .emp-avatarBox img{width:100%;height:100%;object-fit:cover;display:block;}
        .emp-avatarInitials{font-weight:950;letter-spacing:.6px;color:#0f172a;font-size:22px;}
        .emp-dot{position:absolute;right:9px;bottom:9px;width:12px;height:12px;border-radius:999px;background:#22c55e;border:2px solid rgba(15,23,42,0.9);box-shadow:0 10px 18px rgba(0,0,0,.18);}

        .emp-meta{flex:1;min-width:0;}
        .emp-nameRow{display:flex;align-items:center;justify-content:space-between;gap:10px;}
        .emp-name{font-weight:950;letter-spacing:-0.2px;color:#0f172a;font-size:15.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .emp-lines{margin-top:4px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#607d8b;font-size:12.5px;font-weight:800;}
        .emp-lines .sep{opacity:.55;}
        .emp-email{margin-top:5px;color:#90a4ae;font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

        .emp-badges{display:flex;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end;}
        .emp-badge{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:950;border:1px solid rgba(15,23,42,.10);background:rgba(148,163,184,.12);color:#334155;white-space:nowrap;}
        .emp-badge i.material-icons{font-size:16px;opacity:.9;}
        .emp-badge--super{background:rgba(37,99,235,0.14);border-color:rgba(37,99,235,0.22);color:#1e40af;}
        .emp-badge--admin{background:rgba(245,158,11,0.14);border-color:rgba(245,158,11,0.22);color:#92400e;}
        .emp-badge--employee{background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.22);color:#166534;}
        .emp-badge--id{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;background:rgba(148,163,184,0.12);}
        .emp-skeleton{border:1px solid #e6edf2;border-radius:16px;padding:14px;background:#fbfdff;color:#607d8b;font-weight:900;}

        @media(max-width:600px){
          .emp-avatarBox{width:62px;height:62px;min-width:62px;border-radius:20px;}
          .emp-title{font-size:18px;}
          .emp-searchWrap{flex-direction:column;align-items:stretch;}
          .emp-clearBtn{width:100%;justify-content:center;}
        }
      `}</style>

      <div className="card emp-card">
        {/* ── Header ── */}
        <div className="emp-topbar">
          <div className="emp-titleRow">
            <div>
              <h5 className="emp-title" style={{ margin: 0 }}>
                {view === "org" ? "Organisation Chart" : "Employees Directory"}
              </h5>
              <div className="emp-subtitle">
                {view === "org"
                  ? "Leadership · Management · Contributors — drag to pan, scroll to zoom"
                  : "Search by name, email, username, title, department, location."}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", zIndex: 1, flexShrink: 0 }}>
              <div className="emp-viewToggle">
                <button className={`emp-viewBtn${view === "list" ? " active" : ""}`} onClick={() => setView("list")}>
                  <i className="material-icons">list</i>Directory
                </button>
                <button className={`emp-viewBtn${view === "org" ? " active" : ""}`} onClick={() => setView("org")}>
                  <i className="material-icons">account_tree</i>Org Chart
                </button>
              </div>
              <span className="emp-countPill">
                <i className="material-icons">groups</i>
                {view === "list" ? `${filtered.length}/${rows.length}` : rows.length}
              </span>
            </div>
          </div>

          {view === "list" && (
            <div className="emp-searchWrap">
              <div className="emp-search" role="search">
                <i className="material-icons">search</i>
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employees…" />
              </div>
              <button type="button" className="emp-clearBtn" onClick={() => setQuery("")} disabled={!query}
                style={query ? undefined : { opacity: 0.55, cursor: "default" }}>
                <i className="material-icons">close</i>Clear
              </button>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        {view === "org" ? (
          <div className="emp-body emp-body--dark">
            {loading
              ? <div style={{ color: "rgba(255,255,255,0.4)", padding: 20, fontWeight: 800 }}>Loading…</div>
              : <OrgChart employees={rows} brokenAvatarKeys={brokenAvatarKeys} setBrokenAvatarKeys={setBrokenAvatarKeys} />
            }
          </div>
        ) : (
          <div className="emp-body">
            {loading ? <div className="emp-skeleton">Loading…</div> : (
              <ul className="collection emp-list">
                {filtered.map(u => {
                  const name  = safeStr(u.employee_name) || safeStr(u.username) || "—";
                  const title = safeStr(u.employee_title) || "—";
                  const dept  = safeStr((u as any).department) || "—";
                  const loc   = safeStr((u as any).location) || "";
                  const email = safeStr(u.employee_email) || "";
                  const empId = safeStr((u as any).employee_id) || "";
                  const role  = roleLower(u);
                  const userKey   = safeStr(u.username) || safeStr(u.employee_email) || name;
                  const avatarUrl = safeStr((u as any).employee_profilepicture) || safeStr((u as any).employee_picture);
                  const avatarBroken = !!brokenAvatarKeys[userKey];
                  const revoked = readBool((u as any).revoked, false);
                  const portalAccess  = readBool((u as any).portal_access, true);
                  const projectAccess = readBool((u as any).project_access, true);
                  const vcsAccess     = readBool((u as any).version_control_access, false);
                  const missingAccess = !portalAccess || !projectAccess || !vcsAccess;
                  const dotColor = revoked ? "#ef4444" : missingAccess ? "#f59e0b" : "#22c55e";
                  const badgeClass = role.startsWith("super") ? "emp-badge emp-badge--super"
                    : role.startsWith("admin") ? "emp-badge emp-badge--admin"
                    : "emp-badge emp-badge--employee";

                  return (
                    <li className="collection-item emp-item" key={u.username}>
                      <div className="emp-avatarBox" title={name}>
                        {avatarUrl && !avatarBroken
                          ? <img src={avatarUrl} alt="" onError={() => setBrokenAvatarKeys(p => ({ ...p, [userKey]: true }))} />
                          : <span className="emp-avatarInitials">{initials(name)}</span>
                        }
                        <span className="emp-dot" title={revoked ? "Revoked" : missingAccess ? "Access missing" : "Active"} style={{ background: dotColor }} />
                      </div>

                      <div className="emp-meta">
                        <div className="emp-nameRow">
                          <div className="emp-name" title={name}>{name}</div>
                          <div className="emp-badges">
                            <span className={badgeClass}>
                              <i className="material-icons">verified_user</i>
                              {role.toUpperCase()}
                            </span>
                            {empId && <span className="emp-badge emp-badge--id"><i className="material-icons">badge</i>{empId}</span>}
                          </div>
                        </div>
                        <div className="emp-lines">
                          <span>{title}</span><span className="sep">•</span><span>{dept}</span>
                          {loc && <><span className="sep">•</span>
                            <span><i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 3, opacity: 0.8 }}>location_on</i>{loc}</span>
                          </>}
                        </div>
                        {email && <div className="emp-email">
                          <i className="material-icons" style={{ fontSize: 15, verticalAlign: "middle", marginRight: 3, opacity: 0.7 }}>alternate_email</i>{email}
                        </div>}
                      </div>
                    </li>
                  );
                })}
                {!filtered.length && <li className="collection-item center grey-text" style={{ padding: "16px 14px" }}>No results</li>}
              </ul>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
