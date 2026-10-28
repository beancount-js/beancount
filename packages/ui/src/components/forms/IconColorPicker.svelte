<script lang="ts">
  import FilterCommandPicker from "./FilterCommandPicker.svelte";

  import { ColorPicker } from "@lapismd/design-core/forms";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import AccountAvatar from "./AccountAvatar.svelte";
  import { accountAppearanceIconOptions } from "./account-appearance-icons";
  import {
    autoCorrectAppearanceColor,
    needsAppearanceContrastCorrection,
    normalizeAppearanceColor,
  } from "./appearance-color";
  let {
    color = "",
    icon = "",
    onChange = () => {},
  }: {
    color?: string;
    icon?: string;
    onChange?: (value: { color: string; icon: string }) => void;
  } = $props();
  let pendingColor = $state<string | null>(null);
  const currentColor = $derived(
    pendingColor ?? normalizeAppearanceColor(color) ?? "#7667D9",
  );
  const needsCorrection = $derived(
    needsAppearanceContrastCorrection(currentColor),
  );
  function chooseColor(next: string) {
    const normalized = normalizeAppearanceColor(next);
    if (!normalized) return;
    if (needsAppearanceContrastCorrection(normalized)) {
      pendingColor = normalized;
      return;
    }
    pendingColor = null;
    onChange({ color: normalized, icon });
  }
  function correct() {
    const next = autoCorrectAppearanceColor(currentColor);
    if (next) {
      pendingColor = null;
      onChange({ color: next, icon });
    }
  }
</script>

<Popover.Root>
  <Popover.Trigger aria-label="Choose account colour and icon"
    ><AccountAvatar account="Account" color={currentColor} {icon} /> Colour and icon</Popover.Trigger
  >
  <Popover.Content class="w-80 space-y-4" align="start">
    <ColorPicker
      value={currentColor}
      ariaLabel="Account colour"
      format="hex"
      onChange={chooseColor}
    />
    {#if needsCorrection}<div role="alert">
        The generated icon colour needs more contrast. <Button
          variant="outline"
          onclick={correct}>Auto-correct</Button
        >
      </div>{/if}
    <FilterCommandPicker
      label="Icon"
      ariaLabel="Account icon"
      fullWidth
      value={icon}
      options={accountAppearanceIconOptions.map(({ value, label }) => ({
        value,
        label,
      }))}
      onChange={(next) => {
        if (!needsCorrection) onChange({ color: currentColor, icon: next });
      }}
    />
  </Popover.Content>
</Popover.Root>
