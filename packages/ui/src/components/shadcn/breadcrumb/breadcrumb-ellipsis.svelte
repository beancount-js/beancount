<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import DotsHorizontal from "svelte-radix/DotsHorizontal.svelte";
  import { cn } from "../../../lib/utils.js";

  type $$Props = HTMLAttributes<HTMLSpanElement> & {
    el?: HTMLSpanElement;
  };

  export let el: $$Props["el"] = undefined;
  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<span
  bind:this={el}
  role="presentation"
  aria-hidden="true"
  class={cn("cn-breadcrumb-breadcrumb-ellipsis-19-1", className)}
  {...$$restProps}
  data-ui-component="breadcrumb"
  data-ui-part="breadcrumb-ellipsis"
>
  <DotsHorizontal
    class="cn-breadcrumb-breadcrumb-ellipsis-22-1"
    tabindex="-1"
  />
  <span class="sr-only">More</span>
</span>
