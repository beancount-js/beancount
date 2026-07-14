<script lang="ts">
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import * as Sidebar from "$lib/components/ui/sidebar";

  export let projectName = "No project";
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
  <Sidebar.Trigger
    class="size-8 md:hidden"
    aria-label="Close sidebar"
    title="Close sidebar"
  >
    <ChevronLeft />
    <span class="sr-only">Close sidebar</span>
  </Sidebar.Trigger>
</div>
