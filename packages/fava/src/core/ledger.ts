import {
  filterTransactions,
  loadString,
  PriceMap,
  Transaction,
  type Directives,
  type LedgerError,
  type LoadProps,
  Custom,
  optionKey,
  LoadError,
  Posting,
  type Directive,
  Price,
  Balance,
  Cost,
  Note,
  Document,
  type ScalarType,
  SOURCE_META,
} from "@beancount-js/beancount";
import type { AccountDetails } from "./account";
import type { Options } from "../context";
import {
  defaultFavaOptions,
  defaultLedgerOptions,
  favaOptionsSchema,
  ledgerOptionsSchema,
  type FavaOptions,
  type LedgerOptions,
} from "../options";
import {
  OptionDirective,
  type BeanCountDocument,
  Text,
  md5,
} from "@beancount-js/parser";
import { DateTime } from "luxon";
import { LedgerData } from "./ledger-data-class";

export { LedgerData } from "./ledger-data-class";
export type { IntervalTree } from "./ledger-data-class";
export interface LedgerTaxonomy {
  tags: Array<string>;
  links: Array<string>;
  currencies: Array<string>;
  payees: Array<string>;
  accounts: Array<string>;
  years: Array<string>;
}

export function parseFavaOptions(
  directives: Directives,
): [FavaOptions, Array<LedgerError>] {
  const errors: Array<LedgerError> = [];
  const options: Record<string, unknown> = defaultFavaOptions();
  directives.forEach((entry) => {
    if (!(entry instanceof Custom) || entry.type !== "fava-option") {
      return;
    }
    const args = entry.values.slice(1);
    if (!args.length) {
      errors.push(
        new LoadError(`Missing value for fava-option directive`, { entry }),
      );
    }
    const key = optionKey(entry.values[0]!.toString());
    const value = options[key];
    if (value !== null && value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        options[key] = [...new Set([...value, ...args])];
      } else {
        if (args.length > 1) {
          options[key] = args[0];
          errors.push(
            new LoadError(`Multiple values supplied for fava-option '${key}'`, {
              entry,
            }),
          );
        } else {
          options[key] = args[0];
        }
      }
    } else {
      if (args.length == 0) {
        if (key === "default_file") {
          options[key] = (entry.meta || {})["file"] || "";
        } else {
          errors.push(
            new LoadError(`Missing value for fava-option(${key}) directive`, {
              entry,
            }),
          );
        }
      } else {
        options[key] = args.length > 1 ? args : args[0];
      }
    }
  });

  const fava = favaOptionsSchema.strict().safeParse(options);
  if (!fava.success) {
    const customOpts: Record<string, Custom> = {};
    directives.forEach((it) => {
      if (it instanceof Custom && it.type == "fava-option") {
        customOpts[it.values[0]!.toString()] = it;
      }
    });
    fava.error.errors.forEach((err: any) => {
      const key = err.path[0] ?? err.keys[0];
      const message = `${key}: ${err.message}`;
      errors.push(new LoadError(message, { entry: customOpts[key] }));
    });
    return [fava.data ?? defaultFavaOptions(), errors];
  } else {
    return [fava.data, errors];
  }
}

