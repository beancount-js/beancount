import { derived } from "svelte/store";
import {
  type FormatterContext,
  localeFormatter,
  replaceNumbers,
  timeFilterDateFormat,
  dateFormat,
} from "../format";
import { format } from "d3-format";
import { useContext } from "../context";
import { Decimal, isValidNumber } from "@beancount-js/parser";
import { Amount, Cost } from "@beancount-js/beancount";

const short_format = format(".3s");

/**
 * Render a number to a short string, for example for the y-axis of a line
 * chart.
 */
export function useShort() {
  const { ledgerOptions } = useContext();
  const incognito = derived(
    ledgerOptions,
    ($ledgerOptions) => $ledgerOptions.ledger.incognito,
  );
  return derived(
    incognito,
    ($incognito): ((number: number | { valueOf(): number }) => string) =>
      $incognito ? (n) => replaceNumbers(short_format(n)) : short_format,
  );
}

export function useCtx() {
  const { precisions, ledgerOptions } = useContext();
  const locale = derived(
    ledgerOptions,
    ($ledgerOptions) => $ledgerOptions.locale,
  );
  const incognito = derived(
    ledgerOptions,
    ($ledgerOptions) => $ledgerOptions.ledger.incognito,
  );

  return derived(
    [incognito, locale, precisions],
    ([$incognito, $locale, $precisions]): FormatterContext => {
      const formatter = localeFormatter($locale);
      const currencyFormatters = Object.fromEntries(
        Object.entries($precisions).map(([currency, prec]) => [
          currency,
          localeFormatter($locale, prec),
        ]),
      );
      const num_raw = (n: number, c: string) =>
        (currencyFormatters[c] ?? formatter)(n);

      const num = $incognito
        ? (n: number, c: string) => {
            return replaceNumbers(num_raw(n, c));
          }
        : num_raw;

      const money = (number: unknown, currency?: string): string => {
        currency = currency || "";
        if (number === null || number === undefined) {
          return "";
        }

        if (typeof number === "number") {
          return (num(number, currency || "") + " " + currency).trim();
        } else if (number instanceof Decimal) {
          return (num(number.number, currency) + " " + currency).trim();
        } else if (number instanceof Amount) {
          return (num(number.number, currency) + " " + currency).trim();
        } else if (number instanceof Cost) {
          return money(number.amount);
        } else if (typeof number === "string" && isValidNumber(number)) {
          return (
            num(new Decimal(number).number, currency) +
            " " +
            currency
          ).trim();
        }
        return "";
      };

      return {
        amount: (n, c) => `${num(n, c)} ${c}`,
        money,
        num,
      };
    },
  );
}

export function useCurrentDateFormat() {
  const { interval } = useContext();
  return derived(interval, (val) => dateFormat[val]);
}

export function useCurrentTimeFilterDateFormat() {
  const { interval } = useContext();
  return derived(interval, (val) => timeFilterDateFormat[val]);
}
