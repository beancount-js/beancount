<script lang="ts">
  import { useLedger } from "../../context/ledger.svelte";
  import DataTable from "../DataTable.svelte";
  import { columns } from "./columns.js";
  const ledger = useLedger();
  const data = ledger.source.errors;
</script>

<DataTable {data} {columns} />
