<script lang="ts">
  import { Skeleton } from "$lib/components/ui/skeleton";
</script>

<div class="flex flex-col gap-5" data-review-imports-skeleton aria-busy="true">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex flex-col gap-2">
      <Skeleton class="h-5 w-24" />
      <Skeleton class="h-3.5 w-48" />
    </div>
    <Skeleton class="h-9 w-56 rounded-lg" />
  </div>
  <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
    {#each Array.from({ length: 3 }, (_, index) => index) as group (group)}
      <div class="border-b last:border-b-0">
        <div class="flex items-center gap-3 bg-muted/30 px-4 py-2.5">
          <Skeleton class="size-4 rounded-sm" />
          <Skeleton class="h-3.5 w-36" />
          <Skeleton class="ml-auto h-5 w-10 rounded-full" />
        </div>
        {#each Array.from({ length: 3 }, (_, index) => index) as row (row)}
          <div
            class="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-t px-4 py-2.5"
          >
            <Skeleton class="size-4 rounded-sm" />
            <div class="flex min-w-0 flex-col gap-1.5">
              <Skeleton class="h-3.5 w-52" />
              <Skeleton class="h-3 w-28" />
            </div>
            <Skeleton class="h-3.5 w-20" />
            <Skeleton class="h-3.5 w-16" />
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
