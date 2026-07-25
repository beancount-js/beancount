<svelte:options runes={false} />

<script lang="ts">
  import { EditorView } from "@codemirror/view";
  import { unfoldAll } from "@codemirror/language";
  import { onDestroy, onMount } from "svelte";
  import { formatLedger } from "../codemirror/beancount/format";
  import { basicSetup, ledgerSetup } from "../codemirror/beancount/setup";
  import { toggleComment } from "@codemirror/commands";
  import {
    areAllHeadersCollapsed,
    collapseHeaders,
    collapseHeadersExceptLast,
    expandHeaders,
  } from "../codemirror/beancount/foldHeaders";
  import { foldMetadata } from "../codemirror/beancount/foldMetadata";
  import { foldAll } from "../codemirror/extensions/foldAll";
  import { showGotoLine } from "../codemirror/extensions/gotoline";
  import Editor from "@lapis/ui/pages/Editor.svelte";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import type { IngestionReviewLedgerSnapshot } from "../ingestion/types";

  const {
    router: { activeRoute },
  } = useNavigation();
  const { ledgerSource } = useContext();
  const {
    snapshot,
    activeFile: workspaceActiveFile,
    reviewLedger,
    saveFile,
    requestInlineAi,
  } = useStudioWorkspace();

  type EditorHandle = {
    areAllHeadersCollapsed: () => boolean;
    collapseHeaders: () => void;
    expandHeaders: () => void;
    foldAll: () => void;
    format: () => void;
    openGotoLine: () => void;
    askAi: () => void;
    save: () => Promise<void> | void;
    showSearchPanel: () => void;
    toggleComment: () => void;
    unfoldAll: () => void;
    findNextMatch: () => void;
    findPreviousMatch: () => void;
  };

  let formatOnSave = true;
  let editor: EditorHandle | undefined;
  let reviewHeadersCollapsedAll = false;
  let ledgerHeadersCollapsedAll = false;
  let dirty = false;
  let editorExtensions = [basicSetup, ledgerSetup(() => $ledgerSource)];
  let source = {
    path: "",
    contents: "",
    readOnly: false,
  };
  let reviewFile: IngestionReviewLedgerSnapshot | null = null;
  let activeFile: { path: string; contents: string } | undefined;
  let readOnly = false;

  // The virtual review file arrives alongside route state during a hard reload.
  // Its path is the authoritative identity here; waiting for the separately
  // derived ledger kind can briefly replace the editor document with nothing.
  $: reviewFile =
    $reviewLedger?.path === $workspaceActiveFile ? $reviewLedger : null;
  $: activeFile =
    reviewFile ??
    $snapshot?.ledgerFiles.find((file) => file.path === $workspaceActiveFile);
  $: readOnly = Boolean(reviewFile);

  $: source = {
    path: activeFile?.path ?? "",
    contents: activeFile?.contents ?? "",
    readOnly,
  };

  function handleFoldMetadata(view: EditorView) {
    if (readOnly) {
      foldMetadata(view);
      reviewHeadersCollapsedAll = false;
      return;
    }
    ledgerHeadersCollapsedAll = false;
  }

  function handleCollapseHeadersExceptLast(view: EditorView) {
    if (readOnly) {
      collapseHeadersExceptLast(view);
      reviewHeadersCollapsedAll = false;
    }
  }

  function handleShowSearch() {
    editor?.showSearchPanel();
  }

  function handleSaveLedger() {
    void editor?.save();
  }

  function handleSave(contents: string) {
    if (readOnly || !$snapshot || !$workspaceActiveFile) return;
    return saveFile($workspaceActiveFile, contents);
  }

  function handleAskAi(payload: {
    path: string;
    text: string;
    fromLine: number;
    toLine: number;
  }) {
    requestInlineAi(payload);
  }

  function refreshHeaderActions() {
    if (readOnly) {
      ingestionHeaderActions.set({
        kind: "review-ledger",
        headersCollapsedAll: reviewHeadersCollapsedAll,
        onToggleHeaders: () => {
          if (!editor) return;
          if (editor.areAllHeadersCollapsed()) {
            editor.expandHeaders();
            reviewHeadersCollapsedAll = false;
          } else {
            editor.collapseHeaders();
            reviewHeadersCollapsedAll = true;
          }
        },
      });
      return;
    }

    ingestionHeaderActions.set({
      kind: "ledger",
      formatOnSave,
      headersCollapsedAll: ledgerHeadersCollapsedAll,
      sources: ($snapshot?.ledgerFiles ?? []).map((file) => ({
        path: file.path,
      })),
      activePath: $workspaceActiveFile ?? "",
      dirty,
      onOpenSource: (path) => workspaceActiveFile.set(path),
      onToggleFormatOnSave: () => {
        formatOnSave = !formatOnSave;
      },
      onToggleHeaders: () => {
        if (!editor) return;
        if (editor.areAllHeadersCollapsed()) {
          editor.expandHeaders();
          ledgerHeadersCollapsedAll = false;
        } else {
          editor.collapseHeaders();
          ledgerHeadersCollapsedAll = true;
        }
      },
      onGotoLine: () => {
        editor?.openGotoLine();
      },
      onFormat: () => {
        editor?.format();
      },
      onToggleComment: () => {
        editor?.toggleComment();
      },
      onUnfoldAll: () => {
        editor?.unfoldAll();
      },
      onFoldAll: () => {
        editor?.foldAll();
      },
      onFind: () => {
        editor?.showSearchPanel();
      },
      onFindNext: () => {
        editor?.findNextMatch();
      },
      onFindPrevious: () => {
        editor?.findPreviousMatch();
      },
      onAskAi: () => {
        editor?.askAi();
      },
      onSave: () => {
        void editor?.save();
      },
    });
  }

  $: {
    refreshHeaderActions();
  }

  $: editorExtensions = [basicSetup, ledgerSetup(() => $ledgerSource)];

  onMount(function () {
    document.addEventListener("showSearch", handleShowSearch);
    document.addEventListener("saveLedger", handleSaveLedger);
    return () => {
      document.removeEventListener("showSearch", handleShowSearch);
      document.removeEventListener("saveLedger", handleSaveLedger);
    };
  });

  onDestroy(() => {
    ingestionHeaderActions.set(null);
  });
</script>

<div class="cn-beta-components-editor-218-1">
  <div class="cn-beta-components-editor-219-1 editor-scroll-host">
    <div class="cn-beta-components-editor-220-1 beancount-editor">
      <Editor
        bind:this={editor}
        {source}
        line={$activeRoute.query["line"] ?? ""}
        {formatOnSave}
        {editorExtensions}
        onSave={handleSave}
        onDirtyChange={(nextDirty) => {
          dirty = nextDirty;
        }}
        onAskAi={handleAskAi}
        onFormat={formatLedger}
        onFoldMetadata={handleFoldMetadata}
        onCollapseHeaders={collapseHeaders}
        onExpandHeaders={expandHeaders}
        onAreAllHeadersCollapsed={areAllHeadersCollapsed}
        onCollapseHeadersExceptLast={handleCollapseHeadersExceptLast}
        onUnfoldAll={unfoldAll}
        onFoldAll={foldAll}
        onShowGotoLine={(view) => showGotoLine(view)}
        onToggleComment={toggleComment}
      />
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
