import { describe, expect, test } from "vitest";
import {
  commitStarlingSyncState,
  prepareStarlingFetch,
  resolveStarlingFetchWindow,
} from "./sync";
import type { StarlingConfig } from "./types";

const config: StarlingConfig = {
  secretRef: "env:STARLING_ACCESS_TOKEN",
  baseUrl: "https://api.starlingbank.com",
  lookbackDays: 7,
};

describe("Starling sync windows", () => {
  test("first sync defaults to 90 days", () => {
    expect(
      resolveStarlingFetchWindow({
        config,
        now: new Date("2026-07-17T12:00:00.000Z"),
      }),
    ).toEqual({
      mode: "history",
      startTimestamp: "2026-04-18T12:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    });
  });

  test("first sync respects a configured calendar date", () => {
    expect(
      resolveStarlingFetchWindow({
        config: { ...config, syncStartDate: "2025-01-15" },
        now: new Date("2026-07-17T12:00:00.000Z"),
      }).startTimestamp,
    ).toBe("2025-01-15T00:00:00.000Z");
  });

  test("recent syncs use changed items with an overlap", () => {
    const prepared = prepareStarlingFetch({
      config,
      sourceId: "starling:account-1",
      accountId: "account-1",
      syncState: { lastSyncedAt: "2026-07-10T08:00:00.000Z" },
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(prepared.fetchContext).toEqual({
      accountId: "account-1",
      mode: "changes",
      startTimestamp: "2026-07-03T08:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    });
  });

  test("sync gaps over one year fall back to paginated history", () => {
    expect(
      resolveStarlingFetchWindow({
        config,
        syncState: { lastSyncedAt: "2025-01-01T00:00:00.000Z" },
        now: new Date("2026-07-17T12:00:00.000Z"),
      }).mode,
    ).toBe("history");
  });

  test("commits the run completion time only after success", () => {
    const prepare = prepareStarlingFetch({
      config,
      sourceId: "starling:account-1",
      accountId: "account-1",
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(
      commitStarlingSyncState({
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
