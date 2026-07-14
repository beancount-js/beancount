<script lang="ts">
  import Moon from "lucide-svelte/icons/moon";
  import Sun from "lucide-svelte/icons/sun";
  import { toggleMode } from "mode-watcher";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Button } from "$lib/components/ui/button";

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
  <div class="flex shrink-0 items-center">
    <Button
      variant="ghost"
      size="icon"
      class="size-8"
      aria-label="Toggle theme"
      title="Toggle theme"
      onclick={toggleMode}
    >
      <span class="relative grid place-items-center">
        <Sun
          class="transition-[transform,opacity] motion-reduce:transition-none dark:-rotate-90 dark:opacity-0"
        />
        <Moon
          class="absolute rotate-90 opacity-0 transition-[transform,opacity] motion-reduce:transition-none dark:rotate-0 dark:opacity-100"
        />
      </span>
    </Button>
    <Sidebar.Trigger
      class="hidden size-8 md:inline-flex"
      aria-label="Collapse sidebar"
      title="Collapse sidebar"
    />
    <Sidebar.Trigger
      class="size-8 md:hidden"
      aria-label="Close sidebar"
      title="Close sidebar"
    />
  </div>
</div>

<div class="hidden justify-center group-data-[collapsible=icon]:flex">
  <Sidebar.Trigger
    class="size-8"
    aria-label="Expand sidebar"
    title="Expand sidebar"
  />
</div>
