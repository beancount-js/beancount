<script lang="ts">
  import { untrack } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import SegmentedControl from "../forms/SegmentedControl.svelte";

  export type IngestionReviewFilter = "review" | "ready";

  export type IngestionReviewPosting = {
    account: string;
    amount: string;
  };

  export type IngestionReviewRow = {
    id: string;
    title: string;
    detail?: string;
    status: "ready" | "needs-review" | "held" | "duplicate" | "accepted";
    statusLabel?: string;
    amount?: string;
    account?: string;
    postings?: readonly IngestionReviewPosting[];
    imageUrl?: string;
    initial?: string;
    /** False for rows that need application input before an approval action. */
    selectable?: boolean;
  };

  export type IngestionReviewGroup = {
    id: string;
    label: string;
    rows: readonly IngestionReviewRow[];
  };

  export type IngestionReviewCounts = {
    review: number;
    ready: number;
    duplicates: number;
  };

  let {
    groups,
    counts,
    filter = "review",
    selectedIds = [],
    ariaLabel = "Import review queue",
    emptyLabel = "No proposals are waiting in this queue.",
    onFilterChange = () => {},
    onSelectedIdsChange = () => {},
    onOpenRow,
  }: {
    groups: readonly IngestionReviewGroup[];
    counts: IngestionReviewCounts;
    filter?: IngestionReviewFilter;
    selectedIds?: readonly string[];
    ariaLabel?: string;
    emptyLabel?: string;
    onFilterChange?: (filter: IngestionReviewFilter) => void;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRow?: (row: IngestionReviewRow) => void;
  } = $props();

  let expandedGroupIds = $state<Set<string>>(
    new Set(untrack(() => groups).map((group) => group.id)),
  );
  let expandedGroupSignature = $state("");

  const selectedIdSet = $derived(new Set(selectedIds));
  const selectableIds = $derived(
    groups.flatMap((group) =>
      group.rows.filter((row) => row.selectable !== false).map((row) => row.id),
    ),
  );
  const allSelected = $derived(
    selectableIds.length > 0 &&
      selectableIds.every((id) => selectedIdSet.has(id)),
  );
  const someSelected = $derived(
    !allSelected && selectableIds.some((id) => selectedIdSet.has(id)),
  );

  $effect(() => {
    const signature = groups.map((group) => group.id).join("|");
    if (signature === expandedGroupSignature) return;
    expandedGroupSignature = signature;
    expandedGroupIds = new Set(groups.map((group) => group.id));
  });

  function updateSelection(ids: Iterable<string>) {
    onSelectedIdsChange([...new Set(ids)]);
  }

  function toggleRow(row: IngestionReviewRow, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(row.id);
    else next.delete(row.id);
    updateSelection(next);
  }

  function selectableRows(group: IngestionReviewGroup) {
    return group.rows.filter((row) => row.selectable !== false);
  }

  function toggleGroup(group: IngestionReviewGroup, checked: boolean) {
    const next = new Set(selectedIds);
    for (const row of selectableRows(group)) {
      if (checked) next.add(row.id);
      else next.delete(row.id);
    }
    updateSelection(next);
  }

  function toggleAll(checked: boolean) {
    updateSelection(checked ? selectableIds : []);
  }

  function groupSelection(
    group: IngestionReviewGroup,
  ): "checked" | "unchecked" | "indeterminate" {
    const rows = selectableRows(group);
    const count = rows.filter((row) => selectedIdSet.has(row.id)).length;
    if (count === 0) return "unchecked";
    return count === rows.length ? "checked" : "indeterminate";
  }

  function toggleDisclosure(id: string) {
    const next = new Set(expandedGroupIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedGroupIds = next;
  }

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }

  function statusClass(status: IngestionReviewRow["status"]) {
    switch (status) {
      case "ready":
        return "bg-emerald-500/15";
      case "held":
        return "bg-amber-500/20";
      case "duplicate":
        return "bg-rose-500/15";
      case "accepted":
        return "bg-sky-500/15";
      default:
        return "bg-violet-500/15";
    }
  }

  function statusLabel(row: IngestionReviewRow) {
    if (row.statusLabel) return row.statusLabel;
    return row.status === "needs-review"
      ? "Needs review"
      : row.status[0].toUpperCase() + row.status.slice(1);
  }
</script>

