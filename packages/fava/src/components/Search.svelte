<script lang="ts">
  import { Search, CircleX } from "lucide-svelte";
  import { EditorView, keymap } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { syntaxHighlighting } from "@codemirror/language";
  import { Button } from "$lib/components/ui/button";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { replaceContents } from "../codemirror/extensions/transactions";
  import { hashTags } from "../codemirror/extensions/hashTags";
  import { beancountFilter, parseQuery } from "@beancount-js/filters";
  import { debounceWithDelay } from "../hooks/debounce";
  import { classHighlighter } from "../codemirror/extensions/classHighlighter";

  const {
    router: { activeRoute },
  } = useNavigation();

  const [handleSearch, delay] = debounceWithDelay((qs: string) => {
    query.set(qs);
  }, 500);
  const { predicate, query } = useContext();
  let editor: EditorView;
  let hasSearchInput = false;

  function clearSearch() {
    query.set("");
    editor.dispatch(replaceContents(editor.state, ""));
    hasSearchInput = false;
  }

  $: if ($activeRoute.query.query) {
    editor.dispatch(replaceContents(editor.state, $activeRoute.query.query));
  }

  $: if ($query && editor) {
    if (editor.state.doc.toString() !== $query) {
      editor.dispatch(replaceContents(editor.state, $query));
    }
  }

  $: error = $predicate.errors?.length > 0;

  const codeMirror = (node: HTMLDivElement) => {
    const syncHasSearchInput = () => {
      hasSearchInput = Boolean(node.textContent?.trim());
    };

    editor = new EditorView({
      state: EditorState.create({
        doc: $query,
        extensions: [
          EditorView.lineWrapping,
          EditorState.transactionFilter.of((tr) =>
            tr.newDoc.lines > 1
              ? [
                  tr,
                  {
                    changes: {
                      from: 0,
                      to: tr.newDoc.length,
                      insert: tr.newDoc.sliceString(0, undefined, ""),
                    },
                    sequential: true,
                  },
                ]
              : [tr],
          ),
          beancountFilter(),
          EditorView.updateListener.of((event) => {
            if (event.docChanged) {
              const searchContents = event.state.doc.toString();
              hasSearchInput = Boolean(searchContents.trim());
              handleSearch(searchContents);
              delay();
            }
          }),
          hashTags(),
          keymap.of([
            {
              key: "Enter",
              run: (view) => {
                $query = view.state.doc.toString();
                return true;
              },
            },
          ]),
          syntaxHighlighting(classHighlighter),
        ],
      }),
      parent: node,
    });
    syncHasSearchInput();
    node.addEventListener("input", syncHasSearchInput);

    return {
      destroy() {
        node.removeEventListener("input", syncHasSearchInput);
        editor.destroy();
      },
    };
  };
</script>

<div class="p-2">
  <form>
    <div class="relative">
      <Search
        class="absolute left-2 top-[50%] h-4 w-4 translate-y-[-50%] text-muted-foreground"
      />
      <div
        use:codeMirror
        data-error={error}
        class="cm-line-editor cm-s-vars flex h-9 w-full rounded-md border bg-transparent px-3 py-1 pl-6 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-within:outline-ring focus-within:ring-2 focus-within:ring-ring data-[error=true]:bg-destructive/20"
      ></div>
      {#if hasSearchInput}
        <Button
          type="button"
          onclick={clearSearch}
          variant="ghost"
          size="icon"
          class="absolute right-1 top-[50%] size-7 -translate-y-[50%]"
          aria-label="Clear search"
          title="Clear search"
        >
          <CircleX data-icon />
        </Button>
      {/if}
    </div>
  </form>
</div>

<style>
  :global(.cm-line-editor .cm-scroller) {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-gutter: auto;
    scrollbar-width: none;
    scroll-padding-block-end: 0;
  }

  :global(.cm-line-editor .cm-scroller::-webkit-scrollbar) {
    display: none;
  }
</style>
