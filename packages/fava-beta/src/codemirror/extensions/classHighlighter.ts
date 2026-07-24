import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const classHighlighter = HighlightStyle.define([
  { tag: [tags.comment, tags.meta], color: "var(--code-comment)" },
  { tag: [tags.keyword, tags.atom, tags.bool], color: "var(--code-keyword)" },
  {
    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
    color: "var(--code-string)",
  },
  { tag: tags.string, color: "var(--code-string)" },
  { tag: tags.number, color: "var(--code-value)" },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName), tags.typeName],
    color: "var(--code-function)",
  },
  {
    tag: [
      tags.link,
      tags.variableName,
      tags.local(tags.variableName),
      tags.special(tags.variableName),
      tags.definition(tags.variableName),
    ],
    color: "var(--code-property)",
  },
  { tag: tags.operator, color: "var(--code-operator)" },
  { tag: tags.punctuation, color: "var(--code-punctuation)" },
  { tag: tags.invalid, color: "var(--destructive)" },
]);
