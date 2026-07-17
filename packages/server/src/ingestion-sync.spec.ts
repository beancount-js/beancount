import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  expandIngestionSource,
  FilesystemIngestionStore,
  type IngestionConfig,
} from "./ingestion";
import { ensureConnectorsRegistered } from "./connectors";
import { prepareLunchflowFetch } from "@beancount-js/connector-lunchflow";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("ingestion sync state", () => {
  test("persists connector sync bookmarks after saveRun", async () => {
    ensureConnectorsRegistered();
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-sync-state-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore({
      resolveProjectRoot: (project) => join(directory, project),
    });
    const config: IngestionConfig = {
      version: 2,
      sources: [
        {
          id: "lunchflow",
          name: "Lunch Flow",
          kind: "lunchflow",
          config: {
            secretRef: "env:LUNCHFLOW_API_KEY",
            baseUrl: "https://www.lunchflow.app/api/v1",
            lookbackDays: 7,
            includePending: true,
          },
          accounts: [
            {
              id: "acc-1",
              name: "Current",
              sourceAccount: "Assets:Bank:Current",
            },
          ],
          rules: [],
        },
      ],
    };
    await store.writeConfig("project", config);

    const prepare = prepareLunchflowFetch({
      config: config.sources[0].config as never,
      sourceId: "lunchflow:acc-1",
      accountId: "acc-1",
      now: new Date("2026-07-16T12:00:00.000Z"),
    });

    await store.saveRun(
      "project",
      {
        id: "run:1",
        sourceId: "lunchflow:acc-1",
        startedAt: "2026-07-16T12:00:00.000Z",
        completedAt: "2026-07-16T12:00:01.000Z",
        proposals: [],
        summary: {
          total: 0,
          ready: 0,
          needsReview: 0,
          accepted: 0,
          duplicates: 0,
          invalid: 0,
          held: 0,
          excluded: 0,
        },
      },
      {
        syncState: {
          lastSyncedAt: "2026-07-16T12:00:01.000Z",
          lastStartDate: prepare.fetchContext.startDate as string,
          syncedAccount: true,
        },
      },
    );

    const state = await store.readState("project");
    expect(state.syncState["lunchflow:acc-1"]).toMatchObject({
      lastSyncedAt: "2026-07-16T12:00:01.000Z",
      syncedAccount: true,
    });

    const next = prepareLunchflowFetch({
      config: config.sources[0].config as never,
      sourceId: "lunchflow:acc-1",
      accountId: "acc-1",
      syncState: state.syncState["lunchflow:acc-1"] as never,
      now: new Date("2026-07-20T12:00:00.000Z"),
    });
    expect(next.fetchContext.startDate).toBe("2026-07-09");
  });

  test("expands lunchflow targets without json-api endpoints", async () => {
    ensureConnectorsRegistered();
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-expand-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore({
      resolveProjectRoot: (project) => join(directory, project),
    });
    await store.writeConfig("project", {
      version: 2,
      sources: [
        {
          id: "lunchflow",
          name: "Lunch Flow",
          kind: "lunchflow",
          config: {
            secretRef: "env:LUNCHFLOW_API_KEY",
            baseUrl: "https://www.lunchflow.app/api/v1",
          },
          accounts: [
            {
              id: "a",
              name: "A",
              sourceAccount: "Assets:A",
            },
          ],
          rules: [],
        },
      ],
    });
    const source = await store.source("project", "lunchflow");
    const targets = expandIngestionSource(source);
    expect(targets).toEqual([
      {
        sourceId: "lunchflow:a",
        sourceAccount: "Assets:A",
        defaultCurrency: undefined,
        accountId: "a",
      },
    ]);
  });
});
