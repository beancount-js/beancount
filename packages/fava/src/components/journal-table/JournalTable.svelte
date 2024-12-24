<script lang="ts">
    import { Balance, Close, Custom, Open, Pad, Query, Transaction } from "@beancount-js/beancount";
    import { useLedger } from "../../context/ledger.svelte";
    import DataTable from "../DataTable.svelte";
    import { columns } from "./columns.js";
    const ledger = useLedger();
    const data = ledger.data.directives.filter(it => [Transaction, Pad, Balance, Open, Close, Custom, Query].some(t => it instanceof t));
  </script>
  
  <div class="font-mono">
    <DataTable {data} {columns} />
  </div>
