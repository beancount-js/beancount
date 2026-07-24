<script lang="ts">
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import type { Icon } from "lucide-svelte";
  import { cn } from "../../lib/utils";
  import { Button } from "../shadcn/button";

  export type LedgerSettingsNavigationItem = {
    /** Stable application-owned destination or group identifier. */
    id: string;
    label: string;
    icon: typeof Icon;
    active?: boolean;
    /** Lets a group surface an active nested destination in its chrome. */
    groupActive?: boolean;
    disabled?: boolean;
    badge?: string;
    badgeTitle?: string;
    expanded?: boolean;
    /** Human-readable group name used in its disclosure button. */
    disclosureLabel?: string;
    children?: readonly LedgerSettingsNavigationItem[];
  };

  /**
   * Controlled settings navigation for a ledger workspace. Applications retain
   * their routing and disclosure state, and map their settings destinations to
   * this display-ready hierarchy.
   */
  let {
    items,
    ariaLabel = "Ledger settings navigation",
    backLabel = "Back",
    onBack,
    onSelect,
    onExpandedChange,
  }: {
    items: readonly LedgerSettingsNavigationItem[];
    ariaLabel?: string;
    backLabel?: string;
    onBack?: () => void;
    onSelect?: (id: string) => void;
    onExpandedChange?: (id: string, expanded: boolean) => void;
  } = $props();

  function isGroup(item: LedgerSettingsNavigationItem): boolean {
    return Boolean(item.children?.length);
  }

  function isExpanded(item: LedgerSettingsNavigationItem): boolean {
    return item.expanded ?? true;
  }

  function groupIsActive(item: LedgerSettingsNavigationItem): boolean {
    return item.groupActive ?? item.active ?? false;
  }

  function disclosureLabel(item: LedgerSettingsNavigationItem): string {
    return item.disclosureLabel ?? item.label.toLocaleLowerCase();
  }
</script>

<nav
  class="flex min-h-0 flex-1 flex-col gap-3"
  aria-label={ariaLabel}
  data-ledger-settings-navigation
  data-ledger-settings-sidebar
>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="h-8 w-full justify-start gap-2 px-2 text-left text-muted-foreground hover:bg-background hover:text-sidebar-foreground"
    aria-label="Back to ledger navigation"
    disabled={!onBack}
    onclick={() => onBack?.()}
  >
    <ArrowLeft data-icon="inline-start" />
    <span class="text-xs font-medium">{backLabel}</span>
  </Button>

  <div class="flex min-h-0 flex-1 flex-col gap-1">
    {#each items as item (item.id)}
      {@render SettingsItem({ item })}
    {/each}
  </div>
</nav>

{#snippet SettingsItem({ item }: { item: LedgerSettingsNavigationItem })}
  {@const Icon = item.icon}
  {@const expanded = isExpanded(item)}
  {#if isGroup(item)}
    <div class="flex flex-col gap-1">
      <div
        class={cn(
          "flex items-center rounded-md",
          groupIsActive(item)
            ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm"
            : "text-muted-foreground",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="ml-1 size-6 shrink-0"
          aria-label={expanded
            ? `Collapse ${disclosureLabel(item)} navigation`
            : `Expand ${disclosureLabel(item)} navigation`}
          aria-expanded={expanded}
          disabled={item.disabled || !onExpandedChange}
          onclick={() => onExpandedChange?.(item.id, !expanded)}
        >
          <ChevronDown
            class={cn("transition-transform", expanded ? "" : "-rotate-90")}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-auto min-w-0 flex-1 justify-start gap-2 px-1 py-2 text-left hover:bg-transparent"
          aria-current={item.active ? "page" : undefined}
          disabled={item.disabled || !onSelect}
          onclick={() => onSelect?.(item.id)}
        >
          <Icon data-icon="inline-start" />
          <span class="min-w-0 flex-1 truncate text-xs font-medium"
            >{item.label}</span
          >
          {#if item.badge}
            <span
              class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
              title={item.badgeTitle}
              >{item.badge}</span
            >
          {/if}
        </Button>
      </div>

      {#if expanded}
        <div class="ml-4 flex flex-col gap-1 border-l border-sidebar-border pl-2">
          {#each item.children ?? [] as child (child.id)}
            {@render SettingsItem({ item: child })}
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class={cn(
        "h-auto w-full justify-start gap-2 px-2 py-2 text-left",
        item.active
          ? "border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
          : "text-muted-foreground hover:bg-background hover:text-sidebar-foreground",
      )}
      aria-current={item.active ? "page" : undefined}
      disabled={item.disabled || !onSelect}
      onclick={() => onSelect?.(item.id)}
    >
      <Icon data-icon="inline-start" />
      <span class="min-w-0 flex-1 truncate text-xs font-medium">{item.label}</span>
      {#if item.badge}
        <span
          class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          title={item.badgeTitle}
          >{item.badge}</span
        >
      {/if}
    </Button>
  {/if}
{/snippet}
