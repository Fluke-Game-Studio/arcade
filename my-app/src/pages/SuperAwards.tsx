import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AwardsStudioNarrative from "../components/AwardsStudioNarrative";
import type {
  ApiAwardRuleAchievement,
  ApiAwardRuleTrophy,
} from "../api";
import type { ApiUser } from "../api";

declare const M: any;

type AchievementRuleForm = {
  id: string;
  title: string;
  description: string;
  metric: string;
  threshold: string;
};

type TrophyRuleForm = {
  id: string;
  title: string;
  description: string;
  tier: string;
  achievementThreshold: string;
};

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatTierLabel(v: string) {
  const s = safeStr(v).replace(/[_-]+/g, " ");
  if (!s) return "";
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function initials(name: string) {
  const parts = safeStr(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function roleBadgeClass(role?: string) {
  const r = safeStr(role).toLowerCase();
  if (r === "super") return "emp-badge emp-badge--super";
  if (r === "admin") return "emp-badge emp-badge--admin";
  return "emp-badge emp-badge--employee";
}

function CountCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 16,
        padding: 14,
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 950 }}>{value}</div>
    </div>
  );
}

function emptyAchievementRuleForm(): AchievementRuleForm {
  return {
    id: "",
    title: "",
    description: "",
    metric: "",
    threshold: "",
  };
}

function emptyTrophyRuleForm(): TrophyRuleForm {
  return {
    id: "",
    title: "",
    description: "",
    tier: "",
    achievementThreshold: "",
  };
}

