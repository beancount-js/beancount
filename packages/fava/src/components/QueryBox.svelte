<script lang="ts">
  import * as Accordion from "$lib/components/ui/accordion/index.js";
  import Highlighter from "./Highlighter.svelte";
  import { parser as bqlParser } from "@beancount-js/beanquery";
  import QueryTable from "./QueryTable.svelte";
  import { type QueryHistory } from "../stores/query";
  import { cn } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import Copy from "lucide-svelte/icons/copy";
  import Trash from "lucide-svelte/icons/trash";
  import { useContext } from "../context";
  import { nextOpenQueryState } from "./query-box";
  export let queries: Array<QueryHistory>;
  export let selected: string = "";
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
    bqlQuery.set(query.query);
  }

  function handleDelete(evt: MouseEvent, query: QueryHistory) {
    evt.preventDefault();
    evt.stopImmediatePropagation();
    evt.stopPropagation();
    onDelete(query);
  }
</script>

<Accordion.Root
  class="flex w-full flex-col gap-3 pt-3"
  type="multiple"
  value={[...values]}
  onValueChange={handleChange}
>
  {#each queries as query}
    <Accordion.Item
      value={query.hash}
      class={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm",
        { "ring-1 ring-primary/30": selected === query.hash },
      )}
      data-query-history-item
    >
      <div
        class="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
        data-query-history-header
      >
        <Accordion.Trigger
          class="min-w-0 flex-1 py-0 text-left text-xs hover:no-underline"
        >
          <span class="min-w-0 flex-1">
            <Highlighter code={query.query} parser={bqlParser} />
          </span>
        </Accordion.Trigger>
        <div
          class="flex shrink-0 items-center gap-1"
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
      <Accordion.Content class="border-t bg-muted/20 [&>div]:p-0">
        <div class="px-4 pb-4">
          {#if isOpen[query.hash]}
            <QueryTable query={query.query} />
          {/if}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
