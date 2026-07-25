<script lang="ts">
  import { highlightCode } from "@lezer/highlight";
  import type { Parser } from "@lezer/common";
  import type { Snippet } from "svelte";
  import * as Accordion from "../shadcn/accordion";
  import { Button } from "../shadcn/button";
  import { cn } from "../../lib/utils";
  import Copy from "lucide-svelte/icons/copy";
  import Trash from "lucide-svelte/icons/trash";
  import { codeHighlighter } from "../forms/code-highlighter";
  import { nextOpenQueryState } from "./query-box";

  export type SavedQueryItem = {
    hash: string;
    query: string;
  };
  export type QueryHistory = SavedQueryItem;

  let {
    queries,
    selected = "",
    parser,
    onDelete = () => {},
    onCopy,
    children,
  }: {
    queries: readonly SavedQueryItem[];
    /** Currently active query hash. */
    selected?: string;
    /** Optional parser used to syntax-highlight saved query content in headers. */
    parser?: Parser;
    onDelete?: (query: SavedQueryItem) => void;
    onCopy?: (query: SavedQueryItem) => void;
    /** Render query result content for the open item. */
    children?: Snippet<[SavedQueryItem]>;
  } = $props();

  let isOpen = $state<Record<string, boolean>>({});

  $effect(() => {
    if (selected && isOpen[selected] === undefined) {
      isOpen = { ...isOpen, [selected]: true };
    }
  });

  const values = $derived(
    Object.keys(isOpen).filter((key) => isOpen[key] === true),
  );

  function handleChange(items: string[] | undefined) {
    isOpen = nextOpenQueryState(isOpen, items);
  }

  function handleCopy(event: MouseEvent, query: SavedQueryItem): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    onCopy?.(query);
  }

  function handleDelete(event: MouseEvent, query: SavedQueryItem): void {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    onDelete(query);
  }

  function highlightQuery(node: HTMLPreElement, code: string) {
    if (!parser) {
      node.textContent = code;
      return;
    }

    node.replaceChildren();
    const fragment = document.createDocumentFragment();

    function emit(text: string, classes: string) {
      const textNode = document.createTextNode(text);
      if (!classes) {
        fragment.appendChild(textNode);
        return;
      }

      const span = document.createElement("span");
      span.className = classes;
      span.appendChild(textNode);
      fragment.appendChild(span);
    }

    function emitBreak() {
      fragment.appendChild(document.createTextNode("\n"));
    }

    highlightCode(code, parser.parse(code), codeHighlighter, emit, emitBreak);
    node.appendChild(fragment);

    return {
      update(nextCode: string) {
        node.textContent = "";
        highlightQuery(node, nextCode);
      },
    };
  }
</script>

{#if queries.length}
  <Accordion.Root
    class="flex w-full flex-col gap-3 pt-3"
    type="multiple"
    value={values}
    onValueChange={handleChange}
  >
    {#each queries as query (query.hash)}
      <Accordion.Item
        value={query.hash}
        class={cn(
          "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm data-[state=open]:bg-muted/50",
          { "ring-1 ring-primary/30": selected === query.hash },
        )}
        data-query-history-item
      >
        <div class="group flex min-h-14 items-stretch gap-3 transition-colors hover:bg-muted/50" data-query-history-header>
          <div class="flex min-w-0 flex-1">
            <Accordion.Trigger
              indicatorPosition="start"
              class="h-full w-full min-w-0 gap-3 py-0 pl-4 text-left text-xs hover:no-underline"
              data-query-history-trigger
            >
              {#if parser}
                <pre
                  class="query-box-label min-w-0 flex-1 whitespace-pre-wrap text-left font-mono text-xs leading-relaxed"
                  aria-label={`Saved query ${query.query}`}
                  use:highlightQuery={query.query}
                ></pre>
              {:else}
                <code
                  class="min-w-0 flex-1 text-left font-mono text-xs leading-relaxed"
                  data-query-history-label
                >
                  {query.query}
                </code>
              {/if}
            </Accordion.Trigger>
          </div>
          <div class="flex shrink-0 items-center gap-1 pr-4" data-query-history-actions>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Copy query: ${query.query}`}
              title="Copy query"
              onclick={(event) => handleCopy(event, query)}
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete query: ${query.query}`}
              title="Delete query"
              onclick={(event) => handleDelete(event, query)}
            >
              <Trash aria-hidden="true" />
            </Button>
          </div>
        </div>
        <Accordion.Content class="border-t bg-muted/20 [&>div]:p-0">
          <div class="px-4 pb-4">
            {#if isOpen[query.hash]}
              {@render children?.(query)}
            {/if}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {/each}
  </Accordion.Root>
{:else}
  <p class="px-2 py-3 text-sm text-muted-foreground">No saved queries yet.</p>
{/if}

<style>
  :global(.query-box-label .beancount-code-comment) {
    color: var(--code-comment);
  }

  :global(.query-box-label .beancount-code-keyword) {
    color: var(--code-keyword);
  }

  :global(.query-box-label .beancount-code-string) {
    color: var(--code-string);
  }

  :global(.query-box-label .beancount-code-value) {
    color: var(--code-value);
  }

  :global(.query-box-label .beancount-code-function) {
    color: var(--code-function);
  }

  :global(.query-box-label .beancount-code-property) {
    color: var(--code-property);
  }

  :global(.query-box-label .beancount-code-operator) {
    color: var(--code-operator);
  }

  :global(.query-box-label .beancount-code-punctuation) {
    color: var(--code-punctuation);
  }

  :global(.query-box-label .beancount-code-invalid) {
    color: var(--destructive);
  }
</style>
