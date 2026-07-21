import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { describe, expect, test } from "vitest";
import {
  searchFilterCompletion,
  type SearchFilterSyntax,
} from "./search-filter-syntax";

const syntax: SearchFilterSyntax = {
  fields: [
    {
      name: "confidence",
      description: "Best candidate score.",
      operators: [">", ">=", "<", "<=", "=", "!="],
    },
    {
      name: "status",
      description: "Resolution state.",
      operators: [":", "=", "!="],
      values: ["confirmed", "suggested", "unresolved", "Confirmed"],
    },
  ],
};

async function labelsFor(query: string) {
  const state = EditorState.create({ doc: query });
  const source = searchFilterCompletion(syntax);
  const result = await source(new CompletionContext(state, query.length, true));
  return result?.options.map((option) => option.label) ?? [];
}

describe("search filter syntax completion", () => {
  test("suggests canonical fields from a field prefix", async () => {
    await expect(labelsFor("conf")).resolves.toEqual(["confidence", "status"]);
  });

  test("suggests only the selected field's operators", async () => {
    await expect(labelsFor("confidence ")).resolves.toEqual([
      ">",
      ">=",
      "<",
      "<=",
      "=",
      "!=",
    ]);
  });

  test("suggests deduplicated known values after an operator", async () => {
    await expect(labelsFor("status: con")).resolves.toEqual([
      "confirmed",
      "suggested",
      "unresolved",
    ]);
  });

  test("does not offer arbitrary value suggestions for unknown free text", async () => {
    await expect(labelsFor("groceries")).resolves.toEqual([]);
  });
});
