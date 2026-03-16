// src/components/AwardsStudioNarrative.tsx
import { useState } from "react";
import type { ApiClient, GenerateAwardsNarrativeResponse } from "../api";

declare const M: any;

type Props = {
  api: ApiClient;
  username?: string;
  weekStart?: string;
  projectId?: string;
  defaultQuestion?: string;
};

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export default function AwardsStudioNarrative({
  api,
  username = "",
  weekStart = "",
  projectId = "",
  defaultQuestion = "",
}: Props) {
  const [question, setQuestion] = useState(
    defaultQuestion ||
      "Create a polished narrative about how the studio functions, how recognition works here, and what the awards say about the team culture."
  );
  const [provider, setProvider] = useState<"auto" | "openai" | "ollama">("auto");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [meta, setMeta] = useState<Record<string, any> | null>(null);

  async function generateNarrative() {
    setLoading(true);
    try {
      let resp: GenerateAwardsNarrativeResponse;

      if (typeof api.generateAwardsNarrative === "function") {
        resp = await api.generateAwardsNarrative({
          question,
          username: safeStr(username) || undefined,
          weekStart: safeStr(weekStart) || undefined,
          projectId: safeStr(projectId) || undefined,
          provider,
          model: safeStr(model) || undefined,
        });
      } else {
        resp = await api.chatOverUpdates({
          question,
          username: safeStr(username) || undefined,
          weekStart: safeStr(weekStart) || undefined,
          projectId: safeStr(projectId) || undefined,
          provider,
          model: safeStr(model) || undefined,
          context: "internal",
        });
      }

      setReply(safeStr(resp?.reply));
      setMeta(resp?.meta || null);

      if (!safeStr(resp?.reply)) {
        M.toast({ html: "No narrative returned", classes: "orange" });
      }
    } catch (err: any) {
      M.toast({ html: err?.message || "Failed to generate narrative", classes: "red" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-content">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <div>
            <span className="card-title" style={{ marginBottom: 4 }}>
              Studio Narrative
            </span>
            <div style={{ color: "#78909c", fontWeight: 700, fontSize: 12 }}>
              AI-generated summary of studio culture, function, and awards
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              className="browser-default"
              value={provider}
              onChange={(e) => setProvider(e.target.value as "auto" | "openai" | "ollama")}
              style={{ minWidth: 120 }}
            >
              <option value="auto">Auto</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama</option>
            </select>

            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Optional model"
              style={{
                width: 170,
                border: "1px solid #cfd8dc",
                borderRadius: 10,
                padding: "0 10px",
                height: 38,
                margin: 0,
              }}
            />

            <button className="btn" type="button" onClick={generateNarrative} disabled={loading}>
              {loading ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        <div className="input-field" style={{ marginTop: 0 }}>
          <textarea
            className="materialize-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ minHeight: 90 }}
          />
          <label className="active">Prompt</label>
        </div>

        {!!meta && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {Object.entries(meta).map(([k, v]) => (
              <span
                key={k}
                style={{
                  border: "1px solid #dbe4ea",
                  background: "#fff",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#455a64",
                }}
              >
                {k}: {safeStr(typeof v === "object" ? JSON.stringify(v) : v)}
              </span>
            ))}
          </div>
        )}

        <div
          style={{
            border: "1px solid #e3edf4",
            borderRadius: 16,
            padding: 16,
            background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
            minHeight: 140,
            whiteSpace: "pre-wrap",
            lineHeight: 1.65,
            color: "#24323d",
            fontWeight: 600,
          }}
        >
          {reply || "No narrative yet."}
        </div>
      </div>
    </div>
  );
}