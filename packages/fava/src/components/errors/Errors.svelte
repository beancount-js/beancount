<script lang="ts">
  import { derived } from "svelte/store";
  import { ValidationError } from "@beancount-js/beancount";
  import type { ParseError } from "@beancount-js/parser";
  import { useContext } from "../../context";
  import { Cell, Grid } from "../../grid";
  import type { Column } from "../../grid/grid";
  import { LanguageRecord } from "@beancount-js/beancount";
  import { Custom, isDirective } from "@beancount-js/beancount";
  const { ledgerData, predicate } = useContext();

  function getLine(error: any) {
    return error.line || error.source["lineno"];
  }

  const data = derived([ledgerData, predicate], ([$ledgerData, $predicate]) => {
    const epoch = new Date(1970, 0, 1, 0, 0, 0, 0);
    if ($predicate.predicate) {
      return $ledgerData.errors.filter((error) => {
        if (error instanceof ValidationError) {
          if (isDirective(error.entry)) {
            return $predicate.predicate!.matches(error.entry);
          }
        }
        if (typeof error === "string") {
          return $predicate.predicate?.matches(
            new Custom(epoch, "error", [error]),
          );
        }
        return $predicate.predicate?.matches(
          new Custom(epoch, "error", [error.message], { ...error }),
        );
      });
    }
    return $ledgerData.errors;
  });

  const model: Column<ValidationError | ParseError | string>[] = [
    {
      id: "lineno",
      name: "Line",
      sortable: true,
      type: "text",
      value: (row: ValidationError | ParseError | string, state?: string) => {
        const value = typeof row === "string" ? "-" : getLine(row);
        if (state === "sort") {
          return +value;
        }
        return value;
      },
    },
    {
      id: "message",
      name: "Message",
      sortable: true,
      type: "text",
      value: (row: ValidationError | ParseError | string, state?: string) => {
        const value = typeof row === "string" ? row : row.message;
        return value;
      },
    },
    {
      id: "entity",
      name: "Entity",
      type: "text",
      value: (row: ValidationError | ParseError | string, state?: string) => {
        if (typeof row === "string") {
          return "-";
        } else if (row instanceof ValidationError) {
          return row.entry
            ? LanguageRecord.beancount(row.entry.toString())
            : "";
        } else {
          return row.node;
        }
      },
    },
  ];
</script>

<div class="p-2">
  <Grid
    {data}
    height={window.innerHeight - 150}
    padding={window.innerHeight / 2}
    rowHeight={24}
    {model}
  >
    <svelte:fragment
      slot="cell"
      let:column
      let:style
      let:value
      let:height
      let:index
    >
      {#if index === 0}
        <span {style} class="border-r">
          <a href={`#/editor?line=${value}`}>{value}</a>
        </span>
      {:else}
        <Cell class={column.class} {style} {value} type={column.type} {height}
        ></Cell>
      {/if}
    </svelte:fragment>
  </Grid>
</div>
