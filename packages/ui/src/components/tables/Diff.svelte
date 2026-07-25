<script lang="ts">
  let {
    diff,
    num,
    currency,
    formatAmount,
    formatDiff,
  }: {
    diff: number;
    num: number;
    currency: string;
    formatAmount?: (value: number, currency: string) => string;
    formatDiff?: (value: number, currency: string) => string;
  } = $props();

  const asAmount =
    formatAmount ?? ((value: number, code: string) => `${value} ${code}`);
  const asDiff = formatDiff ?? ((value: number, code: string) => `${value} ${code}`);
</script>

<br />
<span class:positive={diff > 0} title={asAmount(num, currency)}>
  ({asDiff(diff, currency)})
</span>

<style>
  span {
    margin-right: 3px;
    font-size: 0.9em;
    color: var(--budget-negative);
    white-space: nowrap;
  }

  .positive {
    color: var(--budget-positive);
  }
</style>
