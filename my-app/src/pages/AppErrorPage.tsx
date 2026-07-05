import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default function AppErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let title = "Something went wrong";
  let message = "The page hit an unexpected error. You can go back home or reload and try again.";

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText || "Error"}`;
    message = safeStr((error.data as any)?.message || (error.data as any)?.error) || message;
  } else if (error instanceof Error) {
    message = safeStr(error.message) || message;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fbff 0%, #eef4fb 100%)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <section
        style={{
          width: "min(760px, 100%)",
          borderRadius: 28,
          border: "1px solid rgba(148,163,184,.18)",
          background: "rgba(255,255,255,.96)",
          boxShadow: "0 28px 80px rgba(15,23,42,.12)",
          padding: 28,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" }}>
            Fluke Games Portal
          </div>
          <div style={{ fontSize: 34, fontWeight: 1000, color: "#0f172a", lineHeight: 1.1 }}>
            {title}
          </div>
          <div style={{ fontSize: 15, color: "#475569", lineHeight: 1.7 }}>
            {message}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(37,99,235,.18)",
              background: "linear-gradient(135deg, rgba(59,130,246,.16), rgba(37,99,235,.10))",
              color: "#1d4ed8",
              padding: "11px 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Go Home
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,.20)",
              background: "#fff",
              color: "#0f172a",
              padding: "11px 18px",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>

      </section>
    </div>
  );
}
