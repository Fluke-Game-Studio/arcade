import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import FgcAmount from "../credits/FgcAmount";
import FrozenFgcAmount from "../credits/FrozenFgcAmount";

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
  const [walletToken, setWalletToken] = useState("");
  const [walletSessionLoading, setWalletSessionLoading] = useState(true);
  const [howWorksStep, setHowWorksStep] = useState(0);
  const [howWorksModalOpen, setHowWorksModalOpen] = useState(false);

  async function ensureWalletSession() {
    try {
      setWalletSessionLoading(true);
      const resp = await api.createWalletSession();
      const token = String(resp?.token || "").trim();
      if (!token) {
        throw new Error("Wallet session token missing.");
      }
      setWalletToken(token);
      return token;
    } catch (e: any) {
      setWalletToken("");
      setError(String(e?.message || "Failed to start wallet session"));
      throw e;
    } finally {
      setWalletSessionLoading(false);
    }
  }

  async function loadWallet(token?: string) {
    const nextToken = String(token || walletToken || "").trim();
    if (!nextToken) return;
    try {
      setError("");
      setLoading(true);
      const [walletResp, txResp] = await Promise.all([
        api.getWalletMeWithToken(nextToken),
        api.getWalletTransactionsWithToken(nextToken).catch(() => ({ ok: true, items: [] })),
      ]);
      setWallet(walletResp?.wallet || null);
      setTransactions(Array.isArray(txResp?.items) ? txResp.items : []);
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
    let cancelled = false;
    (async () => {
      try {
        const token = await ensureWalletSession();
        if (cancelled) return;
        await loadWallet(token);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
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
  const howWorksSlides = useMemo(
    () => [
      {
        title: "Why Commitment Exists",
        eyebrow: "Step 1 of 3",
        subtitle: "The commitment amount helps keep the system fair, trustworthy, and tied to real participation.",
        icon: "account_balance_wallet",
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
    ],
    [balanceCents, combinedWalletLabel, frozenBalanceCents, frozenWeeklyReleaseCents]
  );
  const currentHowWorksSlide = howWorksSlides[Math.min(howWorksSlides.length - 1, Math.max(0, howWorksStep))];

  async function refresh() {
    try {
      setRefreshing(true);
      const token = walletToken || (await ensureWalletSession());
      await loadWallet(token);
      M?.toast?.({ html: "Wallet refreshed.", classes: "green" });
    } catch {}
    setRefreshing(false);
  }

  const status = safeStr(wallet?.status || "missing");
  const walletId = safeStr(wallet?.wallet_id || user?.username || user?.sub || "unknown");

  return (
    <section className="panelCard" style={{ background: "#fff" }}>
      <div className="panelHead">
        <div>
          <div className="h">Wallet</div>
          <div className="p">Secure Fluke Game Credits ledger routed through ue-auth to ue-payment-service</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="accBtn subtle"
            onClick={() => {
              setHowWorksStep(0);
              setHowWorksModalOpen(true);
            }}
          >
            <i className="material-icons" style={{ fontSize: 18 }}>
              help_outline
            </i>
            How it works
          </button>
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
                    {loading || walletSessionLoading ? (
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
                    {loading || walletSessionLoading ? "..." : frozenStreakWeeks}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  week{frozenStreakWeeks === 1 ? "" : "s"} in streak
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              Wallet ID: <span style={{ fontWeight: 900, color: "#0f172a" }}>{walletId}</span>
            </div>

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
          </div>
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

        </div>

        {error ? (
          <div className="emptyState" style={{ borderColor: "#fecaca", color: "#991b1b", background: "#fff5f5" }}>
            {error}
          </div>
        ) : null}

        {!loading && !error && status === "missing" ? (
          <div className="emptyState">
            Your wallet record is not active yet. It will appear automatically once the payment service grants, creates, or syncs your wallet.
          </div>
        ) : null}

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

        <div className="accDetails">
          <details>
            <summary className="accSummary">
              <div className="accordionBar">
                <div className="accordionTitle">
                  <i className="material-icons">shield</i>
                  <div>
                    <div className="t">How this works</div>
                    <div className="s">Spendable FGC, frozen FGC, deductions, and redemptions all live in one wallet model.</div>
                  </div>
                </div>
                <i className="material-icons" style={{ color: "#64748b" }}>keyboard_arrow_down</i>
              </div>
            </summary>
            <div className="accordionBody">
              <div className="walletHowWorksShell">
                <div className="walletHowWorksTop">
                  <div>
                    <div className="walletHowWorksTitle">How it works</div>
                    <div className="walletHowWorksSub">
                      A 3-step journey for your wallet. Spendable FGC is ready now, Frozen FGC vests over time, and consistent weekly participation grows
                      the balance.
                    </div>
                  </div>
                  <div className="walletHowWorksStepBadge">
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      auto_awesome
                    </i>
                    Step {howWorksStep + 1} of {howWorksSlides.length}
                  </div>
                </div>

                <div className="walletHowWorksTabs">
                  {howWorksSlides.map((slide, index) => (
                    <button
                      key={slide.title}
                      type="button"
                      className={`walletHowWorksTab ${index === howWorksStep ? "active" : ""}`}
                      onClick={() => setHowWorksStep(index)}
                    >
                      <div className="k">{slide.eyebrow}</div>
                      <div className="t">{slide.title}</div>
                      <div className="s">{slide.subtitle}</div>
                    </button>
                  ))}
                </div>

                <div className="walletHowWorksStage">
                  <div className="walletHowWorksPane" style={{ background: currentHowWorksSlide.tone }}>
                    <div className="walletHowWorksPaneHead">
                      <div>
                        <div className="walletHowWorksKicker">{currentHowWorksSlide.eyebrow}</div>
                        <div className="walletHowWorksStepTitle">{currentHowWorksSlide.title}</div>
                        <div className="walletHowWorksStepSub">{currentHowWorksSlide.subtitle}</div>
                      </div>
                      <div className="walletHowWorksBadge">
                        <i className="material-icons" style={{ color: currentHowWorksSlide.accent, fontSize: 18 }}>
                          fiber_manual_record
                        </i>
                        {currentHowWorksSlide.title}
                      </div>
                    </div>

                    <div className="walletHowWorksBody">
                      <div>
                        <ul className="walletHowWorksBullets">
                          {currentHowWorksSlide.bullets.map((bullet, index) => (
                            <li
                              key={bullet}
                              style={{
                                animationDelay: `${(currentHowWorksSlide.bullets.length - index - 1) * 90}ms`,
                              }}
                            >
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        <div className="walletChipRow" style={{ marginTop: 12 }}>
                          <span className="walletChip blue">FGC</span>
                          <span className="walletChip green">Frozen FGC</span>
                          <span className="walletChip amber">Vesting</span>
                        </div>
                      </div>

                      <div className="walletHowWorksHero">
                        <div className="walletHowWorksHeroIcon">
                          <i className="material-icons">{currentHowWorksSlide.icon}</i>
                        </div>
                        <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 }}>
                          {currentHowWorksSlide.sideTitle}
                        </div>
                        <div className="walletHowWorksMetricGrid">
                          {currentHowWorksSlide.sideRows.map((row) => (
                            <div className="walletHowWorksMetric" key={row.label}>
                              <div className="l">{row.label}</div>
                              <div className="r" style={{ color: row.color }}>
                                {row.value}
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                          {currentHowWorksSlide.note}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="walletHowWorksPane" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.99))" }}>
                    <div className="walletHowWorksPaneHead">
                      <div>
                        <div className="walletHowWorksKicker">Quick glance</div>
                        <div className="walletHowWorksStepTitle" style={{ fontSize: 18 }}>
                          {howWorksStep === 0 ? "Current balance snapshot" : howWorksStep === 1 ? "Weekly release ladder" : "Where value can go"}
                        </div>
                      </div>
                    </div>

                    {howWorksStep === 0 ? (
                      <div className="walletHowWorksMetricGrid">
                        <div className="walletHowWorksMetric">
                          <div className="l">Spendable FGC</div>
                          <div className="r">{new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceCents / 100)} FGC</div>
                        </div>
                        <div className="walletHowWorksMetric">
                          <div className="l">Frozen FGC</div>
                          <div className="r">{new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(frozenBalanceCents / 100)} FGC</div>
                        </div>
                        <div className="walletHowWorksMetric">
                          <div className="l">Combined wallet</div>
                          <div className="r">{combinedWalletLabel}</div>
                        </div>
                        <div className="walletHowWorksMetric">
                          <div className="l">Wallet streak</div>
                          <div className="r">{frozenStreakWeeks} week(s)</div>
                        </div>
                      </div>
                    ) : howWorksStep === 1 ? (
                      <div className="walletHowWorksTimeline">
                        {[
                          { a: "Weekly update", b: "20 FGC", c: "Creates spendable credits" },
                          { a: "Retro", b: "20 FGC", c: "Adds to the weekly total" },
                          { a: "Timesheet", b: "10 FGC", c: "Completes the 50 FGC week" },
                          { a: "Streak release", b: "5% + 2.5%", c: `Frozen release preview: ${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(frozenWeeklyReleaseCents / 100)} FGC` },
                        ].map((item) => (
                          <div className="walletHowWorksTimelineItem" key={item.a}>
                            <div className="a">{item.a}</div>
                            <div className="b">{item.b}</div>
                            <div className="c">{item.c}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="walletHowWorksTimeline">
                        {[
                          { a: "Fluke Store", b: "Merchandise", c: "Spend immediately" },
                          { a: "Amazon", b: "Credits", c: "Redeem later" },
                          { a: "Udemy", b: "Credits", c: "Redeem later" },
                          { a: "Private lessons", b: "Sessions", c: "Professional support" },
                        ].map((item) => (
                          <div className="walletHowWorksTimelineItem" key={item.a}>
                            <div className="a">{item.a}</div>
                            <div className="b">{item.b}</div>
                            <div className="c">{item.c}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="walletHowWorksFooter">
                  <div className="walletHowWorksSummary">
                    <div className="walletHowWorksSummaryRow">
                      <i className="material-icons">lock</i>
                      <span>The fee moves from locked value to vested value over time.</span>
                    </div>
                    <div className="walletHowWorksSummaryRow">
                      <i className="material-icons">update</i>
                      <span>Weekly participation unlocks more of the frozen pool.</span>
                    </div>
                    <div className="walletHowWorksSummaryRow">
                      <i className="material-icons">trending_up</i>
                      <span>Diligence can help you earn beyond the original commitment.</span>
                    </div>
                  </div>

                  <div className="walletHowWorksActions">
                    <button
                      type="button"
                      className="walletHowWorksNav"
                      onClick={() => setHowWorksStep((value) => Math.max(0, value - 1))}
                      disabled={howWorksStep === 0}
                    >
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        arrow_back
                      </i>
                      Back
                    </button>
                    <button
                      type="button"
                      className="walletHowWorksNav primary"
                      onClick={() => setHowWorksStep((value) => Math.min(howWorksSlides.length - 1, value + 1))}
                    >
                      {howWorksStep === howWorksSlides.length - 1 ? "Continue" : `Next: Step ${howWorksStep + 2}`}
                      <i className="material-icons" style={{ fontSize: 18 }}>
                        arrow_forward
                      </i>
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "none" }}>
              <div className="walletGuideGrid">
                <div className="walletGuideCard">
                  <div className="walletGuideHead">
                    <div className="walletGuideIcon">
                      <i className="material-icons">payments</i>
                    </div>
                    <div>
                      <div className="walletGuideTitle">Spendable FGC</div>
                  <div className="walletGuideSub">This is the live balance you can use right now.</div>
                  </div>
                </div>
                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 14,
                      border: "1px solid rgba(37,99,235,.16)",
                      background: "linear-gradient(180deg, rgba(248,250,255,.96) 0%, rgba(255,255,255,.98) 100%)",
                      padding: 12,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 1000, letterSpacing: 0.5, color: "#64748b", textTransform: "uppercase" }}>
                      Frozen weekly update breakdown
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {[
                        { label: "Weekly update", amount: 20, color: "#2563eb" },
                        { label: "Retro", amount: 20, color: "#0f766e" },
                        { label: "Timesheet", amount: 10, color: "#16a34a" },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: "#fff",
                            border: "1px solid #e6edf2",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: row.color,
                                boxShadow: `0 0 0 4px ${row.color}18`,
                                flex: "0 0 auto",
                              }}
                            />
                            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#334155" }}>{row.label}</div>
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 1000, color: row.color }}>{row.amount} FGC</div>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(37,99,235,.08)",
                        border: "1px solid rgba(37,99,235,.15)",
                        color: "#1e3a8a",
                        fontWeight: 1000,
                      }}
                    >
                      <span>Total frozen earned from weekly update</span>
                      <span>50 FGC</span>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(245,158,11,.18)",
                      background: "rgba(255,251,235,.92)",
                      padding: "10px 12px",
                      color: "#92400e",
                      fontSize: 12.25,
                      lineHeight: 1.5,
                      fontWeight: 700,
                    }}
                  >
                    Missed weekly update penalty: <b>200 FGC</b>. It is deducted from spendable FGC first, then Frozen FGC if needed.
                  </div>
                </div>

                <div className="walletGuideCard">
                  <div className="walletGuideHead">
                    <div className="walletGuideIcon">
                      <i className="material-icons">ac_unit</i>
                    </div>
                    <div>
                      <div className="walletGuideTitle">Frozen FGC</div>
                      <div className="walletGuideSub">Held back and released gradually on a weekly streak.</div>
                    </div>
                  </div>
                  <ul
                    style={{
                      margin: "10px 0 0",
                      paddingLeft: 20,
                      marginLeft: 6,
                      listStyleType: "disc",
                      listStylePosition: "outside",
                      color: "#475569",
                      fontSize: 12.75,
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Frozen credits are held back and vest weekly.</li>
                    <li>Onboarding, client wins, awards, achievements, files, AI fills, and connection bonuses go here.</li>
                    <li>A missed week resets the streak and slows release.</li>
                  </ul>
                </div>

                <div className="walletGuideCard">
                  <div className="walletGuideHead">
                    <div className="walletGuideIcon">
                      <i className="material-icons">redeem</i>
                    </div>
                    <div>
                      <div className="walletGuideTitle">Redemption path</div>
                      <div className="walletGuideSub">Use credits at the store or exchange them when the program completes.</div>
                    </div>
                  </div>
                  <ul
                    style={{
                      margin: "10px 0 0",
                      paddingLeft: 20,
                      marginLeft: 6,
                      listStyleType: "disc",
                      listStylePosition: "outside",
                      color: "#475569",
                      fontSize: 12.75,
                      lineHeight: 1.55,
                    }}
                  >
                    <li>Spendable FGC redeems instantly in the Fluke Store.</li>
                    <li>Eligible frozen FGC can later be exchanged for Amazon Credits.</li>
                  </ul>
                </div>
              </div>

              <div className="walletFlow" style={{ marginTop: 10 }}>
                <div className="walletFlowTitle">Earn path</div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {[
                    {
                      icon: "assignment_turned_in",
                      title: "Onboarding commitment",
                      body: "Starts in Frozen FGC and vests weekly.",
                      note: "Example: 1,000 FGC commitment",
                      tone: "rgba(37,99,235,.08)",
                      accent: "#1d4ed8",
                    },
                    {
                      icon: "workspace_premium",
                      title: "Client wins",
                      body: "Reward value goes to Frozen FGC.",
                      note: "Longer-term program reward",
                      tone: "rgba(14,165,233,.08)",
                      accent: "#0369a1",
                    },
                    {
                      icon: "military_tech",
                      title: "Awards & achievements",
                      body: "Earn Frozen FGC for later release.",
                      note: "Includes AI fills, file uploads, bonuses",
                      tone: "rgba(245,158,11,.10)",
                      accent: "#b45309",
                    },
                    {
                      icon: "update",
                      title: "Weekly updates",
                      body: "Earn the 50 frozen FGC each week before vesting.",
                      note: "20 update + 20 retro + 10 timesheet",
                      tone: "rgba(34,197,94,.10)",
                      accent: "#166534",
                    },
                  ].map((step, index) => (
                    <div
                      key={step.title}
                      style={{
                        borderRadius: 18,
                        border: "1px solid #e6edf2",
                        background: "#fff",
                        padding: 14,
                        boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                        display: "grid",
                        gap: 10,
                        minHeight: 160,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 16,
                            display: "grid",
                            placeItems: "center",
                            background: step.tone,
                            border: "1px solid rgba(148,163,184,.15)",
                            flex: "0 0 auto",
                          }}
                        >
                          <i className="material-icons" style={{ color: step.accent, fontSize: 22 }}>
                            {step.icon}
                          </i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 1000, color: "#64748b", textTransform: "uppercase" }}>
                            Step {index + 1}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 1000, color: "#0f172a" }}>{step.title}</div>
                        </div>
                      </div>
                      <div style={{ color: "#475569", fontSize: 12.5, lineHeight: 1.5 }}>{step.body}</div>
                      <div
                        style={{
                          marginTop: "auto",
                          borderRadius: 12,
                          border: "1px dashed #dbe5ef",
                          background: "#fbfdff",
                          padding: "8px 10px",
                          color: "#64748b",
                          fontSize: 11.5,
                          fontWeight: 800,
                          lineHeight: 1.45,
                        }}
                      >
                        {step.note}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    borderRadius: 16,
                    border: "1px dashed #cfd9e5",
                    background: "#fbfdff",
                    padding: "12px 14px",
                    color: "#475569",
                    fontSize: 12.5,
                    lineHeight: 1.55,
                  }}
                >
                  <b>Rule of thumb:</b> weekly updates add frozen credits first, then vest into spendable FGC on release. Onboarding, client wins, awards,
                  achievements, file uploads, AI-assisted fills, and connection bonuses also accumulate in Frozen FGC and vest over time. Missing a weekly update
                  deducts <b>200 FGC</b> from spendable FGC first, then Frozen FGC if needed.
                </div>
              </div>

              <div className="walletFlow">
                <div className="walletFlowTitle">Credit flow at a glance</div>
                <div className="walletFlowRow">
                  <div className="walletFlowStep">
                    <div className="n">Step 1</div>
                    <div className="t">Earn 50 frozen FGC</div>
                    <div className="d">Weekly update = 20 FGC, retro = 20 FGC, timesheet = 10 FGC. That gives you 50 frozen FGC each successful week before vesting.</div>
                  </div>
                  <div className="walletFlowStep">
                    <div className="n">Step 2</div>
                    <div className="t">Track the frozen split</div>
                    <div className="d">Onboarding commitment, client wins, awards, achievements, file uploads, and connection bonuses go into frozen FGC.</div>
                  </div>
                  <div className="walletFlowStep">
                    <div className="n">Step 3</div>
                    <div className="t">Release frozen credits</div>
                    <div className="d">Frozen release starts at 5% of the frozen balance and increases by 2.5% each successful week in a streak.</div>
                  </div>
                  <div className="walletFlowStep">
                    <div className="n">Step 4</div>
                    <div className="t">Spend or redeem</div>
                    <div className="d">Use spendable FGC in the Fluke Store. When the program is complete, eligible frozen credits can be exchanged for Amazon Credits.</div>
                  </div>
                </div>
              </div>

              <div className="walletFlow">
                <div className="walletFlowTitle">The math behind the wallet</div>
                <div className="walletGuideGrid">
                  <div className="walletGuideCard">
                    <div className="walletGuideHead">
                      <div className="walletGuideIcon">
                        <i className="material-icons">calculate</i>
                      </div>
                      <div>
                        <div className="walletGuideTitle">Spendable FGC</div>
                        <div className="walletGuideSub">What gets added or removed from the live balance.</div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(37,99,235,.16)",
                        background: "linear-gradient(180deg, rgba(248,250,255,.96), rgba(255,255,255,.99))",
                        padding: 12,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      {[
                        { label: "Start balance", amount: "old balance", color: "#64748b" },
                        { label: "Weekly update", amount: "+20 FGC", color: "#2563eb" },
                        { label: "Retro", amount: "+20 FGC", color: "#0f766e" },
                        { label: "Timesheet", amount: "+10 FGC", color: "#16a34a" },
                        { label: "Store spend / penalty", amount: "-20 to -200", color: "#b45309" },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            paddingBottom: 8,
                            borderBottom: "1px solid #eef2f7",
                          }}
                        >
                          <span style={{ color: "#475569", fontSize: 12.5, fontWeight: 800 }}>{row.label}</span>
                          <span style={{ color: row.color, fontSize: 12.5, fontWeight: 1000 }}>{row.amount}</span>
                        </div>
                      ))}
                      <div
                        style={{
                          marginTop: 2,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(37,99,235,.08)",
                          border: "1px solid rgba(37,99,235,.15)",
                          color: "#1e3a8a",
                          fontWeight: 1000,
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <span>Typical frozen weekly total</span>
                        <span>50 FGC</span>
                      </div>
                    </div>
                  </div>

                  <div className="walletGuideCard">
                    <div className="walletGuideHead">
                      <div className="walletGuideIcon">
                        <i className="material-icons">snowflake</i>
                      </div>
                      <div>
                        <div className="walletGuideTitle">Frozen release rate</div>
                        <div className="walletGuideSub">The weekly vesting formula used by the payment service.</div>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 14,
                        border: "1px solid rgba(14,165,233,.16)",
                        background: "linear-gradient(180deg, rgba(247,253,255,.98), rgba(255,255,255,.99))",
                        padding: 12,
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "#fff",
                          border: "1px solid #e6edf2",
                          fontSize: 12.25,
                          color: "#334155",
                          fontWeight: 800,
                        }}
                      >
                        Release formula: <span style={{ color: "#0369a1" }}>5%</span> base + <span style={{ color: "#0369a1" }}>2.5%</span> per successful streak week
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {[
                          "Week 1: 5%",
                          "Week 2: 7.5%",
                          "Week 3: 10%",
                          "Week 4: 12.5%",
                        ].map((item, index) => (
                          <div
                            key={item}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "8px 10px",
                              borderRadius: 12,
                              background: index % 2 === 0 ? "rgba(249,250,251,.95)" : "#fff",
                              border: "1px solid #e6edf2",
                              color: "#0f172a",
                              fontWeight: 900,
                            }}
                          >
                            <span>{item}</span>
                            <span style={{ color: "#0f766e" }}>more streak = more release</span>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "rgba(14,165,233,.08)",
                          border: "1px solid rgba(14,165,233,.15)",
                          color: "#075985",
                          fontSize: 12.25,
                          lineHeight: 1.55,
                          fontWeight: 700,
                        }}
                      >
                        Example: a 1,000 FGC frozen balance releases 50 FGC in week 1, then the release grows from the remaining balance as the streak continues.
                      </div>
                    </div>
                  </div>

                  <div className="walletGuideCard">
                    <div className="walletGuideHead">
                      <div className="walletGuideIcon">
                        <i className="material-icons">timeline</i>
                      </div>
                      <div>
                        <div className="walletGuideTitle">Weekly vesting examples</div>
                        <div className="walletGuideSub">A successful release increases the streak by 1.</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      {[
                        { week: "Week 1", pct: "5%" },
                        { week: "Week 2", pct: "7.5%" },
                        { week: "Week 3", pct: "10%" },
                        { week: "Week 4", pct: "12.5%" },
                      ].map((item, index) => (
                        <div
                          key={item.week}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            padding: "8px 10px",
                            borderRadius: 12,
                            background: index % 2 === 0 ? "rgba(249,250,251,.95)" : "#fff",
                            border: "1px solid #e6edf2",
                          }}
                        >
                          <span style={{ color: "#334155", fontWeight: 900 }}>{item.week}</span>
                          <span style={{ color: "#1d4ed8", fontWeight: 1000 }}>{item.pct}</span>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 12,
                        border: "1px dashed #dbe5ef",
                        background: "#fbfdff",
                        padding: "8px 10px",
                        color: "#64748b",
                        fontSize: 11.5,
                        fontWeight: 800,
                      }}
                    >
                      More successful weeks mean a bigger vesting percentage on the remaining frozen balance.
                    </div>
                  </div>
                </div>
              </div>

              <div className="walletNote">
                <b>Simple rule of thumb:</b> weekly updates create the 50 frozen FGC each week, then the vesting release moves part of the frozen
                balance into spendable FGC. Everything else you mentioned flows into frozen FGC and vests over time. Missing a weekly update deducts
                <b>200 FGC</b> from spendable FGC first, then from Frozen FGC if spendable balance is not enough. The wallet ledger records every
                credit, deduction, and release so you can always see how the balance changed.
              </div>
            </div></div>
          </details>
        </div>

        {howWorksModalOpen && typeof document !== "undefined"
          ? createPortal(
            <div
              className="walletHowWorksModalOverlay"
              role="dialog"
              aria-modal="true"
              aria-label="How it works"
              onClick={() => setHowWorksModalOpen(false)}
            >
              <div className="walletHowWorksModal" onClick={(event) => event.stopPropagation()}>
              <div className="walletHowWorksModalHeader">
                <div style={{ display: "grid", gap: 8, maxWidth: 820 }}>
                  <div className="walletHowWorksTitle">How it works</div>
                  <div className="walletHowWorksSub">
                    Spendable FGC is your live wallet. Frozen FGC vests over time, and steady participation can help you earn beyond the starting amount.
                  </div>
                </div>
                <button type="button" className="walletHowWorksModalClose" onClick={() => setHowWorksModalOpen(false)}>
                  <i className="material-icons">close</i>
                </button>
              </div>

              <div className="walletHowWorksStepBadge" style={{ width: "fit-content" }}>
                <i className="material-icons" style={{ fontSize: 18 }}>
                  auto_awesome
                </i>
                Step {howWorksStep + 1} of {howWorksSlides.length}
              </div>

              <div className="walletHowWorksTabs">
                {howWorksSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    className={`walletHowWorksTab ${index === howWorksStep ? "active" : ""}`}
                    onClick={() => setHowWorksStep(index)}
                  >
                    <div className="k">{slide.eyebrow}</div>
                    <div className="t">{slide.title}</div>
                    <div className="s">{slide.subtitle}</div>
                  </button>
                ))}
              </div>

              <div className="walletHowWorksStage walletHowWorksModalStage">
                <div className="walletHowWorksPane" style={{ background: currentHowWorksSlide.tone, minHeight: 460 }}>
                  <div className="walletHowWorksPaneHead">
                    <div>
                      <div className="walletHowWorksKicker">{currentHowWorksSlide.eyebrow}</div>
                      <div className="walletHowWorksStepTitle">{currentHowWorksSlide.title}</div>
                      <div className="walletHowWorksStepSub">{currentHowWorksSlide.subtitle}</div>
                    </div>
                    <div className="walletHowWorksBadge">
                      <i className="material-icons" style={{ color: currentHowWorksSlide.accent, fontSize: 18 }}>
                        fiber_manual_record
                      </i>
                      {currentHowWorksSlide.title}
                    </div>
                  </div>

                  <div className="walletHowWorksBody">
                    <div>
                      <ul className="walletHowWorksBullets">
                        {currentHowWorksSlide.bullets.map((bullet, index) => (
                          <li
                            key={bullet}
                            style={{
                              animationDelay: `${(currentHowWorksSlide.bullets.length - index - 1) * 90}ms`,
                            }}
                          >
                            {bullet}
                          </li>
                        ))}
                      </ul>
                      <div className="walletChipRow" style={{ marginTop: 12 }}>
                        <span className="walletChip blue">FGC</span>
                        <span className="walletChip green">Frozen FGC</span>
                        <span className="walletChip amber">Vesting</span>
                      </div>
                    </div>

                    <div className="walletHowWorksHero">
                      <div className="walletHowWorksHeroIcon">
                        <i className="material-icons">{currentHowWorksSlide.icon}</i>
                      </div>
                      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.6 }}>
                        {currentHowWorksSlide.sideTitle}
                      </div>
                      <div className="walletHowWorksMetricGrid">
                        {currentHowWorksSlide.sideRows.map((row) => (
                          <div className="walletHowWorksMetric" key={row.label}>
                            <div className="l">{row.label}</div>
                            <div className="r" style={{ color: row.color }}>
                              {row.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ color: "#475569", fontSize: 12, lineHeight: 1.5 }}>
                        {currentHowWorksSlide.note}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="walletHowWorksFooter">
                <div className="walletHowWorksSummary">
                  <div className="walletHowWorksSummaryRow">
                    <i className="material-icons">lock</i>
                    <span>The fee moves from locked value to vested value over time.</span>
                  </div>
                  <div className="walletHowWorksSummaryRow">
                    <i className="material-icons">update</i>
                    <span>Weekly participation unlocks more of the frozen pool.</span>
                  </div>
                  <div className="walletHowWorksSummaryRow">
                    <i className="material-icons">trending_up</i>
                    <span>Diligence can help you earn beyond the original commitment.</span>
                  </div>
                </div>

                <div className="walletHowWorksActions">
                  <button
                    type="button"
                    className="walletHowWorksNav"
                    onClick={() => setHowWorksStep((value) => Math.max(0, value - 1))}
                    disabled={howWorksStep === 0}
                  >
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      arrow_back
                    </i>
                    Back
                  </button>
                  <button
                    type="button"
                    className="walletHowWorksNav primary"
                    onClick={() => setHowWorksStep((value) => Math.min(howWorksSlides.length - 1, value + 1))}
                  >
                    {howWorksStep === howWorksSlides.length - 1 ? "Continue" : `Next: Step ${howWorksStep + 2}`}
                    <i className="material-icons" style={{ fontSize: 18 }}>
                      arrow_forward
                    </i>
                  </button>
                </div>
              </div>
              </div>
            </div>,
            document.body
          )
          : null}

      </div>
    </section>
  );
}
