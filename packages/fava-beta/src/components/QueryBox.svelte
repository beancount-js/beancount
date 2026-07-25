<script lang="ts">
  import * as Accordion from "@beancount-js/ui/shadcn/accordion";
  import Highlighter from "./Highlighter.svelte";
  import { bqlLanguage } from "../bql/bql";
  import QueryTable from "./QueryTable.svelte";
  import { type QueryHistory } from "../stores/query";
  import { cn } from "$lib/utils";
  import { Button } from "@beancount-js/ui/shadcn/button";
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
  class="cn-beta-components-querybox-46-1"
  type="multiple"
  value={[...values]}
  onValueChange={handleChange}
>
  {#each queries as query}
    <Accordion.Item
      value={query.hash}
      class={cn("cn-beta-components-querybox-55-1", {
        "cn-beta-components-querybox-56-1": selected === query.hash,
      })}
      data-query-history-item
    >
      <div
        class="cn-beta-components-querybox-61-1 cn-group"
        data-query-history-header
      >
        <div class="cn-beta-components-querybox-64-1">
          <Accordion.Trigger
            indicatorPosition="start"
            class="cn-beta-components-querybox-67-1"
            data-query-history-trigger
          >
            <span
              class="cn-beta-components-querybox-70-1"
              data-query-history-label
            >
              <Highlighter code={query.query} parser={bqlLanguage.parser} />
            </span>
          </Accordion.Trigger>
        </div>
        <div
          class="cn-beta-components-querybox-76-1"
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
      <Accordion.Content class="cn-beta-components-querybox-99-1">
        <div class="cn-beta-components-querybox-100-1">
          {#if isOpen[query.hash]}
            <QueryTable query={query.query} />
          {/if}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
