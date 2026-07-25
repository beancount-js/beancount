<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-aidockskeleton-6-1"
  data-ai-dock-skeleton
  aria-busy="true"
>
  {#each Array.from({ length: 4 }, (_, index) => index) as row (row)}
    <div
      class="cn-feedback-aidockskeleton-12-1"
      class:cn-feedback-aidockskeleton-13-1={row % 2 === 1}
      class:cn-feedback-aidockskeleton-14-1={row % 2 === 0}
    >
      <Skeleton
        class={row % 2 === 0
          ? "cn-feedback-aidockskeleton-18-1"
          : "cn-feedback-aidockskeleton-19-1"}
      />
    </div>
  {/each}
</div>
