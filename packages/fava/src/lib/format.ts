import { Amount, Cost } from "@beancount-js/beancount";
import { Decimal, formatDate } from "@beancount-js/parser";
import { format } from "d3-format";
import { utcFormat } from "d3-time-format";
import { DateTime } from "luxon";

export interface FormatterContext {
  /** Render an amount to a string like "2.00 USD". */
  amount: (num: number, currency: string) => string;
  /** Render an number for a currency like "2.00". */
  num: (num: number, currency: string) => string;
  money: (num: Amount | Decimal | number | Cost, currency?: string) => string;
}

export const replaceNumbers = (num: string) => num.replace(/[0-9]/g, "X");

export function useFormatter(
  incognito: boolean,
  locale: string,
  precisions: Record<string, number> = {},
): FormatterContext {
  const formatter = localeFormatter(locale);
  const currencyFormatters = Object.fromEntries(
    Object.entries(precisions).map(([currency, prec]) => [
      currency,
      localeFormatter(locale, prec),
    ]),
  );
  const num_raw = (n: number, c: string) =>
    (currencyFormatters[c] ?? formatter)(n);

  const num = incognito
    ? (n: number, c: string) => {
        return replaceNumbers(num_raw(n, c));
      }
    : num_raw;

  const money = (
    number: Amount | Decimal | number | null | undefined | Cost,
    currency?: string,
  ): string => {
    currency = currency || "";
    if (number === null || number === undefined) {
      return "";
    }

    if (typeof number === "number") {
      return (num(number, currency || "") + " " + currency).trim();
    }

    if (number instanceof Decimal) {
      return (num(number.number, currency) + " " + currency).trim();
    } else if (number instanceof Amount) {
      currency = number?.currency || currency;
      return (num(number.number, currency) + " " + currency).trim();
    } else if (number instanceof Cost) {
      return money(number.amount);
    }
    return "";
  };

  return {
    amount: (n, c) => `${num(n, c)} ${c}`,
    money,
    num,
  };
}

/**
 * A number formatting function for a locale.
 *
 * @param locale - The locale to use.
 * @param precision - The number of decimal digits to show.
 */
export function localeFormatter(
  locale: string | null,
  precision = 2,
): (num: number) => string {
  if (locale == null) {
    return format(`.${precision.toString()}f`);
  }
  // this needs to be between 0 and 20
  const digits = Math.max(0, Math.min(precision, 20));
  const fmt = new Intl.NumberFormat(locale.replace("_", "-"), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return fmt.format.bind(fmt);
}

const formatterPer = format(".2f");
export function formatPercentage(number: number): string {
  return `${formatterPer(Math.abs(number) * 100)}%`;
}

type DateFormatter = (date: DateTime) => string;

/** Format the date as a ISO-8601 date string. */
export const day = utcFormat("%Y-%m-%d");

/** Date formatters for human consumption. */
export const dateFormat: Record<
  "year" | "quarter" | "month" | "day" | "week",
  DateFormatter
> = {
  year: (dt: DateTime) => dt.toFormat("yyyy"),
  quarter: (dt: DateTime) => dt.toFormat("yyyy-'Q'Q"),
  month: (dt: DateTime) => dt.toFormat("MMM yy"),
  week: (dt: DateTime) => dt.toFormat("yyyy'W'w"),
  day: (dt: DateTime) => dt.toFormat("yyyy'W'w"),
};

/** Today as a ISO-8601 date string. */
export function todayAsString(): string {
  return formatDate(DateTime.now());
}
