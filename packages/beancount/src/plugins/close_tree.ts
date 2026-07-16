import type { BeancountOptions } from "../core";
import { Close, Open, type Directives } from "../core/data";
import type { ValidationError } from "../ops/validation";

const PLUGIN_FILENAME = "<beancount.plugins.close_tree>";

/**
 * Closes every opened descendant when an account is closed. Explicit close
 * directives win, and a close of an unopened parent is replaced by its
 * generated descendant closes, matching upstream close_tree behavior.
 */
export function closeTree(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const opens = new Set(
    entries
      .filter((entry): entry is Open => entry instanceof Open)
      .map((entry) => entry.account),
  );
  const closes = new Set(
    entries
      .filter((entry): entry is Close => entry instanceof Close)
      .map((entry) => entry.account),
  );
  const response: Directives = [];

  for (const entry of entries) {
    if (!(entry instanceof Close)) {
      response.push(entry);
      continue;
    }

    const descendants = [...opens]
      .filter(
        (account) =>
          account.startsWith(`${entry.account}:`) && !closes.has(account),
      )
      .sort();
    for (const account of descendants) {
      response.push(
        new Close(entry.date, account, {
          filename: PLUGIN_FILENAME,
          lineno: 0,
        }),
      );
      closes.add(account);
    }
    if (opens.has(entry.account)) response.push(entry);
  }
  return [response, []];
}
