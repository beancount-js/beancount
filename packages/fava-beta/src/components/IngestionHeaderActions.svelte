<script lang="ts">
  import {
    IngestionHeaderActions as SharedIngestionHeaderActions,
    type IngestionHeaderActionSet,
  } from "@beancount-js/ui/forms";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";

  type Props = {
    /** Leading sits beside the page title; actions stay in the right cluster. */
    region?: "leading" | "actions";
  };

  let {
    region = "actions",
  }: Props = $props();
</script>

{#if $ingestionHeaderActions}
  <SharedIngestionHeaderActions
    {region}
    header={$ingestionHeaderActions as IngestionHeaderActionSet}
  />
{/if}
