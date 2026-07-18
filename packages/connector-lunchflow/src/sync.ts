import { DateTime } from "luxon";
import type { SyncPrepareResult } from "@beancount-js/beangulp";
import type { LunchflowConfig, LunchflowSyncState } from "./types";
import {
  DEFAULT_FIRST_SYNC_DAYS,
  DEFAULT_LOOKBACK_DAYS,
  MAX_SYNC_HISTORY_YEARS,
} from "./types";

function toIsoDate(value: DateTime) {
  return value.toUTC().toISODate() ?? value.toFormat("yyyy-MM-dd");
}

function parseSyncState(
  value: LunchflowSyncState | undefined,
): LunchflowSyncState | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (typeof value.lastSyncedAt !== "string" || !value.lastSyncedAt.trim()) {
    return undefined;
  }
  return {
    lastSyncedAt: value.lastSyncedAt,
    lastStartDate:
      typeof value.lastStartDate === "string" ? value.lastStartDate : undefined,
    syncedAccount: value.syncedAccount === true,
  };
}

export function resolveLunchflowStartDate(options: {
  config: LunchflowConfig;
  syncState?: LunchflowSyncState;
  now?: Date;
}): string {
  const now = DateTime.fromJSDate(options.now ?? new Date()).toUTC();
  const state = parseSyncState(options.syncState);
  const lookbackDays = options.config.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;

  if (state?.syncedAccount || state?.lastSyncedAt) {
    const last = DateTime.fromISO(state.lastSyncedAt, { zone: "utc" });
    if (last.isValid) {
      return toIsoDate(last.minus({ days: lookbackDays }));
    }
  }

  if (options.config.syncStartDate?.trim()) {
    const configured = DateTime.fromISO(options.config.syncStartDate.trim(), {
      zone: "utc",
    });
    if (configured.isValid) {
      const earliest = now.minus({ years: MAX_SYNC_HISTORY_YEARS });
      return toIsoDate(configured < earliest ? earliest : configured);
    }
  }

  return toIsoDate(now.minus({ days: DEFAULT_FIRST_SYNC_DAYS }));
}

export function prepareLunchflowFetch(args: {
  config: LunchflowConfig;
  sourceId: string;
  accountId?: string;
  syncState?: LunchflowSyncState;
  now?: Date;
}): SyncPrepareResult {
  const accountId =
    args.accountId ??
    (args.sourceId.includes(":")
      ? args.sourceId.slice(args.sourceId.indexOf(":") + 1)
      : undefined);
  const startDate = resolveLunchflowStartDate({
    config: args.config,
    syncState: args.syncState,
    now: args.now,
  });
  const includePending = args.config.includePending !== false;
  return {
    fetchContext: {
      accountId,
      startDate,
      includePending,
    },
  };
}

export function commitLunchflowSyncState(args: {
  previous?: LunchflowSyncState;
  prepare: SyncPrepareResult;
  now?: Date;
}): LunchflowSyncState {
  const now = (args.now ?? new Date()).toISOString();
  const startDate =
    typeof args.prepare.fetchContext.startDate === "string"
      ? args.prepare.fetchContext.startDate
      : undefined;
  return {
    lastSyncedAt: now,
    lastStartDate: startDate,
    syncedAccount: true,
  };
}
