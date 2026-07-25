<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  type $$Props = HTMLAttributes<HTMLDivElement>;

  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<div
  class={cn("cn-alert-alert-description-11-1", className)}
  {...$$restProps}
  data-ui-component="alert"
  data-ui-part="alert-description"
>
  <slot />
</div>
