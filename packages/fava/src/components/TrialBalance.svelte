<script lang="ts">
    import { useLedger } from "../context/ledger.svelte";
    import { createNode } from "../core/tree";
    import TreeTable from "./tree-table/TreeTable.svelte";
    
    const ledger = useLedger();
    let node = $derived(createNode(ledger.tree, ""));
</script>
<div>
    <div class="flex">
        <div class="flex flex-wrap justify-start">
            <TreeTable tree={node} end={null}></TreeTable>
        </div>
    </div>
</div>