<section class="cn-tables-ingestionreviewtable-165-1" aria-label={ariaLabel}>
  <header class="cn-tables-ingestionreviewtable-167-1">
    <div class="cn-tables-ingestionreviewtable-169-1" role="status">
      <span class="cn-tables-ingestionreviewtable-171-1">
        <span class="tabular-nums">{counts.ready}</span> ready
      </span>
      <span class="cn-tables-ingestionreviewtable-176-1">
        <span class="tabular-nums">{counts.review}</span> need review
      </span>
      <span class="cn-tables-ingestionreviewtable-181-1">
        <span class="tabular-nums">{counts.duplicates}</span> duplicates
      </span>
    </div>
    <SegmentedControl
      value={filter}
      options={["review", "ready"]}
      labels={{
        review: `Review (${counts.review})`,
        ready: `Ready (${counts.ready})`,
      }}
      ariaLabel="Import review content"
      onChange={(value) => onFilterChange(value as IngestionReviewFilter)}
    />
  </header>

  <div
    class="cn-tables-ingestionreviewtable-199-1 review-grid review-grid--header"
  >
    <input
      type="checkbox"
      checked={allSelected}
      use:setIndeterminate={someSelected}
      class="cn-tables-ingestionreviewtable-205-1"
      aria-label="Select visible review items"
      disabled={!selectableIds.length}
      onchange={(event) =>
        toggleAll((event.currentTarget as HTMLInputElement).checked)}
    />
    <span>Proposal</span>
    <span class="cn-tables-ingestionreviewtable-212-1">Amount</span>
  </div>

  {#if groups.length}
    <div class="cn-tables-ingestionreviewtable-216-1">
      {#each groups as group (group.id)}
        {@const expanded = expandedGroupIds.has(group.id)}
        {@const selection = groupSelection(group)}
        {@const groupRows = selectableRows(group)}
        <section class="cn-tables-ingestionreviewtable-221-1">
          <div
            class="cn-tables-ingestionreviewtable-223-1 review-grid review-grid--header"
          >
            <input
              type="checkbox"
              checked={selection === "checked"}
              use:setIndeterminate={selection === "indeterminate"}
              class="cn-tables-ingestionreviewtable-229-1"
              aria-label={`Select actionable items from ${group.label}`}
              disabled={!groupRows.length}
              onchange={(event) =>
                toggleGroup(
                  group,
                  (event.currentTarget as HTMLInputElement).checked,
                )}
            />
            <button
              type="button"
              class="cn-tables-ingestionreviewtable-240-1"
              aria-expanded={expanded}
              aria-controls={`${group.id}-rows`}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
              onclick={() => toggleDisclosure(group.id)}
            >
              <span class="cn-tables-ingestionreviewtable-247-1">
                {group.label}
                <span class="cn-tables-ingestionreviewtable-250-1"
                  >· {group.rows.length}</span
                >
              </span>
              <span
                class="cn-tables-ingestionreviewtable-255-1"
                aria-hidden="true"
              >
                {#if expanded}
                  <ChevronUp class="cn-tables-ingestionreviewtable-259-1" />
                {:else}
                  <ChevronDown class="cn-tables-ingestionreviewtable-261-1" />
                {/if}
              </span>
            </button>
          </div>

          {#if expanded}
            <div
              id={`${group.id}-rows`}
              class="cn-tables-ingestionreviewtable-270-1"
            >
              {#each group.rows as row (row.id)}
                {@const selectable = row.selectable !== false}
                <div
                  class="cn-tables-ingestionreviewtable-275-1 review-grid review-grid--row"
                >
                  <input
                    type="checkbox"
                    checked={selectedIdSet.has(row.id)}
                    class="cn-tables-ingestionreviewtable-280-1"
                    aria-label={`Select ${row.title}`}
                    disabled={!selectable}
                    onchange={(event) =>
                      toggleRow(
                        row,
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                  />
                  <div class="cn-tables-ingestionreviewtable-289-1">
                    {#if row.imageUrl}
                      <img
                        class="cn-tables-ingestionreviewtable-292-1"
                        src={row.imageUrl}
                        alt=""
                      />
                    {:else}
                      <div
                        class="cn-tables-ingestionreviewtable-298-1"
                        aria-hidden="true"
                      >
                        {row.initial ?? row.title.slice(0, 1).toUpperCase()}
                      </div>
                    {/if}
                    {#if onOpenRow}
                      <button
                        type="button"
                        class="cn-tables-ingestionreviewtable-307-1"
                        aria-label={`Review ${row.title}`}
                        onclick={() => onOpenRow(row)}
                      >
                        <span class="cn-tables-ingestionreviewtable-312-1"
                          >{row.title}</span
                        >
                        {#if row.detail}
                          <span class="cn-tables-ingestionreviewtable-317-1"
                            >{row.detail}</span
                          >
                        {/if}
                        <span
                          class={`mt-2 inline-flex min-w-20 justify-center rounded-full px-2 py-0.5 text-xs font-medium text-foreground ${statusClass(row.status)}`}
                        >
                          {statusLabel(row)}
                        </span>
                      </button>
                    {:else}
                      <div class="cn-tables-ingestionreviewtable-328-1">
                        <span class="cn-tables-ingestionreviewtable-330-1"
                          >{row.title}</span
                        >
                        {#if row.detail}
                          <span class="cn-tables-ingestionreviewtable-335-1"
                            >{row.detail}</span
                          >
                        {/if}
                        <span
                          class={`mt-2 inline-flex min-w-20 justify-center rounded-full px-2 py-0.5 text-xs font-medium text-foreground ${statusClass(row.status)}`}
                        >
                          {statusLabel(row)}
                        </span>
                      </div>
                    {/if}
                  </div>
                  <div class="cn-tables-ingestionreviewtable-347-1">
                    {#if row.postings?.length}
                      {#each row.postings as posting (posting.account)}
                        <div class="cn-tables-ingestionreviewtable-351-1">
                          <span class="cn-tables-ingestionreviewtable-354-1"
                            >{posting.account}</span
                          >
                          <span class="cn-tables-ingestionreviewtable-357-1"
                            >{posting.amount}</span
                          >
                        </div>
                      {/each}
                    {:else}
                      {#if row.account}
                        <span class="cn-tables-ingestionreviewtable-365-1"
                          >{row.account}</span
                        >
                      {/if}
                      <span class="cn-tables-ingestionreviewtable-369-1"
                        >{row.amount ?? "—"}</span
                      >
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {:else}
    <div class="cn-tables-ingestionreviewtable-383-1">
      {emptyLabel}
    </div>
  {/if}
</section>

<style>
  .review-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(10rem, 22rem);
  }

  .review-grid--header {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  @media (max-width: 640px) {
    .review-grid--row {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .review-grid--row > :last-child {
      grid-column: 2;
    }
  }
</style>
