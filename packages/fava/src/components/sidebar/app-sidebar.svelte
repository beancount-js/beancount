<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import { useLedger } from "../../context/ledger.svelte";
  const ledger = useLedger();
  const current = $derived(ledger.navigation.activeRoute.route);
  const handler = ledger.navigation.routerLink;
</script>

<Sidebar.Root collapsible="icon">
  <Sidebar.Content>
    {#each ledger.menu as menu (menu.name)}
      <Sidebar.Group>
        <Sidebar.GroupLabel>{menu.name}</Sidebar.GroupLabel>
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each menu.items as item (item.name)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton isActive={current.path === item.path}>
                  {#snippet tooltipContent()}
                    {item.name}
                  {/snippet}
                  {#snippet child({ props })}
                    <a href={item.path} {...props} use:handler>
                      <item.icon />
                      <span>{item.name}</span>
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
                {#if item.badge}
                  <Sidebar.MenuBadge>{item.badge}</Sidebar.MenuBadge>
                {/if}
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
