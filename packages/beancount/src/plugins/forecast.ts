import { DateTime } from "luxon";
import { Metadata, sorted, Transaction, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";
import { RRule, type Options as FrequencyOptions } from "rrule";
import { DateFilter, parseQuery } from "@beancount-js/filters";
import { BeancountOptions } from "../core";
import { z } from "zod";

/**
 * An example of adding a forecasting feature to Beancount via a plugin.
 *
 * This entry filter plugin uses existing syntax to define and automatically
 * inserted transactions in the future based on a convention. It serves mostly
 * as an example of how you can experiment by creating and installing a local
 * filter, and not so much as a serious forecasting feature (though the
 * experiment is a good way to get something more general kickstarted
 * eventually, I think the concept would generalize nicely and should eventually
 * be added as a common feature of Beancount).
 *
 * A user can create a transaction like this:
 *
 *     2014-03-08 # "Electricity bill [MONTHLY]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 * And new transactions will be created monthly for the following year. Note the
 * use of the '#' flag and the word 'MONTHLY' which defines the periodicity.
 *
 * The number of recurrences can optionally be specified either by providing an
 * end date or by specifying the number of times that the transaction will be
 * repeated. For example:
 *
 *     2014-03-08 # "Electricity bill [MONTHLY UNTIL 2019-12-31]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 *     2014-03-08 # "Electricity bill [MONTHLY REPEAT 10 TIMES]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 * Transactions can also be repeated at yearly intervals, e.g.:
 *
 *     2014-03-08 # "Electricity bill [YEARLY REPEAT 10 TIMES]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 * Other examples:
 *
 *     2014-03-08 # "Electricity bill [WEEKLY SKIP 1 TIME REPEAT 10 TIMES]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 *     2014-03-08 # "Electricity bill [DAILY SKIP 3 TIMES REPEAT 1 TIME]"
 *       Expenses:Electricity 			50.10 USD
 *       Assets:Checking			       -50.10 USD
 *
 * @param entries
 * @param options
 * @returns
 */

function resolveDate(
  value: string | undefined | null | DateTime,
  fallback: DateTime,
  props: {
    meta: Record<string, unknown>;
    message: string;
    errors: Array<ValidationError>;
    now: DateTime;
  },
): DateTime {
  if (!value) {
    return fallback;
  } else if (value instanceof DateTime) {
    return value.isValid ? value : fallback;
  }
  const [predicate, parseErrors] = parseQuery(value, { now: props.now });
  if (parseErrors.length) {
    props.errors.push(
      new ValidationError(
        `${props.message}: '${value}'\n - ${parseErrors.join("\n - ")}`,
        {
          ...props.meta,
        },
      ),
    );
  } else if (predicate instanceof DateFilter) {
    return predicate.range.endInclusive;
  } else {
    props.errors.push(new ValidationError(`${props.message}: '${value}'`, {}));
  }
  return fallback;
}

export const forecastOptions = z.object({
  now: z.string().optional(),
  end: z.string().optional(),
});

const PERIOD_PATTERN =
  /(^.*)\[(MONTHLY|YEARLY|WEEKLY|DAILY)(\s+SKIP\s+([1-9][0-9]*)\s+TIME.?)?(\s+REPEAT\s+([1-9][0-9]*)\s+TIME.?)?(\s+UNTIL\s+([0-9-]+))?\]/;
export function forecast(
  entries: Directives,
  options: BeancountOptions,
  metadata: Metadata = {},
): [Directives, Array<ValidationError>] {
  let now: DateTime = DateTime.now();
  const errors: Array<ValidationError> = [];
  const props = forecastOptions.safeParse(metadata).data ?? {};

  if (props.now) {
    now = resolveDate(props.now, now, {
      message: "Invalid forcast value for 'now'",
      meta: metadata,
      now,
      errors,
    });
  }

  // Filter out forecast entries from the list of valid entries.
  const forcastEntries: Transaction[] = [];
  const filteredEntries: Directives = [];
  const newEntries: Directives = [];

  entries.forEach((directive) => {
    if (directive instanceof Transaction && directive.flag === "#") {
      forcastEntries.push(directive);
    } else {
      filteredEntries.push(directive);
    }
  });
  forcastEntries.forEach((entry) => {
    try {
      let match = PERIOD_PATTERN.exec(entry.narration);
      let end = now.endOf("year");
      const declaredEnd = entry.meta["end"] || props["end"];
      if (declaredEnd) {
        const [predicate, parseErrors] = parseQuery(declaredEnd.toString(), {
          now,
        });
        if (parseErrors.length) {
          errors.push(
            new ValidationError(
              `Invalid forcast value for 'end': '${declaredEnd}'\n - ${parseErrors.join("\n - ")}`,
              {
                source: entry.meta,
                entry,
              },
            ),
          );
        } else if (predicate instanceof DateFilter) {
          end = predicate.range.endInclusive;
        } else {
          errors.push(
            new ValidationError(
              `Invalid forcast value for 'end': '${declaredEnd}'`,
              {
                source: entry.meta,
                entry,
              },
            ),
          );
        }
      }
      if (!match) {
        match =
          /(^.*)\[(([a-zA-Z]+\s*=\s*[^=;]+;)*\s*[a-zA-Z]+\s*=\s*[^=;]+;?)\]$/.exec(
            entry.narration.trim(),
          );
        if (match) {
          const rule = RRule.fromString(match[2]);
          rule.options.dtstart = entry.date.toUTC().toJSDate();
          rule
            .between(entry.date.toUTC().toJSDate(), end.toUTC().toJSDate())
            .forEach((date) => {
              newEntries.push(
                entry.copy({
                  date: DateTime.fromISO(date.toISOString(), { zone: "utc" }),
                  narration: match![1],
                }),
              );
            });
          return;
        }

        match = /(^.*)\[(Every\s+[^\]]+)\]$/i.exec(entry.narration.trim());
        if (match) {
          const rule = RRule.fromText(match[2]);
          rule.options.dtstart = entry.date.toUTC().toJSDate();
          rule
            .between(entry.date.toUTC().toJSDate(), end.toUTC().toJSDate())
            .forEach((date) => {
              newEntries.push(
                entry.copy({
                  date: DateTime.fromISO(date.toISOString(), { zone: "utc" }),
                  narration: match![1],
                }),
              );
            });
          return;
        }
        newEntries.push(entry);
        return;
      }
      const ruleOpts: Partial<FrequencyOptions> = {
        dtstart: entry.date.toUTC().toJSDate(),
      };

      switch (match[2]?.trim()) {
        case "YEARLY":
          ruleOpts.freq = RRule.YEARLY;
          break;
        case "WEEKLY":
          ruleOpts.freq = RRule.WEEKLY;
          break;
        case "DAILY":
          ruleOpts.freq = RRule.DAILY;
          break;
        default:
          ruleOpts.freq = RRule.MONTHLY;
      }

      if (match[6]) {
        // e.g., [MONTHLY REPEAT 3 TIMES]:
        ruleOpts.count = +match[6];
      } else if (match[8]) {
        //  e.g., [MONTHLY UNTIL 2020-01-01]:
        ruleOpts.until = DateTime.fromFormat(match[8], "yyyy-MM-dd").toJSDate();
      } else {
        //  e.g., [MONTHLY]
        ruleOpts.until = end.toUTC().toJSDate();
      }

      if (match[4]) {
        // SKIP
        ruleOpts.interval = +match[4] + 1;
      }

      const rule = new RRule(ruleOpts);
      rule.all().forEach((date) => {
        newEntries.push(
          entry.copy({
            date: DateTime.fromISO(date.toISOString(), { zone: "utc" }),
            narration: match[1],
          }),
        );
      });
    } catch (e) {
      errors.push(
        new ValidationError(
          `Unable to process forcast for:\n  '${entry.narration}'\n  ${e}`,
          { source: entry.meta, entry },
        ),
      );
    }
  });
  return [sorted([...filteredEntries, ...newEntries]), errors];
}
