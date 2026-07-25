<script lang="ts">
  import AiUnifiedReviewDiff from "@beancount-js/ui/feedback/AiUnifiedReviewDiff.svelte";

  export let before = "";
  export let after = "";
</script>

<AiUnifiedReviewDiff {before} {after} />
