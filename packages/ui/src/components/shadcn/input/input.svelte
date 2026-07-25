<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { omitDataUiComponent } from "../../../lib/data-ui-host.js";

  let {
    ref = $bindable(null),
    value = $bindable(),
    class: className,
    ...restProps
  }: WithElementRef<HTMLInputAttributes> = $props();
</script>

<input
  bind:this={ref}
  {...omitDataUiComponent(restProps)}
  data-ui-component="input"
  data-slot="input"
  class={className}
  bind:value
/>
