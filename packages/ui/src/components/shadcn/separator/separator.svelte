<script lang="ts">
  import { Separator as SeparatorPrimitive } from "bits-ui";
  import { omitDataUiComponent } from "../../../lib/data-ui-host.js";

  let {
    ref = $bindable(null),
    class: className,
    orientation = "horizontal",
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<SeparatorPrimitive.Root
  bind:ref
  {...omitDataUiComponent(restProps)}
  data-ui-component="separator"
  data-slot="separator"
  class={className}
  {orientation}
/>
