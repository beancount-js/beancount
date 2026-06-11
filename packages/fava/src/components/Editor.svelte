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
  import { LedgerSource } from "../core/ledger";
  import { useNavigation } from "../router/router";

  const {
    router: { activeRoute },
  } = useNavigation();
  const { ledgerSource } = useContext();

  let formatOnSave = true;
  let editor: EditorView;
  let line = "";

  const codeMirror = (node: HTMLDivElement, qs: string) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: qs,
        extensions: [
          basicSetup,
          ledgerSetup(() => $ledgerSource),
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

    if (line) {
      goToLine(editor, line);
    }
    return {
      update(qs: string) {
        if (qs) {
          editor.dispatch({
            ...replaceContents(editor.state, qs),
          });
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

  $: if (editor && $activeRoute.query["line"] && line !== $activeRoute.query["line"]) {
    line = $activeRoute.query["line"];
    goToLine(editor, line);
  }

  function handleSave() {
    if (formatOnSave) {
      formatLedger(editor);
    }
    const source = new LedgerSource(
      editor.state.doc.toString(),
      $ledgerSource.props,
    );
    ledgerSource.set(source);
  }

  onMount(function () {
    document.addEventListener("showSearch", showSearch);
    document.addEventListener("saveLedger", handleSave);
    return () => {
      document.removeEventListener("showSearch", showSearch);
      document.removeEventListener("saveLedger", handleSave);
    };
  });
</script>

<div class="pr-4">
  <div class="flex justify-between">
    <div class="pb-2 pl-2">
      <Menubar.Root>
        <Menubar.Menu>
          <Menubar.Trigger>File</Menubar.Trigger>
          <Menubar.Content>
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
              Toggle Comment <Menubar.Shortcut class="pl-2">⌘ + /</Menubar.Shortcut>
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
                <Menubar.Item on:click={() => findNext(editor)}>Find Next</Menubar.Item>
                <Menubar.Item on:click={() => findPrevious(editor)}>Find Previous</Menubar.Item>
              </Menubar.SubContent>
            </Menubar.Sub>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>
    </div>
    <div>
      <Button
        size="sm"
        aria-label="Save Ledger"
        variant="default"
        on:click={() => handleSave()}
      >
        <Save class="mr-1 size-4" /> Save
      </Button>
    </div>
  </div>
</div>
<div class="scroll-container pb-[60vh] pt-0">
  <div class="beancount-editor relative">
    <div use:codeMirror={$ledgerSource.doc.contents}></div>
  </div>
</div>
