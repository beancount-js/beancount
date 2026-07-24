<script lang="ts">
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import Settings from "lucide-svelte/icons/settings";
  import { Button } from "../shadcn/button";

  let {
    projectName = "No project",
    settingsOpen = false,
    showCloseSidebar = true,
    onOpenLedgerSettings = () => {},
    onCloseSidebar = () => {},
  }: {
    projectName?: string;
    /** Controlled by the application route or workspace state. */
    settingsOpen?: boolean;
    showCloseSidebar?: boolean;
    onOpenLedgerSettings?: () => void;
    onCloseSidebar?: () => void;
  } = $props();
</script>

<div
  class="flex items-center gap-2 group-data-[collapsible=icon]:hidden"
  data-studio-shell-header
>
  <div
    class="grid size-8 place-items-center rounded-md bg-primary font-semibold text-primary-foreground"
    aria-hidden="true"
  >
    B
  </div>
  <div class="min-w-0 flex-1">
    <p class="truncate text-sm font-semibold leading-tight">Beancount Studio</p>
    <p class="truncate text-xs text-muted-foreground">{projectName}</p>
  </div>
  <Button
    type="button"
    variant="ghost"
    size="icon"
    class="size-8 shrink-0"
    aria-label="Ledger settings"
    title="Ledger settings"
    aria-pressed={settingsOpen}
    onclick={onOpenLedgerSettings}
  >
    <Settings aria-hidden="true" />
  </Button>
  {#if showCloseSidebar}
    <Button
      type="button"
      variant="ghost"
      size="icon"
      class="size-8 md:hidden"
      aria-label="Close sidebar"
      title="Close sidebar"
      onclick={onCloseSidebar}
    >
      <ChevronLeft aria-hidden="true" />
    </Button>
  {/if}
</div>
