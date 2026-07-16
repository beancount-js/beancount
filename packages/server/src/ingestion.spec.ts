import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  categoryAccountsForSource,
  expandIngestionSource,
  FilesystemIngestionStore,
  merchantAdvisorLabel,
  type IngestionConfig,
} from "./ingestion";
import { ensureProposalMerchantPersisted } from "./merchant-persist";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function storeFor(directory: string) {
  return new FilesystemIngestionStore({
    resolveProjectRoot: (project) => join(directory, project),
  });
}

function ingestionPath(directory: string, project: string, ...parts: string[]) {
  return join(directory, project, ".beancount", "ingestion", ...parts);
}

function config(
  endpoint = "https://api.example.test/transactions",
): IngestionConfig {
  return {
    version: 2,
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
    const store = storeFor(directory);

    await store.writeConfig("project", config());

    const persisted = await readFile(
      ingestionPath(directory, "project", "sources.json"),
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
    const store = storeFor(directory);
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
      version: 2,
      brandfetch: expect.objectContaining({
        enabled: true,
        apiKeySecretRef: "env:BRANDFETCH_API_KEY",
        clientId: "test-client",
      }),
      sources: [
        expect.objectContaining({
          id: "bank",
          allowedAccountRoots: ["Expenses", "Assets"],
          api: expect.objectContaining({
            allowedHosts: ["api.example.test"],
          }),
          merchantEnrichment: expect.objectContaining({
            enabled: true,
            aiEnabled: true,
            countryCode: "GB",
          }),
        }),
      ],
    });
    const persisted = await store.readConfig("project");
    expect(persisted.sources[0].merchantEnrichment?.brandfetch).toBeUndefined();
  });

  test("rejects non-local HTTP endpoints before a run can use a credential", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

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

  test("migrates Lunch Flow json-api templates to the lunchflow connector", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);
    const grouped: IngestionConfig = {
      version: 1,
      sources: [
        {
          id: "lunchflow",
          name: "Lunch Flow",
          kind: "json-api",
          api: {
            baseUrl: "https://lunchflow.app/api/v1",
            allowedHosts: ["lunchflow.app"],
            secretRef: "env:LUNCHFLOW_API_KEY",
            authScheme: "x-api-key",
            recordsPath: "transactions",
          },
          mapping: {
            id: "id",
            date: "date",
            amount: "amount",
            merchant: "merchant",
            narration: "description",
            status: "isPending",
          },
          accounts: [
            {
              id: "42",
              name: "Current",
              sourceAccount: "Assets:Bank:Current",
              defaultCurrency: "GBP",
            },
            {
              id: "99",
              name: "Amex",
              sourceAccount: "Liabilities:Credit:Amex",
              defaultCurrency: "GBP",
            },
          ],
          rules: [],
        },
      ],
    };

    await store.writeConfig("project", grouped);
    const persisted = await store.readConfig("project");
    expect(persisted.sources[0].kind).toBe("lunchflow");
    expect(persisted.sources[0].config).toMatchObject({
      baseUrl: "https://lunchflow.app/api/v1",
      secretRef: "env:LUNCHFLOW_API_KEY",
    });
    expect(persisted.sources[0].api).toBeUndefined();
    expect(persisted.sources[0].accounts).toHaveLength(2);

    const targets = expandIngestionSource(persisted.sources[0]);
    expect(targets.map((target) => target.sourceId)).toEqual([
      "lunchflow:42",
      "lunchflow:99",
    ]);
    expect(targets[0].accountId).toBe("42");
    expect(targets[0].api).toBeUndefined();
    expect(
      categoryAccountsForSource(persisted.sources[0], [
        "Assets:Bank:Current",
        "Liabilities:Credit:Amex",
        "Expenses:Food",
      ]),
    ).toEqual(["Expenses:Food"]);
  });

  test("allows grouped connections before any accounts are linked", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

    await store.writeConfig("project", {
      version: 1,
      sources: [
        {
          id: "lunchflow",
          name: "Lunch Flow",
          kind: "json-api",
          api: {
            baseUrl: "https://lunchflow.app/api/v1",
            allowedHosts: ["lunchflow.app"],
            secretRef: "env:LUNCHFLOW_API_KEY",
          },
          mapping: { date: "date", amount: "amount" },
          accounts: [],
          rules: [],
        },
      ],
    });
    await expect(store.readConfig("project")).resolves.toMatchObject({
      sources: [{ id: "lunchflow", kind: "lunchflow", accounts: [] }],
    });
  });

  test("persists confirmed merchants as Markdown profiles and resolves source aliases", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

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
      ingestionPath(
        directory,
        "project",
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
      storeFor(directory).merchants.resolve(
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
        ingestionPath(
          directory,
          "project",
          "merchants",
          "merchant-events.jsonl",
        ),
        "utf8",
      ),
    ).resolves.toContain('"type":"cleared-suppression"');
  });

  test("auto-persists a merchant profile for unresolved accept proposals", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

    const next = await ensureProposalMerchantPersisted(
      store.merchants,
      "project",
      "bank",
      {
        id: "p1",
        importId: "bank:1",
        status: "ready",
        selectedAccount: "Expenses:Food",
        suggestions: [],
        issues: [],
        merchantResolution: {
          status: "unresolved",
          rawLabel: "Pure Gym",
          explanation: "No confirmed merchant profile matched this transaction.",
        },
        transaction: {
          sourceId: "bank",
          sourceAccount: "Assets:Bank:Checking",
          bookedAt: "2026-07-01",
          amount: "-20.00",
          currency: "GBP",
          payee: "Pure Gym",
          narration: "Membership",
          status: "posted",
          fetchedAt: "2026-07-02T00:00:00.000Z",
        },
      },
    );

    expect(next.merchantResolution).toMatchObject({
      status: "confirmed",
      merchant: { canonicalName: "Pure Gym" },
    });
    await expect(store.merchants.list("project")).resolves.toEqual([
      expect.objectContaining({ canonicalName: "Pure Gym" }),
    ]);
  });

  test("updates persisted merchant profile details directly", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-test-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

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

    const updated = await store.merchants.update("project", merchant.merchantId, {
      canonicalName: "Tesco Stores",
      domain: "www.tesco.com",
      description: "Updated description.",
      industry: "Grocery",
      countryCode: "gb",
      notes: "Preferred grocery merchant.",
    });

    expect(updated).toMatchObject({
      merchantId: merchant.merchantId,
      canonicalName: "Tesco Stores",
      domain: "www.tesco.com",
      description: "Updated description.",
      industry: "Grocery",
      countryCode: "GB",
      notes: "Preferred grocery merchant.",
    });
    await expect(
      store.merchants.getDetails("project", merchant.merchantId),
    ).resolves.toMatchObject({
      canonicalName: "Tesco Stores",
      notes: "Preferred grocery merchant.",
    });
    await expect(
      store.merchants.findByDomain("project", "www.tesco.com"),
    ).resolves.toMatchObject({ merchantId: merchant.merchantId });
    await expect(
      store.merchants.update("project", merchant.merchantId, {
        domain: "not a domain",
      }),
    ).rejects.toThrow(/valid domain/i);
  });

  test("confirm with targetMerchantId attaches alias to the existing merchant", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-merge-"),
    );
    directories.push(directory);
    const store = storeFor(directory);

    const existing = await store.merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "TESCO STORES 1234",
      candidate: {
        id: "ai:tesco",
        canonicalName: "Tesco",
        domain: "tesco.com",
        explanation: "First confirmation.",
        provenance: [
          {
            source: "ai",
            provider: "codex",
            observedAt: "2026-07-15T12:00:00.000Z",
          },
        ],
      },
    });

    const attached = await store.merchants.confirm("project", {
      sourceId: "bank",
      rawLabel: "TESCO EXPRESS 99",
      targetMerchantId: existing.merchantId,
      candidate: {
        id: "ai:tesco-express",
        canonicalName: "Tesco Express",
        domain: "tesco.com",
        explanation: "Should merge into existing Tesco.",
        provenance: [
          {
            source: "ai",
            provider: "codex",
            observedAt: "2026-07-15T12:05:00.000Z",
          },
        ],
      },
    });

    expect(attached.merchantId).toBe(existing.merchantId);
    expect(attached.canonicalName).toBe("Tesco");
    expect(attached.domain).toBe("tesco.com");
    expect(attached.aliases.map((alias) => alias.normalizedValue)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("tesco stores"),
        expect.stringContaining("tesco express"),
      ]),
    );

    const listed = await store.merchants.list("project");
    expect(listed).toHaveLength(1);
    await expect(
      store.merchants.resolve("project", "bank", "TESCO EXPRESS 99"),
    ).resolves.toMatchObject({
      status: "confirmed",
      merchant: { merchantId: existing.merchantId, canonicalName: "Tesco" },
    });
    await expect(
      store.merchants.findByDomain("project", "tesco.com"),
    ).resolves.toMatchObject({ merchantId: existing.merchantId });
  });

  test("persists sync jobs and fails interrupted ones", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-sync-"),
    );
    directories.push(directory);
    const store = storeFor(directory);
    await store.writeConfig("project", config());

    const job = {
      id: "sync:test-1",
      projectId: "project",
      sourceId: "bank",
      status: "running" as const,
      startedAt: "2026-07-16T00:00:00.000Z",
      progress: { stage: "fetch" as const, message: "Fetching…" },
      runIds: [],
    };
    await store.saveSyncJob("project", job);
    await expect(store.readSyncJob("project", job.id)).resolves.toMatchObject({
      id: job.id,
      status: "running",
    });
    await expect(store.findActiveSyncJob("project", "bank")).resolves.toMatchObject(
      { id: job.id },
    );

    expect(await store.failInterruptedSyncJobs("project")).toBe(1);
    await expect(store.readSyncJob("project", job.id)).resolves.toMatchObject({
      status: "failed",
      error: expect.stringContaining("restarted"),
    });
    await expect(store.findActiveSyncJob("project", "bank")).resolves.toBeNull();
  });

  test("sourceForRunSourceId resolves grouped account run ids", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-source-"),
    );
    directories.push(directory);
    const store = storeFor(directory);
    const grouped: IngestionConfig = {
      version: 2,
      sources: [
        {
          id: "lunchflow",
          name: "Lunch Flow",
          kind: "lunchflow",
          config: {
            baseUrl: "https://www.lunchflow.app/api/v1",
            allowedHosts: ["www.lunchflow.app", "lunchflow.app"],
            secretRef: "env:LUNCHFLOW_API_KEY",
          },
          rules: [],
          accounts: [
            {
              id: "starling",
              name: "Personal",
              sourceAccount: "Assets:Checking:Starling",
            },
          ],
        },
      ],
    };
    await store.writeConfig("project", grouped);
    await expect(
      store.sourceForRunSourceId("project", "lunchflow:starling"),
    ).resolves.toMatchObject({ id: "lunchflow" });
    await expect(
      store.sourceForRunSourceId("project", "lunchflow:7072"),
    ).resolves.toMatchObject({ id: "lunchflow" });
    await expect(store.source("project", "lunchflow:7072")).rejects.toThrow(
      "Unknown ingestion source: lunchflow:7072",
    );
  });

  test("patchProposal updates transaction fields tags and metadata", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "beancount-js-ingestion-patch-"),
    );
    directories.push(directory);
    const store = storeFor(directory);
    await store.writeConfig("project", config());
    await store.saveRun("project", {
      id: "run:patch-1",
      sourceId: "bank",
      startedAt: "2026-07-16T00:00:00.000Z",
      completedAt: "2026-07-16T00:00:01.000Z",
      proposals: [
        {
          id: "proposal:1",
          importId: "bank:txn-1",
          status: "needs-review",
          suggestions: [],
          issues: [],
          transaction: {
            sourceId: "bank",
            sourceAccount: "Assets:Bank:Checking",
            bookedAt: "2026-07-01",
            amount: "-12.00",
            currency: "GBP",
            narration: "Coffee",
            status: "posted",
            fetchedAt: "2026-07-16T00:00:00.000Z",
            metadata: { note: "old" },
          },
        },
      ],
      summary: {
        total: 1,
        ready: 0,
        needsReview: 1,
        duplicates: 0,
        invalid: 0,
        held: 0,
        excluded: 0,
      },
    });

    const updated = await store.patchProposal(
      "project",
      "run:patch-1",
      "proposal:1",
      {
        account: "Expenses:Food:Dining",
        transaction: {
          bookedAt: "2026-07-02",
          amount: "-13.50",
          currency: "GBP",
          payee: "Cafe Nero",
          narration: "Latte",
          tags: ["food", "coffee"],
          links: ["receipt-1"],
          metadata: { note: "edited", tip: "yes" },
        },
      },
    );
    const proposal = updated.proposals[0];
    expect(proposal.status).toBe("ready");
    expect(proposal.selectedAccount).toBe("Expenses:Food:Dining");
    expect(proposal.transaction).toMatchObject({
      bookedAt: "2026-07-02",
      amount: "-13.50",
      payee: "Cafe Nero",
      narration: "Latte",
      tags: ["food", "coffee"],
      links: ["receipt-1"],
      metadata: { note: "edited", tip: "yes" },
    });

    const pending = await store.patchProposal(
      "project",
      "run:patch-1",
      "proposal:1",
      { status: "needs-review" },
    );
    expect(pending.proposals[0]?.status).toBe("needs-review");
    expect(pending.proposals[0]?.selectedAccount).toBe("Expenses:Food:Dining");

    const readyAgain = await store.patchProposal(
      "project",
      "run:patch-1",
      "proposal:1",
      { status: "ready" },
    );
    expect(readyAgain.proposals[0]?.status).toBe("ready");
  });
});
