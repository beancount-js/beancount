<script lang="ts">
  import * as Resizable from "$lib/components/ui/resizable";
  import Nav from "./Nav.svelte";
  import { accountIcon, type MenuItem } from "../menu";
  import {
    ChevronsRight,
    ShieldX,
    PanelLeftOpen,
    PanelLeftClose,
  } from "lucide-svelte";
  import View from "../router/View.svelte";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import Separator from "$lib/components/ui/separator/separator.svelte";
  import ComboBox from "./ComboBox.svelte";
  import { Button } from "$lib/components/ui/button";
  import { ArrowUpDown } from "lucide-svelte";
  import type { PaneAPI } from "paneforge/dist/components/types";
  import { writable } from "svelte/store";
  import { useLedger } from "./helpers";
  import { Query } from "@beancount-js/beancount";
  import { cn } from "$lib/utils";
  import Search from "./Search.svelte";

  const { menu, ledgerSource, bqlQuery } = useContext();
  const ledgerData = useLedger();
  const { routerLink } = useNavigation();
  const { router } = useNavigation();
  const { activeRoute } = router;

  export let navCollapsedSize: number = 5;

  let pane: PaneAPI;
  let init: boolean = false;
  const sidebarCollapsed = writable(false);

  $: showSidebar = menus.flat().length > 1;

  $: if (pane && !init && $ledgerData) {
    init = true;
    sidebarCollapsed.set($ledgerData.options.ledger.dashboard_collapsed);
    if ($sidebarCollapsed && !pane.isCollapsed()) {
      pane.collapse();
    } else if (!$sidebarCollapsed && !pane.isExpanded()) {
      pane.expand();
    }
  }

  function persistSidebarCollapsed(collapsed: boolean) {
    if (!init) {
      return;
    }
    ledgerSource.set(
      $ledgerSource.withLedgerOption(
        "dashboard_collapsed",
        collapsed ? "true" : "false",
      ),
    );
  }

  function handleCollapse() {
    sidebarCollapsed.set(true);
    pane?.collapse();
    queueMicrotask(() => persistSidebarCollapsed(true));
  }

  function handleExpand() {
    sidebarCollapsed.set(false);
    pane?.expand();
    queueMicrotask(() => persistSidebarCollapsed(false));
  }

  $: getMenu = () => {
    const values: Array<MenuItem[]> = [];
    $menu.forEach((it) => values.push([...it]));
    if (!values.length) {
      values.push([]);
    }
    if ($ledgerData.errors.length) {
      values[0].push({
        name: "Errors",
        path: "/errors",
        variant: "ghost",
        icon: ShieldX,
        label: `${$ledgerData.errors.length}`,
      });
    }
    return values.filter((it) => it.length > 0);
  };

  $: menus = getMenu();

  $: ledgerAccounts = [
    ...new Set(
      $ledgerData.directives
        .map((it) => it.accounts)
        .flat()
        .filter((it) => it.length > 0),
    ),
  ];
  $: accounts = ledgerAccounts
    .filter((it) => it.length > 0)
    .map((it) => ({ label: it, value: it }));
  $: queries = $ledgerSource.directives
    .filter((it) => it instanceof Query)
    .map((it) => ({ label: it.name, value: it.query }));
  $: accountGroups = {
    group: "Accounts",
    items: [
      { label: "All", value: "-" },
      ...[
        ...[...new Set(ledgerAccounts.map((it) => it.split(":", 2)[0]))]
          .filter((it) => it.length > 0)
          .map((it) => ({ label: it, value: it, icon: accountIcon(it) })),
      ],
    ],
  };

  function navigateToAccount(account: string) {
    if (!account) {
      return;
    } else if (account === "-") {
      router.push("/accounts");
      return;
    }

    router.push("/account/" + account);
  }

  function navigateToQuery(query: string) {
    if (!query) {
      return;
    }
    bqlQuery.set(query);
    router.push("/query?qs=" + encodeURIComponent(query));
  }
</script>

