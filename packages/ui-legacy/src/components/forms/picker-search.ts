import { fuzzySearch } from "@beancount-js/filters";
import type { FilterCommandOption } from "./picker-options";

/** Fuzzy-match picker options while giving their visible label priority. */
export function filterCommandOptions(
  options: readonly FilterCommandOption[],
  query: string,
): FilterCommandOption[] {
  return fuzzySearch(options, query, {
    keys: [
      { name: "label", weight: 3 },
      { name: "value", weight: 2 },
      { name: "keywords", weight: 2 },
      "description",
    ],
  });
}

/** Custom picker entries remain exact even though visible suggestions are fuzzy. */
export function hasExactFilterCommandOption(
  options: readonly FilterCommandOption[],
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return options.some(
    (option) =>
      option.value.toLowerCase() === needle ||
      option.label.toLowerCase() === needle,
  );
}

/** De-duplicate chip suggestions before fuzzy-ranking the visible options. */
export function autocompleteSuggestions(
  suggestions: readonly string[],
  query: string,
  limit = 8,
): string[] {
  const seen = new Set<string>();
  const unique = suggestions
    .map((suggestion) => suggestion.trim())
    .filter(Boolean)
    .filter((suggestion) => {
      const key = suggestion.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((value) => ({ value }));

  return fuzzySearch(unique, query, {
    keys: [{ name: "value", weight: 3 }],
    limit,
  }).map((suggestion) => suggestion.value);
}
