<script lang="ts" module>
  import { clsx, type ClassValue } from "clsx";
  import type { WithElementRef } from "bits-ui";
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";

  export const BUTTON_VARIANTS = [
    "default",
    "destructive",
    "outline",
    "secondary",
    "ghost",
    "ghost-raised",
    "link",
  ] as const;
  export const BUTTON_SIZES = [
    "default",
    "sm",
    "xs",
    "lg",
    "icon",
    "icon-sm",
  ] as const;

  export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
  export type ButtonSize = (typeof BUTTON_SIZES)[number];

  export function buttonVariants({
    variant = "default",
    size = "default",
    class: className,
  }: {
    variant?: ButtonVariant;
    size?: ButtonSize;
    class?: ClassValue;
  } = {}): string {
    return clsx(
      "cn-button",
      `cn-button--${variant}`,
      size === "default" ? "cn-button--default-size" : `cn-button--${size}`,
      className,
    );
  }

  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };
</script>

<script lang="ts">
  import { omitDataUiComponent } from "../../../lib/data-ui-host.js";

  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    children,
    ...restProps
  }: ButtonProps = $props();

  const classes = $derived(buttonVariants({ variant, size, class: className }));
</script>

{#if href}
  <a
    bind:this={ref}
    {...omitDataUiComponent(restProps)}
    data-ui-component="button"
    data-variant={variant}
    data-size={size}
    data-slot="button"
    class={classes}
    {href}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    {...omitDataUiComponent(restProps)}
    data-ui-component="button"
    data-variant={variant}
    data-size={size}
    data-slot="button"
    class={classes}
    {type}
  >
    {@render children?.()}
  </button>
{/if}
