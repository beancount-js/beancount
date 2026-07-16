<svelte:options runes={false} />

<script lang="ts">
  import { EditorView, keymap } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { unfoldAll } from "@codemirror/language";
  import { openSearchPanel } from "@codemirror/search";
  import { onDestroy, onMount } from "svelte";
  import { toggleComment } from "@codemirror/commands";
  import { findNext, findPrevious } from "@codemirror/search";
  import { basicSetup, ledgerSetup } from "../codemirror/beancount/setup";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import { formatLedger } from "../codemirror/beancount/format";
  import { foldAll } from "../codemirror/extensions/foldAll";
  import { goToLine, showGotoLine } from "../codemirror/extensions/gotoline";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import ContentScrollArea from "./ContentScrollArea.svelte";

  const {
    router: { activeRoute },
  } = useNavigation();
  const { ledgerSource } = useContext();
  const {
    snapshot,
    activeFile: workspaceActiveFile,
    saveFile,
    requestInlineAi,
  } = useStudioWorkspace();

  let formatOnSave = true;
  let editor: EditorView;
  let line = "";
  let dirty = false;
  let replacingContents = false;
  let loadedPath = "";

  const codeMirror = (
    node: HTMLDivElement,
    source: { path: string; contents: string },
  ) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: source.contents,
        extensions: [
          basicSetup,
          ledgerSetup(() => $ledgerSource),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !replacingContents) dirty = true;
          }),
          keymap.of([
            {
              key: "Ctrl-s",
              mac: "Mod-s",
              run: () => {
                handleSave();
                return true;
              },
            },
          ]),
        ],
      }),
      parent: node,
    });
    loadedPath = source.path;
    dirty = false;

    if (line) {
      goToLine(editor, line);
    }
    return {
      update(next: { path: string; contents: string }) {
        const nextPath = next.path;
        // Do not let the filesystem polling loop overwrite an unsaved edit.
        // A deliberate source-file switch always loads that source instead.
        if (
          loadedPath !== nextPath ||
          (!dirty && editor.state.doc.toString() !== next.contents)
        ) {
          replacingContents = true;
          editor.dispatch({
            ...replaceContents(editor.state, next.contents),
          });
          replacingContents = false;
          loadedPath = nextPath;
          dirty = false;
        }
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
    if (el) {
      const text = editor.state.sliceDoc(
        editor.state.selection.main.from,
        editor.state.selection.main.to,
      );
      if (text) {
        el.value = text;
        el.select();
      }
      el.blur();
      el.focus();
    }
  }

  $: if (
    editor &&
    $activeRoute.query["line"] &&
    line !== $activeRoute.query["line"]
  ) {
    line = $activeRoute.query["line"];
    goToLine(editor, line);
  }

  async function handleSave() {
    if (!editor) return;
    if (formatOnSave) {
      formatLedger(editor);
    }
    if (!$snapshot || !$workspaceActiveFile) return;
    await saveFile($workspaceActiveFile, editor.state.doc.toString());
    dirty = false;
  }

  function askAiAboutSelection() {
    if (!editor || !$workspaceActiveFile) return;
    const selection = editor.state.selection.main;
    const text = editor.state.sliceDoc(selection.from, selection.to).trim();
    const fromLine = editor.state.doc.lineAt(selection.from).number;
    const toLine = editor.state.doc.lineAt(selection.to).number;
    requestInlineAi({
      path: $workspaceActiveFile,
      text: text.slice(0, 4_000),
      fromLine,
      toLine,
    });
  }

  $: activeFile = $snapshot?.ledgerFiles.find(
    (file) => file.path === $workspaceActiveFile,
  );

  $: {
    ingestionHeaderActions.set({
      kind: "ledger",
      formatOnSave,
      sources: ($snapshot?.ledgerFiles ?? []).map((file) => ({
        path: file.path,
      })),
      activePath: $workspaceActiveFile ?? "",
      dirty,
      onOpenSource: (path) => workspaceActiveFile.set(path),
      onToggleFormatOnSave: () => {
        formatOnSave = !formatOnSave;
      },
      onGotoLine: () => {
        if (editor) showGotoLine(editor);
      },
      onFormat: () => {
        if (editor) formatLedger(editor);
      },
      onToggleComment: () => {
        if (editor) toggleComment(editor);
      },
      onUnfoldAll: () => {
        if (editor) unfoldAll(editor);
      },
      onFoldAll: () => {
        if (editor) foldAll(editor);
      },
      onFind: () => showSearch(),
      onFindNext: () => {
        if (editor) findNext(editor);
      },
      onFindPrevious: () => {
        if (editor) findPrevious(editor);
      },
      onAskAi: () => askAiAboutSelection(),
      onSave: () => {
        void handleSave();
      },
    });
  }

  onDestroy(() => ingestionHeaderActions.set(null));

  onMount(function () {
    document.addEventListener("showSearch", showSearch);
    document.addEventListener("saveLedger", handleSave);
    return () => {
      document.removeEventListener("showSearch", showSearch);
      document.removeEventListener("saveLedger", handleSave);
    };
  });
</script>

<div class="flex h-full min-h-0 flex-col">
  <ContentScrollArea
    class="min-h-0 flex-1"
    contentClass="scroll-container pt-0"
  >
    <div class="beancount-editor relative">
      <div
        use:codeMirror={{
          path: activeFile?.path ?? "",
          contents: activeFile?.contents ?? "",
        }}
      ></div>
    </div>
  </ContentScrollArea>
</div>
