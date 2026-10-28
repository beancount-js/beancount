<script lang="ts">
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { MediaQuery } from "svelte/reactivity";
  import * as Pagination from "@lapismd/design-core/shadcn/pagination";

  let {
    page,
    pageCount,
    ariaLabel = "Pages",
    disabled = false,
    onPageChange,
  }: {
    page: number;
    pageCount: number;
    ariaLabel?: string;
    disabled?: boolean;
    onPageChange: (page: number) => void;
  } = $props();

  const desktop = new MediaQuery("(min-width: 640px)");
</script>

<Pagination.Root
  count={Math.max(1, pageCount)}
  perPage={1}
  {page}
  siblingCount={desktop.current ? 1 : 0}
  onPageChange={(nextPage) => {
    if (!disabled && nextPage !== page) onPageChange(nextPage);
  }}
  aria-label={ariaLabel}
  class="mx-0 w-full justify-center sm:w-auto"
  data-page-pagination
>
  {#snippet children({ pages, currentPage })}
    <Pagination.Content class="gap-0.5">
      <Pagination.Item>
        <Pagination.PrevButton {disabled}
          ><ChevronLeft aria-hidden="true" /></Pagination.PrevButton
        >
      </Pagination.Item>
      {#each pages as pageItem (pageItem.key)}
        {#if pageItem.type === "ellipsis"}
          <Pagination.Item>
            <Pagination.Ellipsis />
          </Pagination.Item>
        {:else}
          <Pagination.Item>
            <Pagination.Link
              page={pageItem}
              size="icon-sm"
              isActive={currentPage === pageItem.value}
              {disabled}
            >
              {pageItem.value}
            </Pagination.Link>
          </Pagination.Item>
        {/if}
      {/each}
      <Pagination.Item>
        <Pagination.NextButton {disabled}
          ><ChevronRight aria-hidden="true" /></Pagination.NextButton
        >
      </Pagination.Item>
    </Pagination.Content>
  {/snippet}
</Pagination.Root>

<style>
  :global([data-page-pagination]) {
    margin-inline: 0;
    width: auto;
  }
  :global([data-page-pagination] > ul) {
    gap: 0.125rem;
  }
  :global(
      [data-page-pagination] button[data-ui-component="pagination"][data-size]
    ) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }
  :global(
      [data-page-pagination]
        button[data-ui-component="pagination"][aria-current="page"]
    ),
  :global(
      [data-page-pagination]
        button[data-ui-component="pagination"][aria-current="page"]:hover
    ) {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--foreground) 5%, transparent);
  }
  :global([data-page-pagination] button:disabled) {
    opacity: 0.5;
  }
  :global([data-page-pagination] svg) {
    width: 1rem;
    height: 1rem;
  }
</style>
