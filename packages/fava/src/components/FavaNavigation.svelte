<script lang="ts">
  import { ShieldX, Sparkles } from "lucide-svelte";
  import Nav from "./Nav.svelte";
  import Search from "./Search.svelte";
  import ComboBox from "./ComboBox.svelte";
  import { accountIcon, type MenuItem } from "../menu";
  import { useContext } from "../context";
  import { useLedger } from "./helpers";
  import { useNavigation } from "../router/router";
  import { Query } from "@beancount-js/beancount";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { useSidebar } from "$lib/components/ui/sidebar";
  import { useStudioWorkspace } from "../studio/workspace";

  const { menu, ledgerSource, bqlQuery } = useContext();
  const ledgerData = useLedger();
  const { router, routerLink } = useNavigation();
  const { activeRoute } = router;
  const { snapshot } = useStudioWorkspace();
  const sidebar = useSidebar();

  $: menus = getMenu();
  $: ledgerAccounts = [
    ...new Set(
      $ledgerData.directives
        .map((it) => it.accounts)
        .flat()
        .filter((it) => it.length > 0),
    ),
  ];
  $: accounts = ledgerAccounts.map((it) => ({ label: it, value: it }));
  $: queries = $ledgerSource.directives
    .filter((it) => it instanceof Query)
    .map((it) => ({ label: it.name, value: it.query }));
  $: accountGroups = {
    group: "Accounts",
    items: [
      { label: "All", value: "-" },
      ...[...new Set(ledgerAccounts.map((it) => it.split(":", 2)[0]))]
        .filter(Boolean)
        .map((it) => ({ label: it, value: it, icon: accountIcon(it) })),
    ],
  };

  function getMenu() {
    const values: Array<MenuItem[]> = [];
    $menu.forEach((item) => values.push([...item]));
    if (!values.length) values.push([]);
    if ($ledgerData.errors.length) {
      values[0].push({
        name: "Errors",
        path: "#/errors",
        variant: "ghost",
        icon: ShieldX,
        label: `${$ledgerData.errors.length}`,
      });
    }
    return values.filter((items) => items.length > 0);
  }

  function navigateToAccount(account: string) {
    if (!account) return;
    router.push(account === "-" ? "#/accounts" : "#/account/" + account);
  }

  function navigateToQuery(query: string) {
    if (!query) return;
    bqlQuery.set(query);
    router.push("#/query?qs=" + encodeURIComponent(query));
  }

  function openResource(path: string) {
    router.push("#/resource?path=" + encodeURIComponent(path));
  }
</script>

<div class="flex min-h-0 flex-1 flex-col" use:routerLink>
  <Search />
  <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
    {#each menus as items, index}
      <Nav isCollapsed={sidebar.state === "collapsed"} {items} />
      {#if sidebar.state !== "collapsed" && index === 0 && queries.length}
        <ComboBox
          items={queries}
          placeholder="Select Query"
          value={$activeRoute.query["qs"] ?? ""}
          onValueChange={navigateToQuery}
        >
          {#snippet trigger({ props, value: label, hasSelection })}
            <Button {...props} size="sm" variant="ghost" role="combobox" class="w-full justify-start">
              <span class="truncate" class:text-muted-foreground={!hasSelection}>{label}</span>
            </Button>
          {/snippet}
        </ComboBox>
      {/if}
      {#if sidebar.state !== "collapsed" && index === 0 && accounts.length}
        <ComboBox
          items={accounts}
          groups={[accountGroups]}
          value={$activeRoute.params["account"] ?? ""}
          placeholder="Select Account"
          onValueChange={navigateToAccount}
        >
          {#snippet trigger({ props, value: label, hasSelection })}
            <Button {...props} size="sm" variant="ghost" role="combobox" class="w-full justify-start">
              <span class="truncate" class:text-muted-foreground={!hasSelection}>{label}</span>
            </Button>
          {/snippet}
        </ComboBox>
      {/if}
      {#if index !== menus.length - 1}<Separator />{/if}
    {/each}

    {#if sidebar.state !== "collapsed" && $snapshot?.resources.length}
      <Separator />
      <div class="flex flex-col gap-1">
        <p class="px-2 text-xs font-medium text-muted-foreground">Resources</p>
        {#each $snapshot.resources as resource (resource.path)}
          <Button variant="ghost" size="sm" class="w-full justify-start" onclick={() => openResource(resource.path)}>
            <Sparkles data-icon="inline-start" />
            <span class="truncate">{resource.path}</span>
          </Button>
        {/each}
      </div>
    {/if}
  </div>
</div>
