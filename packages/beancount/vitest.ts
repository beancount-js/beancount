import { expect } from "vitest";

import "vitest";
import { loadString } from "./src/parser/loader";
import { DirectiveBase, LedgerOption } from "./src/core/data";
export {};

interface CustomMatchers<R = unknown> {
  toMatchDirective: (expected: string | DirectiveBase[]) => R;
}

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

function normalizeLedger(input: string) {
  const [inputDirectives] = loadString(input);
  return inputDirectives
    .filter((it) => !(it instanceof LedgerOption))
    .map((it) => it.toString())
    .sort()
    .join("\n");
}

expect.extend({
  toMatchDirective(received, expected) {
    const { isNot } = this;
    let input = received;
    if (Array.isArray(received)) {
      input = received
        .map((it) => it.toString())
        .join("\n")
        .trim();
    } else if (typeof received !== "string") {
      throw new Error("expected inputs to be a string");
    }
    const actual = normalizeLedger(input);
    expected = normalizeLedger(expected);
    return {
      pass: actual === expected,
      message: () => `Expected directives to${isNot ? " not" : ""} match`,
      actual,
      expected,
    };
  },
});
