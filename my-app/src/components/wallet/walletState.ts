import type { ApiWallet } from "../../api";

export type WalletState = "missing" | "dormant" | "frozen" | "available";

export type WalletStateMeta = {
  state: WalletState;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function getWalletState(wallet?: Partial<ApiWallet> | null): WalletState {
  if (!wallet) return "missing";

  const explicit = safeStr(wallet.wallet_state);
  if (explicit === "missing" || explicit === "dormant" || explicit === "frozen" || explicit === "available") {
    return explicit;
  }

  const recordExists = wallet.record_exists;
  if (recordExists === false) return "missing";

  const status = safeStr(wallet.status);
  const activatedAt = safeStr(wallet.activated_at);
  const activated = status === "active" || Boolean(activatedAt);
  const balance = safeNum(wallet.balance_cents);
  const frozen = safeNum(wallet.frozen_balance_cents);

  if (!activated) {
    return recordExists === true || status === "dormant" || frozen > 0 ? "dormant" : "missing";
  }
  if (balance > 0) return "available";
  if (frozen > 0) return "frozen";
  return "available";
}

export function getWalletStateMeta(wallet?: Partial<ApiWallet> | null): WalletStateMeta {
  const state = getWalletState(wallet);
  switch (state) {
    case "available":
      return {
        state,
        label: "Available credits",
        description: "Spendable FGC is ready for use.",
        color: "#92400e",
        bg: "rgba(245,158,11,.12)",
        border: "rgba(245,158,11,.22)",
      };
    case "frozen":
      return {
        state,
        label: "Frozen credits",
        description: "Held in the wallet until vesting or release.",
        color: "#1d4ed8",
        bg: "rgba(59,130,246,.12)",
        border: "rgba(59,130,246,.22)",
      };
    case "dormant":
    case "missing":
    default:
      return {
        state,
        label: "Dormant wallet",
        description: "Wallet exists, but activation has not started yet.",
        color: "#64748b",
        bg: "rgba(148,163,184,.14)",
        border: "rgba(148,163,184,.24)",
      };
  }
}
