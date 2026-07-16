import { DateTime } from "luxon";
import { Price, Transaction, type Directives } from "../core/data";
import { balanceByAccount } from "./summarize";

export type CurrencyPair = readonly [string, string];

function addPair(
  pairs: Map<string, CurrencyPair>,
  base: string,
  quote: string,
) {
  pairs.set(`${base}\u0000${quote}`, [base, quote]);
}

function pairsBefore(
  entries: Directives,
  date: DateTime | null,
  collect: (
    entry: Transaction | Price,
    pairs: Map<string, CurrencyPair>,
  ) => void,
): Set<CurrencyPair> {
  const pairs = new Map<string, CurrencyPair>();
  for (const entry of entries) {
    if (date && entry.date && entry.date >= date) break;
    if (entry instanceof Transaction || entry instanceof Price)
      collect(entry, pairs);
  }
  return new Set(pairs.values());
}

export function findCurrenciesAtCost(
  entries: Directives,
  date: DateTime | null = null,
): Set<CurrencyPair> {
  return pairsBefore(entries, date, (entry, pairs) => {
    if (!(entry instanceof Transaction)) return;
    for (const posting of entry.postings) {
      const cost = posting.resolvedCost;
      if (posting.units?.currency && cost?.amount?.currency) {
        addPair(pairs, posting.units.currency, cost.amount.currency);
      }
    }
  });
}

export function findCurrenciesConverted(
  entries: Directives,
  date: DateTime | null = null,
): Set<CurrencyPair> {
  return pairsBefore(entries, date, (entry, pairs) => {
    if (!(entry instanceof Transaction)) return;
    for (const posting of entry.postings) {
      if (
        posting.units?.currency &&
        !posting.resolvedCost &&
        posting.price?.currency
      ) {
        addPair(pairs, posting.units.currency, posting.price.currency);
      }
    }
  });
}

export function findCurrenciesPriced(
  entries: Directives,
  date: DateTime | null = null,
): Set<CurrencyPair> {
  return pairsBefore(entries, date, (entry, pairs) => {
    if (entry instanceof Price && entry.amount.currency) {
      addPair(pairs, entry.currency, entry.amount.currency);
    }
  });
}

export function findBalanceCurrencies(
  entries: Directives,
  date: DateTime | null = null,
): Set<CurrencyPair> {
  const result = new Map<string, CurrencyPair>();
  const currenciesOnBooks = new Set<string>();
  const [balances] = balanceByAccount(entries, date);
  for (const balance of balances.values()) {
    for (const position of balance.positions) {
      if (position.cost?.amount?.currency && position.units.currency) {
        addPair(result, position.units.currency, position.cost.amount.currency);
      } else if (position.units.currency) {
        currenciesOnBooks.add(position.units.currency);
      }
    }
  }

  for (const [base, quote] of [
    ...findCurrenciesConverted(entries, date),
    ...findCurrenciesPriced(entries, date),
  ]) {
    if (currenciesOnBooks.has(base)) addPair(result, base, quote);
  }
  return new Set(result.values());
}

export function findUnpricedCurrencies(
  entries: Directives,
  date: DateTime | null = null,
): Set<string> {
  const currenciesOnBooks = new Set<string>();
  const [balances] = balanceByAccount(entries, date);
  for (const balance of balances.values()) {
    for (const position of balance.positions) {
      if (!position.cost && position.units.currency) {
        currenciesOnBooks.add(position.units.currency);
      }
    }
  }
  const pricedBases = new Set(
    [
      ...findCurrenciesConverted(entries, date),
      ...findCurrenciesPriced(entries, date),
    ].map(([base]) => base),
  );
  return new Set(
    [...currenciesOnBooks].filter((currency) => !pricedBases.has(currency)),
  );
}
