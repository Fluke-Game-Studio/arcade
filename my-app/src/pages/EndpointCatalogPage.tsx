import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { ApiEndpointCatalogItem, ApiProject, ApiUser } from "../api";

declare const M: any;

type EndpointDoc = ApiEndpointCatalogItem;
type AuthMode = "public" | "employee" | "admin" | "super" | "authenticated";

type Props = {
  editable: boolean;
};

function safeMethod(method?: string) {
  return String(method || "GET").toUpperCase();
}

function methodTone(method?: string) {
  const m = safeMethod(method);
  if (m === "GET") return { bg: "rgba(34,197,94,0.16)", bd: "rgba(34,197,94,0.28)", fg: "#166534" };
  if (m === "POST") return { bg: "rgba(37,99,235,0.14)", bd: "rgba(37,99,235,0.24)", fg: "#1e40af" };
  if (m === "PUT" || m === "PATCH") return { bg: "rgba(245,158,11,0.14)", bd: "rgba(245,158,11,0.28)", fg: "#92400e" };
  if (m === "DELETE") return { bg: "rgba(239,68,68,0.14)", bd: "rgba(239,68,68,0.28)", fg: "#991b1b" };
  return { bg: "rgba(148,163,184,0.16)", bd: "rgba(148,163,184,0.28)", fg: "#334155" };
}

function normalizeAuthMode(v: FormDataEntryValue | null): AuthMode {
  const value = String(v || "").trim().toLowerCase();
  if (value === "public" || value === "employee" || value === "admin" || value === "super" || value === "authenticated") {
    return value;
  }
  return "employee";
}

