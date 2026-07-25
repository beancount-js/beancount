<script lang="ts">
  import { Amount, Inventory } from "@beancount-js/beancount";
  import { Decimal, formatDate } from "@beancount-js/parser";
  import { DateTime } from "luxon";
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
    (depth > 0 ? "" : "cn-beta-grid-src-grid-cell-29-1")}
>
  {#if type === "account"}
    <span
      class="cn-beta-grid-src-grid-cell-33-1"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      ><a href={urlForAccount(value)}>{value}</a></span
    >
  {:else if type === "html"}
    <span
      class="cn-beta-grid-src-grid-cell-39-1"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{@html value}</span
    >
  {:else if value instanceof Inventory}
    {#each [...value.values()] as position}
      <span
        class="cn-beta-grid-src-grid-cell-46-1"
        style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
        >{$ctx.money(position.units)}</span
      >
    {/each}
  {:else if Array.isArray(value)}
    {#each value as item, i}
      <div class:cn-beta-grid-src-grid-cell-53-1={i > 0}>
        <svelte:self value={item} {height} {type} depth={depth + 1} />
      </div>
    {/each}
  {:else if value instanceof Date || value instanceof DateTime}
    <span
      class="cn-beta-grid-src-grid-cell-59-1"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{formatDate(value instanceof DateTime ? value.toJSDate() : value)}</span
    >
  {:else if value instanceof Amount || value instanceof Decimal}
    <span
      class="cn-beta-grid-src-grid-cell-65-1"
      style={`height: ${height - 1}px; line-height: ${height - 1}px; `}
      >{value.zero ? "" : $ctx.money(value)}</span
    >
  {:else}
    {@const rowval = stringify(value)}
    {@const lines = countLines(rowval)}
    {@const cellHeight = `height: ${height * lines - 1}px; line-height: ${height - 1}px; `}
    <span
      class:cn-beta-grid-src-grid-cell-74-1={countLines(rowval) > 1}
      class="cn-beta-grid-src-grid-cell-75-1"
      style={cellHeight}>{rowval}</span
    >
  {/if}
</div>
