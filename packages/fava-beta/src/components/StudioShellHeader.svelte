<script lang="ts">
  import StudioShellHeader from "@lapis/ui/layout/StudioShellHeader.svelte";
  import { useSidebar } from "@lapis/ui/shadcn/sidebar";
  import { useStudioWorkspace } from "../studio/workspace";

  export let projectName = "No project";
  export let onOpenLedgerSettings: (() => void) | undefined = undefined;

  const { ledgerSidebarMode } = useStudioWorkspace();
  const sidebar = useSidebar();

  function openLedgerSettings() {
    onOpenLedgerSettings?.();
    ledgerSidebarMode.set("settings");
  }
</script>

<StudioShellHeader
  {projectName}
  settingsOpen={$ledgerSidebarMode === "settings"}
  onOpenLedgerSettings={openLedgerSettings}
  onCloseSidebar={sidebar.toggle}
/>
