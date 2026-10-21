<script lang="ts">
  import QueryResultsTable from "../src/components/tables/QueryResultsTable.svelte";
  let { empty = false, error = false }: { empty?: boolean; error?: boolean } =
    $props();
  let page = $state(1);
  let pageSize = $state(10);
  const rows = Array.from({ length: 31 }, (_, i) => ({
    id: String(i),
    values: {
      description: `Long description for result ${i + 1}\nSecond line of context`,
      amount: i * 12.5,
    },
  }));
</script>

<QueryResultsTable
  ariaLabel="Result geometry fixture"
  columns={[
    { id: "description", label: "Description", sortable: true },
    { id: "amount", label: "Amount", align: "right", sortable: true },
  ]}
  rows={empty ? [] : rows.slice((page - 1) * pageSize, page * pageSize)}
  error={error ? "Unknown query column: missing" : undefined}
  pagination={empty
    ? undefined
    : {
        page,
        pageCount: Math.ceil(rows.length / pageSize),
        pageSize,
        pageSizes: [10, 25, 50],
        resultLabel: `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, rows.length)} of ${rows.length}`,
      }}
  onPageChange={(value) => (page = value)}
  onPageSizeChange={(value) => {
    pageSize = value;
    page = 1;
  }}
/>
