import { describe, expect, test } from "vitest";
import * as beancount from "./index";

describe("public API", () => {
  test("re-exports core, parser, operations, parity, and plugin entry points", () => {
    expect(beancount.Amount).toBeTypeOf("function");
    expect(beancount.loadString).toBeTypeOf("function");
    expect(beancount.parseLedger).toBeTypeOf("function");
    expect(beancount.checkBalance).toBeTypeOf("function");
    expect(beancount.formatEntry).toBeTypeOf("function");
    expect(beancount.validateParityManifest).toBeTypeOf("function");
    expect(beancount.autoInsertOpen).toBeTypeOf("function");
    expect(beancount.forecast).toBeTypeOf("function");
  });
});
