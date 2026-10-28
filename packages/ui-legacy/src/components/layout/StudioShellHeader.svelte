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

<div class="cn-layout-studioshellheader-23-1" data-studio-shell-header>
  <div class="cn-layout-studioshellheader-27-1" aria-hidden="true">B</div>
  <div class="cn-layout-studioshellheader-32-1">
    <p class="cn-layout-studioshellheader-33-1">Beancount Studio</p>
    <p class="cn-layout-studioshellheader-34-1">{projectName}</p>
  </div>
  <Button
    type="button"
    variant="ghost"
    size="icon"
    class="cn-layout-studioshellheader-40-1"
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
      class="cn-layout-studioshellheader-53-1"
      aria-label="Close sidebar"
      title="Close sidebar"
      onclick={onCloseSidebar}
    >
      <ChevronLeft aria-hidden="true" />
    </Button>
  {/if}
</div>
