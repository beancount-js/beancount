import {
  resolveMissing,
  TxnPosting,
  type Directive,
  type MissingType,
} from "../core/data";
import { Position } from "../core/position";
import { Amount, Decimal, isValidNumber } from "../core/amount";
import { Inventory } from "../core/inventory";
import { CounterInventory, SimpleCounterInventory } from "../core/inventory";
import { Conversion, costOrValue } from "../core/conversion";
import * as _ from "lodash";
import { DateTime } from "luxon";
import { parent } from "../core/utils";
import { RecordContext, RecordInventory, type Row } from "./db";
import { BaseQuote } from "../core/prices";
const accountTypes = ["Assets", "Liabilities", "Equity", "Income", "Expenses"];

const fn: Record<string, (...x: any[]) => any> = {};
const aggr: Record<
  string,
  (value: any, accumulator: any, stage: number) => any
> = {};

export type NumberType =
  | Amount
  | Decimal
  | number
  | string
  | MissingType
  | Position;

export function getNumber(value: NumberType): Decimal | null {
  value = resolveMissing(value);
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Amount) {
    return value.units;
  } else if (value instanceof Position) {
    return new Decimal(value.units.value);
  } else if (value instanceof Amount) {
    return new Decimal(value.value);
  } else if (value instanceof Decimal) {
    return value;
  } else if (typeof value === "number") {
    return new Decimal(value);
  } else if (typeof value === "string" && isValidNumber(value)) {
    return new Decimal(value);
  } else if (Array.isArray(value)) {
    return value.reduce((acc, cur) => {
      return acc.plus(getNumber(cur) ?? Decimal.ZERO);
    }, Decimal.ZERO);
  }
  return Decimal.ZERO;
}

export function accountSortKey(account: string) {
  const accountType = (account || "").toString().split(":")[0];
  return `${accountTypes.indexOf(accountType)}-${account}`;
}

fn.account_sortkey = accountSortKey;

fn.safediv = (a: NumberType, b: NumberType) => {
  const na = getNumber(a);
  const nb = getNumber(b);
  if (!na || !nb) {
    return Decimal.ZERO;
  }

  if (nb.zero) {
    return Decimal.ZERO;
  }
  return na.div(nb);
};

fn._minus = (a: NumberType, b: NumberType) => {
  const na = getNumber(a);
  const nb = getNumber(b);
  if (!na || !nb) {
    return undefined;
  }
  return na.minus(nb);
};

fn._plus = (a: NumberType, b: NumberType) => {
  const na = getNumber(a);
  const nb = getNumber(b);
  if (!na || !nb) {
    return undefined;
  }
  return na.plus(nb);
};

fn._mul = (a: NumberType, b: NumberType) => {
  const na = getNumber(a);
  const nb = getNumber(b);
  if (!na || !nb) {
    return undefined;
  }
  return na.mul(nb);
};

fn.number = (value: NumberType) => {
  return getNumber(value);
};

fn.commodity = (value: Amount | MissingType) => {
  value = resolveMissing(value);
  if (value == null) {
    return "";
  }
  return resolveMissing(value.currency) || "";
};

fn.parent = (value: string) => {
  return parent(value || "");
};

fn.commodity_meta = (row: Row, key: string) => {
  key = key.replace(/\\.meta$/, "");
  return _.get(row?.context?.commodities, key + ".meta");
};

fn.currency_meta = (row: Row, key: string) => {
  return fn.commodity_meta(row, key);
};

fn.has_account = (row: Row, account: string) => {
  if (row) {
    return row.directive.accounts().some((it) => it.includes(account));
  }
  return false;
};

fn._only = (currency: string, inventory: SimpleCounterInventory) => {
  return inventory.get(currency);
};

fn.cost = (value: CounterInventory | Position | Amount) => {
  const context = {};
  const inventory = new CounterInventory();
  const conversion: Conversion = Conversion.AT_COST;
  if (
    value instanceof CounterInventory ||
    value instanceof SimpleCounterInventory
  ) {
    inventory.addInventory(value);
    return costOrValue(inventory, conversion, context);
  }
  if (value instanceof Position) {
    inventory.add(value.units, value.cost);
    return costOrValue(inventory, conversion, context).positions()[0];
  } else if (value instanceof Amount) {
    inventory.add(value);
    return costOrValue(inventory, conversion, context).positions()[0]?.units;
  }
  return value;
};

fn.units = (value: CounterInventory | Position | Amount) => {
  const context = {};
  const inventory = new CounterInventory();
  const conversion: Conversion = Conversion.UNITS;
  if (
    value instanceof CounterInventory ||
    value instanceof SimpleCounterInventory
  ) {
    inventory.addInventory(value);
    return costOrValue(inventory, conversion, context);
  }
  if (value instanceof Position) {
    inventory.add(value.units, value.cost);
    return costOrValue(inventory, conversion, context).positions()[0];
  } else if (value instanceof Amount) {
    inventory.add(value);
    return costOrValue(inventory, conversion, context).positions()[0]?.units;
  }
  return value;
};

