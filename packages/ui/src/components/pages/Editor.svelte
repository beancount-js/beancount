<script lang="ts">
  import { EditorView, keymap } from "@codemirror/view";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import { findNext, findPrevious, openSearchPanel } from "@codemirror/search";
  import { toggleComment as toggleCommentCommand } from "@codemirror/commands";
  import { onDestroy } from "svelte";

  type EditorSource = {
    path: string;
    contents: string;
    readOnly: boolean;
  };

  type AskAiPayload = {
    path: string;
    text: string;
    fromLine: number;
    toLine: number;
  };

  type Props = {
    source: EditorSource;
    line?: string;
    formatOnSave?: boolean;
    editorExtensions?: readonly Extension[];
    onSave?: (contents: string) => Promise<void> | void;
    onDirtyChange?: (dirty: boolean) => void;
    onAskAi?: (payload: AskAiPayload) => void;
    onFormat?: (view: EditorView) => void;
    onFoldMetadata?: (view: EditorView) => void | Promise<void>;
    onCollapseHeaders?: (view: EditorView) => void;
    onExpandHeaders?: (view: EditorView) => void;
    onAreAllHeadersCollapsed?: (state: EditorState) => boolean;
    onCollapseHeadersExceptLast?: (view: EditorView) => void;
    onUnfoldAll?: (view: EditorView) => void;
    onFoldAll?: (view: EditorView) => void;
    onShowGotoLine?: (view: EditorView) => void;
    onToggleComment?: (view: EditorView) => void;
  };

  let {
    source,
    line = "",
    formatOnSave = true,
    editorExtensions = [],
    onSave = () => {},
    onDirtyChange = () => {},
    onAskAi = () => {},
    onFormat = () => {},
    onFoldMetadata,
    onCollapseHeaders,
    onExpandHeaders,
    onAreAllHeadersCollapsed,
    onCollapseHeadersExceptLast,
    onUnfoldAll,
    onFoldAll,
    onShowGotoLine,
    onToggleComment = toggleCommentCommand,
  }: Props = $props();

  let editor: EditorView | undefined;
  let replacingContents = false;
  let loadedPath = "";
  let dirty = false;
  let lastJumpLine = "";

  function editorMode(readOnly: boolean) {
    return readOnly
      ? [EditorState.readOnly.of(true), EditorView.editable.of(false)]
      : [EditorState.readOnly.of(false), EditorView.editable.of(true)];
  }

  function replaceEditorContents(nextContents: string) {
    if (!editor) return;
    replacingContents = true;
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: nextContents,
      },
    });
    replacingContents = false;
  }

  function goToLine(nextLine: string, nextEditor = editor) {
    if (!nextEditor) return;
    const rawLine = Number.parseInt(nextLine.trim(), 10);
    if (!Number.isFinite(rawLine)) return;
    const maxLine = nextEditor.state.doc.lines;
    const lineNo = Math.max(1, Math.min(rawLine, maxLine));
    const targetLine = nextEditor.state.doc.line(lineNo);
    nextEditor.dispatch({
      selection: { anchor: targetLine.from, head: targetLine.from },
      scrollIntoView: true,
    });
    nextEditor.focus();
  }

  function formatReviewContents(view: EditorView, readOnly: boolean) {
    if (!readOnly || !onFormat) return;
    replacingContents = true;
    onFormat(view);
    replacingContents = false;
  }

  function askAiAboutSelection(currentEditor = editor) {
    if (!currentEditor || !onAskAi) return;
    const selection = currentEditor.state.selection.main;
    const text = currentEditor.state
      .sliceDoc(selection.from, selection.to)
      .trim();
    const fromLine = currentEditor.state.doc.lineAt(selection.from).number;
    const toLine = currentEditor.state.doc.lineAt(selection.to).number;
    onAskAi({
      path: source.path,
      text: text.slice(0, 4_000),
      fromLine,
      toLine,
    });
  }

  const codeMirror = (node: HTMLDivElement, initialSource: EditorSource) => {
    const mode = new Compartment();
    const view = new EditorView({
      state: EditorState.create({
        doc: initialSource.contents,
        extensions: [
          ...editorExtensions,
          mode.of(editorMode(initialSource.readOnly)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || replacingContents) return;
            dirty = true;
            onDirtyChange(true);
          }),
          keymap.of([
            {
              key: "Ctrl-s",
              mac: "Mod-s",
              run: () => {
                save();
                return true;
              },
            },
          ]),
        ],
      }),
      parent: node,
    });

    editor = view;
    loadedPath = initialSource.path;
    dirty = false;
    onDirtyChange(false);
    formatReviewContents(view, initialSource.readOnly);
    if (line) {
      goToLine(line, view);
      lastJumpLine = line;
    }
    if (initialSource.readOnly && onFoldMetadata) {
      onFoldMetadata(view);
    }

    return {
      update(next: EditorSource) {
        const nextPath = next.path;
        const contentsChanged =
          loadedPath !== nextPath ||
          (!dirty && view.state.doc.toString() !== next.contents);
        if (contentsChanged) {
          replaceEditorContents(next.contents);
          loadedPath = nextPath;
          dirty = false;
          onDirtyChange(false);
          if (next.readOnly && onFoldMetadata) {
            onFoldMetadata(view);
          }
          if (next.readOnly && onCollapseHeadersExceptLast) {
            onCollapseHeadersExceptLast(view);
          }
        }

        const readOnlyChanged = initialSource.readOnly !== next.readOnly;
        if (readOnlyChanged) {
          view.dispatch({
            effects: mode.reconfigure(editorMode(next.readOnly)),
          });
        }

        if (next.readOnly && (contentsChanged || readOnlyChanged)) {
          formatReviewContents(view, next.readOnly);
        }
        if (line && line !== lastJumpLine) {
          goToLine(line, view);
          lastJumpLine = line;
        }

        initialSource = next;
      },
      destroy() {},
    };
  };

  function showSearch() {
    if (!editor) return;
    openSearchPanel(editor);
    const el = document.querySelector<HTMLInputElement>(
      "input.document-search-input",
    );
    if (!el) return;
    const selectionText = editor.state.sliceDoc(
      editor.state.selection.main.from,
      editor.state.selection.main.to,
    );
    if (selectionText) {
      el.value = selectionText;
      el.select();
    }
    el.blur();
    el.focus();
  }

  export function areAllHeadersCollapsed() {
    if (!editor || !onAreAllHeadersCollapsed) return false;
    return onAreAllHeadersCollapsed(editor.state);
  }

  export function collapseHeaders() {
    if (!editor || !onCollapseHeaders) return;
    onCollapseHeaders(editor);
  }

  export function expandHeaders() {
    if (!editor || !onExpandHeaders) return;
    onExpandHeaders(editor);
  }

  export function format() {
    if (!editor || !onFormat) return;
    onFormat(editor);
  }

  export function askAi() {
    askAiAboutSelection();
  }

  export function gotoLine(nextLine = line) {
    if (!nextLine) return;
    goToLine(nextLine);
  }

  export function openGotoLine() {
    if (!editor) return;
    if (onShowGotoLine) {
      onShowGotoLine(editor);
      return;
    }
    showSearch();
  }

  export function findNextMatch() {
    if (!editor) return;
    findNext(editor);
  }

  export function findPreviousMatch() {
    if (!editor) return;
    findPrevious(editor);
  }

  export function showSearchPanel() {
    showSearch();
  }

  export function unfoldAll() {
    if (!editor || !onUnfoldAll) return;
    onUnfoldAll(editor);
  }

  export function foldAll() {
    if (!editor || !onFoldAll) return;
    onFoldAll(editor);
  }

  export function toggleComment() {
    if (!editor || !onToggleComment) return;
    onToggleComment(editor);
  }

  export async function save() {
    if (!editor || source.readOnly) return;
    if (formatOnSave) {
      format();
    }
    const nextContents = editor.state.doc.toString();
    await onSave(nextContents);
    dirty = false;
    onDirtyChange(false);
  }

  onDestroy(() => {
    editor?.destroy();
    editor = undefined;
    dirty = false;
    onDirtyChange(false);
  });

  $effect(() => {
    if (editor && line && line !== lastJumpLine) {
      goToLine(line, editor);
      lastJumpLine = line;
    }
  });
</script>

<div class="flex h-full min-h-0 flex-col">
  <div class="editor-scroll-host min-h-0 flex-1 overflow-hidden">
    <div class="beancount-editor relative">
      <div use:codeMirror={source} class="h-full"></div>
    </div>
  </div>
</div>

<style>
  .editor-scroll-host,
  .editor-scroll-host .beancount-editor,
  .editor-scroll-host :global(.cm-editor) {
    height: 100%;
  }
</style>
