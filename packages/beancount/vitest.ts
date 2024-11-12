import { format } from "@beancount-js/parser";
import { expect } from "vitest";

import "vitest";
import { dedent } from "./src/parser/loader";
export {};

interface CustomMatchers<R = unknown> {
  toMatchDirective: (expected: string) => R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toMatchDirective(received, expected) {
    const { isNot } = this;
    if (typeof received !== "string") {
      throw new Error("expected inputs to be a string");
    }
    const actual = format(dedent(received)).replaceAll(/\n\n+/g, "\n\n").trim();
    expected = format(dedent(expected)).replaceAll(/\n\n+/g, "\n\n").trim();
    return {
      pass: actual === expected,
      message: () => `Expected directives to${isNot ? " not" : ""} match`,
      actual,
      expected,
    };
  },
});
