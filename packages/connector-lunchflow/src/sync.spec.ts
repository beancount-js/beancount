import { describe, expect, test } from "vitest";
import {
  commitLunchflowSyncState,
  prepareLunchflowFetch,
  resolveLunchflowStartDate,
} from "./sync";
import type { LunchflowConfig } from "./types";

const config: LunchflowConfig = {
  secretRef: "env:LUNCHFLOW_API_KEY",
  baseUrl: "https://www.lunchflow.app/api/v1",
  lookbackDays: 7,
  includePending: true,
};

describe("lunchflow sync windows", () => {
  test("first sync uses configured syncStartDate", () => {
    const start = resolveLunchflowStartDate({
      config: { ...config, syncStartDate: "2026-01-15" },
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    expect(start).toBe("2026-01-15");
  });

  test("first sync defaults to 90 days when unset", () => {
    const start = resolveLunchflowStartDate({
      config,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    expect(start).toBe("2026-04-17");
  });

  test("subsequent sync subtracts lookback from lastSyncedAt", () => {
    const prepare = prepareLunchflowFetch({
      config,
      sourceId: "lunchflow:acc-1",
      accountId: "acc-1",
      syncState: {
        lastSyncedAt: "2026-07-10T08:00:00.000Z",
        syncedAccount: true,
      },
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    expect(prepare.fetchContext.startDate).toBe("2026-07-03");
    expect(prepare.fetchContext.includePending).toBe(true);
    expect(prepare.fetchContext.accountId).toBe("acc-1");
  });

  test("commitSyncState advances lastSyncedAt", () => {
    const prepare = prepareLunchflowFetch({
      config,
      sourceId: "lunchflow:acc-1",
      accountId: "acc-1",
    });
    const next = commitLunchflowSyncState({
      prepare,
      now: new Date("2026-07-16T12:00:00.000Z"),
    });
    expect(next.lastSyncedAt).toBe("2026-07-16T12:00:00.000Z");
    expect(next.syncedAccount).toBe(true);
    expect(next.lastStartDate).toBe(prepare.fetchContext.startDate);
  });
});
