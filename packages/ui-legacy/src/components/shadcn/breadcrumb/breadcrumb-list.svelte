<script lang="ts">
  import type { HTMLOlAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  type $$Props = HTMLOlAttributes & {
    el?: HTMLOListElement;
  };

  export let el: $$Props["el"] = undefined;
  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<ol
  bind:this={el}
  class={cn("cn-breadcrumb-breadcrumb-list-17-1", className)}
  {...$$restProps}
  data-ui-component="breadcrumb"
  data-ui-part="breadcrumb-list"
>
  <slot />
</ol>
