<script lang="ts">
    import { useLedger } from "../context/ledger.svelte";
    import { createNode } from "../core/tree";
    import TreeTable from "./tree-table/TreeTable.svelte";
    
    const ledger = useLedger();
    let nodes = $derived.by(() => {
        const tree = ledger.tree;
        const netProfit = tree.netProfit(`${ledger.options.beancount.name_equity}:${ledger.options.beancount.account_current_earnings}`, ledger.options.beancount);
        tree.insertBalance(netProfit.account, netProfit.balanceChildren);

        return {
            assets: createNode(tree, ledger.options.beancount.name_assets),
            liabilities: createNode(tree, ledger.options.beancount.name_liabilities),
            equity: createNode(tree, ledger.options.beancount.name_equity)
        };
    });
</script>
<div>
    <div class="flex">
        <div class="flex flex-wrap justify-center">
            <div class="p-2">
                <TreeTable tree={nodes.assets} end={null}></TreeTable>
            </div>
            <div class="p-2">
                <TreeTable tree={nodes.liabilities} end={null}></TreeTable>
                <TreeTable tree={nodes.equity} end={null}></TreeTable>
            </div>
        </div>
    </div>
</div>