<script lang="ts">
  import type { HTMLLiAttributes } from "svelte/elements";
  import ChevronRight from "svelte-radix/ChevronRight.svelte";
  import { cn } from "../../../lib/utils.js";

  type $$Props = HTMLLiAttributes & {
    el?: HTMLLIElement;
  };

  export let el: $$Props["el"] = undefined;
  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<li
  role="presentation"
  aria-hidden="true"
  class={cn("cn-breadcrumb-breadcrumb-separator-18-1", className)}
  bind:this={el}
  {...$$restProps}
  data-ui-component="breadcrumb"
  data-ui-part="breadcrumb-separator"
>
  <slot>
    <ChevronRight tabindex="-1" />
  </slot>
</li>
