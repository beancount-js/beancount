import { describe, expect, test } from "vitest";
import {
  commitMonzoSyncState,
  prepareMonzoFetch,
  resolveMonzoFetchWindow,
} from "./sync";
import type { MonzoConfig } from "./types";

const config: MonzoConfig = {
  secretRef: "env:MONZO_ACCESS_TOKEN",
  baseUrl: "https://api.monzo.com",
  lookbackDays: 30,
};

describe("Monzo sync windows", () => {
  test("first sync defaults to 90 days", () => {
    expect(
      resolveMonzoFetchWindow({
        config,
        now: new Date("2026-07-17T12:00:00.000Z"),
      }),
    ).toEqual({
      startTimestamp: "2026-04-18T12:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    });
  });

  test("first sync respects a configured calendar date", () => {
    expect(
      resolveMonzoFetchWindow({
        config: { ...config, syncStartDate: "2025-01-15" },
        now: new Date("2026-07-17T12:00:00.000Z"),
      }).startTimestamp,
    ).toBe("2025-01-15T00:00:00.000Z");
  });

  test("incremental syncs use a 30-day overlap", () => {
    const prepared = prepareMonzoFetch({
      config,
      sourceId: "monzo:account-1",
      accountId: "account-1",
      syncState: { lastSyncedAt: "2026-07-10T08:00:00.000Z" },
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(prepared.fetchContext).toEqual({
      accountId: "account-1",
      startTimestamp: "2026-06-10T08:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    });
  });

  test("commits the run completion time after success", () => {
    const prepare = prepareMonzoFetch({
      config,
      sourceId: "monzo:account-1",
      accountId: "account-1",
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(
      commitMonzoSyncState({
        prepare,
        run: { completedAt: "2026-07-17T12:00:03.000Z" },
      }),
    ).toEqual({
      lastSyncedAt: "2026-07-17T12:00:03.000Z",
      lastStartTimestamp: "2026-04-18T12:00:00.000Z",
      syncedAccount: true,
    });
  });
});
