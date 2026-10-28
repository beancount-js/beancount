<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
</script>

<div
  class="cn-feedback-brandsettingsskeleton-5-1"
  data-brand-settings-skeleton
  aria-busy="true"
>
  <div class="cn-feedback-brandsettingsskeleton-6-1">
    <Skeleton class="cn-feedback-brandsettingsskeleton-7-1" />
    <Skeleton class="cn-feedback-brandsettingsskeleton-8-1" />
    <Skeleton class="cn-feedback-brandsettingsskeleton-9-1" />
  </div>
  <article class="cn-feedback-brandsettingsskeleton-12-1">
    <div class="cn-feedback-brandsettingsskeleton-14-1">
      {#each Array.from({ length: 5 }, (_, index) => index) as row (row)}
        <div class="cn-feedback-brandsettingsskeleton-16-1">
          <Skeleton class="cn-feedback-brandsettingsskeleton-17-1" />
          <Skeleton class="cn-feedback-brandsettingsskeleton-18-1" />
        </div>
      {/each}
    </div>
  </article>
</div>
