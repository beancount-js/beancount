<script lang="ts">
  import Sidebar from "./components/sidebar/sidebar.svelte";
  import { setLedger, useLedger } from "./context/ledger.svelte";
  import "@fontsource/source-code-pro";
  import "./codemirror/themes/base.scss";
  import View from "./router/View.svelte";
  import Errors from "./components/errors/Errors.svelte";
  import Editor from "./components/Editor.svelte";
  import BalanceSheet from "./components/BalanceSheet.svelte";
  import IncomeStatement from "./components/IncomeStatement.svelte";
  import TrialBalance from "./components/TrialBalance.svelte";
  import JournalTable from "./components/journal-table/JournalTable.svelte";

  setLedger({
    path: window.location.pathname ?? "/editor",
    routes: [
      { path: "/errors", component: Errors },
      { path: "/editor", component: Editor },
      { path: "/journal", component: JournalTable},
      { path: "/income_statement", component: IncomeStatement},
      { path: "/balance_sheet", component: BalanceSheet},
      { path: "/trial_balance", component: TrialBalance}
    ],
    contents: () => {
      return localStorage.getItem("ledger") || ";; Beancount Ledger";
    },
    setContents: (value) => {
      localStorage.setItem("ledger", value);
    },
  });
  const ledger = useLedger();
  const handler = ledger.navigation.routerLink;
</script>

<Sidebar>
  <div class="p-3" use:handler>
    <View />
  </div>
</Sidebar>
