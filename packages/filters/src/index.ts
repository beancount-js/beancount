import { parser } from "./query.grammar";
import { LRLanguage, LanguageSupport } from "@codemirror/language";
export { filterHighlighting } from "./highlight";
export * from "./filters";
export * from "./parser";
export { parser as filterQueryParser } from "./query.grammar";

export const beancountFilterLanguage = LRLanguage.define({
  name: "beancountFilter",
  parser: parser,
});

export function beancountFilter() {
  return new LanguageSupport(beancountFilterLanguage);
}
