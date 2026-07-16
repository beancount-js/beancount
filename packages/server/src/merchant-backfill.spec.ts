import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { FilesystemMerchantStore } from "./merchant";
import { backfillMerchantsFromLedger } from "./merchant-backfill";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("backfillMerchantsFromLedger", () => {
  test("creates profiles and stamps merchant_id on imported transactions", async () => {
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
  raw_fingerprint: "abc"
  Assets:Bank:Checking  -20.00 GBP
  Expenses:Food

2024-06-02 * "Pure Gym" "Membership"
  import_id: "bank:2"
  import_source: "bank"
  raw_fingerprint: "def"
  Assets:Bank:Checking  -20.00 GBP
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

    expect(result.createdProfiles).toBe(1);
    expect(result.patchedTransactions).toBe(2);
    expect(result.files[0]?.contents).toContain("merchant_id:");
    expect(result.files[0]?.contents).toMatch(/Pure Gym[\s\S]*merchant_id:/);

    const listed = await merchants.list("project");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.canonicalName).toBe("Pure Gym");
    expect(listed[0]?.aliases).toHaveLength(1);
  });
});
