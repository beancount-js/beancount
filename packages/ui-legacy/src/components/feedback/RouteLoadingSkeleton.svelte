<script lang="ts">
  import { Skeleton } from "../shadcn/skeleton";
  import QueryPageSkeleton from "./QueryPageSkeleton.svelte";

  export let routePath = "";

  $: isQueryRoute = routePath.split("?")[0] === "/query";
</script>

{#if isQueryRoute}
  <QueryPageSkeleton />
{:else}
  <div
    class="cn-feedback-routeloadingskeleton-14-1"
    data-route-loading-skeleton
    role="status"
    aria-busy="true"
    aria-label="Loading ledger page"
  >
    <div class="cn-feedback-routeloadingskeleton-20-1">
      <Skeleton class="cn-feedback-routeloadingskeleton-21-1" />
      <div class="cn-feedback-routeloadingskeleton-22-1">
        <Skeleton class="cn-feedback-routeloadingskeleton-23-1" />
        <Skeleton class="cn-feedback-routeloadingskeleton-24-1" />
      </div>
    </div>
    <div class="cn-feedback-routeloadingskeleton-27-1">
      {#each Array.from({ length: 8 }, (_, index) => index) as row (row)}
        <div class="cn-feedback-routeloadingskeleton-29-1">
          <Skeleton class="cn-feedback-routeloadingskeleton-30-1" />
          <Skeleton class="cn-feedback-routeloadingskeleton-31-1" />
          <Skeleton class="cn-feedback-routeloadingskeleton-32-1" />
          <Skeleton class="cn-feedback-routeloadingskeleton-33-1" />
        </div>
      {/each}
    </div>
  </div>
{/if}
