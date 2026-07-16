import type { BeancountOptions } from "../core";
import { Amount, Balance, Transaction, type Directives } from "../core";
import type { ValidationError } from "../ops/validation";

/** Expands posting metadata `closing: true` into a next-day zero balance check. */
export function checkClosing(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const response: Directives = [];
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) {
      response.push(entry);
      continue;
    }
    const balances: Balance[] = [];
    const postings = entry.postings.map((posting) => {
      if (!posting.meta.closing || !posting.units?.currency) return posting;
      const { closing: _closing, ...meta } = posting.meta;
      balances.push(
        new Balance(
          entry.date.plus({ days: 1 }),
          posting.account,
          new Amount(0, posting.units.currency),
          undefined,
          "",
          { filename: "<check_closing>", lineno: 0 },
        ),
      );
      return posting.copy({ meta });
    });
    response.push(entry.copy({ postings }), ...balances);
  }
  return [response, []];
}
