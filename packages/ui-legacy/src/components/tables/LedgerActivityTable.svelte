<script lang="ts">
  import { untrack } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import FileText from "lucide-svelte/icons/file-text";
  import SegmentedControl from "../forms/SegmentedControl.svelte";

  export type LedgerActivityAvatar = {
    imageUrl?: string;
    /** Describe a meaningful image; omit for a decorative brand mark. */
    alt?: string;
    /** Visible fallback, typically a merchant or record initial. */
    fallback?: string;
  };

  export type LedgerActivityMerchant = {
    imageUrl: string;
    alt: string;
  };

  export type LedgerActivityPosting = {
    id?: string;
    account: string;
    amount?: string;
    href?: string;
  };

  export type LedgerActivityRecord = {
    id: string;
    description: string;
    account?: string;
    amount: string;
    balance?: string;
    /** Generic record identity. Prefer this to the legacy `merchant` field. */
    avatar?: LedgerActivityAvatar;
    /** A display-ready posting breakdown for transaction-style activity. */
    postings?: readonly LedgerActivityPosting[];
    /** @deprecated Use `avatar` for new display models. */
    merchant?: LedgerActivityMerchant;
    /** Secondary text, such as transaction narration or posting detail. */
    detail?: string;
  };

  export type LedgerActivityGroup = {
    id: string;
    date: string;
    records: readonly LedgerActivityRecord[];
    balance?: string;
    summary?: {
      start: string;
      change: string;
      final: string;
    };
  };

  export type LedgerActivityTimeframe = {
    id: string;
    label: string;
  };

  let {
    groups,
    selectedIds = [],
    selectable = true,
    ariaLabel = "Ledger activity",
    amountHeading = "Amount",
    balanceDescription = "Running balance",
    emptyMessage = "No dated records match the current filter.",
    timeframes = [],
    timeframe,
    onSelectedIdsChange = () => {},
    onOpenRecord,
    onTimeframeChange = () => {},
  }: {
    groups: readonly LedgerActivityGroup[];
    selectedIds?: readonly string[];
    selectable?: boolean;
    ariaLabel?: string;
    amountHeading?: string;
    balanceDescription?: string;
    emptyMessage?: string;
    /** Two or three display modes, such as posted and upcoming activity. */
    timeframes?: readonly LedgerActivityTimeframe[];
    timeframe?: string;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRecord?: (record: LedgerActivityRecord) => void;
    onTimeframeChange?: (timeframe: string) => void;
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

  function avatarFor(record: LedgerActivityRecord): LedgerActivityAvatar {
    return record.avatar ?? record.merchant ?? {};
  }
</script>

<section class="cn-tables-ledgeractivitytable-160-1" aria-label={ariaLabel}>
  {#if timeframes.length > 1}
    <div class="cn-tables-ledgeractivitytable-162-1">
      <SegmentedControl
        value={timeframe ?? timeframes[0]!.id}
        options={timeframes.map(({ id }) => id)}
        labels={Object.fromEntries(
          timeframes.map(({ id, label }) => [id, label]),
        )}
        ariaLabel="Activity timeframe"
        onChange={onTimeframeChange}
      />
    </div>
  {/if}
  <div class="cn-tables-ledgeractivitytable-175-1">
    <div
      class={selectable
        ? "cn-tables-ledgeractivitytable-179-1 activity-grid activity-grid--selectable"
        : "cn-tables-ledgeractivitytable-180-1 activity-grid activity-grid--read-only"}
    >
      {#if selectable}
        <input
          type="checkbox"
          checked={allSelected}
          use:setIndeterminate={someSelected}
          class="cn-tables-ledgeractivitytable-187-1"
          aria-label="Select all visible records"
          onchange={(event) =>
            toggleAll((event.currentTarget as HTMLInputElement).checked)}
        />
      {/if}
      <span>Date and record</span>
      <span class="cn-tables-ledgeractivitytable-194-1">{amountHeading}</span>
    </div>

    {#if groups.length}
      <div class="cn-tables-ledgeractivitytable-198-1">
        {#each groups as group (group.id)}
          {@const expanded = expandedGroupIds.has(group.id)}
          {@const groupState = groupSelection(group)}
          <section>
            <div
              class={selectable
                ? "cn-tables-ledgeractivitytable-205-1 activity-grid activity-grid--selectable"
                : "cn-tables-ledgeractivitytable-206-1 activity-grid activity-grid--read-only"}
            >
              {#if selectable}
                <input
                  type="checkbox"
                  checked={groupState === "checked"}
                  use:setIndeterminate={groupState === "indeterminate"}
                  class="cn-tables-ledgeractivitytable-213-1"
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
                class="cn-tables-ledgeractivitytable-224-1"
                aria-expanded={expanded}
                aria-controls={`${group.id}-details`}
                onclick={() => toggleGroupDisclosure(group.id)}
              >
                {#if expanded}
                  <ChevronDown
                    class="cn-tables-ledgeractivitytable-231-1"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronRight
                    class="cn-tables-ledgeractivitytable-236-1"
                    aria-hidden="true"
                  />
                {/if}
                <span class="cn-tables-ledgeractivitytable-240-1"
                  >{group.date}</span
                >
                <span class="cn-tables-ledgeractivitytable-241-1"
                  >{group.records.length} record{group.records.length === 1
                    ? ""
                    : "s"}</span
                >
              </button>
              {#if group.balance}
                <span
                  class="cn-tables-ledgeractivitytable-249-1"
                  aria-label={`${balanceDescription}: ${group.balance}`}
                  >{group.balance}</span
                >
              {:else}
                <span aria-hidden="true"></span>
              {/if}
            </div>

            {#if expanded}
              <div
                id={`${group.id}-details`}
                class="cn-tables-ledgeractivitytable-259-1"
              >
                {#if group.summary}
                  <div
                    class="cn-tables-ledgeractivitytable-262-1"
                    aria-label={`Balance summary for ${group.date}`}
                  >
                    <span>Start balance</span>
                    <span class="cn-tables-ledgeractivitytable-267-1"></span>
                    <span class="cn-tables-ledgeractivitytable-269-1">
                      {group.summary.start}
                    </span>
                    <span>Net cash flow</span>
                    <span class="cn-tables-ledgeractivitytable-274-1"></span>
                    <span class="cn-tables-ledgeractivitytable-276-1">
                      {group.summary.change}
                    </span>
                    <span>Final balance</span>
                    <span class="cn-tables-ledgeractivitytable-281-1"></span>
                    <span class="cn-tables-ledgeractivitytable-283-1">
                      {group.summary.final}
                    </span>
                  </div>
                {/if}
                <ul>
                  {#each group.records as record (record.id)}
                    <li
                      class={selectable
                        ? "cn-tables-ledgeractivitytable-292-1 activity-grid activity-grid--selectable"
                        : "cn-tables-ledgeractivitytable-293-1 activity-grid activity-grid--read-only"}
                    >
                      {#if selectable}
                        <input
                          type="checkbox"
                          checked={selectedIdSet.has(record.id)}
                          aria-label={`Select ${record.description}`}
                          class="cn-tables-ledgeractivitytable-300-1"
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
                          class="cn-tables-ledgeractivitytable-311-1"
                          onclick={() => onOpenRecord(record)}
                        >
                          {@render ActivityRecord(record, true)}
                        </button>
                      {:else}
                        <div class="cn-tables-ledgeractivitytable-317-1">
                          {@render ActivityRecord(record)}
                        </div>
                      {/if}
                      {#if record.postings?.length}
                        <div class="cn-tables-ledgeractivitytable-322-1">
                          {#each record.postings as posting, index (`${record.id}-${posting.id ?? posting.account}-${index}`)}
                            <div class="cn-tables-ledgeractivitytable-325-1">
                              {#if posting.href}
                                <a
                                  href={posting.href}
                                  class="cn-tables-ledgeractivitytable-330-1"
                                  >{posting.account}</a
                                >
                              {:else}
                                <span
                                  class="cn-tables-ledgeractivitytable-335-1"
                                  title={posting.account}
                                  >{posting.account}</span
                                >
                              {/if}
                              <span class="cn-tables-ledgeractivitytable-341-1"
                                >{posting.amount ?? "—"}</span
                              >
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <div class="cn-tables-ledgeractivitytable-348-1">
                          {record.amount}
                        </div>
                      {/if}
                    </li>
                  {/each}
                </ul>
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {:else}
      <div class="cn-tables-ledgeractivitytable-361-1">
        {emptyMessage}
      </div>
    {/if}
  </div>
</section>

{#snippet ActivityRecord(record: LedgerActivityRecord, interactive = false)}
  {@const avatar = avatarFor(record)}
  <span class="cn-tables-ledgeractivitytable-370-1">
    {#if avatar.imageUrl}
      <img
        src={avatar.imageUrl}
        alt={avatar.alt ?? ""}
        class="cn-tables-ledgeractivitytable-375-1"
      />
    {:else}
      <span class="cn-tables-ledgeractivitytable-379-1" aria-hidden="true">
        {#if avatar.fallback}
          {avatar.fallback.slice(0, 1).toUpperCase()}
        {:else}
          <FileText class="cn-tables-ledgeractivitytable-385-1" />
        {/if}
      </span>
    {/if}
    <span class="cn-tables-ledgeractivitytable-389-1">
      <span
        class={`cn-tables-ledgeractivitytable-391-2 cn-tables-ledgeractivitytable-391-5 cn-tables-ledgeractivitytable-391-4 cn-tables-ledgeractivitytable-391-3 ${interactive ? "cn-tables-ledgeractivitytable-391-1" : ""}`}
      >
        {record.description}
      </span>
      {#if record.account}
        <span class="cn-tables-ledgeractivitytable-397-1">{record.account}</span
        >
      {/if}
      {#if record.detail}
        <span class="cn-tables-ledgeractivitytable-402-1">
          {record.detail}
        </span>
      {/if}
    </span>
  </span>
{/snippet}

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
