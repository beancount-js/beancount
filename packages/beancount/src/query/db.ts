import alasql from "alasql";
import type { LedgerData } from "../core/ledger-data";
import {
  Commodity,
  filterTransactions,
  isDirective,
  isMissing,
  TxnPosting,
  type Directive,
  type Directives,
} from "../core/data";
import {
  CounterInventory,
  SimpleCounterInventory,
} from "../core/inventory";
import { Query } from "./query";
import * as _ from "lodash";
import { accountOpenClose, type AccountOpenCloseResponse } from "../core/utils";
import { commands, defaultCommand, type QueryCommand } from "./commands";
import { PostingRow } from "./models/PostingRow";
import { TransactionRow } from "./models/TransactionRow";
import { DirectiveRow } from "./models/DirectiveRow";
import { initDbFunctions } from "./functions";
import { parser as yamlParser } from "@lezer/yaml";
import { stringify } from "yaml";
import { rawParser as beanCountParser } from "@beancount-js/codemirror-lang-beancount";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { format as sqlFormat } from "sql-formatter";
import type { Parser } from "@lezer/common";
import { Amount, Decimal } from "../core/amount";
import { filterQueryParser as filterParser } from "@beancount-js/filters";

export const sqlParser: Parser = sql({ dialect: PostgreSQL }).language.parser;

export function formatSQL(sql: string): string {
  if (!sql) {
    return "";
  }
  return sqlFormat(sql, { language: "postgresql" }).replaceAll(" (", "(");
}

export class RecordInventory {
  constructor(readonly value: Record<string, number> = {}) {}
}

export class LanguageRecord {
  constructor(
    readonly code: string,
    readonly parser: Parser = yamlParser,
  ) {}

  toString() {
    return this.code;
  }

  static yaml(value: any) {
    return new LanguageRecord(stringify(value));
  }

  static beancount(data: string | Array<string> | Directives | Directive) {
    const input = Array.isArray(data) ? data.join("\n") : data.toString();
    return new LanguageRecord(input, beanCountParser);
  }

  static sql(data: string) {
    return new LanguageRecord(formatSQL(data), sqlParser);
  }

  static filter(data: string) {
    return new LanguageRecord(data, filterParser);
  }
}

function isEmpty(item: any): boolean {
  if (isMissing(item)) {
    return true;
  } else if (
    item instanceof CounterInventory ||
    item instanceof SimpleCounterInventory
  ) {
    return isEmpty(item.positions());
  } else if (item === null || item === undefined) {
    return true;
  } else if (item instanceof Amount) {
    return isEmpty(item.units) && isEmpty(item.currency);
  } else if (item instanceof Decimal) {
    return item.zero;
  } else if (item === 0) {
    return true;
  } else if (item === "") {
    return true;
  } else if (Array.isArray(item)) {
    if (item.length == 0) {
      return true;
    }
    return item.every((it) => isEmpty(it));
  } else if (typeof item === "object") {
    const keys = Object.keys(item);
    if (keys.length == 0) {
      return true;
    }
    return keys.every((it) => isEmpty(item[it]));
  }
  return false;
}

const context: {
  data: Record<string, RecordContext>;
  active: string;
} = {
  data: {},
  active: "",
};

export class RecordContext {
  readonly balance: CounterInventory = new CounterInventory();
  readonly id: string;

  constructor(readonly data: LedgerData) {
    this.id = new Date().getTime().toString();
    context.active = this.id;
    context.data[this.id] = this;
  }

  destroy() {
    delete context.data[this.id];
    if (context.active === this.id) {
      context.active = "";
    }
  }

  clear() {
    this.balance.clear();
  }

  #commodities!: Record<string, Commodity>;
  get commodities() {
    if (!this.#commodities) {
      this.#commodities = {};
      this.data.directives.forEach((it) => {
        if (it instanceof Commodity) {
          this.#commodities[it.currency] = it;
        }
      });
    }
    return this.#commodities;
  }

  #accountOpenClose!: Record<string, AccountOpenCloseResponse>;
  get accounts() {
    if (!this.#accountOpenClose) {
      this.#accountOpenClose = accountOpenClose(this.data.directives);
    }
    return this.#accountOpenClose;
  }

  static get(id?: string) {
    return context.data[id || context.active];
  }
}

export interface Row {
  directive: Directive;
  context: RecordContext;
}

export interface QueryResult {
  data: Array<Record<string, any>>;
  error?: unknown;
}

export class RowValue<T> {
  constructor(
    readonly value: T,
    readonly context: Row,
  ) {}
}

initDbFunctions(alasql);

export class LedgerDatabase {
  readonly db = new alasql.Database();
  public queryParser!: Query;
  private readonly context: RecordContext;
  private dataset!: {
    postings: PostingRow[];
    transactions: TransactionRow[];
    directives: DirectiveRow[];
  };

