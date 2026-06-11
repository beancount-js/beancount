import { Amount } from "../core/amount";
import { Posting, Transaction } from "../core/data";
import { DateTime } from "luxon";
import { LedgerSource } from "../core/ledger-data";

export type Matchers = Record<string, Array<string>>;

export interface Match {
  key: string;
  value: string;
  score: number;
}

export interface Matcher {
  match: (input: string) => Match[];
}

export class RecordMatcher implements Matcher {
  private matchers: Record<string, Array<RegExp>> = {};
  constructor(
    config: Record<string, Array<string>>,
    readonly options: Partial<{
      flags: string;
      default: Match;
      index: number;
    }> = {},
  ) {
    for (const [key, patterns] of Object.entries(config)) {
      this.matchers[key] = [];
      this.matchers[key].push(
        ...patterns.map((p) => new RegExp(p, options.flags ?? "igm")),
      );
    }
  }

  get index(): number {
    return this.options.index ?? 0;
  }

  match(input: string): Match[] {
    const matches: Array<Match> = [];
    for (const [key, patterns] of Object.entries(this.matchers)) {
      for (const pattern of patterns) {
        var match: RegExpMatchArray | null;
        const found: Array<Match> = [];
        while ((match = pattern.exec(input))) {
          if (match && match[this.index]) {
            found.push({
              key,
              value: match[this.index],
              score: match[this.index].length,
            });
          }
        }
        if (found.length) {
          matches.push(found.sort((a, b) => b.score - a.score)[0]);
        }
      }
    }
    if (matches.length == 0 && this.options.default) {
      matches.push(this.options.default);
    }
    return matches.sort((a, b) => b.score - a.score);
  }
}

export class CompositeMatcher implements Matcher {
  constructor(readonly matchers: Array<Matcher>) {}

  match(input: string): Match[] {
    const matches: Array<Match> = [];
    for (const matcher of this.matchers) {
      matches.push(...matcher.match(input));
    }
    const groups: Record<string, Array<Match>> = {};
    matches.forEach((m) => {
      groups[m.key] ||= [];
      groups[m.key].push(m);
      groups[m.key].sort((a, b) => b.score - a.score);
    });
    return Object.keys(groups)
      .map((key) => groups[key][0])
      .sort((a, b) => b.score - a.score);
  }

  static of(...matchers: Array<Matcher>): CompositeMatcher {
    return new CompositeMatcher(matchers);
  }
}

export function constantMatcher(
  value: string,
  key: string = "",
  score: number = 0,
): Matcher {
  return {
    match(_: string): Match[] {
      return value ? [{ key, value, score }] : [];
    },
  };
}

export interface ImportRecord {
  values: Record<string, any>;
  matches: Array<Match>;
  directive?: Transaction;
  account: string;
}

export interface GroupedRecords {
  categorized: Array<ImportRecord>;
  uncategorized: Array<ImportRecord>;
}

export interface CategorizerProps {
  posting: Matcher;
  accounts: Matcher;
  dateFormat: string;
  account: string;
  currency: string;
  columns: Array<string>;
  defaultAccount: string;
}

export class Categorizer {
  constructor(readonly props: CategorizerProps) {}

  matcherInput(input: string | Record<string, any>): string {
    return typeof input === "string"
      ? input
      : Object.keys(input)
          .map((k) => `${k}:${input[k].toString().replace(/\s+/g, " ").trim()}`)
          .join("\n")
          .trim();
  }

  determineAccount(input: string | Record<string, any>) {
    return this.props.accounts.match(this.matcherInput(input));
  }

  directive(
    input: Record<string, any>,
    account: string,
    meta: Record<string, any> = {},
  ): Transaction | null {
    const source = this.matcherInput(input);
    const matches = this.props.posting.match(source);
    const data: Record<string, any> = { ...input };
    matches.forEach((m) => (data[m.key] = m.value));

    if (data["__source__"]) {
      meta["__import__"] = input;
      const source = new LedgerSource(data["__source__"], {
        transform: false,
        attributes: {
          filename: "import.ledger",
          lineno: "1",
          ...meta,
        },
      });
      if (source.errors.length === 0 && source.directives.length === 1) {
        const directive = source.directives[0];
        if (directive instanceof Transaction) {
          return directive;
        } else {
          console.error(
            "Categorizer:directive invalid directive type: ",
            directive,
          );
        }
      } else {
        console.error(
          "Categorizer:directive unable to process source: ",
          source.errors,
          source.directives,
        );
      }
    }

    try {
      return new Transaction(
        DateTime.fromFormat(data["date"], this.props.dateFormat).toJSDate(),
        "*",
        data["payee"],
        data["narration"],
        data["tags"] ?? [],
        data["links"] ?? [],
        data["amount"]
          ? [
              new Posting(
                this.props.account,
                new Amount(
                  data["amount"],
                  data["currency"] ?? this.props.currency,
                ),
              ),
              new Posting(account),
            ]
          : [],
        {
          __import__: input,
          filename: "import.ledger",
          lineno: "1",
          ...meta,
        },
      );
    } catch (e) {
      return null;
    }
  }
}
