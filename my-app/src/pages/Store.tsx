import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import FgcAmount from "../components/credits/FgcAmount";
import type { ApiRequestRecord, ApiStoreItem, ApiStoreOrder, ApiWallet } from "../api";

declare const M: any;

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function fmtFgcFromCents(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNum(value) / 100)} FGC`;
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

function statusLabel(status?: string) {
  const s = safeStr(status).toLowerCase();
  if (!s || s === "pending") return "Requested";
  if (s === "approved" || s === "completed" || s === "fulfilled") return "Fulfilled";
  if (s === "rejected" || s === "cancelled" || s === "canceled") return "Cancelled";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fulfillmentModeOf(item: ApiStoreItem) {
  return safeStr(item.fulfillment_mode).toLowerCase();
}

export default function Store() {
  const { api } = useAuth();
  const [items, setItems] = useState<ApiStoreItem[]>([]);
  const [orders, setOrders] = useState<ApiStoreOrder[]>([]);
  const [requests, setRequests] = useState<ApiRequestRecord[]>([]);
  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [walletToken, setWalletToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"store" | "orders">("store");
  const [activeCategory, setActiveCategory] = useState("all");

  async function ensureWalletSession() {
    if (walletToken) return walletToken;
    const resp = await api.createWalletSession();
    const token = String(resp?.token || "").trim();
    if (!token) throw new Error("Wallet token missing");
    setWalletToken(token);
    return token;
  }

  async function loadWallet(token?: string) {
    const nextToken = String(token || walletToken || "").trim();
    if (!nextToken) return;
    const resp = await api.getWalletMeWithToken(nextToken);
    setWallet(resp?.wallet || null);
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const token = await ensureWalletSession();
      const [storeItems, myOrders, myRequests] = await Promise.all([
        api.getStoreItems(),
        api.getMyStoreOrders(),
        api.listMyRequests({ limit: 200 }),
      ]);
      setItems(Array.isArray(storeItems) ? storeItems : []);
      setOrders(Array.isArray(myOrders) ? myOrders : []);
      setRequests(Array.isArray(myRequests?.requests) ? myRequests.requests : []);
      await loadWallet(token);
    } catch (e: any) {
      setError(String(e?.message || "Failed to load store"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanceCents = useMemo(() => safeNum(wallet?.balance_cents), [wallet]);
  const completedOrders = useMemo(
    () => orders.filter((order) => ["completed", "fulfilled"].includes(safeStr(order.status).toLowerCase()) || !safeStr(order.status)),
    [orders]
  );
  const storeRequests = useMemo(
    () => requests.filter((request) => safeStr(request.kind || request.requestType).toLowerCase().startsWith("store_")),
    [requests]
  );
  const categories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const item of items) {
      const category = safeStr(item.category || "Uncategorized") || "Uncategorized";
      seen.set(category, (seen.get(category) || 0) + 1);
    }
    return Array.from(seen.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }));
  }, [items]);
  const visibleItems = useMemo(() => {
    if (activeCategory === "all") return items;
    return items.filter((item) => safeStr(item.category || "Uncategorized") === activeCategory);
  }, [items, activeCategory]);

  useEffect(() => {
    if (activeCategory === "all") return;
    const exists = categories.some((category) => category.name === activeCategory);
    if (!exists) setActiveCategory("all");
  }, [activeCategory, categories]);

  async function buyItem(item: ApiStoreItem) {
    const qty = 1;
    setBusyItemId(item.item_id);
    try {
      const fulfillmentMode = fulfillmentModeOf(item);
      const requestOnly = fulfillmentMode === "request" || item.can_request_purchase;
      const affordable = safeNum(wallet?.balance_cents) >= safeNum(item.price_cents) * qty;
      if (requestOnly) {
        if (!affordable) {
          throw new Error(`Not enough FGC to request ${item.name}`);
        }
        await api.createRequest({
          kind: "store_purchase_request",
          title: `Store purchase request: ${item.name}`,
          summary: `Request to buy ${qty} x ${item.name} for ${fmtFgcFromCents(item.price_cents)}.`,
          payload: {
            item_id: item.item_id,
            item_name: item.name,
            quantity: qty,
            unit_price_cents: safeNum(item.price_cents),
            total_cents: safeNum(item.price_cents) * qty,
            custom_order: true,
          },
        });
        M?.toast?.({ html: `Purchase request sent for ${item.name}`, classes: "green" });
      } else {
        const resp = await api.purchaseStoreItem({ item_id: item.item_id, quantity: qty });
        setWallet(resp?.wallet ? (resp.wallet as ApiWallet) : wallet);
        setItems((prev) =>
          prev.map((x) => (x.item_id === item.item_id ? { ...x, stock: Math.max(0, safeNum(x.stock) - qty) } : x))
        );
        await loadData();
        M?.toast?.({ html: `Purchased ${item.name} for ${fmtFgcFromCents(item.price_cents)}`, classes: "green" });
      }
    } catch (e: any) {
      M?.toast?.({ html: e?.message || "Request failed", classes: "red" });
    } finally {
      setBusyItemId("");
    }
  }

  return (
    <main className="container" style={{ paddingTop: 24, maxWidth: 1180 }}>
      <div className="card" style={{ borderRadius: 20, overflow: "hidden" }}>
        <div className="card-content" style={{ padding: 18 }}>
          <style>{`
            .boutiqueTabs{
              margin-top: 16px;
              display: flex;
              gap: 8px;
              padding: 6px;
              border: 1px solid #dbe5ef;
              border-radius: 18px;
              background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
              box-shadow: 0 8px 24px rgba(15,23,42,.04);
              width: 100%;
              overflow: hidden;
            }
            .boutiqueTabBtn{
              flex: 1 1 0;
              min-width: 0;
              border: 0;
              border-radius: 12px;
              padding: 12px 16px;
              font-size: 13px;
              font-weight: 900;
              letter-spacing: .04em;
              text-transform: uppercase;
              color: #475569;
              background: transparent;
              cursor: pointer;
              transition: transform .12s ease, background-color .12s ease, color .12s ease, box-shadow .12s ease;
            }
            .boutiqueTabBtn:hover{
              transform: translateY(-1px);
              color: #1e293b;
            }
            .boutiqueTabBtn.active{
              background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
              color: #1d4ed8;
              box-shadow: inset 0 0 0 1px rgba(59,130,246,.18), 0 4px 14px rgba(37,99,235,.12);
            }
            @media (max-width: 640px){
              .boutiqueTabs{
                gap: 6px;
              }
              .boutiqueTabBtn{
                padding: 11px 10px;
                font-size: 12px;
              }
            }
          `}</style>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 1000, color: "#0f172a" }}>Fluke Boutique</div>
              <div style={{ color: "#64748b", marginTop: 4 }}>Spend Fluke Game Credits on studio merch.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Balance</div>
              <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
                {loading ? "Loading..." : <FgcAmount amount={balanceCents} style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }} iconSize={64} />}
              </div>
            </div>
          </div>

          <div className="boutiqueTabs" role="tablist" aria-label="Fluke Boutique tabs">
            <button
              type="button"
              className={`boutiqueTabBtn ${activeTab === "store" ? "active" : ""}`}
              onClick={() => setActiveTab("store")}
            >
              Store
            </button>
            <button
              type="button"
              className={`boutiqueTabBtn ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              My Orders
            </button>
          </div>

          {error ? (
            <div className="emptyState" style={{ marginTop: 16, borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
              {error}
            </div>
          ) : null}

          {activeTab === "store" ? (
            <div style={{ marginTop: 18, display: "grid", gap: 14 }}>
              <div className="boutiqueTabs" role="tablist" aria-label="Fluke Boutique categories" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className={`boutiqueTabBtn ${activeCategory === "all" ? "active" : ""}`}
                  onClick={() => setActiveCategory("all")}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    className={`boutiqueTabBtn ${activeCategory === category.name ? "active" : ""}`}
                    onClick={() => setActiveCategory(category.name)}
                  >
                    {category.name} ({category.count})
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Available items
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
                {visibleItems.map((item) => {
                  const fulfillmentMode = fulfillmentModeOf(item);
                  const requestOnly = fulfillmentMode === "request" || Boolean(item.can_request_purchase);
                  const canPurchase = Boolean(item.can_purchase);
                  const inStock = canPurchase && safeNum(item.stock) > 0;
                  const affordable = safeNum(wallet?.balance_cents) >= safeNum(item.price_cents);
                  const stockLabel = requestOnly ? "Request only" : safeNum(item.display_stock ?? item.stock);
                  const requestAffordable = safeNum(wallet?.balance_cents) >= safeNum(item.price_cents);
                  return (
                    <article
                      key={item.item_id}
                      style={{
                        border: "1px solid #e6edf2",
                        borderRadius: 18,
                        overflow: "hidden",
                        background: "#fff",
                        boxShadow: "0 10px 24px rgba(15,23,42,.04)",
                      }}
                    >
                      <div
                        style={{
                          minHeight: 138,
                          background:
                            "linear-gradient(135deg, rgba(37,99,235,.10), rgba(14,165,233,.10), rgba(168,85,247,.08))",
                          display: "grid",
                          placeItems: "center",
                          padding: 16,
                        }}
                      >
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            style={{ maxHeight: 112, maxWidth: "100%", objectFit: "contain" }}
                          />
                        ) : (
                          <i className="material-icons" style={{ fontSize: 60, color: "#1d4ed8" }}>
                            storefront
                          </i>
                        )}
                      </div>
                      <div style={{ padding: 14, display: "grid", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 1000, fontSize: 17, color: "#0f172a" }}>{item.name}</div>
                          <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{item.description || "No description yet."}</div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Price</div>
                            <div style={{ fontWeight: 1000, color: "#0f172a" }}>
                              <FgcAmount amount={safeNum(item.price_cents)} style={{ fontWeight: 1000, color: "#0f172a" }} iconSize={30} />
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>
                              {requestOnly ? "Custom order" : "Stock"}
                            </div>
                            <div style={{ fontWeight: 1000, color: requestOnly ? "#b45309" : inStock ? "#166534" : "#991b1b" }}>
                              {stockLabel}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn"
                          disabled={
                            (requestOnly ? !requestAffordable : (!inStock || !affordable)) ||
                            loading ||
                            busyItemId === item.item_id
                          }
                          onClick={() => void buyItem(item)}
                          style={{ width: "100%" }}
                        >
                          {busyItemId === item.item_id
                            ? "Submitting..."
                            : requestOnly
                              ? requestAffordable
                                ? "Request purchase"
                                : "Not enough FGC"
                              : !inStock
                                ? "Out of stock"
                                : !affordable
                                  ? "Not enough FGC"
                                  : "Buy now"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {!visibleItems.length ? <div className="emptyState">No items in this category yet.</div> : null}
            </div>
          ) : (
            <div style={{ marginTop: 18, display: "grid", gap: 18 }}>
              <section>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Fulfilled Orders
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {completedOrders.length ? (
                    completedOrders.map((order) => (
                      <div
                        key={order.order_id}
                        style={{
                          border: "1px solid #e6edf2",
                          borderRadius: 14,
                          padding: 12,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 950, color: "#0f172a" }}>{order.item_name || order.item_id}</div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {order.quantity} x {fmtFgcFromCents(order.unit_price_cents)} · {fmtDate(order.created_at)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 1000, color: "#0f172a" }}>
                              <FgcAmount amount={safeNum(order.total_cents)} style={{ fontWeight: 1000, color: "#0f172a" }} iconSize={30} />
                            </div>
                          <div style={{ color: "#166534", fontSize: 12, fontWeight: 900, textTransform: "uppercase" }}>
                            {safeStr(order.status || "fulfilled")}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="emptyState">No fulfilled orders yet.</div>
                  )}
                </div>
              </section>

              <section>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em" }}>
                  Requests
                </div>
                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  {storeRequests.length ? (
                    storeRequests.map((request) => {
                      const payload = request.payload || {};
                      const label = statusLabel(request.status);
                      return (
                        <div
                          key={request.requestId}
                          style={{
                            border: "1px solid #e6edf2",
                            borderRadius: 14,
                            padding: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            flexWrap: "wrap",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 950, color: "#0f172a" }}>{request.title || payload.item_name || request.kind}</div>
                            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                              {safeStr(request.kind).replace(/_/g, " ")} · {fmtDate(request.createdAt)}
                            </div>
                            <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                              {request.summary || `Item: ${safeStr(payload.item_name || payload.item_id || "-")}`}
                            </div>
                            {request.reviewNote ? (
                              <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
                                Note: {request.reviewNote}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ textAlign: "right" }}>
                            {payload.total_cents ? <div style={{ fontWeight: 1000, color: "#0f172a" }}>{fmtFgcFromCents(payload.total_cents)}</div> : null}
                            <div
                              style={{
                                color: request.status === "rejected" ? "#991b1b" : request.status === "approved" ? "#166534" : "#92400e",
                                fontSize: 12,
                                fontWeight: 900,
                                textTransform: "uppercase",
                              }}
                            >
                              {label}
                            </div>
                            {request.fulfillmentOrderId ? (
                              <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                                Order #{request.fulfillmentOrderId}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="emptyState">No store requests yet.</div>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
