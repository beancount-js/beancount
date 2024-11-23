<script lang="ts">
  import {
    Wallet,
    Scale,
    Weight,
    NotebookText,
    Search,
    ChartArea,
    ChartPie,
  } from "lucide-svelte";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";

  export const items = [
    {
      name: "Income Statement",
      path: "/income_statement",
      variant: "ghost",
      icon: Wallet,
    },
    {
      name: "Balance Sheet",
      path: "/balance_sheet",
      variant: "ghost",
      icon: Scale,
    },
    {
      name: "Trial Balance",
      path: "/trial_balance",
      variant: "ghost",
      icon: Weight,
    },
    {
      name: "Journal",
      path: "#/journal",
      variant: "ghost",
      icon: NotebookText,
    },
    {
      name: "Holdings",
      path: "/holdings",
      variant: "ghost",
      icon: ChartArea,
    },
    {
      name: "Statistics",
      path: "/statistics",
      variant: "ghost",
      icon: ChartPie,
    },
    {
      name: "Query",
      path: "/query",
      variant: "ghost",
      icon: Search,
    },
  ];
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Content>
    <Sidebar.Group>
      <Sidebar.GroupLabel>Application</Sidebar.GroupLabel>
      <Sidebar.GroupContent>
        <Sidebar.Menu>
          {#each items as item (item.name)}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton>
                {#snippet child({ props })}
                  <a href={item.path} {...props}>
                    <item.icon />
                    <span>{item.name}</span>
                  </a>
                {/snippet}
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {/each}
        </Sidebar.Menu>
      </Sidebar.GroupContent>
    </Sidebar.Group>
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
