import { DateTime } from "luxon";
import type { SyncPrepareResult } from "@beancount-js/beangulp";
import type { MonzoConfig, MonzoFetchWindow, MonzoSyncState } from "./types";
import { DEFAULT_FIRST_SYNC_DAYS, DEFAULT_LOOKBACK_DAYS } from "./types";

function iso(value: DateTime) {
  return (
    value.toUTC().toISO() ?? value.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'")
  );
}

function parseState(value: MonzoSyncState | undefined) {
  if (!value || typeof value.lastSyncedAt !== "string") return undefined;
  const last = DateTime.fromISO(value.lastSyncedAt, { zone: "utc" });
  return last.isValid ? last : undefined;
}

export function resolveMonzoFetchWindow(options: {
  config: MonzoConfig;
  syncState?: MonzoSyncState;
  now?: Date;
}): MonzoFetchWindow {
  const now = DateTime.fromJSDate(options.now ?? new Date()).toUTC();
  const lookbackDays = options.config.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const last = parseState(options.syncState);

  if (last) {
    return {
      startTimestamp: iso(last.minus({ days: lookbackDays })),
      endTimestamp: iso(now),
    };
  }

  const configured = options.config.syncStartDate?.trim()
    ? DateTime.fromISO(options.config.syncStartDate.trim(), {
        zone: "utc",
      }).startOf("day")
    : undefined;
  const start = configured?.isValid
    ? configured
    : now.minus({ days: DEFAULT_FIRST_SYNC_DAYS });
  return {
    startTimestamp: iso(start),
    endTimestamp: iso(now),
  };
}

export function prepareMonzoFetch(args: {
  config: MonzoConfig;
  sourceId: string;
  accountId?: string;
  syncState?: MonzoSyncState;
  now?: Date;
}): SyncPrepareResult {
  const accountId =
    args.accountId ??
    (args.sourceId.includes(":")
      ? args.sourceId.slice(args.sourceId.indexOf(":") + 1)
      : undefined);
  const window = resolveMonzoFetchWindow({
    config: args.config,
    syncState: args.syncState,
    now: args.now,
  });
  return {
    fetchContext: {
      accountId,
      ...window,
    },
  };
}

export function commitMonzoSyncState(args: {
  prepare: SyncPrepareResult;
  run?: { completedAt?: string };
  now?: Date;
}): MonzoSyncState {
  const completedAt = args.run?.completedAt;
  const parsed = completedAt
    ? DateTime.fromISO(completedAt, { zone: "utc" })
    : undefined;
  const lastSyncedAt = parsed?.isValid
    ? iso(parsed)
    : (args.now ?? new Date()).toISOString();
  return {
    lastSyncedAt,
    lastStartTimestamp:
      typeof args.prepare.fetchContext.startTimestamp === "string"
        ? args.prepare.fetchContext.startTimestamp
        : undefined,
    syncedAccount: true,
  };
}
