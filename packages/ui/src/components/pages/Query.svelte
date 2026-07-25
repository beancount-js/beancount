<script lang="ts">
  import type { CompletionSource } from "@codemirror/autocomplete";
  import type { Extension } from "@codemirror/state";
  import type { Parser } from "@lezer/common";
  import type { Snippet } from "svelte";
  import { EditorState } from "@codemirror/state";
  import { EditorView, keymap, placeholder, drawSelection } from "@codemirror/view";
  import {
    autocompletion,
    acceptCompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
    completionStatus,
  } from "@codemirror/autocomplete";
  import { defaultKeymap, history, historyKeymap, indentMore, indentLess } from "@codemirror/commands";
  import {
    bracketMatching,
    foldKeymap,
    LanguageSupport,
    StreamLanguage,
    syntaxHighlighting,
    type StreamParser,
  } from "@codemirror/language";
  import { onMount, tick } from "svelte";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import * as ButtonGroup from "../shadcn/button-group";
  import * as Tooltip from "../shadcn/tooltip";
  import ContentScrollArea from "../layout/ContentScrollArea.svelte";
  import QueryBox, { type SavedQueryItem } from "../navigation/QueryBox.svelte";
  import { codeEditorHighlightStyle } from "../forms/code-editor-theme";
  import Play from "lucide-svelte/icons/play";
  import LetterText from "lucide-svelte/icons/letter-text";
  import TriangleAlert from "lucide-svelte/icons/triangle-alert";
  import Search from "lucide-svelte/icons/search";
  import X from "lucide-svelte/icons/x";

  export type QueryHistory = SavedQueryItem;

  let {
    query = "",
    queries,
    selected = "",
    parser,
    onSubmit = () => {},
    onDelete = () => {},
    onCopy = () => {},
    onClear = () => {},
    editorCompletion,
    editorExtensions = [],
    editorStreamParser,
    formatQueryText = (value) => value,
    error,
    children,
  }: {
    /** Application-provided query text. */
    query?: string;
    /** Saved query history. */
    queries: readonly QueryHistory[];
    /** Active saved query hash to keep its details open. */
    selected?: string;
    /** Optional syntax parser for saved-query highlighting. */
    parser?: Parser;
    /** Execute a submitted query string in the application layer. */
    onSubmit?: (query: string) => void;
    /** Delete a saved query from persistence. */
    onDelete?: (query: QueryHistory) => void;
    /** Copy a saved query into the active editor value. */
    onCopy?: (query: QueryHistory) => void;
    /** Clear all query history and reset app-owned query state. */
    onClear?: () => void;
    /** Optional completion source used to construct editor support in the UI package. */
    editorCompletion?: CompletionSource;
    /** Optional editor extension for language support and autocomplete. */
    editorExtensions?: readonly Extension[];
    /** Optional stream parser used to construct editor support in the UI package. */
    editorStreamParser?: StreamParser<unknown>;
    formatQueryText?: (query: string) => string;
    error?: unknown;
    /** Render query results for an expanded history item. */
    children?: Snippet<[QueryHistory]>;
  } = $props();

  let editor: EditorView;
  let editorContents = $state("");

  function createEditorLanguageSupport(): readonly Extension[] {
    if (!editorStreamParser) return [];
    const language = StreamLanguage.define(editorStreamParser);
    return [
      new LanguageSupport(
        language,
        editorCompletion
          ? language.data.of({
              autocomplete: editorCompletion,
            })
          : [],
      ),
    ];
  }

  function replaceEditorContent(value: string) {
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current === value) {
      return;
    }
    editor.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: value,
      },
    });
  }

  const codeMirror = (node: HTMLDivElement, value: string) => {
    editorContents = value;
    editor = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          EditorView.lineWrapping,
          history(),
          drawSelection(),
          bracketMatching(),
          syntaxHighlighting(codeEditorHighlightStyle, { fallback: true }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              editorContents = update.state.doc.toString();
            }
          }),
          placeholder("...enter a BQL query. 'help' to list available commands"),
          ...createEditorLanguageSupport(),
          ...editorExtensions,
          autocompletion(),
          closeBrackets(),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            {
              key: "Control-Enter",
              mac: "Meta-Enter",
              run: () => {
                void executeQuery();
                return true;
              },
            },
            {
              key: "Tab",
              preventDefault: true,
              shift: indentLess,
              run: (view) => {
                if (!completionStatus(view.state)) {
                  return indentMore(view);
                }
                return acceptCompletion(view);
              },
            },
          ]),
          keymap.of(closeBracketsKeymap),
        ],
      }),
      parent: node,
    });

    if (value?.trim()?.length) {
      submitQuery();
    }

    return {
      update(nextValue: string) {
        if (!editor) return;
        replaceEditorContent(nextValue);
      },
    };
  };

  function submitQuery() {
    const submittedQuery = editor.state.doc.toString().trim();
    if (!submittedQuery) {
      return;
    }
    if (submittedQuery.toUpperCase() === "CLEAR") {
      onClear();
      return;
    }
    onSubmit(submittedQuery);
  }

  function clearEditor() {
    replaceEditorContent("");
    editor.focus();
  }

  async function executeQuery() {
    submitQuery();
    await tick();
    clearEditor();
  }

  function formatQuery() {
    const formatted = formatQueryText(editor.state.doc.toString().trim());
    replaceEditorContent(formatted);
  }

  onMount(() => {
    if (query?.trim()) {
      replaceEditorContent(query);
    }
  });
