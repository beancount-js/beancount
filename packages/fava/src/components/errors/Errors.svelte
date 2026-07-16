<script lang="ts">
  import { derived } from "svelte/store";
  import { BeancountFilter, ValidationError } from "@beancount-js/beancount";
  import type { ParseError } from "@beancount-js/parser";
  import { DateTime } from "luxon";
  import { useContext } from "../../context";
  import { Cell, Grid } from "../../grid";
  import type { Column } from "../../grid/grid";
  import { Custom, isDirective } from "@beancount-js/beancount";
  const { ledgerData, predicate } = useContext();
  const filterVisitor = new BeancountFilter();

  function matchesPredicate(
    predicate: NonNullable<(typeof $predicate)["predicate"]>,
    entity: Parameters<BeancountFilter["accept"]>[1],
  ) {
    return predicate.accept(filterVisitor, entity, { op: ":" });
  }

  function getLine(error: any) {
    return error.line || error.source["lineno"];
  }

  const data = derived([ledgerData, predicate], ([$ledgerData, $predicate]) => {
    const epoch = DateTime.fromMillis(0, { zone: "utc" });
    if ($predicate.predicate) {
      return $ledgerData.errors.filter((error) => {
        if (error instanceof ValidationError) {
          const directive = error.context.directive;
          if (isDirective(directive)) {
            return matchesPredicate($predicate.predicate, directive);
          }
        }
        if (typeof error === "string") {
          return matchesPredicate(
            $predicate.predicate,
            new Custom(epoch, "error", [error]),
          );
        }
        return matchesPredicate(
          $predicate.predicate,
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
          return row.context.directive?.toString() ?? "";
        } else {
          return row.position.toString();
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
          <a href={`/editor?line=${value}`}>{value}</a>
        </span>
      {:else}
        <Cell class={column.class} {style} {value} type={column.type} {height}
        ></Cell>
      {/if}
    </svelte:fragment>
  </Grid>
</div>
