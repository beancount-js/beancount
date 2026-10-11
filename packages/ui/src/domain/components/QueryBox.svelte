<script lang="ts">
  import * as Accordion from "@lapismd/design-core/shadcn/accordion";
  import Highlighter from "./Highlighter.svelte";
  import { parser as bqlParser } from "@beancount-js/beanquery";
  import QueryTable from "./QueryTable.svelte";
  import { type QueryHistory } from "../stores/query";
  import { cn } from "../lib/utils";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Copy, Trash } from "@lucide/svelte";
  import { useContext } from "../context";
  import { useLedger } from "./helpers";
  import { nextOpenQueryState } from "./query-box";
  export let queries: Array<QueryHistory>;
  export let height: number = 500;
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
  class="w-full pt-2"
  type="multiple"
  value={[...values]}
  onValueChange={handleChange}
>
  {#each queries as query}
    <Accordion.Item
      value={query.hash}
      class={cn({ "opacity-45": isOpen[query.hash] == undefined })}
    >
      <Accordion.Trigger class="px-2 text-xs hover:no-underline ">
        <div class="flex w-full flex-1 items-center justify-between">
          <Highlighter code={query.query} parser={bqlParser} />
          <div>
            <Button variant="ghost" onclick={(evt) => handleCopy(evt, query)}>
              <Copy class="size-4" />
            </Button>
            <Button variant="ghost" onclick={(evt) => handleDelete(evt, query)}>
              <Trash class="size-4" />
            </Button>
          </div>
        </div>
      </Accordion.Trigger>
      <Accordion.Content class="border-t">
        {#if isOpen[query.hash]}
          <QueryTable query={query.query} {height} />
        {/if}
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
