<script lang="ts">
  import AiUnifiedReviewDiff from "@lapis/ui/feedback/AiUnifiedReviewDiff.svelte";

  export let before = "";
  export let after = "";
</script>

<AiUnifiedReviewDiff {before} {after} />
