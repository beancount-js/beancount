<script lang="ts">
  import DashboardChartTooltip from "@beancount-js/ui/dashboard/DashboardChartTooltip.svelte";

  let {
    detail = "",
    title = "",
    value = "",
    visible = false,
    x = 0,
    y = 0,
  }: {
    detail?: string;
    title?: string;
    value?: string;
    visible?: boolean;
    x?: number;
    y?: number;
  } = $props();
</script>

<DashboardChartTooltip
  {detail}
  {title}
  {value}
  {visible}
  {x}
  {y}
/>
