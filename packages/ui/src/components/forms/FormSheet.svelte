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
    class={cn("cn-forms-formsheet-64-1", className)}
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      titleElement?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-formsheet-73-1">
      <div class="cn-forms-formsheet-75-1">
        {#if titleLeading}
          {@render titleLeading()}
        {/if}
        <Sheet.Title
          bind:ref={titleElement}
          tabindex={-1}
          class="cn-forms-formsheet-82-1"
        >
          {title}
        </Sheet.Title>
        {#if titleSuffix}
          {@render titleSuffix()}
        {/if}
      </div>
      <Sheet.Description class="sr-only">{description}</Sheet.Description>
      <div class="cn-forms-formsheet-91-1">
        {#if actions}
          {@render actions()}
        {/if}
        {#if hasCollapseControl}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="cn-forms-formsheet-100-1"
            aria-label={collapseLabel}
            title={collapseLabel}
            onclick={onToggleCollapse}
          >
            {#if collapsedAll}
              <ChevronsUpDown
                class="cn-forms-formsheet-106-1"
                aria-hidden="true"
              />
            {:else}
              <ChevronsDownUp
                class="cn-forms-formsheet-108-1"
                aria-hidden="true"
              />
            {/if}
          </Button>
        {/if}
        <Sheet.Close
          class="cn-forms-formsheet-113-1"
          aria-label="Close"
          title="Close"
        >
          <X class="cn-forms-formsheet-117-1" />
          <span class="sr-only">Close</span>
        </Sheet.Close>
      </div>
    </Sheet.Header>

    <div class={cn("cn-forms-formsheet-123-1", bodyClass)}>
      {@render children()}
    </div>
  </Sheet.Content>
</Sheet.Root>
