import { Decimal } from "@beancount-js/parser";
import { DateTime } from "luxon";

export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | Array<CanonicalValue>
  | { [key: string]: CanonicalValue };

/**
 * Converts runtime-only values into stable JSON data for upstream oracle
 * fixtures. Decimal values are deliberately strings so comparisons never go
 * through JavaScript's binary floating point representation.
 */
export function canonicalize(value: unknown): CanonicalValue {
  if (value === null) return null;
  if (
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (typeof value === "undefined") return { $undefined: true };
  if (value instanceof Decimal) return { $decimal: value.toString() };
  if (DateTime.isDateTime(value)) return { $date: value.toISODate() ?? "" };
  if (value instanceof Error) {
    return {
      $error: value.name,
      message: value.message,
    };
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Set) {
    return {
      $set: [...value]
        .map(canonicalize)
        .sort((left, right) =>
          canonicalJson(left).localeCompare(canonicalJson(right)),
        ),
    };
  }
  if (value instanceof Map) {
    return {
      $map: [...value.entries()]
        .map(([key, item]) => [canonicalize(key), canonicalize(item)])
        .sort((left, right) =>
          canonicalJson(left[0]).localeCompare(canonicalJson(right[0])),
        ),
    };
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return String(value);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value), null, 2);
}
