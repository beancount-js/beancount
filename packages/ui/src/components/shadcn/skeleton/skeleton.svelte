<script lang="ts">
  import type { WithElementRef, WithoutChildren } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { omitDataUiComponent } from "../../../lib/data-ui-host.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<div
  bind:this={ref}
  {...omitDataUiComponent(restProps)}
  data-ui-component="skeleton"
  data-slot="skeleton"
  class={className}
></div>
