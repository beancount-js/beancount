import { lunchflowConnector } from "@beancount-js/connector-lunchflow";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import {
  createRuleRegistry,
  applyRuleActions,
  proposalIsReadyForAcceptance,
  type DetectionRule,
  type ImportProposal,
  type IngestionRun,
  type MerchantIdentity,
  type RuleRun,
} from "@beancount-js/beangulp";
import type {
  IngestionSyncJob,
  MerchantReviewCluster,
} from "@beancount-js/server";
import type { IngestionConfigResponse } from "../../src/domain/ingestion/types";
import type { ReconciliationReviewResponse } from "../../src/domain/lib/reconciliation-review-response";
import { exampleIngestionConfig } from "../../src/domain/ingestion/source-form";
import { NOW } from "../fixtures/project";
type SaveFile = (
  id: string,
  path: string,
  contents: string,
  expectedRevision?: string,
) => Promise<ProjectSnapshot>;
function summary(
  proposals: readonly ImportProposal[],
): IngestionRun["summary"] {
  const count = (status: ImportProposal["status"]) =>
    proposals.filter((proposal) => proposal.status === status).length;
  return {
    total: proposals.length,
    ready: count("ready"),
    needsReview: count("needs-review"),
    accepted: count("accepted"),
    duplicates: count("duplicate"),
    invalid: count("invalid"),
    held: count("held"),
    excluded: count("excluded"),
  };
}
export function createApplicationServices(
  read: (id: string) => ProjectSnapshot,
  save: SaveFile,
) {
  const states = new Map<string, ReturnType<typeof seed>>();
  function seed() {
    const accounts = [
      "Assets:Checking",
      "Assets:Savings",
      "Expenses:Food",
      "Expenses:Rent",
      "Income:Salary",
    ];
    const config: IngestionConfigResponse = {
      ...structuredClone(exampleIngestionConfig),
      version: 3,
      accounts,
      brandCredentialAvailable: true,
      sources: exampleIngestionConfig.sources.map((source) => ({
        ...structuredClone(source),
        name: "Example bank",
        sourceAccount: "Assets:Checking",
        destinationPath: "main.beancount",
        credentialAvailable: true,
        allowedAccounts: accounts,
      })),
    };
    config.sources.push({
      id: "provider",
      name: "Fixture provider",
      kind: "lunchflow",
      destinationPath: "main.beancount",
      config: lunchflowConnector.defaultConfig(),
      accounts: [
        {
          id: "checking",
          name: "Current account",
          sourceAccount: "Assets:Checking",
          defaultCurrency: "GBP",
        },
      ],
      credentialAvailable: true,
      rules: [],
    });
    const proposals: ImportProposal[] = [
      {
        id: "proposal-coffee",
        importId: "fixture-coffee",
        status: "ready",
        selectedAccount: "Expenses:Food",
        issues: [],
        suggestions: [
          {
            account: "Expenses:Food",
            method: "rule",
            hard: true,
            explanation: "Confirmed fixture category",
            evidence: [],
          },
        ],
        transaction: {
          sourceId: "bank",
          sourceAccount: "Assets:Checking",
          bookedAt: "2024-04-02",
          amount: "-20",
          currency: "GBP",
          payee: "Example cafe",
          merchant: "Example cafe",
          narration: "Coffee with friends",
          status: "posted",
          fetchedAt: NOW,
          metadata: {},
        },
      },
      {
        id: "proposal-books",
        importId: "fixture-books",
        status: "needs-review",
        issues: [],
        suggestions: [],
        transaction: {
          sourceId: "bank",
          sourceAccount: "Assets:Checking",
          bookedAt: "2024-04-03",
          amount: "-45",
          currency: "GBP",
          payee: "Example bookshop",
          merchant: "Example bookshop",
          narration: "Books",
          status: "posted",
          fetchedAt: NOW,
          metadata: {},
        },
      },
    ];
    const run: IngestionRun = {
      id: "import-2024",
      sourceId: "bank",
      startedAt: NOW,
      completedAt: NOW,
      proposals,
      summary: summary(proposals),
      audit: { ai: [] },
    };
    const merchants: (MerchantIdentity & { notes: string })[] = [
      {
        merchantId: "merchant-example-cafe",
        canonicalName: "Example cafe",
        description: "A neighbourhood cafe",
        domain: "cafe.example",
        countryCode: "GB",
        notes: "",
        aliases: [
          {
            value: "EXAMPLE CAFE",
            normalizedValue: "example cafe",
            sourceId: "bank",
            confirmedAt: NOW,
          },
        ],
        provenance: [{ source: "manual", observedAt: NOW }],
      },
    ];
    proposals[0]!.merchantResolution = {
      status: "confirmed",
      rawLabel: "Example cafe",
      merchant: merchants[0]!,
      explanation: "Matched saved merchant",
    };
    const rules: DetectionRule[] = [
      {
        id: "rule-coffee",
        name: "Categorise coffee",
        active: true,
        resourceType: "transaction",
        effectiveDate: null,
        conditions: [
          {
            id: "condition-coffee",
            conditionType: "transaction_name",
            operator: "like",
            value: "Coffee",
          },
        ],
        actions: [
          {
            id: "action-food",
            actionType: "set_transaction_category",
            value: "Expenses:Food",
          },
        ],
      },
    ];
    const review: ReconciliationReviewResponse = {
      candidates: [
        {
          candidate: {
            id: "candidate-transfer",
            kind: "transfer",
            memberIds: ["leg-checking", "leg-savings"],
            confidence: "high",
            evidence: [
              {
                kind: "opposite-amount",
                summary: "The transfer legs have equal and opposite amounts.",
              },
              {
                kind: "same-day",
                summary: "Both legs were booked on the same day.",
              },
            ],
          },
          members: [
            {
              observation: {
                id: "leg-checking",
                origin: "proposal",
                sourceId: "bank",
                sourceAccount: "Assets:Checking",
                bookedAt: "2024-04-04",
                amount: "-50",
                currency: "GBP",
                narration: "Savings transfer",
                status: "posted",
              },
            },
            {
              observation: {
                id: "leg-savings",
                origin: "proposal",
                sourceId: "bank",
                sourceAccount: "Assets:Savings",
                bookedAt: "2024-04-04",
                amount: "50",
                currency: "GBP",
                narration: "Savings transfer",
                status: "posted",
              },
            },
          ],
        },
      ],
    };
    const clusters: MerchantReviewCluster[] = [
      {
        id: "cluster-bookshop",
        primary: { runId: run.id, proposalId: "proposal-books" },
        displayName: "Example bookshop",
        statuses: ["unresolved"],
        pendingCount: 1,
        members: [
          {
            rawLabel: "EXAMPLE BOOKSHOP",
            normalizedLabel: "example bookshop",
            count: 1,
            refs: [{ runId: run.id, proposalId: "proposal-books" }],
          },
        ],
        candidates: [
          {
            id: "bookshop",
            canonicalName: "Example bookshop",
            domain: "bookshop.example",
            description: "Books and stationery",
            countryCode: "GB",
            explanation: "Fixture merchant match",
            provenance: [],
          },
        ],
        transactions: [
          {
            runId: run.id,
            proposalId: "proposal-books",
            bookedAt: "2024-04-03",
            amount: "-45",
            currency: "GBP",
            payee: "Example bookshop",
            narration: "Books",
            rawLabel: "EXAMPLE BOOKSHOP",
            sourceAccount: "Assets:Checking",
            proposalStatus: "needs-review",
          },
        ],
      },
    ];
    return {
      config,
      runs: [run],
      merchants,
      rules,
      ruleRuns: [] as RuleRun[],
      review,
      clusters,
      jobs: new Map<string, IngestionSyncJob>(),
      sequence: 0,
    };
  }
  function state(id: string) {
    read(id);
    let value = states.get(id);
    if (!value) {
      value = seed();
      states.set(id, value);
    }
    return value;
  }
  function updateRun(run: IngestionRun) {
    run.summary = summary(run.proposals);
    return run;
  }
  function page<T>(items: T[], url: URL) {
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 50);
    return {
      runs: items.slice(offset, offset + limit),
      total: items.length,
      offset,
      limit,
    };
  }
  function reviewLedger(id: string) {
    const data = state(id);
    const accounts = [...data.config.accounts, "Expenses:Uncategorized"];
    let contents =
      'option "title" "Import review"\noption "operating_currency" "GBP"\n' +
      accounts.map((account) => `2024-01-01 open ${account} GBP`).join("\n") +
      "\n";
    for (const run of data.runs)
      for (const proposal of run.proposals) {
        const t = proposal.transaction;
        if (
          !t ||
          ["accepted", "excluded", "duplicate"].includes(proposal.status)
        )
          continue;
        contents += `\n${t.bookedAt} * ${JSON.stringify(t.payee || "")} ${JSON.stringify(t.narration)}\n  ${t.sourceAccount} ${t.amount} ${t.currency}\n  ${proposal.selectedAccount || "Expenses:Uncategorized"} ${-Number(t.amount)} ${t.currency}\n`;
      }
    return {
      path: ".beancount/ingestion/active-review.beancount",
      contents,
      revision: String(data.sequence),
      updatedAt: NOW,
    };
  }
  return {
    async request(input: string, init: RequestInit = {}) {
      if (init.signal?.aborted) throw init.signal.reason;
      const url = new URL(input, "http://fixture.invalid");
      const parts = url.pathname.split("/").map(decodeURIComponent);
      const id = parts[3]!;
      const data = state(id);
      const kind = parts[4];
      const path = parts.slice(5);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      if (kind === "rules") {
        if (!path.length) {
          if (method === "PUT") data.rules = body.rules;
          return Response.json({
            version: 1,
            rules: data.rules,
            registry: createRuleRegistry({
              accounts: data.config.accounts,
              merchants: data.merchants.map((merchant) => ({
                label: merchant.canonicalName,
                value: merchant.merchantId,
              })),
            }),
            accounts: data.config.accounts,
          });
        }
        if (path[0] === "runs") return Response.json(page(data.ruleRuns, url));
        if (path[0] === "apply") {
          const rules = data.rules.filter(
            (rule) =>
              rule.active &&
              (!body.ruleIds?.length || body.ruleIds.includes(rule.id)),
          );
          const preview = rules.map((rule) => ({
            ruleId: rule.id,
            ruleName: rule.name,
            target: body.target ?? "pending-imports",
            pendingImports: data.runs
              .flatMap((run) => run.proposals)
              .filter(
                (p) =>
                  p.transaction &&
                  applyRuleActions(rule, { transaction: p.transaction }),
              ).length,
            liveLedger: 0,
            total: 0,
          }));
          for (const item of preview) item.total = item.pendingImports;
          if (body.dryRun) return Response.json({ preview });
          const results = rules.map((rule) => {
            let modified = 0;
            for (const run of data.runs) {
              run.proposals = run.proposals.map((p) => {
                if (!p.transaction || p.status === "accepted") return p;
                const patch = applyRuleActions(rule, {
                  transaction: p.transaction,
                });
                if (!patch) return p;
                modified++;
                return {
                  ...p,
                  selectedAccount: patch.selectedAccount ?? p.selectedAccount,
                  status: patch.exclude
                    ? "excluded"
                    : patch.selectedAccount
                      ? "ready"
                      : p.status,
                  transaction: {
                    ...p.transaction,
                    narration: patch.narration ?? p.transaction.narration,
                    tags: patch.tags ?? p.transaction.tags,
                  },
                };
              });
              updateRun(run);
            }
            const runId = `rule-run-${++data.sequence}`;
            data.ruleRuns.push({
              id: runId,
              ruleId: rule.id,
              ruleName: rule.name ?? "Rule",
              executionType: "manual",
              target: body.target ?? "pending-imports",
              status: "success",
              executedAt: NOW,
              transactionsQueued: modified,
              transactionsProcessed: modified,
              transactionsModified: modified,
              transactionsBlocked: 0,
            });
            return {
              ruleId: rule.id,
              ruleName: rule.name,
              runId,
              status: "success",
              queued: modified,
              processed: modified,
              modified,
              blocked: 0,
              target: body.target ?? "pending-imports",
              targetCounts: {
                queued: { pendingImports: modified, liveLedger: 0 },
                processed: { pendingImports: modified, liveLedger: 0 },
                modified: { pendingImports: modified, liveLedger: 0 },
              },
            };
          });
          return Response.json({ results });
        }
      }
      if (kind !== "ingestion")
        return Response.json(
          { error: "Unsupported fixture service" },
          { status: 404 },
        );
      if (!path.length) {
        if (method === "PUT")
          data.config = {
            ...body,
            accounts: data.config.accounts,
            sources: body.sources.map(
              (source: IngestionConfigResponse["sources"][number]) => ({
                ...source,
                credentialAvailable: true,
                allowedAccounts: data.config.accounts,
              }),
            ),
          };
        return Response.json(data.config);
      }
      if (path[0] === "review-ledger") return Response.json(reviewLedger(id));
      if (path[0] === "sync") {
        if (method === "POST") {
          const job: IngestionSyncJob = {
            id: `sync-${++data.sequence}`,
            projectId: id,
            sourceId: body.sourceId || "bank",
            kind: body.mode ?? "sync",
            status: "running",
            startedAt: NOW,
            progress: {
              stage: "fetch",
              message: "Fetching fixture transactions",
            },
            runIds: ["import-2024"],
          };
          data.jobs.set(job.id, job);
          return Response.json({
            jobId: job.id,
            status: job.status,
            job,
            created: true,
          });
        }
        if (!path[1])
          return Response.json([...data.jobs.values()].at(-1) ?? null);
        const job = data.jobs.get(path[1]);
        if (!job) return Response.json(null);
        if (path[2] === "events") {
          const complete = {
            ...job,
            status: "completed" as const,
            completedAt: NOW,
            progress: {
              stage: "complete" as const,
              message: "Fixture sync complete",
            },
          };
          data.jobs.set(job.id, complete);
          const encoded = new TextEncoder().encode(
            JSON.stringify({ type: "progress", job }) +
              "\n" +
              JSON.stringify({ type: "done", job: complete }) +
              "\n",
          );
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(encoded);
                controller.close();
              },
            }),
            { headers: { "content-type": "application/x-ndjson" } },
          );
        }
        return Response.json(job);
      }
      if (path[0] === "discover-accounts" || path[0] === "discover")
        return Response.json({
          accounts: [
            {
              id: "checking",
              name: "Current account",
              currency: "GBP",
              institutionName: "Example bank",
            },
          ],
        });
      if (path[0] === "merchant-review") {
        if (method === "POST")
          return Response.json({ clusters: data.clusters.length, calls: 1 });
        return Response.json({ clusters: data.clusters });
      }
      if (path[0] === "merchants") {
        if (path[1] === "backfill")
          return Response.json({
            removedProfiles: 0,
            clearedTransactions: 0,
            createdProfiles: 0,
            patchedTransactions: 0,
            skipped: 0,
            snapshot: read(id),
          });
        if (!path[1]) {
          if (method === "POST") {
            const merchant = {
              merchantId: `merchant-${++data.sequence}`,
              canonicalName:
                body.canonicalName ?? body.name ?? body.query ?? "New merchant",
              notes: "",
              aliases: [],
              provenance: [{ source: "manual" as const, observedAt: NOW }],
              ...body,
            };
            data.merchants.push(merchant);
            return Response.json(merchant);
          }
          return Response.json(data.merchants);
        }
        const merchant = data.merchants.find((m) => m.merchantId === path[1]);
        if (!merchant)
          return Response.json(
            { error: "Merchant not found" },
            { status: 404 },
          );
        if (method === "PUT" || method === "PATCH")
          Object.assign(merchant, body);
        if (method === "DELETE")
          data.merchants = data.merchants.filter((m) => m !== merchant);
        return Response.json(merchant);
      }
      if (path[0] === "brand-search")
        return Response.json({
          candidates: [
            {
              id: "fixture-brand",
              canonicalName:
                body.query ??
                url.searchParams.get("query") ??
                "Example merchant",
              domain: "merchant.example",
              countryCode: "GB",
            },
          ],
        });
      if (path[0] === "reconciliation") {
        if (url.searchParams.get("summary") === "count")
          return Response.json({ count: data.review.candidates.length });
        if (path[2] === "apply")
          data.review.candidates = data.review.candidates.filter(
            (item) => item.candidate.id !== path[1],
          );
        if (method === "PUT") {
          const item = data.review.candidates.find(
            (item) => item.candidate.id === body.candidateId,
          );
          if (!item)
            return Response.json({ error: "Match not found" }, { status: 404 });
          item.decision = {
            candidateId: item.candidate.id,
            state: body.state,
            canonicalObservationId: body.canonicalObservationId,
            updatedAt: NOW,
          };
        }
        return Response.json(data.review);
      }
      if (path[0] === "runs") {
        if (!path[1]) {
          if (method === "POST") return Response.json(data.runs[0]);
          return Response.json(
            page(
              data.runs
                .filter(
                  (run) =>
                    !url.searchParams.get("sourceId") ||
                    url.searchParams.get("sourceId") === "all" ||
                    run.sourceId === url.searchParams.get("sourceId"),
                )
                .map((run) => ({
                  id: run.id,
                  sourceId: run.sourceId,
                  startedAt: run.startedAt,
                  completedAt: run.completedAt,
                  reviewState:
                    run.summary.ready || run.summary.needsReview
                      ? "pending"
                      : "completed",
                  summary: run.summary,
                  updatedAt: NOW,
                })),
              url,
            ),
          );
        }
        const run = data.runs.find((run) => run.id === path[1]);
        if (!run)
          return Response.json({ error: "Run not found" }, { status: 404 });
        if (path[2] === "accept") {
          const selected = run.proposals.filter((p) =>
            body.proposalIds.includes(p.id),
          );
          if (
            selected.some(
              (p) => !p.transaction || !proposalIsReadyForAcceptance(p),
            )
          )
            return Response.json(
              { error: "Only categorised ready proposals can be accepted" },
              { status: 400 },
            );
          const project = read(id);
          const destination =
            data.config.sources.find((source) => source.id === run.sourceId)
              ?.destinationPath ?? project.project.entryFile;
          const file = project.ledgerFiles.find(
            (file) => file.path === destination,
          )!;
          let contents = file.contents;
          for (const p of selected) {
            const t = p.transaction!;
            contents += `\n${t.bookedAt} * ${JSON.stringify(t.payee ?? "")} ${JSON.stringify(t.narration)}\n  import_id: ${JSON.stringify(p.importId)}\n  ${t.sourceAccount} ${t.amount} ${t.currency}\n  ${p.selectedAccount} ${-Number(t.amount)} ${t.currency}\n`;
          }
          const snapshot = await save(
            id,
            destination,
            contents,
            body.expectedRevision,
          );
          const ledgerRevision = snapshot.revisions.find(
            (rev) => rev.path === destination,
          )!.revision;
          run.proposals = run.proposals.map((p) =>
            selected.includes(p)
              ? {
                  ...p,
                  status: "accepted",
                  acceptance: {
                    acceptedAt: NOW,
                    destinationPath: destination,
                    ledgerRevision,
                  },
                }
              : p,
          );
          updateRun(run);
          return Response.json({ snapshot, run });
        }
        if (path[2] === "proposals") {
          const proposal = run.proposals.find((p) => p.id === path[3]);
          if (!proposal)
            return Response.json(
              { error: "Proposal not found" },
              { status: 404 },
            );
          const rawLabel = proposal.transaction?.merchant ?? "";
          if (path[4] === "enrich") {
            proposal.selectedAccount = "Expenses:Food";
            proposal.status = "ready";
            proposal.merchantResolution = {
              status: "suggested",
              rawLabel,
              candidates: data.clusters[0]?.candidates ?? [],
              explanation: "Fixture merchant detection",
            };
          } else if (body.action === "reject") {
            proposal.merchantResolution = {
              status: "suppressed",
              rawLabel,
              explanation: "Dismissed by reviewer",
            };
          } else if (body.action === "clear-suppression") {
            proposal.merchantResolution = { status: "unresolved", rawLabel };
          } else {
            let merchant = data.merchants.find(
              (m) => m.merchantId === body.merchantId,
            );
            if (!merchant) {
              merchant = {
                merchantId: `merchant-${++data.sequence}`,
                canonicalName: body.canonicalName ?? body.query ?? rawLabel,
                domain: body.domain,
                notes: "",
                aliases: [],
                provenance: [{ source: "manual", observedAt: NOW }],
              };
              data.merchants.push(merchant);
            }
            proposal.merchantResolution = {
              status: "confirmed",
              rawLabel,
              merchant,
              explanation: "Confirmed by reviewer",
            };
            data.clusters = data.clusters.filter(
              (cluster) => cluster.primary.proposalId !== proposal.id,
            );
          }
          updateRun(run);
          return Response.json({ run });
        }
        if (method === "PATCH")
          run.proposals = run.proposals.map((p) =>
            p.id === body.proposalId
              ? {
                  ...p,
                  selectedAccount: body.account ?? p.selectedAccount,
                  status: body.status ?? (body.account ? "ready" : p.status),
                  transaction: body.transaction
                    ? { ...p.transaction, ...body.transaction }
                    : p.transaction,
                }
              : p,
          );
        return Response.json(updateRun(run));
      }
      return Response.json(
        { error: `Unsupported fixture operation: ${method} ${url.pathname}` },
        { status: 404 },
      );
    },
  };
}
