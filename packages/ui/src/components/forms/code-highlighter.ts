import { tagHighlighter, tags } from "@lezer/highlight";

/**
 * Read-only syntax classes for {@link CodeHighlighter}. Unlike the CodeMirror
 * editor theme, these class names are deliberately stable so the rendered
 * source can use the shared syntax-token palette without a live editor view.
 */
export const codeHighlighter = tagHighlighter([
  { tag: [tags.comment, tags.meta], class: "beancount-code-comment" },
  {
    tag: [tags.keyword, tags.atom, tags.bool],
    class: "beancount-code-keyword",
  },
  {
    tag: [tags.string, tags.regexp, tags.escape, tags.special(tags.string)],
    class: "beancount-code-string",
  },
  { tag: tags.number, class: "beancount-code-value" },
  {
    tag: [tags.propertyName, tags.definition(tags.propertyName), tags.typeName],
    class: "beancount-code-function",
  },
  {
    tag: [
      tags.link,
      tags.variableName,
      tags.local(tags.variableName),
      tags.special(tags.variableName),
      tags.definition(tags.variableName),
    ],
    class: "beancount-code-property",
  },
  { tag: tags.operator, class: "beancount-code-operator" },
  { tag: tags.punctuation, class: "beancount-code-punctuation" },
  { tag: tags.invalid, class: "beancount-code-invalid" },
]);