export default function SuperAwards() {
  const { api, user } = useAuth();

  const [rows, setRows] = useState<ApiUser[]>([]);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [query, setQuery] = useState("");

  const [loadingUsers, setLoadingUsers] = useState(false);

  const [achievementRules, setAchievementRules] = useState<ApiAwardRuleAchievement[]>([]);
  const [trophyRules, setTrophyRules] = useState<ApiAwardRuleTrophy[]>([]);

  const [achievementId, setAchievementId] = useState("");
  const [achievementTitle, setAchievementTitle] = useState("");
  const [achievementDescription, setAchievementDescription] = useState("");

  const [trophyId, setTrophyId] = useState("");
  const [trophyTitle, setTrophyTitle] = useState("");
  const [trophyDescription, setTrophyDescription] = useState("");
  const [trophyTier, setTrophyTier] = useState("");

  const [mvpWeekStart, setMvpWeekStart] = useState("");
  const [mvpScore, setMvpScore] = useState("");
  const [mvpNotes, setMvpNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const [achievementRuleForm, setAchievementRuleForm] = useState<AchievementRuleForm>(
    emptyAchievementRuleForm()
  );
  const [trophyRuleForm, setTrophyRuleForm] = useState<TrophyRuleForm>(emptyTrophyRuleForm());
  const [editingAchievementRuleId, setEditingAchievementRuleId] = useState("");
  const [editingTrophyRuleId, setEditingTrophyRuleId] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [rulesQuery, setRulesQuery] = useState("");

  const isSuperOrAdmin =
    safeStr((user as any)?.role).toLowerCase() === "super" ||
    safeStr((user as any)?.role).toLowerCase() === "admin";

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const data = await api.getUsers();
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      if (!selectedUsername && list[0]?.username) {
        setSelectedUsername(list[0].username);
      }
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to load users", classes: "red" });
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadRules() {
    try {
      const [ach, tro] = await Promise.all([
        api.getAwardAchievementRules(),
        api.getAwardTrophyRules(),
      ]);
      setAchievementRules(Array.isArray(ach) ? ach : []);
      setTrophyRules(Array.isArray(tro) ? tro : []);
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to load award rules", classes: "red" });
    }
  }

  useEffect(() => {
    loadUsers();
    loadRules();
  }, []);

  useEffect(() => {
    if (typeof M !== "undefined") {
      try {
        M.Collapsible.init(document.querySelectorAll(".collapsible"), { accordion: false });
      } catch {}
    }
  }, [achievementRules, trophyRules, editingAchievementRuleId, editingTrophyRuleId]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((u) => {
      const username = safeStr((u as any).username).toLowerCase();
      const name = safeStr((u as any).employee_name || (u as any).name || username).toLowerCase();
      const email = safeStr((u as any).employee_email || (u as any).email).toLowerCase();
      return username.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [rows, query]);

  const filteredAchievementRules = useMemo(() => {
    const q = rulesQuery.trim().toLowerCase();
    if (!q) return achievementRules;
    return achievementRules.filter((r) => {
      return (
        safeStr((r as any).id).toLowerCase().includes(q) ||
        safeStr((r as any).title).toLowerCase().includes(q) ||
        safeStr((r as any).description).toLowerCase().includes(q) ||
        safeStr((r as any).metric).toLowerCase().includes(q)
      );
    });
  }, [achievementRules, rulesQuery]);

  const filteredTrophyRules = useMemo(() => {
    const q = rulesQuery.trim().toLowerCase();
    if (!q) return trophyRules;
    return (
      trophyRules.filter((r) => {
        return (
          safeStr((r as any).id).toLowerCase().includes(q) ||
          safeStr((r as any).title).toLowerCase().includes(q) ||
          safeStr((r as any).description).toLowerCase().includes(q) ||
          safeStr((r as any).tier).toLowerCase().includes(q)
        );
      }) || []
    );
  }, [trophyRules, rulesQuery]);

  const trophyTierOptions = useMemo(() => {
    const seen = new Set<string>();

    trophyRules.forEach((r) => {
      const tier = safeStr((r as any).tier).toLowerCase();
      if (tier) seen.add(tier);
    });

    const activeFormTier = safeStr(trophyRuleForm.tier).toLowerCase();
    const activeAwardTier = safeStr(trophyTier).toLowerCase();

    if (activeFormTier) seen.add(activeFormTier);
    if (activeAwardTier) seen.add(activeAwardTier);

    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [trophyRules, trophyRuleForm.tier, trophyTier]);

  const selectedUser = useMemo(
    () => rows.find((u) => safeStr((u as any).username) === selectedUsername) || null,
    [rows, selectedUsername]
  );

  function onAchievementRuleChange(nextId: string) {
    setAchievementId(nextId);
    const rule = achievementRules.find((x) => safeStr((x as any).id) === safeStr(nextId));
    setAchievementTitle((rule as any)?.title || "");
    setAchievementDescription((rule as any)?.description || "");
  }

  function onTrophyRuleChange(nextId: string) {
    setTrophyId(nextId);
    const rule = trophyRules.find((x) => safeStr((x as any).id) === safeStr(nextId));
    setTrophyTitle((rule as any)?.title || "");
    setTrophyDescription((rule as any)?.description || "");
    setTrophyTier(safeStr((rule as any)?.tier).toLowerCase());
  }

  async function handleAwardAchievement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUsername || !achievementId) {
      M.toast({ html: "Select employee and achievement", classes: "red" });
      return;
    }

    setSaving(true);
    try {
      await api.awardAchievement({
        username: selectedUsername,
        achievementId,
        title: safeStr(achievementTitle) || undefined,
        description: safeStr(achievementDescription) || undefined,
      });

      M.toast({ html: "Achievement awarded", classes: "green" });
      setAchievementId("");
      setAchievementTitle("");
      setAchievementDescription("");
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to award achievement", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleAwardTrophy(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUsername || !trophyId) {
      M.toast({ html: "Select employee and trophy", classes: "red" });
      return;
    }

    setSaving(true);
    try {
      await api.awardTrophy({
        username: selectedUsername,
        trophyId,
        title: safeStr(trophyTitle) || undefined,
        description: safeStr(trophyDescription) || undefined,
        tier: safeStr(trophyTier).toLowerCase() || undefined,
      });

      M.toast({ html: "Trophy awarded", classes: "green" });
      setTrophyId("");
      setTrophyTitle("");
      setTrophyDescription("");
      setTrophyTier("");
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to award trophy", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleWeeklyMvp(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUsername || !mvpWeekStart) {
      M.toast({ html: "Week start and employee required", classes: "red" });
      return;
    }

    setSaving(true);
    try {
      await api.setWeeklyMvpManual({
        weekStart: mvpWeekStart,
        username: selectedUsername,
        score: safeNum(mvpScore) || undefined,
        notes: safeStr(mvpNotes) || undefined,
      });

      M.toast({ html: "Weekly MVP assigned", classes: "green" });
      setMvpScore("");
      setMvpNotes("");
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to set weekly MVP", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  function startEditAchievementRule(rule: ApiAwardRuleAchievement) {
    setEditingAchievementRuleId(safeStr((rule as any).id));
    setAchievementRuleForm({
      id: safeStr((rule as any).id),
      title: safeStr((rule as any).title),
      description: safeStr((rule as any).description),
      metric: safeStr((rule as any).metric),
      threshold: String((rule as any).threshold ?? ""),
    });
  }

  function startEditTrophyRule(rule: ApiAwardRuleTrophy) {
    setEditingTrophyRuleId(safeStr((rule as any).id));
    setTrophyRuleForm({
      id: safeStr((rule as any).id),
      title: safeStr((rule as any).title),
      description: safeStr((rule as any).description),
      tier: safeStr((rule as any).tier).toLowerCase(),
      achievementThreshold: String((rule as any).achievementThreshold ?? ""),
    });
  }

  function resetAchievementRuleEditor() {
    setEditingAchievementRuleId("");
    setAchievementRuleForm(emptyAchievementRuleForm());
  }

  function resetTrophyRuleEditor() {
    setEditingTrophyRuleId("");
    setTrophyRuleForm(emptyTrophyRuleForm());
  }

  async function handleSaveAchievementRule(e: React.FormEvent) {
    e.preventDefault();

    if (
      !safeStr(achievementRuleForm.id) ||
      !safeStr(achievementRuleForm.title) ||
      !safeStr(achievementRuleForm.metric) ||
      !safeStr(achievementRuleForm.threshold)
    ) {
      M.toast({ html: "Achievement rule fields are required", classes: "red" });
      return;
    }

    setSavingRule(true);
    try {
      const payload = {
        id: safeStr(achievementRuleForm.id),
        title: safeStr(achievementRuleForm.title),
        description: safeStr(achievementRuleForm.description),
        metric: safeStr(achievementRuleForm.metric),
        threshold: safeNum(achievementRuleForm.threshold),
      };

      if (editingAchievementRuleId) {
        await (api as any).updateAwardAchievementRule(editingAchievementRuleId, payload);
        M.toast({ html: "Achievement rule updated", classes: "green" });
      } else {
        await (api as any).createAwardAchievementRule(payload);
        M.toast({ html: "Achievement rule created", classes: "green" });
      }

      resetAchievementRuleEditor();
      await loadRules();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to save achievement rule", classes: "red" });
    } finally {
      setSavingRule(false);
    }
  }

  async function handleSaveTrophyRule(e: React.FormEvent) {
    e.preventDefault();

    if (
      !safeStr(trophyRuleForm.id) ||
      !safeStr(trophyRuleForm.title) ||
      !safeStr(trophyRuleForm.achievementThreshold)
    ) {
      M.toast({ html: "Trophy rule fields are required", classes: "red" });
      return;
    }

    setSavingRule(true);
    try {
      const payload = {
        id: safeStr(trophyRuleForm.id),
        title: safeStr(trophyRuleForm.title),
        description: safeStr(trophyRuleForm.description),
        tier: safeStr(trophyRuleForm.tier).toLowerCase() || undefined,
        achievementThreshold: safeNum(trophyRuleForm.achievementThreshold),
      };

      if (editingTrophyRuleId) {
        await (api as any).updateAwardTrophyRule(editingTrophyRuleId, payload);
        M.toast({ html: "Trophy rule updated", classes: "green" });
      } else {
        await (api as any).createAwardTrophyRule(payload);
        M.toast({ html: "Trophy rule created", classes: "green" });
      }

      resetTrophyRuleEditor();
      await loadRules();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to save trophy rule", classes: "red" });
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteAchievementRule(ruleId: string) {
    const id = safeStr(ruleId);
    if (!id) return;
    if (!window.confirm(`Delete achievement rule "${id}"?`)) return;

    setSavingRule(true);
    try {
      await (api as any).deleteAwardAchievementRule(id);
      M.toast({ html: "Achievement rule deleted", classes: "green" });
      if (editingAchievementRuleId === id) resetAchievementRuleEditor();
      await loadRules();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to delete achievement rule", classes: "red" });
    } finally {
      setSavingRule(false);
    }
  }

  async function handleDeleteTrophyRule(ruleId: string) {
    const id = safeStr(ruleId);
    if (!id) return;
    if (!window.confirm(`Delete trophy rule "${id}"?`)) return;

    setSavingRule(true);
    try {
      await (api as any).deleteAwardTrophyRule(id);
      M.toast({ html: "Trophy rule deleted", classes: "green" });
      if (editingTrophyRuleId === id) resetTrophyRuleEditor();
      await loadRules();
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to delete trophy rule", classes: "red" });
    } finally {
      setSavingRule(false);
    }
  }

  if (!isSuperOrAdmin) {
    return (
      <main className="container" style={{ paddingTop: 24 }}>
        <div className="card">
          <div className="card-content">
            <span className="card-title">Awards Console</span>
            <p>Forbidden.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="container" style={{ paddingTop: 22, maxWidth: 1080 }}>
      <style>{`
        .accHero {
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.22);
          background:
            radial-gradient(900px 520px at 18% -30%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(800px 520px at 105% 10%, rgba(99,102,241,0.18), transparent 55%),
            linear-gradient(180deg, #0b2544 0%, #071a33 100%);
          box-shadow: 0 22px 70px rgba(0,0,0,0.26);
          position: relative;
          margin-bottom: 14px;
        }
        .accHeroInner{
          padding: 16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          color: white;
          flex-wrap:wrap;
        }
        .accMiniProfile{
          display:flex;
          align-items:center;
          gap: 14px;
          min-width: 0;
        }
        .accAvatar{
          width: 92px; height: 92px;
          border-radius: 26px;
          overflow:hidden;
          border: 2px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.10);
          box-shadow: 0 16px 28px rgba(0,0,0,0.22);
          display:grid;
          place-items:center;
          font-weight: 900;
          letter-spacing: .6px;
          position: relative;
          flex: 0 0 auto;
        }
        .accDot{
          position:absolute;
          right: 10px; bottom: 10px;
          width: 12px; height: 12px;
          border-radius: 999px;
          background:#22c55e;
          border: 2px solid rgba(7,26,51,0.92);
        }
        .accTitle{
          font-weight: 1000;
          font-size: 18px;
          line-height: 22px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .accSub{
          margin-top: 4px;
          color: rgba(226,232,240,0.82);
          font-size: 12.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .panelCard{ border-radius: 20px; overflow: hidden; border: 1px solid #e6edf2; }
        .panelHead{
          padding: 14px 16px;
          border-bottom: 1px solid #eceff1;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
        }
        .panelHead .h{ font-weight: 1000; color: #0f172a; font-size: 14.5px; }
        .panelHead .p{ margin-top: 2px; color:#607d8b; font-size: 12px; }

        .emp-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 26px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 950;
          letter-spacing: 0.3px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.08);
          color: #fff;
          white-space: nowrap;
        }
        .emp-badge--super {
          background: rgba(37, 99, 235, 0.14);
          border-color: rgba(37, 99, 235, 0.22);
          color: #dbeafe;
        }
        .emp-badge--admin {
          background: rgba(245, 158, 11, 0.14);
          border-color: rgba(245, 158, 11, 0.22);
          color: #fef3c7;
        }
        .emp-badge--employee {
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(34, 197, 94, 0.22);
          color: #dcfce7;
        }

        .accControlGrid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:16px;
        }
        .rulesGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap:16px;
        }
        .rulesList{
          display:grid;
          gap:12px;
        }
        .ruleRow{
          border:1px solid #e3edf4;
          border-radius:16px;
          padding:14px;
          background:#fff;
          box-shadow:0 10px 28px rgba(15,23,42,0.05);
        }
        .ruleTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
        }
        .ruleMeta{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-top:10px;
        }
        .rulePill{
          display:inline-flex;
          align-items:center;
          padding:6px 10px;
          border-radius:999px;
          font-size:12px;
          font-weight:900;
          border:1px solid #dce8f0;
          background:#f8fbfd;
          color:#405261;
        }
        .ruleActions{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .hintText{
          font-size: 12px;
          color: #607d8b;
          margin-top: -2px;
          margin-bottom: 8px;
        }

        @media (max-width: 960px){
          .accControlGrid{ grid-template-columns: 1fr; }
          .rulesGrid{ grid-template-columns: 1fr; }
        }

        .input-field { margin: 0.2rem 0 0.6rem !important; }
        input:focus, textarea:focus { box-shadow: none !important; }
      `}</style>

      <div className="accHero">
        <div className="accHeroInner">
          <div className="accMiniProfile">
            <div className="accAvatar">
              {initials(
                safeStr((selectedUser as any)?.employee_name || (selectedUser as any)?.username || "FG")
              )}
              <span className="accDot" />
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="accTitle">
                {safeStr((selectedUser as any)?.employee_name || "Select employee")}
              </div>
              <div className="accSub">
                {safeStr((selectedUser as any)?.employee_email || "")}
              </div>
              {!!selectedUser && (
                <div style={{ marginTop: 8 }}>
                  <span className={roleBadgeClass(safeStr((selectedUser as any)?.employee_role))}>
                    {safeStr((selectedUser as any)?.employee_role || "employee").toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <CountCard label="Achievement Rules" value={achievementRules.length} />
            <CountCard label="Trophy Rules" value={trophyRules.length} />
            <CountCard label="Employees" value={rows.length} />
          </div>
        </div>
      </div>

      <div className="card z-depth-1 panelCard">
        <div className="panelHead">
          <div>
            <div className="h">Award Controls</div>
            <div className="p">Select one employee and award achievements, trophies, or weekly MVP.</div>
          </div>
        </div>

        <div className="card-content" style={{ padding: 16 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <div className="col s12 m8">
              <div className="input-field" style={{ marginTop: 0 }}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee by name, email, or username"
                />
                <label className="active">Search employee</label>
              </div>
            </div>
            <div className="col s12 m4">
              <div className="input-field" style={{ marginTop: 0 }}>
                <select
                  className="browser-default"
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                >
                  <option value="">Select employee</option>
                  {filteredUsers.map((u) => (
                    <option key={u.username} value={u.username}>
                      {safeStr((u as any).employee_name || u.username)} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="accControlGrid">
            <div className="card" style={{ margin: 0 }}>
              <div className="card-content">
                <span className="card-title">Award Achievement</span>

                <form onSubmit={handleAwardAchievement}>
                  <div className="input-field">
                    <select
                      className="browser-default"
                      value={achievementId}
                      onChange={(e) => onAchievementRuleChange(e.target.value)}
                    >
                      <option value="">Select achievement rule</option>
                      {achievementRules.map((r) => (
                        <option key={(r as any).id} value={(r as any).id}>
                          {(r as any).title} ({(r as any).id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-field">
                    <input
                      value={achievementTitle}
                      onChange={(e) => setAchievementTitle(e.target.value)}
                    />
                    <label className="active">Title override</label>
                  </div>

                  <div className="input-field">
                    <textarea
                      className="materialize-textarea"
                      value={achievementDescription}
                      onChange={(e) => setAchievementDescription(e.target.value)}
                    />
                    <label className="active">Description override</label>
                  </div>

                  <button className="btn" type="submit" disabled={saving || !selectedUsername}>
                    {saving ? "Saving..." : "Award Achievement"}
                  </button>
                </form>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-content">
                <span className="card-title">Award Trophy</span>

                <form onSubmit={handleAwardTrophy}>
                  <div className="input-field">
                    <select
                      className="browser-default"
                      value={trophyId}
                      onChange={(e) => onTrophyRuleChange(e.target.value)}
                    >
                      <option value="">Select trophy rule</option>
                      {trophyRules.map((r) => (
                        <option key={(r as any).id} value={(r as any).id}>
                          {(r as any).title} ({(r as any).id})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-field">
                    <input value={trophyTitle} onChange={(e) => setTrophyTitle(e.target.value)} />
                    <label className="active">Title override</label>
                  </div>

                  <div className="input-field">
                    <textarea
                      className="materialize-textarea"
                      value={trophyDescription}
                      onChange={(e) => setTrophyDescription(e.target.value)}
                    />
                    <label className="active">Description override</label>
                  </div>

                  <div className="input-field">
                    <input
                      list="award-trophy-tier-options"
                      value={trophyTier}
                      onChange={(e) => setTrophyTier(e.target.value)}
                      placeholder="Type or select a trophy tier"
                    />
                    <label className="active">Tier</label>
                    <datalist id="award-trophy-tier-options">
                      {trophyTierOptions.map((tier) => (
                        <option key={tier} value={tier}>
                          {formatTierLabel(tier)}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  <div className="hintText">
                    Existing trophy tiers appear automatically. You can also type a new one.
                  </div>

                  <button className="btn" type="submit" disabled={saving || !selectedUsername}>
                    {saving ? "Saving..." : "Award Trophy"}
                  </button>
                </form>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-content">
                <span className="card-title">Assign Weekly MVP</span>

                <form onSubmit={handleWeeklyMvp}>
                  <div className="input-field">
                    <input
                      type="date"
                      value={mvpWeekStart}
                      onChange={(e) => setMvpWeekStart(e.target.value)}
                    />
                    <label className="active">Week Start</label>
                  </div>

                  <div className="input-field">
                    <input
                      type="number"
                      value={mvpScore}
                      onChange={(e) => setMvpScore(e.target.value)}
                    />
                    <label className="active">Score</label>
                  </div>

                  <div className="input-field">
                    <textarea
                      className="materialize-textarea"
                      value={mvpNotes}
                      onChange={(e) => setMvpNotes(e.target.value)}
                    />
                    <label className="active">Notes</label>
                  </div>

                  <button className="btn" type="submit" disabled={saving || !selectedUsername}>
                    {saving ? "Saving..." : "Set Weekly MVP"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ul className="collapsible popout">
        <li className="active">
          <div className="collapsible-header">
            <i className="material-icons">rule</i>
            Manage Rules
          </div>

          <div className="collapsible-body">
            <div className="input-field" style={{ marginTop: 0, marginBottom: 16 }}>
              <input
                value={rulesQuery}
                onChange={(e) => setRulesQuery(e.target.value)}
                placeholder="Search rules by id, title, metric, or tier"
              />
              <label className="active">Search rules</label>
            </div>

            <div className="rulesGrid">
              <div className="card" style={{ margin: 0 }}>
                <div className="card-content">
                  <span className="card-title">
                    {editingAchievementRuleId ? "Edit Achievement Rule" : "Add Achievement Rule"}
                  </span>

                  <form onSubmit={handleSaveAchievementRule}>
                    <div className="input-field">
                      <input
                        value={achievementRuleForm.id}
                        onChange={(e) =>
                          setAchievementRuleForm((prev) => ({ ...prev, id: e.target.value }))
                        }
                        disabled={!!editingAchievementRuleId}
                      />
                      <label className="active">Rule ID</label>
                    </div>

                    <div className="input-field">
                      <input
                        value={achievementRuleForm.title}
                        onChange={(e) =>
                          setAchievementRuleForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                      <label className="active">Title</label>
                    </div>

                    <div className="input-field">
                      <input
                        value={achievementRuleForm.metric}
                        onChange={(e) =>
                          setAchievementRuleForm((prev) => ({ ...prev, metric: e.target.value }))
                        }
                      />
                      <label className="active">Metric</label>
                    </div>

                    <div className="input-field">
                      <input
                        type="number"
                        value={achievementRuleForm.threshold}
                        onChange={(e) =>
                          setAchievementRuleForm((prev) => ({
                            ...prev,
                            threshold: e.target.value,
                          }))
                        }
                      />
                      <label className="active">Threshold</label>
                    </div>

                    <div className="input-field">
                      <textarea
                        className="materialize-textarea"
                        value={achievementRuleForm.description}
                        onChange={(e) =>
                          setAchievementRuleForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                      <label className="active">Description</label>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" type="submit" disabled={savingRule}>
                        {savingRule
                          ? "Saving..."
                          : editingAchievementRuleId
                          ? "Update Rule"
                          : "Create Rule"}
                      </button>

                      {(editingAchievementRuleId || achievementRuleForm.id) && (
                        <button
                          className="btn-flat"
                          type="button"
                          onClick={resetAchievementRuleEditor}
                          disabled={savingRule}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              <div className="card" style={{ margin: 0 }}>
                <div className="card-content">
                  <span className="card-title">
                    {editingTrophyRuleId ? "Edit Trophy Rule" : "Add Trophy Rule"}
                  </span>

                  <form onSubmit={handleSaveTrophyRule}>
                    <div className="input-field">
                      <input
                        value={trophyRuleForm.id}
                        onChange={(e) =>
                          setTrophyRuleForm((prev) => ({ ...prev, id: e.target.value }))
                        }
                        disabled={!!editingTrophyRuleId}
                      />
                      <label className="active">Rule ID</label>
                    </div>

                    <div className="input-field">
                      <input
                        value={trophyRuleForm.title}
                        onChange={(e) =>
                          setTrophyRuleForm((prev) => ({ ...prev, title: e.target.value }))
                        }
                      />
                      <label className="active">Title</label>
                    </div>

                    <div className="input-field">
                      <input
                        list="rule-trophy-tier-options"
                        value={trophyRuleForm.tier}
                        onChange={(e) =>
                          setTrophyRuleForm((prev) => ({ ...prev, tier: e.target.value }))
                        }
                        placeholder="Type or select a trophy tier"
                      />
                      <label className="active">Tier</label>
                      <datalist id="rule-trophy-tier-options">
                        {trophyTierOptions.map((tier) => (
                          <option key={tier} value={tier}>
                            {formatTierLabel(tier)}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div className="hintText">
                      Existing tiers come from rule data. Typing a new tier will persist it with the rule.
                    </div>

                    <div className="input-field">
                      <input
                        type="number"
                        value={trophyRuleForm.achievementThreshold}
                        onChange={(e) =>
                          setTrophyRuleForm((prev) => ({
                            ...prev,
                            achievementThreshold: e.target.value,
                          }))
                        }
                      />
                      <label className="active">Achievement Threshold</label>
                    </div>

                    <div className="input-field">
                      <textarea
                        className="materialize-textarea"
                        value={trophyRuleForm.description}
                        onChange={(e) =>
                          setTrophyRuleForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                      />
                      <label className="active">Description</label>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" type="submit" disabled={savingRule}>
                        {savingRule
                          ? "Saving..."
                          : editingTrophyRuleId
                          ? "Update Rule"
                          : "Create Rule"}
                      </button>

                      {(editingTrophyRuleId || trophyRuleForm.id) && (
                        <button
                          className="btn-flat"
                          type="button"
                          onClick={resetTrophyRuleEditor}
                          disabled={savingRule}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>

            <div className="rulesGrid" style={{ marginTop: 16 }}>
              <div className="card" style={{ margin: 0 }}>
                <div className="card-content">
                  <span className="card-title">Achievement Rules</span>

                  <div className="rulesList">
                    {filteredAchievementRules.length ? (
                      filteredAchievementRules.map((rule) => (
                        <div key={safeStr((rule as any).id)} className="ruleRow">
                          <div className="ruleTop">
                            <div>
                              <div style={{ fontWeight: 950, fontSize: 16, color: "#1f2d3a" }}>
                                {safeStr((rule as any).title)}
                              </div>
                              <div style={{ color: "#607d8b", fontWeight: 800, marginTop: 4 }}>
                                {safeStr((rule as any).id)}
                              </div>
                              {!!safeStr((rule as any).description) && (
                                <div style={{ marginTop: 8, color: "#516270" }}>
                                  {safeStr((rule as any).description)}
                                </div>
                              )}
                            </div>

                            <div className="ruleActions">
                              <button
                                type="button"
                                className="btn-flat"
                                onClick={() => startEditAchievementRule(rule)}
                                disabled={savingRule}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-flat red-text"
                                onClick={() => handleDeleteAchievementRule(safeStr((rule as any).id))}
                                disabled={savingRule}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="ruleMeta">
                            <span className="rulePill">Metric: {safeStr((rule as any).metric)}</span>
                            <span className="rulePill">
                              Threshold: {safeNum((rule as any).threshold)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="grey-text">No achievement rules found.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="card" style={{ margin: 0 }}>
                <div className="card-content">
                  <span className="card-title">Trophy Rules</span>

                  <div className="rulesList">
                    {filteredTrophyRules.length ? (
                      filteredTrophyRules.map((rule) => (
                        <div key={safeStr((rule as any).id)} className="ruleRow">
                          <div className="ruleTop">
                            <div>
                              <div style={{ fontWeight: 950, fontSize: 16, color: "#1f2d3a" }}>
                                {safeStr((rule as any).title)}
                              </div>
                              <div style={{ color: "#607d8b", fontWeight: 800, marginTop: 4 }}>
                                {safeStr((rule as any).id)}
                              </div>
                              {!!safeStr((rule as any).description) && (
                                <div style={{ marginTop: 8, color: "#516270" }}>
                                  {safeStr((rule as any).description)}
                                </div>
                              )}
                            </div>

                            <div className="ruleActions">
                              <button
                                type="button"
                                className="btn-flat"
                                onClick={() => startEditTrophyRule(rule)}
                                disabled={savingRule}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-flat red-text"
                                onClick={() => handleDeleteTrophyRule(safeStr((rule as any).id))}
                                disabled={savingRule}
                              >
                                Delete
                              </button>
                            </div>
                          </div>

                          <div className="ruleMeta">
                            <span className="rulePill">Tier: {formatTierLabel(safeStr((rule as any).tier))}</span>
                            <span className="rulePill">
                              Achievement Threshold: {safeNum((rule as any).achievementThreshold)}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="grey-text">No trophy rules found.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </li>

        <li>
          <div className="collapsible-header">
            <i className="material-icons">auto_awesome</i>
            Studio Narrative
          </div>

          <div className="collapsible-body">
            <AwardsStudioNarrative api={api} username={selectedUsername} />
          </div>
        </li>
      </ul>
    </main>
  );
}