import { parseDocument } from "yaml";
import type { BeancountOptions } from "../core";
import {
  Balance,
  Commodity,
  Open,
  Price,
  Transaction,
  type Directives,
} from "../core/data";
import { ValidationError } from "../ops/validation";

const PRICE_CONTEXT = "Price Directive Context";
const METADATA_CONTEXT = "Metadata Value Context";
const ANONYMOUS_CONTEXTS = new Set([PRICE_CONTEXT, METADATA_CONTEXT]);
const CURRENCY = /^[A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]$/;
const IGNORED_METADATA_KEYS = new Set(["filename", "lineno", "__automatic__"]);

type Occurrence = readonly [context: string, currency: string];

function metadataCurrencies(metadata: Record<string, unknown>) {
  return Object.entries(metadata).flatMap(([key, value]) =>
    typeof value === "string" &&
    !IGNORED_METADATA_KEYS.has(key) &&
    CURRENCY.test(value)
      ? [value]
      : [],
  );
}

/** Finds commodity occurrences and Commodity directives, with optional metadata scanning. */
export function getCommodityMap(
  entries: Directives,
  includeMetadata = false,
): [Occurrence[], Map<string, Commodity>] {
  const occurrences = new Map<string, Occurrence>();
  const commodities = new Map<string, Commodity>();
  const add = (context: string, currency: string | null | undefined) => {
    if (!currency) return;
    occurrences.set(`${context}\u0000${currency}`, [context, currency]);
  };

  for (const entry of entries) {
    if (entry instanceof Commodity) {
      commodities.set(entry.currency, entry);
    } else if (entry instanceof Open) {
      entry.currencies.forEach((currency) => add(entry.account, currency));
    } else if (entry instanceof Transaction) {
      for (const posting of entry.postings) {
        add(posting.account, posting.units?.currency);
        add(posting.account, posting.cost?.currency);
        add(posting.account, posting.price?.currency);
        if (includeMetadata)
          metadataCurrencies(posting.meta).forEach((currency) =>
            add(posting.account, currency),
          );
      }
    } else if (entry instanceof Balance) {
      add(entry.account, entry.amount.currency);
    } else if (entry instanceof Price) {
      add(PRICE_CONTEXT, entry.currency);
      add(PRICE_CONTEXT, entry.amount.currency);
    }
    if (includeMetadata)
      metadataCurrencies(entry.meta).forEach((currency) =>
        add(METADATA_CONTEXT, currency),
      );
  }
  return [[...occurrences.values()], commodities];
}

function parseIgnoreMap(config: string | undefined): RegExp[][] | null {
  if (!config) return [];
  const document = parseDocument(config);
  if (document.errors.length > 0) return null;
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const patterns: RegExp[][] = [];
  try {
    for (const [account, currency] of Object.entries(value)) {
      if (typeof account !== "string" || typeof currency !== "string")
        return null;
      patterns.push([new RegExp(account), new RegExp(currency)]);
    }
  } catch {
    return null;
  }
  return patterns;
}

/** Validates that every used commodity has a corresponding Commodity directive. */
export function validateCommodityDirectives(
  entries: Directives,
  _options?: BeancountOptions,
  config?: string,
): [Directives, Array<ValidationError>] {
  const ignoreMap = parseIgnoreMap(config);
  if (!ignoreMap) {
    return [
      entries,
      [
        new ValidationError(
          "Invalid configuration for check_commodity plugin; skipping.",
          { filename: "<check_commodity>", lineno: 0 },
        ),
      ],
    ];
  }

  const [occurrences, commodities] = getCommodityMap(entries);
  const ordered = [...occurrences].sort(
    ([leftContext, leftCurrency], [rightContext, rightCurrency]) =>
      leftContext.localeCompare(rightContext) ||
      leftCurrency.localeCompare(rightCurrency),
  );
  const issued = new Set<string>();
  const ignored = new Set<string>();
  const anonymous: Occurrence[] = [];
  const errors: ValidationError[] = [];
  const report = (currency: string, context: string) => {
    errors.push(
      new ValidationError(
        `Missing Commodity directive for '${currency}' in '${context}'`,
        { filename: "<check_commodity>", lineno: 0 },
      ),
    );
  };

  for (const [context, currency] of ordered) {
    if (ANONYMOUS_CONTEXTS.has(context)) {
      anonymous.push([context, currency]);
      continue;
    }
    if (commodities.has(currency) || issued.has(currency)) continue;
    if (
      ignoreMap.some(
        ([account, commodity]) =>
          account.test(context) && commodity.test(currency),
      )
    ) {
      ignored.add(currency);
      continue;
    }
    report(currency, context);
    issued.add(currency);
  }
  for (const [context, currency] of anonymous) {
    if (
      commodities.has(currency) ||
      issued.has(currency) ||
      ignored.has(currency)
    )
      continue;
    report(currency, context);
  }
  return [entries, errors];
}
