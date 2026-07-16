<script lang="ts">
  import type { DirectiveBase } from "@beancount-js/beancount";
  import { tick } from "svelte";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { findDirectiveByRecordKey } from "../lib/journal-record-key";
  import JournalEditorSheet from "./JournalEditorSheet.svelte";

  const { activeRoute, router } = useNavigation();
  const { ledgerData } = useContext();

  let editorOpen = $state(false);
  let sheetDirective = $state<DirectiveBase | undefined>(undefined);
  let boundKey = $state("");
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

  function resetSheet() {
    openGeneration += 1;
    opening = false;
    editorOpen = false;
    sheetDirective = undefined;
    boundKey = "";
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

  $effect(() => {
    const key = routeRecord;
    if (!key) {
      if (editorOpen || sheetDirective || boundKey || opening) resetSheet();
      return;
    }

    const found = findDirectiveByRecordKey(allDirectives, key);
    if (!found) {
      // Keep ?record= while the ledger is still loading.
      return;
    }

    if (boundKey !== key) {
      void openSheetFor(key, found);
      return;
    }

    sheetDirective = found;
    if (!editorOpen && !opening) {
      // User dismissed the sheet while the URL still has record — clear it.
      clearRecordParam();
    }
  });
</script>

{#if sheetDirective}
  <JournalEditorSheet directive={sheetDirective} bind:open={editorOpen} />
{/if}
