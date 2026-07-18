<script lang="ts">
  import { Switch as SwitchPrimitive, type WithoutChild } from "bits-ui";

  /**
   * The shared boolean control for editable forms. Use it inside a centred
   * FormField row; use SegmentedControl for a non-boolean mode choice.
   */
  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className = "",
    size = "default",
    ...restProps
  }: WithoutChild<SwitchPrimitive.RootProps> & {
    size?: "sm" | "default";
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:ref
  bind:checked
  data-slot="switch"
  data-size={size}
  class={`shadow-xs focus-visible:ring-3 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-disabled:cursor-not-allowed data-disabled:opacity-50 group/switch peer relative inline-flex shrink-0 items-center rounded-full border outline-none transition-all after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-ring/50 data-[size=default]:h-[18.4px] data-[size=sm]:h-[14px] data-[size=default]:w-[32px] data-[size=sm]:w-[24px] data-[state=checked]:border-primary data-[state=unchecked]:border-border data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/25 dark:data-[state=unchecked]:bg-input/80 ${className}`}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class="pointer-events-none block rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground rtl:data-[state=checked]:translate-x-[calc(-100%+2px)]"
  />
</SwitchPrimitive.Root>
