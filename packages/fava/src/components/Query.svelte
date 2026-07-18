<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
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
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as Tooltip from "$lib/components/ui/tooltip";
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
  import Play from "lucide-svelte/icons/play";
  import LetterText from "lucide-svelte/icons/letter-text";
  import TriangleAlert from "lucide-svelte/icons/triangle-alert";
  import Search from "lucide-svelte/icons/search";
  import { format as formatSql } from "sql-formatter";
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
  import { onMount } from "svelte";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  const { history } = useNavigation();
  const ledgerData = useLedger();

  let editor: EditorView;
  let activeRoute = history.activeRoute;
  export let qs: string = formatQueryText($activeRoute.query["qs"] ?? "");
  export let selected: string = "";

  let error: unknown;
  let init: string = "";

  function formatQueryText(query: string): string {
    if (!query) {
      return "";
    }
    return formatSql(query, { language: "postgresql" }).replaceAll(" (", "(");
  }

  const codeMirror = (node: HTMLDivElement, query: string) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: query,
        extensions: [
          EditorView.lineWrapping,
          bql,
          autocompletion(),
          closeBrackets(),
          bracketMatching(),
          editorHistory(),
          drawSelection(),
          syntaxHighlighting(classHighlighter),
          placeholder(
            "...enter a BQL query. 'help' to list available commands",
          ),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            ...closeBracketsKeymap,
            {
              key: "Control-Enter",
              mac: "Meta-Enter",
              run: () => {
                handleSearch();
                return true;
              },
            },
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
      handleSearch();
    }
    return {
      update(query: string) {
        if (query) {
          editor.dispatch(replaceContents(editor.state, query));
        }
      },
    };
  };

  $: query = $bqlQuery;

  const { bqlQuery } = useContext();
  $: queryHistory = useQueryHistory($ledgerData.filename.toLowerCase());

  $: handleSearch = () => {
    query = editor.state.doc.toString().trim();
    if (!query) {
      return;
    }
    if (query.toUpperCase() === "CLEAR") {
      queryHistory.clear();
      bqlQuery.set("");
      history.updateState({ params: { qs: "" } });
      editor.dispatch(replaceContents(editor.state, ""));
      selected = "";
      return;
    }
    selected = queryHash(query);
    bqlQuery.set(query);
    history.updateState({ params: { qs: query, selected } });
    queryHistory.add(query);
  };

  $: onDelete = (query: QueryHistory) => {
    queryHistory.remove(query.hash);
  };

  function formatQuery() {
    const query = editor.state.doc.toString().trim();
    editor.dispatch(replaceContents(editor.state, formatQueryText(query)));
  }

  onMount(() => {
    const value = qs || $bqlQuery;
    if (value && editor) {
      editor.dispatch(replaceContents(editor.state, value));
      handleSearch();
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
          class="mr-1 shrink-0"
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
                  class="size-7"
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
          <Button
            onclick={handleSearch}
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
  <QueryBox queries={$queryHistory} {onDelete} {selected} />
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
