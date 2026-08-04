export type ApiWallet = {
  wallet_id: string;
  balance_cents: number;
  frozen_balance_cents?: number;
  frozen_total_granted_cents?: number;
  frozen_total_released_cents?: number;
  frozen_release_streak_weeks?: number;
  frozen_last_release_week_start?: string;
  frozen_last_release_at?: string;
  frozen_last_release_amount_cents?: number;
  frozen_last_grant_at?: string;
  frozen_last_grant_amount_cents?: number;
  status?: string;
  wallet_state?: "missing" | "dormant" | "frozen" | "available" | string;
  record_exists?: boolean;
  version?: number;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
};

export type ApiWalletResponse = {
  ok: boolean;
  wallet: ApiWallet | null;
  found?: boolean;
};

export type ApiWalletBootstrapResponse = {
  ok: boolean;
  wallet: ApiWallet;
  transactions: ApiWalletTransaction[];
};

export type ApiWalletTransaction = {
  transaction_id: string;
  wallet_id: string;
  amount_cents: number;
  balance_before_cents?: number;
  balance_after_cents?: number;
  reason?: string;
  actor?: string;
  source?: string;
  created_at?: string;
  meta?: Record<string, any>;
  [k: string]: any;
};

export type ApiWalletTransactionsResponse = {
  ok: boolean;
  items: ApiWalletTransaction[];
};

export type ApiWalletSessionResponse = {
  ok: boolean;
  token: string;
  tokenType?: string;
  expiresIn?: number;
  scope?: string;
  walletId?: string;
};

export type ApiWalletCreditBody = {
  username: string;
  amount_cents: number;
  reason?: string;
  transaction_id?: string;
  credit_type?: "spendable" | "frozen";
  activate_wallet?: boolean;
  activateWallet?: boolean;
};

export type ApiWalletCreditResponse = {
  ok: boolean;
  wallet: ApiWallet;
  credited?: number;
  credited_fgc?: number;
  reason?: string;
};

export type ApiWalletActivateBody = {
  username: string;
  reason?: string;
};

export type ApiWalletActivateResponse = {
  ok: boolean;
  wallet: ApiWallet;
  reason?: string;
};

export type ApiWalletSelfInitiateBody = {
  amount_cents: number;
  transaction_id: string;
  reason?: string;
  credit_type?: "spendable" | "frozen";
  meta?: Record<string, any>;
};

export type ApiWalletSelfInitiateResponse = ApiWalletCreditResponse;
