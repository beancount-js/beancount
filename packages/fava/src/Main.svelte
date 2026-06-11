<script lang="ts">
  import { onMount, setContext } from "svelte";
  import Dashboard from "./components/Dashboard.svelte";
  import { ContextKey, createContext } from "./context";
  import { createRouter, RouterKey } from "./router/router";
  import { MainNav } from "./menu";
  import { LedgerSource } from "./core/ledger";
  import { createDocumentLoader, preloadIncludes } from "./lib/includes";
  import Editor from "./components/Editor.svelte";
  import Errors from "./components/errors/Errors.svelte";
  import JournalTable from "./components/JournalTable.svelte";
  import IncomeStatement from "./components/IncomeStatement.svelte";
  import BalanceSheet from "./components/BalanceSheet.svelte";
  import TrialBalance from "./components/TrialBalance.svelte";
  import Holdings from "./components/Holdings.svelte";
  import Statistics from "./components/Statistics.svelte";
  import Query from "./components/Query.svelte";
  import AccountDetails from "./components/AccountDetails.svelte";
  import ImportTable from "./components/ImportTable.svelte";
  import ImportEditor from "./components/ImportEditor.svelte";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import "@fontsource/source-code-pro/400.css";
  import "@fontsource/source-code-pro/600.css";
  import "./codemirror/themes/base.scss";

  const LEDGER_KEY = "ledger";
  const defaultLedger = ";; Beancount Ledger\n";
  const loadProps = { documentLoader: createDocumentLoader() };

  const context = createContext();
  const navigation = createRouter(
    [
      { path: "/", element: BalanceSheet },
      { path: "/income_statement", element: IncomeStatement },
      { path: "/balance_sheet", element: BalanceSheet },
      { path: "/trial_balance", element: TrialBalance },
      { path: "/journal", element: JournalTable },
      { path: "/errors", element: Errors },
      { path: "/accounts", element: AccountDetails },
      { path: "/account/:account", element: AccountDetails },
      { path: "/holdings", element: Holdings },
      { path: "/query", element: Query },
      { path: "/editor", element: Editor },
      { path: "/statistics", element: Statistics },
      { path: "/records", element: ImportTable },
      { path: "/import/editor", element: ImportEditor },
      { path: "/directives", element: Editor },
    ],
    "/editor",
  );

  context.menu.set([MainNav]);
  context.ledgerSource.set(
    new LedgerSource(
      localStorage.getItem(LEDGER_KEY) || defaultLedger,
      loadProps,
    ),
  );

  setContext(ContextKey, context);
  setContext(RouterKey, navigation);

  onMount(() => {
    void preloadIncludes(["sample.beancount"]).then(() => {
      const stored = localStorage.getItem(LEDGER_KEY);
      if (stored) {
        context.ledgerSource.set(new LedgerSource(stored, loadProps));
        return;
      }
      void fetch("/sample.beancount")
        .then((res) => (res.ok ? res.text() : null))
        .then((sample) => {
          if (sample) {
            context.ledgerSource.set(new LedgerSource(sample, loadProps));
          }
        });
    });

    const unsub = context.ledgerSource.subscribe((source) => {
      if (source) {
        localStorage.setItem(LEDGER_KEY, source.toString());
      }
    });
    return unsub;
  });
</script>

<Tooltip.Provider delayDuration={0}>
  <Dashboard />
</Tooltip.Provider>
