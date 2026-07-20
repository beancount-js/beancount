<script lang="ts">
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import X from "lucide-svelte/icons/x";
  import type { Snippet } from "svelte";
  import { cn } from "../../lib/utils.js";
  import { Button } from "../shadcn/button";
  import * as Sheet from "../shadcn/sheet";

  let {
    open = $bindable(false),
    title,
    description,
    collapsedAll = undefined,
    onToggleCollapse = undefined,
    onOpenChange = undefined,
    titleLeading,
    titleSuffix,
    actions,
    bodyClass = "px-6 py-5",
    class: className,
    children,
  }: {
    /** Whether the sheet is visible. Bind this to the workflow's state. */
    open?: boolean;
    /** Concise, visible name of the editing workflow. */
    title: string;
    /** Accessible summary of the workflow, announced by the dialog. */
    description: string;
    /** The current state of every descendant disclosure, when the form is collapsible. */
    collapsedAll?: boolean;
    /** Collapses or expands every descendant disclosure. Required with `collapsedAll`. */
    onToggleCollapse?: () => void;
    /** Called when the user opens or closes the sheet. */
    onOpenChange?: (open: boolean) => void;
    /** Optional visual context before the title, such as an avatar. */
    titleLeading?: Snippet;
    /** Optional compact context after the title, such as a record count. */
    titleSuffix?: Snippet;
    /** Optional workflow-specific controls placed before collapse and close. */
    actions?: Snippet;
    /** Padding for the scrollable body; use only for a deliberate dense layout. */
    bodyClass?: string;
    class?: string;
    children: Snippet;
  } = $props();

  let titleElement = $state<HTMLElement | null>(null);
  const collapseLabel = $derived(collapsedAll ? "Expand all" : "Collapse all");
  const hasCollapseControl = $derived(
    collapsedAll !== undefined && onToggleCollapse !== undefined,
  );

  function handleOpenChange(next: boolean) {
    open = next;
    onOpenChange?.(next);
  }
</script>

<Sheet.Root {open} onOpenChange={handleOpenChange}>
  <Sheet.Content
    side="right"
    class={cn(
      "flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button.absolute]:hidden",
      className,
    )}
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      titleElement?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left sm:text-left"
    >
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        {#if titleLeading}
          {@render titleLeading()}
        {/if}
        <Sheet.Title
          bind:ref={titleElement}
          tabindex={-1}
          class="form-sheet-title min-w-0 truncate leading-none outline-none"
        >
          {title}
        </Sheet.Title>
        {#if titleSuffix}
          {@render titleSuffix()}
        {/if}
      </div>
      <Sheet.Description class="sr-only">{description}</Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        {#if actions}
          {@render actions()}
        {/if}
        {#if hasCollapseControl}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="size-8"
            aria-label={collapseLabel}
            title={collapseLabel}
            onclick={onToggleCollapse}
          >
            {#if collapsedAll}
              <ChevronsUpDown class="size-4" aria-hidden="true" />
            {:else}
              <ChevronsDownUp class="size-4" aria-hidden="true" />
            {/if}
          </Button>
        {/if}
        <Sheet.Close
          class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
          title="Close"
        >
          <X class="size-4" />
          <span class="sr-only">Close</span>
        </Sheet.Close>
      </div>
    </Sheet.Header>

    <div class={cn("min-h-0 flex-1 overflow-y-auto", bodyClass)}>
      {@render children()}
    </div>
  </Sheet.Content>
</Sheet.Root>
