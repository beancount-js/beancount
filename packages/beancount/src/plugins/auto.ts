import type { BeancountOptions } from "../core";
import type { Directives } from "../core/data";
import type { ValidationError } from "../ops/validation";
import { autoInsertOpen } from "./autoaccount";
import { addImplicitPrices } from "./implicit_prices";

/** Upstream's convenience composition of auto accounts and implicit prices. */
export function auto(
  entries: Directives,
  options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const [opened, openErrors] = autoInsertOpen(entries, options);
  const [priced, priceErrors] = addImplicitPrices(opened, options);
  return [priced, [...openErrors, ...priceErrors]];
}