function formIdForRoute(routeKey: string) {
  return `endpoint_form_${routeKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function listCount(v?: string[]) {
  return Array.isArray(v) ? v.length : 0;
}

function accessSummary(ep: EndpointDoc) {
  const au = listCount(ep.allowedUsers);
  const ap = listCount(ep.allowedProjects);
  const du = listCount(ep.deniedUsers);
  const dp = listCount((ep as any).deniedProjects);

  if (au + ap + du + dp === 0) return "No custom policy";

  const parts: string[] = [];
  if (au) parts.push(`allowUsers:${au}`);
  if (ap) parts.push(`allowProjects:${ap}`);
  if (du) parts.push(`denyUsers:${du}`);
  if (dp) parts.push(`denyProjects:${dp}`);
  return parts.join(" | ");
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function TypeChip({ t }: { t: string }) {
  const tone =
    t === "object"
      ? { bg: "#dbeafe", fg: "#1e3a8a" }
      : t === "array"
      ? { bg: "#fef3c7", fg: "#92400e" }
      : t === "string"
      ? { bg: "#dcfce7", fg: "#166534" }
      : t === "number"
      ? { bg: "#ede9fe", fg: "#5b21b6" }
      : { bg: "#e2e8f0", fg: "#334155" };
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        borderRadius: 999,
        padding: "2px 8px",
        background: tone.bg,
        color: tone.fg,
      }}
    >
      {t}
    </span>
  );
}

type SchemaLine = {
  path: string;
  type: string;
  required?: boolean;
  description?: string;
};

function flattenSchema(node: any, path = "", requiredSet = new Set<string>()): SchemaLine[] {
  if (!isObj(node)) return [];

  const currentType = String(node?.type || (node?.properties ? "object" : "any"));
  const out: SchemaLine[] = [
    {
      path: path || "(root)",
      type: currentType,
      required: path ? requiredSet.has(path.split(".").slice(-1)[0]) : false,
      description: typeof node?.description === "string" ? node.description : "",
    },
  ];

  const props = isObj(node?.properties) ? node.properties : {};
  const req = new Set<string>(Array.isArray(node?.required) ? node.required : []);
  for (const [k, v] of Object.entries(props)) {
    const childPath = path ? `${path}.${k}` : k;
    out.push(...flattenSchema(v, childPath, req));
  }

  if (node?.items && isObj(node.items)) {
    const itemPath = path ? `${path}[]` : "items[]";
    out.push(...flattenSchema(node.items, itemPath, new Set<string>()));
  }

  // Support route-registry style schema envelopes where fields are
  // grouped under keys like body/query/params/response without JSON-schema
  // "properties" at the root.
  const reserved = new Set([
    "type",
    "description",
    "required",
    "properties",
    "items",
    "enum",
    "default",
    "nullable",
    "format",
    "examples",
    "$ref",
    "oneOf",
    "anyOf",
    "allOf",
    // Internal doc extensions (not actual request/response schema)
    "xRequestSamples",
  ]);

  const envelopeEntries = Object.entries(node).filter(
    ([k, v]) => !reserved.has(k) && isObj(v)
  );

  for (const [k, v] of envelopeEntries) {
    const childPath = path ? `${path}.${k}` : k;
    out.push(...flattenSchema(v, childPath, new Set<string>()));
  }

  return out;
}

function SchemaLines({ node }: { node: unknown }) {
  const allLines = flattenSchema(node || {});
  const lines =
    allLines.length > 1 && allLines[0]?.path === "(root)" && allLines[0]?.type === "any"
      ? allLines.slice(1)
      : allLines;
  if (!lines.length) return <div style={{ color: "#64748b" }}>No schema fields</div>;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      {lines.map((line, i) => (
        <div
          key={`${line.path}_${i}`}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            padding: "6px 8px",
            borderRadius: 8,
            background: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <code style={{ fontWeight: 700 }}>{line.path}</code>
          <TypeChip t={line.type} />
          {line.required ? <span style={{ color: "#b91c1c", fontWeight: 700, fontSize: 12 }}>required</span> : null}
          {line.description ? <span style={{ color: "#334155", fontSize: 12 }}>{line.description}</span> : null}
        </div>
      ))}
    </div>
  );
}

function sampleFromSchemaNode(node: any): any {
  if (!isObj(node)) return null;
  const t = String(node?.type || "");

  if (Array.isArray(node?.enum) && node.enum.length) return node.enum[0];
  if (node?.default !== undefined) return node.default;

  if (t === "string") return "<string>";
  if (t === "number" || t === "integer") return 0;
  if (t === "boolean") return true;
  if (t === "array") {
    const sampleItem = sampleFromSchemaNode(node?.items || {});
    return sampleItem === null ? [] : [sampleItem];
  }
  if (t === "object" || isObj(node?.properties)) {
    const out: Record<string, any> = {};
    const props = isObj(node?.properties) ? node.properties : {};
    for (const [k, v] of Object.entries(props)) {
      out[k] = sampleFromSchemaNode(v);
    }
    return out;
  }
  return null;
}

function buildRequestPackage(ep: EndpointDoc, variantKey?: string) {
  const schema = isObj(ep?.schema) ? ep.schema : {};
  const query = sampleFromSchemaNode(schema?.query || {});
  const body = sampleFromSchemaNode(schema?.body || {});
  const pathParams = sampleFromSchemaNode(schema?.pathParams || {});

  const baseHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(safeMethod(ep?.method) !== "GET" ? { "Content-Type": "application/json" } : {}),
  };

  const samples = isObj((schema as any)?.xRequestSamples) ? (schema as any).xRequestSamples : null;
  const variant = variantKey && samples && isObj(samples?.[variantKey]) ? samples[variantKey] : null;

  const overrideHeaders = isObj(variant?.headers) ? variant.headers : null;

  // Default behavior: assume authenticated request sample unless overridden.
  const headers = {
    ...baseHeaders,
    Authorization: "Bearer <token>",
    ...(overrideHeaders ? overrideHeaders : {}),
  };

  // If the variant explicitly omits Authorization, remove it.
  if (overrideHeaders && !("Authorization" in overrideHeaders) && variantKey === "public") {
    delete (headers as any).Authorization;
  }

  return {
    method: safeMethod(ep?.method),
    path: String(ep?.path || ""),
    headers,
    ...(isObj(pathParams) && Object.keys(pathParams).length ? { pathParams } : {}),
    ...(isObj(query) && Object.keys(query).length ? { query } : {}),
    ...(isObj(body) && Object.keys(body).length ? { body } : {}),
  };
}

function SchemaTabs({
  node,
  requestSamples,
  defaultVariant,
}: {
  node: unknown;
  requestSamples: Record<string, Record<string, any>>;
  defaultVariant?: string;
}) {
  const [view, setView] = useState<"pretty" | "request">("pretty");
  const variantKeys = useMemo(() => Object.keys(requestSamples || {}), [requestSamples]);
  const preferredDefault =
    defaultVariant && variantKeys.includes(defaultVariant)
      ? defaultVariant
      : variantKeys.includes("authenticated")
        ? "authenticated"
        : variantKeys[0] || "default";
  const [variant, setVariant] = useState<string>(preferredDefault);

  useEffect(() => {
    // If the endpoint changes, keep selection stable but valid.
    const keys = Object.keys(requestSamples || {});
    if (!keys.length) return;
    if (keys.includes(variant)) return;
    setVariant(
      defaultVariant && keys.includes(defaultVariant)
        ? defaultVariant
        : keys.includes("authenticated")
          ? "authenticated"
          : keys[0]
    );
  }, [defaultVariant, requestSamples, variant]);

  const activeSample = requestSamples?.[variant] || requestSamples?.default || {};
  const sample = useMemo(() => JSON.stringify(activeSample || {}, null, 2), [activeSample]);

  function labelForVariant(key: string) {
    const k = String(key || "").toLowerCase();
    if (k === "public") return "Public";
    if (k === "authenticated" || k === "employee") return "Authenticated";
    if (k === "admin") return "Admin";
    if (k === "super") return "Super";
    return key;
  }

  return (
    <div>
      <div className="schema-tabs">
        <button
          type="button"
          className={`schema-tabBtn ${view === "pretty" ? "active" : ""}`}
          onClick={() => setView("pretty")}
        >
          Pretty
        </button>
        <button
          type="button"
          className={`schema-tabBtn ${view === "request" ? "active" : ""}`}
          onClick={() => setView("request")}
        >
          Request Sample
        </button>
      </div>
      <div className="schema-wrap">
        {view === "pretty" ? (
          <SchemaLines node={node || {}} />
        ) : (
          <div>
            {variantKeys.length > 1 ? (
              <div className="schema-subtabs">
                {variantKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`schema-subtabBtn ${variant === k ? "active" : ""}`}
                    onClick={() => setVariant(k)}
                  >
                    {labelForVariant(k)}
                  </button>
                ))}
              </div>
            ) : null}
            <pre className="schema-raw">{sample}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EndpointCatalogPage({ editable }: Props) {
  const { user, api } = useAuth();
  const [items, setItems] = useState<EndpointDoc[]>([]);
  const [activeUsers, setActiveUsers] = useState<ApiUser[]>([]);
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string>("");
  const [syncing, setSyncing] = useState(false);

  const token = user?.token || "";
  const isSuper = String(user?.role || "").toLowerCase() === "super";
  const isEditable = editable && isSuper;
  const showAdminControls = editable && isSuper;

  function toast(message: string, classes = "blue-grey darken-1") {
    try {
      M?.toast?.({ html: message, classes });
    } catch {}
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const payload = await api.getEndpointCatalog();
        if (mounted) setItems(Array.isArray(payload?.endpoints) ? payload.endpoints : []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load endpoints");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [api, token]);

  async function reloadCatalog() {
    const payload = await api.getEndpointCatalog();
    setItems(Array.isArray(payload?.endpoints) ? payload.endpoints : []);
  }

  async function syncNow() {
    if (!isSuper) return;
    setSyncing(true);
    try {
      await api.syncEndpointCatalogNow();
      await reloadCatalog();
      toast("Endpoint catalog synced", "green darken-1");
    } catch (e: any) {
      toast(e?.message || "Sync failed", "red darken-2");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    async function loadSelectors() {
      if (!token || !isSuper) return;
      try {
        const [users, projectRows] = await Promise.all([
          api.getUsers(),
          api.getProjects(),
        ]);
        if (!mounted) return;
        setActiveUsers(
          (users || [])
            .filter((u) => String((u as any).revoked || "").toLowerCase() !== "true")
            .filter((u) => String(u.username || "").trim().length > 0)
            .sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")))
        );
        setProjects(
          (projectRows || []).sort((a, b) =>
            String(a.projectId || a.name || "").localeCompare(String(b.projectId || b.name || ""))
          )
        );
      } catch {
        if (!mounted) return;
        setActiveUsers([]);
        setProjects([]);
      }
    }
    loadSelectors();
    return () => {
      mounted = false;
    };
  }, [api, isSuper, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) =>
      [x.routeKey, x.method, x.path, x.module, x.description, x.authMode || x.auth]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointDoc[]>();
    for (const ep of filtered) {
      const key = String(ep.module || "uncategorized").trim() || "uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ep);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([module, endpoints]) => ({
        module,
        endpoints: [...endpoints].sort((a, b) => {
          const p = String(a.path || "").localeCompare(String(b.path || ""));
          if (p !== 0) return p;
          return safeMethod(a.method).localeCompare(safeMethod(b.method));
        }),
      }));
  }, [filtered]);

  async function saveAccess(item: EndpointDoc, form: HTMLFormElement) {
    const routeKey = String(item.routeKey || "").trim();
    if (!routeKey || !token) return;

    const fd = new FormData(form);
    const body = {
      routeKey,
      authMode: normalizeAuthMode(fd.get("authMode")),
      allowedUsers: fd.getAll("allowedUsers").map((x) => String(x)),
      deniedUsers: fd.getAll("deniedUsers").map((x) => String(x)),
      allowedProjects: fd.getAll("allowedProjects").map((x) => String(x)),
      deniedProjects: fd.getAll("deniedProjects").map((x) => String(x)),
    };

    setSavingKey(routeKey);
    setError(null);
    try {
      const payload = await api.updateEndpointAccess(body);

      setItems((prev) =>
        prev.map((x) => (x.routeKey === routeKey ? { ...x, ...(payload?.item || {}) } : x))
      );
      toast("Endpoint access updated", "green darken-1");
      try {
        const fresh = await api.getEndpointCatalog();
        setItems(Array.isArray(fresh?.endpoints) ? fresh.endpoints : []);
      } catch {}
    } catch (e: any) {
      const msg = e?.message || "Failed to save endpoint access";
      setError(msg);
      toast(msg, "red darken-2");
    } finally {
      setSavingKey("");
    }
  }

  function setAll(form: HTMLFormElement, fieldName: string, checked: boolean) {
    const nodes = form.querySelectorAll<HTMLInputElement>(`input[name="${fieldName}"]`);
    nodes.forEach((n) => {
      if (!n.disabled) n.checked = checked;
    });
  }

  return (
    <main className="container endpoint-shell" style={{ paddingTop: 18, paddingBottom: 28, maxWidth: 1180 }}>
      <style>{`
        .endpoint-shell { animation: endpointIn .24s ease both; }
        @keyframes endpointIn { from { opacity:0; transform: translateY(7px);} to { opacity:1; transform:none;} }

        .endpoint-hero{
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.25);
          background:
            radial-gradient(820px 340px at 12% -12%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(700px 320px at 90% 20%, rgba(59,130,246,0.14), transparent 56%),
            linear-gradient(155deg, #0b223f 0%, #0f2e55 50%, #0b223f 100%);
          box-shadow: 0 18px 48px rgba(2,6,23,0.35);
          color: #fff;
          position: relative;
        }
        .endpoint-hero::after{
          content: "";
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent);
          transform: translateX(-64%);
          animation: endpointShine 4.8s ease-in-out infinite;
          opacity: .35;
          pointer-events: none;
        }
        @keyframes endpointShine {
          0% { transform: translateX(-64%); }
          52% { transform: translateX(64%); }
          100% { transform: translateX(64%); }
        }
        .endpoint-heroInner{ padding: 16px; position: relative; z-index: 1; }
        .endpoint-heroTop{
          display:flex; align-items:center; justify-content:space-between; gap: 12px; flex-wrap: wrap;
        }
        .endpoint-title{ margin:0; font-size: 22px; line-height: 1.1; font-weight: 1000; letter-spacing: -0.4px; }
        .endpoint-sub{ margin-top: 5px; color: rgba(226,232,240,.86); font-size: 12px; font-weight: 800; }
        .endpoint-pills{ display:flex; align-items:center; gap: 8px; flex-wrap: wrap; }
        .endpoint-pill{
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.2);
          background: rgba(255,255,255,.12);
          color: rgba(255,255,255,.95);
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 900;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .endpoint-searchRow{ margin-top: 12px; display:flex; gap: 10px; align-items:center; flex-wrap: wrap; }
        .endpoint-search{
          flex: 1 1 320px;
          min-width: 260px;
          display:flex; align-items:center; gap: 8px;
          border-radius: 14px;
          background: rgba(255,255,255,.12);
          border: 1px solid rgba(255,255,255,.2);
          padding: 9px 12px;
          backdrop-filter: blur(10px);
        }
        .endpoint-search i{ color: rgba(255,255,255,.9); font-size: 20px; }
        .endpoint-search input{
          border: none !important;
          box-shadow: none !important;
          outline: none !important;
          margin: 0 !important;
          height: 28px !important;
          color: rgba(255,255,255,.95) !important;
          font-weight: 800;
        }
        .endpoint-search input::placeholder{ color: rgba(255,255,255,.65); font-weight: 800; }
        .endpoint-syncBtn{
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.22);
          background: rgba(255,255,255,.14);
          color: #fff;
          padding: 0 12px;
          height: 40px;
          font-weight: 900;
          display:inline-flex;
          align-items:center;
          gap: 7px;
          cursor: pointer;
        }
        .endpoint-syncBtn:hover{ background: rgba(255,255,255,.18); }

        .endpoint-group{
          border-radius: 16px !important;
          border: 1px solid #dde6f1 !important;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 10px 28px rgba(2,6,23,0.08);
        }
        .endpoint-group > summary{
          cursor: pointer;
          padding: 12px 14px;
          font-size: 14px;
          font-weight: 1000;
          letter-spacing: .2px;
          text-transform: capitalize;
          color: #0f172a;
          background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
          border-bottom: 1px solid #e2e8f0;
        }
        .endpoint-groupInner{ padding: 12px; display:grid; gap: 10px; }

        .endpoint-card{
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
          overflow: hidden;
        }
        .endpoint-card > summary{
          cursor: pointer;
          padding: 10px 12px;
          display:flex; align-items:center; gap: 10px; flex-wrap: wrap;
          border-bottom: 1px solid #e5edf6;
          background: #fff;
        }
        .endpoint-method{
          border-radius: 999px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 1000;
          border: 1px solid #cbd5e1;
        }
        .endpoint-path{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 13px;
          color: #0f172a;
          font-weight: 700;
        }
        .endpoint-module{
          margin-left: auto;
          color: #64748b;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .5px;
        }
        .endpoint-body{ padding: 12px; }
        .endpoint-desc{ margin-top: 0; margin-bottom: 8px; color: #334155; font-weight: 600; }
        .endpoint-meta{
          display:flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;
        }
        .endpoint-metaChip{
          border-radius: 999px;
          border: 1px solid #dbe5ef;
          background: #fff;
          color: #334155;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 900;
        }
        .schema-wrap{
          margin-top: 8px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px;
          background: linear-gradient(180deg, #f8fafc, #fff);
        }
        .schema-tabs{
          margin-top: 8px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .schema-tabBtn{
          border: 1px solid #cbd5e1;
          border-radius: 999px;
          padding: 5px 10px;
          background: #fff;
          color: #334155;
          font-size: 11px;
          font-weight: 900;
          cursor: pointer;
        }
        .schema-tabBtn.active{
          background: #dbeafe;
          border-color: #93c5fd;
          color: #1d4ed8;
        }
        .schema-subtabs{
          margin-bottom: 10px;
          display:flex;
          gap: 8px;
          align-items:center;
          flex-wrap: wrap;
        }
        .schema-subtabBtn{
          border: 1px dashed #cbd5e1;
          border-radius: 999px;
          padding: 4px 9px;
          background: #fff;
          color: #334155;
          font-size: 10px;
          font-weight: 950;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: .04em;
        }
        .schema-subtabBtn.active{
          background: rgba(34,197,94,0.12);
          border-color: rgba(34,197,94,0.35);
          color: #166534;
        }
        .schema-raw{
          margin: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          color: #0f172a;
        }
        .rule-panel{
          margin-top: 12px;
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
        .rule-head{
          display:flex; align-items:center; justify-content:space-between; gap: 10px; flex-wrap: wrap;
          margin-bottom: 8px;
        }
        .rule-title{ font-weight: 1000; color: #0f172a; }
        .rule-form{ display:grid; gap: 9px; }
        .rule-select{
          border: 1px solid #d4dde8;
          border-radius: 10px;
          height: 36px;
          max-width: 280px;
          background: #fff;
        }
        .rule-list{
          margin-top: 8px;
          max-height: 180px;
          overflow: auto;
          border: 1px solid #e2e8f0;
          border-radius: 9px;
          padding: 8px;
          background: #fff;
        }
        .rule-list label{
          display:flex; gap: 8px; align-items:flex-start; margin-bottom: 6px; cursor: pointer;
          color: #334155; font-weight: 600;
        }
        .rule-actions{ margin-top: 8px; display:flex; gap: 8px; flex-wrap: wrap; }
        .rule-linkBtn{
          border: 1px solid #d7e0ea;
          border-radius: 10px;
          background: #fff;
          color: #334155;
          height: 32px;
          padding: 0 10px;
          font-weight: 900;
          cursor: pointer;
        }
        .rule-linkBtn:hover{ background: #f8fafc; }

        .endpoint-loading{
          margin-top: 12px;
          border-radius: 16px;
          border: 1px solid #dde6f1;
          background: #fff;
          box-shadow: 0 10px 28px rgba(2,6,23,0.08);
          overflow: hidden;
        }
        .endpoint-loadingHead{
          padding: 12px 14px;
          border-bottom: 1px solid #e6edf5;
          background: linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%);
        }
        .endpoint-skel{
          position: relative;
          overflow: hidden;
          background: #e9f0f8;
          border-radius: 10px;
        }
        .endpoint-skel::after{
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,.75), transparent);
          transform: translateX(-100%);
          animation: endpointSkelShimmer 1.25s ease-in-out infinite;
        }
        @keyframes endpointSkelShimmer {
          100% { transform: translateX(100%); }
        }
        .endpoint-loadingBody{
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .endpoint-loadingCard{
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: linear-gradient(180deg, #fff 0%, #fbfdff 100%);
          padding: 12px;
        }
      `}</style>

      <section className="endpoint-hero">
        <div className="endpoint-heroInner">
          <div className="endpoint-heroTop">
            <div>
              <h4 className="endpoint-title">API Endpoints</h4>
              <div className="endpoint-sub">
                Unified catalog for route docs and project/user access policy
              </div>
            </div>
            <div className="endpoint-pills">
              <span className="endpoint-pill">
                <i className="material-icons" style={{ fontSize: 16 }}>route</i>
                {isEditable ? "Super Edit Mode" : "Read Only"}
              </span>
              <span className="endpoint-pill">
                <i className="material-icons" style={{ fontSize: 16 }}>inventory_2</i>
                {items.length} endpoints
              </span>
            </div>
          </div>
          <div className="endpoint-searchRow">
            <div className="endpoint-search">
              <i className="material-icons">search</i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by method, path, module..."
              />
            </div>
            {showAdminControls && (
              <button className="endpoint-syncBtn" type="button" onClick={syncNow} disabled={syncing}>
                <i className="material-icons" style={{ fontSize: 17 }}>
                  sync
                </i>
                {syncing ? "Syncing..." : "Sync Now"}
              </button>
            )}
          </div>
        </div>
      </section>

      {loading && (
        <div className="endpoint-loading">
          <div className="endpoint-loadingHead">
            <div className="endpoint-skel" style={{ height: 16, width: 180 }} />
          </div>
          <div className="endpoint-loadingBody">
            {Array.from({ length: 4 }).map((_, i) => (
              <div className="endpoint-loadingCard" key={`endpoint_loading_${i}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="endpoint-skel" style={{ height: 20, width: 64, borderRadius: 999 }} />
                  <div className="endpoint-skel" style={{ height: 14, width: "62%" }} />
                </div>
                <div style={{ marginTop: 10, height: 12, width: "86%" }} className="endpoint-skel" />
                <div style={{ marginTop: 8, height: 12, width: "72%" }} className="endpoint-skel" />
                <div style={{ marginTop: 8, height: 12, width: "45%" }} className="endpoint-skel" />
              </div>
            ))}
          </div>
        </div>
      )}
      {!!error && (
        <div className="card" style={{ marginTop: 12, border: "1px solid #fecaca", borderRadius: 14 }}>
          <div className="card-content" style={{ color: "#991b1b" }}>{error}</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {grouped.map((group) => (
          <details key={group.module} className="endpoint-group">
            <summary>
              {group.module} ({group.endpoints.length})
            </summary>
            <div className="endpoint-groupInner">
              <div style={{ display: "grid", gap: 10 }}>
                {group.endpoints.map((ep) => {
                  const routeKey = String(ep.routeKey || `${safeMethod(ep.method)}#${ep.path || ""}`);
                  const formId = formIdForRoute(routeKey);
                  const methodChip = methodTone(ep.method);
                  return (
                    <details key={routeKey} className="endpoint-card">
                      <summary>
                        <span
                          className="endpoint-method"
                          style={{
                            background: methodChip.bg,
                            borderColor: methodChip.bd,
                            color: methodChip.fg,
                          }}
                        >
                          {safeMethod(ep.method)}
                        </span>
                        <span className="endpoint-path">{ep.path}</span>
                        <span className="endpoint-module">{ep.module || "uncategorized"}</span>
                      </summary>
                      <div className="endpoint-body">
                        <p className="endpoint-desc">{ep.description || "No description"}</p>
                        <div className="endpoint-meta">
                          <span className="endpoint-metaChip">Auth: {ep.authMode || ep.auth || "-"}</span>
                          <span className="endpoint-metaChip">Active: {ep.isActive === false ? "No" : "Yes"}</span>
                          <span className="endpoint-metaChip">Policy: {accessSummary(ep)}</span>
                        </div>

                        <details>
                          <summary>
                            Schema{" "}
                            {(!ep.schema || Object.keys(ep.schema || {}).length === 0) ? (
                              <span style={{ color: "#b45309", fontWeight: 700 }}>(missing)</span>
                            ) : null}
                          </summary>
                          {(() => {
                            const schema = isObj(ep?.schema) ? (ep.schema as any) : {};
                            const meta = isObj(schema?.xRequestSamples) ? schema.xRequestSamples : null;
                            const keys = meta ? Object.keys(meta) : [];
                            const requestSamples: Record<string, Record<string, any>> = {};
                            const endpointAuthMode = String((ep as any)?.authMode || (ep as any)?.auth || "").trim().toLowerCase();
                            const routePath = String(ep?.path || "").trim();
                            const isPublicEndpoint =
                              endpointAuthMode === "public" || routePath === "/directory" || routePath === "/updates";

                            if (keys.length) {
                              for (const k of keys) {
                                requestSamples[k] = buildRequestPackage(ep, k);
                              }
                              if (isPublicEndpoint && !requestSamples.public) {
                                requestSamples.public = buildRequestPackage(ep, "public");
                              }
                            } else {
                              requestSamples[isPublicEndpoint ? "public" : "default"] = buildRequestPackage(
                                ep,
                                isPublicEndpoint ? "public" : undefined
                              );
                            }

                            return (
                              <SchemaTabs
                                node={ep.schema || {}}
                                requestSamples={requestSamples}
                                defaultVariant={isPublicEndpoint ? "public" : undefined}
                              />
                            );
                          })()}
                        </details>

                        {showAdminControls && (
                          <div className="rule-panel">
                            <div className="rule-head">
                              <div className="rule-title">Access Rules (Super Only)</div>
                              {isEditable && (
                                <button
                                  className="btn"
                                  type="submit"
                                  form={formId}
                                  title="Save Access Rules"
                                  disabled={savingKey === routeKey}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                                >
                                  <i className="material-icons" style={{ fontSize: 18 }}>save</i>
                                  {savingKey === routeKey ? "Saving..." : "Save"}
                                </button>
                              )}
                            </div>
                            <form
                              id={formId}
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (isEditable) saveAccess(ep, e.currentTarget);
                              }}
                              className="rule-form"
                            >
                      <label style={{ fontWeight: 700 }}>Access Level</label>
                      <div style={{ marginTop: 6 }}>
                        <select
                          name="authMode"
                          className="browser-default rule-select"
                          defaultValue={String(ep.authMode || ep.auth || "employee").toLowerCase()}
                          disabled={!isEditable}
                        >
                          <option value="public">public</option>
                          <option value="employee">employee</option>
                          <option value="admin">admin</option>
                          <option value="super">super</option>
                        </select>
                      </div>

                      <label style={{ fontWeight: 700 }}>Allowed Projects</label>
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Project Allow List</summary>
                        <div className="rule-actions">
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "allowedProjects", true)}>Select All</button>
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "allowedProjects", false)}>Clear</button>
                        </div>
                        <div className="rule-list">
                          {projects.map((p) => {
                            const value = String(p.projectId || "");
                            if (!value) return null;
                            const checked = (ep.allowedProjects || []).includes(value);
                            return (
                              <label key={value} style={{ display: "block", marginBottom: 6, cursor: "pointer" }}>
                                <input type="checkbox" name="allowedProjects" value={value} defaultChecked={checked} disabled={!isEditable} />
                                <span>{value} {p.name ? `- ${p.name}` : ""}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      <label style={{ fontWeight: 700 }}>Denied Projects</label>
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Project Deny List</summary>
                        <div className="rule-actions">
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "deniedProjects", true)}>Select All</button>
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "deniedProjects", false)}>Clear</button>
                        </div>
                        <div className="rule-list">
                          {projects.map((p) => {
                            const value = String(p.projectId || "");
                            if (!value) return null;
                            const checked = (ep.deniedProjects || []).includes(value);
                            return (
                              <label key={value} style={{ display: "block", marginBottom: 6, cursor: "pointer" }}>
                                <input type="checkbox" name="deniedProjects" value={value} defaultChecked={checked} disabled={!isEditable} />
                                <span>{value} {p.name ? `- ${p.name}` : ""}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      <label style={{ fontWeight: 700 }}>Allowed Users</label>
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>User Allow List</summary>
                        <div className="rule-actions">
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "allowedUsers", true)}>Select All</button>
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "allowedUsers", false)}>Clear</button>
                        </div>
                        <div className="rule-list" style={{ maxHeight: 220 }}>
                          {activeUsers.map((u) => {
                            const value = String(u.username || "");
                            const checked = (ep.allowedUsers || []).includes(value);
                            return (
                              <label key={value} style={{ display: "block", marginBottom: 6, cursor: "pointer" }}>
                                <input type="checkbox" name="allowedUsers" value={value} defaultChecked={checked} disabled={!isEditable} />
                                <span>{value}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                      <label style={{ fontWeight: 700 }}>Denied Users</label>
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: 700 }}>User Deny List</summary>
                        <div className="rule-actions">
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "deniedUsers", true)}>Select All</button>
                          <button type="button" className="rule-linkBtn" onClick={(e) => setAll(e.currentTarget.form as HTMLFormElement, "deniedUsers", false)}>Clear</button>
                        </div>
                        <div className="rule-list" style={{ maxHeight: 220 }}>
                          {activeUsers.map((u) => {
                            const value = String(u.username || "");
                            const checked = (ep.deniedUsers || []).includes(value);
                            return (
                              <label key={value} style={{ display: "block", marginBottom: 6, cursor: "pointer" }}>
                                <input type="checkbox" name="deniedUsers" value={value} defaultChecked={checked} disabled={!isEditable} />
                                <span>{value}</span>
                              </label>
                            );
                          })}
                        </div>
                      </details>

                    </form>
                  </div>
                )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
