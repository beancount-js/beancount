<script lang="ts">
  import Highlighter from "../components/Highlighter.svelte";
  import { Amount, Decimal } from "@beancount-js/beancount";
  import { formatDate } from "@beancount-js/parser";
  import { LanguageRecord, RecordInventory } from "@beancount-js/beancount";
  import { stringify } from "../components/helpers";
  import { urlForAccount } from "../helpers";
  import { useCtx } from "../stores/format";

  export let height: number;
  export let value: any;
  export let type: string;
  export let depth: number = 0;
  export let style: string = "";
  let className: string | undefined | null = undefined;
  export { className as class };

  const ctx = useCtx();
  function countLines(content: any) {
    if (typeof content === "string") {
      return content.split("\n").length;
    }
    return 1;
  }
</script>

<div
  {style}
  class={(className || "") +
    (depth > 0 ? "" : " border-r border-solid pl-1 pr-1")}
>
  {#if type === "account"}
    <span
      class="block"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      ><a href={urlForAccount(value)}>{value}</a></span
    >
  {:else if type === "html"}
    <span
      class="block"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{@html value}</span
    >
  {:else if value instanceof RecordInventory}
    {#each Object.entries(value) as [currency, num]}
      <span
        class="block text-right"
        style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
        >{$ctx.money(num, currency)}</span
      >
    {/each}
  {:else if Array.isArray(value)}
    {#each value as item, i}
      <div class:border-t={i > 0}>
        <svelte:self value={item} {height} {type} depth={depth + 1} />
      </div>
    {/each}
  {:else if value instanceof Date}
    <span
      class="block"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{formatDate(value)}</span
    >
  {:else if value instanceof Amount || value instanceof Decimal}
    <span
      class="block text-right"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{value.zero ? "" : $ctx.money(value)}</span
    >
  {:else if value instanceof LanguageRecord}
    {@const lines = countLines(value.code)}
    {@const cellHeight = `height: ${height * lines - 1}px; line-height: ${height - 1}px; `}
    <span class="block" style={cellHeight}
      ><Highlighter code={value.code} parser={value.parser}></Highlighter></span
    >
  {:else}
    {@const rowval = stringify(value)}
    {@const lines = countLines(rowval)}
    {@const cellHeight = `height: ${height * lines - 1}px; line-height: ${height - 1}px; `}
    <span
      class:whitespace-pre={countLines(rowval) > 1}
      class="block"
      style={cellHeight}>{rowval}</span
    >
  {/if}
</div>
