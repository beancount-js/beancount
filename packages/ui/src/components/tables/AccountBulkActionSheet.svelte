<script lang="ts">
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import X from "lucide-svelte/icons/x";
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";
  import FormField from "../forms/FormField.svelte";
  import FormSectionHeader from "../forms/FormSectionHeader.svelte";
  import type { FilterCommandOption } from "../forms/picker-options";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import * as Sheet from "../shadcn/sheet";
  import * as Tooltip from "../shadcn/tooltip";

  export type AccountReplacementSummary = {
    changedCount: number;
    skippedCount?: number;
  };

  export type DuplicateDeletionSummary = {
    groupCount: number;
    deleteCount: number;
    keepCount: number;
    skippedCount?: number;
  };

  let {
    open = $bindable(false),
    recordCount,
    fromAccount = $bindable(""),
    toAccount = $bindable(""),
    fromOptions,
    toOptions,
    replacement,
    duplicates,
    applying = false,
    errors = [],
    status,
    onApplyReplacement = () => {},
    onDeleteDuplicates = () => {},
    onClosed = () => {},
  }: {
    open?: boolean;
    recordCount: number;
    fromAccount?: string;
    toAccount?: string;
    fromOptions: readonly FilterCommandOption[];
    toOptions: readonly FilterCommandOption[];
    /** Counts calculated by the application from the selected records. */
    replacement: AccountReplacementSummary;
    /** Duplicate analysis calculated by the application from the selected records. */
    duplicates: DuplicateDeletionSummary;
    applying?: boolean;
    errors?: readonly string[];
    /** Application feedback displayed after an action completes. */
    status?: string;
    onApplyReplacement?: (selection: {
      fromAccount: string;
      toAccount: string;
    }) => void;
    onDeleteDuplicates?: () => void;
    onClosed?: () => void;
  } = $props();

  const sectionTitleClass =
    "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  let openSections = $state<Record<"replace" | "duplicates", boolean>>({
    replace: true,
    duplicates: true,
  });
  let sheetTitleEl = $state<HTMLElement | null>(null);

  const canApply = $derived(
    Boolean(fromAccount) &&
      Boolean(toAccount) &&
      fromAccount !== toAccount &&
      replacement.changedCount > 0 &&
      !applying,
  );
  const canDeleteDuplicates = $derived(duplicates.deleteCount > 0 && !applying);
  const sectionsCollapsedAll = $derived(
    Object.values(openSections).every((sectionOpen) => sectionOpen === false),
  );

  function isSectionOpen(id: "replace" | "duplicates") {
    return openSections[id];
  }

  function toggleSection(id: "replace" | "duplicates") {
    openSections = { ...openSections, [id]: !isSectionOpen(id) };
  }

  function toggleCollapseAll() {
    const shouldExpand = sectionsCollapsedAll;
    openSections = { replace: shouldExpand, duplicates: shouldExpand };
  }

  function handleOpenChange(next: boolean) {
    open = next;
    if (!next) onClosed();
  }
</script>

