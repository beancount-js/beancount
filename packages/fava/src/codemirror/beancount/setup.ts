import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
  autocompletion,
} from "@codemirror/autocomplete";
import {
  drawSelection,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  EditorView,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, Facet, Prec, type Extension } from "@codemirror/state";
import {
  indentOnInput,
  syntaxHighlighting,
  codeFolding,
  foldKeymap,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  toggleComment,
} from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { foldGutter } from "../extensions/foldGutter";
import { classHighlighter } from "../extensions/classHighlighter";
import { clickableUrls } from "../extensions/urls";
import { foldHeaders } from "./foldHeaders";
import { rulerPlugin } from "./ruler";
import { decorateHeaders } from "./headers";
import { mathExpressions } from "./math";
import { foldComments } from "./foldComments";
import { hashTags } from "../extensions/hashTags";
import { parseMixed } from "@lezer/common";
import { getCodeParser, languages } from "../extensions/languages";
import { beanCountLinter } from "./linter";
import { beancountCompletion } from "./autocomplete";
import { comboWidget } from "../extensions/combobox/combo";
import { search } from "../extensions/search/search";
import { datePicker } from "../extensions/datepicker/datepicker";
import { showGotoLine } from "../extensions/gotoline";
import type { LedgerSource } from "../../core/ledger";
import { readString, writeString } from "@beancount-js/parser";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";

export interface Ledgerconfig {
  source: LedgerSource;
}
export const ledgerFacet: Facet<
  Ledgerconfig,
  Required<Ledgerconfig>
> = Facet.define();

export const ledgerSetup = (source: () => LedgerSource): Extension => {
  return [
    beanCountLinter(source),
    autocompletion({
      override: [beancountCompletion(source)],
    }),
    comboWidget({
      match: (node) => {
        return ["AccountName", "Currency", "Tag", "Link"].includes(node.name);
      },
      data: (state) => {
        switch (state.nodeName) {
          case "AccountName":
            return source()
              .data.accounts.filter((it) => it && it.trim().length > 0)
              .map((it) => ({ label: it, value: it }));
          case "Currency":
            return source().data.currencies.map((it) => ({
              label: it,
              value: it,
            }));
          case "Tag":
            return source().data.tags.map((it) => ({
              label: it,
              value: "#" + it,
            }));
          case "Link":
            return source().data.links.map((it) => ({
              label: it,
              value: "^" + it,
            }));
        }
        return [];
      },
    }),
    comboWidget({
      match: (node) =>
        node.name === "String" &&
        node.node.parent?.name === "Transaction" &&
        ["Flag", "Date"].includes(node.node.prevSibling?.name || ""),
      data: () => source().data.payees.map((it) => ({ label: it, value: it })),
      read: readString,
      write: writeString,
    }),
  ];
};

export const basicSetup: Extension = (() => [
  closeBrackets(),
  lineNumbers(),
  history(),
  lintGutter(),
  clickableUrls(),
  foldHeaders(),
  drawSelection(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  EditorView.editable.of(true),
  codeFolding(),
  foldGutter(),
  search(),
  foldHeaders(),
  foldComments(),
  hashTags(),
  beanCount({
    wrap: parseMixed((node, input) => {
      if (node.name === "CodeBlock") {
        const contents = input.read(node.from, node.to);
        const matches = contents.match(/^([`]+)([a-z][a-zA-Z0-9_-]*)?/);
        if (!matches || !matches[2]) {
          return null;
        }
        const parser = getCodeParser(languages)(matches[2]);
        if (parser) {
          const overlay = [
            {
              from: node.from + matches[0].length,
              to: node.to - matches[1].length,
            },
          ];
          return { parser, overlay };
        }
      }
      return null;
    }),
  }),
  rulerPlugin(),
  decorateHeaders(),
  mathExpressions(),
  datePicker(),
  syntaxHighlighting(classHighlighter),
  EditorView.editorAttributes.of({ class: "mod-cm6 editor-ledger-cli" }),
  Prec.highest(
    keymap.of([
      {
        key: "Mod-Alt-g",
        preventDefault: true,
        run: showGotoLine,
      },
    ]),
  ),
  keymap.of([
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...closeBracketsKeymap,
    {
      key: "Tab",
      preventDefault: true,
      run: indentMore,
    },
    {
      key: "Shift-Tab",
      preventDefault: true,
      run: toggleComment,
    },
  ]),
])();
