import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import FgcAmount from "../credits/FgcAmount";
import FrozenFgcAmount from "../credits/FrozenFgcAmount";
import { getWalletStateMeta } from "../wallet/walletState";
import type { ApiUser, ApiWallet } from "../../api";

declare const M: any;

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function makeTxId(prefix: string) {
  const suffix =
    typeof globalThis !== "undefined" &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

export default function SuperWalletTab() {
  const { api } = useAuth();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");
  const [amountFgc, setAmountFgc] = useState("");
  const [reason, setReason] = useState("");
  const [creditType, setCreditType] = useState<"spendable" | "frozen">("spendable");
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [activatingWallet, setActivatingWallet] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [wallet, setWallet] = useState<ApiWallet | null>(null);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const list = await api.getUsers();
      setUsers(Array.isArray(list) ? list : []);
      if (!selectedUsername && Array.isArray(list) && list[0]?.username) {
        setSelectedUsername(safeStr(list[0].username));
      }
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to load employees", classes: "red" });
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const username = safeStr(u.username).toLowerCase();
      const name = safeStr(u.employee_name || u.name || u.username).toLowerCase();
      const email = safeStr(u.employee_email || u.email).toLowerCase();
      return username.includes(q) || name.includes(q) || email.includes(q);
    });
  }, [users, query]);

  const selectedUser = useMemo(
    () => users.find((u) => safeStr(u.username) === selectedUsername) || null,
    [users, selectedUsername]
  );
  const walletStateMeta = useMemo(() => getWalletStateMeta(wallet), [wallet]);
  const canActivateWallet = walletStateMeta.state === "missing" || walletStateMeta.state === "dormant";

  function normalizeWalletResponse(resp: any): ApiWallet | null {
    const candidates = [
      resp?.wallet,
      resp?.item,
      resp?.record,
      resp?.data?.wallet,
      resp?.data?.item,
      resp?.data?.record,
      resp?.data,
      resp,
    ];

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object") continue;
      if (
        "wallet_id" in candidate ||
        "balance_cents" in candidate ||
        "frozen_balance_cents" in candidate ||
        "status" in candidate ||
        "wallet_state" in candidate
      ) {
        return candidate as ApiWallet;
      }
    }
    return null;
  }

  async function loadSelectedWallet(user: ApiUser | null) {
    const candidates = Array.from(
      new Set(
        [
          safeStr(user?.username),
          safeStr(user?.employee_email),
          safeStr(user?.email),
          safeStr((user as any)?.employeeEmail),
          safeStr((user as any)?.employee_name),
          safeStr((user as any)?.employeeName),
          safeStr((user as any)?.employee_id),
          safeStr((user as any)?.employeeId),
          safeStr((user as any)?.wallet_id),
          safeStr((user as any)?.walletId),
          safeStr((user as any)?.userId),
        ].filter(Boolean)
      )
    );

    if (!candidates.length) {
      setWallet(null);
      return;
    }

    setWalletLoading(true);
    try {
      for (const candidate of candidates) {
        try {
          const resp = await api.getAdminWallet(candidate);
          const resolvedWallet = normalizeWalletResponse(resp);
          if (resolvedWallet) {
            setWallet(resolvedWallet);
            return;
          }
        } catch (err) {
          if (candidate !== candidates[candidates.length - 1]) continue;
          throw err;
        }
      }
      setWallet(null);
    } catch (err: any) {
      setWallet(null);
      M?.toast?.({ html: err?.message || "Failed to load wallet", classes: "red" });
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedUsername) {
      setWallet(null);
      return;
    }
    void loadSelectedWallet(selectedUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUsername, selectedUser]);

  async function handleCredit(e: FormEvent, direction: 1 | -1 = 1) {
    e.preventDefault();
    const username = safeStr(selectedUsername);
    const credits = Number(amountFgc);

    if (!username) {
      M?.toast?.({ html: "Select an employee", classes: "red" });
      return;
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      M?.toast?.({ html: "Enter a credit amount greater than zero", classes: "red" });
      return;
    }

    setSaving(true);
    try {
      const transactionId = makeTxId(`${direction < 0 ? "wallet-remove" : "wallet-credit"}-${username}`);
      const resp = await api.creditWallet({
        username,
        amount_cents: Math.round(credits * 100) * direction,
        reason: safeStr(reason) || (direction < 0 ? "Wallet deduction" : ""),
        transaction_id: transactionId,
        credit_type: creditType,
      });
      setWallet(normalizeWalletResponse(resp));
      M?.toast?.({
        html:
          direction < 0
            ? `Removed ${credits.toFixed(2)} FGC from ${username}`
            : `Granted ${credits.toFixed(2)} FGC to ${username}`,
        classes: "green",
      });
      setAmountFgc("");
      setReason("");
      void loadSelectedWallet(selectedUser);
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to update wallet", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateWallet() {
    const username = safeStr(selectedUsername);
    if (!username) {
      M?.toast?.({ html: "Select an employee", classes: "red" });
      return;
    }
    if (!canActivateWallet) {
      M?.toast?.({ html: "Wallet is already active", classes: "blue" });
      return;
    }

    setActivatingWallet(true);
    try {
      const resp = await api.activateWallet({
        username,
        reason: safeStr(reason) || "Manual wallet activation",
      });
      setWallet(normalizeWalletResponse(resp));
      M?.toast?.({
        html: `Activated wallet for ${username}`,
        classes: "green",
      });
      void loadSelectedWallet(selectedUser);
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to activate wallet", classes: "red" });
    } finally {
      setActivatingWallet(false);
    }
  }

  async function rewardAllActiveMembers() {
    const credits = Number(amountFgc);
    if (!Number.isFinite(credits) || credits <= 0) {
      M?.toast?.({ html: "Enter a credit amount greater than zero", classes: "red" });
      return;
    }

    const confirmed = window.confirm(`Reward every active employee ${credits.toFixed(2)} FGC?`);
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const batchId = makeTxId("wallet-bulk-reward");
      const resp = await api.rewardAllActiveMembers({
        amount_cents: Math.round(credits * 100),
        reason: safeStr(reason) || "Team reward",
        transaction_id: batchId,
      });
      M?.toast?.({
        html: `Rewarded ${resp.rewarded} active employee(s).${resp.skipped ? ` Skipped ${resp.skipped}.` : ""}`,
        classes: "green",
      });
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to reward all members", classes: "red" });
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="suCard">
      <div className="card-content">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>Wallet Credits</div>
            <div style={{ color: "#475569" }}>
              Grant Fluke Game Credits to any employee from the super console.
            </div>
          </div>
          <button type="button" className="btn-flat" onClick={() => void loadUsers()} disabled={loadingUsers}>
            {loadingUsers ? "Loading..." : "Refresh employees"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(320px, 1.2fr)", gap: 16, marginTop: 16 }}>
          <div style={{ border: "1px solid #e6edf2", borderRadius: 18, padding: 14, background: "#fbfdff" }}>
            <div className="input-field" style={{ marginTop: 0 }}>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" />
              <label className="active">Search employees</label>
            </div>

            <div style={{ maxHeight: 420, overflow: "auto", display: "grid", gap: 10, marginTop: 12 }}>
              {filteredUsers.map((u) => {
                const username = safeStr(u.username);
                const active = selectedUsername === username;
                return (
                  <button
                    key={username}
                    type="button"
                    onClick={() => setSelectedUsername(username)}
                    style={{
                      textAlign: "left",
                      border: active ? "1px solid rgba(59,130,246,.4)" : "1px solid #e6edf2",
                      background: active ? "rgba(59,130,246,.06)" : "#fff",
                      borderRadius: 16,
                      padding: 12,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#0f172a" }}>{safeStr(u.employee_name || u.name || username)}</div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{username}</div>
                  </button>
                );
              })}

              {!filteredUsers.length ? (
                <div className="grey-text" style={{ padding: 12 }}>
                  No matching employees.
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ border: "1px solid #e6edf2", borderRadius: 18, padding: 16, background: "#fff" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Selected employee
                </div>
                <div style={{ fontSize: 20, fontWeight: 950, color: "#0f172a", marginTop: 4 }}>
                  {safeStr(selectedUser?.employee_name || selectedUser?.name || selectedUsername || "None selected")}
                </div>
                <div style={{ color: "#64748b", marginTop: 2 }}>{safeStr(selectedUser?.username || "")}</div>
              </div>

              <form onSubmit={(e) => void handleCredit(e)}>
                <div className="input-field">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountFgc}
                    onChange={(e) => setAmountFgc(e.target.value)}
                    placeholder="10.00"
                  />
                  <label className="active">Credit amount (FGC)</label>
                </div>

                <div className="input-field">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reward, giveaway, bonus..."
                  />
                  <label className="active">Reason</label>
                </div>

                <div style={{ marginTop: 8 }}>
                  <label
                    htmlFor="credit-type-select"
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#64748b",
                      marginBottom: 6,
                    }}
                  >
                    What credits to reward
                  </label>
                  <select
                    id="credit-type-select"
                    className="browser-default"
                    value={creditType}
                    onChange={(e) => setCreditType(e.target.value === "frozen" ? "frozen" : "spendable")}
                    style={{
                      width: "100%",
                      height: 46,
                      border: "1px solid #cbd5e1",
                      borderRadius: 12,
                      background: "#fff",
                      padding: "0 12px",
                      color: "#0f172a",
                      fontWeight: 600,
                      outline: "none",
                    }}
                  >
                    <option value="spendable">Reward spendable FGC</option>
                    <option value="frozen">Reward frozen FGC</option>
                  </select>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                    Spendable FGC goes into the normal wallet. Frozen FGC vests on weekly release.
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                  <button
                    type="submit"
                    className="btn"
                    disabled={saving || bulkSaving}
                  >
                    {saving ? "Crediting..." : "Grant credits"}
                  </button>
                  <button
                    type="button"
                    className="btn red darken-1"
                    onClick={(e) => void handleCredit(e as any, -1)}
                    disabled={saving || bulkSaving}
                    style={{ fontWeight: 900 }}
                  >
                    {saving ? "Removing..." : "Remove credits"}
                  </button>
                  {canActivateWallet ? (
                    <button
                      type="button"
                      className="btn blue darken-1"
                      onClick={() => void handleActivateWallet()}
                      disabled={saving || bulkSaving || activatingWallet}
                      style={{ fontWeight: 900 }}
                    >
                      {activatingWallet ? "Activating..." : "Activate wallet"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-flat"
                      disabled
                      style={{ fontWeight: 900 }}
                    >
                      Wallet active
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-flat"
                    onClick={() => void rewardAllActiveMembers()}
                    disabled={saving || bulkSaving}
                    style={{ fontWeight: 900 }}
                  >
                    {bulkSaving ? "Rewarding all..." : "Reward all active"}
                  </button>
                </div>
              </form>

              <div style={{ marginTop: 16 }}>
                {walletLoading ? (
                  <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 16, padding: 14, color: "#64748b", fontWeight: 800 }}>
                    Loading wallet...
                  </div>
                ) : wallet ? (
                  <div style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 18, padding: 16, display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                          Wallet balances
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 1000, color: "#0f172a", marginTop: 4 }}>
                          {safeStr(selectedUser?.employee_name || selectedUser?.name || selectedUsername || "Employee")}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <div style={{ color: "#64748b", fontWeight: 800 }}>
                          Wallet ID: <b>{safeStr(wallet.wallet_id)}</b>
                        </div>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: "5px 10px",
                            fontSize: 11,
                            fontWeight: 900,
                            background: walletStateMeta.bg,
                            color: walletStateMeta.color,
                            border: `1px solid ${walletStateMeta.border}`,
                            textTransform: "uppercase",
                            letterSpacing: ".05em",
                          }}
                        >
                          {walletStateMeta.label}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div style={{ borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0", padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                          Spendable FGC
                        </div>
                        <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000, color: "#c2410c" }}>
                          <FgcAmount amount={safeNum(wallet.balance_cents)} style={{ fontSize: 24, fontWeight: 1000, color: "#c2410c" }} iconSize={56} />
                        </div>
                      </div>
                      <div style={{ borderRadius: 16, background: "#fff", border: "1px solid #e2e8f0", padding: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                          Frozen FGC
                        </div>
                        <div style={{ marginTop: 6, fontSize: 24, fontWeight: 1000, color: "#1d4ed8" }}>
                          <FrozenFgcAmount
                            amount={safeNum(wallet.frozen_balance_cents)}
                            style={{ fontSize: 24, fontWeight: 1000, color: "#1d4ed8" }}
                            iconSize={56}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderRadius: 18, border: "1px solid #e2e8f0", background: "#fff", padding: 14, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 1000, color: "#0f172a" }}>Balance slider</div>
                        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 800 }}>
                          Total: {((safeNum(wallet.balance_cents) + safeNum(wallet.frozen_balance_cents)) / 100).toFixed(2)} FGC
                        </div>
                      </div>
                      {(() => {
                        const spendable = Math.max(0, safeNum(wallet.balance_cents));
                        const frozen = Math.max(0, safeNum(wallet.frozen_balance_cents));
                        const total = Math.max(0, spendable + frozen);
                        const spendablePct = total > 0 ? (spendable / total) * 100 : 0;
                        const frozenPct = total > 0 ? 100 - spendablePct : 0;
                        return (
                          <>
                            <div
                              style={{
                                height: 50,
                                borderRadius: 999,
                                overflow: "hidden",
                                border: "1px solid #dbeafe",
                                background: "#eef2ff",
                                display: "flex",
                              }}
                            >
                              <div
                                title={`Spendable: ${(spendable / 100).toFixed(2)} FGC`}
                                style={{
                                  width: `${spendablePct}%`,
                                  minWidth: spendable > 0 ? 12 : 0,
                                  background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
                                }}
                              />
                              <div
                                title={`Frozen: ${(frozen / 100).toFixed(2)} FGC`}
                                style={{
                                  width: `${frozenPct}%`,
                                  minWidth: frozen > 0 ? 12 : 0,
                                  background: "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)",
                                }}
                              />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12, fontWeight: 900 }}>
                              <span style={{ color: "#c2410c" }}>Spendable {spendablePct.toFixed(1)}%</span>
                              <span style={{ color: "#1d4ed8" }}>Frozen {frozenPct.toFixed(1)}%</span>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    <div style={{ color: "#475569", fontSize: 12.5, lineHeight: 1.6 }}>
                      Frozen streak: {safeNum(wallet.frozen_release_streak_weeks).toLocaleString()} week(s)
                      {safeStr(wallet.status) === "missing" ? " · wallet record exists but is not yet activated" : ""}
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "1px dashed #cbd5e1", background: "#fbfdff", borderRadius: 16, padding: 14, color: "#64748b", fontWeight: 800 }}>
                    No wallet created for this employee yet.
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
