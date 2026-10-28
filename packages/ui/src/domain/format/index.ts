import type { Interval } from "@beancount-js/filters";
import { format } from "d3-format";
import { DateTime } from "luxon";

export interface FormatterContext {
  /** Render an amount to a string like "2.00 USD". */
  amount: (num: number, currency: string) => string;
  /** Render an number for a currency like "2.00". */
  num: (num: number, currency: string) => string;
  money: (num: unknown, currency?: string) => string;
}

export const replaceNumbers = (num: string) => num.replace(/[0-9]/g, "X");

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

/** Date formatters for human consumption. */
export const dateFormat: Record<Interval, DateFormatter> = {
  year: (dt) => dt.toFormat("yyyy"),
  quarter: (dt) => dt.toFormat("yyyy 'Q'qq"),
  month: (dt) => dt.toFormat("MMM yyyy"),
  week: (dt) => dt.toFormat("yyyy 'W'WW"),
  day: (dt) => dt.toFormat("yyyy-MM-dd"),
  hour: (dt) => dt.toFormat("yyyy-MM-dd HH':00'"),
  minute: (dt) => dt.toFormat("yyyy-MM-dd HH:mm"),
  second: (dt) => dt.toFormat("yyyy-MM-dd HH:mm:ss"),
};

/** Date formatters for the entry filter form. */
export const timeFilterDateFormat: Record<Interval, DateFormatter> = {
  year: (dt) => dt.toFormat("yyyy"),
  quarter: (dt) => dt.toFormat("yyyy-'Q'qq"),
  month: (dt) => dt.toFormat("yyyy-MM"),
  week: (dt) => dt.toFormat("yyyy-'W'WW"),
  day: (dt) => dt.toFormat("yyyy-MM-dd"),
  hour: (dt) => dt.toFormat("yyyy-MM-dd"),
  minute: (dt) => dt.toFormat("yyyy-MM-dd"),
  second: (dt) => dt.toFormat("yyyy-MM-dd"),
};

/** Today as a ISO-8601 date string. */
export function todayAsString(): string {
  return DateTime.now().toFormat("yyyy-MM-dd");
}
