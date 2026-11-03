<script lang="ts">
  import AccountAvatar from "../forms/AccountAvatar.svelte";

  /** A display-ready account appearance, including any resolved merchant logo. */
  export type AccountNavigationAppearance = {
    color?: string;
    icon?: string;
    merchantLogoUrl?: string;
  };

  /**
   * Account-aware navigation with optional display metadata.
   *
   * Applications provide the route, account appearance, logo URL, and select
   * action. This component does not load account metadata or route directly.
   */
  let {
    account,
    label = account,
    href,
    appearance,
    avatarSize = "sm",
    disabled = false,
    truncate = false,
    onSelect,
    onclick: onClick,
    onkeydown,
    class: className = "",
  }: {
    account: string;
    label?: string;
    href?: string;
    appearance?: AccountNavigationAppearance;
    avatarSize?: "sm" | "md" | "lg";
    disabled?: boolean;
    /** Constrain the label to the available cell width and show an ellipsis. */
    truncate?: boolean;
    onSelect?: (account: string) => void;
    onclick?: (event: MouseEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    class?: string;
  } = $props();

  function select(event: MouseEvent): void {
    if (disabled || !href || onSelect) event.preventDefault();
    if (!disabled) {
      onClick?.(event);
      onSelect?.(account);
    }
  }
</script>

<a
  href={href ?? "#"}
  class={[
    "beancount-account-link inline-flex items-center gap-2 text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
    truncate ? "max-w-full" : "shrink-0",
    className,
  ]
    .filter(Boolean)
    .join(" ")}
  class:pointer-events-none={disabled}
  class:opacity-50={disabled}
  aria-disabled={disabled || undefined}
  tabindex={disabled ? -1 : undefined}
  data-account-navigation-link={account}
  title={account}
  {onkeydown}
  onclick={select}
>
  {#if appearance}
    <AccountAvatar
      {account}
      color={appearance.color}
      icon={appearance.icon}
      merchantLogoUrl={appearance.merchantLogoUrl}
      size={avatarSize}
    />
  {/if}
  <span class:truncate class="min-w-0 whitespace-nowrap">{label}</span>
</a>

<style>
  .beancount-account-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
</style>
