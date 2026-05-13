import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiCustomer } from "../api";
import { useReleaseProductsData } from "../components/admin/useReleaseProductsData";

function safe(v: any) {
  return String(v ?? "").trim();
}

type TabKey = "products" | "customers";

export default function CustomersAdmin() {
  const { api } = useAuth();
  const releaseData = useReleaseProductsData(api as any);
  const [tab, setTab] = useState<TabKey>("products");
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [selected, setSelected] = useState<ApiCustomer | null>(null);
  const [customerUsers, setCustomerUsers] = useState<any[]>([]);
  const [editingCustomerLogin, setEditingCustomerLogin] = useState(false);
  const [projectSettings, setProjectSettings] = useState<Record<string, {
    status: "none" | "active" | "paused" | "restricted";
    types: Array<"internal" | "test" | "final">;
    tier: "default" | "basic" | "pro" | "premium";
    env: "dev" | "test" | "prod";
  }>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [newCustomer, setNewCustomer] = useState({
    name: "",
    customer_type: "internal",
    status: "active",
    billing_provider: "stripe",
    stripe_customer_id: "",
  });
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
  });
  function nextProjectAccessStatus(curr: "none" | "active" | "paused" | "restricted"): "none" | "active" | "paused" | "restricted" {
    if (curr === "none") return "active";
    if (curr === "active") return "paused";
    if (curr === "paused") return "restricted";
    return "none";
  }

  function formatErr(err: any, fallback: string) {
    const msg = String(err?.message || "").trim();
    if (msg === "Failed to fetch" || msg.toLowerCase().includes("networkerror")) {
      return `${fallback}: network/CORS/API unreachable`;
    }
    return msg || fallback;
  }

  async function loadBase() {
    try {
      setLoading(true);
      const [c] = await Promise.all([(api as any).getCustomers(), (api as any).getProductsAdmin()]);
      setCustomers(Array.isArray(c) ? c : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load customers/products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (selected?.customer_id) {
      (async () => {
        try {
          const rows = await (api as any).getCustomerFlow(selected.customer_id);
          const users = (Array.isArray(rows) ? rows : []).filter((r: any) =>
            safe(r.SK).startsWith("USER#")
          );
          const ents = (Array.isArray(rows) ? rows : []).filter((r: any) => safe(r.SK).startsWith("ENTITLEMENT#"));
          const next: Record<string, { status: "none" | "active" | "paused" | "restricted"; types: Array<"internal" | "test" | "final">; tier: "default" | "basic" | "pro" | "premium"; env: "dev" | "test" | "prod"; }> = {};
          for (const e of ents) {
            const pid = safe((e as any).product_id);
            if (!pid) continue;
            const sRaw = safe((e as any).status).toLowerCase();
            const status = (sRaw === "paused" || sRaw === "restricted") ? sRaw : "active";
            const tRaw = safe((e as any).customer_type_scope || "internal");
            const types = tRaw
              .split(",")
              .map((x: string) => x.trim())
              .filter((x: string) => x === "internal" || x === "test" || x === "final") as Array<"internal" | "test" | "final">;
            const tierRaw = safe((e as any).tier).toLowerCase();
            const tier = (["default", "basic", "pro", "premium"].includes(tierRaw) ? tierRaw : "default") as "default" | "basic" | "pro" | "premium";
            const envRaw = safe((e as any).env).toLowerCase();
            const env = (envRaw === "prod" || envRaw === "dev") ? envRaw : "test";
            next[pid] = { status, types: types.length ? Array.from(new Set(types)) : ["internal"], tier, env };
          }
          setProjectSettings(next);
          setCustomerUsers(users);
          setEditingCustomerLogin(users.length === 0);
        } catch {
          setCustomerUsers([]);
          setEditingCustomerLogin(true);
          setProjectSettings({});
        }
      })();
    } else {
      setCustomerUsers([]);
      setProjectSettings({});
    }
  }, [selected?.customer_id]);

  useEffect(() => {
    if (!releaseData.loading) {
      setCustomers(releaseData.customers);
    }
  }, [releaseData.loading, releaseData.customers]);

  async function onCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    try {
      setMsg("");
      await (api as any).createCustomer(newCustomer);
      setNewCustomer({
        name: "",
        customer_type: "internal",
        status: "active",
        billing_provider: "stripe",
        stripe_customer_id: "",
      });
      await loadBase();
      setMsg("Customer created.");
    } catch (err: any) {
      setError(err?.message || "Create customer failed");
    }
  }

  async function onSaveCustomer() {
    if (!selected?.customer_id) return;
    try {
      setMsg("");
      await (api as any).updateCustomer(selected.customer_id, {
        name: selected.name,
        customer_type: selected.customer_type || "internal",
        status: selected.status || "active",
        billing_provider: selected.billing_provider,
        stripe_customer_id: selected.stripe_customer_id,
      });
      const entries = Object.entries(projectSettings);
      for (const [productId, s] of entries) {
        if (!s || s.status === "none") continue;
        await (api as any).upsertCustomerEntitlement(selected.customer_id, {
          product_id: productId,
          tier: s.tier,
          env: s.env,
          status: s.status,
          customer_type_scope: s.types.join(","),
          allow_prod_override: s.types.includes("test"),
        });
      }
      await loadBase();
      await releaseData.refresh();
      setSelected({ ...selected });
      setMsg("Customer saved.");
    } catch (err: any) {
      setError(formatErr(err, "Update customer failed"));
    }
  }

  async function onAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!selected?.customer_id) return;
    try {
      setMsg("");
      await (api as any).createCustomerUser(selected.customer_id, newUser);
      setNewUser({ email: "", password: "" });
      await releaseData.refresh();
      const rows = await (api as any).getCustomerFlow(selected.customer_id);
      setCustomerUsers((Array.isArray(rows) ? rows : []).filter((r: any) => safe(r.SK).startsWith("USER#")));
      setEditingCustomerLogin(false);
      setMsg("Customer login saved.");
    } catch (err: any) {
      const m = String(err?.message || "");
      if (m.includes("missing-password-or-source-hash") || m.includes("missing-password-or-employee-hash")) {
        setError("This account has no reusable password hash. Enter a new password and save again.");
      } else {
        setError(formatErr(err, "Add user failed"));
      }
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "none", padding: "24px 32px 28px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 1000, color: "#0f172a" }}>
          Product & Customers
        </div>
        <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
          Release dashboard + customer access management.
        </div>
      </div>

      <div style={{ display: "inline-flex", gap: 8, padding: 6, borderRadius: 999, background: "rgba(15,23,42,.04)", border: "1px solid rgba(148,163,184,.14)", marginBottom: 14 }}>
        <button type="button" onClick={() => setTab("products")} style={{ border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 900, background: tab === "products" ? "rgba(59,130,246,.16)" : "transparent", color: tab === "products" ? "#1d4ed8" : "#334155", cursor: "pointer" }}>
          Products
        </button>
        <button type="button" onClick={() => setTab("customers")} style={{ border: "none", borderRadius: 999, padding: "8px 14px", fontWeight: 900, background: tab === "customers" ? "rgba(34,197,94,.16)" : "transparent", color: tab === "customers" ? "#166534" : "#334155", cursor: "pointer" }}>
          Customers
        </button>
      </div>

      {error ? <div style={{ color: "#b91c1c", marginBottom: 10 }}>{error}</div> : null}
      {msg ? <div style={{ color: "#166534", marginBottom: 10 }}>{msg}</div> : null}

      {tab === "products" ? (
        <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Release Matrix</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>Internal to alpha</span>
            <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>QA to beta</span>
            <span style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "5px 10px", fontSize: 12 }}>Prod to stable</span>
          </div>
          {loading ? <div>Loading...</div> : null}
          <div style={{ overflowX: "auto" }}>
            <table className="highlight striped" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Project</th>
                  <th>Release State</th>
                  <th>Platform</th>
                  <th>Status</th>
                  <th>Who Can Use This Release</th>
                </tr>
              </thead>
              <tbody>
                {releaseData.releaseRows.map((p) => {
                  const access = p.access || [];
                  return (
                    <tr key={p.key}>
                      <td><b>{p.name}</b><div style={{ fontSize: 12, color: "#64748b" }}>{p.product_id}</div></td>
                      <td>{p.project_id}</td>
                      <td>{p.releaseLane}</td>
                      <td>{safe((p as any).platform || "all")}</td>
                      <td>{p.status}</td>
                      <td>
                        {!access.length ? (
                          <span style={{ color: "#94a3b8" }}>No entitled customers</span>
                        ) : (
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {access.map((a, idx) => (
                              <span key={`${a.customerId}-${a.env}-${a.tier}-${idx}`} style={{ border: "1px solid #cbd5e1", borderRadius: 999, padding: "4px 10px", fontSize: 12 }}>
                                {a.customerName} [{a.env}/{a.tier}/{a.status}]
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 16 }}>
          <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Add Customer</div>
            <form onSubmit={onCreateCustomer}>
              <input placeholder="Customer name" value={newCustomer.name} onChange={(e) => setNewCustomer((s) => ({ ...s, name: e.target.value }))} style={{ width: "100%", marginBottom: 8 }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <select value={newCustomer.customer_type} onChange={(e) => setNewCustomer((s) => ({ ...s, customer_type: e.target.value }))}><option value="internal">internal</option><option value="test">test</option><option value="final">final</option></select>
                <select value={newCustomer.status} onChange={(e) => setNewCustomer((s) => ({ ...s, status: e.target.value }))}><option value="active">active</option><option value="restricted">restricted</option><option value="suspended">suspended</option></select>
              </div>
              <input placeholder="Stripe Customer ID (optional)" value={newCustomer.stripe_customer_id} onChange={(e) => setNewCustomer((s) => ({ ...s, stripe_customer_id: e.target.value }))} style={{ width: "100%", marginTop: 8 }} />
              <button type="submit" style={{ marginTop: 10 }}>Create Customer</button>
            </form>
            <hr style={{ margin: "14px 0" }} />
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Customers</div>
            {loading ? <div>Loading...</div> : null}
            <div style={{ maxHeight: 460, overflow: "auto", display: "grid", gap: 8 }}>
              {customers.map((c) => (
                <button key={c.customer_id} type="button" onClick={() => setSelected(c)} style={{ textAlign: "left", border: "1px solid #cbd5e1", borderRadius: 10, padding: 8, background: selected?.customer_id === c.customer_id ? "#eff6ff" : "#fff" }}>
                  <div style={{ fontWeight: 800 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "#334155" }}>{c.customer_id}</div>
                  <div style={{ fontSize: 12 }}>{c.customer_type} | {c.status}</div>
                </button>
              ))}
            </div>
          </section>

          <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#fff" }}>
            {!selected ? (
              <div>Select a customer to manage the full flow.</div>
            ) : (
              <>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Customer Controls</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
                  <input value={selected.name || ""} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
                  <button type="button" onClick={onSaveCustomer}>Save</button>
                </div>
                <input placeholder="Stripe Customer ID" value={selected.stripe_customer_id || ""} onChange={(e) => setSelected({ ...selected, stripe_customer_id: e.target.value })} style={{ width: "100%", marginTop: 8 }} />
                <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <form onSubmit={onAddUser} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Customer Login (Single)</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button
                        type="button"
                        onClick={() => setEditingCustomerLogin((v) => !v)}
                        style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer", fontWeight: 700 }}
                      >
                        {editingCustomerLogin ? "Cancel Edit" : "Edit Login"}
                      </button>
                    </div>
                    {editingCustomerLogin ? (
                      <>
                        <input placeholder="Email" value={newUser.email} onChange={(e) => setNewUser((s) => ({ ...s, email: e.target.value }))} style={{ width: "100%", marginBottom: 8 }} />
                        <input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} style={{ width: "100%", marginBottom: 8 }} />
                        <button type="submit" style={{ marginTop: 8 }}>Save Login</button>
                      </>
                    ) : null}
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", marginBottom: 6 }}>
                        Existing Logins ({customerUsers.length})
                      </div>
                      {!customerUsers.length ? (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>No customer login yet.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 6 }}>
                          {customerUsers.map((u: any) => (
                            <div key={safe(u.user_id || u.SK)} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}>
                              <div style={{ fontWeight: 700 }}>{safe(u.email)}</div>
                              <div style={{ color: "#64748b" }}>
                                role: {safe(u.role || "member")} | status: {safe(u.status || "active")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </form>

                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Project Access Cards</div>
                    <div style={{ display: "grid", gap: 10, maxHeight: 430, overflow: "auto" }}>
                      {Array.from(
                        new Map(
                          releaseData.releaseRows
                            .filter((r) => r.release_status !== "dev")
                            .map((r) => [r.product_id, r] as const)
                        ).values()
                      ).map((r) => {
                        const configured = Boolean(projectSettings[r.product_id]);
                        const state = projectSettings[r.product_id] || {
                          status: "none" as const,
                          types: ["internal"] as Array<"internal" | "test" | "final">,
                          tier: "default" as const,
                          env: (r.release_status === "released" ? "prod" : r.release_status === "candidate" ? "test" : "dev") as "dev" | "test" | "prod",
                        };
                        return (
                          <div key={r.product_id} style={{ border: "1px solid #dbe5ef", borderRadius: 10, padding: 10 }}>
                            <div style={{ fontWeight: 900 }}>{r.name}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                              {r.project_id} | {r.releaseLane} | {safe((r as any).platform || "all")}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setProjectSettings((prev) => ({
                                    ...prev,
                                    [r.product_id]: { ...state, status: nextProjectAccessStatus(state.status) as any },
                                  }))
                                }
                                style={{
                                  border:
                                    state.status === "restricted"
                                      ? "1px solid #b91c1c"
                                      : state.status === "paused"
                                      ? "1px solid #b45309"
                                      : state.status === "none"
                                      ? "1px solid #64748b"
                                      : "1px solid #15803d",
                                  background:
                                    state.status === "restricted"
                                      ? "#fee2e2"
                                      : state.status === "paused"
                                      ? "#ffedd5"
                                      : state.status === "none"
                                      ? "#f1f5f9"
                                      : "#dcfce7",
                                  color:
                                    state.status === "restricted"
                                      ? "#991b1b"
                                      : state.status === "paused"
                                      ? "#9a3412"
                                      : state.status === "none"
                                      ? "#334155"
                                      : "#166534",
                                  borderRadius: 999,
                                  padding: "6px 10px",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                {`Status: ${
                                  state.status === "active"
                                    ? "ACCESS"
                                    : state.status === "none"
                                    ? "NO ACCESS"
                                    : state.status.toUpperCase()
                                }`}
                              </button>
                              {(["internal", "test", "final"] as const).map((t) => {
                                const checked = state.types.includes(t);
                                return (
                                  <label key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: checked ? "1px solid #1d4ed8" : "1px solid #cbd5e1", borderRadius: 999, padding: "6px 8px", fontSize: 12 }}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(e) =>
                                        setProjectSettings((prev) => {
                                          const curr = prev[r.product_id] || state;
                                          const nextTypes = e.target.checked
                                            ? Array.from(new Set([...curr.types, t]))
                                            : curr.types.filter((x) => x !== t);
                                          return {
                                            ...prev,
                                            [r.product_id]: { ...curr, types: nextTypes.length ? nextTypes : ["internal"] },
                                          };
                                        })
                                      }
                                      style={{ width: 14, height: 14, accentColor: "#2563eb" }}
                                    />
                                    {t}
                                  </label>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {(["default", "basic", "pro", "premium"] as const).map((tier) => {
                                const active = configured && state.tier === tier;
                                return (
                                  <label key={tier} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: active ? "1px solid #1d4ed8" : "1px solid #cbd5e1", borderRadius: 999, padding: "6px 8px", fontSize: 12 }}>
                                    <input
                                      type="radio"
                                      name={`tier_${r.product_id}`}
                                      checked={active}
                                      onChange={() =>
                                        setProjectSettings((prev) => ({
                                          ...prev,
                                          [r.product_id]: { ...(prev[r.product_id] || state), tier },
                                        }))
                                      }
                                      style={{ width: 14, height: 14, accentColor: "#2563eb" }}
                                    />
                                    {tier}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
