<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as Sidebar from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Sidebar",
    component: Sidebar.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned application navigation primitive. Use the structured menu parts and active state rather than recreating a sidebar layout in a page.",
        },
      },
    },
  });
</script>

<Story name="Shows persistent ledger navigation">
  {#snippet template()}
    <div class="h-80 max-w-xs overflow-hidden rounded-md border">
      <Sidebar.Provider class="h-full min-h-0" style="--sidebar-width: 16rem;">
        <Sidebar.Root collapsible="none">
          <Sidebar.Header>
            <strong>Northstar Ledger</strong>
            <span class="text-sm text-sidebar-foreground/70"
              >personal-2026.beancount</span
            >
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
              <Sidebar.GroupContent>
                <Sidebar.Menu>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>Overview</Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton isActive
                      >Transactions</Sidebar.MenuButton
                    >
                  </Sidebar.MenuItem>
                  <Sidebar.MenuItem>
                    <Sidebar.MenuButton>Accounts</Sidebar.MenuButton>
                  </Sidebar.MenuItem>
                </Sidebar.Menu>
              </Sidebar.GroupContent>
            </Sidebar.Group>
          </Sidebar.Content>
          <Sidebar.Footer class="text-xs text-sidebar-foreground/70"
            >3 sources connected</Sidebar.Footer
          >
        </Sidebar.Root>
      </Sidebar.Provider>
    </div>
  {/snippet}
</Story>
