<script lang="ts">
  import { onMount, setContext } from "svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import { ContextKey, createContext } from "./context";
  import { MainNav } from "./menu";
  import { LedgerSource } from "./core/ledger";
  import { createRouter, RouterKey } from "./router/router";
  import Editor from "./components/Editor.svelte";
  import "@fontsource/source-code-pro";
  import { storageSyncedStore } from "./stores/storage";
  import { z } from "zod"
  import type { Unsubscriber } from "svelte/store";
  
  const context = createContext();

  const content = storageSyncedStore<string>(
    "file/test.beancount",
    () =>`
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
    `,
    z.string(), {
      read: (data) => data,
      write: (data) => data
    }
  );
  context.menu.set([MainNav]);
  context.ledgerSource.set(new LedgerSource($content));

  setContext(ContextKey, context);
  setContext(RouterKey, createRouter([
    { path: "/editor", element: Editor },
  ], "/editor"));

  onMount(() => {
    const unsubscribers: Array<Unsubscriber> = [];
    unsubscribers.push(context.ledgerSource.subscribe((data) => {
      if (data) {
        console.log(data)
        content.set(data.toString());
      }
    }));
    return () => {
      unsubscribers.forEach(it => it());
    };
  });
</script>

<Dashboard />
