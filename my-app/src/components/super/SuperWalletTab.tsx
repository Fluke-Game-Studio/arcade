import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import FgcAmount from "../credits/FgcAmount";
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
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
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

  async function handleCredit(e: FormEvent) {
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
      const transactionId = makeTxId(`wallet-credit-${username}`);
      const resp = await api.creditWallet({
        username,
        amount_cents: Math.round(credits * 100),
        reason: safeStr(reason),
        transaction_id: transactionId,
      });
      setWallet(resp?.wallet || null);
      M?.toast?.({ html: `Credited ${credits.toFixed(2)} FGC to ${username}`, classes: "green" });
      setAmountFgc("");
      setReason("");
    } catch (err: any) {
      M?.toast?.({ html: err?.message || "Failed to credit wallet", classes: "red" });
    } finally {
      setSaving(false);
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

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    className="btn"
                    disabled={saving || bulkSaving}
                  >
                    {saving ? "Crediting..." : "Grant credits"}
                  </button>
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

              {wallet ? (
                <div style={{ marginTop: 8, border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 16, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                    Latest result
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 1000, color: "#0f172a", marginTop: 4 }}>
                    <FgcAmount amount={safeNum(wallet.balance_cents)} style={{ fontSize: 24, fontWeight: 1000, color: "#0f172a" }} iconSize={64} />
                  </div>
                  <div style={{ color: "#475569", marginTop: 4 }}>
                    Wallet ID: <b>{safeStr(wallet.wallet_id)}</b>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
