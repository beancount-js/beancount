<script lang="ts">
  import type { JournalRecord } from "./journal-table/model";
  import AccountBulkActionSheet from "@lapis/ui/tables/AccountBulkActionSheet.svelte";
  import { LedgerSource } from "../core/ledger";
  import { useContext } from "../context";
  import {
    accountsInRecords,
    applyPatchesToContents,
    buildAccountReplacePatches,
    groupPatchesByPath,
    type AccountReplacePatch,
  } from "../lib/account-bulk-replace";
  import { buildDuplicateDeletePatches } from "../lib/journal-duplicates";
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

  let fromAccount = $state("");
  let toAccount = $state("");
  let applying = $state(false);
  let errors = $state<string[]>([]);
  let status = $state("");

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
    if (toAccount && !options.some((option) => option.value === toAccount)) {
      options.push({ value: toAccount, label: toAccount });
    }
    return options;
  });

  const preview = $derived(
    buildAccountReplacePatches(records, fromAccount, toAccount),
  );

  const duplicatePlan = $derived(buildDuplicateDeletePatches(records));

  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      seedForm();
    }
    wasOpen = open;
  });

  function seedForm() {
    const scoped = accountsInRecords(records);
    fromAccount =
      focusedAccount && scoped.includes(focusedAccount)
        ? focusedAccount
        : (scoped[0] ?? "");
    toAccount = "";
    errors = [];
    status = "";
  }

  function clearForm() {
    fromAccount = "";
    toAccount = "";
    errors = [];
    status = "";
    applying = false;
  }

  function handleClosed() {
    clearForm();
    onClosed?.();
  }

  async function applyPatches(
    patches: readonly AccountReplacePatch[],
    failureMessage: string,
  ) {
    applying = true;
    errors = [];
    status = "";
    try {
      const currentSnapshot = $snapshot;
      if (!currentSnapshot) {
        throw new Error("No project is selected.");
      }

      const byPath = groupPatchesByPath(patches);
      let workingFiles = currentSnapshot.ledgerFiles.map((file) => ({
        path: file.path,
        contents: file.contents,
      }));

      for (const [path, filePatches] of byPath) {
        const file = workingFiles.find((item) => item.path === path);
        if (!file) {
          throw new Error(`Source file is no longer available: ${path}`);
        }
        const contents = applyPatchesToContents(file.contents, filePatches);
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

      open = false;
      status = "Applied.";
      onApplied?.();
    } catch (error) {
      errors = [error instanceof Error ? error.message : failureMessage];
      status = "";
    } finally {
      applying = false;
    }
  }

  async function applyReplace({
    fromAccount: nextFrom,
    toAccount: nextTo,
  }: {
    fromAccount: string;
    toAccount: string;
  }) {
    if (!canApply(nextFrom, nextTo)) return;
    const confirmed = window.confirm(
      `Replace ${nextFrom} → ${nextTo} in ${preview.changedCount} record${
        preview.changedCount === 1 ? "" : "s"
      }?`,
    );
    if (!confirmed) return;
    fromAccount = nextFrom;
    toAccount = nextTo;
    await applyPatches(
      preview.patches,
      "Unable to replace accounts in the selection.",
    );
  }

  async function applyDeleteDuplicates() {
    if (!canDeleteDuplicates()) return;
    const confirmed = window.confirm(
      `Delete ${duplicatePlan.deleteCount} duplicate record${
        duplicatePlan.deleteCount === 1 ? "" : "s"
      } and keep ${duplicatePlan.keepCount} original${
        duplicatePlan.keepCount === 1 ? "" : "s"
      }?`,
    );
    if (!confirmed) return;
    await applyPatches(
      duplicatePlan.patches,
      "Unable to delete duplicates in the selection.",
    );
  }

  function canApply(nextFrom: string, nextTo: string) {
    return (
      Boolean(nextFrom) &&
      Boolean(nextTo) &&
      nextFrom !== nextTo &&
      preview.changedCount > 0 &&
      !applying
    );
  }

  function canDeleteDuplicates() {
    return duplicatePlan.deleteCount > 0 && !applying;
  }

  function applyReplacement({
    fromAccount: nextFrom,
    toAccount: nextTo,
  }: {
    fromAccount: string;
    toAccount: string;
  }) {
    void applyReplace({ fromAccount: nextFrom, toAccount: nextTo });
  }
</script>

<AccountBulkActionSheet
  bind:open
  recordCount={records.length}
  bind:fromAccount
  bind:toAccount
  {fromOptions}
  {toOptions}
  replacement={{
    changedCount: preview.changedCount,
    skippedCount: preview.skipped.length ? preview.skipped.length : undefined,
  }}
  duplicates={{
    groupCount: duplicatePlan.groups.length,
    deleteCount: duplicatePlan.deleteCount,
    keepCount: duplicatePlan.keepCount,
    skippedCount: duplicatePlan.skipped.length
      ? duplicatePlan.skipped.length
      : undefined,
  }}
  {applying}
  {errors}
  {status}
  onApplyReplacement={applyReplacement}
  onDeleteDuplicates={applyDeleteDuplicates}
  onClosed={handleClosed}
/>
