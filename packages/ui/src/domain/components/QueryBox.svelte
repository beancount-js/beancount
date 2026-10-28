<script lang="ts">
  import * as Accordion from "@lapismd/design-core/shadcn/accordion";
  import Highlighter from "./Highlighter.svelte";
  import { bqlLanguage } from "../bql/bql";
  import QueryTable from "./QueryTable.svelte";
  import { type QueryHistory } from "../stores/query";
  import { cn } from "../lib/utils";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Copy, Trash } from "@lucide/svelte";
  import { useContext } from "../context";
  import { nextOpenQueryState } from "./query-box";
  export let queries: Array<QueryHistory>;
  export let height: number = 500;
  export let selected: string = "";
  export let onReuse: ((query: string) => void) | undefined = undefined;
  export let onDelete: (history: QueryHistory) => void = () => {};

  const { bqlQuery } = useContext();

  let isOpen: Record<string, boolean> = {};
  $: if (selected && isOpen[selected] === undefined) {
    isOpen[selected] = true;
    isOpen = { ...isOpen };
  }
  $: values = Object.keys(isOpen).filter((k) => isOpen[k] === true);

  function handleChange(items: string[] | undefined) {
    isOpen = nextOpenQueryState(isOpen, items);
  }

  function handleCopy(evt: MouseEvent, query: QueryHistory) {
    evt.preventDefault();
    evt.stopImmediatePropagation();
    evt.stopPropagation();
    if (onReuse) onReuse(query.query);
    else bqlQuery.set(query.query);
  }

  function handleDelete(evt: MouseEvent, query: QueryHistory) {
    evt.preventDefault();
    evt.stopImmediatePropagation();
    evt.stopPropagation();
    onDelete(query);
  }
</script>

<Accordion.Root
  class="beancount-editor flex w-full flex-col gap-3 pt-3"
  type="multiple"
  value={[...values]}
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
      <div
        class="group flex min-h-14 items-stretch gap-3 transition-colors hover:bg-muted/50"
        data-query-history-header
      >
        <div class="flex min-w-0 flex-1">
          <Accordion.Trigger
            indicatorPosition="start"
            class="h-full w-full min-w-0 gap-3 py-0 pl-4 text-left text-xs hover:no-underline"
            data-query-history-trigger
            aria-label={`Query: ${query.query}`}
          >
            <span class="min-w-0 flex-1" data-query-history-label>
              <Highlighter code={query.query} parser={bqlLanguage.parser} />
            </span>
          </Accordion.Trigger>
        </div>
        <div
          class="flex shrink-0 items-center gap-1 pr-4"
          data-query-history-actions
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Copy query: ${query.query}`}
            title="Copy query"
            onclick={(evt) => handleCopy(evt, query)}
          >
            <Copy data-icon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete query: ${query.query}`}
            title="Delete query"
            onclick={(evt) => handleDelete(evt, query)}
          >
            <Trash data-icon />
          </Button>
        </div>
      </div>
      <Accordion.Content
        forceMount
        hidden={!isOpen[query.hash]}
        class="border-t bg-muted/20 p-0"
      >
        <div class="px-4 pb-4" data-query-history-results>
          {#if isOpen[query.hash]}
            <QueryTable query={query.query} {height} />
          {/if}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>

<style>
  :global(
      .beancount-editor
        [data-query-history-trigger][data-ui-part="accordion-trigger"]:hover
    ) {
    text-decoration-line: none;
  }
</style>
