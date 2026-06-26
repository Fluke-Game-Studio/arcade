type Props = {
  releaseRows: any[];
  isSuperUser: boolean;
  savingProductKey: string;
  onToggleReleaseVisibility: (row: any, shouldBeVisible: boolean) => Promise<void>;
  onSavingKeyChange: (key: string) => void;
  safeStr: (value: any) => string;
};

export default function SuperReleasesTab({ releaseRows, isSuperUser, savingProductKey, onToggleReleaseVisibility, onSavingKeyChange, safeStr }: Props) {
  return (
    <div className="suCard">
      <div className="card-content">
        <span className="card-title" style={{ fontWeight: 1000 }}>Releases & Products ({releaseRows.length})</span>
        <p className="grey-text" style={{ marginTop: 0 }}>
          Disable a release/product to hide it from main website download views.
        </p>
        {releaseRows.length === 0 ? (
          <p className="grey-text">No releases/products found.</p>
        ) : (
          <table className="highlight responsive-table">
            <thead>
              <tr>
                <th>Product</th><th>Project</th><th>Release Status</th><th>Version</th><th>Current State</th><th>Website</th>
              </tr>
            </thead>
            <tbody>
              {releaseRows.map((r: any) => {
                const actionKey = r.key;
                const isVisible = r.isVisible;
                return (
                  <tr key={r.key}>
                    <td><b>{r.name}</b><div style={{ fontSize: 12, color: "#64748b" }}>{r.product_id}</div></td>
                    <td>{r.project_id}</td>
                    <td>{safeStr(r.release_status || "internal").toUpperCase()}</td>
                    <td>{r.channel}<div style={{ fontSize: 12, color: "#64748b" }}>{safeStr((r as any).platform || "all")}</div></td>
                    <td>{safeStr(r.status || "active").toUpperCase()}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-small"
                        style={{ background: isVisible ? "#ef4444" : "#16a34a" }}
                        disabled={!isSuperUser || savingProductKey === actionKey}
                        onClick={async () => {
                          onSavingKeyChange(actionKey);
                          try {
                            await onToggleReleaseVisibility(r, !isVisible);
                          } finally {
                            onSavingKeyChange("");
                          }
                        }}
                      >
                        {savingProductKey === actionKey ? "Saving..." : isVisible ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
