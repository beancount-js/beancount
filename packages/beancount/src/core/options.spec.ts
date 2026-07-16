import { describe, expect, test } from "vitest";
import { Decimal } from "@beancount-js/parser";
import { loadString } from "../parser/loader";
import {
  beanCountOptionsSchema,
  canonicalOptionKey,
  defaultBeancountOptions,
} from "./options";

describe("Beancount options", () => {
  test("uses the pinned runtime defaults", () => {
    const options = defaultBeancountOptions();

    expect(options).toMatchObject({
      account_rounding: null,
      account_unrealized_gains: "Earnings:Unrealized",
      display_precision: {},
      insert_pythonpath: false,
      render_commas: false,
      title: "Beancount",
      tolerance_multiplier: new Decimal("0.5"),
      use_precise_interpolation: false,
    });
    expect(beanCountOptionsSchema.parse(options)).toEqual(options);
  });

  test("normalizes deprecated tolerance multiplier input", () => {
    const [, errors, options] = loadString(
      'option "inferred_tolerance_multiplier" "0.75"',
      { transform: false },
    );

    expect(errors).toEqual([]);
    expect(options.tolerance_multiplier).toEqual(new Decimal("0.75"));
    expect(options).not.toHaveProperty("inferred_tolerance_multiplier");
    expect(canonicalOptionKey("inferred-tolerance-multiplier")).toBe(
      "tolerance_multiplier",
    );
  });

  test("accepts upstream boolean spellings", () => {
    const [, errors, options] = loadString(
      [
        'option "insert_pythonpath" "yes"',
        'option "render_commas" "FALSE"',
      ].join("\n"),
      { transform: false },
    );

    expect(errors).toEqual([]);
    expect(options.insert_pythonpath).toBe(true);
    expect(options.render_commas).toBe(false);
  });
});
