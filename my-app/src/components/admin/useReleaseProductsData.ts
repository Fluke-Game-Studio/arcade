import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiCustomer, ApiProduct } from "../../api";

function safe(v: any) {
  return String(v ?? "").trim();
}

function unique<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export type ReleaseAccess = {
  customerId: string;
  customerName: string;
  env: string;
  tier: string;
  status: string;
};

export type UnifiedReleaseRow = {
  key: string;
  project_id: string;
  product_id: string;
  name: string;
  release_status: string;
  channel: string;
  platform: string;
  status: string;
  isVisible: boolean;
  releaseLane: string;
  access: ReleaseAccess[];
};

export function useReleaseProductsData(api: any) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [allCustomerFlows, setAllCustomerFlows] = useState<Record<string, any[]>>({});

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([api.getCustomers(), api.getProductsAdmin()]);
      setCustomers(Array.isArray(c) ? c : []);
      setProducts(Array.isArray(p) ? p : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to load products/customers");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const loadAllFlows = useCallback(async (customerList?: ApiCustomer[]) => {
    const source = customerList || customers;
    if (!source.length) {
      setAllCustomerFlows({});
      return;
    }
    try {
      const out: Record<string, any[]> = {};
      await Promise.all(
        source.map(async (c) => {
          const rows = await api.getCustomerFlow(c.customer_id);
          out[c.customer_id] = Array.isArray(rows) ? rows : [];
        })
      );
      setAllCustomerFlows(out);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed loading entitlement matrix");
    }
  }, [api, customers]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([api.getCustomers(), api.getProductsAdmin()]);
      const customerList = Array.isArray(c) ? c : [];
      setCustomers(customerList);
      setProducts(Array.isArray(p) ? p : []);
      const out: Record<string, any[]> = {};
      await Promise.all(
        customerList.map(async (cust) => {
          const rows = await api.getCustomerFlow(cust.customer_id);
          out[cust.customer_id] = Array.isArray(rows) ? rows : [];
        })
      );
      setAllCustomerFlows(out);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Failed to refresh release data");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const customersById = useMemo(() => {
    const m = new Map<string, ApiCustomer>();
    for (const c of customers) m.set(c.customer_id, c);
    return m;
  }, [customers]);

  const productAccess = useMemo(() => {
    const map: Record<string, ReleaseAccess[]> = {};
    for (const [customerId, rows] of Object.entries(allCustomerFlows)) {
      const customer = customersById.get(customerId);
      const customerName = safe(customer?.name || customerId);
      for (const r of rows) {
        if (!safe(r.SK).startsWith("ENTITLEMENT#")) continue;
        const pid = safe(r.product_id);
        const proj = safe(r.project_id);
        if (!pid && !proj) continue;
        const rec: ReleaseAccess = {
          customerId,
          customerName,
          env: safe(r.env || "test"),
          tier: safe(r.tier || "basic"),
          status: safe(r.status || "active"),
        };
        if (pid) {
          if (!map[pid]) map[pid] = [];
          map[pid].push(rec);
        }
        if (proj && proj !== pid) {
          if (!map[proj]) map[proj] = [];
          map[proj].push(rec);
        }
      }
    }
    return map;
  }, [allCustomerFlows, customersById]);

  const releaseRows = useMemo<UnifiedReleaseRow[]>(() => {
    const rows = (products || []).map((p: any) => {
      const releaseStatus = safe(p.release_status).toLowerCase() || "internal";
      const channel = safe(p.channel) || "v0.0.0";
      const platform = safe((p as any).platform);
      const status = safe(p.status || "active").toLowerCase();
      const isVisible = !(status === "inactive" || status === "archived" || status === "disabled" || status === "hidden");
      const lane =
        releaseStatus === "dev"
          ? "DEV (not released)"
          : releaseStatus === "internal"
          ? `Internal @ ${channel}`
          : releaseStatus === "candidate"
          ? `QA @ ${channel}`
          : releaseStatus === "released"
          ? `Prod @ ${channel}`
          : `${releaseStatus} @ ${channel}`;
      const productId = safe(p.product_id);
      const projectId = safe(p.project_id);
      const access = unique([...(productAccess[productId] || []), ...(productAccess[projectId] || [])]);
      return {
        key: `${projectId}|${productId}|${releaseStatus}|${channel}`,
        project_id: projectId,
        product_id: productId,
        name: safe(p.name || productId),
        release_status: releaseStatus,
        channel,
        platform,
        status,
        isVisible,
        releaseLane: lane,
        access,
      };
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, productAccess]);

  const toggleReleaseVisibility = useCallback(async (row: UnifiedReleaseRow, shouldBeVisible: boolean) => {
    await api.syncProductFromProject({
      project_id: row.project_id,
      product_id: row.product_id || row.project_id,
      name: row.name,
      release_status: row.release_status,
      channel: row.channel,
      platform: row.platform,
      status: shouldBeVisible ? "active" : "archived",
    });
    await refresh();
  }, [api, refresh]);

  return {
    loading,
    error,
    customers,
    products,
    allCustomerFlows,
    releaseRows,
    loadBase,
    loadAllFlows,
    refresh,
    toggleReleaseVisibility,
  };
}
