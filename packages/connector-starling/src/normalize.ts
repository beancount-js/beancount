import { DateTime } from "luxon";
import type {
  NormalizeContext,
  NormalizeResult,
  NormalizerPlugin,
} from "@beancount-js/beangulp";
import type { StarlingCurrencyAndAmount, StarlingFeedItem } from "./types";

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

function decimalAmount(
  value: StarlingCurrencyAndAmount | undefined,
  direction?: string,
) {
  const currency = scalar(value?.currency)?.toUpperCase();
  const raw = scalar(value?.minorUnits);
  if (!currency || !raw || !/^\d+$/.test(raw)) return undefined;
  let minor: bigint;
  try {
    minor = BigInt(raw);
  } catch {
    return undefined;
  }
  const scale = currencyScale(currency);
  const digits = minor.toString().padStart(scale + 1, "0");
  const unsigned = scale
    ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
    : digits;
  return {
    amount: direction === "OUT" && minor !== 0n ? `-${unsigned}` : unsigned,
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

export class StarlingNormalizer implements NormalizerPlugin<StarlingFeedItem> {
  readonly kind = "starling";

  normalize(
    record: StarlingFeedItem,
    context: NormalizeContext,
  ): NormalizeResult {
    const externalId = scalar(record.feedItemUid);
    if (!externalId) {
      return { ok: false, message: "Transaction is missing its feed item id." };
    }
    if (record.direction !== "IN" && record.direction !== "OUT") {
      return { ok: false, message: "Transaction has an invalid direction." };
    }
    const money = decimalAmount(record.amount, record.direction);
    if (!money) {
      return { ok: false, message: "Transaction is missing a valid amount." };
    }
    const bookedAt = date(record.settlementTime ?? record.transactionTime);
    if (!bookedAt) {
      return {
        ok: false,
        message:
          "Transaction is missing a valid settlement or transaction time.",
      };
    }

    const counterParty = scalar(record.counterPartyName);
    const merchant =
      record.counterPartyType === "MERCHANT" ? counterParty : undefined;
    const payee =
      record.counterPartyType !== "MERCHANT" ? counterParty : undefined;
    const narration =
      scalar(record.userNote) ??
      scalar(record.reference) ??
      scalar(record.counterPartySubEntityName) ??
      counterParty ??
      "Starling transaction";
    const metadata: Record<string, string> = {};
    metadataValue(metadata, "starling_source", record.source);
    metadataValue(metadata, "starling_source_subtype", record.sourceSubType);
    metadataValue(
      metadata,
      "starling_spending_category",
      record.spendingCategory,
    );
    metadataValue(metadata, "starling_country", record.country);
    metadataValue(
      metadata,
      "starling_counterparty_type",
      record.counterPartyType,
    );
    metadataValue(metadata, "starling_exchange_rate", record.exchangeRate);
    metadataValue(metadata, "starling_total_fees", record.totalFees);
    const sourceMoney = decimalAmount(record.sourceAmount, record.direction);
    if (sourceMoney) {
      metadata.starling_source_amount = sourceMoney.amount;
      metadata.starling_source_currency = sourceMoney.currency;
    }
    const feeMoney = decimalAmount(record.totalFeeAmount);
    if (feeMoney) {
      metadata.starling_fee_amount = feeMoney.amount;
      metadata.starling_fee_currency = feeMoney.currency;
    }

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
      },
    };
  }
}