<div class="h-full" use:routerLink>
  {#if showSidebar}
    <div class="flex w-full items-center">
      <div
        data-collapsed={$sidebarCollapsed}
        class={cn("group flex flex-col gap-4 pb-2 data-[collapsed=true]:py-2", {
          "min-w-[45px] max-w-[45px]": $sidebarCollapsed,
        })}
      >
        <nav
          class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
        >
          {#if $sidebarCollapsed}
            <Button
              aria-label="Expand"
              size="icon"
              variant="ghost"
              class="size-9"
              onclick={handleExpand}
            >
              <PanelLeftOpen class="size-5 text-primary/60" />
            </Button>
          {:else}
            <Button
              aria-label="Collapse"
              size="icon"
              variant="ghost"
              class="size-9"
              onclick={handleCollapse}
            >
              <PanelLeftClose class="size-5 text-primary/60" />
            </Button>
          {/if}
        </nav>
      </div>
      <div class="w-full">
        <Search />
      </div>
    </div>
    <Resizable.PaneGroup direction="horizontal" class="h-full items-stretch">
      <Resizable.Pane
        collapsedSize={navCollapsedSize}
        collapsible
        bind:pane
        class={cn("h-screen", {
          "min-w-[175px]": !$sidebarCollapsed,
          "min-w-[45px] max-w-[45px]": $sidebarCollapsed,
        })}
        minSize={10}
        maxSize={15}
        onCollapse={() => {
          sidebarCollapsed.set(true);
          persistSidebarCollapsed(true);
        }}
        onExpand={() => {
          sidebarCollapsed.set(false);
          persistSidebarCollapsed(false);
        }}
      >
        {#each menus as items, i}
          <Nav isCollapsed={$sidebarCollapsed} {items} />
          {#if i == 0}
            {#if queries.length}
              <div
                data-collapsed={$sidebarCollapsed}
                class="group flex flex-col gap-4 pb-2 data-[collapsed=true]:py-2"
              >
                <nav
                  class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
                >
                  <ComboBox
                    items={queries}
                    placeholder="Select Query"
                    value={$activeRoute.query["qs"] ?? ""}
                    onValueChange={navigateToQuery}
                  >
                    {#snippet trigger({
                      props,
                      value: label,
                      open: isOpen,
                      hasSelection,
                    })}
                      {#if $sidebarCollapsed}
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          class="size-9"
                          aria-expanded={isOpen}
                        >
                          <ChevronsRight class="size-4" />
                          <span class="sr-only">{label}</span>
                        </Button>
                      {:else}
                        <Button
                          {...props}
                          size="sm"
                          variant="ghost"
                          role="combobox"
                          aria-expanded={isOpen}
                          class="mx-1 w-full justify-start px-2"
                        >
                          <ChevronsRight class="mr-2 size-4 shrink-0" />
                          <span
                            class={cn(
                              "min-w-0 flex-1 overflow-hidden text-ellipsis text-xs",
                              !hasSelection && "text-muted-foreground",
                            )}>{label}</span
                          >
                        </Button>
                      {/if}
                    {/snippet}
                  </ComboBox>
                </nav>
              </div>
            {/if}
            {#if accounts.length}
              <Separator />
              <div
                data-collapsed={$sidebarCollapsed}
                class:py-2={menus.length == 1}
                class="group flex flex-col gap-4 pt-2 data-[collapsed=true]:py-2"
              >
                <nav
                  class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
                >
                  <ComboBox
                    items={accounts}
                    groups={[accountGroups]}
                    value={$activeRoute.params["account"] ?? ""}
                    placeholder="Select Account"
                    onValueChange={navigateToAccount}
                  >
                    {#snippet trigger({
                      props,
                      value: label,
                      open: isOpen,
                      hasSelection,
                    })}
                      {#if $sidebarCollapsed}
                        <Button
                          {...props}
                          variant="ghost"
                          size="icon"
                          class="size-9"
                          aria-expanded={isOpen}
                        >
                          <ArrowUpDown class="size-4" />
                          <span class="sr-only">{label}</span>
                        </Button>
                      {:else}
                        <Button
                          {...props}
                          size="sm"
                          variant="ghost"
                          role="combobox"
                          aria-expanded={isOpen}
                          class="mx-1 w-full justify-start px-2"
                        >
                          <ArrowUpDown class="mr-2 size-4 shrink-0" />
                          <span
                            class={cn(
                              "min-w-0 flex-1 overflow-hidden text-ellipsis text-xs",
                              !hasSelection && "text-muted-foreground",
                            )}>{label}</span
                          >
                        </Button>
                      {/if}
                    {/snippet}
                  </ComboBox>
                </nav>
              </div>
            {/if}
          {:else if i != menus.length - 1}
            <Separator />
          {/if}
        {/each}
      </Resizable.Pane>
      <Resizable.Handle
        class="hover:border-s-3 !cursor-col-resize border-s-2 border-solid border-border hover:border-foreground"
      />
      <Resizable.Pane class="min-w-0 overflow-hidden">
        <div class="h-full min-w-0 overflow-hidden">
          <div class="h-full min-w-0 overflow-hidden pr-2">
            <View />
          </div>
        </div>
      </Resizable.Pane>
    </Resizable.PaneGroup>
  {:else}
    <div class="">
      <div class="pr-2">
        <View />
      </div>
    </div>
  {/if}
</div>
