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
  gutterLineClass,
} from "@codemirror/view";
import {
  EditorState,
  Facet,
  Prec,
  Range,
  RangeSet,
  type Extension,
} from "@codemirror/state";
import {
  indentOnInput,
  syntaxHighlighting,
  codeFolding,
  foldKeymap,
  syntaxTree,
  ensureSyntaxTree,
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
import { parseMixed, type SyntaxNodeRef } from "@lezer/common";
import { getCodeParser, languages } from "../extensions/languages";
import { beanCountLinter } from "./linter";
import { beancountCompletion } from "./autocomplete";
import { comboWidget } from "../extensions/combobox/combo";
import { search } from "../extensions/search/search";
import { datePicker } from "../extensions/datepicker/datepicker";
import { showGotoLine } from "../extensions/gotoline";
import type { LedgerSource } from "../../core/ledger";
import { readString, writeString } from "@beancount-js/parser";
import {
  beanCount,
  parser as beancountParser,
} from "@beancount-js/codemirror-lang-beancount";
import { GutterMarker } from "@codemirror/view";
import { LRLanguage } from "@codemirror/language";
export interface Ledgerconfig {
  source: LedgerSource;
}

export const ledgerFacet: Facet<
  Ledgerconfig,
  Required<Ledgerconfig>
> = Facet.define();

export const ledgerSetup = (source: () => LedgerSource): Extension => {
  return [
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

class HeaderMarker extends GutterMarker {
  constructor(readonly elementClass: string = "cm-gutterHeader") {
    super();
  }
}

const headerGutter = gutterLineClass.compute(["doc"], (state) => {
  const marks: Range<GutterMarker>[] = [];
  for (let i = 1; i < state.doc.lines; i++) {
    const line = state.doc.line(i);
    const match = /^(#+|\*+)/gi.exec(line.text);
    if (match) {
      marks.push(
        new HeaderMarker(
          `cm-gutterHeader cm-gutterHeader-${match[1].length}`,
        ).range(line.from),
      );
    }
  }
  return RangeSet.of(marks);
});

const mixedBeancountParser = beancountParser.configure({
  wrap: parseMixed((node, input) => {
    if (node.name === "CodeBlock") {
      var contents = input.read(node.from, node.to);
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
    } else if (node.name === "Query") {
      const parser = getCodeParser(languages)("bql");
      if (parser) {
        return {
          parser,
          overlay: (node) => {
            if (
              node.name === "String" &&
              node.node.prevSibling?.name === "String" &&
              node.to - node.from > 0
            ) {
              return { from: node.from + 1, to: node.to - 1 };
            }
            return false;
          },
        };
      }
    } else if (["Custom", "Plugin"].includes(node.name)) {
      const parser = getCodeParser(languages)("yml");
      if (parser) {
        return {
          parser,
          overlay: (node) => {
            if (node.name === "String" && node.to - node.from > 0) {
              return { from: node.from + 1, to: node.to - 1 };
            }
            return false;
          },
        };
      }
    }
    return null;
  }),
});

const mixedBeancountLanguage = LRLanguage.define({
  parser: mixedBeancountParser,
});

export const basicSetup: Extension = (() => [
  mixedBeancountLanguage,
  beanCountLinter(),
  closeBrackets(),
  headerGutter,
  lineNumbers({}),
  history(),
  lintGutter(),
  clickableUrls(),
  foldHeaders(),
  drawSelection(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  EditorView.lineWrapping,
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  EditorView.editable.of(true),
  codeFolding(),
  foldGutter(),
  search(),
  foldHeaders(),
  foldComments(),
  hashTags(),
  rulerPlugin(),
  decorateHeaders(),
  mathExpressions(),
  datePicker(),
  syntaxHighlighting(classHighlighter),
  EditorView.editorAttributes.of({ class: "mod-cm6 beancount-editor" }),
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
