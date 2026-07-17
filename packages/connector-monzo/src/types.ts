export const MONZO_KIND = "monzo";
export const DEFAULT_BASE_URL = "https://api.monzo.com";
export const DEFAULT_ALLOWED_HOSTS = ["api.monzo.com"] as const;
export const DEFAULT_LOOKBACK_DAYS = 30;
export const DEFAULT_FIRST_SYNC_DAYS = 90;
export const DEFAULT_PAGE_SIZE = 100;
export const DEFAULT_MAX_PAGES = 100;
export const DEFAULT_MAX_RECORDS = 10_000;

export interface MonzoConfig {
  secretRef: string;
  baseUrl: string;
  allowedHosts?: string[];
  /** ISO calendar date used as the first historical lower bound. */
  syncStartDate?: string;
  /** Overlap buffer for re-fetching transactions, from 0 to 90 days. */
  lookbackDays?: number;
}

export interface MonzoSyncState {
  lastSyncedAt: string;
  lastStartTimestamp?: string;
  syncedAccount?: boolean;
  [key: string]: unknown;
}

export interface MonzoAccount {
  id: string;
  description: string;
  created?: string;
  accountType?: string;
}

export interface MonzoBalance {
  currency: string;
}

export interface MonzoMerchant {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

export interface MonzoTransaction {
  id?: string;
  amount?: number | string;
  currency?: string;
  description?: string;
  created?: string;
  settled?: string;
  notes?: string;
  is_load?: boolean;
  category?: string;
  merchant?: string | MonzoMerchant | null;
  decline_reason?: string;
  include_in_spending?: boolean;
  dedupe_id?: string;
  scheme?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MonzoTransactionPage {
  transactions: MonzoTransaction[];
}

export interface MonzoFetchWindow {
  startTimestamp: string;
  endTimestamp: string;
}
