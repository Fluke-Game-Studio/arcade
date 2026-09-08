import { useAuth } from "../auth/AuthContext";

export default function SessionRefreshOverlay() {
  const { isRefreshing } = useAuth();
  if (!isRefreshing) return null;

  return (
    <div className="session-refresh-overlay" role="status" aria-live="polite" aria-label="Refreshing session">
      <div className="session-refresh-card">
        <img src="/logos/FlukeGames_TM.png" alt="Fluke Games" />
        <div className="session-refresh-title">Checking your session</div>
        <div className="session-refresh-subtitle">Keeping your workspace secure</div>
        <div className="session-refresh-loader"><span /></div>
      </div>
      <style>{`
        .session-refresh-overlay {
          position: fixed;
          inset: 0;
          z-index: 2800;
          display: grid;
          place-items: center;
          padding: 24px;
          background: rgba(2, 6, 23, .72);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .session-refresh-card {
          width: min(360px, 92vw);
          padding: 30px 26px 26px;
          border-radius: 24px;
          text-align: center;
          background: linear-gradient(145deg, rgba(10, 10, 25, .96), rgba(15, 23, 42, .96));
          border: 1px solid rgba(100, 200, 255, .28);
          box-shadow: 0 24px 80px rgba(0, 0, 0, .45), inset 0 0 42px rgba(100, 200, 255, .05);
        }
        .session-refresh-card img { width: 190px; max-width: 72%; display: block; margin: 0 auto 18px; filter: drop-shadow(0 0 22px rgba(100, 200, 255, .3)); }
        .session-refresh-title { color: #e2f2ff; font-size: 17px; font-weight: 900; letter-spacing: .3px; }
        .session-refresh-subtitle { margin-top: 6px; color: #8fb2ca; font-size: 12px; font-weight: 700; }
        .session-refresh-loader { height: 9px; margin-top: 20px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1); }
        .session-refresh-loader span { display: block; width: 55%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #4dd0e1, #00ff88, #64c8ff); animation: sessionRefreshSlide 1.05s ease-in-out infinite alternate; }
        @keyframes sessionRefreshSlide { from { transform: translateX(-25%); } to { transform: translateX(100%); } }
        @media (prefers-reduced-motion: reduce) { .session-refresh-loader span { animation: none; margin-left: 22%; } }
      `}</style>
    </div>
  );
}
