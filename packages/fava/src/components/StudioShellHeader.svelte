<script lang="ts">
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import Settings from "lucide-svelte/icons/settings";
  import { Button } from "$lib/components/ui/button";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { useStudioWorkspace } from "../studio/workspace";

  export let projectName = "No project";

  const { snapshot, activeFile, ledgerSidebarMode } = useStudioWorkspace();

  $: selectedLedger = $snapshot?.ledgerFiles.find(
    (file) => file.path === $activeFile,
  );

  function openLedgerSettings() {
    if (!selectedLedger) return;
    ledgerSidebarMode.set("settings");
  }
</script>

<div class="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
  <div
    class="grid size-8 place-items-center rounded-md bg-primary font-semibold text-primary-foreground"
  >
    B
  </div>
  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-semibold leading-tight">Beancount Studio</p>
    <p class="truncate text-xs text-muted-foreground">{projectName}</p>
  </div>
  {#if selectedLedger}
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="size-8 shrink-0"
      aria-label="Ledger settings"
      title="Ledger settings"
      data-ledger-settings-toggle
      onclick={openLedgerSettings}
    >
      <Settings />
    </Button>
  {/if}
  <Sidebar.Trigger
    class="size-8 md:hidden"
    aria-label="Close sidebar"
    title="Close sidebar"
  >
    <ChevronLeft />
    <span class="sr-only">Close sidebar</span>
  </Sidebar.Trigger>
</div>