export function parseLedgerOptions(
  directives: Directives,
): [LedgerOptions, Array<LedgerError>] {
  const errors: Array<LedgerError> = [];
  const options: Record<string, unknown> = defaultLedgerOptions();
  directives.forEach((entry) => {
    if (!(entry instanceof Custom) || entry.type !== "ledger-option") {
      return;
    }
    const args = entry.values.slice(1);
    if (!args.length) {
      errors.push(
        new LoadError(`Missing value for ledger-option directive`, { entry }),
      );
    }
    const key = optionKey(entry.values[0]!.toString());
    const value = options[key];
    if (value !== null && value !== undefined && value !== "") {
      if (Array.isArray(value)) {
        options[key] = [...new Set([...value, ...args])];
      } else {
        if (args.length > 1) {
          options[key] = args[0];
          errors.push(
            new LoadError(
              `Multiple values supplied for ledger-option '${key}'`,
              {
                entry,
              },
            ),
          );
        } else {
          options[key] = args[0];
        }
      }
    } else {
      if (args.length == 0) {
        if (key === "default_file") {
          options[key] = (entry.meta || {})["file"] || "";
        } else {
          errors.push(
            new LoadError(`Missing value for fava-option(${key}) directive`, {
              entry,
            }),
          );
        }
      } else {
        options[key] = args.length > 1 ? args : args[0];
      }
    }
  });

  const ledger = ledgerOptionsSchema.strict().safeParse(options);
  if (!ledger.success) {
    const customOpts: Record<string, Custom> = {};
    directives.forEach((it) => {
      if (it instanceof Custom && it.type == "ledger-option") {
        customOpts[it.values[0]!.toString()] = it;
      }
    });
    ledger.error.errors.forEach((err: any) => {
      const key = err.path[0] ?? err.keys[0];
      const message = `${key}: ${err.message}`;
      errors.push(new LoadError(message, { entry: customOpts[key] }));
    });
    return [ledger.data ?? defaultLedgerOptions(), errors];
  } else {
    return [ledger.data, errors];
  }
}

function extractCurrencies(entity: Posting | Directive): string[] {
  if (entity instanceof Transaction) {
    return entity.postings.map((it) => extractCurrencies(it)).flat();
  } else if (entity instanceof Price || entity instanceof Balance) {
    return entity.amount.currency ? [entity.amount.currency] : [];
  } else if (entity instanceof Posting) {
    const amounts: string[] = [];
    if (entity.units?.currency) {
      amounts.push(entity.units.currency);
    }
    if (entity.cost instanceof Cost && entity.cost?.amount?.currency) {
      amounts.push(entity.cost.amount.currency);
    }
    if (entity.price?.currency) {
      amounts.push(entity.price.currency);
    }
    return amounts;
  }
  return [];
}

export class LedgerSource {
  readonly directives: Directives;
  readonly options: Options;
  readonly transactions: ReadonlyArray<Transaction>;
  readonly errors: Array<LedgerError> = [];
  readonly prices: PriceMap;

  constructor(
    contents: string,
    readonly props: Partial<LoadProps> = {
      logTimings: console.log,
    },
  ) {
    const [directives, errors, beancountOptions] = loadString(contents, props);
    const [favaOptions, favaErrors] = parseFavaOptions(directives);
    const [ledgerOptions, ledgerErrors] = parseLedgerOptions(directives);

    this.directives = directives;
    this.errors.push(...[...errors, ...favaErrors, ...ledgerErrors]);
    this.transactions = filterTransactions(directives);
    this.options = {
      beancount: beancountOptions,
      fava: favaOptions,
      ledger: ledgerOptions,
    };
    this.prices = new PriceMap(directives);
  }

