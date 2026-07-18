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
  import TriangleAlert from "lucide-svelte/icons/triangle-alert";
  import Search from "lucide-svelte/icons/search";
  import { useLedger } from "./helpers";
  import { bql } from "@beancount-js/beanquery";
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
  export let qs: string = $activeRoute.query["qs"] ?? "";
  export let selected: string = "";

  let error: unknown;
  let init: string = "";

  const codeMirror = (node: HTMLDivElement, query: string) => {
    editor = new EditorView({
      state: EditorState.create({
        doc: query,
        extensions: [
          EditorView.lineWrapping,
          bql(),
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
      <Button
        onclick={handleSearch}
        size="sm"
        variant="default"
        class="mr-1 shrink-0"
      >
        <Search data-icon="inline-start" />
        Search
      </Button>
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
