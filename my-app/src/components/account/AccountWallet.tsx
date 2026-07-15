import { useEffect, useMemo, useState } from "react";
import FgcAmount from "../credits/FgcAmount";

declare const M: any;

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(value?: string) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountWallet({ api, user }: { api: any; user: any }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletToken, setWalletToken] = useState("");
  const [walletSessionLoading, setWalletSessionLoading] = useState(true);

  async function ensureWalletSession() {
    try {
      setWalletSessionLoading(true);
      const resp = await api.createWalletSession();
      const token = String(resp?.token || "").trim();
      if (!token) {
        throw new Error("Wallet session token missing.");
      }
      setWalletToken(token);
      return token;
    } catch (e: any) {
      setWalletToken("");
      setError(String(e?.message || "Failed to start wallet session"));
      throw e;
    } finally {
      setWalletSessionLoading(false);
    }
  }

  async function loadWallet(token?: string) {
    const nextToken = String(token || walletToken || "").trim();
    if (!nextToken) return;
    try {
      setError("");
      setLoading(true);
      const [walletResp, txResp] = await Promise.all([
        api.getWalletMeWithToken(nextToken),
        api.getWalletTransactionsWithToken(nextToken).catch(() => ({ ok: true, items: [] })),
      ]);
      setWallet(walletResp?.wallet || null);
      setTransactions(Array.isArray(txResp?.items) ? txResp.items : []);
    } catch (e: any) {
      setWallet(null);
      setTransactions([]);
      setError(String(e?.message || "Failed to load wallet"));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureWalletSession();
        if (cancelled) return;
        await loadWallet(token);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanceCents = useMemo(() => safeNum(wallet?.balance_cents), [wallet]);
  const history = useMemo(() => {
    return Array.isArray(transactions) ? transactions.slice().sort((a, b) => String(b?.created_at || "").localeCompare(String(a?.created_at || ""))) : [];
  }, [transactions]);

  async function refresh() {
    try {
      setRefreshing(true);
      const token = walletToken || (await ensureWalletSession());
      await loadWallet(token);
      M?.toast?.({ html: "Wallet refreshed.", classes: "green" });
    } catch {}
    setRefreshing(false);
  }

  const status = safeStr(wallet?.status || "missing");
  const walletId = safeStr(wallet?.wallet_id || user?.username || user?.sub || "unknown");

  return (
    <section className="panelCard" style={{ background: "#fff" }}>
      <div className="panelHead">
        <div>
          <div className="h">Wallet</div>
          <div className="p">Secure Fluke Game Credits ledger routed through ue-auth to ue-payment-service</div>
        </div>
        <button type="button" className="accBtn subtle" onClick={() => void refresh()} disabled={refreshing}>
          <i className="material-icons" style={{ fontSize: 18 }}>
            {refreshing ? "hourglass_top" : "refresh"}
          </i>
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(59,130,246,0.16)",
            background:
              "radial-gradient(700px 280px at 12% -20%, rgba(59,130,246,0.14), transparent 55%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            padding: 16,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
              Current balance in FGC
            </div>
            <div style={{ fontSize: 36, lineHeight: 1.05, fontWeight: 1000, color: "#0f172a", marginTop: 6 }}>
                {loading || walletSessionLoading ? "Loading..." : <FgcAmount amount={balanceCents} style={{ fontSize: 36, lineHeight: 1.05, fontWeight: 1000, color: "#0f172a" }} iconSize={64} />}
            </div>
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 6 }}>
                Stored as integer minor FGC units in the wallet ledger.
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 12,
                  fontWeight: 900,
                  border: "1px solid rgba(148,163,184,0.28)",
                  background: status === "active" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                  color: status === "active" ? "#166534" : "#92400e",
                }}
              >
                {status === "active" ? "Active wallet" : status || "Missing wallet"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
                Wallet ID: <span style={{ fontWeight: 900, color: "#0f172a" }}>{walletId}</span>
              </div>
            </div>
          </div>

          <div className="tileGrid">
            <div className="accTile">
              <div className="accTileLeft">
                <div className="accTileIcon">
                  <i className="material-icons">account_balance_wallet</i>
                </div>
                <div className="accTileText">
                  <div className="accTileLabel">Balance in FGC units</div>
                  <div className="accTileValue mono">
                    <FgcAmount amount={safeNum(wallet?.balance_cents)} style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }} iconSize={30} />
                  </div>
                </div>
              </div>
            </div>
            <div className="accTile">
              <div className="accTileLeft">
                <div className="accTileIcon">
                  <i className="material-icons">sync_alt</i>
                </div>
                <div className="accTileText">
                  <div className="accTileLabel">Ledger version</div>
                  <div className="accTileValue mono">{safeNum(wallet?.version).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div className="accTile">
              <div className="accTileLeft">
                <div className="accTileIcon">
                  <i className="material-icons">schedule</i>
                </div>
                <div className="accTileText">
                  <div className="accTileLabel">Updated</div>
                  <div className="accTileValue">{fmtDate(wallet?.updated_at)}</div>
                </div>
              </div>
            </div>
            <div className="accTile">
              <div className="accTileLeft">
                <div className="accTileIcon">
                  <i className="material-icons">verified_user</i>
                </div>
                <div className="accTileText">
                  <div className="accTileLabel">Owner</div>
                  <div className="accTileValue">{safeStr(user?.name || user?.username || "You")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="emptyState" style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error && status === "missing" ? (
          <div className="emptyState">
            Your wallet record is not active yet. It will appear automatically once the payment service grants, creates, or syncs your wallet.
          </div>
        ) : null}

        <div className="accDetails">
          <details open>
            <summary className="accSummary">
              <div className="accordionBar">
                <div className="accordionTitle">
                  <i className="material-icons">shield</i>
                  <div>
                    <div className="t">How this connects</div>
                    <div className="s">The browser talks to ue-auth, and ue-auth forwards wallet calls to the payment service.</div>
                  </div>
                </div>
                <i className="material-icons" style={{ color: "#64748b" }}>keyboard_arrow_down</i>
              </div>
            </summary>
            <div className="accordionBody">
              <div className="updateCols">
                <div className="updateBox">
                  <div className="k">Frontend</div>
                  <div className="v">This tab calls <b>/wallet/session</b> and <b>/wallet/me</b> on ue-auth.</div>
                </div>
                <div className="updateBox">
                  <div className="k">Backend</div>
                  <div className="v">ue-auth proxies those requests to <b>ue-payment-service</b>, which owns the wallet ledger.</div>
                </div>
                <div className="updateBox">
                  <div className="k">Next step</div>
                  <div className="v">Once ledger history is exposed, we can show transactions, holds, and spends here automatically.</div>
                </div>
              </div>
            </div>
          </details>
        </div>

        <div className="accDetails">
          <details>
            <summary className="accSummary">
              <div className="accordionBar">
                <div className="accordionTitle">
                  <i className="material-icons">receipt_long</i>
                  <div>
                    <div className="t">Transaction history</div>
                    <div className="s">Credits added, deducted, and wallet adjustments for this account.</div>
                  </div>
                </div>
                <i className="material-icons" style={{ color: "#64748b" }}>keyboard_arrow_down</i>
              </div>
            </summary>
            <div className="accordionBody">
              <div style={{ display: "grid", gap: 10 }}>
                {loading ? (
                  <div className="emptyState">Loading transactions...</div>
                ) : history.length ? (
                  history.map((tx) => {
                    const amount = safeNum(tx?.amount_cents);
                    const isDebit = amount < 0;
                    return (
                      <div
                        key={String(tx?.transaction_id || tx?.created_at || Math.random())}
                        style={{
                          border: "1px solid rgba(148,163,184,.18)",
                          borderRadius: 16,
                          padding: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          background: isDebit ? "rgba(248,113,113,.04)" : "rgba(34,197,94,.04)",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>
                            {tx?.reason || (isDebit ? "Wallet deduction" : "Wallet credit")}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {fmtDate(tx?.created_at)} · {tx?.source || "system"}{tx?.actor ? ` · ${tx.actor}` : ""}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                            Tx ID: {safeStr(tx?.transaction_id || "-")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 1000, color: isDebit ? "#b91c1c" : "#166534" }}>
                            <FgcAmount
                              amount={Math.abs(amount)}
                              divisor={1}
                              fractionDigits={0}
                              style={{ fontWeight: 1000, color: isDebit ? "#b91c1c" : "#166534" }}
                              iconSize={30}
                            />
                            {isDebit ? " deducted" : " added"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            Balance after: {safeNum(tx?.balance_after_cents) / 100}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="emptyState">No wallet transactions yet.</div>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
