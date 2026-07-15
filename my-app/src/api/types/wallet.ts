export type ApiWallet = {
  wallet_id: string;
  balance_cents: number;
  status?: string;
  version?: number;
  created_at?: string;
  updated_at?: string;
  [k: string]: any;
};

export type ApiWalletResponse = {
  ok: boolean;
  wallet: ApiWallet;
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
};

export type ApiWalletCreditResponse = {
  ok: boolean;
  wallet: ApiWallet;
  credited?: number;
  credited_fgc?: number;
  reason?: string;
};
