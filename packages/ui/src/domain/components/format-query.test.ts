import { describe, expect, it } from "vitest";
import { formatQueryText } from "./format-query";

describe("BQL query formatting", () => {
  it("formats SELECT clauses while keeping function calls valid", () => {
    const result = formatQueryText(
      "SELECT account, sum(number) FROM postings GROUP BY account",
    );
    expect(result).toContain("SELECT\n  account,");
    expect(result).toContain("sum(number)");
    expect(result).toContain("GROUP BY\n  account");
  });

  it("preserves spaces and parentheses inside string literals", () => {
    expect(
      formatQueryText("SELECT narration WHERE narration = 'Cost (gross)'"),
    ).toContain("'Cost (gross)'");
  });

  it("keeps malformed or unsupported drafts editable", () => {
    const draft = "SELECT 'unclosed";
    expect(formatQueryText(draft)).toBe(draft);
  });

  it("retains BQL shell commands and accepts an empty editor", () => {
    for (const command of ["BALANCES", "CLEAR", "HELP"])
      expect(formatQueryText(command)).toBe(command);
    expect(formatQueryText("  ")).toBe("");
  });
});
