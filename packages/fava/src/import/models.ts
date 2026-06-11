import { Amount } from "@beancount-js/beancount";
import { Posting, Transaction } from "@beancount-js/beancount";
import { LedgerSource } from "../core/ledger";
import { md5 } from "@beancount-js/parser";
import type {
  ImporterAccount,
  ImporterPatternDefinition,
  ImporterType,
  ImportRow,
} from "./schema";
import { DateTime } from "luxon";
import * as _ from "lodash";

export type ColumnType =
  | "text"
  | "amount"
  | "account"
  | "date"
  | "payee"
  | "narration"
  | "tags"
  | "links"
  | "currency";

export interface ImportColumn {
  id: string;
  required: boolean;
  name: string;
  type: ColumnType;
}

function flattenObject(
  o: any,
  prefix: string = "",
  result: Record<string, any> = {},
  keepNull: boolean = false,
) {
  if (
    _.isString(o) ||
    _.isNumber(o) ||
    _.isBoolean(o) ||
    (keepNull && _.isNull(o))
  ) {
    result[prefix] = o;
    return result;
  }

  if (_.isArray(o) || _.isPlainObject(o)) {
    for (let i in o) {
      let pref = prefix;
      if (_.isArray(o)) {
        pref = pref + `[${i}]`;
      } else {
        if (_.isEmpty(prefix)) {
          pref = i;
        } else {
          pref = prefix + "." + i;
        }
      }
      flattenObject(o[i], pref, result, keepNull);
    }
    return result;
  }
  return result;
}

function matcherInput(input: any): string {
  if (typeof input === "string") {
    return input;
  }
  const data = flattenObject(input);
  return Object.keys(data)
    .map(
      (k) => `${k}:${(data[k]?.toString() ?? "").replace(/\s+/g, " ").trim()}`,
    )
    .join("\n")
    .trim();
}

function match(input: string, patterns: Array<ImportPattern>): Array<Match> {
  const matches: Array<Match> = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.regexp.source, pattern.regexp.flags);
    var match: RegExpMatchArray | null;
    do {
      match = regex.exec(input);
      if (match) {
        if (typeof pattern.value === "number") {
          matches.push({
            value: match[pattern.value],
            score: pattern.score,
          });
        } else {
          matches.push({
            value: pattern.value,
            score: pattern.score,
          });
        }
      }
    } while (match && match[0]);
  }
  return matches.sort((a, b) => b.score - a.score);
}

export class ImportPattern {
  constructor(
    readonly regexp: RegExp,
    readonly score: number,
    readonly value: number | string,
  ) {}

  copy(
    data: Partial<{
      regexp: RegExp;
      score: number;
      value: number | string;
    }>,
  ) {
    return new ImportPattern(
      data.regexp ?? this.regexp,
      data.score ?? this.score,
      data.value ?? this.value,
    );
  }

  static from(config: ImporterPatternDefinition) {
    const patterns: Array<ImportPattern> = [];
    if (typeof config === "string") {
      patterns.push(new ImportPattern(new RegExp(config, "img"), 1, 1));
    } else if (Array.isArray(config)) {
      patterns.push(...config.map((it) => ImportPattern.from(it)).flat());
    } else {
      patterns.push(
        new ImportPattern(
          new RegExp(config.pattern, config.flags ?? "img"),
          config.score,
          config.value ?? 1,
        ),
      );
    }
    return patterns;
  }
}

export class ImportAccount {
  constructor(
    readonly name: string,
    readonly pattern: Array<ImportPattern>,
    readonly currency: string,
    readonly matchers: Record<string, Array<ImportPattern>>,
    readonly defaultAccount: string = "Expenses:Uncategorized",
  ) {}

  static from(config: ImporterAccount) {
    const matchers: Record<string, Array<ImportPattern>> = {};
    for (const [key, value] of Object.entries(config.matchers)) {
      matchers[key] = ImportPattern.from(value).map((it) =>
        it.copy({ value: key }),
      );
    }
    return new ImportAccount(
      config.name,
      ImportPattern.from(config.pattern),
      config.currency,
      matchers,
    );
  }

