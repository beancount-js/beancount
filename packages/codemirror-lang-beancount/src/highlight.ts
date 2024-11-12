import { styleTags, tags as t } from "@lezer/highlight";

export const beancountHighlighting = styleTags({
  TEXT: t.annotation,
  "MetaName PUSHTAG POPTAG BALANCE PAD NOTE OPEN CLOSE DOCUMENT OPTION PLUGIN":
    t.keyword,
  Date: t.variableName,
  Number: t.number,
  "Flag AT ATAT TILDE": t.operator,
  AccountName: t.propertyName,
  String: t.string,
  Comment: t.lineComment,
  Tag: t.tagName,
  Link: t.link,
  Bool: t.atom,
  Currency: t.keyword,
  CodeBlock: t.blockComment,
  "Narration/String": t.comment,
});
