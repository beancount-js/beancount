import { DateTime } from "luxon";
import type {
  NormalizeContext,
  NormalizeResult,
  NormalizerPlugin,
} from "@beancount-js/beangulp";
import type { MonzoTransaction } from "./types";
import { monzoProviderCategory } from "./categories";

function scalar(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function currencyScale(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

function decimalAmount(value: unknown, currencyValue: unknown) {
  const currency = scalar(currencyValue)?.toUpperCase();
  const raw = scalar(value);
  if (!currency || !raw || !/^-?\d+$/.test(raw)) return undefined;
  let minor: bigint;
  try {
    minor = BigInt(raw);
  } catch {
    return undefined;
  }
  const negative = minor < 0n;
  const absolute = negative ? -minor : minor;
  const scale = currencyScale(currency);
  const digits = absolute.toString().padStart(scale + 1, "0");
  const unsigned = scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    : digits;
  return {
    amount: negative && absolute !== 0n ? `-${unsigned}` : unsigned,
    currency,
  };
}

function date(value: string | undefined) {
  if (!value) return undefined;
  const parsed = DateTime.fromISO(value, { zone: "utc" });
  return parsed.isValid ? (parsed.toISODate() ?? undefined) : undefined;
}

function metadataValue(
  metadata: Record<string, string>,
  key: string,
  value: unknown,
) {
  const next = scalar(value);
  if (next) metadata[key] = next;
}

function merchantDetails(value: MonzoTransaction["merchant"]) {
  if (typeof value === "string") {
    return { id: scalar(value), name: undefined };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { id: undefined, name: undefined };
  }
  return { id: scalar(value.id), name: scalar(value.name) };
}

export class MonzoNormalizer implements NormalizerPlugin<MonzoTransaction> {
  readonly kind = "monzo";

  normalize(
    record: MonzoTransaction,
    context: NormalizeContext,
  ): NormalizeResult {
    const externalId = scalar(record.id);
    if (!externalId) {
      return { ok: false, message: "Transaction is missing its id." };
    }
    const money = decimalAmount(record.amount, record.currency);
    if (!money) {
      return { ok: false, message: "Transaction is missing a valid amount." };
    }
    const bookedAt = date(record.settled);
    if (!bookedAt) {
      return {
        ok: false,
        message: "Transaction is missing a valid settlement time.",
      };
    }

    const description = scalar(record.description);
    const merchantDetailsValue = merchantDetails(record.merchant);
    const merchant = merchantDetailsValue.name;
    const payee = merchant ? undefined : description;
    const narration =
      scalar(record.notes) ?? description ?? merchant ?? "Monzo transaction";
    const metadata: Record<string, string> = {};
    metadataValue(metadata, "monzo_category", record.category);
    metadataValue(metadata, "monzo_description", record.description);
    metadataValue(metadata, "monzo_created", record.created);
    metadataValue(metadata, "monzo_is_load", record.is_load);
    metadataValue(metadata, "monzo_merchant_id", merchantDetailsValue.id);
    metadataValue(metadata, "monzo_decline_reason", record.decline_reason);
    metadataValue(
      metadata,
      "monzo_include_in_spending",
      record.include_in_spending,
    );
    metadataValue(metadata, "monzo_dedupe_id", record.dedupe_id);
    metadataValue(metadata, "monzo_scheme", record.scheme);

    return {
      ok: true,
      transaction: {
        sourceId: context.sourceId,
        sourceAccount: context.sourceAccount,
        externalId,
        bookedAt,
        amount: money.amount,
        currency: money.currency,
        merchant,
        payee,
        narration,
        status: "posted",
        fetchedAt: context.fetchedAt,
        metadata,
        providerCategory: monzoProviderCategory(record.category),
      },
    };
  }
}
