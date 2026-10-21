<script lang="ts">
  import "../codemirror/themes/base.scss";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import {
    drawSelection,
    EditorView,
    keymap,
    placeholder,
  } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import {
    foldKeymap,
    syntaxHighlighting,
    bracketMatching,
  } from "@codemirror/language";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { useNavigation } from "../router/router";
  import {
    autocompletion,
    closeBrackets,
    closeBracketsKeymap,
    completionKeymap,
    acceptCompletion,
    completionStatus,
  } from "@codemirror/autocomplete";
  import {
    defaultKeymap,
    historyKeymap,
    history as editorHistory,
    indentMore,
    indentLess,
  } from "@codemirror/commands";
  import { TriangleAlert, Search, Play, LetterText, X } from "@lucide/svelte";
  import { useLedger } from "./helpers";
  import { bql } from "../bql/bql";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import QueryBox from "./QueryBox.svelte";
  import {
    queryHash,
    useQueryHistory,
    type QueryHistory,
  } from "../stores/query";
  import { useContext } from "../context";
  import { classHighlighter } from "../codemirror/extensions/classHighlighter";
  import { onMount, tick } from "svelte";
  import { formatQueryText } from "./format-query";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  const { history } = useNavigation();
  import { useStudioWorkspace } from "../studio/workspace";
  const queryHistories = useStudioWorkspace().queryHistories;
  const ledgerData = useLedger();

  let editor: EditorView;
  let activeRoute = history.activeRoute;
  export let qs: string = formatQueryText($activeRoute.query["qs"] ?? "");
  export let selected: string = "";

  let error: unknown;
  let editorContents = "";

  const codeMirror = (node: HTMLDivElement, query: string) => {
    editorContents = query;
    editor = new EditorView({
      state: EditorState.create({
        doc: query,
        extensions: [
          EditorView.contentAttributes.of({
            "aria-label": "BQL query",
            role: "textbox",
            "aria-multiline": "true",
          }),
          EditorView.lineWrapping,
          bql,
          autocompletion(),
          closeBrackets(),
          bracketMatching(),
          editorHistory(),
          drawSelection(),
          syntaxHighlighting(classHighlighter),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) editorContents = update.state.doc.toString();
          }),
          placeholder(
            "...enter a BQL query. 'help' to list available commands",
          ),
          keymap.of([
            {
              key: "Control-Enter",
              mac: "Meta-Enter",
              run: () => {
                void executeQuery();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...closeBracketsKeymap,
            {
              key: "Tab",
              preventDefault: true,
              shift: indentLess,
              run: (e) => {
                if (!completionStatus(e.state)) return indentMore(e);
                return acceptCompletion(e);
              },
            },
          ]),
        ],
      }),
      parent: node,
    });

    if (query?.trim()?.length) {
      submitQuery();
    }
    return {
      destroy() {
        editor.destroy();
      },
      update(query: string) {
        if (query) {
          editor.dispatch(replaceContents(editor.state, query));
        }
      },
    };
  };

  $: query = $bqlQuery;

  const { bqlQuery } = useContext();
  $: queryHistory = useQueryHistory(
    $ledgerData.filename.toLowerCase(),
    queryHistories,
  );

  function submitQuery() {
    const submittedQuery = editor.state.doc.toString().trim();
    if (!submittedQuery) {
      return;
    }
    if (submittedQuery.toUpperCase() === "CLEAR") {
      queryHistory.clear();
      bqlQuery.set("");
      history.updateState({ params: { qs: "" } });
      editor.dispatch(replaceContents(editor.state, ""));
      selected = "";
      return;
    }
    selected = queryHash(submittedQuery);
    bqlQuery.set(submittedQuery);
    history.updateState({ params: { qs: submittedQuery, selected } });
    queryHistory.add(submittedQuery);
  }

  function clearEditor() {
    editor.dispatch(replaceContents(editor.state, ""));
    editor.focus();
  }

  async function executeQuery() {
    submitQuery();
    await tick();
    clearEditor();
  }

  function formatQuery() {
    editor.dispatch(
      replaceContents(
        editor.state,
        formatQueryText(editor.state.doc.toString()),
      ),
    );
  }

  function reuseQuery(query: string) {
    editor.dispatch(replaceContents(editor.state, query));
    editor.focus();
  }

  $: onDelete = (query: QueryHistory) => {
    queryHistory.remove(query.hash);
  };

  onMount(() => {
    const value = qs || $bqlQuery;
    if (value && editor) {
      editor.dispatch(replaceContents(editor.state, value));
      submitQuery();
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
                  aria-label="Format query"
                  data-query-format
                >
                  <LetterText data-icon />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Format query</Tooltip.Content>
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
                    aria-label="Clear query"
                    data-query-clear
                  >
                    <X data-icon />
                  </Button>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>Clear query</Tooltip.Content>
            </Tooltip.Root>
            <ButtonGroup.Separator />
          {/if}
          <Button
            onclick={executeQuery}
            size="xs"
            variant="secondary"
            data-query-execute
          >
            Execute <Play data-icon="inline-end" />
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
    queries={$queryHistory}
    {onDelete}
    onReuse={reuseQuery}
    {selected}
  />
</ContentScrollArea>

<style>
  .query-search-field :global(.cm-editor),
  .query-search-field :global(.cm-scroller) {
    min-width: 0;
  }
  .query-search-field :global(.cm-content) {
    padding-block: 0.25rem;
  }
  .query-search-field :global(.cm-tooltip.cm-tooltip-autocomplete) {
    padding: 0.25rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    background: var(--popover);
    color: var(--popover-foreground);
    box-shadow: 0 12px 28px
      color-mix(in srgb, var(--foreground) 14%, transparent);
  }
  .query-search-field :global(.cm-tooltip-autocomplete > ul) {
    min-width: min(15rem, calc(100vw - 2rem));
    max-width: min(26rem, calc(100vw - 2rem));
    max-height: min(18rem, 50vh);
    padding: 0;
    font-family: var(--font-mono);
  }
  .query-search-field :global(.cm-tooltip-autocomplete > ul > li) {
    padding: 0.375rem 0.5rem;
    border-radius: calc(var(--radius) - 4px);
    color: var(--popover-foreground);
  }
  .query-search-field
    :global(.cm-tooltip-autocomplete > ul > li[aria-selected]) {
    background: var(--accent);
    color: var(--accent-foreground);
  }
  /* Match the reference's compact action group through public button hosts. */
  .query-search-field
    :global([data-query-actions] [data-ui-component="button"]) {
    height: 1.75rem;
    padding: 0 0.5rem;
  }
  .query-search-field :global([data-query-actions] [data-size^="icon"]) {
    width: 1.75rem;
    padding: 0;
  }
  .query-search-field
    :global([data-query-actions] [data-ui-component="button"]:hover) {
    background: color-mix(in srgb, var(--primary) 15%, transparent);
    color: var(--foreground);
  }
</style>
