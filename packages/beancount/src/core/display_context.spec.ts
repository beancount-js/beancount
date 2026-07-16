import { Decimal } from "@beancount-js/parser";
import { describe, expect, test } from "vitest";
import { Align, DisplayContext, Precision } from "./display_context";

describe("display context", () => {
  test("uses common and maximum observed precision", () => {
    const context = new DisplayContext();
    ["1.2345", "1.23", "234.26", "38.019"].forEach((value) =>
      context.update(new Decimal(value), "USD"),
    );
    expect(context.build().format(new Decimal("1.2345"), "USD")).toBe("1.23");
    expect(
      context
        .build(Align.NATURAL, Precision.MAXIMUM)
        .format(new Decimal("1.23"), "USD"),
    ).toBe("1.2300");
  });

  test("supports fixed precision, commas, right and dot alignment", () => {
    const context = new DisplayContext();
    context.setFixedPrecision("USD", 2);
    context.update(new Decimal("1234.5"), "USD");
    expect(context.build().format(new Decimal("1.234"), "USD")).toBe("1.23");
    expect(
      context
        .build(Align.RIGHT, Precision.MOST_COMMON, true)
        .format(new Decimal("1234.5"), "USD"),
    ).toContain("1,234.50");
    expect(context.build(Align.DOT).format(new Decimal("1"), "USD")).toContain(
      "1.00",
    );
    expect(context.quantize(new Decimal("1.235"), "USD").value).toBe("1.24");
  });
});
