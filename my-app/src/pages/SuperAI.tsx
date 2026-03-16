// src/pages/SuperAI.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { createAIAPI, type PutAIDocBody } from "../api/types/ai";

declare const M: any;

type SuperAIDoc = {
  id?: string;
  type: "context" | "snapshot";
  contextId?: string;
  snapshotId?: string;
  body: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
};

type LoadSource = "server" | "local" | "default";

const API_BASE = "https://xtipeal88c.execute-api.us-east-1.amazonaws.com";
const LOCAL_PREFIX = "fluke_super_ai_doc_";

const QUICK_DOCS = [
  { id: "context:vaibhav", label: "Vaibhav Context" },
  { id: "context:flukegames", label: "Fluke Games Context" },
  { id: "context:internal", label: "Internal Context" },
  { id: "snapshot:personal", label: "Personal Snapshot" },
  { id: "snapshot:public", label: "Public Snapshot" },
  { id: "snapshot:internal", label: "Internal Snapshot" },
] as const;

function safePrettyJson(v: any) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{\n  \n}";
  }
}

function parseJsonSafe(text: string) {
  return JSON.parse(text || "{}");
}

function inferDocMeta(id: string): {
  type: "context" | "snapshot";
  contextId: string;
  snapshotId: string;
} {
  const clean = String(id || "").trim();

  if (clean.startsWith("snapshot:")) {
    return {
      type: "snapshot",
      contextId: "",
      snapshotId: clean.replace(/^snapshot:/, ""),
    };
  }

  return {
    type: "context",
    contextId: clean.replace(/^context:/, ""),
    snapshotId: "",
  };
}

function emptyContextTemplate(contextId = "") {
  return {
    label:
      contextId === "internal"
        ? "Fluke Games Internal"
        : contextId === "flukegames"
        ? "Fluke Games"
        : contextId === "vaibhav"
        ? "Vaibhav"
        : "",
    visibility: contextId === "internal" ? "private" : "public",
    systemPrompt:
      contextId === "internal"
        ? "You are Fluke AI, the internal AI assistant for Fluke Games."
        : contextId === "flukegames"
        ? "You are Fluke AI, the public assistant for Fluke Games."
        : contextId === "vaibhav"
        ? "You are Fluke AI on Vaibhav Rakheja's personal website."
        : "You are Fluke AI.",
    sources:
      contextId === "internal"
        ? ["employee", "activity", "analytics", "policies", "siteInternal"]
        : contextId === "flukegames"
        ? ["sitePublic"]
        : contextId === "vaibhav"
        ? ["sitePersonal"]
        : [],
  };
}

function emptySnapshotTemplate(snapshotId = "") {
  return {
    site:
      snapshotId === "public"
        ? "flukegames"
        : snapshotId === "personal"
        ? "personal"
        : "internal",
    pages: [],
    ...(snapshotId === "internal"
      ? {
          policies: {
            weeklyReports: "All contributors must submit weekly reports.",
            communication: "Discord is the primary communication channel.",
          },
        }
      : {}),
  };
}

