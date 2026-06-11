<script lang="ts">
  import { Search, CircleX } from "lucide-svelte";
  import { EditorView, keymap } from "@codemirror/view";
  import { EditorState } from "@codemirror/state";
  import { syntaxHighlighting } from "@codemirror/language";
  import Button from "$lib/components/ui/button/button.svelte";
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
  function clearSearch() {
    query.set("");
    editor.dispatch(replaceContents(editor.state, ""));
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
              handleSearch(event.state.doc.toString());
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
      <Button
        onclick={clearSearch}
        variant="ghost"
        size="sm"
        class="absolute right-2 top-[50%] translate-y-[-50%]"
      >
        <CircleX class="size-4 text-muted-foreground" />
      </Button>
    </div>
  </form>
</div>
