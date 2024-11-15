import { Decimal, formatDate } from "@beancount-js/parser";
import { Price, type Directives } from "./data";
import { DefaultKeyedMap } from "./map";
import { DateTime } from "luxon";
import { bisectLeftWithKey } from "../utils";

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
    const parts = (quote || "").trim().split(" ", 2);
    return new BaseQuote(parts[0], parts[1]);
  }
}

function keepLastPerDay(prices: Array<PricePoint>) {
  if (!prices.length) {
    return [];
  }
  const response: Array<PricePoint> = [];
  let last = prices[0];
  prices
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .forEach((price) => {
      if (price.date > last.date) {
        response.push(price);
      }
      last = price;
    });
  response.push(last);
  return response;
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
    const rawMap = new DefaultKeyedMap<BaseQuote, Array<PricePoint>>(() => {
      const data: Array<PricePoint> = [];
      return data;
    });
    const counts: Record<string, number> = {};

    priceEntries.forEach((price) => {
      const rate = price.amount.units;
      const baseQuote = new BaseQuote(price.currency, price.amount.currency);
      counts[baseQuote.hash] ||= 0;
      counts[baseQuote.hash] += 1;
      rawMap.get(baseQuote).push(new PricePoint(price.date, rate));
      if (!rate.zero) {
        rawMap
          .get(new BaseQuote(price.amount.currency, price.currency))
          .push(new PricePoint(price.date, Decimal.ONE.div(rate)));
      }
    });

    for (const [key, count] of Object.entries(counts)) {
      const quote = BaseQuote.from(key);
      const value = counts[quote.inverse().hash] ?? 0;
      if (value < count) {
        this.forwardPairs.push(quote);
      }
    }

    for (const [quote, prices] of rawMap.entries()) {
      this.map.set(quote, keepLastPerDay(prices));
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

  getAllPrices(baseQuote: BaseQuote) {
    return this.map.get(baseQuote);
  }

  getPrice(baseQuote: BaseQuote, date?: DateTime): Decimal | undefined {
    if (baseQuote.base === baseQuote.quote) {
      return Decimal.ONE;
    }
    return this.pricePoint(baseQuote, date)?.units;
  }

  pricePoint(baseQuote: BaseQuote, date?: DateTime): PricePoint | null {
    const prices = this.map.get(baseQuote);
    if (!prices.length) {
      return null;
    }

    if (!date) {
      return prices[prices.length - 1];
    }

    const index = bisectLeftWithKey(prices, date.toMillis(), (item) =>
      item.date.toMillis(),
    );
    if (index == 0) {
      return null;
    }
    return prices[index];
  }
}
