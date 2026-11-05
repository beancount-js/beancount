<script lang="ts">
  import { untrack } from "svelte";
  import { AvatarPicker } from "@lapismd/design-core/forms/avatar-picker";

  import { accountAppearanceIconOptions } from "./account-appearance-icons";
  import { accountAvatarImageDataUrl } from "./account-avatar";
  import { normalizeAppearanceColor } from "./appearance-color";
  let {
    color = "",
    icon = "",
    onChange = () => {},
  }: {
    color?: string;
    icon?: string;
    onChange?: (value: { color: string; icon: string }) => void;
  } = $props();
  const externalColor = $derived(normalizeAppearanceColor(color) ?? "#7667D9");
  const legacyIcon = $derived(
    accountAppearanceIconOptions.some((option) => option.value === icon),
  );
  const pickerValue = $derived(
    legacyIcon ? accountAvatarImageDataUrl("Account") : icon,
  );
  let pickerBackground = $state(untrack(() => externalColor));
  let lastExternalColor = $state(untrack(() => externalColor));

  $effect(() => {
    const next = externalColor;
    if (next !== lastExternalColor) {
      lastExternalColor = next;
      pickerBackground = next;
    }
  });

  $effect(() => {
    const next = normalizeAppearanceColor(pickerBackground);
    if (!next || next === externalColor) return;
    untrack(() => onChange({ color: next, icon }));
  });
</script>

<div class="beancount-account-avatar-picker">
  <AvatarPicker
    value={pickerValue}
    bind:background={pickerBackground}
    name="Account"
    initials="A"
    label="Choose account colour and icon"
    mode="emoji"
    size="md"
    shape="circle"
    onValueChange={(next) => {
      onChange({
        color: normalizeAppearanceColor(pickerBackground) ?? externalColor,
        icon: next,
      });
    }}
  />
</div>

<style>
  .beancount-account-avatar-picker {
    --ui-avatar-picker-size: 2.25rem;
    display: inline-flex;
  }

  .beancount-account-avatar-picker :global(.ui-avatar-picker) {
    --_picker-edit-size: 0.875rem;
    --_picker-cutout-gap: 2px;
  }
</style>
