<script lang="ts">
  import Editor from "./components/Editor.svelte";
  import Sidebar from "./components/sidebar/sidebar.svelte";
  import { setLedger } from "./context/ledger.svelte";
  import "@fontsource/source-code-pro";
  import "./codemirror/themes/base.scss";

  setLedger({
    contents: () => {
      return localStorage.getItem("ledger") || ";; Beancount Ledger";
    },
    setContents: (value) => {
      localStorage.setItem("ledger", value);
    },
  });
</script>

<Sidebar>
  <div class="p-3">
    <Editor />
  </div>
</Sidebar>
