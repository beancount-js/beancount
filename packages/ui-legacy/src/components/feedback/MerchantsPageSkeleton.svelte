<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-merchantspageskeleton-5-1"
  data-merchants-page-skeleton
  aria-busy="true"
>
  <div class="cn-feedback-merchantspageskeleton-6-1">
    {#each Array.from({ length: 6 }, (_, index) => index) as row (row)}
      <div class="cn-feedback-merchantspageskeleton-8-1">
        <Skeleton class="cn-feedback-merchantspageskeleton-9-1" />
        <div class="cn-feedback-merchantspageskeleton-10-1">
          <Skeleton class="cn-feedback-merchantspageskeleton-11-1" />
          <Skeleton class="cn-feedback-merchantspageskeleton-12-1" />
        </div>
        <Skeleton class="cn-feedback-merchantspageskeleton-14-1" />
        <Skeleton class="cn-feedback-merchantspageskeleton-15-1" />
      </div>
    {/each}
  </div>
</div>
