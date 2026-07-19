<script lang="ts">
  import { untrack } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";

  export type LedgerActivityRecord = {
    id: string;
    description: string;
    account?: string;
    amount: string;
    balance?: string;
    /** Secondary text, such as transaction narration or posting detail. */
    detail?: string;
  };

  export type LedgerActivityGroup = {
    id: string;
    date: string;
    records: readonly LedgerActivityRecord[];
    balance?: string;
  };

  let {
    groups,
    selectedIds = [],
    selectable = true,
    ariaLabel = "Ledger activity",
    amountHeading = "Amount",
    balanceDescription = "Running balance",
    emptyMessage = "No dated records match the current filter.",
    onSelectedIdsChange = () => {},
    onOpenRecord,
  }: {
    groups: readonly LedgerActivityGroup[];
    selectedIds?: readonly string[];
    selectable?: boolean;
    ariaLabel?: string;
    amountHeading?: string;
    balanceDescription?: string;
    emptyMessage?: string;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRecord?: (record: LedgerActivityRecord) => void;
  } = $props();

  let expandedGroupIds = $state<Set<string>>(
    new Set(untrack(() => groups).map((group) => group.id)),
  );

  const recordIds = $derived(
    groups.flatMap((group) => group.records.map((record) => record.id)),
  );
  const selectedIdSet = $derived(new Set(selectedIds));
  const allSelected = $derived(
    recordIds.length > 0 && recordIds.every((id) => selectedIdSet.has(id)),
  );
  const someSelected = $derived(
    !allSelected && recordIds.some((id) => selectedIdSet.has(id)),
  );

  function updateSelection(ids: Iterable<string>) {
    onSelectedIdsChange([...new Set(ids)]);
  }

  function toggleRecord(id: string, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    updateSelection(next);
  }

  function toggleGroup(group: LedgerActivityGroup, checked: boolean) {
    const next = new Set(selectedIds);
    for (const record of group.records) {
      if (checked) next.add(record.id);
      else next.delete(record.id);
    }
    updateSelection(next);
  }

  function toggleAll(checked: boolean) {
    updateSelection(checked ? recordIds : []);
  }

  function toggleGroupDisclosure(id: string) {
    const next = new Set(expandedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedGroupIds = next;
  }

  function groupSelection(
    group: LedgerActivityGroup,
  ): "checked" | "unchecked" | "indeterminate" {
    const count = group.records.filter((record) =>
      selectedIdSet.has(record.id),
    ).length;
    if (count === 0) return "unchecked";
    return count === group.records.length ? "checked" : "indeterminate";
  }

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }
</script>

<section class="w-full" aria-label={ariaLabel}>
  <div
    class="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
  >
    <div
      class={selectable
        ? "activity-grid activity-grid--selectable items-center gap-4 bg-muted/65 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        : "activity-grid activity-grid--read-only items-center gap-4 bg-muted/65 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"}
    >
      {#if selectable}
        <input
          type="checkbox"
          checked={allSelected}
          use:setIndeterminate={someSelected}
          class="size-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Select all visible records"
          onchange={(event) =>
            toggleAll((event.currentTarget as HTMLInputElement).checked)}
        />
      {/if}
      <span>Date and record</span>
      <span class="text-right">{amountHeading}</span>
    </div>

    {#if groups.length}
      <div class="divide-y divide-border/80">
        {#each groups as group (group.id)}
          {@const expanded = expandedGroupIds.has(group.id)}
          {@const groupState = groupSelection(group)}
          <section>
            <div
              class={selectable
                ? "activity-grid activity-grid--selectable items-center gap-4 bg-card px-5 py-3"
                : "activity-grid activity-grid--read-only items-center gap-4 bg-card px-5 py-3"}
            >
              {#if selectable}
                <input
                  type="checkbox"
                  checked={groupState === "checked"}
                  use:setIndeterminate={groupState === "indeterminate"}
                  class="size-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Select records on ${group.date}`}
                  onchange={(event) =>
                    toggleGroup(
                      group,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              {/if}
              <button
                type="button"
                class="flex min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={expanded}
                aria-controls={`${group.id}-records`}
                onclick={() => toggleGroupDisclosure(group.id)}
              >
                {#if expanded}
                  <ChevronDown
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronRight
                    class="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                {/if}
                <span class="truncate text-sm font-semibold">{group.date}</span>
                <span class="text-xs text-muted-foreground"
                  >{group.records.length} record{group.records.length === 1
                    ? ""
                    : "s"}</span
                >
              </button>
              {#if group.balance}
                <span
                  class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  aria-label={`${balanceDescription}: ${group.balance}`}
                  >{group.balance}</span
                >
              {:else}
                <span aria-hidden="true"></span>
              {/if}
            </div>

            {#if expanded}
              <ul id={`${group.id}-records`} class="border-t border-border/70">
                {#each group.records as record (record.id)}
                  <li
                    class={selectable
                      ? "activity-grid activity-grid--selectable items-start gap-4 px-5 py-3 transition-colors hover:bg-muted/45"
                      : "activity-grid activity-grid--read-only items-start gap-4 px-5 py-3 transition-colors hover:bg-muted/45"}
                  >
                    {#if selectable}
                      <input
                        type="checkbox"
                        checked={selectedIdSet.has(record.id)}
                        aria-label={`Select ${record.description}`}
                        class="mt-0.5 size-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onchange={(event) =>
                          toggleRecord(
                            record.id,
                            (event.currentTarget as HTMLInputElement).checked,
                          )}
                      />
                    {/if}
                    {#if onOpenRecord}
                      <button
                        type="button"
                        class="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onclick={() => onOpenRecord(record)}
                      >
                        <span
                          class="block truncate text-sm font-medium hover:underline"
                          >{record.description}</span
                        >
                        {#if record.account}
                          <span
                            class="mt-0.5 block truncate font-mono text-xs text-muted-foreground"
                            >{record.account}</span
                          >
                        {/if}
                        {#if record.detail}
                          <span
                            class="mt-1 block truncate text-xs text-muted-foreground"
                            >{record.detail}</span
                          >
                        {/if}
                      </button>
                    {:else}
                      <div class="min-w-0">
                        <span class="block truncate text-sm font-medium"
                          >{record.description}</span
                        >
                        {#if record.account}
                          <span
                            class="mt-0.5 block truncate font-mono text-xs text-muted-foreground"
                            >{record.account}</span
                          >
                        {/if}
                        {#if record.detail}
                          <span
                            class="mt-1 block truncate text-xs text-muted-foreground"
                            >{record.detail}</span
                          >
                        {/if}
                      </div>
                    {/if}
                    <div class="text-right font-mono text-sm tabular-nums">
                      {record.amount}
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      </div>
    {:else}
      <div class="px-5 py-12 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    {/if}
  </div>
</section>

<style>
  .activity-grid {
    display: grid;
  }

  .activity-grid--selectable {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .activity-grid--read-only {
    grid-template-columns: minmax(0, 1fr) auto;
  }
</style>
