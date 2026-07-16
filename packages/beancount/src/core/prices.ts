import { Decimal, formatDate } from "@beancount-js/parser";
import { Price, type Directives } from "./data";
import { DefaultKeyedMap } from "./map";
import { DateTime } from "luxon";
import { bisectRightWithKey } from "../utils";

export class PricePoint {
  constructor(
    readonly date: DateTime,
    readonly units: Decimal,
  ) {}

  get hash(): string {
    return `${formatDate(this.date)} ${this.units.number}`.trim();
  }
}

export class BaseQuote {
  readonly base: string;
  readonly quote: string;

  constructor(base: string | null, quote: string | null) {
    this.base = base ?? "";
    this.quote = quote ?? "";
  }

  get hash(): string {
    return `${this.base} ${this.quote}`.trim();
  }

  public toString() {
    return this.hash;
  }

  inverse() {
    return new BaseQuote(this.quote, this.base);
  }

  static from(quote: string) {
    const parts = (quote || "").trim().split(/[\s/]+/, 2);
    return new BaseQuote(parts[0], parts[1]);
  }
}

export type BaseQuoteInput = BaseQuote | string | readonly [string, string];

export function normalizeBaseQuote(baseQuote: BaseQuoteInput): BaseQuote {
  if (baseQuote instanceof BaseQuote) return baseQuote;
  if (typeof baseQuote === "string") return BaseQuote.from(baseQuote);
  return new BaseQuote(baseQuote[0], baseQuote[1]);
}

function keepLastPerDay(prices: ReadonlyArray<PricePoint>) {
  if (!prices.length) {
    return [];
  }
  const response: Array<PricePoint> = [];
  let last: PricePoint | undefined;
  [...prices]
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .forEach((price) => {
      if (last && price.date.toMillis() !== last.date.toMillis()) {
        response.push(last);
      }
      last = price;
    });
  if (last) response.push(last);
  return response;
}

export function getLastPriceEntries(entries: Directives, date: DateTime) {
  const priceEntryMap: Record<string, Price> = {};

  for (const entry of entries) {
    if (date && entry.date && entry.date >= date) {
      break;
    }
    if (entry instanceof Price) {
      const baseQuote = new BaseQuote(entry.currency, entry.amount.currency);
      priceEntryMap[baseQuote.hash] = entry;
    }
  }
  return Object.values(priceEntryMap);
}

export class PriceMap {
  readonly forwardPairs: Array<BaseQuote> = [];
  readonly map: DefaultKeyedMap<BaseQuote, Array<PricePoint>> =
    new DefaultKeyedMap<BaseQuote, Array<PricePoint>>(() => {
      const data: Array<PricePoint> = [];
      return data;
    });

  constructor(directives: Directives) {
    const priceEntries = directives.filter((it) => it instanceof Price);
    const rawMap = new Map<
      string,
      { quote: BaseQuote; prices: PricePoint[] }
    >();

    priceEntries.forEach((price) => {
      const rate = price.amount.units;
      const baseQuote = new BaseQuote(price.currency, price.amount.currency);
      const record = rawMap.get(baseQuote.hash) ?? {
        quote: baseQuote,
        prices: [],
      };
      record.prices.push(new PricePoint(price.date, rate));
      rawMap.set(baseQuote.hash, record);
    });

    const reconciled = new Set<string>();
    for (const record of [...rawMap.values()]) {
      if (reconciled.has(record.quote.hash)) continue;
      const inverse = rawMap.get(record.quote.inverse().hash);
      if (!inverse) continue;

      const retainRecord =
        record.prices.length > inverse.prices.length ||
        (record.prices.length === inverse.prices.length &&
          record.quote.hash < inverse.quote.hash)
          ? record
          : inverse;
      const removeRecord = retainRecord === record ? inverse : record;
      retainRecord.prices.push(
        ...removeRecord.prices
          .filter((point) => !point.units.zero)
          .map(
            (point) => new PricePoint(point.date, Decimal.ONE.div(point.units)),
          ),
      );
      rawMap.delete(removeRecord.quote.hash);
      reconciled.add(retainRecord.quote.hash);
    }

    for (const { quote, prices } of rawMap.values()) {
      const normalized = keepLastPerDay(prices);
      this.forwardPairs.push(quote);
      this.map.set(quote, normalized);
      this.map.set(
        quote.inverse(),
        normalized
          .filter((point) => !point.units.zero)
          .map(
            (point) => new PricePoint(point.date, Decimal.ONE.div(point.units)),
          ),
      );
    }
  }

  commodityPairs(operatingCurrencies: string[]): BaseQuote[] {
    const quotes = [...this.forwardPairs];
    this.forwardPairs.forEach((quote) => {
      if (
        operatingCurrencies.includes(quote.base) &&
        operatingCurrencies.includes(quote.quote)
      ) {
        quotes.push(quote.inverse());
      }
    });
    return quotes;
  }

  getAllPrices(baseQuote: BaseQuoteInput) {
    return [...this.map.get(normalizeBaseQuote(baseQuote))];
  }

  getLatestPrice(baseQuote: BaseQuoteInput): PricePoint | null {
    return this.pricePoint(baseQuote);
  }

  getPrice(baseQuote: BaseQuoteInput, date?: DateTime): Decimal | undefined {
    const normalized = normalizeBaseQuote(baseQuote);
    if (normalized.base === normalized.quote) {
      return Decimal.ONE;
    }
    return this.pricePoint(normalized, date)?.units;
  }

  pricePoint(baseQuote: BaseQuoteInput, date?: DateTime): PricePoint | null {
    const prices = this.map.get(normalizeBaseQuote(baseQuote));
    if (!prices.length) {
      return null;
    }

    if (!date) {
      return prices[prices.length - 1];
    }

    const index = bisectRightWithKey(prices, date.toMillis(), (item) =>
      item.date.toMillis(),
    );
    if (index == 0) {
      return null;
    }
    return prices[index - 1];
  }
}
