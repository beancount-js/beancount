<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-rulespageskeleton-5-1"
  data-rules-page-skeleton
  aria-busy="true"
>
  <div class="cn-feedback-rulespageskeleton-6-1">
    {#each Array.from({ length: 4 }, (_, index) => index) as row (row)}
      <div class="cn-feedback-rulespageskeleton-9-1">
        <div class="cn-feedback-rulespageskeleton-11-1">
          <Skeleton class="cn-feedback-rulespageskeleton-12-1" />
          <div class="cn-feedback-rulespageskeleton-13-1">
            <Skeleton class="cn-feedback-rulespageskeleton-14-1" />
            <Skeleton class="cn-feedback-rulespageskeleton-15-1" />
            <Skeleton class="cn-feedback-rulespageskeleton-16-1" />
          </div>
        </div>
        <Skeleton class="cn-feedback-rulespageskeleton-19-1" />
        <Skeleton class="cn-feedback-rulespageskeleton-20-1" />
      </div>
    {/each}
  </div>

  <div class="cn-feedback-rulespageskeleton-25-1">
    <div class="cn-feedback-rulespageskeleton-26-1">
      <Skeleton class="cn-feedback-rulespageskeleton-27-1" />
      <Skeleton class="cn-feedback-rulespageskeleton-28-1" />
    </div>
    <div class="cn-feedback-rulespageskeleton-30-1">
      <div class="cn-feedback-rulespageskeleton-31-1">
        <div class="cn-feedback-rulespageskeleton-32-1">
          {#each Array.from({ length: 8 }, (_, index) => index) as col (col)}
            <Skeleton class="cn-feedback-rulespageskeleton-34-1" />
          {/each}
        </div>
      </div>
      {#each Array.from({ length: 5 }, (_, index) => index) as row (row)}
        <div class="cn-feedback-rulespageskeleton-40-1">
          {#each Array.from({ length: 8 }, (_, index) => index) as col (col)}
            <Skeleton class="cn-feedback-rulespageskeleton-43-1" />
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>
