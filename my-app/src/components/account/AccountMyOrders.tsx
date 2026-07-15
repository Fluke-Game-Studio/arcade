import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import FgcAmount from "../credits/FgcAmount";
import type { ApiStoreOrder } from "../../api";

declare const M: any;

function safeStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: any) {
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

export default function AccountMyOrders({ api }: { api: any }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ApiStoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const resp = await api.getMyStoreOrders();
      setOrders(Array.isArray(resp) ? resp : []);
    } catch (e: any) {
      setOrders([]);
      setError(String(e?.message || "Failed to load your orders"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSpentCents = useMemo(
    () =>
      orders
        .filter((order) => ["completed", "fulfilled"].includes(safeStr(order.status).toLowerCase()) || !safeStr(order.status))
        .reduce((sum, order) => sum + safeNum(order.total_cents), 0),
    [orders]
  );
  const fulfilledOrders = useMemo(
    () => orders.filter((order) => ["completed", "fulfilled"].includes(safeStr(order.status).toLowerCase()) || !safeStr(order.status)),
    [orders]
  );

  return (
    <section className="card z-depth-1 panelCard" style={{ marginTop: 14, overflow: "hidden" }}>
      <style>{`
        .accOrdersWrap{
          padding: 16px;
          background:
            radial-gradient(900px 420px at 0% 0%, rgba(59,130,246,.06), transparent 45%),
            linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }
        .accOrdersHero{
          border:1px solid #e6edf2;
          border-radius: 20px;
          background:#fff;
          padding: 16px;
          box-shadow: 0 10px 24px rgba(15,23,42,.04);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .accOrdersTitle{
          font-size: 22px;
          font-weight: 1000;
          color:#0f172a;
          letter-spacing:-.02em;
        }
        .accOrdersSub{
          margin-top: 4px;
          color:#64748b;
          font-size: 13px;
          font-weight: 700;
        }
        .accOrdersPills{
          display:flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .accOrdersPill{
          border-radius: 999px;
          border: 1px solid #dbe5ef;
          background: #f8fbff;
          padding: 8px 12px;
          font-weight: 900;
          color:#334155;
          font-size: 12px;
          white-space: nowrap;
        }
        .accOrdersList{
          margin-top: 14px;
          display:grid;
          gap: 10px;
        }
        .accOrderCard{
          border:1px solid #e6edf2;
          border-radius: 18px;
          background:#fff;
          box-shadow: 0 10px 24px rgba(15,23,42,.04);
          padding: 14px;
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 14px;
          flex-wrap: wrap;
        }
        .accOrderName{
          font-weight: 1000;
          font-size: 15px;
          color:#0f172a;
        }
        .accOrderMeta{
          margin-top: 4px;
          color:#64748b;
          font-size: 12px;
          font-weight: 700;
          line-height: 1.45;
        }
        .accOrderAmount{
          font-weight: 1000;
          color:#0f172a;
          white-space: nowrap;
        }
        .accOrdersFooter{
          margin-top: 14px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap: 12px;
          flex-wrap: wrap;
        }
      `}</style>

      <div className="accOrdersWrap">
        <div className="accOrdersHero">
          <div>
            <div className="accOrdersTitle">My Orders</div>
            <div className="accOrdersSub">Your Fluke Boutique purchases in Fluke Game Credits.</div>
          </div>
          <div className="accOrdersPills">
            <div className="accOrdersPill">Orders: {fulfilledOrders.length}</div>
            <div className="accOrdersPill">
              Spent: <FgcAmount amount={totalSpentCents} style={{ fontSize: 12, fontWeight: 900, color: "#334155" }} iconSize={30} />
            </div>
          </div>
        </div>

        {error ? (
          <div className="emptyState" style={{ marginTop: 14, borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
            {error}
          </div>
        ) : null}

        <div className="accOrdersList">
          {loading ? (
            <div className="emptyState">Loading your orders...</div>
          ) : fulfilledOrders.length ? (
            fulfilledOrders.map((order) => (
              <div key={order.order_id} className="accOrderCard">
                <div style={{ minWidth: 0 }}>
                  <div className="accOrderName">{safeStr(order.item_name) || order.item_id}</div>
                  <div className="accOrderMeta">
                    {order.quantity} x <FgcAmount amount={safeNum(order.unit_price_cents)} style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }} iconSize={30} />
                    <br />
                    Ordered {fmtDate(order.created_at)}
                    <br />
                    Status: {safeStr(order.status || "completed")}
                  </div>
                </div>
                <div className="accOrderAmount">
                  <FgcAmount amount={safeNum(order.total_cents)} style={{ fontSize: 15, fontWeight: 1000, color: "#0f172a" }} iconSize={30} />
                </div>
              </div>
            ))
          ) : (
            <div className="emptyState">No fulfilled orders yet. Visit Fluke Boutique to buy your first item.</div>
          )}
        </div>

        <div className="accOrdersFooter">
          <div style={{ color: "#64748b", fontWeight: 700, fontSize: 13 }}>
            Want to shop again? Browse the boutique for available items.
          </div>
          <button type="button" className="accBtn" onClick={() => navigate("/store")}>
            <i className="material-icons">storefront</i>
            Open Fluke Boutique
          </button>
        </div>
      </div>
    </section>
  );
}