  constructor(readonly data: LedgerData) {
    this.db.exec(`
            CREATE TABLE directives(
                id TEXT PRIMARY KEY,
                date DATE,
                year NUMBER,
                month NUMBER,
                lineno NUMBER,
                day NUMBER,
                payee TEXT,
                narration TEXT,
                directive OBJECT,
                type TEXT,
                tags TEXT[],
                links TEXT[],
                accounts TEXT[],
                postings OBJECT[]
            );

            CREATE TABLE transactions(
                id TEXT PRIMARY KEY,
                date DATE,
                year NUMBER,
                month NUMBER,
                lineno NUMBER,
                day NUMBER,
                payee TEXT,
                narration TEXT,
                type TEXT,
                directive OBJECT,
                tags TEXT[],
                links TEXT[],
                accounts TEXT[]
            );

            CREATE TABLE postings (
                id TEXT PRIMARY KEY,
                transaction_id TEXT,
                date DATE,
                year NUMBER,
                month NUMBER,
                lineno NUMBER,
                day NUMBER,
                position JSON,
                flag TEXT,
                type TEXT,
                posting_flag TEXT,
                directive OBJECT,
                tx OBJECT,
                payee TEXT,
                narration TEXT,
                account TEXT,
                account_sortkey TEXT,
                number MONEY,
                currency TEXT,
                balance OBJECT,
                change OBJECT,
                cost OBJECT,
                cost_currency TEXT,
                cost_number NUMBER,
                cost_date DATE,
                cost_label TEXT,
                tags TEXT[],
                links TEXT[],
                other_accounts TEXT[]
            );
        `);
    this.context = new RecordContext(data);
    const transactionDirectives = filterTransactions(data.directives);
    this.db.tables["postings"].data = transactionDirectives
      .map((directive) => {
        return directive.postings.map(
          (it) => new PostingRow(new TxnPosting(directive, it), this.context),
        );
      })
      .flat();
    this.db.tables["transactions"].data = transactionDirectives.map(
      (directive) => {
        return new TransactionRow(directive, this.context);
      },
    );
    this.db.tables["directives"].data = data.directives.map(
      (it) => new DirectiveRow(it, this.context),
    );

    this.initParser();
  }

  get directives() {
    return [...this.data.directives];
  }

  initParser() {
    const rowdata = (entity: any, state: { column: string }) => {
      entity.args ||= [];
      if (entity.args[0]?.columnid !== "_") {
        entity.args = [new alasql.yy.Column({ columnid: "_" }), ...entity.args];
      }
    };

    this.queryParser = new Query(
      "postings",
      {
        "fn.sum": "_sum",
        "fn._value": rowdata,
        "fn.abs": "_abs",
        "fn.neg": "_neg",
        "agg.sum": "_sum",
        "fn.getprice": rowdata,
        "fn.meta": rowdata,
        "fn.any_meta": rowdata,
        "fn.entry_meta": rowdata,
        "fn.has_account": rowdata,
        "fn.commodity_meta": rowdata,
        "fn.currency_meta": rowdata,
        "fn.close_date": rowdata,
        "fn.close_meta": rowdata,
        "fn.open_date": rowdata,
        "fn.open_meta": rowdata,
      },
      {
        "postings.*": ["date", "flag", "payee", "narration", "position"],
      },
    );
  }

  key(value: string) {
    return value
      .replace(/_([a-zA-Z]+)\(/gi, "$1(")
      .replace(/(postings|transactions|directives)\.(_,)?/g, "")
      .replace(/\((directives|transactions|postings)\._,?/gi, "(");
  }

  query(qs: string): QueryResult {
    try {
      this.context.clear();
      const response = this.command(qs).action(this, qs);
      return response;
    } catch (e) {
      console.error("db:error:: ", e);
      return { data: [], error: e };
    }
  }

  command(qs: string): QueryCommand {
    return commands.find((cmd) => cmd.pattern.test(qs)) ?? defaultCommand;
  }

  render(records: Array<Record<string, any>> | string): QueryResult {
    if (typeof records === "string") {
      return this.render(this.db.exec(records));
    }
    const response = records
      .filter((row: Record<string, any>) => !isEmpty(row))
      .map((row: Record<string, any>) => {
        for (const [key, value] of Object.entries(row)) {
          if (
            value instanceof CounterInventory ||
            value instanceof SimpleCounterInventory
          ) {
            const positions = value.positions();
            if (
              positions.length === 1 &&
              positions[0].units.currency === "$COMMODITY"
            ) {
              row[key] = positions[0].units;
            } else {
              row[key] = positions;
            }
          } else if (isDirective(value)) {
            row[key] = LanguageRecord.beancount(value);
          }
          const updatedKey = this.key(key);
          if (updatedKey !== key) {
            row[updatedKey] = row[key];
            delete row[key];
          }
        }
        return row;
      });
    return { data: response };
  }
}
