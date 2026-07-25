<script lang="ts">
  import type { DirectiveBase } from "@beancount-js/beancount";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import {
    JournalEditorSheet as SharedJournalEditorSheet,
    type MerchantPickerMerchant,
  } from "@lapis/ui/forms";
  import { useContext } from "../context";
  import {
    findDirectiveByRecordAnchor,
    journalRecordAnchor,
    journalRecordKey,
    type JournalRecordAnchor,
  } from "../lib/journal-record-key";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { LedgerSource } from "../core/ledger";

  type Props = {
    directive: DirectiveBase;
    open?: boolean;
    onRecordKeyChange?: (key: string) => void;
  };

  let {
    directive,
    open = $bindable(false),
    onRecordKeyChange = () => {},
  }: Props = $props();

  const { accounts, currencies, tags: ledgerTags, ledgerSource } = useContext();
  const { snapshot, saveFile, refreshSnapshot } = useStudioWorkspace();

  let recordAnchor = $state<JournalRecordAnchor | undefined>(undefined);
  let loadedDirective = $state<DirectiveBase | undefined>(undefined);
  let merchants = $state<MerchantPickerMerchant[]>([]);

  const merchantProjectId = $derived($snapshot?.project.id ?? "");
  const accountList = $derived([...$accounts]);
  const currencyList = $derived([...$currencies]);
  const tagList = $derived([...$ledgerTags]);

  $effect(() => {
    if (directive !== loadedDirective) {
      loadedDirective = directive;
      recordAnchor = journalRecordAnchor(directive);
    }
  });

  $effect(() => {
    const nextProjectId = merchantProjectId;
    if (!nextProjectId) {
      merchants = [];
      return;
    }
    void loadMerchants(nextProjectId);
  });

  async function loadMerchants(projectId: string) {
    try {
      const listed = await ingestionJson<MerchantPickerMerchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if (projectId !== merchantProjectId) return;
      merchants = Array.isArray(listed)
        ? [...listed].sort((left, right) =>
            left.canonicalName.localeCompare(right.canonicalName),
          )
        : [];
    } catch {
      if (projectId === merchantProjectId) {
        merchants = [];
      }
    }
  }

  function errorSignature(error: { message: string }) {
    return error.message;
  }

  function currentRecordAnchor(snapshot: ProjectSnapshot) {
    const savedAnchor = recordAnchor;
    if (!savedAnchor) {
      throw new Error(
        "This record is not attached to an editable project file.",
      );
    }
    const file = snapshot.ledgerFiles.find(
      (item) => item.path === savedAnchor.filename,
    );
    if (!file) {
      throw new Error("The record's source file is no longer available.");
    }

    if (
      file.contents.slice(savedAnchor.from, savedAnchor.to) ===
      savedAnchor.content
    ) {
      return { anchor: savedAnchor, file };
    }

    const refreshed = LedgerSource.fromProject(
      snapshot.project.entryFile,
      snapshot.ledgerFiles.map((item) => ({
        path: item.path,
        contents: item.contents,
      })),
      $ledgerSource.props,
    );
    const relocated = findDirectiveByRecordAnchor(
      refreshed.directives,
      savedAnchor,
    );
    const nextAnchor = relocated && journalRecordAnchor(relocated);
    if (!nextAnchor) {
      throw new Error(
        "This record changed in another editor. Reload it before saving.",
      );
    }

    const relocatedFile = snapshot.ledgerFiles.find(
      (item) => item.path === nextAnchor.filename,
    );
    if (!relocatedFile) {
      throw new Error("The record's source file is no longer available.");
    }

    recordAnchor = nextAnchor;
    onRecordKeyChange(journalRecordKey(relocated));
    return { anchor: nextAnchor, file: relocatedFile };
  }

  function isRevisionConflict(error: unknown) {
    return (
      error instanceof Error &&
      error.message.includes("File changed since it was read")
    );
  }

  async function persist(source: string, refreshed = false): Promise<void> {
    const currentSnapshot = $snapshot;
    if (!currentSnapshot) {
      throw new Error(
        "This record is not attached to an editable project file.",
      );
    }
    const { anchor, file } = currentRecordAnchor(currentSnapshot);
    const path = anchor.filename;
    const { from } = anchor;
    const { to } = anchor;
    const contents = `${file.contents.slice(0, from)}${source}${file.contents.slice(to)}`;
    const candidate = LedgerSource.fromProject(
      currentSnapshot.project.entryFile,
      currentSnapshot.ledgerFiles.map((item) => ({
        path: item.path,
        contents: item.path === path ? contents : item.contents,
      })),
      $ledgerSource.props,
    );
    const currentErrors = new Set($ledgerSource.errors.map(errorSignature));
    const introduced = candidate.errors.filter(
      (error) => !currentErrors.has(errorSignature(error)),
    );
    if (introduced.length) {
      throw new Error(introduced.map((error) => error.message).join("\n"));
    }

    const expectedRevision = currentSnapshot.revisions.find(
      (item) => item.path === path,
    )?.revision;
    try {
      await saveFile(path, contents, expectedRevision);
    } catch (error) {
      if (!refreshed && isRevisionConflict(error)) {
        await refreshSnapshot();
        return persist(source, true);
      }
      throw error;
    }

    const saved = findDirectiveByRecordAnchor(candidate.directives, {
      filename: path,
      content: source,
      from,
      to: from + source.length,
    });
    const nextAnchor = saved && journalRecordAnchor(saved);
    if (!nextAnchor) {
      throw new Error("Could not refresh the saved record's position.");
    }
    recordAnchor = nextAnchor;
    onRecordKeyChange(journalRecordKey(saved));
  }
</script>

<SharedJournalEditorSheet
  {directive}
  accounts={accountList}
  currencies={currencyList}
  tags={tagList}
  {merchants}
  bind:open
  onSave={(source) => {
    void persist(source);
  }}
  merchantEmptyOption={{
    label: "No merchant selected",
    description: "Use the account's colour and icon instead.",
  }}
/>
