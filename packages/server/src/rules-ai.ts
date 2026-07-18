import {
  type CategorizationContext,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import { CodexCategorizer, CodexMerchantAdvisor } from "./ingestion";
import type {
  RuleAiBatchInput,
  RuleAiBatchOutcome,
  RuleAiExecutor,
} from "./rules-apply";

const BATCH_SIZE = 25;
const BATCH_CONCURRENCY = 2;

function chunks<T>(items: readonly T[]) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) {
    result.push([...items.slice(index, index + BATCH_SIZE)]);
  }
  return result;
}

async function runBatches<T, R>(
  items: readonly T[],
  run: (batch: readonly T[]) => Promise<readonly R[]>,
) {
  const batches = chunks(items);
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(BATCH_CONCURRENCY, batches.length) },
    async () => {
      while (cursor < batches.length) {
        const index = cursor;
        cursor += 1;
        results.push(...(await run(batches[index]!)));
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function merchantResolution(
  transaction: RuleAiBatchInput["transaction"],
): MerchantResolution {
  const rawLabel =
    transaction.merchant ?? transaction.payee ?? transaction.narration ?? "";
  return rawLabel
    ? {
        status: "unresolved",
        rawLabel,
        explanation: "Merchant detection has not run for this transaction.",
      }
    : {
        status: "unresolved",
        explanation: "No merchant label was supplied.",
      };
}

/**
 * Batch-backed executor for AI rule actions. It intentionally uses the same
 * structured Codex adapters as ingestion, so a manual bulk run never creates
 * one model process per transaction.
 */
export function createCodexRuleAiExecutor(options?: {
  model?: string;
  timeoutMs?: number;
}): RuleAiExecutor {
  const categorizer = new CodexCategorizer(options);
  const merchantAdvisor = new CodexMerchantAdvisor(options);
  return {
    async categorise(inputs) {
      return runBatches(inputs, async (batch) => {
        const results = await categorizer.suggestBatch(
          batch.map((input) => ({
            id: input.id,
            context: {
              transaction: input.transaction,
              merchant: input.merchant,
              history: [],
              availableAccounts: input.availableAccounts,
            } satisfies CategorizationContext,
          })),
        );
        return results.map(
          ({ id, value }) =>
            ({
              id,
              selectedAccount: value[0]?.account,
            }) satisfies RuleAiBatchOutcome,
        );
      });
    },

    async detectMerchants(inputs) {
      const detectable = inputs.filter((input) =>
        Boolean(
          input.transaction.merchant ??
            input.transaction.payee ??
            input.transaction.narration,
        ),
      );
      return runBatches(detectable, async (batch) => {
        const results = await merchantAdvisor.resolveBatch(
          batch.map((input) => ({
            id: input.id,
            context: {
              transaction: input.transaction,
              resolution: merchantResolution(input.transaction),
            },
          })),
        );
        return results.map(({ id, value }) => {
          const merchant =
            value.status === "suggested"
              ? value.candidates[0]?.canonicalName
              : undefined;
          return { id, merchant } satisfies RuleAiBatchOutcome;
        });
      });
    },
  };
}
