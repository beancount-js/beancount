<script lang="ts" module>
  import { clsx, type ClassValue } from "clsx";

  export const BADGE_VARIANTS = [
    "default",
    "secondary",
    "destructive",
    "success",
    "warning",
    "outline",
  ] as const;

  export type BadgeVariant = (typeof BADGE_VARIANTS)[number];

  export function badgeVariants({
    variant = "default",
    class: className,
  }: {
    variant?: BadgeVariant;
    class?: ClassValue;
  } = {}): string {
    return clsx("cn-badge", `cn-badge--${variant}`, className);
  }
</script>

<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { omitDataUiComponent } from "../../../lib/data-ui-host.js";

  let {
    ref = $bindable(null),
    href,
    class: className,
    variant = "default",
    children,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    variant?: BadgeVariant;
  } = $props();

  const classes = $derived(badgeVariants({ variant, class: className }));
</script>

<svelte:element
  this={href ? "a" : "span"}
  bind:this={ref}
  {...omitDataUiComponent(restProps)}
  data-ui-component="badge"
  data-variant={variant}
  data-slot="badge"
  {href}
  class={classes}
>
  {@render children?.()}
</svelte:element>
