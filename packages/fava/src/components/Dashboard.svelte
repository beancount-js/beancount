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
  import ComboBox from "./ComboBoxx.svelte";
  import { Button } from "$lib/components/ui/button";
  import { ArrowUpDown } from "lucide-svelte";
  import type { PaneAPI } from "paneforge/dist/components/types";
  import { derived } from "svelte/store";
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

  $: showSidebar = menus.flat().length > 1;

  $: isCollapsed = derived([ledgerData], ([$ledgerData]) => {
    const value = $ledgerData.options.ledger.dashboard_collapsed;
    if (pane) {
      if (!init) {
        init = true;
        if (value && !pane.isCollapsed()) {
          pane.collapse();
        } else if (!value && !pane.isExpanded()) {
          pane.expand();
        }
      }
    }
    return value;
  });

  function onCollapse() {
    if (!init) {
      return;
    }
    ledgerSource.set(
      $ledgerSource.withLedgerOption("dashboard_collapsed", "true"),
    );
  }

  function onExpand() {
    if (!init) {
      return;
    }
    ledgerSource.set(
      $ledgerSource.withLedgerOption("dashboard_collapsed", "false"),
    );
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
        path: "#/errors",
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
        data-collapsed={$isCollapsed}
        class={cn("group flex flex-col gap-4 pb-2 data-[collapsed=true]:py-2", {
          "min-w-[45px] max-w-[45px]": $isCollapsed,
        })}
      >
        <nav
          class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
        >
          {#if $isCollapsed}
            <Button
              aria-label="Expand"
              size="icon"
              variant="ghost"
              class="size-9"
              on:click={() => pane.expand()}
            >
              <PanelLeftOpen class="size-5 text-primary/60" />
            </Button>
          {:else}
            <Button
              aria-label="Collapse"
              size="icon"
              variant="ghost"
              class="size-9"
              on:click={() => pane.collapse()}
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
        class={cn("h-screen", {
          "min-w-[175px]": !$isCollapsed,
          "min-w-[45px] max-w-[45px]": $isCollapsed,
        })}
        minSize={10}
        maxSize={15}
        {onCollapse}
        {onExpand}
      >
        {#each menus as items, i}
          <Nav isCollapsed={$isCollapsed} {items} />
          {#if i == 0}
            {#if queries.length}
              <div
                data-collapsed={$isCollapsed}
                class="group flex flex-col gap-4 pb-2 data-[collapsed=true]:py-2"
              >
                <nav
                  class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
                >
                  <ComboBox
                    items={queries}
                    placeholder="Select Query"
                    value={$activeRoute.query["qs"]}
                    onValueChange={navigateToQuery}
                  >
                    <svelte:fragment
                      slot="trigger"
                      let:builder
                      let:open
                      let:value
                    >
                      {#if $isCollapsed}
                        <Button
                          builders={[builder]}
                          variant="ghost"
                          size="icon"
                          class="size-9"
                        >
                          <ChevronsRight class="size-4" />
                          <span class="sr-only size-4">{value}</span>
                        </Button>
                      {:else}
                        <Button
                          size="sm"
                          builders={[builder]}
                          variant="ghost"
                          role="combobox"
                          aria-expanded={open}
                          class="mx-1 w-full justify-start px-2"
                        >
                          <ChevronsRight class="mr-2 size-4" />
                          <span
                            class="max-w-[120px] overflow-hidden overflow-ellipsis text-xs"
                            >{value}</span
                          >
                        </Button>
                      {/if}
                    </svelte:fragment>
                  </ComboBox>
                </nav>
              </div>
            {/if}
            {#if accounts.length}
              <Separator />
              <div
                data-collapsed={$isCollapsed}
                class:py-2={menus.length == 1}
                class="group flex flex-col gap-4 pt-2 data-[collapsed=true]:py-2"
              >
                <nav
                  class="grid gap-1 px-2 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2"
                >
                  <ComboBox
                    items={accounts}
                    groups={[accountGroups]}
                    value={$activeRoute.params["account"]}
                    placeholder="Select Account"
                    onValueChange={navigateToAccount}
                  >
                    <svelte:fragment
                      slot="trigger"
                      let:builder
                      let:open
                      let:value
                    >
                      {#if $isCollapsed}
                        <Button
                          builders={[builder]}
                          variant="ghost"
                          size="icon"
                          class="size-9"
                        >
                          <ArrowUpDown class="size-4" />
                          <span class="sr-only size-4">{value}</span>
                        </Button>
                      {:else}
                        <Button
                          size="sm"
                          builders={[builder]}
                          variant="ghost"
                          role="combobox"
                          aria-expanded={open}
                          class="mx-1 w-full justify-start px-2"
                        >
                          <ArrowUpDown class="mr-2 size-4" />
                          <span
                            class="max-w-[120px] overflow-hidden overflow-ellipsis text-xs"
                            >{value}</span
                          >
                        </Button>
                      {/if}
                    </svelte:fragment>
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
      <Resizable.Pane>
        <div class="">
          <div class="pr-2">
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
