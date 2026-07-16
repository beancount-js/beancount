import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { FilesystemMerchantStore } from "./merchant";
import {
  backfillMerchantsFromLedger,
  pruneThinMerchantsFromCatalog,
} from "./merchant-backfill";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("backfillMerchantsFromLedger", () => {
  test("links existing enriched profiles without creating name-only ones", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-merchant-backfill-"),
    );
    directories.push(directory);
    const merchants = new FilesystemMerchantStore(async () => directory);

    const enriched = await merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "Pure Gym",
      candidate: {
        id: "ai:pure-gym",
        canonicalName: "Pure Gym",
        domain: "puregym.com",
        description: "UK gym chain.",
        explanation: "enriched",
        provenance: [{ source: "ai", observedAt: "2026-07-01T00:00:00.000Z" }],
      },
    });

    const contents = `option "operating_currency" "GBP"

2024-01-01 open Assets:Bank:Checking GBP
2024-01-01 open Expenses:Food GBP

2024-06-01 * "Pure Gym" "Membership"
  import_id: "bank:1"
  import_source: "bank"
  raw_fingerprint: "abc"
  Assets:Bank:Checking  -20.00 GBP
  Expenses:Food

2024-06-02 * "Unknown Cafe" "Coffee"
  import_id: "bank:2"
  import_source: "bank"
  raw_fingerprint: "def"
  Assets:Bank:Checking  -5.00 GBP
  Expenses:Food

2024-06-03 * "Already Linked" "Coffee"
  import_id: "bank:3"
  import_source: "bank"
  merchant_id: "00000000-0000-4000-8000-000000000001"
  Assets:Bank:Checking  -5.00 GBP
  Expenses:Food
`;

    const result = await backfillMerchantsFromLedger({
      projectId: "project",
      entryFile: "main.beancount",
      files: [{ path: "main.beancount", contents }],
      merchants,
    });

    expect(result.createdProfiles).toBe(0);
    expect(result.patchedTransactions).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.files[0]?.contents).toContain(
      `merchant_id: "${enriched.merchantId}"`,
    );
    expect(result.files[0]?.contents).toMatch(
      /\* "Unknown Cafe" "Coffee"\n  import_id: "bank:2"\n  import_source: "bank"\n  raw_fingerprint: "def"\n  Assets:/,
    );

    await expect(merchants.list("project")).resolves.toHaveLength(1);
  });

  test("does not create profiles for unmatched labels", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-merchant-backfill-"),
    );
    directories.push(directory);
    const merchants = new FilesystemMerchantStore(async () => directory);

    const contents = `option "operating_currency" "GBP"

2024-01-01 open Assets:Bank:Checking GBP
2024-01-01 open Expenses:Food GBP

2024-06-01 * "Pure Gym" "Membership"
  import_id: "bank:1"
  import_source: "bank"
  Assets:Bank:Checking  -20.00 GBP
  Expenses:Food
`;

    const result = await backfillMerchantsFromLedger({
      projectId: "project",
      entryFile: "main.beancount",
      files: [{ path: "main.beancount", contents }],
      merchants,
    });

    expect(result.createdProfiles).toBe(0);
    expect(result.patchedTransactions).toBe(0);
    expect(result.skipped).toBe(1);
    await expect(merchants.list("project")).resolves.toEqual([]);
  });
});

describe("pruneThinMerchantsFromCatalog", () => {
  test("removes thin profiles and clears ledger merchant metadata", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-merchant-prune-"),
    );
    directories.push(directory);
    const merchants = new FilesystemMerchantStore(async () => directory);

    const thin = await merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "Cash Machine",
      candidate: {
        id: "thin",
        canonicalName: "Cash Machine",
        explanation: "name only",
        provenance: [{ source: "manual", observedAt: "2026-07-01T00:00:00.000Z" }],
      },
    });
    const rich = await merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "Tesco",
      candidate: {
        id: "rich",
        canonicalName: "Tesco",
        domain: "tesco.com",
        explanation: "enriched",
        provenance: [{ source: "ai", observedAt: "2026-07-01T00:00:00.000Z" }],
      },
    });

    const contents = `option "operating_currency" "GBP"

2024-01-01 open Assets:Bank:Checking GBP
2024-01-01 open Expenses:Food GBP

2024-06-01 * "Cash Machine" "ATM"
  import_id: "bank:1"
  import_source: "bank"
  merchant_id: "${thin.merchantId}"
  merchant_resolution_method: "manual"
  Assets:Bank:Checking  -20.00 GBP
  Expenses:Food

2024-06-02 * "Tesco" "Groceries"
  import_id: "bank:2"
  import_source: "bank"
  merchant_id: "${rich.merchantId}"
  merchant_domain: "tesco.com"
  Assets:Bank:Checking  -5.00 GBP
  Expenses:Food
`;

    const result = await pruneThinMerchantsFromCatalog({
      projectId: "project",
      entryFile: "main.beancount",
      files: [{ path: "main.beancount", contents }],
      merchants,
    });

    expect(result.removedProfiles).toBe(1);
    expect(result.clearedTransactions).toBe(1);
    expect(result.files[0]?.contents).not.toContain(thin.merchantId);
    expect(result.files[0]?.contents).toContain(rich.merchantId);

    const listed = await merchants.list("project");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.merchantId).toBe(rich.merchantId);
  });
});
