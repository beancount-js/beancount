import { DateTime } from "luxon";
import type {
  JsonRecord,
  NormalizeContext,
  NormalizeResult,
  NormalizerPlugin,
} from "@beancount-js/beangulp";

function scalar(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function parseDate(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const iso = DateTime.fromISO(value.trim(), { zone: "utc" });
  if (iso.isValid) return iso.toISODate() ?? undefined;
  const ymd = DateTime.fromFormat(value.trim(), "yyyy-MM-dd", { zone: "utc" });
  if (ymd.isValid) return ymd.toISODate() ?? undefined;
  return undefined;
}

function parseAmount(value: string | undefined): string | undefined {
  if (value == null || !String(value).trim()) return undefined;
  const normalized = String(value).trim().replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  return normalized;
}

export class LunchflowNormalizer implements NormalizerPlugin<JsonRecord> {
  readonly kind = "lunchflow";

  normalize(record: JsonRecord, context: NormalizeContext): NormalizeResult {
    const bookedAt = parseDate(scalar(record.date));
    const amount = parseAmount(scalar(record.amount));
    if (!bookedAt) {
      return { ok: false, message: "Transaction is missing a valid date." };
    }
    if (!amount) {
      return { ok: false, message: "Transaction is missing a valid amount." };
    }
    const currency =
      scalar(record.currency)?.trim().toUpperCase() ||
      context.defaultCurrency ||
      "USD";
    const merchant = scalar(record.merchant)?.trim() || undefined;
    const narration =
      scalar(record.description)?.trim() ||
      merchant ||
      "Lunch Flow transaction";
    const pending =
      record.isPending === true ||
      record.isPending === "true" ||
      record.isPending === 1;
    const externalId = scalar(record.id)?.trim() || undefined;

    return {
      ok: true,
      transaction: {
        sourceId: context.sourceId,
        sourceAccount: context.sourceAccount,
        externalId,
        bookedAt,
        amount,
        currency,
        merchant,
        narration,
        status: pending ? "pending" : "posted",
        fetchedAt: context.fetchedAt,
        metadata: {},
      },
    };
  }
}