  determineAccount(record: Record<string, any> | string) {
    const input = matcherInput(record);
    const matches = match(input, Object.values(this.matchers).flat());
    if (!matches.length) {
      matches.push({ value: this.defaultAccount, score: -1 });
    }
    return matches;
  }
}

export interface Match {
  value: string;
  score: number;
}

export class ImportConfig {
  constructor(
    readonly name: string,
    readonly version: string,
    readonly dateFormat: string,
    readonly columns: Array<ImportColumn>,
    readonly posting: Record<string, Array<ImportPattern>>,
    readonly accounts: Array<ImportAccount>,
  ) {}

  static from(config: ImporterType) {
    const columns: Array<ImportColumn> = [];
    config.columns.forEach((column) => {
      if (typeof column === "string") {
        columns.push({
          id: column,
          name: column,
          required: true,
          type: "text",
        });
      } else {
        for (const [id, value] of Object.entries(column)) {
          columns.push({
            id,
            name: value.name,
            required: value.required !== false,
            type: value.type ?? "text",
          });
        }
      }
    });

    const posting: Record<string, Array<ImportPattern>> = {};
    for (const [key, value] of Object.entries(config.posting)) {
      posting[key] = ImportPattern.from(value);
    }

    return new ImportConfig(
      config.name,
      config.version,
      config.dateFormat,
      columns,
      posting,
      config.accounts.map(ImportAccount.from),
    );
  }

  identity(record: Record<string, any>) {
    return this.columns
      .map((it) => (record[it.id]?.toString() ?? "").trim())
      .join(",")
      .replaceAll(/\s+/g, " ")
      .trim();
  }

  id(record: Record<string, any>) {
    return md5(this.identity(record));
  }

  accountFor(record: Record<string, any> | string) {
    const input = matcherInput(record);
    return this.accounts
      .map((acc) => ({ account: acc, matches: match(input, acc.pattern) }))
      .filter((m) => m.matches.length)
      .sort((a, b) => b.matches[0].score - a.matches[0].score)
      .map((it) => it.account)[0];
  }

  private parseTransaction(
    data: string | undefined | null,
  ): Transaction | null {
    if (!data) {
      return null;
    }
    const source = new LedgerSource(data, { transform: false });
    if (
      !source.errors.length &&
      source.directives.length == 1 &&
      source.directives[0] instanceof Transaction
    ) {
      return source.directives[0];
    }
    return null;
  }

  directive(source: ImportRow, meta: Record<string, any> = {}) {
    if (source.source) {
      const tx = this.parseTransaction(source.source);
      if (tx) {
        return tx;
      }
    }
    const input = matcherInput(source.data);
    const account = this.accounts
      .map((acc) => ({ account: acc, matches: match(input, acc.pattern) }))
      .filter((m) => m.matches.length)
      .sort((a, b) => b.matches[0].score - a.matches[0].score)
      .map((it) => it.account)[0];

    if (!account) {
      return null;
    }

    const fields: Record<string, Array<string>> = {};
    for (const [key, matchers] of Object.entries(this.posting)) {
      const matches = match(input, matchers);
      if (matches.length) {
        fields[key] = [...new Set(matches.map((it) => it.value))];
      }
    }

    const date = fields["date"]
      ? DateTime.fromFormat(fields["date"][0] ?? "", this.dateFormat).toJSDate()
      : new Date(0);
    const multiplier = fields["multiplier"] ? fields["multiplier"][0] : "1";
    const amount = fields["amount"]
      ? new Amount(fields["amount"][0], account.currency)
      : new Amount("0", account.currency);
    const payee = fields["payee"] ? fields["payee"][0] : "";
    const narration = fields["narration"] ? fields["narration"][0] : "";
    const tags = fields["tags"] ? fields["tags"] : [];
    const links = fields["links"] ? fields["links"] : [];
    const flag = fields["flag"] ? fields["flag"][0] : "*";
    const accountName =
      source.account ||
      account.determineAccount(input)[0]?.value ||
      account.defaultAccount;

    return new Transaction(
      date,
      flag,
      payee,
      narration,
      tags,
      links,
      [
        new Posting(account.name, amount.mul(multiplier)),
        new Posting(accountName),
      ],
      meta,
    );
  }
}
