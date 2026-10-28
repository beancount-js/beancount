import { describe, expect, test } from "vitest";
import {
  autocompleteSuggestions,
  filterCommandOptions,
  hasExactFilterCommandOption,
} from "./picker-search";

const merchantOptions = [
  {
    value: "merchant:american-express",
    label: "American Express",
    description: "Credit card provider",
    keywords: ["amex", "americanexpress.com"],
  },
  {
    value: "merchant:barclaycard",
    label: "Barclaycard",
    description: "UK card issuer",
    keywords: ["barclays", "barclaycard.co.uk"],
  },
];

describe("picker search", () => {
  test("fuzzy-matches labels, descriptions, and keywords", () => {
    expect(
      filterCommandOptions(merchantOptions, "amricn exp").map(
        (option) => option.label,
      ),
    ).toEqual(["American Express"]);
    expect(
      filterCommandOptions(merchantOptions, "americanexpress.co").map(
        (option) => option.label,
      ),
    ).toEqual(["American Express"]);
  });

  test("keeps custom-entry checks exact", () => {
    expect(
      hasExactFilterCommandOption(merchantOptions, "American Express"),
    ).toBe(true);
    expect(
      hasExactFilterCommandOption(merchantOptions, "Amercan Express"),
    ).toBe(false);
  });

  test("de-duplicates and caps fuzzy chip suggestions", () => {
    expect(
      autocompleteSuggestions(
        ["Groceries", "groceries", "Restaurant", "Transportation"],
        "resturant",
      ),
    ).toEqual(["Restaurant"]);
    expect(
      autocompleteSuggestions(
        Array.from({ length: 12 }, (_, index) => `Tag ${index}`),
        "tag",
      ),
    ).toHaveLength(8);
  });
});
