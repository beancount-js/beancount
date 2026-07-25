<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-sourcespageskeleton-5-1"
  data-sources-page-skeleton
  aria-busy="true"
>
  {#each Array.from({ length: 3 }, (_, index) => index) as card (card)}
    <article class="cn-feedback-sourcespageskeleton-8-1">
      <div class="cn-feedback-sourcespageskeleton-10-1">
        <Skeleton class="cn-feedback-sourcespageskeleton-11-1" />
        <div class="cn-feedback-sourcespageskeleton-12-1">
          <Skeleton class="cn-feedback-sourcespageskeleton-13-1" />
          <Skeleton class="cn-feedback-sourcespageskeleton-14-1" />
        </div>
        <Skeleton class="cn-feedback-sourcespageskeleton-16-1" />
      </div>
      <div class="cn-feedback-sourcespageskeleton-18-1">
        {#each Array.from({ length: 4 }, (_, index) => index) as row (row)}
          <div class="cn-feedback-sourcespageskeleton-20-1">
            <Skeleton class="cn-feedback-sourcespageskeleton-21-1" />
            <Skeleton class="cn-feedback-sourcespageskeleton-22-1" />
          </div>
        {/each}
      </div>
    </article>
  {/each}
</div>
