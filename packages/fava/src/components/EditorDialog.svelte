<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { EditorState } from "@codemirror/state";
  import { Edit, PencilOff } from "lucide-svelte";
  import { autocompletion } from "@codemirror/autocomplete";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import { basicSetup, ledgerSetup } from "../codemirror/beancount/setup";
  import { EditorView } from "@codemirror/view";
  import { useContext } from "../context";
  import { beanCountLinter } from "../codemirror/beancount/linter";
  import type { Directive, ScalarType } from "@beancount-js/beancount";
  import { formatLedger } from "../codemirror/beancount/format";
  import { Button } from "$lib/components/ui/button";
  import { LedgerSource } from "../lib/ledger-data";
  import type { ValidationError } from "@beancount-js/beancount";
  import type { ParseError } from "@beancount-js/parser";
  import * as Alert from "$lib/components/ui/alert";
  import { TriangleAlert } from "lucide-svelte";
  import { beancountCompletion } from "../codemirror/beancount/autocomplete";
  import { cn } from "$lib/utils";
  import type { Text } from "@codemirror/state";
  const { ledgerSource } = useContext();
  export let directive: Directive;
  let dialogOpen = false;

  let editor: EditorView;
  let errors: Array<ValidationError | ParseError> = [];
  let className: string | undefined | null = undefined;
  export { className as class };
  type ValueChange = (
    content: Text,
    directive: Directive,
  ) => Array<ValidationError | ParseError>;

  $: changeHandler = (
    content: Text,
    directive: Directive,
  ): Array<ValidationError | ParseError> => {
    const pos = directive.meta["__pos__"] as Record<string, ScalarType>;
    const doc = $ledgerSource.doc.doc;
    const data = doc.replace(pos.from as number, pos.to as number, content);
    const source = new LedgerSource(data.toString(), $ledgerSource.props);
    if (source.errors.length) {
      return source.errors;
    }
    ledgerSource.set(source);
    return [];
  };
  export let onValueChange: ValueChange | undefined = changeHandler;

  function handleSave() {
    formatLedger(editor);
    const exceptions = (onValueChange || changeHandler)(
      editor.state.doc,
      directive,
    );
    if (exceptions.length) {
      errors = exceptions;
      return;
    }
    dialogOpen = false;
  }

  const codeMirror = (node: HTMLDivElement, directive?: Directive) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: directive?.toString() ?? "",
        extensions: [basicSetup, ledgerSetup(() => $ledgerSource)],
      }),
      parent: node
        .createDiv({
          cls: "markdown-source-view cm-s-obsidian mod-cm6 mod-inline is-readable-line-width is-live-preview",
        })
        .createDiv({ cls: "cm-scroller" })
        .createDiv({ cls: "cm-sizer" })
        .createDiv({ cls: "cm-contentContainer" }),
    });
    formatLedger(editor);
    return {
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
      class={cn(
        "clickable-icon view-action inline-block size-[18px] p-1",
        className,
      )}
    >
      <Edit class="size-3" />
    </Dialog.Trigger>
    <Dialog.Content class="text-xs sm:max-w-[700px]">
      {#if errors.length}
        <Dialog.DialogDescription class="pt-2">
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
        </Dialog.DialogDescription>
      {/if}
      <Dialog.Header>
        <Dialog.Title class="text-sm"
          >{directive.meta["filename"]}:{directive.meta["lineno"]}</Dialog.Title
        >
      </Dialog.Header>
      <div class="overflow-auto p-4 pl-0">
        <div class="beancount-editor relative">
          <div use:codeMirror={directive} class="min-h-[300px]"></div>
        </div>
      </div>
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
