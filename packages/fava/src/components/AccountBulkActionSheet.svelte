<script lang="ts">
  import {
    FilterCommandPicker,
    FormField,
    FormSectionHeader,
  } from "@beancount-js/forms";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import X from "lucide-svelte/icons/x";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { useContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import {
    accountsInRecords,
    applyPatchesToContents,
    buildAccountReplacePatches,
    groupPatchesByPath,
  } from "../lib/account-bulk-replace";
  import type { JournalRecord } from "./journal-table/model";
  import { useStudioWorkspace } from "../studio/workspace";

  type Props = {
    open?: boolean;
    records: JournalRecord[];
    focusedAccount?: string;
    onApplied?: () => void;
    onClosed?: () => void;
  };

  let {
    open = $bindable(false),
    records,
    focusedAccount = "",
    onApplied,
    onClosed,
  }: Props = $props();

  const { accounts, ledgerSource } = useContext();
  const { snapshot, saveFile } = useStudioWorkspace();

  const sectionTitleClass =
    "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  let fromAccount = $state("");
  let toAccount = $state("");
  let openSections = $state<Record<string, boolean>>({ replace: true });
  let applying = $state(false);
  let errors = $state<string[]>([]);
  let sheetTitleEl = $state<HTMLElement | null>(null);

  const fromOptions = $derived(
    accountsInRecords(records).map((account) => ({
      value: account,
      label: account,
    })),
  );

  const toOptions = $derived.by(() => {
    const options = $accounts.map((account) => ({
      value: account,
      label: account,
    }));
    if (
      toAccount &&
      !options.some((option) => option.value === toAccount)
    ) {
      options.push({ value: toAccount, label: toAccount });
    }
    return options;
  });

  const preview = $derived(
    buildAccountReplacePatches(records, fromAccount, toAccount),
  );

  const canApply = $derived(
    Boolean(fromAccount) &&
      Boolean(toAccount) &&
      fromAccount !== toAccount &&
      preview.changedCount > 0 &&
      !applying,
  );

  const sectionsCollapsedAll = $derived(
    Object.values(openSections).every((sectionOpen) => sectionOpen === false),
  );

  function isSectionOpen(id: string) {
    return openSections[id] !== false;
  }

  function toggleSection(id: string) {
    openSections = { ...openSections, [id]: !isSectionOpen(id) };
  }

  function toggleCollapseAll() {
    const next = !sectionsCollapsedAll;
    openSections = Object.fromEntries(
      Object.keys(openSections).map((key) => [key, !next]),
    );
  }

  function seedForm() {
    const scoped = accountsInRecords(records);
    fromAccount =
      focusedAccount && scoped.includes(focusedAccount)
        ? focusedAccount
        : (scoped[0] ?? "");
    toAccount = "";
    errors = [];
    applying = false;
    openSections = { replace: true };
  }

  function resetForm() {
    fromAccount = "";
    toAccount = "";
    errors = [];
    applying = false;
    openSections = { replace: true };
  }

  let wasOpen = false;
  $effect(() => {
    const isOpen = open;
    if (isOpen && !wasOpen) {
      seedForm();
    }
    wasOpen = isOpen;
  });

  function handleOpenChange(next: boolean) {
    open = next;
    if (!next) {
      resetForm();
      onClosed?.();
    }
  }

  async function applyReplace() {
    if (!canApply) return;
    const confirmed = window.confirm(
      `Replace ${fromAccount} → ${toAccount} in ${preview.changedCount} record${preview.changedCount === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;

    applying = true;
    errors = [];
    try {
      const currentSnapshot = $snapshot;
      if (!currentSnapshot) {
        throw new Error("No project is selected.");
      }

      const byPath = groupPatchesByPath(preview.patches);
      let workingFiles = currentSnapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      }));

      for (const [path, patches] of byPath) {
        const file = workingFiles.find((item) => item.path === path);
        if (!file) {
          throw new Error(`Source file is no longer available: ${path}`);
        }
        const contents = applyPatchesToContents(file.contents, patches);
        workingFiles = workingFiles.map((item) =>
          item.path === path ? { path, contents } : item,
        );

        const candidate = LedgerSource.fromProject(
          currentSnapshot.project.entryFile,
          workingFiles,
          $ledgerSource.props,
        );
        const currentErrors = new Set(
          $ledgerSource.errors.map((error) => error.message),
        );
        const introduced = candidate.errors.filter(
          (error) => !currentErrors.has(error.message),
        );
        if (introduced.length) {
          throw new Error(introduced.map((error) => error.message).join("\n"));
        }

        await saveFile(path, contents);
      }

      handleOpenChange(false);
      onApplied?.();
    } catch (error) {
      errors = [
        error instanceof Error
          ? error.message
          : "Unable to replace accounts in the selection.",
      ];
    } finally {
      applying = false;
    }
  }
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button.absolute]:hidden"
    data-account-bulk-action-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <Sheet.Title
          bind:ref={sheetTitleEl}
          tabindex={-1}
          class="account-bulk-sheet-title min-w-0 truncate leading-none outline-none"
        >
          Bulk actions
        </Sheet.Title>
        <span
          class="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          >{records.length}</span
        >
      </div>
      <Sheet.Description class="sr-only">
        Bulk actions on {records.length} selected record{records.length === 1
          ? ""
          : "s"}.
      </Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  props.onclick?.(event);
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown class="size-4" aria-hidden="true" />
                {:else}
                  <ChevronsDownUp class="size-4" aria-hidden="true" />
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
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X class="size-4" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      {#if errors.length}
        <Alert.Root variant="destructive" class="mb-3">
          <CircleAlert />
          <Alert.Title>Could not replace accounts</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="account-bulk-form flex min-w-0 flex-col gap-6 pl-6">
        <section class="flex flex-col gap-2">
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
                    options={fromOptions}
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
                    options={toOptions}
                    onChange={(next) => {
                      toAccount = next;
                    }}
                  />
                </FormField>
              </div>
              {#if fromAccount && toAccount && fromAccount !== toAccount}
                <p class="text-xs text-muted-foreground">
                  {preview.changedCount} record{preview.changedCount === 1
                    ? ""
                    : "s"} will be updated{#if preview.skipped.length}
                    ; {preview.skipped.length} skipped{/if}.
                </p>
              {/if}
              <Button
                type="button"
                disabled={!canApply}
                onclick={() => void applyReplace()}
              >
                {applying ? "Applying…" : "Apply"}
              </Button>
            </div>
          {/if}
        </section>
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .account-bulk-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .account-bulk-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
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
