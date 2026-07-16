export const LUNCHFLOW_KIND = "lunchflow";
export const DEFAULT_BASE_URL = "https://www.lunchflow.app/api/v1";
export const DEFAULT_LOOKBACK_DAYS = 7;
export const DEFAULT_FIRST_SYNC_DAYS = 90;
export const MAX_SYNC_HISTORY_YEARS = 3;

export interface LunchflowConfig {
  secretRef: string;
  baseUrl: string;
  allowedHosts?: string[];
  /** ISO calendar date for first-sync history floor. */
  syncStartDate?: string;
  /** Overlap buffer after lastSyncedAt (default 7). */
  lookbackDays?: number;
  /** Include pending transactions (default true). */
  includePending?: boolean;
}

export interface LunchflowSyncState {
  lastSyncedAt: string;
  lastStartDate?: string;
  syncedAccount?: boolean;
  [key: string]: unknown;
}

export interface LunchflowTransaction {
  id?: string | number;
  accountId?: string | number;
  amount?: string | number;
  currency?: string;
  date?: string;
  merchant?: string;
  description?: string;
  isPending?: boolean;
  [key: string]: unknown;
}

export interface LunchflowAccount {
  id: string;
  name: string;
  currency?: string;
  institutionName?: string;
  status?: string;
  iban?: string;
}
