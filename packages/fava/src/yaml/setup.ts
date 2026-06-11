import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  completionKeymap,
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import {
  drawSelection,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  EditorView,
  highlightActiveLine,
} from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import {
  indentOnInput,
  syntaxHighlighting,
  codeFolding,
  foldKeymap,
  LRLanguage,
  LanguageSupport,
} from "@codemirror/language";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentMore,
  toggleComment,
} from "@codemirror/commands";
import { lintGutter } from "@codemirror/lint";
import { yaml } from "@codemirror/lang-yaml";
import { numbers } from "./numbers";
import { foldGutter } from "../codemirror/extensions/foldGutter";
import { classHighlighter } from "../codemirror/extensions/classHighlighter";
import { clickableUrls } from "../codemirror/extensions/urls";
import { search } from "../codemirror/extensions/search/search";
import { parseMixed } from "@lezer/common";
import { rawParser as parser } from "@beancount-js/codemirror-lang-beancount";
import { datePicker } from "../codemirror/extensions/datepicker/datepicker";
import { mathExpressions } from "../codemirror/beancount/math";
import { zodLinter } from "./lint";
import { importFile } from "../import/schema";
export const baseSetup: Extension = (() => [
  closeBrackets(),
  lineNumbers(),
  history(),
  lintGutter(),
  clickableUrls(),
  search(),
  drawSelection(),
  numbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  EditorView.editable.of(true),
  codeFolding(),
  foldGutter(),
  syntaxHighlighting(classHighlighter),
  EditorView.editorAttributes.of({ class: "mod-cm6 editor-ledger-cli" }),
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

export const basicSetup: Extension = (() => [
  yaml(),
  EditorView.lineWrapping,
  baseSetup,
])();

const language = yaml().language as LRLanguage;
export const importEditor: Extension = (() => [
  datePicker(),
  mathExpressions(),
  zodLinter(importFile.strict()),
  new LanguageSupport(
    language.configure({
      wrap: parseMixed((node, input) => {
        const key = node.node.prevSibling?.prevSibling;
        if (
          node.name === "BlockLiteral" &&
          key?.name === "Key" &&
          input.read(key.from, key.to) === "source"
        ) {
          return { parser };
        }
        return null;
      }),
    }),
  ),
  baseSetup,
])();
