<script lang="ts">
  import { useLedger } from "../../context/ledger.svelte";

  type Props = {
    /** Difference to show. */
    diff: number;
    /** Number to show on hover. */
    num: number;
    /** The currency that both numbers are in. */
    currency: string;
  };
  const ledger = useLedger();
  let { diff, num, currency }: Props = $props();
</script>

<br />
<span class:positive={diff > 0} title={ledger.formatter.amount(num, currency)}>
  ({ledger.formatter.num(diff, currency)})
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
