<script lang="ts">
  import {
    FilterCommandPicker,
    FormField,
    FormSectionHeader,
  } from "@beancount-js/forms";
  import X from "lucide-svelte/icons/x";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Sheet from "$lib/components/ui/sheet";
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
  let sectionOpen = $state({ if: true, then: true });
  let applying = $state(false);
  let errors = $state<string[]>([]);

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

  function isSectionOpen(key: "if" | "then") {
    return sectionOpen[key];
  }

  function toggleSection(key: "if" | "then") {
    sectionOpen = { ...sectionOpen, [key]: !sectionOpen[key] };
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
    sectionOpen = { if: true, then: true };
  }

  function resetForm() {
    fromAccount = "";
    toAccount = "";
    errors = [];
    applying = false;
    sectionOpen = { if: true, then: true };
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
    class="flex w-full flex-col gap-0 sm:max-w-lg"
    data-account-bulk-action-sheet
  >
    <Sheet.Header
      class="flex shrink-0 flex-row items-start gap-3 border-b border-border px-6 py-4"
    >
      <div class="min-w-0 flex-1">
        <Sheet.Title class="account-bulk-sheet-title text-left"
          >Replace account</Sheet.Title
        >
        <Sheet.Description class="mt-1 text-left text-sm text-muted-foreground">
          Rewrite account names on the {records.length} selected record{records.length ===
          1
            ? ""
            : "s"}.
        </Sheet.Description>
      </div>
      <Sheet.Close
        class="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </Sheet.Close>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {#if errors.length}
        <Alert.Root variant="destructive" class="mb-5">
          <Alert.Title>Could not replace accounts</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="account-bulk-form flex min-w-0 flex-col gap-6">
        <section class="flex flex-col gap-3 pl-6">
          <FormSectionHeader
            title="If"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("if")}
            onToggle={() => toggleSection("if")}
          />
          {#if isSectionOpen("if")}
            <div class="beancount-structured-form min-w-0">
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
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-3 pl-6">
          <FormSectionHeader
            title="Then"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("then")}
            onToggle={() => toggleSection("then")}
          />
          {#if isSectionOpen("then")}
            <div class="beancount-structured-form min-w-0">
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
          {/if}
        </section>
      </div>
    </div>

    <Sheet.Footer
      class="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-border px-6 py-3"
    >
      <Sheet.Close
        class="inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Cancel
      </Sheet.Close>
      <Button
        type="button"
        disabled={!canApply}
        onclick={() => void applyReplace()}
      >
        {applying ? "Applying…" : "Apply"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>

<style>
  :global(.account-bulk-sheet-title),
  .account-bulk-form :global(.beancount-form-section-title-toggle),
  .account-bulk-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
