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
  class="cn-navigation-ledgersettingsnavigation-64-1"
  aria-label={ariaLabel}
  data-ledger-settings-navigation
  data-ledger-settings-sidebar
>
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class="cn-navigation-ledgersettingsnavigation-73-1"
    aria-label="Back to ledger navigation"
    disabled={!onBack}
    onclick={() => onBack?.()}
  >
    <ArrowLeft data-icon="inline-start" />
    <span class="cn-navigation-ledgersettingsnavigation-79-1">{backLabel}</span>
  </Button>

  <div class="cn-navigation-ledgersettingsnavigation-82-1">
    {#each items as item (item.id)}
      {@render SettingsItem({ item })}
    {/each}
  </div>
</nav>

{#snippet SettingsItem({ item }: { item: LedgerSettingsNavigationItem })}
  {@const Icon = item.icon}
  {@const expanded = isExpanded(item)}
  {#if isGroup(item)}
    <div class="cn-navigation-ledgersettingsnavigation-93-1">
      <div
        class={cn(
          "cn-navigation-ledgersettingsnavigation-96-1",
          groupIsActive(item)
            ? "cn-navigation-ledgersettingsnavigation-98-1"
            : "cn-navigation-ledgersettingsnavigation-99-1",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="cn-navigation-ledgersettingsnavigation-106-1"
          aria-label={expanded
            ? `Collapse ${disclosureLabel(item)} navigation`
            : `Expand ${disclosureLabel(item)} navigation`}
          aria-expanded={expanded}
          disabled={item.disabled || !onExpandedChange}
          onclick={() => onExpandedChange?.(item.id, !expanded)}
        >
          <ChevronDown
            class={cn(
              "cn-navigation-ledgersettingsnavigation-115-1",
              expanded ? "" : "cn-navigation-ledgersettingsnavigation-115-2",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="cn-navigation-ledgersettingsnavigation-122-1"
          aria-current={item.active ? "page" : undefined}
          disabled={item.disabled || !onSelect}
          onclick={() => onSelect?.(item.id)}
        >
          <Icon data-icon="inline-start" />
          <span class="cn-navigation-ledgersettingsnavigation-128-1"
            >{item.label}</span
          >
          {#if item.badge}
            <span
              class="cn-navigation-ledgersettingsnavigation-133-1"
              title={item.badgeTitle}>{item.badge}</span
            >
          {/if}
        </Button>
      </div>

      {#if expanded}
        <div class="cn-navigation-ledgersettingsnavigation-142-1">
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
        "cn-navigation-ledgersettingsnavigation-155-1",
        item.active
          ? "cn-navigation-ledgersettingsnavigation-157-1"
          : "cn-navigation-ledgersettingsnavigation-158-1",
      )}
      aria-current={item.active ? "page" : undefined}
      disabled={item.disabled || !onSelect}
      onclick={() => onSelect?.(item.id)}
    >
      <Icon data-icon="inline-start" />
      <span class="cn-navigation-ledgersettingsnavigation-165-1"
        >{item.label}</span
      >
      {#if item.badge}
        <span
          class="cn-navigation-ledgersettingsnavigation-168-1"
          title={item.badgeTitle}>{item.badge}</span
        >
      {/if}
    </Button>
  {/if}
{/snippet}
