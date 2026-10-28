<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-querypageskeleton-6-1"
  data-route-loading-skeleton
  data-query-page-skeleton
  role="status"
  aria-busy="true"
  aria-label="Loading query page"
>
  <div class="cn-feedback-querypageskeleton-14-1">
    <Skeleton class="cn-feedback-querypageskeleton-16-1" />
    <Skeleton class="cn-feedback-querypageskeleton-17-1" />
    <Skeleton class="cn-feedback-querypageskeleton-18-1" />
  </div>

  <div class="cn-feedback-querypageskeleton-21-1">
    {#each Array.from({ length: 2 }, (_, index) => index) as query (query)}
      <article class="cn-feedback-querypageskeleton-24-1">
        <div class="cn-feedback-querypageskeleton-26-1">
          <div class="cn-feedback-querypageskeleton-27-1">
            <div class="cn-feedback-querypageskeleton-28-1">
              <Skeleton class="cn-feedback-querypageskeleton-29-1" />
              <Skeleton class="cn-feedback-querypageskeleton-30-1" />
            </div>
          </div>
          <div class="cn-feedback-querypageskeleton-33-1">
            <Skeleton class="cn-feedback-querypageskeleton-34-1" />
            <Skeleton class="cn-feedback-querypageskeleton-35-1" />
          </div>
        </div>

        {#if query === 0}
          <div
            class="cn-feedback-querypageskeleton-40-1"
            data-query-skeleton-result
          >
            <div class="cn-feedback-querypageskeleton-41-1">
              <div class="cn-feedback-querypageskeleton-43-1">
                <Skeleton class="cn-feedback-querypageskeleton-45-1" />
                <Skeleton class="cn-feedback-querypageskeleton-46-1" />
                <Skeleton class="cn-feedback-querypageskeleton-47-1" />
              </div>
              {#each Array.from({ length: 3 }, (_, index) => index) as row (row)}
                <div
                  class="cn-feedback-querypageskeleton-51-1"
                  data-query-skeleton-row
                >
                  <Skeleton class="cn-feedback-querypageskeleton-54-1" />
                  <Skeleton class="cn-feedback-querypageskeleton-55-1" />
                  <Skeleton class="cn-feedback-querypageskeleton-56-1" />
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </article>
    {/each}
  </div>
</div>
