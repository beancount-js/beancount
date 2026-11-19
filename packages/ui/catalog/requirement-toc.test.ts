import { expect, it } from "vitest";
import { requirementTocLabel } from "../.storybook/requirement-toc";

it("labels a Beancount requirement heading with its id", () => {
  expect(requirementTocLabel("BC-LANG-001 — Upstream baseline")).toBe(
    "BC-LANG-001",
  );
  expect(requirementTocLabel(" BC-APP-004 — Structured forms ")).toBe(
    "BC-APP-004",
  );
});

it("leaves a non-requirement heading unchanged", () => {
  expect(requirementTocLabel("Acceptance details")).toBe("Acceptance details");
  expect(requirementTocLabel("DC-SHELL-001 — Another product")).toBe(
    "DC-SHELL-001 — Another product",
  );
});
