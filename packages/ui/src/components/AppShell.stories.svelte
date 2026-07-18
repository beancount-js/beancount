<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import AppShell from "./AppShell.svelte";
  import AppShellDemo from "./AppShellDemo.svelte";

  const { Story } = defineMeta({
    title: "Layout/App Shell",
    component: AppShell,
  });
</script>

<Story name="Ledger workspace">
  {#snippet template()}
    <AppShellDemo />
  {/snippet}
</Story>
