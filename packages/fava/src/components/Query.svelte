<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import {
    drawSelection,
    EditorView,
    lineNumbers,
    keymap,
    placeholder,
  } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import {
    foldKeymap,
    syntaxHighlighting,
    bracketMatching,
  } from "@codemirror/language";
  import Button from "$lib/components/ui/button/button.svelte";
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
  import { TriangleAlert } from "lucide-svelte";
  import { lintGutter } from "@codemirror/lint";
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
  let innerHeight = 500;
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
          lineNumbers(),
          editorHistory(),
          lintGutter(),
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

<svelte:window bind:innerHeight />
<ContentScrollArea contentClass="scroll-container p-4">
  <div class="beancount-editor relative">
    <div
      use:codeMirror={query}
      data-error={!!error}
      class="cm-code-editor flex w-full rounded-md border px-3 py-1 pb-0 pl-0 pt-0 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-within:outline-ring focus-within:ring-2 focus-within:ring-ring data-[error=true]:bg-destructive/20"
    ></div>
    <Button
      onclick={handleSearch}
      size="sm"
      variant="default"
      class="absolute right-2 top-[50%] translate-y-[-50%]"
    >
      Search
    </Button>
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
    {selected}
    height={Math.max(innerHeight - 200, 280)}
  />
</ContentScrollArea>