export default function SuperAI() {
  const auth = useAuth() as unknown as {
    user?: { username?: string; role?: string };
    api?: { token?: string };
  };

  const user = auth.user;
  const api = auth.api;

  const apiClient = useMemo(
    () => createAIAPI(API_BASE, api?.token),
    [api?.token]
  );

  const roleLower = String(user?.role || "").toLowerCase();
  const isSuperUser = roleLower === "super";

  const [docId, setDocId] = useState<string>("context:internal");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<"context" | "snapshot">("context");
  const [contextId, setContextId] = useState("internal");
  const [snapshotId, setSnapshotId] = useState("");
  const [bodyText, setBodyText] = useState(
    safePrettyJson(emptyContextTemplate("internal"))
  );

  const [loadedFrom, setLoadedFrom] = useState<LoadSource>("default");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [statusText, setStatusText] = useState("Ready");
  const [error, setError] = useState("");

  const localKey = `${LOCAL_PREFIX}${docId}`;

  useEffect(() => {
    if (typeof M !== "undefined") {
      try {
        M.AutoInit?.();
        M.Collapsible.init(document.querySelectorAll(".collapsible"), {
          accordion: false,
        });
        document.querySelectorAll("textarea").forEach((el) => {
          M.textareaAutoResize?.(el);
        });
        M.updateTextFields?.();
      } catch {}
    }
  }, [bodyText, type, contextId, snapshotId, docId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        localKey,
        JSON.stringify({
          type,
          contextId,
          snapshotId,
          bodyText,
        })
      );
    } catch {}
  }, [type, contextId, snapshotId, bodyText, localKey]);

  useEffect(() => {
    if (!isSuperUser) return;
    loadDoc(docId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, isSuperUser]);

  async function loadDoc(targetId: string) {
    const cleanId = String(targetId || "").trim();
    if (!cleanId) return;

    setLoading(true);
    setError("");
    setStatusText(`Loading ${cleanId}...`);

    try {
      const data = await apiClient.getAIDoc(cleanId);
      const doc = (data?.doc || {}) as SuperAIDoc;

      setType(doc.type || "context");
      setContextId(doc.contextId || "");
      setSnapshotId(doc.snapshotId || "");
      setBodyText(safePrettyJson(doc.body || {}));
      setLastSavedAt(doc.updatedAt || doc.createdAt || "");
      setLoadedFrom("server");
      setStatusText(`Loaded ${cleanId} from server`);

      try {
        localStorage.setItem(
          `${LOCAL_PREFIX}${cleanId}`,
          JSON.stringify({
            type: doc.type || "context",
            contextId: doc.contextId || "",
            snapshotId: doc.snapshotId || "",
            bodyText: safePrettyJson(doc.body || {}),
          })
        );
      } catch {}
    } catch (err: any) {
      const msg = String(err?.message || "");
      const draft = localStorage.getItem(`${LOCAL_PREFIX}${cleanId}`);

      if (msg.toLowerCase().includes("not-found")) {
        const meta = inferDocMeta(cleanId);
        setType(meta.type);
        setContextId(meta.contextId);
        setSnapshotId(meta.snapshotId);
        setBodyText(
          safePrettyJson(
            meta.type === "context"
              ? emptyContextTemplate(meta.contextId)
              : emptySnapshotTemplate(meta.snapshotId)
          )
        );
        setLoadedFrom("default");
        setLastSavedAt("");
        setError("");
        setStatusText(`New document: ${cleanId} (not saved yet)`);
        setLoading(false);
        return;
      }

      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setType(parsed.type || "context");
          setContextId(parsed.contextId || "");
          setSnapshotId(parsed.snapshotId || "");
          setBodyText(parsed.bodyText || "{\n  \n}");
          setLoadedFrom("local");
          setStatusText(`Loaded ${cleanId} from local draft`);
          setError(`Server load failed: ${err?.message || "unknown error"}`);
        } catch {
          setLoadedFrom("default");
          setStatusText("Using default state");
          setError(err?.message || "Failed to load document");
        }
      } else {
        setLoadedFrom("default");
        setStatusText("No server doc found, using current state");
        setError(err?.message || "Failed to load document");
      }
    } finally {
      setLoading(false);
    }
  }

  function applyContextTemplate() {
    const nextContextId =
      contextId || docId.replace(/^context:/, "") || "internal";
    setType("context");
    setContextId(nextContextId);
    setSnapshotId("");
    setBodyText(safePrettyJson(emptyContextTemplate(nextContextId)));
    setStatusText("Applied context template");
    M?.toast?.({ html: "Context template applied", classes: "teal" });
  }

  function applySnapshotTemplate() {
    const nextSnapshotId =
      snapshotId || docId.replace(/^snapshot:/, "") || "internal";
    setType("snapshot");
    setContextId("");
    setSnapshotId(nextSnapshotId);
    setBodyText(safePrettyJson(emptySnapshotTemplate(nextSnapshotId)));
    setStatusText("Applied snapshot template");
    M?.toast?.({ html: "Snapshot template applied", classes: "blue" });
  }

  function formatJson() {
    try {
      const parsed = parseJsonSafe(bodyText);
      setBodyText(JSON.stringify(parsed, null, 2));
      setError("");
      setStatusText("JSON formatted");
      M?.toast?.({ html: "JSON formatted", classes: "green" });
    } catch (err: any) {
      setError(err?.message || "Invalid JSON");
      M?.toast?.({ html: "Invalid JSON", classes: "red" });
    }
  }

  function validateJson() {
    try {
      parseJsonSafe(bodyText);
      setError("");
      setStatusText("JSON is valid");
      M?.toast?.({ html: "JSON is valid", classes: "green" });
    } catch (err: any) {
      setError(err?.message || "Invalid JSON");
      setStatusText("JSON validation failed");
      M?.toast?.({ html: "Invalid JSON", classes: "red" });
    }
  }

  async function saveDoc() {
    const cleanId = String(docId || "").trim();
    if (!cleanId) {
      setError("Document ID is required");
      return;
    }

    setSaving(true);
    setError("");
    setStatusText(`Saving ${cleanId}...`);

    try {
      const parsedBody = parseJsonSafe(bodyText);
      const meta = inferDocMeta(cleanId);

      const payload: PutAIDocBody = {
        type: type || meta.type,
        contextId:
          (type || meta.type) === "context"
            ? String(contextId || meta.contextId || "").trim()
            : undefined,
        snapshotId:
          (type || meta.type) === "snapshot"
            ? String(snapshotId || meta.snapshotId || "").trim()
            : undefined,
        body: parsedBody,
      };

      if (!payload.type) {
        throw new Error("Type is required");
      }

      if (payload.type === "context" && !payload.contextId) {
        throw new Error("Context ID is required for context docs");
      }

      if (payload.type === "snapshot" && !payload.snapshotId) {
        throw new Error("Snapshot ID is required for snapshot docs");
      }

      const data = await apiClient.putAIDoc(cleanId, payload);
      const doc = (data?.doc || payload) as SuperAIDoc;

      setType(doc.type || payload.type);
      setContextId(doc.contextId || payload.contextId || "");
      setSnapshotId(doc.snapshotId || payload.snapshotId || "");
      setBodyText(safePrettyJson(doc.body || payload.body));
      setLastSavedAt(doc.updatedAt || doc.createdAt || new Date().toISOString());
      setLoadedFrom("server");
      setStatusText(`${cleanId} saved successfully`);

      try {
        localStorage.setItem(
          localKey,
          JSON.stringify({
            type: doc.type || payload.type,
            contextId: doc.contextId || payload.contextId || "",
            snapshotId: doc.snapshotId || payload.snapshotId || "",
            bodyText: safePrettyJson(doc.body || payload.body),
          })
        );
      } catch {}

      M?.toast?.({ html: "AI doc saved", classes: "green" });
    } catch (err: any) {
      setError(err?.message || "Failed to save");
      setStatusText("Save failed");
      M?.toast?.({ html: err?.message || "Failed to save", classes: "red" });
    } finally {
      setSaving(false);
    }
  }

  function resetCurrentDraft() {
    if (type === "snapshot" || docId.startsWith("snapshot:")) {
      applySnapshotTemplate();
      return;
    }
    applyContextTemplate();
  }

  if (!isSuperUser) {
    return (
      <main
        className="container"
        style={{ paddingTop: 36, paddingBottom: 36, maxWidth: 900 }}
      >
        <div
          className="card"
          style={{
            borderRadius: 24,
            background: "linear-gradient(135deg, #1b1f2a 0%, #111827 100%)",
            color: "#fff",
            overflow: "hidden",
          }}
        >
          <div className="card-content" style={{ padding: 32 }}>
            <span className="card-title" style={{ fontWeight: 800 }}>
              Super AI Console
            </span>
            <p style={{ color: "rgba(255,255,255,0.78)", marginTop: 12 }}>
              You do not have access to this page.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="container"
      style={{ paddingTop: 24, paddingBottom: 36, maxWidth: 1240 }}
    >
      <style>{`
        .super-ai-shell{
          color:#eef2ff;
        }
        .super-ai-hero{
          position:relative;
          overflow:hidden;
          border-radius:28px;
          padding:28px;
          background:
            radial-gradient(circle at top right, rgba(59,130,246,0.28), transparent 32%),
            radial-gradient(circle at bottom left, rgba(16,185,129,0.18), transparent 28%),
            linear-gradient(135deg, #0f172a 0%, #111827 42%, #1e293b 100%);
          box-shadow: 0 24px 60px rgba(0,0,0,0.28);
          border:1px solid rgba(255,255,255,0.08);
        }
        .super-ai-glass{
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 22px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.18);
          backdrop-filter: blur(10px);
        }
        .super-ai-stat{
          padding:16px 18px;
          border-radius:18px;
          background: rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.08);
          min-height:96px;
        }
        .super-ai-pill{
          display:inline-flex;
          align-items:center;
          gap:8px;
          padding:8px 12px;
          border-radius:999px;
          background:rgba(255,255,255,0.08);
          border:1px solid rgba(255,255,255,0.08);
          color:#dbeafe;
          font-size:12px;
          font-weight:700;
          letter-spacing:.04em;
          text-transform:uppercase;
        }
        .super-ai-card{
          border-radius:24px;
          overflow:hidden;
          background: linear-gradient(180deg, rgba(15,23,42,0.98), rgba(17,24,39,0.98));
          border:1px solid rgba(255,255,255,0.07);
          box-shadow: 0 20px 45px rgba(0,0,0,0.22);
        }
        .super-ai-card .card-content{
          padding:24px;
        }
        .super-ai-btn-row{
          display:flex;
          flex-wrap:wrap;
          gap:10px;
        }
        .super-ai-btn{
          border:none;
          border-radius:14px;
          padding:10px 14px;
          font-weight:700;
          cursor:pointer;
        }
        .super-ai-btn.primary{ background:#2563eb; color:white; }
        .super-ai-btn.success{ background:#059669; color:white; }
        .super-ai-btn.warn{ background:#d97706; color:white; }
        .super-ai-btn.soft{
          background:rgba(255,255,255,0.07);
          color:#e5e7eb;
          border:1px solid rgba(255,255,255,0.08);
        }
        .super-ai-input,
        .super-ai-textarea,
        .super-ai-select{
          width:100%;
          background: rgba(255,255,255,0.06) !important;
          border:1px solid rgba(255,255,255,0.08) !important;
          border-radius:16px !important;
          color:#fff !important;
          padding:0 14px !important;
          box-sizing:border-box !important;
        }
        .super-ai-input, .super-ai-select{
          height:46px !important;
          margin:0 !important;
        }
        .super-ai-textarea{
          min-height:560px !important;
          padding:14px !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
          white-space:pre !important;
          resize:vertical !important;
        }
        .super-ai-label{
          display:block;
          margin-bottom:8px;
          font-weight:700;
          color:#cbd5e1;
        }
        .super-ai-error{
          background:rgba(220,38,38,0.14);
          color:#fecaca;
          border:1px solid rgba(248,113,113,0.28);
          border-radius:16px;
          padding:14px 16px;
        }
        .super-ai-success{
          background:rgba(16,185,129,0.12);
          color:#bbf7d0;
          border:1px solid rgba(52,211,153,0.22);
          border-radius:16px;
          padding:14px 16px;
        }
        .collapsible,
        .collapsible-header,
        .collapsible-body{
          border:none !important;
          box-shadow:none !important;
          background:transparent !important;
        }
        .collapsible-header{
          color:#f8fafc;
          font-weight:800;
          border-radius:18px;
          background:rgba(255,255,255,0.05) !important;
          margin-bottom:10px;
        }
        .collapsible-body{
          padding:8px 0 0 0 !important;
        }
      `}</style>

      <div className="super-ai-shell">
        <section className="super-ai-hero">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ maxWidth: 760 }}>
              <div className="super-ai-pill">Super Access Only</div>
              <h4 style={{ margin: "14px 0 10px 0", fontWeight: 900 }}>
                Super AI Console
              </h4>
              <p style={{ margin: 0, color: "rgba(226,232,240,0.78)", lineHeight: 1.65 }}>
                Manage context and snapshot documents directly from Dynamo-backed
                admin APIs. This page uses the AI doc GET/PUT endpoints and keeps a
                local draft backup.
              </p>
            </div>

            <div className="super-ai-glass" style={{ padding: 16, minWidth: 280 }}>
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Session</div>
              <div style={{ color: "rgba(226,232,240,0.72)", fontSize: 14 }}>
                User: <b style={{ color: "#fff" }}>{user?.username || "unknown"}</b>
              </div>
              <div style={{ color: "rgba(226,232,240,0.72)", fontSize: 14, marginTop: 6 }}>
                Role: <b style={{ color: "#86efac" }}>{String(user?.role || "").toUpperCase()}</b>
              </div>
              <div style={{ color: "rgba(226,232,240,0.72)", fontSize: 14, marginTop: 6 }}>
                Source: <b style={{ color: "#93c5fd" }}>{loadedFrom}</b>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginTop: 22,
            }}
          >
            <div className="super-ai-stat">
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                Active Doc
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8 }}>{docId}</div>
            </div>

            <div className="super-ai-stat">
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                Type
              </div>
              <div style={{ fontWeight: 900, fontSize: 20, marginTop: 8 }}>{type || "—"}</div>
            </div>

            <div className="super-ai-stat">
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                Status
              </div>
              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 8 }}>{statusText}</div>
            </div>

            <div className="super-ai-stat">
              <div style={{ fontSize: 12, textTransform: "uppercase", color: "rgba(226,232,240,0.72)" }}>
                Last Saved
              </div>
              <div style={{ fontWeight: 900, fontSize: 16, marginTop: 8 }}>
                {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : "Not yet"}
              </div>
            </div>
          </div>
        </section>

        <ul className="collapsible popout" style={{ marginTop: 22 }}>
          <li className="active">
            <div className="collapsible-header">
              <i className="material-icons">tune</i>
              Document Controls
            </div>

            <div className="collapsible-body">
              <div className="super-ai-card">
                <div className="card-content">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr",
                      gap: 16,
                    }}
                  >
                    <div>
                      <label className="super-ai-label">Document ID</label>
                      <input
                        className="super-ai-input"
                        value={docId}
                        onChange={(e) => setDocId(e.target.value)}
                        placeholder="context:internal"
                      />
                    </div>

                    <div>
                      <label className="super-ai-label">Type</label>
                      <select
                        className="super-ai-select browser-default"
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as "context" | "snapshot")
                        }
                      >
                        <option value="context">context</option>
                        <option value="snapshot">snapshot</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "end" }}>
                      <button
                        className="super-ai-btn soft"
                        style={{ width: "100%" }}
                        onClick={() => loadDoc(docId.trim())}
                        disabled={loading || !docId.trim()}
                        type="button"
                      >
                        {loading ? "Loading..." : "Reload Document"}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className="super-ai-label">Quick Documents</div>
                    <div className="super-ai-btn-row">
                      {QUICK_DOCS.map((d) => (
                        <button
                          key={d.id}
                          className="super-ai-btn soft"
                          onClick={() => setDocId(d.id)}
                          type="button"
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <div className="super-ai-label">Quick Templates</div>
                    <div className="super-ai-btn-row">
                      <button
                        className="super-ai-btn primary"
                        type="button"
                        onClick={applyContextTemplate}
                      >
                        Context Template
                      </button>
                      <button
                        className="super-ai-btn success"
                        type="button"
                        onClick={applySnapshotTemplate}
                      >
                        Snapshot Template
                      </button>
                      <button
                        className="super-ai-btn warn"
                        type="button"
                        onClick={resetCurrentDraft}
                      >
                        Reset Current Draft
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li className="active">
            <div className="collapsible-header">
              <i className="material-icons">description</i>
              Metadata
            </div>

            <div className="collapsible-body">
              <div className="super-ai-card">
                <div className="card-content">
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                      gap: 16,
                    }}
                  >
                    <div>
                      <label className="super-ai-label">Context ID</label>
                      <input
                        className="super-ai-input"
                        value={contextId}
                        onChange={(e) => setContextId(e.target.value)}
                        placeholder="internal / vaibhav / flukegames"
                        disabled={type !== "context"}
                      />
                    </div>

                    <div>
                      <label className="super-ai-label">Snapshot ID</label>
                      <input
                        className="super-ai-input"
                        value={snapshotId}
                        onChange={(e) => setSnapshotId(e.target.value)}
                        placeholder="internal / public / personal"
                        disabled={type !== "snapshot"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li className="active">
            <div className="collapsible-header">
              <i className="material-icons">code</i>
              Body JSON
            </div>

            <div className="collapsible-body">
              <div className="super-ai-card">
                <div className="card-content">
                  {error ? (
                    <div className="super-ai-error" style={{ marginBottom: 16 }}>
                      {error}
                    </div>
                  ) : (
                    <div className="super-ai-success" style={{ marginBottom: 16 }}>
                      Editing <b>{docId}</b> · source <b>{loadedFrom}</b>
                    </div>
                  )}

                  <div className="super-ai-btn-row" style={{ marginBottom: 14 }}>
                    <button className="super-ai-btn soft" type="button" onClick={formatJson}>
                      Format JSON
                    </button>
                    <button className="super-ai-btn soft" type="button" onClick={validateJson}>
                      Validate JSON
                    </button>
                    <button
                      className="super-ai-btn primary"
                      type="button"
                      onClick={saveDoc}
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Document"}
                    </button>
                  </div>

                  <textarea
                    className="super-ai-textarea"
                    value={bodyText}
                    onChange={(e) => setBodyText(e.target.value)}
                    placeholder="{ }"
                  />
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </main>
  );
}