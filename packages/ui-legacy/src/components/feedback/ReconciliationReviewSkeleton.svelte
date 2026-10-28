<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-reconciliationreviewskeleton-6-1"
  data-reconciliation-review-skeleton
  role="status"
  aria-busy="true"
  aria-label="Loading reconciliation matches"
>
  <Skeleton class="cn-feedback-reconciliationreviewskeleton-12-1" />
  <div class="cn-feedback-reconciliationreviewskeleton-14-1">
    <Skeleton class="cn-feedback-reconciliationreviewskeleton-16-1" />
    <Skeleton class="cn-feedback-reconciliationreviewskeleton-17-1" />
  </div>
  {#each Array.from({ length: 3 }, (_, index) => index) as item (item)}
    <section class="cn-feedback-reconciliationreviewskeleton-20-1">
      <div class="cn-feedback-reconciliationreviewskeleton-22-1">
        <div class="cn-feedback-reconciliationreviewskeleton-24-1">
          <Skeleton class="cn-feedback-reconciliationreviewskeleton-25-1" />
          <Skeleton class="cn-feedback-reconciliationreviewskeleton-26-1" />
        </div>
        <div class="cn-feedback-reconciliationreviewskeleton-28-1">
          <Skeleton class="cn-feedback-reconciliationreviewskeleton-29-1" />
          <Skeleton class="cn-feedback-reconciliationreviewskeleton-30-1" />
        </div>
        <Skeleton class="cn-feedback-reconciliationreviewskeleton-32-1" />
      </div>
      <div class="cn-feedback-reconciliationreviewskeleton-34-1">
        {#each Array.from({ length: 2 }, (_, index) => index) as row (row)}
          <div class="cn-feedback-reconciliationreviewskeleton-37-1">
            <Skeleton class="cn-feedback-reconciliationreviewskeleton-39-1" />
            <div class="cn-feedback-reconciliationreviewskeleton-40-1">
              <Skeleton class="cn-feedback-reconciliationreviewskeleton-41-1" />
              <Skeleton class="cn-feedback-reconciliationreviewskeleton-42-1" />
            </div>
            <Skeleton class="cn-feedback-reconciliationreviewskeleton-45-1" />
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>
