<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  type $$Props = HTMLAttributes<HTMLSpanElement> & {
    el?: HTMLSpanElement;
  };

  export let el: $$Props["el"] = undefined;
  export let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<span
  bind:this={el}
  role="link"
  aria-disabled="true"
  aria-current="page"
  class={cn("cn-breadcrumb-breadcrumb-page-19-1", className)}
  {...$$restProps}
  data-ui-component="breadcrumb"
  data-ui-part="breadcrumb-page"
>
  <slot />
</span>
