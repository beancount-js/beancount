<script lang="ts">
  import PagePagination from "@beancount-js/ui/navigation/PagePagination.svelte";

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
</script>

<PagePagination {page} {pageCount} {ariaLabel} {disabled} {onPageChange} />
