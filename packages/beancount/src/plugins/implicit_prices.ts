import type { BeancountOptions } from "../core";
import { Amount, Inventory, MatchResult, Price, Transaction } from "../core";
import type { Directives, Posting } from "../core/data";
import type { ValidationError } from "../ops/validation";

export const IMPLICIT_PRICES_META = "__implicit_prices__";

function metadataFrom(entry: Transaction, source: string) {
  return {
    filename: entry.meta.filename ?? "",
    lineno: entry.meta.lineno ?? 0,
    [IMPLICIT_PRICES_META]: source,
  };
}

function priceFromPosting(
  entry: Transaction,
  posting: Posting,
  booking: MatchResult,
): Price | null {
  if (!posting.units?.currency) return null;

  if (posting.price) {
    return new Price(
      entry.date,
      posting.units.currency,
      posting.price,
      metadataFrom(entry, "from_price"),
    );
  }

  const cost = posting.resolvedCost;
  if (!cost?.amount || booking === MatchResult.REDUCED) return null;
  return new Price(
    entry.date,
    posting.units.currency,
    new Amount(cost.amount),
    metadataFrom(entry, "from_cost"),
  );
}

/**
 * Adds price directives implied by a posting price or an augmenting lot cost.
 * This is an adaptation of upstream beancount.plugins.implicit_prices for the
 * JavaScript directive and inventory models.
 */
export function addImplicitPrices(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const balances = new Map<string, Inventory>();
  const generated = new Set<string>();
  const response: Directives = [];

  for (const entry of entries) {
    response.push(entry);
    if (!(entry instanceof Transaction)) continue;

    for (const posting of entry.postings) {
      if (!posting.units) continue;
      const balance = balances.get(posting.account) ?? new Inventory();
      balances.set(posting.account, balance);
      const [, booking] = balance.addPosting(posting);
      const price = priceFromPosting(entry, posting, booking);
      if (!price) continue;

      const key = [
        price.date.toISODate(),
        price.currency,
        price.amount.units.toString(),
        price.amount.currency,
      ].join("\u0000");
      if (!generated.has(key)) {
        generated.add(key);
        response.push(price);
      }
    }
  }
  return [response, []];
}
