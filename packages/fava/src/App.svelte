<script lang="ts">
  import { onMount, setContext } from "svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import { ContextKey, createContext } from "./context";
  import { MainNav } from "./menu";
  import { LedgerSource } from "./core/ledger";
  import { createRouter, RouterKey } from "./router/router";
  import Editor from "./components/Editor.svelte";
  import "@fontsource/source-code-pro";
  
  const context = createContext();
  context.menu.set([MainNav]);
  context.ledgerSource.set(
    new LedgerSource(`
      2024-10-25 custom "ledger-option" "dashboard_collapsed" "false"
      1987-05-17 open     Equity:Opening-Balances ; inline comment
      2014-07-09 query "position-by-account" "SELECT account, sum(position)"
      1987-05-17 open     Assets:Checking:Starling  ; inline comment
      1987-05-17 open     Liabilities:CreditCard:Barclays ; inline comment


      2024-11-09 # "Barclays" "Duplicate Barclays Credit Card"
        Assets:Checking:Starling                                                         
        Liabilities:CreditCard:Barclays  150.00 GBP

      2024-11-09 # "Barclays" "Barclays Credit Card" #creditcard ^link-to-the-end-of-world
        Assets:Checking:Starling                                                         
        Liabilities:CreditCard:Barclays  150.00 GBP
    `),
  );
  setContext(ContextKey, context);
  setContext(RouterKey, createRouter([
    { path: "/editor", element: Editor },
  ], "/editor"));

  onMount(() => {
    const unsubscribe = context.ledgerSource.subscribe((source) => {
      console.log("Source::", source);
    });

    return () => {
      unsubscribe();
    };
  });
</script>

<Dashboard />
