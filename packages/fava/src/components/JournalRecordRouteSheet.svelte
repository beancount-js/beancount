<script lang="ts">
  import { Transaction, type DirectiveBase } from "@beancount-js/beancount";
  import { tick } from "svelte";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import {
    findDirectiveByRecordAnchor,
    findDirectiveByRecordKey,
    journalRecordAnchor,
    journalRecordKey,
  } from "../lib/journal-record-key";
  import JournalEditorSheet from "./JournalEditorSheet.svelte";
  import { useStudioWorkspace } from "../studio/workspace";
  import {
    REVIEW_CONNECTION_META,
    REVIEW_PROPOSAL_META,
    REVIEW_RUN_META,
  } from "../ingestion/review-ledger";

  const { activeRoute, router } = useNavigation();
  const { ledgerData } = useContext();
  const { activeLedgerKind } = useStudioWorkspace();

  let editorOpen = $state(false);
  let sheetDirective = $state<DirectiveBase | undefined>(undefined);
  let boundKey = $state("");
  let pendingRecordKey = $state("");
  /** True while we are deferring open past the click gesture. */
  let opening = $state(false);
  let openGeneration = 0;

  const routeRecord = $derived($activeRoute.query.record);
  const allDirectives = $derived($ledgerData.directives);

  function clearRecordParam() {
    const query = new URLSearchParams($activeRoute.query);
    if (!query.has("record")) return;
    query.delete("record");
    const next = query.toString();
    // Match ActivityTable: query-only updates keep the current view path.
    void router.updateState(next ? `?${next}` : "?");
  }

  function updateRecordParam(key: string) {
    const query = new URLSearchParams($activeRoute.query);
    if (query.get("record") === key) return;
    pendingRecordKey = key;
    query.set("record", key);
    void router.updateState(`?${query.toString()}`);
  }

  function resetSheet() {
    openGeneration += 1;
    opening = false;
    editorOpen = false;
    sheetDirective = undefined;
    boundKey = "";
    pendingRecordKey = "";
  }

  async function openSheetFor(key: string, directive: DirectiveBase) {
    const generation = ++openGeneration;
    opening = true;
    sheetDirective = directive;
    boundKey = key;
    // Opening in the same click turn lets the pointer-up count as an outside
    // dismiss on the freshly mounted sheet. Wait a frame after the gesture.
    editorOpen = false;
    await tick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    if (generation !== openGeneration || boundKey !== key) return;
    editorOpen = true;
    opening = false;
  }

  function openReviewProposal(directive: DirectiveBase) {
    if ($activeLedgerKind !== "ingestion-review") return false;
    if (!(directive instanceof Transaction)) return false;
    const runId = String(directive.meta[REVIEW_RUN_META] ?? "");
    const proposalId = String(directive.meta[REVIEW_PROPOSAL_META] ?? "");
    const sourceId = String(directive.meta[REVIEW_CONNECTION_META] ?? "");
    if (!runId || !proposalId) return false;

    const query = new URLSearchParams($activeRoute.query);
    query.delete("record");
    query.set("runId", runId);
    query.set("proposalId", proposalId);
    if (sourceId) query.set("sourceId", sourceId);
    router.push(`/records?${query.toString()}`);
    return true;
  }

  $effect(() => {
    const key = routeRecord;
    if (!key) {
      if (editorOpen || sheetDirective || boundKey || opening) resetSheet();
      return;
    }

    const found = findDirectiveByRecordKey(allDirectives, key);
    if (!found) {
      if (pendingRecordKey === key) return;
      const relocated = findDirectiveByRecordAnchor(
        allDirectives,
        sheetDirective ? journalRecordAnchor(sheetDirective) : undefined,
      );
      if (relocated) {
        const nextKey = journalRecordKey(relocated);
        boundKey = nextKey;
        sheetDirective = relocated;
        updateRecordParam(nextKey);
      }
      // Keep ?record= while the ledger is still loading or a record was edited
      // externally. The editor can still re-locate unchanged source content
      // before it saves.
      return;
    }

    if (openReviewProposal(found)) {
      resetSheet();
      return;
    }

    if (boundKey !== key) {
      void openSheetFor(key, found);
      return;
    }

    pendingRecordKey = "";
    sheetDirective = found;
    if (!editorOpen && !opening) {
      // User dismissed the sheet while the URL still has record — clear it.
      clearRecordParam();
    }
  });
</script>

{#if sheetDirective}
  <JournalEditorSheet
    directive={sheetDirective}
    bind:open={editorOpen}
    onRecordKeyChange={updateRecordParam}
  />
{/if}