</script>

<ContentScrollArea contentClass="scroll-container p-4">
  <div class="beancount-editor">
    <div
      data-error={!!error}
      class="query-search-field flex w-full items-center rounded-md border bg-muted/35 shadow-sm transition-colors focus-within:border-ring focus-within:ring-1 focus-within:ring-ring data-[error=true]:border-destructive data-[error=true]:bg-destructive/10"
      data-query-editor
    >
      <Search
        class="ml-3 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <div
        use:codeMirror={query}
        class="cm-code-editor min-w-0 flex-1 py-1 text-sm"
      ></div>
      <Tooltip.Provider>
        <ButtonGroup.Root
          aria-label="Query actions"
          class="mb-1 mr-1 shrink-0 self-end"
          data-query-actions
        >
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  onclick={formatQuery}
                  size="icon-sm"
                  variant="secondary"
                  class="size-7 hover:bg-primary/15 hover:text-primary"
                  aria-label="Format query"
                  data-query-format
                >
                  <LetterText data-icon />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              <p>Format query</p>
            </Tooltip.Content>
          </Tooltip.Root>
          <ButtonGroup.Separator />
          {#if editorContents.trim()}
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Button
                    {...props}
                    onclick={clearEditor}
                    size="icon-sm"
                    variant="secondary"
                    class="size-7 hover:bg-primary/15 hover:text-primary"
                    aria-label="Clear query"
                    data-query-clear
                  >
                    <X data-icon />
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>
                <p>Clear query</p>
              </Tooltip.Content>
            </Tooltip.Root>
            <ButtonGroup.Separator />
          {/if}
          <Button
            onclick={executeQuery}
            size="xs"
            variant="secondary"
            class="h-7 px-2 hover:bg-primary/15 hover:text-primary"
            data-query-execute
          >
            Execute
            <Play data-icon="inline-end" />
          </Button>
        </ButtonGroup.Root>
      </Tooltip.Provider>
    </div>
  </div>
  {#if error}
    <Alert.Root variant="destructive" class="mt-4 font-mono text-xs">
      <TriangleAlert class="h-4 w-4" />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description class="whitespace-pre-wrap">{error}</Alert.Description>
    </Alert.Root>
  {/if}
  <QueryBox
    {queries}
    selected={selected}
    {parser}
    onDelete={(queryItem) => onDelete(queryItem)}
    onCopy={(queryItem) => onCopy(queryItem)}
  >
    {#if children}
      {#snippet children(queryItem)}
        {@render children(queryItem)}
      {/snippet}
    {/if}
  </QueryBox>
</ContentScrollArea>

<style>
  .query-search-field :global(.cm-editor),
  .query-search-field :global(.cm-scroller) {
    min-width: 0;
  }

  .query-search-field :global(.cm-content) {
    padding-block: 0.25rem;
  }
</style>
