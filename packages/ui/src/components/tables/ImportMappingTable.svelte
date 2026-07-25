<script lang="ts">
  import type { FilterCommandOption } from "../forms/picker-options";
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";
  import * as AlertDialog from "../shadcn/alert-dialog";
  import { Button } from "../shadcn/button";
  import * as Table from "../shadcn/table";
  import * as Tabs from "../shadcn/tabs";

  export type ImportMappingColumn = {
    id: string;
    label: string;
    align?: "left" | "right";
  };

  export type ImportMappingRow = {
    id: string;
    /** A concise description used for the source editor's accessible name. */
    label: string;
    account: string;
    values: Readonly<Record<string, string | number | null | undefined>>;
    /** Explain why this row needs an account choice without deriving matches here. */
    accountHint?: string;
  };

  export type ImportMappingTab = "categorized" | "uncategorized";

  let {
    fileName,
    columns,
    categorizedRows,
    uncategorizedRows = [],
    accountOptions,
    activeTab = "categorized",
    emptyCategorizedLabel = "No categorized import rows.",
    emptyUncategorizedLabel = "Every imported row has an account.",
    onActiveTabChange = () => {},
    onAccountChange = () => {},
    onOpenSource,
    onReset,
  }: {
    fileName: string;
    columns: readonly ImportMappingColumn[];
    categorizedRows: readonly ImportMappingRow[];
    uncategorizedRows?: readonly ImportMappingRow[];
    accountOptions: FilterCommandOption[];
    activeTab?: ImportMappingTab;
    emptyCategorizedLabel?: string;
    emptyUncategorizedLabel?: string;
    onActiveTabChange?: (tab: ImportMappingTab) => void;
    /** Persist the selected account and any source rewrite in the application layer. */
    onAccountChange?: (row: ImportMappingRow, account: string) => void;
    /** Open the application's source editor for this imported row. */
    onOpenSource?: (row: ImportMappingRow) => void;
    /** Reset the application's imported-file state after the confirmation. */
    onReset?: () => void;
  } = $props();

  let resetOpen = $state(false);
  const rows = $derived(
    activeTab === "categorized" ? categorizedRows : uncategorizedRows,
  );
  const emptyLabel = $derived(
    activeTab === "categorized"
      ? emptyCategorizedLabel
      : emptyUncategorizedLabel,
  );

  function displayCell(value: string | number | null | undefined) {
    return value == null || value === "" ? "—" : String(value);
  }

  function changeTab(next: string) {
    if (next === "categorized" || next === "uncategorized") {
      onActiveTabChange(next);
    }
  }

  function confirmReset() {
    resetOpen = false;
    onReset?.();
  }
</script>

<section class="cn-tables-importmappingtable-84-1" aria-label="Import mapping">
  <header class="cn-tables-importmappingtable-86-1">
    <div class="cn-tables-importmappingtable-88-1">
      <p class="cn-tables-importmappingtable-90-1">Import file</p>
      <h2 class="cn-tables-importmappingtable-94-1">
        {fileName}
      </h2>
    </div>
    {#if onReset}
      <AlertDialog.Root bind:open={resetOpen}>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button {...props} type="button" variant="outline" size="sm">
              Reset mapping
            </Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Reset import mapping?</AlertDialog.Title>
            <AlertDialog.Description>
              This removes the account choices associated with {fileName}. The
              application will restore the original imported data.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onclick={confirmReset}
              >Confirm reset</AlertDialog.Action
            >
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/if}
  </header>

  <div class="cn-tables-importmappingtable-126-1">
    <div class="cn-tables-importmappingtable-128-1">
      <Tabs.Root value={activeTab} onValueChange={changeTab}>
        <Tabs.List aria-label="Import mapping rows">
          <Tabs.Trigger value="categorized">
            Categorized ({categorizedRows.length})
          </Tabs.Trigger>
          {#if uncategorizedRows.length}
            <Tabs.Trigger value="uncategorized">
              Needs account ({uncategorizedRows.length})
            </Tabs.Trigger>
          {/if}
        </Tabs.List>
      </Tabs.Root>
      <p class="cn-tables-importmappingtable-142-1">
        Choose an account for each imported row.
      </p>
    </div>

    <div class="cn-tables-importmappingtable-147-1">
      <Table.Root class="cn-tables-importmappingtable-148-1">
        <Table.Header class="cn-tables-importmappingtable-149-1">
          <Table.Row class="cn-tables-importmappingtable-150-1">
            {#if onOpenSource}
              <Table.Head class="cn-tables-importmappingtable-152-1">
                <span class="sr-only">Source</span>
              </Table.Head>
            {/if}
            <Table.Head class="cn-tables-importmappingtable-157-1">
              Account
            </Table.Head>
            {#each columns as column (column.id)}
              <Table.Head
                class={column.align === "right"
                  ? "cn-tables-importmappingtable-164-1"
                  : "cn-tables-importmappingtable-165-1"}
              >
                {column.label}
              </Table.Head>
            {/each}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each rows as row (row.id)}
            <Table.Row>
              {#if onOpenSource}
                <Table.Cell class="cn-tables-importmappingtable-176-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="cn-tables-importmappingtable-181-1"
                    aria-label={`Edit source for ${row.label}`}
                    onclick={() => onOpenSource(row)}
                  >
                    Source
                  </Button>
                </Table.Cell>
              {/if}
              <Table.Cell class="cn-tables-importmappingtable-189-1">
                <div class="cn-tables-importmappingtable-190-1">
                  <FilterCommandPicker
                    value={row.account}
                    options={accountOptions}
                    label={`Account for ${row.label}`}
                    fullWidth
                    onChange={(account) => onAccountChange(row, account)}
                  />
                  {#if row.accountHint}
                    <p class="cn-tables-importmappingtable-199-1">
                      {row.accountHint}
                    </p>
                  {/if}
                </div>
              </Table.Cell>
              {#each columns as column (column.id)}
                <Table.Cell
                  class={column.align === "right"
                    ? "cn-tables-importmappingtable-208-1"
                    : "cn-tables-importmappingtable-209-1"}
                >
                  {displayCell(row.values[column.id])}
                </Table.Cell>
              {/each}
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell
                colspan={columns.length + (onOpenSource ? 2 : 1)}
                class="cn-tables-importmappingtable-219-1"
              >
                {emptyLabel}
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </div>
</section>
