<script lang="ts" module>
  import {
    createVariants,
    type VariantProps,
  } from "../../../lib/semantic-variants.js";

  export const toggleVariants = createVariants({
    base: "cn-toggle-toggle-5-1",
    variants: {
      variant: {
        default: "cn-toggle-toggle-8-1",
        outline: "cn-toggle-toggle-10-1",
      },
      size: {
        default: "cn-toggle-toggle-13-1",
        sm: "cn-toggle-toggle-14-1",
        lg: "cn-toggle-toggle-15-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  });

  export type ToggleVariant = VariantProps<typeof toggleVariants>["variant"];
  export type ToggleSize = VariantProps<typeof toggleVariants>["size"];
  export type ToggleVariants = VariantProps<typeof toggleVariants>;
</script>

<script lang="ts">
  import { Toggle as TogglePrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    pressed = $bindable(false),
    class: className,
    size = "default",
    variant = "default",
    ...restProps
  }: TogglePrimitive.RootProps & {
    variant?: ToggleVariant;
    size?: ToggleSize;
  } = $props();
</script>

<TogglePrimitive.Root
  bind:ref
  bind:pressed
  class={cn(toggleVariants({ variant, size }), className)}
  {...restProps}
  data-ui-component="toggle"
  data-ui-part="toggle"
/>