fn._value = (
  row: Row,
  value: CounterInventory | Position | Amount | SimpleCounterInventory,
  date?: Date | string,
) => {
  let dt: Date | undefined;
  if (typeof date === "string") {
    dt = DateTime.fromFormat(date, "yyyy-MM-dd").toJSDate();
  }
  const prices =
    row?.context?.data?.prices ?? RecordContext.get()?.data?.prices;
  const context = { prices, date: dt };
  const inventory = new CounterInventory();
  const conversion: Conversion = Conversion.AT_VALUE;
  if (
    value instanceof CounterInventory ||
    value instanceof SimpleCounterInventory
  ) {
    inventory.addInventory(value);
    return costOrValue(inventory, conversion, context);
  }
  if (value instanceof Position) {
    inventory.add(value.units, value.cost);
    return costOrValue(inventory, conversion, context).positions()[0];
  } else if (value instanceof Amount) {
    inventory.add(value);
    return costOrValue(inventory, conversion, context).positions()[0]?.units;
  }
  return value;
};

fn._abs = (value: NumberType | Inventory) => {
  if (value instanceof Inventory) {
    return value.abs();
  }
  return getNumber(value)?.abs();
};

fn._neg = (value: NumberType | Inventory) => {
  if (value instanceof Inventory) {
    return value.neg();
  }
  return getNumber(value)?.neg();
};

fn.getprice = (
  row: Row,
  currency: string,
  costCurrency: string,
  date?: Date | string,
) => {
  let dt: Date | undefined;
  if (typeof date === "string") {
    dt = DateTime.fromFormat(date, "yyyy-MM-dd").toJSDate();
  }
  return row.context.data.prices.getPrice(
    new BaseQuote(currency, costCurrency),
    dt,
  );
};

fn.meta = (row: any, key: string) => {
  const directive = row?.directive;
  if (directive) {
    if (directive instanceof TxnPosting) {
      return _.get(directive.posting.meta, key);
    }
    return _.get(row?.directive?.meta, key);
  }
  return _.get(row, key);
};

fn.entry_meta = (row: Row, key: string) => {
  const directive = row?.directive;
  if (directive) {
    if (directive instanceof TxnPosting) {
      return _.get(directive.txn.meta, key);
    }
    return _.get(row?.directive?.meta, key);
  }
  return _.get(row, key);
};

fn.any_meta = (row: Row, key: string) => {
  const directive = row?.directive;
  if (directive) {
    return _.get(row?.directive?.meta, key);
  }
  return _.get(row, key);
};

fn.close_date = (row: Row, key: string) => {
  return row?.context?.accounts[key]?.close?.date;
};

fn.close_meta = (row: Row, key: string) => {
  return row?.context?.accounts[key]?.close?.meta;
};

fn.open_date = (row: Row, key: string) => {
  return row?.context?.accounts[key]?.open?.date;
};

fn.open_meta = (row: Row, key: string) => {
  return row?.context?.accounts[key]?.open?.meta;
};

aggr._sum = (value: any, accumulator: CounterInventory, stage: number) => {
  if (stage == 1) {
    // first call of aggregator - for first line
    const inventory = new CounterInventory();
    if (value instanceof Position) {
      inventory.add(value.units, value.cost);
    } else if (value instanceof Amount) {
      inventory.add(value);
    } else if (value instanceof CounterInventory) {
      inventory.addInventory(value);
    } else if (value instanceof SimpleCounterInventory) {
      for (const amount of value.values()) {
        inventory.add(amount);
      }
    } else if (value && isValidNumber(value.toString())) {
      inventory.add(new Amount(value.toString(), "$COMMODITY"));
    }
    return inventory;
  } else if (stage == 2) {
    // for every line in the group
    if (value instanceof Position) {
      accumulator.add(value.units, value.cost);
    } else if (value instanceof Amount) {
      accumulator.add(value);
    } else if (value instanceof CounterInventory) {
      accumulator.addInventory(value);
    } else if (value instanceof SimpleCounterInventory) {
      for (const amount of value.values()) {
        accumulator.add(amount);
      }
    } else if (value && isValidNumber(value.toString())) {
      accumulator.add(new Amount(value.toString(), "$COMMODITY"));
    }
    return accumulator;
  } else if (stage == 3) {
    // post production
    const acc = accumulator ?? new CounterInventory();
    const keys = [...acc.keys()];
    if (
      keys.length === 1 &&
      !keys[0].cost &&
      keys[0].currency === "$COMMODITY"
    ) {
      return acc.get(keys[0]);
    }
    return acc;
  }
  return undefined;
};

export function initDbFunctions(alasql: any) {
  for (const [key, value] of Object.entries(fn)) {
    alasql.fn[key] = value;
    alasql.fn[key.toUpperCase()] = value;
  }

  for (const [key, value] of Object.entries(aggr)) {
    alasql.aggr[key] = value;
    alasql.aggr[key.toUpperCase()] = value;
  }
}
