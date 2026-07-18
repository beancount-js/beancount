<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import AppShellDemo from "./AppShellDemo.svelte";

  const { Story } = defineMeta({
    title: "Layout/App Shell",
    component: AppShellDemo,
  });
</script>

<Story name="Ledger workspace" />