  #ledgerData!: LedgerData;
  get data(): LedgerData {
    if (!this.#ledgerData) {
      this.#ledgerData = new LedgerData(
        this.directives,
        this.taxonomy,
        this.prices,
        this.options,
        this.errors,
      );
    }
    return this.#ledgerData;
  }

  #taxonomy!: LedgerTaxonomy;
  get taxonomy() {
    if (this.#taxonomy) {
      return this.#taxonomy;
    }
    const taxonomy = {
      tags: new Set<string>(),
      links: new Set<string>(),
      currencies: new Set<string>(),
      payees: new Set<string>(),
      accounts: new Set<string>(),
      years: new Set<string>(),
    };

    this.directives.forEach((directive) => {
      if (directive.date) {
        taxonomy.years.add(directive.date.toFormat("yyyy"));
      }
      directive.accounts.forEach((acc) => taxonomy.accounts.add(acc));
      extractCurrencies(directive).forEach((it) => taxonomy.currencies.add(it));
      if (directive instanceof Transaction) {
        if (directive.payee) {
          taxonomy.payees.add(directive.payee);
        }
      }
      if (
        directive instanceof Note ||
        directive instanceof Transaction ||
        directive instanceof Document
      ) {
        directive.tags.forEach((it) => taxonomy.tags.add(it));
        directive.links.forEach((it) => taxonomy.links.add(it));
      }
    });

    this.#taxonomy = {
      tags: [...taxonomy.tags],
      links: [...taxonomy.links],
      currencies: [...taxonomy.currencies],
      payees: [...taxonomy.payees],
      accounts: [...taxonomy.accounts],
      years: [...taxonomy.years],
    };
    return this.#taxonomy;
  }

  #hash: string = "";
  get hash() {
    if (!this.#hash) {
      this.#hash = md5(this.toString());
    }
    return this.#hash;
  }

  public toString() {
    return this.doc.contents;
  }

  get doc(): BeanCountDocument {
    const value = this.options.beancount.files.find(
      (it) => it.filename === this.options.beancount.filename,
    );
    if (!value?.document) {
      throw new Error(
        `No document for ledger file: {${this.options.beancount.filename}}`,
      );
    }
    return value.document;
  }

  withOption(name: string, value: string) {
    const check = optionKey(name);
    const opts: Array<OptionDirective> = this.doc.directives
      .filter((it) => it instanceof OptionDirective)
      .filter((it) => optionKey(it.name) === check);

    if (opts.length == 1) {
      const opt = opts[0];
      if (opt.value === value) {
        return this;
      }
      const doc = this.doc.doc.replace(
        opt.position.from,
        opt.position.to,
        Text.of([`option "${name}" "${value}"`, ""]),
      );
      return new LedgerSource(doc.toString(), this.props);
    } else if (opts.length > 1) {
      if (opts.find((it) => it.value === value)) {
        return this;
      }
    }
    return new LedgerSource(
      `option "${name}" "${value}"\n${this.doc.doc.toString()}`,
      this.props,
    );
  }

  withFavaOption(name: string, ...values: ScalarType[]) {
    const check = optionKey(name);
    let custom = this.directives
      .filter((it) => it instanceof Custom)
      .find(
        (it) =>
          it.type === "fava-option" &&
          optionKey(it.values[0]?.toString()) === check,
      );

    if (custom) {
      const args = custom.values.slice(1);
      if (args.toString() === values.toString()) {
        return this;
      }
      custom = custom.copy({ values: [name, ...values] });
      delete custom.meta[SOURCE_META];
      const pos = custom.source!.directive.position;
      const doc = this.doc.doc.replace(
        pos.from,
        pos.to,
        Text.of((custom.toString() + "\n").split("\n")),
      );
      return new LedgerSource(doc.toString(), this.props);
    }
    custom = new Custom(DateTime.now(), "fava-option", [name, ...values]);
    return new LedgerSource(
      `${custom.toString()}\n${this.doc.doc.toString()}`,
      this.props,
    );
  }

  withLedgerOption(name: string, ...values: ScalarType[]) {
    const check = optionKey(name);
    let custom = this.directives
      .filter((it) => it instanceof Custom)
      .find(
        (it) =>
          it.type === "ledger-option" &&
          optionKey(it.values[0]?.toString()) === check,
      );

    if (custom) {
      const args = custom.values.slice(1);
      if (args.toString() === values.toString()) {
        return this;
      }
      custom = custom.copy({ values: [name, ...values] });
      delete custom.meta[SOURCE_META];
      const pos = custom.source!.directive.position;
      const doc = this.doc.doc.replace(
        pos.from,
        pos.to,
        Text.of((custom.toString() + "\n").split("\n")),
      );
      return new LedgerSource(doc.toString(), this.props);
    }
    custom = new Custom(DateTime.now(), "ledger-option", [name, ...values]);
    return new LedgerSource(
      `${custom.toString()}\n${this.doc.doc.toString()}`,
      this.props,
    );
  }
}
