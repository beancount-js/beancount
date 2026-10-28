<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import * as Pagination from "../shadcn/pagination";

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
  class="cn-navigation-pagepagination-31-1"
  data-page-pagination
>
  {#snippet children({ pages, currentPage })}
    <Pagination.Content class="cn-navigation-pagepagination-35-1">
      <Pagination.Item>
        <Pagination.Previous
          {disabled}
          class="cn-navigation-pagepagination-37-1"
        />
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
        <Pagination.Next {disabled} class="cn-navigation-pagepagination-58-1" />
      </Pagination.Item>
    </Pagination.Content>
  {/snippet}
</Pagination.Root>
