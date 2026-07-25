<script lang="ts">
  import AccountAvatar from "../forms/AccountAvatar.svelte";

  /** A display-ready account appearance, including any resolved merchant logo. */
  export type AccountNavigationAppearance = {
    color?: string;
    icon?: string;
    merchantId?: string;
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
    onSelect,
    onclick,
    onkeydown,
  }: {
    account: string;
    label?: string;
    href?: string;
    appearance?: AccountNavigationAppearance;
    avatarSize?: "sm" | "md" | "lg";
    disabled?: boolean;
    onSelect?: (account: string) => void;
    onclick?: (event: MouseEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
  } = $props();

  function select(event: MouseEvent): void {
    onclick?.(event);
    if (event.defaultPrevented) return;
    if (disabled || !href || onSelect) event.preventDefault();
    if (!disabled) onSelect?.(account);
  }
</script>

<a
  href={href ?? "#"}
  class="cn-navigation-accountnavigationlink-50-1"
  class:cn-navigation-accountnavigationlink-51-1={disabled}
  class:cn-navigation-accountnavigationlink-52-1={disabled}
  aria-disabled={disabled || undefined}
  tabindex={disabled ? -1 : undefined}
  data-account-link
  data-account-navigation-link={account}
  data-merchant-id={appearance?.merchantId}
  onclick={select}
  {onkeydown}
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
  <span class="cn-navigation-accountnavigationlink-70-1">{label}</span>
</a>
