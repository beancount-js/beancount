import {
  AccountTypes,
  Amount,
  Inventory,
  Transaction,
  defaultBeancountOptions,
  getWeight,
  inferTolerances,
  type BeancountOptions,
  type Directives,
} from "../core";
import { ValidationError } from "../ops/validation";

const EXTRA_TOLERANCE_MULTIPLIER = 2;

function amountsByCurrency(inventory: Inventory) {
  return new Map(
    inventory.positions
      .filter((position) => position.units.currency)
      .map((position) => [position.units.currency!, position.units.value]),
  );
}

/** Cross-checks priced lot-sale proceeds against non-income transaction legs. */
export function validateSellGains(
  entries: Directives,
  options: BeancountOptions = defaultBeancountOptions(),
): [Directives, Array<ValidationError>] {
  const accountTypes = new AccountTypes(options);
  const proceedsTypes = new Set([
    accountTypes.assets,
    accountTypes.liabilities,
    accountTypes.equity,
    accountTypes.expenses,
  ]);
  const errors: ValidationError[] = [];

  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    const costed = entry.postings.filter((posting) => posting.cost);
    if (costed.length === 0 || costed.some((posting) => !posting.price))
      continue;

    const pricedTotals = new Inventory();
    const proceedsTotals = new Inventory();
    for (const posting of entry.postings) {
      if (posting.cost && posting.price && posting.units) {
        pricedTotals.addAmount(posting.price.mul(-posting.units.number));
      } else if (
        proceedsTypes.has(accountTypes.getAccountType(posting.account))
      ) {
        proceedsTotals.addAmount(getWeight(posting));
      }
    }

    const prices = amountsByCurrency(pricedTotals);
    const proceeds = amountsByCurrency(proceedsTotals);
    const tolerances = inferTolerances(entry.postings, options);
    let invalid = false;
    for (const [currency, expected] of prices) {
      const actual = proceeds.get(currency) ?? new Amount(0).value;
      const tolerance = (tolerances[currency] ?? new Amount(0).value).mul(
        EXTRA_TOLERANCE_MULTIPLIER,
      );
      proceeds.delete(currency);
      if (expected.minus(actual).abs().gt(tolerance)) {
        invalid = true;
        break;
      }
    }
    if (invalid || proceeds.size > 0) {
      errors.push(
        new ValidationError(
          `Invalid price vs. proceeds/gains: ${pricedTotals} vs. ${proceedsTotals}`,
          entry,
        ),
      );
    }
  }
  return [entries, errors];
}
