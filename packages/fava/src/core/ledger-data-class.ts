import {
  accountOpenClose,
  CounterInventory,
  filterLedger,
  filterTransactions,
  FLAG_UNREALIZED,
  isDescendantOf,
  LoadError,
  Price,
  Transaction,
  type Conversion,
  type Directives,
  type LedgerError,
  type PriceMap,
} from "@beancount-js/beancount";
import { DateRange, type Filter } from "@beancount-js/filters";
import { formatDate } from "@beancount-js/parser";
import { DateTime } from "luxon";
import * as _ from "lodash";

import type { ParsedBarChartData } from "../charts/bar";
import { DEFAULT_INTERVAL, getDuration, type Interval } from "../lib/interval";
import type { AccountBudget, AccountDetails } from "./account";
import type { Options } from "../context";
import type { LedgerTaxonomy } from "./ledger";
import { Tree } from "./tree";

export interface IntervalTree {
  range: DateRange;
  tree: Tree;
}

type LuxonUnit = "year" | "quarter" | "month" | "week" | "day";

function luxonUnit(interval: Interval): LuxonUnit {
  return interval;
}

export class LedgerData {
  readonly accountDetails: Record<string, AccountDetails> = {};
  readonly currencyNames: Record<string, string> = {};
  readonly precisions: Record<string, number> = {};

  readonly transactions: ReadonlyArray<Transaction>;
  readonly tree: Tree;
  readonly dateFirst: DateTime | null = null;
  readonly dateLast: DateTime | null = null;

  #directives: Directives;

  #dateRanges: Record<string, Array<DateRange>> = {};
  #balanceTree: Record<string, Array<IntervalTree>> = {};
  #changeTrees: Record<string, Array<IntervalTree>> = {};
  #intervalTotals: Record<string, ParsedBarChartData> = {};
  #intervalBudgets: Record<string, Record<string, Array<AccountBudget>>> = {};
  #accountBalanceByDate: Record<
    string,
    Record<string, Record<string, number>>
  > = {};
  #accountChangesByDate: Record<
    string,
    Record<string, Record<string, number>>
  > = {};
  #accountBalance: Record<
    string,
    Array<{
      date: Date;
      balance: Record<string, number>;
    }>
  > = {};
  #networth: Record<
    string,
    Array<{
      date: Date;
      balance: Record<string, number>;
    }>
  > = {};

  constructor(
    directives: Directives,
    readonly taxonomy: LedgerTaxonomy,
    readonly prices: PriceMap,
    readonly options: Options,
    readonly errors: Array<LedgerError> = [],
  ) {
    this.#directives = directives;
    this.transactions = filterTransactions(this.directives);
    this.tree = new Tree({ entries: this.directives });

    for (const [name, account] of Object.entries(
      accountOpenClose(this.directives),
    )) {
      this.accountDetails[name] = {
        account: name,
        openDate: account.open?.date || account.close?.date || DateTime.utc(),
        closeDate: account.close?.date,
        currencies: [...(account.open?.currencies || [])],
        lastEntry: { date: account.updatedAt, hash: "" },
      };
    }

    for (const directive of this.directives) {
      if (directive instanceof Transaction) {
        this.dateFirst = directive.date;
        break;
      }
    }

    for (const directive of [...this.directives].reverse()) {
      if (directive instanceof Transaction || directive instanceof Price) {
        this.dateLast = directive.date.plus({ days: 1 });
        break;
      }
    }
  }

  copy(
    data: Partial<{
      readonly taxonomy: LedgerTaxonomy;
      directives: Directives;
      prices: PriceMap;
      readonly options: Options;
      readonly errors: Array<LedgerError>;
    }>,
  ) {
    return new LedgerData(
      data.directives ?? [...this.directives],
      data.taxonomy ?? { ...this.taxonomy },
      data.prices ?? this.prices,
      data.options ?? { ...this.options },
      data.errors ?? [...this.errors],
    );
  }

