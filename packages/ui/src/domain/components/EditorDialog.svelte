<script lang="ts">
  import "../codemirror/themes/base.scss";
  import { getAllContexts } from "svelte";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { EditorState } from "@codemirror/state";
  import { Edit, PencilOff } from "@lucide/svelte";
  import { autocompletion } from "@codemirror/autocomplete";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import { basicSetup, ledgerSetup } from "../codemirror/beancount/setup";
  import { EditorView } from "@codemirror/view";
  import { useContext } from "../context";
  import { beanCountLinter } from "../codemirror/beancount/linter";
  import type { Directive, ScalarType } from "@beancount-js/beancount";
  import { formatLedger } from "../codemirror/beancount/format";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { LedgerSource } from "../lib/ledger-data";
  import type { LedgerError } from "@beancount-js/beancount";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { TriangleAlert } from "@lucide/svelte";
  import { beancountCompletion } from "../codemirror/beancount/autocomplete";
  import { cn } from "../lib/utils";
  import type { Text } from "@codemirror/state";
  import { Text as ParserText } from "@beancount-js/parser";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";
  const { ledgerSource } = useContext();
  const editorContext = getAllContexts();
  import { useStudioWorkspace } from "../studio/workspace";
  import { journalRecordAnchor } from "../lib/journal-record-key";
  const { snapshot, saveFile } = useStudioWorkspace();
  let saveError = "";
  export let directive: Directive;
  let dialogOpen = false;

  let editor: EditorView;
  let errors: LedgerError[] = [];
  let className: string | undefined | null = undefined;
  export { className as class };
  type ValueChange = (
    content: Text,
    directive: Directive,
  ) => LedgerError[] | Promise<LedgerError[]>;

  $: changeHandler = async (
    content: Text,
    directive: Directive,
  ): Promise<LedgerError[]> => {
    const anchor = journalRecordAnchor(directive);
    if (!anchor || !$snapshot)
      throw new Error("The record is not attached to an editable source file.");
    const file = $snapshot.ledgerFiles.find(
      (file) => file.path === anchor.filename,
    );
    if (!file || file.contents.slice(anchor.from, anchor.to) !== anchor.content)
      throw new Error("This record changed. Reload it before saving.");
    const contents =
      file.contents.slice(0, anchor.from) +
      content.toString() +
      file.contents.slice(anchor.to);
    const source = LedgerSource.fromProject(
      $snapshot.project.entryFile,
      $snapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.path === anchor.filename ? contents : file.contents,
      })),
      $ledgerSource.props,
    );
    if (source.errors.length) return source.errors;
    await saveFile(
      anchor.filename,
      contents,
      $snapshot.revisions.find((file) => file.path === anchor.filename)
        ?.revision,
    );
    return [];
  };
  export let onValueChange: ValueChange | undefined = changeHandler;

  async function handleSave() {
    saveError = "";
    try {
      formatLedger(editor);
      const exceptions = await (onValueChange || changeHandler)(
        editor.state.doc,
        directive,
      );
      if (exceptions.length) {
        errors = exceptions;
        return;
      }
      dialogOpen = false;
    } catch (error) {
      saveError = error instanceof Error ? error.message : String(error);
    }
  }

  const codeMirror = (node: HTMLDivElement, directive?: Directive) => {
    const markdownSourceView = document.createElement("div");
    markdownSourceView.className =
      "markdown-source-view cm-s-obsidian mod-cm6 mod-inline is-readable-line-width is-live-preview";
    const scroller = document.createElement("div");
    scroller.className = "cm-scroller";
    const sizer = document.createElement("div");
    sizer.className = "cm-sizer";
    const contentContainer = document.createElement("div");
    contentContainer.className = "cm-contentContainer";
    node.append(markdownSourceView);
    markdownSourceView.append(scroller);
    scroller.append(sizer);
    sizer.append(contentContainer);

    editor = new EditorView({
      state: EditorState.create({
        doc: directive?.toString() ?? "",
        extensions: [
          basicSetup,
          ledgerSetup(() => $ledgerSource, editorContext),
        ],
      }),
      parent: contentContainer,
    });
    formatLedger(editor);
    return {
      destroy() {
        editor.destroy();
      },
      update(directive: Directive) {
        if (directive) {
          editor.dispatch(replaceContents(editor.state, directive.toString()));
          formatLedger(editor);
        }
      },
    };
  };
</script>

{#if directive}
  <Dialog.Root bind:open={dialogOpen}>
    <Dialog.Trigger
      aria-label="Edit directive"
      class={cn(
        "clickable-icon view-action inline-block size-[18px] p-1",
        className,
      )}
    >
      <Edit class="size-3" />
    </Dialog.Trigger>
    <Dialog.Content class="text-xs sm:max-w-[700px]">
      {#if errors.length}
        <Dialog.Description class="pt-2">
          {#each errors as error}
            <Alert.Root
              variant="destructive"
              class="mt-4 border-solid bg-destructive/10 font-mono text-xs"
            >
              <TriangleAlert class="h-4 w-4" />
              <Alert.Title>Error</Alert.Title>
              <Alert.Description class="whitespace-pre-wrap"
                >{error.message}</Alert.Description
              >
            </Alert.Root>
          {/each}
        </Dialog.Description>
      {/if}
      {#if saveError}<p role="alert">{saveError}</p>{/if}
      <Dialog.Header>
        <Dialog.Title class="text-sm"
          >{directive.meta["filename"]}:{directive.meta["lineno"]}</Dialog.Title
        >
      </Dialog.Header>
      <ScrollArea.Root class="max-h-[60vh]">
        <div class="p-4 pl-0">
          <div class="beancount-editor relative">
            <div use:codeMirror={directive} class="min-h-[300px]"></div>
          </div>
        </div>
      </ScrollArea.Root>
      <Dialog.Footer>
        <Button type="submit" onclick={handleSave}>Save</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{:else}
  <Button
    variant="ghost"
    disabled
    class={cn(
      "clickable-icon view-action inline-block size-[18px] cursor-not-allowed p-1",
      className,
    )}
  >
    <PencilOff class="size-3" />
  </Button>
{/if}
