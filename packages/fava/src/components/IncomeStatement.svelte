<script lang="ts">
    import { useLedger } from "../context/ledger.svelte";
    import { createNode} from "../core/tree";
    import TreeTable from "./tree-table/TreeTable.svelte";
    
    const ledger = useLedger();
    let nodes = $derived.by(() => {
        const tree = ledger.tree;
        const netProfit = tree.netProfit(`${ledger.options.beancount.name_equity}:${ledger.options.beancount.account_current_earnings}`, ledger.options.beancount);
        return {
            income: createNode(tree, ledger.options.beancount.name_income),
            expenses: createNode(tree, ledger.options.beancount.name_expenses),
            netProfit: {
                children: [],
                account: 'Net Profit',
                balance: netProfit.balance.toRecord(),
                balanceChildren: netProfit.balanceChildren.toRecord(),
                cost: {},
                costChildren: {},
                hasTxns: netProfit.hasTxns
            }
        };
    });
</script>
<div>
    <div class="flex">
        <div class="flex flex-wrap justify-center">
            <div class="p-2">
                <TreeTable tree={nodes.income} end={null}></TreeTable>
                <TreeTable tree={nodes.netProfit} end={null}></TreeTable>
            </div>
            <div class="p-2">
                <TreeTable tree={nodes.expenses} end={null}></TreeTable>
            </div>
        </div>
    </div>
</div>