  get directives(): Directives {
    return [...this.#directives];
  }

  get filename() {
    return this.options.beancount.filename ?? "ledger.default";
  }

  get tags(): Array<string> {
    return this.taxonomy.tags;
  }

  get links(): Array<string> {
    return this.taxonomy.links;
  }

  get currencies(): Array<string> {
    return this.taxonomy.currencies;
  }

  get payees(): Array<string> {
    return this.taxonomy.payees;
  }

  get accounts(): Array<string> {
    return [...new Set([...this.taxonomy.accounts, ...this.tree.accounts])];
  }

  get years(): Array<string> {
    return this.taxonomy.years;
  }

  filter(filter?: Filter | string) {
    if (!filter) {
      return this;
    }
    const errors = [...this.errors];
    const [[filtered], filterErrors] = filterLedger(this.directives, filter);
    if (filterErrors.length) {
      errors.push(...filterErrors.map((it) => new LoadError(it)));
    }
    return this.copy({
      directives: filtered,
      errors,
    });
  }

  *intervalEnds(
    first: DateTime,
    last: DateTime,
    interval: Interval,
  ): Generator<DateRange> {
    const unit = luxonUnit(interval);
    let current = first.toUTC().startOf("day").startOf(unit);
    const end = last.toUTC().endOf("day").endOf(unit);
    while (current < end) {
      yield new DateRange(current.startOf(unit), current.endOf(unit), "[]");
      current = current.plus(getDuration(interval, 1));
    }
    yield new DateRange(current.startOf(unit), current.endOf(unit), "[]");
  }

  dateRanges(interval: Interval, limit: number = -100): Array<DateRange> {
    if (!this.dateFirst || !this.dateLast) {
      return [];
    }
    const key = `${interval}:${limit}`;
    if (this.#dateRanges[key]) {
      return _.cloneDeep(this.#dateRanges[key]);
    }

    let intervals = Array.from(
      this.intervalEnds(this.dateFirst, this.dateLast, interval),
    );

    if (limit < 0) {
      intervals = intervals.slice(-100);
    }
    this.#dateRanges[key] = _.cloneDeep(intervals);
    return intervals;
  }

  balanceTrees(interval: Interval = DEFAULT_INTERVAL): Array<IntervalTree> {
    const key = `${interval}`;
    if (this.#balanceTree[key]) {
      return _.cloneDeep(this.#balanceTree[key]);
    }
    const intervals = this.dateRanges(interval);
    const accounts = this.accounts;
    const value = intervals.map((range) => {
      const entries = this.directives.filter(
        (it) => it.date && it.date <= range.to,
      );
      return {
        range,
        tree: new Tree({ entries, accounts }),
      };
    });
    this.#balanceTree[key] = _.cloneDeep(value);
    return value;
  }

  changeTrees(interval: Interval = DEFAULT_INTERVAL): Array<IntervalTree> {
    const key = `${interval}`;
    if (this.#changeTrees[key]) {
      return _.cloneDeep(this.#changeTrees[key]);
    }
    const intervals = this.dateRanges(interval);
    const accounts = this.accounts;
    const value = intervals.map((range) => {
      const entries = this.directives.filter(
        (it) => it.date && range.contains(it.date),
      );
      return {
        range,
        tree: new Tree({ entries, accounts }),
      };
    });
    this.#changeTrees[key] = _.cloneDeep(value);
    return value;
  }

  intervalBudgets(
    _account: string,
    _interval: Interval = DEFAULT_INTERVAL,
  ): Record<string, Array<AccountBudget>> {
    return {};
  }

  intervalTotals(
    accounts: Array<string>,
    conversion: Conversion,
    interval: Interval = DEFAULT_INTERVAL,
    invert: boolean = false,
  ): ParsedBarChartData {
    const key = `${accounts.sort()}:${conversion}:${interval}:${invert}`;
    if (this.#intervalTotals[key]) {
      return _.cloneDeep(this.#intervalTotals[key]);
    }
    const intervals = this.dateRanges(interval);
    const value = intervals
      .map((range) => {
        const inventory = new CounterInventory();
        const entries = this.entriesBetween(range);
        const accountInventories = CounterInventory.defaultMap();
        filterTransactions(entries)
          .flatMap((it) => it.postings)
          .forEach((posting) => {
            if (
              accounts.some(
                (it) =>
                  posting.account.startsWith(`${it}:`) ||
                  posting.account === it,
              )
            ) {
              accountInventories
                .get(posting.account)
                .add(posting.units, posting.cost);
              inventory.add(posting.units, posting.cost);
            }
          });
        if (invert) {
          return {
            dateRange: range,
            date: range.endInclusive.toJSDate(),
            balance: inventory.neg().toRecord(conversion),
            budgets: {},
            accountBalances: accountInventories.map(([k, v]) => [
              k,
              v.neg().toRecord(conversion),
            ]),
          };
        }
        return {
          date: range.endInclusive.toJSDate(),
          dateRange: range,
          balance: inventory.toRecord(conversion),
          budgets: {},
          accountBalances: accountInventories.map(([k, v]) => [
            k,
            v.toRecord(conversion),
          ]),
        };
      })
      .filter((item) => {
        const keys = [
          ...Object.keys(item.accountBalances),
          ...Object.keys(item.budgets),
          ...Object.keys(item.balance),
        ];
        return keys.length > 0;
      });
    this.#intervalTotals[key] = _.cloneDeep(value);
    return value;
  }

  dates() {
    const dates: Record<string, DateTime> = {};
    this.directives.forEach((it) => {
      if (it.date) {
        dates[it.date.toISO()!] = it.date;
      }
    });
    return Object.keys(dates)
      .map((k) => dates[k]!)
      .sort((a, b) => a.toMillis() - b.toMillis());
  }

  accountBalanceByDate(
    conversion: Conversion,
    ...accounts: string[]
  ): Record<string, Record<string, number>> {
    const key = `${conversion}:${accounts.sort()}`;
    if (this.#accountBalanceByDate[key]) {
      return _.cloneDeep(this.#accountBalanceByDate[key]);
    }
    const balances: Record<string, Record<string, number>> = {};
    const dates = this.dates();
    const inventory = new CounterInventory();
    const transactions = filterTransactions(this.directives);
    let index = 0;
    let txn = transactions[index];
    dates.forEach((date) => {
      while (txn && txn.date <= date) {
        txn.postings
          .filter(
            (p) =>
              accounts.length == 0 ||
              accounts.some((it) => isDescendantOf(it, p.account)),
          )
          .forEach((posting) => inventory.add(posting.units, posting.cost));
        index++;
        txn = transactions[index];
      }
      balances[formatDate(date)] = inventory.toRecord(conversion);
    });

    this.#accountBalanceByDate[key] = _.cloneDeep(balances);
    return balances;
  }

  accountChangesByDate(
    conversion: Conversion,
    ...accounts: string[]
  ): Record<string, Record<string, number>> {
    const key = `${conversion}:${accounts.sort()}`;
    if (this.#accountChangesByDate[key]) {
      return _.cloneDeep(this.#accountChangesByDate[key]);
    }
    const balances: Record<string, Record<string, number>> = {};
    const inventory = new CounterInventory();
    const balanceByDate = this.accountBalanceByDate(conversion, ...accounts);
    const transactions = filterTransactions(this.directives);
    const dates = this.dates();
    let index = 0;
    let txn = transactions[index];
    this.dateRanges("day", 0).forEach((range) => {
      while (txn && range.contains(txn.date)) {
        txn.postings
          .filter(
            (p) =>
              accounts.length == 0 ||
              accounts.some((it) => isDescendantOf(it, p.account)),
          )
          .forEach((posting) => inventory.add(posting.units, posting.cost));
        index++;
        txn = transactions[index];
      }

      const matches = dates.filter((it) => it <= range.to);
      const balance =
        dates.length > 1
          ? balanceByDate[formatDate(matches[matches.length - 1]!)]
          : {};

      const dayKey = formatDate(range.to);
      const changes = inventory.toRecord(conversion);
      const delta: Record<string, number> = {};

      Object.keys(changes).forEach((k) => {
        if (changes[k] !== balance[k]) {
          delta[k] = changes[k]!;
        }
      });
      balances[dayKey] = delta;
    });

    this.#accountChangesByDate[key] = _.cloneDeep(balances);
    return balances;
  }

  accountBalance(
    account: string,
    conversion: Conversion,
  ): Array<{
    date: Date;
    balance: Record<string, number>;
  }> {
    const key = `${account}:${conversion}`;
    if (this.#accountBalance[key]) {
      return _.cloneDeep(this.#accountBalance[key]);
    }
    const data: Array<{
      date: Date;
      balance: Record<string, number>;
    }> = [];
    for (const [day, value] of Object.entries(
      this.accountBalanceByDate(conversion, account),
    )) {
      data.push({
        date: new Date(day),
        balance: value,
      });
    }
    this.#accountBalance[key] = _.cloneDeep(data);
    return data;
  }

  netWorth(
    accounts: Array<string>,
    conversion: Conversion,
    interval: Interval = DEFAULT_INTERVAL,
  ): Array<{
    date: Date;
    balance: Record<string, number>;
  }> {
    const key = `${accounts.sort()}:${conversion}:${interval}`;
    if (this.#networth[key]) {
      return _.cloneDeep(this.#networth[key]);
    }

    const intervals = this.dateRanges(interval);
    const transactions = filterTransactions(this.directives).filter(
      (it) => it.flag !== FLAG_UNREALIZED,
    );
    const inventory = new CounterInventory();
    const balances: Array<{
      date: Date;
      balance: Record<string, number>;
    }> = [];
    let index = 0;
    let txn = transactions[index];

    intervals.forEach((range) => {
      while (txn && txn.date < range.to) {
        txn.postings
          .filter((p) => accounts.some((it) => isDescendantOf(it, p.account)))
          .forEach((posting) => inventory.add(posting.units, posting.cost));
        index++;
        txn = transactions[index];
      }
      balances.push({
        date: range.endInclusive.toJSDate(),
        balance: inventory.toRecord(conversion),
      });
    });

    this.#networth[key] = _.cloneDeep(balances);
    return balances;
  }

  entriesBetween(range: DateRange) {
    return this.directives.filter((it) => {
      return it.date && range.contains(it.date);
    });
  }
}
