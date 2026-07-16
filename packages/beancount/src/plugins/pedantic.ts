import type { BeancountOptions, Directives } from "../core";
import type { ValidationError } from "../ops/validation";
import { validateCommodityDirectives } from "./check_commodity";
import { checkDrained } from "./check_drained";
import { validateCoherentCost } from "./coherent_cost";
import { validateLeafOnly } from "./leafonly";
import { validateNoDuplicates } from "./noduplicates";
import { validateUnusedAccounts } from "./nounused";
import { validateOneCommodity } from "./onecommodity";
import { validateSellGains } from "./sellgains";
import { validateUniquePrices } from "./unique_prices";

type PedanticPlugin = (
  entries: Directives,
  options: BeancountOptions,
) => [Directives, ValidationError[]];

const PEDANTIC_PLUGINS: PedanticPlugin[] = [
  validateCommodityDirectives,
  validateCoherentCost,
  validateLeafOnly,
  validateNoDuplicates,
  validateUnusedAccounts,
  validateOneCommodity,
  validateSellGains,
  validateUniquePrices,
  checkDrained,
];

/** Runs the upstream pedantic validator bundle in its declared order. */
export function pedantic(
  entries: Directives,
  options: BeancountOptions,
): [Directives, ValidationError[]] {
  let transformed = entries;
  const errors: ValidationError[] = [];
  for (const plugin of PEDANTIC_PLUGINS) {
    const [nextEntries, nextErrors] = plugin(transformed, options);
    transformed = nextEntries;
    errors.push(...nextErrors);
  }
  return [transformed, errors];
}
