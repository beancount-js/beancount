<script lang="ts">
  import ReviewDiff from "../forms/ReviewDiff.svelte";

  let {
    before,
    after,
    ariaLabel = "Proposed source changes",
    emptyLabel = "No source changes to review.",
  }: {
    before: string;
    after: string;
    ariaLabel?: string;
    emptyLabel?: string;
  } = $props();
</script>

<ReviewDiff {before} {after} {ariaLabel} {emptyLabel} />
