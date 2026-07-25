<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Select from "../shadcn/select";
  import ChartLegend, { type ChartLegendItem } from "./ChartLegend.svelte";
  import ChartModeSwitch, {
    type ChartModeOption,
  } from "./ChartModeSwitch.svelte";

  export type ChartPanelOption = {
    value: string;
    label: string;
  };

  export type ChartPanelSelect = {
    /** Describes the compact chart setting for assistive technology. */
    ariaLabel: string;
    value: string;
    options: readonly ChartPanelOption[];
    onChange?: (value: string) => void;
  };

  export type ChartPanelLegend = {
    items: readonly ChartLegendItem[];
    selection?: "multiple" | "single";
    selectedIds: readonly string[];
    onSelectedIdsChange?: (ids: string[]) => void;
  };

  export type ChartPanelModes = {
    value: string;
    options: readonly ChartModeOption[];
    ariaLabel?: string;
    onChange?: (value: string) => void;
  };

  let {
    legend,
    conversion,
    interval,
    modes,
    ariaLabel = "Chart panel",
    children,
  }: {
    /** Series visibility or focus controls displayed on the left of the toolbar. */
    legend?: ChartPanelLegend;
    /** A controlled compact display setting, such as at cost or market value. */
    conversion?: ChartPanelSelect;
    /** A controlled date grouping, such as month or quarter. */
    interval?: ChartPanelSelect;
    /** Alternate visual renderings of the same display model. */
    modes?: ChartPanelModes;
    ariaLabel?: string;
    /** The application renders the appropriate model-driven chart here. */
    children?: Snippet;
  } = $props();

  const hasControls = $derived(
    Boolean(legend || conversion || interval || modes),
  );

  function updateSelect(select: ChartPanelSelect, value: string | undefined) {
    if (value) select.onChange?.(value);
  }
</script>

<section class="cn-charts-chartpanel-66-1" aria-label={ariaLabel}>
  {#if hasControls}
    <div class="cn-charts-chartpanel-69-1">
      {#if legend}
        <div class="cn-charts-chartpanel-72-1">
          <ChartLegend
            items={legend.items}
            selection={legend.selection}
            selectedIds={legend.selectedIds}
            onSelectedIdsChange={legend.onSelectedIdsChange}
          />
        </div>
      {/if}

      {#if conversion || interval || modes}
        <div class="cn-charts-chartpanel-83-1">
          {#if conversion}
            <Select.Root
              type="single"
              value={conversion.value}
              onValueChange={(value) => updateSelect(conversion, value)}
            >
              <Select.Trigger
                class="cn-charts-chartpanel-91-1"
                aria-label={conversion.ariaLabel}
              >
                {conversion.options.find(
                  (option) => option.value === conversion.value,
                )?.label ?? conversion.value}
              </Select.Trigger>
              <Select.Content aria-label={`${conversion.ariaLabel} options`}>
                {#each conversion.options as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}

          {#if interval}
            <Select.Root
              type="single"
              value={interval.value}
              onValueChange={(value) => updateSelect(interval, value)}
            >
              <Select.Trigger
                class="cn-charts-chartpanel-113-1"
                aria-label={interval.ariaLabel}
              >
                {interval.options.find(
                  (option) => option.value === interval.value,
                )?.label ?? interval.value}
              </Select.Trigger>
              <Select.Content aria-label={`${interval.ariaLabel} options`}>
                {#each interval.options as option (option.value)}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}

          {#if modes}
            <ChartModeSwitch
              value={modes.value}
              options={modes.options}
              ariaLabel={modes.ariaLabel ?? "Chart representation"}
              onChange={modes.onChange}
            />
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {@render children?.()}
</section>
