import { DateTime, type DateTime as DateTimeType } from "luxon";
import { Decimal, md5 } from "@beancount-js/parser";
import { Amount } from "./amount";
import { type Directive, Price, sorted } from "./data";
import { Cost, CostSpec } from "./position";

export class CompareError extends Error {
  constructor(
    message: string,
    readonly entry: Directive,
    readonly duplicate?: Directive,
  ) {
    super(message);
  }
}

type Hashable = null | undefined | string | number | boolean | object;

function stableValue(value: Hashable, ignore: ReadonlySet<string>): string {
  if (value === null) return "None";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return String(value);
  if (value instanceof DateTime) return value.toISODate() ?? "";
  if (value instanceof Decimal) return value.value;
  if (value instanceof Amount)
    return `${stableValue(value.value, ignore)} ${value.currency ?? ""}`;
  if (value instanceof Cost)
    return `${stableValue(value.amount, ignore)} ${stableValue(value.date, ignore)} ${value.label}`;
  if (value instanceof CostSpec)
    return [
      value.numberPer,
      value.numberTotal,
      value.currency,
      value.date,
      value.label,
      value.merge,
    ]
      .map((item) => stableValue(item, ignore))
      .join("|");
  if (Array.isArray(value) || value instanceof Set) {
    return [...value]
      .map((item) => md5(stableValue(item, ignore)))
      .sort()
      .join("");
  }
  if (value instanceof Map) {
    return [...value.entries()]
      .map(
        ([key, item]) =>
          `${stableValue(key, ignore)}:${stableValue(item, ignore)}`,
      )
      .sort()
      .join("|");
  }
  return Object.entries(value)
    .filter(([key]) => !ignore.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}:${stableValue(item, ignore)}`)
    .join("|");
}

/** Returns the deterministic MD5 hash used to compare directives. */
export function stableHash(
  value: Hashable,
  ignore: ReadonlySet<string> = new Set(),
) {
  return md5(stableValue(value, ignore));
}

export function hashEntry(entry: Directive, excludeMeta = false) {
  return stableHash(entry, excludeMeta ? new Set(["meta", "diff"]) : new Set());
}

export function hashEntries(
  entries: readonly Directive[],
  excludeMeta = false,
) {
  const hashes = new Map<string, Directive>();
  const errors: CompareError[] = [];
  for (const entry of entries) {
    const hash = hashEntry(entry, excludeMeta);
    const duplicate = hashes.get(hash);
    if (duplicate && !(entry instanceof Price)) {
      errors.push(
        new CompareError(
          `Duplicate entry: ${entry} == ${duplicate}`,
          entry,
          duplicate,
        ),
      );
    }
    hashes.set(hash, entry);
  }
  return [hashes, errors] as const;
}

export function compareEntries(
  left: readonly Directive[],
  right: readonly Directive[],
) {
  const [leftHashes, leftErrors] = hashEntries(left, true);
  const [rightHashes, rightErrors] = hashEntries(right, true);
  if (leftErrors[0] || rightErrors[0]) throw leftErrors[0] ?? rightErrors[0];
  const leftOnly = [...leftHashes]
    .filter(([hash]) => !rightHashes.has(hash))
    .map(([, entry]) => entry);
  const rightOnly = [...rightHashes]
    .filter(([hash]) => !leftHashes.has(hash))
    .map(([, entry]) => entry);
  return [
    leftOnly.length === 0 && rightOnly.length === 0,
    sorted(leftOnly),
    sorted(rightOnly),
  ] as const;
}

export function includesEntries(
  subset: readonly Directive[],
  entries: readonly Directive[],
) {
  const [subsetHashes, subsetErrors] = hashEntries(subset, true);
  const [hashes, errors] = hashEntries(entries, true);
  if (subsetErrors[0] || errors[0]) throw subsetErrors[0] ?? errors[0];
  const missing = [...subsetHashes]
    .filter(([hash]) => !hashes.has(hash))
    .map(([, entry]) => entry);
  return [missing.length === 0, sorted(missing)] as const;
}

export function excludesEntries(
  subset: readonly Directive[],
  entries: readonly Directive[],
) {
  const [subsetHashes, subsetErrors] = hashEntries(subset, true);
  const [hashes, errors] = hashEntries(entries, true);
  if (subsetErrors[0] || errors[0]) throw subsetErrors[0] ?? errors[0];
  const present = [...subsetHashes]
    .filter(([hash]) => hashes.has(hash))
    .map(([, entry]) => entry);
  return [present.length === 0, sorted(present)] as const;
}
