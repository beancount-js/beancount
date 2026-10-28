<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-accountspageskeleton-5-1"
  data-accounts-page-skeleton
  aria-busy="true"
>
  <div class="cn-feedback-accountspageskeleton-6-1">
    <Skeleton class="cn-feedback-accountspageskeleton-7-1" />
    <Skeleton class="cn-feedback-accountspageskeleton-8-1" />
  </div>
  <article class="cn-feedback-accountspageskeleton-11-1">
    <div class="cn-feedback-accountspageskeleton-13-1">
      <Skeleton class="cn-feedback-accountspageskeleton-14-1" />
      <div class="cn-feedback-accountspageskeleton-15-1">
        <Skeleton class="cn-feedback-accountspageskeleton-16-1" />
        <Skeleton class="cn-feedback-accountspageskeleton-17-1" />
      </div>
    </div>
    <div class="cn-feedback-accountspageskeleton-20-1">
      {#each Array.from({ length: 5 }, (_, index) => index) as row (row)}
        <div class="cn-feedback-accountspageskeleton-22-1">
          <Skeleton class="cn-feedback-accountspageskeleton-23-1" />
          <div class="cn-feedback-accountspageskeleton-24-1">
            <Skeleton class="cn-feedback-accountspageskeleton-25-1" />
            <Skeleton class="cn-feedback-accountspageskeleton-26-1" />
          </div>
          <Skeleton class="cn-feedback-accountspageskeleton-28-1" />
        </div>
      {/each}
    </div>
  </article>
</div>
