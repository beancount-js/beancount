import { describe, test, expect } from "vitest";
import { pad } from "./pad";
import { type Directives, Transaction } from "../core/data";
import { parseDirectives } from "../parser/parser";
import { defaultBeancountOptions } from "../core";

const OPTIONS = defaultBeancountOptions();
function clearMetadata(directives: Directives) {
  return directives.map((it) => it.toString()).join("\n");
}

describe("Pad", () => {
  test("simple", () => {
    const [directives] = parseDirectives(
      `
        2013-05-01 open Assets:Checking
        2013-05-01 open Equity:Opening-Balances

        ;; Test the simple case that this directive generates a padding entry.
        2013-05-01 pad Assets:Checking Equity:Opening-Balances

        2013-05-03 balance Assets:Checking                                 172.45 USD
    `,
      { transform: false },
    );

    const [expected] = parseDirectives(
      `
        2013-05-01 open Assets:Checking
        2013-05-01 open Equity:Opening-Balances

        2013-05-01 pad Assets:Checking Equity:Opening-Balances

        ;; Check this is inserted.
        2013-05-01 P "(Padding inserted for Balance of 172.45 USD for difference 172.45 USD)"
        Assets:Checking                                                        172.45 USD
        Equity:Opening-Balances                                                -172.45 USD

        2013-05-03 balance Assets:Checking                                 172.45 USD
    `,
      { transform: false },
    );

    const [entries, errors] = pad(directives, OPTIONS);

    expect(errors).toEqual([]);
    expect(clearMetadata(entries)).toMatchDirective(clearMetadata(expected));
  });

  test("pad to zero", () => {
    const [directives, parseErrors] = parseDirectives(
      `
         ;; Test the case that this directive generates a padding entry, padding to zero.
        2013-01-01 open Assets:Checking
        2013-01-01 open Equity:Opening-Balances

        2013-02-01 *
          Assets:Checking           234.56 USD
          Equity:Opening-Balances  -234.56 USD

        2013-05-01 pad Assets:Checking Equity:Opening-Balances

        2013-05-03 balance Assets:Checking                                 0.00 USD
    `,
      { transform: false },
    );

    const [expected] = parseDirectives(
      `
          2013-01-01 open Assets:Checking
          2013-01-01 open Equity:Opening-Balances

          2013-02-01 *
            Assets:Checking           234.56 USD
            Equity:Opening-Balances  -234.56 USD

          2013-05-01 pad Assets:Checking Equity:Opening-Balances

          ;; Check this is inserted.
          2013-05-01 P "(Padding inserted for Balance of 0.00 USD for difference -234.56 USD)"
            Assets:Checking          -234.56 USD
            Equity:Opening-Balances   234.56 USD

          2013-05-03 balance Assets:Checking                                 0.00 USD
    `,
      { transform: false },
    );

    const [entries, errors] = pad(directives, OPTIONS);

    expect(errors).toEqual([]);
    expect(clearMetadata(entries)).toMatchDirective(clearMetadata(expected));
  });

  test("no overflow", () => {
    const [directives] = parseDirectives(
      `
        2013-05-01 open Assets:Checking
        2013-05-01 open Assets:Cash
        2013-05-01 open Equity:Opening-Balances

        ;; Pad before the next check.
        2013-05-01 pad Assets:Checking Equity:Opening-Balances

        ;; The check that is being padded.
        2013-05-03 balance Assets:Checking                                 172.45 USD

        2013-05-15 * "Add 20$"
          Assets:Checking                                                   20.00 USD
          Assets:Cash                                                      -20.00 USD

        ;; This is the next check, should not have been padded.
        2013-06-01 balance Assets:Checking                                 200.00 USD
    `,
      { transform: false },
    );

    const [expected] = parseDirectives(
      `
        2013-05-01 open Assets:Checking
        2013-05-01 open Assets:Cash
        2013-05-01 open Equity:Opening-Balances

        2013-05-01 pad Assets:Checking Equity:Opening-Balances

        2013-05-01 P "(Padding inserted for Balance of 172.45 USD for difference 172.45 USD)"
        Assets:Checking                                                          172.45 USD
        Equity:Opening-Balances                                                 -172.45 USD

        2013-05-03 balance Assets:Checking                                       172.45 USD

        2013-05-15 * "Add 20$"
        Assets:Checking                                                           20.00 USD
        Assets:Cash                                                              -20.00 USD

        2013-06-01 balance Assets:Checking                                 200.00 USD
    `,
      { transform: false },
    );

    const [entries, errors] = pad(directives, OPTIONS);

    expect(errors).toEqual([]);
    expect(clearMetadata(entries)).toMatchDirective(clearMetadata(expected));
  });
});