<Tooltip.Provider delayDuration={0}>
  <Sheet.Root {open} onOpenChange={handleOpenChange}>
    <Sheet.Content
      side="right"
      class="cn-tables-accountbulkactionsheet-109-1"
      data-account-bulk-action-sheet
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        sheetTitleEl?.focus();
      }}
    >
      <Sheet.Header class="cn-tables-accountbulkactionsheet-117-1">
        <div class="cn-tables-accountbulkactionsheet-119-1">
          <Sheet.Title
            bind:ref={sheetTitleEl}
            tabindex={-1}
            class="cn-tables-accountbulkactionsheet-123-1 account-bulk-sheet-title"
          >
            Bulk actions
          </Sheet.Title>
          <span class="cn-tables-accountbulkactionsheet-128-1"
            >{recordCount}</span
          >
        </div>
        <Sheet.Description class="sr-only">
          Bulk actions on {recordCount} selected record{recordCount === 1
            ? ""
            : "s"}.
        </Sheet.Description>
        <div class="cn-tables-accountbulkactionsheet-137-1">
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="cn-tables-accountbulkactionsheet-146-1"
                  aria-label={sectionsCollapsedAll
                    ? "Expand all"
                    : "Collapse all"}
                  onclick={toggleCollapseAll}
                >
                  {#if sectionsCollapsedAll}
                    <ChevronsUpDown
                      class="cn-tables-accountbulkactionsheet-153-1"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronsDownUp
                      class="cn-tables-accountbulkactionsheet-155-1"
                      aria-hidden="true"
                    />
                  {/if}
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {sectionsCollapsedAll ? "Expand all" : "Collapse all"}
            </Tooltip.Content>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Sheet.Close
                  {...props}
                  class="cn-tables-accountbulkactionsheet-169-1"
                  aria-label="Close"
                >
                  <X
                    class="cn-tables-accountbulkactionsheet-172-1"
                    aria-hidden="true"
                  />
                  <span class="sr-only">Close</span>
                </Sheet.Close>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Close</Tooltip.Content>
          </Tooltip.Root>
        </div>
      </Sheet.Header>

      <div class="cn-tables-accountbulkactionsheet-182-1">
        {#if errors.length}
          <Alert.Root
            variant="destructive"
            class="cn-tables-accountbulkactionsheet-184-1"
          >
            <CircleAlert />
            <Alert.Title>Could not apply bulk action</Alert.Title>
            <Alert.Description class="cn-tables-accountbulkactionsheet-187-1"
              >{errors.join("\n")}</Alert.Description
            >
          </Alert.Root>
        {/if}

        {#if status}
          <p class="cn-tables-accountbulkactionsheet-194-1" role="status">
            {status}
          </p>
        {/if}

        <div class="cn-tables-accountbulkactionsheet-199-1 account-bulk-form">
          <section class="cn-tables-accountbulkactionsheet-200-1">
            <FormSectionHeader
              title="Replace"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("replace")}
              onToggle={() => toggleSection("replace")}
            />
            {#if isSectionOpen("replace")}
              <div class="account-bulk-section-body">
                <div class="beancount-structured-form">
                  <FormField
                    label="Account is"
                    as="div"
                    align="center"
                    controlId="account-bulk-from"
                  >
                    <FilterCommandPicker
                      fullWidth
                      label="Account"
                      ariaLabel="Account to replace"
                      placeholder="Filter accounts…"
                      value={fromAccount}
                      options={[...fromOptions]}
                      onChange={(next) => {
                        fromAccount = next;
                      }}
                    />
                  </FormField>
                  <FormField
                    label="Replace with"
                    as="div"
                    align="center"
                    controlId="account-bulk-to"
                  >
                    <FilterCommandPicker
                      fullWidth
                      allowCustom={true}
                      label="Replacement account"
                      ariaLabel="Replacement account"
                      placeholder="Filter or type an account…"
                      value={toAccount}
                      options={[...toOptions]}
                      onChange={(next) => {
                        toAccount = next;
                      }}
                    />
                  </FormField>
                </div>
                {#if fromAccount && toAccount && fromAccount !== toAccount}
                  <p class="cn-tables-accountbulkactionsheet-253-1">
                    {replacement.changedCount} record{replacement.changedCount ===
                    1
                      ? ""
                      : "s"} will be updated{#if replacement.skippedCount}
                      ; {replacement.skippedCount} skipped{/if}.
                  </p>
                {/if}
                <Button
                  type="button"
                  disabled={!canApply}
                  onclick={() => onApplyReplacement({ fromAccount, toAccount })}
                >
                  {applying ? "Applying…" : "Apply"}
                </Button>
              </div>
            {/if}
          </section>

          <section class="cn-tables-accountbulkactionsheet-272-1">
            <FormSectionHeader
              title="Delete duplicates"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("duplicates")}
              onToggle={() => toggleSection("duplicates")}
            />
            {#if isSectionOpen("duplicates")}
              <div class="account-bulk-section-body">
                <p class="cn-tables-accountbulkactionsheet-285-1">
                  {#if duplicates.groupCount === 0}
                    No duplicates found in the selection. Matching uses a source
                    fingerprint when present, otherwise the record identity and
                    posting amounts.
                  {:else}
                    {duplicates.groupCount} duplicate group{duplicates.groupCount ===
                    1
                      ? ""
                      : "s"} · {duplicates.deleteCount} record{duplicates.deleteCount ===
                    1
                      ? ""
                      : "s"} will be deleted · {duplicates.keepCount} kept{#if duplicates.skippedCount}
                      ; {duplicates.skippedCount} skipped (no source){/if}.
                  {/if}
                </p>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canDeleteDuplicates}
                  aria-label="Delete duplicate records"
                  onclick={onDeleteDuplicates}
                >
                  {applying ? "Deleting…" : "Delete duplicates"}
                </Button>
              </div>
            {/if}
          </section>
        </div>
      </div>
    </Sheet.Content>
  </Sheet.Root>
</Tooltip.Provider>

<style>
  .account-bulk-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .account-bulk-section-body {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
  }

  :global(.account-bulk-sheet-title),
  .account-bulk-form :global(.beancount-form-section-title-toggle),
  .account-bulk-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
