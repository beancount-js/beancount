export const STARLING_KIND = "starling";
export const DEFAULT_BASE_URL = "https://api.starlingbank.com";
export const DEFAULT_ALLOWED_HOSTS = [
  "api.starlingbank.com",
  "api-sandbox.starlingbank.com",
] as const;
export const DEFAULT_LOOKBACK_DAYS = 7;
export const DEFAULT_FIRST_SYNC_DAYS = 90;
export const DEFAULT_MAX_PAGES = 100;
export const DEFAULT_MAX_RECORDS = 10_000;

export interface StarlingConfig {
  secretRef: string;
  baseUrl: string;
  allowedHosts?: string[];
  /** ISO calendar date used as the first historical lower bound. */
  syncStartDate?: string;
  /** Overlap buffer for changed-item queries, from 0 to 90 days. */
  lookbackDays?: number;
}

export interface StarlingSyncState {
  lastSyncedAt: string;
  lastStartTimestamp?: string;
  syncedAccount?: boolean;
  [key: string]: unknown;
}

export interface StarlingAccount {
  accountUid: string;
  defaultCategory: string;
  name: string;
  currency: string;
  accountType?: string;
  createdAt?: string;
}

export interface StarlingCurrencyAndAmount {
  currency?: string;
  minorUnits?: number | string;
}

export interface StarlingFeedItem {
  feedItemUid?: string;
  categoryUid?: string;
  amount?: StarlingCurrencyAndAmount;
  sourceAmount?: StarlingCurrencyAndAmount;
  direction?: string;
  updatedAt?: string;
  transactionTime?: string;
  settlementTime?: string;
  source?: string;
  sourceSubType?: string;
  status?: string;
  counterPartyType?: string;
  counterPartyName?: string;
  counterPartySubEntityName?: string;
  reference?: string;
  country?: string;
  spendingCategory?: string;
  userNote?: string;
  exchangeRate?: number | string;
  totalFees?: number | string;
  totalFeeAmount?: StarlingCurrencyAndAmount;
  [key: string]: unknown;
}

export interface StarlingTransactionPage {
  feedItems: StarlingFeedItem[];
  next?: string;
}

export type StarlingFetchMode = "history" | "changes";

export interface StarlingFetchWindow {
  mode: StarlingFetchMode;
  startTimestamp: string;
  endTimestamp: string;
}
