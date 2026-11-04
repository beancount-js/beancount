<script lang="ts">
  import { Avatar } from "@lapismd/design-core/shadcn/avatar";

  import { accountAppearanceIconOptions } from "./account-appearance-icons";
  import {
    accountAvatarFallbackColor,
    accountAvatarImageValue,
    accountAvatarInitial,
    accountAvatarRawEmoji,
  } from "./account-avatar";
  import {
    appearanceIconForeground,
    normalizeAppearanceColor,
  } from "./appearance-color";

  let {
    account,
    color = "",
    icon = "",
    merchantLogoUrl = "",
    size = "md",
  }: {
    account: string;
    color?: string;
    icon?: string;
    merchantLogoUrl?: string;
    size?: "sm" | "md" | "lg";
  } = $props();

  let merchantLogoFailed = $state(false);

  $effect(() => {
    void merchantLogoUrl;
    merchantLogoFailed = false;
  });

  const merchantLogo = $derived(merchantLogoUrl.trim());
  const showsMerchantLogo = $derived(
    Boolean(merchantLogo && !merchantLogoFailed),
  );
  const customizedColor = $derived(normalizeAppearanceColor(color));
  const AvatarIcon = $derived.by(() => {
    if (!customizedColor) return null;
    return (
      accountAppearanceIconOptions.find((option) => option.value === icon)
        ?.icon ?? null
    );
  });
  const avatarColor = $derived(
    customizedColor ?? accountAvatarFallbackColor(account),
  );
  const avatarForeground = $derived(
    appearanceIconForeground(avatarColor) ?? avatarColor,
  );
  const fallbackInitial = $derived(accountAvatarInitial(account));
  const avatarImage = $derived(AvatarIcon ? "" : accountAvatarImageValue(icon));
  const avatarEmoji = $derived(AvatarIcon ? "" : accountAvatarRawEmoji(icon));
</script>

<span
  class="beancount-account-avatar"
  data-size={size}
  style={`--account-avatar-color: ${avatarColor}; --account-avatar-foreground: ${avatarForeground}`}
  aria-hidden="true"
>
  <Avatar
    class="beancount-account-avatar__shared"
    src={avatarImage}
    emoji={avatarEmoji}
    name={account}
    initials={AvatarIcon ? " " : fallbackInitial}
    background={`color-mix(in srgb, ${avatarColor} 10%, transparent)`}
    decorative
    style={`--ui-avatar-foreground: ${avatarForeground}`}
  />
  {#if showsMerchantLogo}
    <img
      class="beancount-account-avatar__merchant-logo"
      src={merchantLogo}
      alt=""
      onerror={() => (merchantLogoFailed = true)}
    />
  {:else if AvatarIcon}
    <AvatarIcon
      class="beancount-account-avatar__icon"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  {/if}
</span>

<style>
  .beancount-account-avatar {
    --account-avatar-size: 2.25rem;
    --ui-avatar-size: var(--account-avatar-size);
    display: inline-flex;
    position: relative;
    width: var(--account-avatar-size);
    height: var(--account-avatar-size);
    flex: none;
    align-items: center;
    justify-content: center;
    color: var(--account-avatar-foreground);
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1;
  }

  .beancount-account-avatar[data-size="sm"] {
    --account-avatar-size: 1.75rem;
    font-size: 0.75rem;
  }

  .beancount-account-avatar[data-size="lg"] {
    --account-avatar-size: 2.75rem;
    font-size: 1rem;
  }

  :global(.beancount-account-avatar__shared) {
    position: absolute;
    inset: 0;
  }

  :global(.beancount-account-avatar__icon) {
    position: absolute;
    inset: 0;
    width: 1.15rem;
    height: 1.15rem;
    margin: auto;
  }

  .beancount-account-avatar[data-size="sm"]
    :global(.beancount-account-avatar__icon) {
    width: 0.9rem;
    height: 0.9rem;
  }

  .beancount-account-avatar[data-size="lg"]
    :global(.beancount-account-avatar__icon) {
    width: 1.35rem;
    height: 1.35rem;
  }

  .beancount-account-avatar__merchant-logo {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 0.25rem;
    border-radius: inherit;
    background: var(--background);
    object-fit: contain;
  }

  .beancount-account-avatar[data-size="sm"]
    .beancount-account-avatar__merchant-logo {
    padding: 0.1875rem;
  }

  .beancount-account-avatar[data-size="lg"]
    .beancount-account-avatar__merchant-logo {
    padding: 0.3125rem;
  }
</style>
