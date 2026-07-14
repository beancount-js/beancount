<script lang="ts">
  import { EditorView, keymap } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { Button } from "$lib/components/ui/button";
  import FoldVertical from "lucide-svelte/icons/fold-vertical";
  import UnfoldVertical from "lucide-svelte/icons/unfold-vertical";
  import Save from "lucide-svelte/icons/save";
  import { unfoldAll } from "@codemirror/language";
  import { openSearchPanel } from "@codemirror/search";
  import { onMount } from "svelte";
  import * as Menubar from "$lib/components/ui/menubar";
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
  import Sparkles from "lucide-svelte/icons/sparkles";
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
  <div class="shrink-0 pr-4">
    <div class="flex justify-between">
      <div class="pb-2 pl-2">
        <Menubar.Root>
          <Menubar.Menu>
            <Menubar.Trigger>File</Menubar.Trigger>
            <Menubar.Content>
              <Menubar.Sub>
                <Menubar.SubTrigger class="pl-8">Open source</Menubar.SubTrigger
                >
                <Menubar.SubContent>
                  {#each $snapshot?.ledgerFiles ?? [] as file (file.path)}
                    <Menubar.CheckboxItem
                      checked={file.path === $workspaceActiveFile}
                      on:click={() => workspaceActiveFile.set(file.path)}
                      >{file.path}</Menubar.CheckboxItem
                    >
                  {/each}
                </Menubar.SubContent>
              </Menubar.Sub>
              <Menubar.CheckboxItem
                bind:checked={formatOnSave}
                on:click={() => (formatOnSave = !formatOnSave)}
              >
                Format on Save
              </Menubar.CheckboxItem>
              <Menubar.Item inset on:click={() => showGotoLine(editor)}
                >Go To Line</Menubar.Item
              >
            </Menubar.Content>
          </Menubar.Menu>
          <Menubar.Menu>
            <Menubar.Trigger>Edit</Menubar.Trigger>
            <Menubar.Content>
              <Menubar.Item inset on:click={() => formatLedger(editor)}>
                Format <Menubar.Shortcut class="pl-2">⌘ + D</Menubar.Shortcut>
              </Menubar.Item>
              <Menubar.Item inset on:click={() => toggleComment(editor)}>
                Toggle Comment <Menubar.Shortcut class="pl-2"
                  >⌘ + /</Menubar.Shortcut
                >
              </Menubar.Item>
              <Menubar.Item on:click={() => unfoldAll(editor)}>
                <UnfoldVertical class="mr-2 size-4" /> Open all folds
              </Menubar.Item>
              <Menubar.Item on:click={() => foldAll(editor)}>
                <FoldVertical class="mr-2 size-4" /> Close all folds
              </Menubar.Item>
              <Menubar.Separator />
              <Menubar.Sub>
                <Menubar.SubTrigger class="pl-8">Find</Menubar.SubTrigger>
                <Menubar.SubContent>
                  <Menubar.Item on:click={showSearch}>Find...</Menubar.Item>
                  <Menubar.Item on:click={() => findNext(editor)}
                    >Find Next</Menubar.Item
                  >
                  <Menubar.Item on:click={() => findPrevious(editor)}
                    >Find Previous</Menubar.Item
                  >
                </Menubar.SubContent>
              </Menubar.Sub>
              <Menubar.Separator />
              <Menubar.Item on:click={askAiAboutSelection}>
                <Sparkles class="mr-2 size-4" /> Ask AI about selection
              </Menubar.Item>
            </Menubar.Content>
          </Menubar.Menu>
        </Menubar.Root>
      </div>
      <div>
        <Button
          size="sm"
          aria-label="Save Ledger"
          variant="default"
          onclick={() => void handleSave()}
        >
          <Save class="mr-1 size-4" /> Save
        </Button>
      </div>
    </div>
  </div>
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
