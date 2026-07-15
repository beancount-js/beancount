import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  categoryAccountsForSource,
  FilesystemIngestionStore,
  merchantAdvisorLabel,
  type IngestionConfig,
} from "./ingestion";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function config(
  endpoint = "https://api.example.test/transactions",
): IngestionConfig {
  return {
    version: 1,
    sources: [
      {
        id: "bank",
        name: "Bank",
        kind: "json-api",
        sourceAccount: "Assets:Bank:Checking",
        api: {
          endpoint,
          allowedHosts: ["api.example.test"],
          secretRef: "env:BANK_API_TOKEN",
        },
        mapping: { date: "date", amount: "amount" },
        rules: [],
      },
    ],
  };
}

describe("FilesystemIngestionStore", () => {
  test("removes long merchant identifiers before AI merchant advice", () => {
    expect(merchantAdvisorLabel("TESCO STORES 1234 OXFORD")).toBe(
      "tesco stores # oxford",
    );
  });

  test("persists a credential reference, not a token value", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore(directory);

    await store.writeConfig("project", config());

    const persisted = await readFile(
      join(directory, "projects", "project", "ingestion", "sources.json"),
      "utf8",
    );
    expect(persisted).toContain("env:BANK_API_TOKEN");
    expect(persisted).not.toContain("top-secret-token");
    expect(await store.readConfig("project")).toEqual(config());
  });

  test("round-trips the full JSON API source configuration", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore(directory);
    const full = config();
    full.sources[0] = {
      ...full.sources[0],
      destinationPath: "imports/bank.beancount",
      defaultCurrency: "GBP",
      allowedAccountRoots: ["Expenses", "Assets"],
      aiEnabled: true,
      merchantEnrichment: {
        enabled: true,
        aiEnabled: true,
        countryCode: "gb",
        brandfetch: {
          enabled: true,
          apiKeySecretRef: "env:BRANDFETCH_API_KEY",
          clientId: "  test-client  ",
          allowNameSearch: true,
          allowTransactionLookup: true,
          assetMode: "cache",
          cacheContentAllowed: true,
          ttlDays: 14,
        },
      },
      api: {
        endpoint: "https://api.example.test/transactions",
        allowedHosts: [" API.EXAMPLE.TEST "],
        secretRef: "env:BANK_API_TOKEN",
        recordsPath: "payload.records",
        query: { account: "current" },
        pagination: {
          cursorQueryParam: "cursor",
          nextCursorPath: "next.cursor",
        },
      },
      mapping: {
        id: "id",
        date: "posted_at",
        amount: "value.amount",
        currency: "value.currency",
        merchant: "merchant.name",
        payee: "payee",
        narration: "description",
        status: "status",
        dateFormat: "yyyy-MM-dd",
        amountSign: "invert",
      },
      rules: [
        {
          merchant: "Coffee shop",
          merchantId: "merchant:coffee-shop",
          account: "Expenses:Food:Coffee",
          sourceAccount: "Assets:Bank:Checking",
          direction: "debit",
        },
      ],
    };

    await store.writeConfig("project", full);

    await expect(store.readConfig("project")).resolves.toEqual({
      version: 1,
      sources: [
        expect.objectContaining({
          ...full.sources[0],
          allowedAccountRoots: ["Expenses", "Assets"],
          api: expect.objectContaining({
            allowedHosts: ["api.example.test"],
          }),
          merchantEnrichment: expect.objectContaining({
            countryCode: "GB",
            brandfetch: expect.objectContaining({ clientId: "test-client" }),
          }),
        }),
      ],
    });
  });

  test("rejects non-local HTTP endpoints before a run can use a credential", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore(directory);

    await expect(
      store.writeConfig(
        "project",
        config("http://api.example.test/transactions"),
      ),
    ).rejects.toThrow("must use HTTPS");
  });

  test("limits manual choices to the configured category scope", () => {
    const source = {
      ...config().sources[0],
      allowedAccountRoots: ["Expenses"],
    };

    expect(
      categoryAccountsForSource(source, [
        "Assets:Bank:Checking",
        "Expenses:Food:Groceries",
        "Income:Salary",
      ]),
    ).toEqual(["Expenses:Food:Groceries"]);
  });

  test("persists confirmed merchants as Markdown profiles and resolves source aliases", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = new FilesystemIngestionStore(directory);

    const merchant = await store.merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "TESCO STORES 1234",
      candidate: {
        id: "ai:tesco",
        canonicalName: "Tesco",
        domain: "tesco.com",
        description: "British supermarket.",
        rawScore: 0.9,
        explanation: "AI merchant suggestion.",
        provenance: [
          {
            source: "ai",
            provider: "codex",
            observedAt: "2026-07-15T12:00:00.000Z",
          },
        ],
      },
    });

    const profile = await readFile(
      join(
        directory,
        "projects",
        "project",
        "ingestion",
        "merchants",
        merchant.merchantId,
        "profile.md",
      ),
      "utf8",
    );
    expect(profile).toContain("canonicalName: Tesco");
    expect(profile).toContain("## Description");
    await expect(
      store.merchants.resolve("project", "bank", "TESCO STORES 1234"),
    ).resolves.toMatchObject({
      status: "confirmed",
      merchant: { merchantId: merchant.merchantId, canonicalName: "Tesco" },
    });
    await expect(
      store.merchants.resolve("project", "another-bank", "TESCO STORES 1234"),
    ).resolves.toBeUndefined();
    await expect(
      new FilesystemIngestionStore(directory).merchants.resolve(
        "project",
        "bank",
        "TESCO STORES 1234",
      ),
    ).resolves.toMatchObject({
      status: "confirmed",
      merchant: { merchantId: merchant.merchantId },
    });

    await store.merchants.cacheLogo("project", merchant.merchantId, {
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mediaType: "image/png",
      extension: "png",
      sha256: "a".repeat(64),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await expect(
      store.merchants.logo("project", merchant.merchantId),
    ).resolves.toMatchObject({
      mediaType: "image/png",
      sha256: "a".repeat(64),
    });

    await store.merchants.suppress("project", "bank", "UNKNOWN SHOP");
    await expect(
      store.merchants.resolve("project", "bank", "UNKNOWN SHOP"),
    ).resolves.toMatchObject({ status: "suppressed" });
    await store.merchants.clearSuppression("project", "bank", "UNKNOWN SHOP");
    await expect(
      store.merchants.resolve("project", "bank", "UNKNOWN SHOP"),
    ).resolves.toBeUndefined();
    await expect(
      readFile(
        join(
          directory,
          "projects",
          "project",
          "ingestion",
          "merchants",
          "merchant-events.jsonl",
        ),
        "utf8",
      ),
    ).resolves.toContain('"type":"cleared-suppression"');
  });
});
