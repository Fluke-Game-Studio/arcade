import { useState } from "react";

type StorageItem = { key: string; lastModified?: string; size: number; url?: string; uploadedBy?: string };

type Props = {
  items: StorageItem[];
  loading: boolean;
  prefix: string;
  bucket: string;
  truncated: boolean;
  cursor: string;
  error: string;
  nameFilter: string;
  minSizeMb: string;
  maxSizeMb: string;
  uploadedFrom: string;
  uploadedTo: string;
  dateSort: "asc" | "desc";
  onPrefixChange: (value: string) => void;
  onNameFilterChange: (value: string) => void;
  onMinSizeMbChange: (value: string) => void;
  onMaxSizeMbChange: (value: string) => void;
  onUploadedFromChange: (value: string) => void;
  onUploadedToChange: (value: string) => void;
  onDateSortChange: (value: "asc" | "desc") => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onDelete: (item: StorageItem) => Promise<void>;
  formatBytesMb: (bytes: number) => string;
  isPreviewable: (item: StorageItem) => boolean;
  filteredCount: number;
};

export default function SuperStorageTab({
  items,
  loading,
  prefix,
  bucket,
  truncated,
  cursor,
  error,
  nameFilter,
  minSizeMb,
  maxSizeMb,
  uploadedFrom,
  uploadedTo,
  dateSort,
  onPrefixChange,
  onNameFilterChange,
  onMinSizeMbChange,
  onMaxSizeMbChange,
  onUploadedFromChange,
  onUploadedToChange,
  onDateSortChange,
  onRefresh,
  onLoadMore,
  onDelete,
  formatBytesMb,
  isPreviewable,
  filteredCount,
}: Props) {
  const [previewItem, setPreviewItem] = useState<StorageItem | null>(null);

  function parseUploadedBy(item: StorageItem) {
    if (item.uploadedBy) return item.uploadedBy;
    const parts = String(item.key || "").split("/").filter(Boolean);
    const uploaderPart = parts.length >= 5 ? parts[parts.length - 2] : "";
    if (!uploaderPart) return "Unknown";
    const cleaned = uploaderPart.replace(/_/g, " ");
    return cleaned || "Unknown";
  }

  return (
    <>
      <div className="suCard">
        <div className="card-content">
          <span className="card-title" style={{ fontWeight: 1000 }}>
            Storage Files {loading ? "(Loading...)" : `(${filteredCount}/${items.length})`}
          </span>
          <p className="grey-text" style={{ marginTop: 0 }}>
            Browse the weekly upload S3 bucket and delete files directly from Super.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input
                value={prefix}
                onChange={(e) => onPrefixChange(e.target.value)}
                placeholder="Optional prefix filter, e.g. weekly-updates/"
              />
              <label className="active">Prefix filter</label>
            </div>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input value={nameFilter} onChange={(e) => onNameFilterChange(e.target.value)} placeholder="Contains text..." />
              <label className="active">Name contains</label>
            </div>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input value={minSizeMb} onChange={(e) => onMinSizeMbChange(e.target.value)} inputMode="decimal" placeholder="0" />
              <label className="active">Min size (MB)</label>
            </div>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input value={maxSizeMb} onChange={(e) => onMaxSizeMbChange(e.target.value)} inputMode="decimal" placeholder="Any" />
              <label className="active">Max size (MB)</label>
            </div>
            <button
              type="button"
              className="btn"
              onClick={onRefresh}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 12, alignItems: "end" }}>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input value={uploadedFrom} onChange={(e) => onUploadedFromChange(e.target.value)} type="date" />
              <label className="active">Uploaded from</label>
            </div>
            <div className="input-field" style={{ minWidth: 0, marginTop: 0 }}>
              <input value={uploadedTo} onChange={(e) => onUploadedToChange(e.target.value)} type="date" />
              <label className="active">Uploaded to</label>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: "#475569", textTransform: "uppercase" }}>Date sort</span>
              <div style={{ display: "inline-flex", border: "1px solid rgba(148,163,184,.22)", borderRadius: 999, overflow: "hidden", background: "#fff" }}>
                <button
                  type="button"
                  onClick={() => onDateSortChange("asc")}
                  style={{
                    border: 0,
                    padding: "10px 12px",
                    background: dateSort === "asc" ? "rgba(59,130,246,.12)" : "#fff",
                    color: dateSort === "asc" ? "#1d4ed8" : "#334155",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Asc
                </button>
                <button
                  type="button"
                  onClick={() => onDateSortChange("desc")}
                  style={{
                    border: 0,
                    padding: "10px 12px",
                    background: dateSort === "desc" ? "rgba(59,130,246,.12)" : "#fff",
                    color: dateSort === "desc" ? "#1d4ed8" : "#334155",
                    fontWeight: 900,
                    cursor: "pointer",
                    borderLeft: "1px solid rgba(148,163,184,.22)",
                  }}
                >
                  Desc
                </button>
              </div>
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#64748b", fontWeight: 700, marginBottom: 12 }}>
            Bucket: {bucket || "Not loaded"} {truncated ? "• More files available" : ""}
          </div>

          {error ? (
            <div style={{ marginBottom: 12, borderRadius: 12, padding: 12, background: "rgba(248,113,113,.10)", color: "#991b1b", fontWeight: 800 }}>
              {error}
            </div>
          ) : null}

          {items.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 12 }}>
              {items.map((item) => {
                const sizeMb = formatBytesMb(item.size);
                const fileName = item.key.split("/").pop() || item.key;
                const ext = (fileName.split(".").pop() || "").toUpperCase();
                const previewable = isPreviewable(item);
                const uploadedBy = parseUploadedBy(item);
                return (
                  <div
                    key={item.key}
                    style={{
                      border: "1px solid rgba(148,163,184,.18)",
                      borderRadius: 18,
                      background: "#fff",
                      overflow: "hidden",
                      boxShadow: "0 10px 24px rgba(15,23,42,.05)",
                      minHeight: 235,
                      display: "grid",
                      gridTemplateRows: "132px auto",
                      cursor: "pointer",
                    }}
                    onClick={() => setPreviewItem(item)}
                  >
                    <div
                      style={{
                        background: "linear-gradient(180deg, rgba(248,250,252,.96), rgba(226,232,240,.72))",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ textAlign: "center", color: "#64748b", fontWeight: 900, padding: 12 }}>
                        <i className="material-icons" style={{ fontSize: 30 }}>
                          {previewable ? "visibility" : "insert_drive_file"}
                        </i>
                        <div style={{ fontSize: 12, marginTop: 6 }}>{previewable ? "Preview on click" : ext || "FILE"}</div>
                      </div>
                    </div>

                    <div style={{ padding: 12, display: "grid", gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#0f172a", wordBreak: "break-word", lineHeight: 1.35 }}>
                        {fileName}
                      </div>
                      <div style={{ color: "#64748b", fontSize: 11, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        By {uploadedBy}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", color: "#64748b", fontSize: 11, fontWeight: 800 }}>
                        <span>{sizeMb}</span>
                        <span>{item.lastModified || "?"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: "#1d4ed8" }}>Click to preview</span>
                        <button
                          type="button"
                          className="btn-small red"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm(`Delete ${item.key}?`)) return;
                            await onDelete(item);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="grey-text">{loading ? "Loading..." : "No files found."}</p>
          )}

          {truncated ? (
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn-flat" onClick={onLoadMore} disabled={!cursor || loading}>
                Load more
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {previewItem ? (
        <div
          onClick={() => setPreviewItem(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15,23,42,.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 96vw)",
              maxHeight: "92vh",
              background: "#fff",
              borderRadius: 22,
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,.35)",
              display: "grid",
              gridTemplateRows: "auto 1fr auto",
            }}
          >
            <div style={{ padding: 16, borderBottom: "1px solid rgba(148,163,184,.18)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", textTransform: "uppercase" }}>Preview</div>
                <div style={{ fontSize: 16, fontWeight: 1000, color: "#0f172a", wordBreak: "break-word" }}>{previewItem.key}</div>
              </div>
              <button type="button" className="btn-flat" onClick={() => setPreviewItem(null)}>
                Close
              </button>
            </div>
            <div style={{ background: "#e2e8f0", display: "grid", placeItems: "center", minHeight: 420 }}>
              {previewItem.url && /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(previewItem.key) ? (
                <video src={previewItem.url} controls autoPlay style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", background: "#000" }} />
              ) : previewItem.url ? (
                <img src={previewItem.url} alt={previewItem.key} style={{ width: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }} />
              ) : (
                <div style={{ color: "#64748b", fontWeight: 800, padding: 24 }}>No preview available.</div>
              )}
            </div>
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderTop: "1px solid rgba(148,163,184,.18)" }}>
              <div style={{ color: "#475569", fontWeight: 700 }}>Size: <b>{formatBytesMb(previewItem.size)}</b></div>
              <div style={{ color: "#475569", fontWeight: 700 }}>Uploaded by: <b>{parseUploadedBy(previewItem)}</b></div>
              <div style={{ color: "#475569", fontWeight: 700 }}>Last modified: <b>{previewItem.lastModified || "?"}</b></div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
