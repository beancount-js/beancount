import { parseDocument } from "yaml";
import type { BeancountOptions } from "../core";
import { Commodity, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

type ValidAttributes = Map<string, ReadonlySet<unknown> | null>;

function parseConfig(config: string | undefined): ValidAttributes | null {
  if (!config) return null;
  const document = parseDocument(config);
  if (document.errors.length > 0) return null;
  const value = document.toJS();
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const attributes = new Map<string, ReadonlySet<unknown> | null>();
  for (const [attribute, values] of Object.entries(value)) {
    if (values !== null && !Array.isArray(values)) return null;
    attributes.set(attribute, values === null ? null : new Set(values));
  }
  return attributes;
}

/** Validates required and enumerated metadata attributes on Commodity directives. */
export function validateCommodityAttributes(
  entries: Directives,
  _options?: BeancountOptions,
  config?: string,
): [Directives, Array<ValidationError>] {
  const attributes = parseConfig(config);
  if (!attributes) {
    return [
      entries,
      [
        new ValidationError(
          "Invalid configuration for commodity_attr plugin; skipping.",
          { filename: "<commodity_attr>", lineno: 0 },
        ),
      ],
    ];
  }

  const errors: ValidationError[] = [];
  for (const entry of entries) {
    if (!(entry instanceof Commodity)) continue;
    for (const [attribute, values] of attributes) {
      const value = entry.meta[attribute];
      if (value === undefined || value === null) {
        errors.push(
          new ValidationError(
            `Missing attribute '${attribute}' for Commodity directive ${entry.currency}`,
            entry,
          ),
        );
      } else if (values && values.size > 0 && !values.has(value)) {
        errors.push(
          new ValidationError(
            `Invalid value '${value}' for attribute ${attribute}, Commodity directive ${entry.currency}; valid options: ${[...values].join(", ")}`,
            entry,
          ),
        );
      }
    }
  }
  return [entries, errors];
}
