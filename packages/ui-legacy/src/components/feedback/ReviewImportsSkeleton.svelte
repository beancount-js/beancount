<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-reviewimportsskeleton-5-1"
  data-review-imports-skeleton
  aria-busy="true"
>
  <div class="cn-feedback-reviewimportsskeleton-7-1">
    <div class="cn-feedback-reviewimportsskeleton-9-1">
      <Skeleton class="cn-feedback-reviewimportsskeleton-10-1" />
      <Skeleton class="cn-feedback-reviewimportsskeleton-11-1" />
    </div>
    <Skeleton class="cn-feedback-reviewimportsskeleton-13-1" />
  </div>
  <div class="cn-feedback-reviewimportsskeleton-15-1">
    {#each Array.from({ length: 3 }, (_, index) => index) as group (group)}
      <div class="cn-feedback-reviewimportsskeleton-17-1">
        <div class="cn-feedback-reviewimportsskeleton-18-1">
          <Skeleton class="cn-feedback-reviewimportsskeleton-19-1" />
          <Skeleton class="cn-feedback-reviewimportsskeleton-20-1" />
          <Skeleton class="cn-feedback-reviewimportsskeleton-21-1" />
        </div>
        {#each Array.from({ length: 3 }, (_, index) => index) as row (row)}
          <div class="cn-feedback-reviewimportsskeleton-25-1">
            <Skeleton class="cn-feedback-reviewimportsskeleton-27-1" />
            <div class="cn-feedback-reviewimportsskeleton-28-1">
              <Skeleton class="cn-feedback-reviewimportsskeleton-29-1" />
              <Skeleton class="cn-feedback-reviewimportsskeleton-30-1" />
            </div>
            <Skeleton class="cn-feedback-reviewimportsskeleton-32-1" />
            <Skeleton class="cn-feedback-reviewimportsskeleton-33-1" />
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
