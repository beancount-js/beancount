import { styleTags, tags as t } from "@lezer/highlight";

export const treeHighlighting = styleTags({
  TEXT: t.annotation,
  NodeName: t.keyword,
  Date: t.variableName,
  Number: t.number,
  Flag: t.operator,
  AccountName: t.propertyName,
  String: t.string,
  TREE: t.lineComment,
  Tag: t.tagName,
  "Range/Position/Number": t.link,
  Bool: t.atom,
  Currency: t.keyword,
  "Narration/String": t.comment,
});
