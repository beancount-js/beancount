<script lang="ts" module>
  import {
    createVariants,
    type VariantProps,
  } from "../../../lib/semantic-variants.js";

  export const sheetVariants = createVariants({
    base: "cn-sheet-sheet-content-5-1",
    variants: {
      side: {
        top: "cn-sheet-sheet-content-8-1",
        bottom: "cn-sheet-sheet-content-10-1",
        left: "cn-sheet-sheet-content-11-1",
        right: "cn-sheet-sheet-content-13-1",
      },
    },
    defaultVariants: {
      side: "right",
    },
  });

  export type Side = VariantProps<typeof sheetVariants>["side"];
</script>

<script lang="ts">
  import {
    Dialog as SheetPrimitive,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import X from "lucide-svelte/icons/x";
  import type { Snippet } from "svelte";
  import SheetOverlay from "./sheet-overlay.svelte";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    portalProps,
    side = "right",
    children,
    ...restProps
  }: WithoutChildrenOrChild<SheetPrimitive.ContentProps> & {
    portalProps?: SheetPrimitive.PortalProps;
    side?: Side;
    children: Snippet;
  } = $props();
</script>

<SheetPrimitive.Portal {...portalProps}>
  <SheetOverlay />
  <SheetPrimitive.Content
    bind:ref
    class={cn(sheetVariants({ side }), className)}
    {...restProps}
    data-ui-component="sheet"
    data-ui-part="sheet-content"
  >
    {@render children?.()}
    <SheetPrimitive.Close
      class="cn-sheet-sheet-content-57-1"
      data-ui-part="sheet-close"
    >
      <X class="cn-sheet-sheet-content-59-1" />
      <span class="sr-only">Close</span>
    </SheetPrimitive.Close>
  </SheetPrimitive.Content>
</SheetPrimitive.Portal>
