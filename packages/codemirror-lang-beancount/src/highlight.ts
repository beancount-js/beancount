import { styleTags, tags as t } from "@lezer/highlight";

export const beancountHighlighting = styleTags({
  TEXT: t.annotation,
  "Identifier PUSHTAG POPTAG BALANCE PAD NOTE OPEN CLOSE DOCUMENT OPTION PLUGIN QUERY CUSTOM":
    t.keyword,
  Date: t.variableName,
  Number: t.number,
  "Flag AT ATAT TILDE": t.operator,
  "AccountName AttributeName": t.propertyName,
  String: t.string,
  "Comment DocumentMarkup": t.lineComment,
  Tag: t.tagName,
  Link: t.link,
  Bool: t.atom,
  Currency: t.keyword,
  CodeBlock: t.blockComment,
  "Narration/String": t.comment,
});
