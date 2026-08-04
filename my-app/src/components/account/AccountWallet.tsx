import { useEffect, useMemo, useState } from "react";
import FgcAmount from "../credits/FgcAmount";
import FrozenFgcAmount from "../credits/FrozenFgcAmount";
import SelfInitiateWallet from "../wallet/SelfInitiateWallet";
import { getWalletState, getWalletStateMeta } from "../wallet/walletState";
import HowItWorksDialog, { type HowItWorksSlide } from "../shared/HowItWorksDialog";

declare const M: any;

function safeStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtDate(value?: string) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccountWallet({ api, user }: { api: any; user: any }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  async function loadWallet() {
    try {
      setError("");
      setLoading(true);
      const walletResp = await api.getWalletBootstrap();
      setWallet(walletResp?.wallet || null);
      setTransactions(Array.isArray(walletResp?.transactions) ? walletResp.transactions : []);
    } catch (e: any) {
      setWallet(null);
      setTransactions([]);
      setError(String(e?.message || "Failed to load wallet"));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadWallet();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanceCents = useMemo(() => safeNum(wallet?.balance_cents), [wallet]);
  const frozenBalanceCents = useMemo(() => safeNum(wallet?.frozen_balance_cents), [wallet]);
  const combinedWalletCents = useMemo(
    () => Math.max(0, balanceCents + frozenBalanceCents),
    [balanceCents, frozenBalanceCents]
  );
  const spendableShare = useMemo(() => {
    if (combinedWalletCents <= 0) return 0;
    return Math.max(0, Math.min(100, (balanceCents / combinedWalletCents) * 100));
  }, [balanceCents, combinedWalletCents]);
  const frozenShare = useMemo(() => Math.max(0, 100 - spendableShare), [spendableShare]);
  const combinedWalletLabel = useMemo(
    () =>
      `${new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(combinedWalletCents / 100)} FGC`,
    [combinedWalletCents]
  );
  const frozenStreakWeeks = useMemo(() => safeNum(wallet?.frozen_release_streak_weeks), [wallet]);
  const frozenWeeklyReleaseCents = useMemo(() => {
    const balance = Math.max(0, frozenBalanceCents);
    const releasePercent = Math.max(0, 5 + 2.5 * Math.max(0, frozenStreakWeeks));
    const computed = releasePercent > 0 ? Math.round((balance * releasePercent) / 100) : 0;
    return Math.min(balance, Math.max(balance > 0 && releasePercent > 0 ? 1 : 0, computed));
  }, [frozenBalanceCents, frozenStreakWeeks]);
  const history = useMemo(() => {
    return Array.isArray(transactions) ? transactions.slice().sort((a, b) => String(b?.created_at || "").localeCompare(String(a?.created_at || ""))) : [];
  }, [transactions]);
  async function refresh() {
    try {
      setRefreshing(true);
      await loadWallet();
      M?.toast?.({ html: "Wallet refreshed.", classes: "green" });
    } catch {}
    setRefreshing(false);
  }

  const walletState = getWalletState(wallet);
  const walletStateMeta = getWalletStateMeta(wallet);
  const isDormantWallet = walletState === "dormant" || walletState === "missing";
  const walletId = safeStr(wallet?.wallet_id || user?.username || user?.sub || "unknown");
  const howWorksSlides: HowItWorksSlide[] = [
    {
      title: "Why Commitment Exists",
      eyebrow: "Step 1 of 3",
      subtitle: "The commitment amount helps keep the system fair, trustworthy, and tied to real participation.",
      icon: "account_balance_wallet",
      bulletIcons: ["verified_user", "savings", "trending_up"],
      accent: "#1d4ed8",
      tone: "linear-gradient(180deg, rgba(239,246,255,.98), rgba(255,255,255,.98))",
      bullets: [
        "We collect a commitment amount to confirm intent, protect the shared rewards pool, and keep the program fair for everyone.",
        "The amount is not lost. It is held safely, tracked in Frozen FGC, and earned back over time through participation.",
        "Steady weekly updates help it vest back into spendable value, and diligent contributors can often recover more than the original start amount.",
      ],
      note: "This structure keeps the system trustworthy: money is held, tracked, and earned back through clear rules instead of disappearing.",
      sideTitle: "Why it exists",
      sideRows: [
        { label: "Trust", value: "Locked and tracked", color: "#1d4ed8" },
        { label: "Use", value: "Frozen pool + rewards", color: "#0f766e" },
        { label: "Return", value: "Earn back over time", color: "#166534" },
        { label: "Fairness", value: "Shared rules for everyone", color: "#b45309" },
      ],
    },
    {
      title: "See how credits move",
      eyebrow: "Step 2 of 3",
      subtitle: "Spendable FGC is the live balance, and Frozen FGC vests back into spendable credits as you keep participating.",
      icon: "sync_alt",
      bulletIcons: ["calendar_month", "smart_toy", "auto_graph"],
      accent: "#0f766e",
      tone: "linear-gradient(180deg, rgba(236,253,245,.98), rgba(255,255,255,.98))",
      bullets: [
        "Weekly update = 20 FGC, Retro = 20 FGC, Timesheet = 10 FGC.",
        "Submit via AI can add reward FGC when approved, and awards or achievements can add more Frozen FGC.",
        "Frozen release starts at 5% and grows by 2.5% per streak week.",
      ],
      note: "Weekly participation creates the live balance first, then the frozen pool vests gradually so the wallet stays fair and predictable.",
      sideTitle: "What moves where",
      sideRows: [
        { label: "Spendable FGC", value: `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceCents / 100)} FGC`, color: "#1d4ed8" },
        { label: "Frozen FGC", value: `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(frozenBalanceCents / 100)} FGC`, color: "#0369a1" },
        { label: "Weekly release preview", value: `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(frozenWeeklyReleaseCents / 100)} FGC`, color: "#0f766e" },
      ],
    },
    {
      title: "Earn more over time",
      eyebrow: "Step 3 of 3",
      subtitle: "Consistency can help you earn beyond the starting amount through rewards, bonuses, and continued participation.",
      icon: "trending_up",
      bulletIcons: ["workspace_premium", "redeem", "storefront", "card_giftcard", "rocket_launch"],
      accent: "#b45309",
      tone: "linear-gradient(180deg, rgba(255,251,235,.98), rgba(255,255,255,.98))",
      bullets: [
        "Onboarding, client wins, awards, achievements, file uploads, AI fills, and connection bonuses go to Frozen FGC.",
        "Submit via AI and award-based rewards can add extra Frozen FGC or immediate reward FGC depending on the rule.",
        "Spendable FGC can be used immediately in the Fluke Store.",
        "Eligible frozen credits can later be redeemed for Amazon Credits.",
        "A diligent contributor can end up with more value than they started with.",
      ],
      note: "The system rewards steady participation, so the wallet can grow beyond the original commitment amount.",
      sideTitle: "Redeem paths",
      sideRows: [
        { label: "Fluke Store", value: "Merchandise", color: "#1d4ed8" },
        { label: "Amazon", value: "Credits", color: "#b45309" },
        { label: "Udemy", value: "Credits", color: "#7c3aed" },
        { label: "Private lessons", value: "Professional sessions", color: "#0f766e" },
      ],
    },
  ];

  return (
    <section className="panelCard" style={{ background: "#fff" }}>
      <div className="panelHead">
        <div>
          <div className="h">Wallet</div>
          <div className="p">Secure Fluke Game Credits ledger routed through ue-auth to ue-payment-service</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <HowItWorksDialog
            title="How it works"
            subtitle="Spendable FGC is your live wallet. Frozen FGC vests over time, and steady participation can help you earn beyond the starting amount."
            slides={howWorksSlides}
            triggerClassName="accBtn subtle"
          />
          <button type="button" className="accBtn subtle" onClick={() => void refresh()} disabled={refreshing}>
            <i className="material-icons" style={{ fontSize: 18 }}>
              {refreshing ? "hourglass_top" : "refresh"}
            </i>
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <style>{`
        .walletGuideGrid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 960px){
          .walletGuideGrid{ grid-template-columns: 1fr; }
        }
        .walletGuideCard{
          border-radius: 16px;
          border: 1px solid #e6edf2;
          background: #fff;
          padding: 14px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.05);
          display:grid;
          gap: 10px;
        }
        .walletGuideHead{
          display:flex;
          align-items:center;
          gap: 10px;
          min-width: 0;
        }
        .walletGuideIcon{
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display:grid;
          place-items:center;
          background: #f1f5f9;
          border: 1px solid #e6edf2;
          flex: 0 0 auto;
        }
        .walletGuideIcon i{
          font-size: 20px;
          color: #0f172a;
        }
        .walletGuideTitle{
          font-weight: 1000;
          color: #0f172a;
          font-size: 14px;
          line-height: 1.1;
        }
        .walletGuideSub{
          margin-top: 3px;
          color:#607d8b;
          font-size: 12px;
          line-height: 1.45;
        }
        .walletChipRow{
          display:flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .walletChip{
          display:inline-flex;
          align-items:center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e6edf2;
          color:#334155;
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: .5px;
        }
        .walletChip.green{
          background: rgba(34,197,94,.10);
          color:#166534;
          border-color: rgba(34,197,94,.18);
        }
        .walletChip.blue{
          background: rgba(59,130,246,.10);
          color:#1d4ed8;
          border-color: rgba(59,130,246,.18);
        }
        .walletChip.amber{
          background: rgba(245,158,11,.12);
          color:#92400e;
          border-color: rgba(245,158,11,.20);
        }
        .walletFlow{
          margin-top: 12px;
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          padding: 14px;
        }
        .walletFlowTitle{
          font-weight: 1000;
          color:#0f172a;
          font-size: 13px;
          margin-bottom: 10px;
        }
        .walletFlowRow{
          display:grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 900px){
          .walletFlowRow{ grid-template-columns: 1fr; }
        }
        .walletFlowStep{
          border-radius: 14px;
          border: 1px solid #dbe5ef;
          background: #fff;
          padding: 12px;
          min-height: 92px;
          display:grid;
          gap: 6px;
        }
        .walletFlowStep .n{
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
        }
        .walletFlowStep .t{
          font-size: 13px;
          font-weight: 1000;
          color:#0f172a;
        }
        .walletFlowStep .d{
          font-size: 12px;
          color:#607d8b;
          line-height: 1.45;
        }
        .walletMeterGrid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 960px){
          .walletMeterGrid{ grid-template-columns: 1fr; }
        }
        .walletMeter{
          border-radius: 18px;
          border: 1px solid #e6edf2;
          background: #fff;
          padding: 14px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.05);
          display:grid;
          gap: 10px;
        }
        .walletMeterTop{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 10px;
        }
        .walletMeterLabel{
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
        }
        .walletMeterValue{
          margin-top: 4px;
          font-size: 13px;
          font-weight: 900;
          color:#0f172a;
        }
        .walletMeterNote{
          font-size: 12px;
          color:#64748b;
          line-height: 1.45;
        }
        .walletJourney{
          display:grid;
          grid-template-columns: minmax(0, 1.1fr) 28px minmax(0, 1fr) 28px minmax(0, 1fr);
          gap: 0;
          align-items: stretch;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          background: linear-gradient(180deg, #fbfdff 0%, #f8fbff 100%);
          overflow: hidden;
        }
        @media (max-width: 960px){
          .walletJourney{
            grid-template-columns: 1fr;
          }
          .walletJourneyArrow{
            display:none !important;
          }
        }
        .walletJourneyItem{
          padding: 14px 16px;
          display:grid;
          gap: 8px;
          min-height: 108px;
          align-content: start;
        }
        .walletJourneyItem.primary{
          background: linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(239,246,255,.95) 100%);
        }
        .walletJourneyItem.frozen{
          background: linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(240,249,255,.95) 100%);
        }
        .walletJourneyItem.release{
          background: linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(236,253,245,.95) 100%);
        }
        .walletJourneyHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }
        .walletJourneyLabel{
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .6px;
          text-transform: uppercase;
          color:#64748b;
        }
        .walletJourneyValue{
          font-size: 18px;
          font-weight: 1000;
          color:#0f172a;
          line-height: 1.1;
        }
        .walletJourneySub{
          font-size: 12px;
          color:#64748b;
          line-height: 1.45;
        }
        .walletJourneyArrow{
          display:grid;
          place-items:center;
          color:#94a3b8;
          background: linear-gradient(180deg, rgba(241,245,249,.9), rgba(248,250,252,.95));
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
        .walletJourneyArrow i{
          font-size: 20px;
        }
        .walletNote{
          margin-top: 12px;
          border-radius: 16px;
          border: 1px dashed #cfd9e5;
          background: #fbfdff;
          padding: 12px 14px;
          color:#475569;
          font-size: 12.5px;
          line-height: 1.55;
        }
        .walletHowWorksShell{
          border-radius: 24px;
          border: 1px solid rgba(59,130,246,.16);
          background:
            radial-gradient(700px 260px at 10% -10%, rgba(59,130,246,.12), transparent 52%),
            linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          box-shadow: 0 24px 60px rgba(15,23,42,.08);
          padding: 18px;
          display: grid;
          gap: 16px;
        }
        .walletHowWorksTop{
          display:flex;
          justify-content:space-between;
          align-items:flex-start;
          gap: 12px;
          flex-wrap:wrap;
        }
        .walletHowWorksTitle{
          font-size: 24px;
          font-weight: 1000;
          color:#0f172a;
          line-height: 1.05;
        }
        .walletHowWorksSub{
          margin-top: 6px;
          color:#64748b;
          font-size: 13px;
          line-height: 1.5;
          max-width: 780px;
        }
        .walletHowWorksStepBadge{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(37,99,235,.08);
          border: 1px solid rgba(37,99,235,.18);
          color:#1d4ed8;
          font-size: 12px;
          font-weight: 1000;
          white-space: nowrap;
        }
        .walletHowWorksStage{
          display:grid;
          grid-template-columns: minmax(0, 1.35fr) minmax(280px, .85fr);
          gap: 14px;
          align-items: stretch;
        }
        @media (max-width: 960px){
          .walletHowWorksStage{ grid-template-columns: 1fr; }
        }
        .walletHowWorksPane{
          border-radius: 22px;
          border: 1px solid #dbe5ef;
          padding: 16px;
          background: var(--pane-bg, #fff);
          display:grid;
          gap: 14px;
          min-height: 280px;
        }
        .walletHowWorksPaneHead{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .walletHowWorksKicker{
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .7px;
          text-transform: uppercase;
          color:#1d4ed8;
        }
        .walletHowWorksStepTitle{
          font-size: 22px;
          font-weight: 1000;
          color:#0f172a;
          line-height: 1.1;
          margin-top: 4px;
        }
        .walletHowWorksStepSub{
          margin-top: 8px;
          color:#475569;
          font-size: 13px;
          line-height: 1.55;
          max-width: 620px;
        }
        .walletHowWorksBadge{
          display:inline-flex;
          align-items:center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #fff;
          border: 1px solid rgba(148,163,184,.24);
          color:#334155;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 10px 18px rgba(15,23,42,.05);
        }
        .walletHowWorksBody{
          display:grid;
          grid-template-columns: minmax(0, 1fr) minmax(220px, .72fr);
          gap: 12px;
          align-items: start;
        }
        @media (max-width: 960px){
          .walletHowWorksBody{ grid-template-columns: 1fr; }
        }
        .walletHowWorksBullets{
          margin: 0;
          padding-left: 18px;
          display:grid;
          gap: 10px;
          color:#334155;
          font-size: 13px;
          line-height: 1.5;
        }
        .walletHowWorksBullets li{
          animation: walletLineFade 520ms ease both;
          opacity: 0;
          transform: translateY(6px);
        }
        .walletHowWorksBullets li::marker{
          color: #1d4ed8;
          font-weight: 900;
        }
        @keyframes walletLineFade{
          from{
            opacity: 0;
            transform: translateY(8px);
            filter: blur(2px);
          }
          to{
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }
        .walletHowWorksHero{
          border-radius: 20px;
          border: 1px solid rgba(148,163,184,.18);
          background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.98));
          padding: 14px;
          display:grid;
          gap: 10px;
        }
        .walletHowWorksHeroIcon{
          width: 70px;
          height: 70px;
          border-radius: 24px;
          display:grid;
          place-items:center;
          background: linear-gradient(180deg, rgba(59,130,246,.14), rgba(59,130,246,.08));
          border: 1px solid rgba(59,130,246,.18);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 14px 24px rgba(37,99,235,.12);
        }
        .walletHowWorksHeroIcon i{
          font-size: 36px;
          color:#1d4ed8;
        }
        .walletHowWorksMetricGrid{
          display:grid;
          gap: 8px;
        }
        .walletHowWorksMetric{
          border-radius: 14px;
          border: 1px solid #e6edf2;
          background:#fff;
          padding: 10px 12px;
          display:flex;
          justify-content:space-between;
          gap: 12px;
          align-items:center;
        }
        .walletHowWorksMetric .l{
          color:#64748b;
          font-size: 11px;
          font-weight: 1000;
          letter-spacing: .6px;
          text-transform: uppercase;
        }
        .walletHowWorksMetric .r{
          color:#0f172a;
          font-size: 13px;
          font-weight: 1000;
          text-align:right;
        }
        .walletHowWorksTimeline{
          display:grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        .walletHowWorksTimelineItem{
          border-radius: 14px;
          border: 1px solid #e6edf2;
          background: #fff;
          padding: 10px 12px;
          display:grid;
          gap: 6px;
          min-height: 72px;
          grid-template-columns: minmax(0, 1fr) auto;
          align-items: center;
        }
        .walletHowWorksTimelineItem .a{
          font-size: 11px;
          font-weight: 1000;
          color:#64748b;
          letter-spacing: .5px;
          text-transform: uppercase;
        }
        .walletHowWorksTimelineItem .b{
          font-size: 14px;
          font-weight: 1000;
          color:#0f172a;
          text-align: right;
        }
        .walletHowWorksTimelineItem .c{
          font-size: 12px;
          color:#64748b;
          grid-column: 1 / -1;
        }
        .walletHowWorksTabs{
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 960px){
          .walletHowWorksTabs{ grid-template-columns: 1fr; }
        }
        .walletHowWorksTab{
          border-radius: 18px;
          border: 1px solid #dbe5ef;
          background: #fff;
          padding: 12px;
          cursor: pointer;
          text-align:left;
          display:grid;
          gap: 8px;
          min-height: 92px;
          box-shadow: 0 10px 18px rgba(15,23,42,.04);
        }
        .walletHowWorksTab.active{
          border-color: rgba(29,78,216,.28);
          background: linear-gradient(180deg, rgba(239,246,255,.96), rgba(255,255,255,.99));
          box-shadow: 0 16px 28px rgba(29,78,216,.08);
        }
        .walletHowWorksTab .k{
          font-size: 11px;
          font-weight: 1000;
          color:#64748b;
          letter-spacing: .6px;
          text-transform: uppercase;
        }
        .walletHowWorksTab .t{
          font-size: 13px;
          font-weight: 1000;
          color:#0f172a;
        }
        .walletHowWorksTab .s{
          font-size: 12px;
          color:#64748b;
          line-height: 1.45;
        }
        .walletHowWorksFooter{
          display:flex;
          justify-content:space-between;
          gap: 12px;
          align-items:center;
          flex-wrap: wrap;
          padding-top: 2px;
        }
        .walletHowWorksSummary{
          display:grid;
          gap: 8px;
          color:#0f172a;
          font-size: 13px;
          font-weight: 800;
        }
        .walletHowWorksSummaryRow{
          display:flex;
          align-items:center;
          gap: 10px;
          color:#334155;
          font-size: 12.5px;
          font-weight: 700;
        }
        .walletHowWorksSummaryRow i{
          color:#1d4ed8;
          font-size: 18px;
        }
        .walletHowWorksActions{
          display:flex;
          gap: 10px;
          align-items:center;
          margin-left: auto;
        }
        .walletHowWorksNav{
          border-radius: 999px;
          border: 1px solid #cfd9e5;
          background:#fff;
          color:#0f172a;
          font-size: 12px;
          font-weight: 900;
          padding: 10px 14px;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          cursor:pointer;
        }
        .walletHowWorksNav.primary{
          border-color: rgba(29,78,216,.20);
          background: linear-gradient(180deg, #2f6cf6 0%, #1d4ed8 100%);
          color:#fff;
          box-shadow: 0 14px 24px rgba(29,78,216,.22);
        }
        .walletHowWorksModalOverlay{
          position: fixed;
          inset: 0;
          z-index: 1200;
          background: rgba(15,23,42,.72);
          backdrop-filter: blur(10px);
          display: grid;
          place-items: center;
          padding: 18px;
        }
        .walletHowWorksModal{
          width: min(1040px, 96vw);
          max-height: min(90vh, 980px);
          overflow: auto;
          border-radius: 32px;
          background:
            radial-gradient(700px 280px at 15% 0%, rgba(59,130,246,.12), transparent 55%),
            linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 36px 100px rgba(2,6,23,.55);
          padding: 20px;
          display: grid;
          gap: 14px;
        }
        .walletHowWorksModalHeader{
          display:flex;
          justify-content:space-between;
          gap: 14px;
          align-items:flex-start;
          flex-wrap: wrap;
        }
        .walletHowWorksModalClose{
          width: 42px;
          height: 42px;
          border-radius: 999px;
          border: 1px solid #dbe5ef;
          background: #fff;
          color:#0f172a;
          display:grid;
          place-items:center;
          cursor:pointer;
          flex: 0 0 auto;
        }
        .walletHowWorksModalClose i{
          font-size: 20px;
        }
        .walletHowWorksModalStage{
          grid-template-columns: 1fr !important;
        }
      `}</style>

      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div
          style={{
            borderRadius: 20,
            border: "1px solid rgba(59,130,246,0.16)",
            background:
              "radial-gradient(700px 280px at 12% -20%, rgba(59,130,246,0.14), transparent 55%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            padding: 24,
            display: "grid",
            gap: 16,
            minHeight: 320,
          }}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                <img
                  src="/logos/FlukeVault.png"
                  alt="Fluke Games Vault"
                  style={{
                    width: 124,
                    height: 124,
                    objectFit: "contain",
                    flex: "0 0 auto",
                    filter: "drop-shadow(0 10px 18px rgba(15,23,42,.16))",
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
                    FlukeVault
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginTop: 4, lineHeight: 1.35 }}>
                    Secure wallet value, vesting, and store access in one vault view.
                  </div>
                  <div style={{ fontSize: 40, lineHeight: 1.05, fontWeight: 1000, color: "#0f172a", marginTop: 10 }}>
                    {loading ? (
                      "Loading..."
                    ) : (
                      <span>{combinedWalletLabel}</span>
                    )}
                  </div>
                </div>
              </div>
              <div
                style={{
                  minWidth: 190,
                  textAlign: "right",
                  display: "grid",
                  gap: 4,
                  alignItems: "center",
                  justifyItems: "end",
                }}
              >
                <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                  <i className="material-icons" style={{ color: "#ea580c", fontSize: 44, lineHeight: 1 }}>local_fire_department</i>
                  <div style={{ fontSize: 44, lineHeight: 1, fontWeight: 1000, color: "#0f172a" }}>
                    {loading ? "..." : frozenStreakWeeks}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  week{frozenStreakWeeks === 1 ? "" : "s"} in streak
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#64748b" }}>
              <span>
                Wallet ID: <span style={{ fontWeight: 900, color: "#0f172a" }}>{walletId}</span>
              </span>
              <span
                style={{
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                  background: walletStateMeta.bg,
                  color: walletStateMeta.color,
                  border: `1px solid ${walletStateMeta.border}`,
                }}
              >
                {walletStateMeta.label}
              </span>
            </div>

            {isDormantWallet ? (
              <div
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(148,163,184,0.24)",
                  background: "linear-gradient(180deg, rgba(248,250,252,.98) 0%, rgba(241,245,249,.98) 100%)",
                  padding: 20,
                  boxShadow: "0 18px 38px rgba(15,23,42,.06), inset 0 1px 0 rgba(255,255,255,.8)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
                      Dormant wallet
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 1000, color: "#475569" }}>
                      <span>{combinedWalletLabel}</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                      <i className="material-icons" style={{ color: "#64748b", fontSize: 34, lineHeight: 1 }}>lock</i>
                      <div style={{ fontSize: 13, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
                        Locked
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Wallet is not active yet</div>
                  </div>
                </div>

                <div
                  aria-label="Dormant wallet balance slider"
                  title={`Dormant wallet holding ${combinedWalletLabel}`}
                  style={{
                    position: "relative",
                    height: 64,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.26)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.8) 0%, rgba(241,245,249,.95) 100%)",
                    boxShadow:
                      "inset 0 2px 4px rgba(255,255,255,.95), inset 0 -8px 18px rgba(15,23,42,.08), 0 14px 26px rgba(15,23,42,.08)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 5,
                      borderRadius: 999,
                      background: "linear-gradient(90deg, #94a3b8 0%, #cbd5e1 100%)",
                      width: "100%",
                      boxShadow: "inset 0 2px 2px rgba(255,255,255,.35), inset 0 -10px 16px rgba(0,0,0,.08)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "grid",
                      placeItems: "center",
                      color: "#334155",
                      fontWeight: 1000,
                      letterSpacing: ".05em",
                      textTransform: "uppercase",
                      gap: 6,
                    }}
                  >
                    <i className="material-icons" style={{ fontSize: 28, color: "#475569" }}>lock</i>
                    <span style={{ fontSize: 12 }}>Dormant balance locked</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 22,
                  border: "1px solid rgba(148,163,184,0.22)",
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(248,251,255,.98) 100%)",
                  padding: 20,
                  boxShadow:
                    "0 18px 38px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.85)",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
                      Spendable FGC
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 1000, color: "#b45309" }}>
                      <FgcAmount amount={balanceCents} style={{ fontSize: 24, fontWeight: 1000, color: "#b45309" }} iconSize={84} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 1000, color: "#64748b", textTransform: "uppercase", letterSpacing: ".6px" }}>
                      Frozen FFC
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 1000, color: "#1d4ed8" }}>
                      <FrozenFgcAmount amount={frozenBalanceCents} style={{ fontSize: 24, fontWeight: 1000, color: "#1d4ed8" }} iconSize={84} />
                    </div>
                  </div>
                </div>

                <div
                  aria-label="Combined wallet balance slider"
                  title={`Spendable ${spendableShare.toFixed(0)}% and Frozen ${frozenShare.toFixed(0)}%`}
                  style={{
                    position: "relative",
                    height: 64,
                    borderRadius: 999,
                    overflow: "hidden",
                    border: "1px solid rgba(148,163,184,0.28)",
                    background:
                      "linear-gradient(180deg, rgba(255,255,255,.55) 0%, rgba(255,255,255,.18) 22%, rgba(15,23,42,.02) 100%)",
                    boxShadow:
                      "inset 0 2px 4px rgba(255,255,255,.95), inset 0 -8px 18px rgba(15,23,42,.14), 0 14px 26px rgba(15,23,42,.12)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 5,
                      borderRadius: "999px 0 0 999px",
                      background: "linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)",
                      width: `calc(${Math.max(0, Math.min(100, spendableShare))}%)`,
                      boxShadow: "inset 0 2px 2px rgba(255,255,255,.40), inset 0 -10px 16px rgba(0,0,0,.10)",
                      transition: "width .35s ease",
                      zIndex: 1,
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: 5,
                      bottom: 5,
                      left: `calc(${Math.max(0, Math.min(100, spendableShare))}% )`,
                      right: 5,
                      borderRadius: "0 999px 999px 0",
                      background: "linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)",
                      boxShadow: "inset 0 2px 2px rgba(255,255,255,.18), inset 0 -10px 16px rgba(0,0,0,.14)",
                      zIndex: 2,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {isDormantWallet ? (
            <div className="walletJourney">
              <div className="walletJourneyItem primary" style={{ background: "linear-gradient(180deg, rgba(248,250,252,.98), rgba(241,245,249,.99))" }}>
                <div className="walletJourneyHead">
                  <div className="walletJourneyLabel">Dormant balance</div>
                  <i className="material-icons" style={{ color: "#64748b", fontSize: 24 }}>lock</i>
                </div>
                <div className="walletJourneyValue" style={{ color: "#475569" }}>
                  {combinedWalletLabel}
                </div>
                <div className="walletJourneySub">All credits stay dormant until the wallet is activated.</div>
              </div>
            </div>
          ) : (
            <div className="walletJourney">
              <div className="walletJourneyItem primary">
                <div className="walletJourneyHead">
                  <div className="walletJourneyLabel">Live balance</div>
                  <i className="material-icons" style={{ color: "#1d4ed8", fontSize: 24 }}>payments</i>
                </div>
                <div className="walletJourneyValue">
                  <FgcAmount amount={balanceCents} style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }} iconSize={28} />
                </div>
                <div className="walletJourneySub">Spendable now in the Fluke Store or for approved deductions.</div>
              </div>
              <div className="walletJourneyArrow" aria-hidden="true">
                <i className="material-icons">arrow_forward</i>
              </div>
              <div className="walletJourneyItem frozen">
                <div className="walletJourneyHead">
                  <div className="walletJourneyLabel">Frozen balance</div>
                  <i className="material-icons" style={{ color: "#0369a1", fontSize: 24 }}>ac_unit</i>
                </div>
                <div className="walletJourneyValue">
                  <FrozenFgcAmount amount={frozenBalanceCents} style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }} iconSize={28} />
                </div>
                <div className="walletJourneySub">Held back for vesting, awards, commitment, and long-term incentives.</div>
              </div>
              <div className="walletJourneyArrow" aria-hidden="true">
                <i className="material-icons">arrow_forward</i>
              </div>
              <div className="walletJourneyItem release">
                <div className="walletJourneyHead">
                  <div className="walletJourneyLabel">This week&apos;s release</div>
                  <i className="material-icons" style={{ color: "#0f766e", fontSize: 24 }}>ssid_chart</i>
                </div>
                <div className="walletJourneyValue">
                  <FrozenFgcAmount amount={frozenWeeklyReleaseCents} style={{ fontSize: 18, fontWeight: 1000, color: "#0f172a" }} iconSize={28} />
                </div>
                <div className="walletJourneySub">Expected to vest from frozen into spendable when the weekly streak holds.</div>
              </div>
            </div>
          )}

        </div>

        {error ? (
          <div className="emptyState" style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error && (walletState === "missing" || walletState === "dormant") ? (
          <SelfInitiateWallet
            api={api}
            title={walletState === "dormant" ? "Activate dormant wallet" : "Self-initiate wallet"}
            description={
              walletState === "dormant"
                ? "Your wallet already exists, but it is still dormant. Enter the commitment amount and transaction ID here to activate it and start the wallet flow."
                : "Create your wallet by entering the commitment amount and transaction ID. This records the first activation transaction and starts the wallet flow."
            }
            onCompleted={() => void loadWallet()}
          />
        ) : null}

        {walletState === "available" || walletState === "frozen" ? (
        <div className="accDetails">
          <details>
            <summary className="accSummary">
              <div className="accordionBar">
                <div className="accordionTitle">
                  <i className="material-icons">receipt_long</i>
                  <div>
                    <div className="t">Transaction history</div>
                    <div className="s">Credits added, deducted, and wallet adjustments for this account.</div>
                  </div>
                </div>
                <i className="material-icons" style={{ color: "#64748b" }}>keyboard_arrow_down</i>
              </div>
            </summary>
            <div className="accordionBody">
              <div style={{ display: "grid", gap: 10 }}>
                {loading ? (
                  <div className="emptyState">Loading transactions...</div>
                ) : history.length ? (
                  history.map((tx) => {
                    const amount = safeNum(tx?.amount_cents);
                    const isDebit = amount < 0;
                    const meta = tx?.meta || {};
                    const txKind = safeStr(
                      tx?.credit_type ||
                      tx?.meta?.credit_type ||
                      tx?.meta?.creditType ||
                      tx?.source ||
                      tx?.reason ||
                      ""
                    ).toLowerCase();
                    const isFrozenTx =
                      txKind.includes("frozen") ||
                      txKind.includes("vest") ||
                      txKind.includes("freeze") ||
                      txKind.includes("commitment") ||
                      txKind.includes("award");
                    const isLateWeeklyUpdate =
                      safeStr(meta?.submissionType).toLowerCase() === "weekly_update" &&
                      (Boolean(meta?.lateSubmission) || Number(meta?.rewardMultiplier || 1) < 1);
                    return (
                      <div
                        key={String(tx?.transaction_id || tx?.created_at || Math.random())}
                        style={{
                          border: "1px solid rgba(148,163,184,.18)",
                          borderRadius: 16,
                          padding: 14,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          flexWrap: "wrap",
                          background: isDebit ? "rgba(248,113,113,.04)" : "rgba(34,197,94,.04)",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 900, color: "#0f172a" }}>
                            {tx?.reason || (isDebit ? "Wallet deduction" : "Wallet credit")}
                            {isLateWeeklyUpdate ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginLeft: 8,
                                  padding: "3px 8px",
                                  borderRadius: 999,
                                  background: "rgba(245,158,11,.12)",
                                  color: "#b45309",
                                  fontSize: 10,
                                  fontWeight: 1000,
                                  verticalAlign: "middle",
                                }}
                              >
                                LATE 40%
                              </span>
                            ) : null}
                          </div>
                          {isLateWeeklyUpdate ? (
                            <div style={{ marginTop: 4, color: "#b45309", fontSize: 11, fontWeight: 800 }}>
                              Partial reward only. No streak or weekly vesting was applied.
                            </div>
                          ) : null}
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            {fmtDate(tx?.created_at)} Â· {tx?.source || "system"}{tx?.actor ? ` Â· ${tx.actor}` : ""}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                            Tx ID: {safeStr(tx?.transaction_id || "-")}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontWeight: 1000,
                              color: isDebit ? "#b91c1c" : "#166534",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span>{isDebit ? "-" : "+"}</span>
                            {isFrozenTx ? (
                              <FrozenFgcAmount
                                amount={Math.abs(amount)}
                                style={{ fontWeight: 1000, color: isDebit ? "#b91c1c" : "#166534" }}
                                iconSize={30}
                              />
                            ) : (
                              <FgcAmount
                                amount={Math.abs(amount)}
                                style={{ fontWeight: 1000, color: isDebit ? "#b91c1c" : "#166534" }}
                                iconSize={30}
                              />
                            )}
                          </div>
                          <div
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              marginTop: 6,
                              padding: "4px 10px",
                              borderRadius: 999,
                              background: isFrozenTx ? "rgba(37,99,235,.08)" : "rgba(245,158,11,.08)",
                              color: isFrozenTx ? "#1d4ed8" : "#b45309",
                              fontSize: 11,
                              fontWeight: 900,
                            }}
                          >
                            <i className="material-icons" style={{ fontSize: 14 }}>
                              {isFrozenTx ? "ac_unit" : "paid"}
                            </i>
                            {isFrozenTx ? "Frozen FGC" : "FGC"}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                            Balance after:{" "}
                            {new Intl.NumberFormat("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(safeNum(tx?.balance_after_cents) / 100)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="emptyState">No wallet transactions yet.</div>
                )}
              </div>
            </div>
          </details>
        </div>
        ) : null}

        </div>

    </section>
  );
}
