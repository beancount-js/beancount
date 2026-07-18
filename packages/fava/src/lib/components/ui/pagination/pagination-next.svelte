<script lang="ts">
  import { Pagination as PaginationPrimitive } from "bits-ui";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: PaginationPrimitive.NextButtonProps = $props();
</script>

<PaginationPrimitive.NextButton
  bind:ref
  aria-label="Go to next page"
  class={cn(buttonVariants({ variant: "ghost" }), className)}
  {...restProps}
>
  <span class="hidden sm:block">Next</span>
  <ChevronRight data-icon="inline-end" />
</PaginationPrimitive.NextButton>
