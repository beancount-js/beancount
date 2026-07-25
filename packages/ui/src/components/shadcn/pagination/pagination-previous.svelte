<script lang="ts">
  import { Pagination as PaginationPrimitive } from "bits-ui";
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: PaginationPrimitive.PrevButtonProps = $props();
</script>

<PaginationPrimitive.PrevButton
  bind:ref
  aria-label="Go to previous page"
  class={cn(buttonVariants({ variant: "ghost" }), className)}
  {...restProps}
  data-ui-component="pagination"
  data-ui-part="pagination-previous"
>
  <ChevronLeft />
</PaginationPrimitive.PrevButton>
