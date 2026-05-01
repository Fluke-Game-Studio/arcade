import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AccountEditDetails from "../components/account/AccountEditDetails";
import AccountProfileSecurity from "../components/account/AccountProfileSecurity";
import AccountMyUpdates from "../components/account/AccountMyUpdates";
import AccountGamification from "../components/account/AccountGamification";
import AwardUnlockModal from "../components/account/AwardUnlockModal";

declare const M: any;

type AccountTabKey = "updates" | "details" | "password" | "gamification";

export default function Account() {
  const { user, api, refreshSession } = useAuth();
  const [activeTab, setActiveTab] = useState<AccountTabKey>("updates");
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockItems, setUnlockItems] = useState<any[]>([]);

  useEffect(() => {
    if (typeof M !== "undefined") setTimeout(() => M.updateTextFields(), 0);
  }, [activeTab]);

  function showUnlocks(resp: any, achievement: any) {
    const achievementItem =
      resp?.awarded === false
        ? null
        : {
            kind: "achievement",
            id: achievement?.achievementId || achievement?.id,
            title: achievement?.title,
            description: achievement?.description,
            metric: achievement?.metric,
            threshold: achievement?.threshold,
            setKey: achievement?.setKey,
          };
    const trophyItems = Array.isArray(resp?.unlockedTrophies)
      ? resp.unlockedTrophies.map((t: any) => ({
          kind: "trophy",
          id: t?.id,
          title: t?.title,
          description: t?.description,
          tier: t?.tier,
          imageUrl: t?.imageUrl,
          achievementSetKey: t?.achievementSetKey,
        }))
      : [];
    const items = [achievementItem, ...trophyItems].filter((x: any) => !!x?.id || !!x?.title);

    if (items.length) {
      setUnlockItems(items);
      setUnlockOpen(true);
    }
  }

  useEffect(() => {
    function onLinkedInMessage(event: MessageEvent) {
      const data = event?.data || {};
      if (data?.type !== "linkedin-connected") return;

      const achievementId = "linkedin_connect";
      api
        .awardAchievement({
          achievementId,
          title: "Connect To Linked-In",
          description: "Connect to LinkedIn to autofill your profile data.",
          metric: "linkedinSocials",
          setKey: "connectSocials",
          threshold: 1,
        })
        .then((resp: any) => {
          showUnlocks(resp, {
            id: achievementId,
            title: "Connect To Linked-In",
            description: "Connect to LinkedIn to autofill your profile data.",
            metric: "linkedinSocials",
            setKey: "connectSocials",
            threshold: 1,
          });
          void refreshSession();
          if (typeof M !== "undefined") {
            M.toast({ html: "LinkedIn achievement awarded.", classes: "green" });
          }
        })
        .catch((err: any) => {
          if (typeof M !== "undefined") {
            M.toast({
              html: err?.message || "LinkedIn achievement could not be awarded.",
              classes: "orange",
            });
          }
        });
    }

    window.addEventListener("message", onLinkedInMessage);
    return () => window.removeEventListener("message", onLinkedInMessage);
  }, [api, refreshSession]);

  useEffect(() => {
    function onDiscordMessage(event: MessageEvent) {
      const data = event?.data || {};
      if (data?.type !== "discord-connected") return;

      const joinUrl = String(data?.joinUrl || "").trim();
      if (joinUrl) {
        try {
          window.open(joinUrl, "_blank", "noopener,noreferrer");
        } catch {}
      }

      api
        .awardAchievement({
          achievementId: "discord_connect",
          title: "Join Discord Server",
          description: "Connect to the Fluke Games Discord server.",
          metric: "connectSocials",
          setKey: "connectSocials",
          threshold: 1,
        })
        .then((resp: any) => {
          showUnlocks(resp, {
            id: "discord_connect",
            title: "Join Discord Server",
            description: "Connect to the Fluke Games Discord server.",
            metric: "connectSocials",
            setKey: "connectSocials",
            threshold: 1,
          });
          void refreshSession();
          if (typeof M !== "undefined") {
            M.toast({
              html: joinUrl
                ? `Discord connected. <a href="${joinUrl}" target="_blank" rel="noreferrer" class="white-text text-lighten-4">Open server</a>`
                : "Discord achievement awarded.",
              classes: "green",
            });
          }
        })
        .catch((err: any) => {
          if (typeof M !== "undefined") {
            M.toast({
              html: err?.message || "Discord achievement could not be awarded.",
              classes: "orange",
            });
          }
        });
    }

    window.addEventListener("message", onDiscordMessage);
    return () => window.removeEventListener("message", onDiscordMessage);
  }, [api, refreshSession]);

  function TabButton({
    tab,
    icon,
    label,
  }: {
    tab: AccountTabKey;
    icon: string;
    label: string;
  }) {
    const active = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        style={{
          border: active ? "1px solid rgba(37,99,235,0.22)" : "1px solid #dbe5ec",
          background: active
            ? "linear-gradient(135deg, rgba(37,99,235,0.10), rgba(255,255,255,1))"
            : "#fff",
          color: active ? "#1d4ed8" : "#334155",
          borderRadius: 14,
          padding: "10px 14px",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontWeight: 900,
          cursor: "pointer",
          boxShadow: active ? "0 10px 20px rgba(37,99,235,0.08)" : "none",
        }}
      >
        <i className="material-icons" style={{ fontSize: 18 }}>
          {icon}
        </i>
        {label}
      </button>
    );
  }

  return (
    <main className="container" style={{ paddingTop: 22, maxWidth: 1080 }}>
      <style>{`
        .accWrap { animation: accIn 260ms ease both; }
        @keyframes accIn { from { opacity: 0; transform: translateY(8px);} to { opacity:1; transform: translateY(0);} }

        .accHero {
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(148,163,184,0.22);
          background:
            radial-gradient(900px 520px at 18% -30%, rgba(56,189,248,0.22), transparent 55%),
            radial-gradient(800px 520px at 105% 10%, rgba(99,102,241,0.18), transparent 55%),
            linear-gradient(180deg, #0b2544 0%, #071a33 100%);
          box-shadow: 0 22px 70px rgba(0,0,0,0.26);
          position: relative;
        }
        .accHero::after{
          content:"";
          position:absolute; inset:0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transform: translateX(-60%);
          animation: accShimmer 4.4s ease-in-out infinite;
          opacity: .35;
          pointer-events:none;
        }
        @keyframes accShimmer {
          0% { transform: translateX(-60%); }
          45% { transform: translateX(60%); }
          100% { transform: translateX(60%); }
        }
        .accHeroInner{
          padding: 16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
          color: white;
        }

        .accMiniProfile{
          display:flex;
          align-items:center;
          gap: 14px;
          min-width: 0;
        }

        .accAvatar{
          width: 92px; height: 92px;
          border-radius: 26px;
          overflow:hidden;
          border: 2px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.10);
          box-shadow: 0 16px 28px rgba(0,0,0,0.22);
          display:grid;
          place-items:center;
          font-weight: 900;
          letter-spacing: .6px;
          position: relative;
          flex: 0 0 auto;
        }
        .accAvatar img{ width:100%; height:100%; object-fit:cover; display:block; }
        .accDot{
          position:absolute;
          right: 10px; bottom: 10px;
          width: 12px; height: 12px;
          border-radius: 999px;
          background:#22c55e;
          border: 2px solid rgba(7,26,51,0.92);
        }

        .accTitle{
          font-weight: 1000;
          font-size: 18px;
          line-height: 22px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .accSub{
          margin-top: 4px;
          color: rgba(226,232,240,0.82);
          font-size: 12.5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .accPills{
          display:flex;
          align-items:center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content:flex-end;
        }
        .accPill{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.16);
          color: rgba(255,255,255,0.92);
          font-weight: 900;
          font-size: 11px;
          letter-spacing: .6px;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .accPill i{ font-size: 16px; opacity: .95; }
        .accPill.grey{ background: rgba(255,255,255,0.07); }
        .accPill.blue{ background: rgba(59,130,246,0.18); border-color: rgba(59,130,246,0.22); }
        .accPill.green{ background: rgba(34,197,94,0.16); border-color: rgba(34,197,94,0.20); }
        .accPill.amber{ background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.18); }

        .panelCard{ border-radius: 20px; overflow: hidden; border: 1px solid #e6edf2; }
        .panelHead{
          padding: 14px 16px;
          border-bottom: 1px solid #eceff1;
          background: linear-gradient(135deg, #ffffff 0%, #fbfdff 60%, #f7fafc 100%);
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
        }
        .panelHead .h{ font-weight: 1000; color: #0f172a; font-size: 14.5px; }
        .panelHead .p{ margin-top: 2px; color:#607d8b; font-size: 12px; }

        .pulseGreen{ animation: pulseGlow 900ms ease both; }
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 0 rgba(34,197,94,0); }
          45% { box-shadow: 0 0 0 6px rgba(34,197,94,0.12); }
          100% { box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        .tileGrid{
          display:grid;
          grid-template-columns: repeat(2, minmax(0,1fr));
          gap: 12px;
        }
        @media (max-width: 800px){
          .tileGrid{ grid-template-columns: 1fr; }
        }

        .accTile{
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fff;
          padding: 12px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
          transform: translateZ(0);
        }
        .accTile.muted{
          background: linear-gradient(180deg, #fbfdff 0%, #f8fafc 100%);
          border-style: dashed;
          opacity: .92;
        }
        .accTileLeft{
          display:flex;
          align-items:center;
          gap: 12px;
          min-width: 0;
        }
        .accTileIcon{
          width: 44px; height: 44px;
          border-radius: 16px;
          display:grid;
          place-items:center;
          background: #f1f5f9;
          border: 1px solid #e6edf2;
          flex: 0 0 auto;
        }
        .accTileIcon i{ font-size: 19px; color:#0f172a; opacity:.9; }
        .accTileText{ min-width: 0; }
        .accTileLabel{
          font-size: 10.5px;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
          font-weight: 900;
        }
        .accTileValue{
          margin-top: 3px;
          font-size: 13.2px;
          color:#0f172a;
          overflow:hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .accTileValue.dim{ color:#94a3b8; }
        .accTileValue.mono{
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12.4px;
        }

        .accBtn{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.35);
          background: #0b2544;
          color: white;
          font-weight: 900;
          cursor: pointer;
          transition: transform 120ms ease, opacity 120ms ease;
          white-space: nowrap;
        }
        .accBtn i{ font-size: 18px; }
        .accBtn:hover{ transform: translateY(-1px); }
        .accBtn:disabled{ opacity: .55; cursor: not-allowed; transform:none; }
        .accBtn.subtle{
          background: #ffffff;
          color: #0f172a;
          border-color: #e6edf2;
        }

        .accDetails{
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
          overflow: hidden;
        }
        .accDetails + .accDetails{
          margin-top: 12px;
        }
        .accSummary{
          list-style: none;
          cursor: pointer;
        }
        .accSummary::-webkit-details-marker{ display:none; }
        .accDetailsBody{
          padding: 0 12px 12px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
        }

        .editPanel{
          margin-top: 10px;
          border-radius: 16px;
          border: 1px solid #e6edf2;
          background: #fbfdff;
          padding: 12px;
          display:flex;
          gap: 10px;
          align-items:center;
          justify-content:space-between;
        }
        .editPanel .left{ flex: 1 1 auto; min-width:0; }
        .editPanel input{
          margin:0 !important;
          height: 2.65rem !important;
        }
        .editActions{
          display:flex;
          gap: 8px;
          align-items:center;
          flex-wrap: wrap;
          justify-content:flex-end;
        }

        .accStrength {
          height: 8px; border-radius: 999px; overflow: hidden;
          background: #eef2f7; border: 1px solid #e6edf2;
        }
        .accStrength > div {
          height:100%;
          width: var(--w);
          background: linear-gradient(90deg, rgba(239,68,68,0.85), rgba(245,158,11,0.85), rgba(34,197,94,0.85));
          transition: width 160ms ease;
        }

        .accordionBar{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding: 12px 16px;
          border: 1px solid #e6edf2;
          border-radius: 18px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
        }
        .accordionTitle{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width:0;
        }
        .accordionTitle i{ color:#0f172a; opacity:.9; }
        .accordionTitle .t{
          font-weight: 1000;
          color:#0f172a;
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .accordionTitle .s{
          margin-top: 2px;
          color:#607d8b;
          font-size: 12px;
          white-space: nowrap;
          overflow:hidden;
          text-overflow: ellipsis;
        }
        .accordionBody{
          margin-top: 10px;
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fbfdff;
          padding: 12px;
        }

        .weekGroup + .weekGroup{
          margin-top: 14px;
        }
        .weekCard{
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
          box-shadow: 0 10px 22px rgba(0,0,0,0.06);
          overflow: hidden;
        }
        .weekHeader{
          padding: 14px 16px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          border-bottom: 1px solid #eceff1;
        }
        .weekHeaderTitle{
          font-weight: 1000;
          color: #0f172a;
          font-size: 14.5px;
        }
        .weekHeaderSub{
          font-size: 12px;
          color: #607d8b;
          margin-top: 2px;
        }
        .weekMeta{
          display:flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .hoursGrid{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .hoursChip{
          border: 1px solid #e6edf2;
          border-radius: 14px;
          padding: 10px 12px;
          background: #fff;
        }
        .hoursChip .d{
          font-size: 12px;
          color: #607d8b;
          font-weight: 800;
        }
        .hoursChip .h{
          margin-top: 4px;
          font-size: 15px;
          color: #0f172a;
          font-weight: 1000;
        }

        .updateEntry{
          border: 1px solid #e6edf2;
          border-radius: 16px;
          padding: 12px;
          background: #fff;
        }
        .updateEntry + .updateEntry{
          margin-top: 12px;
        }
        .updateHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .updateHeadTitle{
          font-weight: 900;
          color:#0f172a;
        }
        .updateHeadSub{
          font-size: 12px;
          color:#607d8b;
          margin-top: 2px;
        }
        .updateCols{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 900px){
          .updateCols{ grid-template-columns: 1fr; }
        }
        .updateBox{
          border: 1px solid #e6edf2;
          border-radius: 14px;
          padding: 10px 12px;
          background: #fbfdff;
        }
        .updateBox .k{
          font-size: 10.5px;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
          font-weight: 900;
        }
        .updateBox .v{
          margin-top: 6px;
          color:#0f172a;
          font-size: 13px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .emptyState{
          padding: 14px;
          border-radius: 14px;
          border: 1px dashed #d7e0e7;
          background: #fbfdff;
          color:#607d8b;
          font-weight: 800;
        }

        .input-field { margin: 0.2rem 0 0.6rem !important; }
        input:focus { box-shadow: none !important; }

        .accountTabBar{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin: 0 0 14px 0;
        }
      `}</style>

      <div className="accWrap">
        <div className="accountTabBar" style={{ alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
            <TabButton tab="updates" icon="history" label="My Updates" />
            <TabButton tab="details" icon="badge" label="Edit Details" />
            <TabButton tab="password" icon="lock" label="Edit Password" />
            <TabButton tab="gamification" icon="emoji_events" label="Achievements" />
          </div>
        </div>

        {activeTab === "updates" && <AccountMyUpdates api={api} />}

        {activeTab === "details" && (
          <AccountEditDetails user={user} api={api} />
        )}

        {activeTab === "password" && (
          <AccountProfileSecurity user={user} api={api} initialTab="password" />
        )}

        {activeTab === "gamification" && <AccountGamification />}
      </div>
      <AwardUnlockModal open={unlockOpen} items={unlockItems} onClose={() => setUnlockOpen(false)} />
    </main>
  );
}
