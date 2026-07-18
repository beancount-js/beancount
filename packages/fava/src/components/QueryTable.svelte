<script lang="ts">
  import * as Select from "$lib/components/ui/select";
  import * as Table from "$lib/components/ui/table";

  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import TriangleAlert from "lucide-svelte/icons/triangle-alert";
  import { AccountAvatar } from "@beancount-js/forms";
  import { derived, writable } from "svelte/store";
  import { stringify, useDataset, useLedger, type Columns } from "./helpers";
  import { Inventory } from "@beancount-js/beancount";
  import { useCtx } from "../stores/format";
  import { Decimal, formatDate } from "@beancount-js/parser";
  import { DateTime } from "luxon";
  import { urlForAccount } from "../helpers";
  import { Tree } from "../core/tree";
  import {
    CounterInventory,
    SimpleCounterInventory,
  } from "@beancount-js/beancount";
  import { DefaultMap } from "@beancount-js/beancount";
  import { Amount } from "@beancount-js/beancount";
  import type { FavaChart } from "../charts";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import Chart from "../charts/Chart.svelte";
  import { balances } from "../charts/line";
  import { type SortOrder, type SortType, sortDataset } from "../grid/sort";
  import { Position } from "@beancount-js/beancount";
  import { runBql } from "@beancount-js/beanquery";
  import PagePagination from "./PagePagination.svelte";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { Open } from "@beancount-js/beancount";

  export let query: string = "";

  const PAGE_SIZES = [10, 25, 50, 100];
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  const ctx = useCtx();
  const ledgerData = useLedger();
  const { snapshot } = useStudioWorkspace();

  type AccountAppearance = {
    color?: string;
    icon?: string;
    merchantId?: string;
  };

  type MerchantIdentity = {
    merchantId: string;
    logoUrl?: string;
  };

  let accountAppearances = new Map<string, AccountAppearance>();
  let merchantLogos = new Map<string, string>();
  let loadedMerchantProjectId = "";

  function countLines(content: any) {
    if (typeof content === "string") {
      return content.split("\n").length;
    }
    return 1;
  }

  function chartData(
    data: Array<Record<string, any>>,
    columns: Columns,
  ): FavaChart | null {
    if (!data.length || columns.ids.length !== 2) {
      return null;
    }
    const account = columns.values.find((it) => it.type === "account");
    const date = columns.values.find((it) => it.type === "date");
    const inventory = columns.values.find(
      (it) => it.type === "inventory" || it.type === "amount",
    );

    if (account && inventory) {
      const tree = new Tree({});
      const accountBalances = new DefaultMap<string, CounterInventory>(
        () => new CounterInventory(),
      );

      data.forEach((row) => {
        const acc = row[account.id];
        const amount = row[inventory.id];
        if (acc) {
          if (amount instanceof Inventory) {
            for (const position of amount.values()) {
              accountBalances.get(acc).add(position.units, position.cost);
            }
          } else if (amount instanceof Amount) {
            accountBalances.get(acc).add(amount);
          } else if (amount instanceof SimpleCounterInventory) {
            accountBalances.get(acc).addInventory(amount);
          } else if (amount instanceof CounterInventory) {
            accountBalances.get(acc).addInventory(amount);
          } else if (amount instanceof Position) {
            accountBalances.get(acc).add(amount.units, amount.cost);
          } else if (Array.isArray(amount)) {
            amount.forEach((a) => {
              if (a instanceof Position) {
                accountBalances.get(acc).add(a.units, a.cost);
              } else if (a instanceof Amount) {
                accountBalances.get(acc).add(a);
              }
            });
          }
        }
      });

      for (const [key, balance] of accountBalances.entries()) {
        tree.insertBalance(key, balance);
      }
      return hierarchyFromParsedData("Chart", tree.root.toRecord());
    } else if (inventory && date) {
      return balances(
        `Balances`,
        data.map((it) => {
          return { date: it[date.id], balance: it[inventory.id].value };
        }),
      );
    }

    return null;
  }

  const sortOrder = writable<SortType>({});
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };
  let page = 1;
  let pageSize = PAGE_SIZES[0];

  $: queryResult = derived([ledgerData], ([$ledgerData]) => {
    if (!query) {
      return { data: [], error: undefined };
    }
    return runBql($ledgerData.directives, query, {
      options: $ledgerData.options.beancount,
      errors: $ledgerData.errors,
    });
  });

  $: data = derived([queryResult, sortOrder], ([$queryResult, $sortOrder]) => {
    if ($sortOrder) {
      return sortDataset($queryResult.data, $sortOrder);
    }
    return $queryResult.data;
  });

  $: table = useDataset(data);
  $: ({ columns } = $table);

  $: chart = chartData($data, columns);
  $: pageCount = Math.max(1, Math.ceil($data.length / pageSize));
  $: if (page > pageCount) page = pageCount;
  $: pageStart = (page - 1) * pageSize;
  $: pageEnd = Math.min(pageStart + pageSize, $data.length);
  $: visibleRows = $data.slice(pageStart, pageEnd);

  function orderFor(columnId: string): SortOrder {
    return $sortOrder[columnId]?.order ?? "none";
  }

  function ariaSortFor(columnId: string) {
    const order = orderFor(columnId);
    if (order === "asc") return "ascending";
    if (order === "desc") return "descending";
    return "none";
  }

  function cycleSort(columnId: string, type: string) {
    const order = SORT_CYCLE[orderFor(columnId)];
    page = 1;
    sortOrder.set(order === "none" ? {} : { [columnId]: { type, order } });
  }

  function setPageSize(value: string | undefined) {
    const next = Number(value);
    if (!PAGE_SIZES.includes(next)) return;
    pageSize = next;
    page = 1;
  }

  function accountAppearance(account: string) {
    return accountAppearances.get(account);
  }

  function merchantLogo(merchantId?: string) {
    return merchantId ? merchantLogos.get(merchantId) : undefined;
  }

  async function loadMerchantLogos(projectId: string) {
    try {
      const merchants = await ingestionJson<MerchantIdentity[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if (projectId !== $snapshot?.project.id) return;
      merchantLogos = new Map(
        merchants.flatMap((merchant) =>
          merchant.logoUrl ? [[merchant.merchantId, merchant.logoUrl]] : [],
        ),
      );
    } catch {
      if (projectId === $snapshot?.project.id) merchantLogos = new Map();
    }
  }

  $: accountAppearances = new Map(
    $ledgerData.directives.flatMap((directive) => {
      if (!(directive instanceof Open)) return [];
      const merchantId = directive.meta.merchant_id;
      return [
        [
          directive.account,
          {
            color:
              typeof directive.meta.color === "string"
                ? directive.meta.color
                : undefined,
            icon:
              typeof directive.meta.icon === "string"
                ? directive.meta.icon
                : undefined,
            merchantId: typeof merchantId === "string" ? merchantId : undefined,
          },
        ],
      ];
    }),
  );
  $: accountMerchantIds = [...accountAppearances.values()]
    .map((appearance) => appearance.merchantId)
    .filter((merchantId): merchantId is string => Boolean(merchantId));
  $: projectId = $snapshot?.project.id ?? "";
  $: if (isWeb || !projectId || !accountMerchantIds.length) {
    loadedMerchantProjectId = "";
    merchantLogos = new Map();
  } else if (projectId !== loadedMerchantProjectId) {
    loadedMerchantProjectId = projectId;
    void loadMerchantLogos(projectId);
  }
</script>

<div class="query-table" data-query-table>
  {#if chart}
    <div class="mt-4 rounded-xl border bg-card p-3 text-xs shadow-sm">
      <Chart {chart} hideButtons />
    </div>
  {/if}
  <div class="mt-4 overflow-hidden rounded-xl border bg-card shadow-sm">
    <Table.Root class="min-w-max font-mono text-xs text-foreground">
      <Table.Header class="bg-muted text-muted-foreground">
        <Table.Row class="hover:bg-muted">
          {#each columns.values as col}
            {@const order = orderFor(col.id)}
            <Table.Head
              aria-sort={ariaSortFor(col.id)}
              style={col.style}
              class={"!p-0 " + col.class.join(" ")}
            >
              <button
                type="button"
                class="inline-flex h-10 w-full items-center gap-1.5 rounded-md px-3 text-left font-sans text-xs font-semibold tracking-wide outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                class:justify-end={col.class.includes("text-right")}
                aria-label={`Sort by ${col.name}`}
                onclick={() => cycleSort(col.id, col.type)}
              >
                <span class="truncate">{col.name}</span>
                {#if order === "asc"}
                  <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                {:else if order === "desc"}
                  <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                {:else}
                  <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
                {/if}
              </button>
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each visibleRows as row}
          <Table.Row>
            {#each columns.values as col}
              {@const value = row[col.id]}
              <Table.Cell
                style={col.style}
                class={"font-mono text-xs " + col.class.join(" ")}
              >
                {#if col.type === "account" && !Array.isArray(value) && value}
                  {@const account = String(value)}
                  {@const appearance = accountAppearance(account)}
                  <a
                    href={urlForAccount(account)}
                    class="inline-flex items-center gap-1.5"
                    data-merchant-id={appearance?.merchantId}
                  >
                    <AccountAvatar
                      {account}
                      color={appearance?.color}
                      icon={appearance?.icon}
                      merchantLogoUrl={merchantLogo(appearance?.merchantId)}
                      size="sm"
                    />
                    <span>{account}</span>
                  </a>
                {:else if value instanceof Inventory}
                  {#each [...value.values()] as position}
                    <span class="block text-right"
                      >{$ctx.money(position.units)}</span
                    >
                  {/each}
                {:else if Array.isArray(value)}
                  {#each value as item, i}
                    {@const rowval = stringify(item)}
                    {@const lines = countLines(rowval)}
                    <div class:border-t={i > 0}>
                      {#if col.type === "account"}
                        {@const appearance = accountAppearance(rowval)}
                        <a
                          href={urlForAccount(rowval)}
                          class="inline-flex items-center gap-1.5"
                          data-merchant-id={appearance?.merchantId}
                        >
                          <AccountAvatar
                            account={rowval}
                            color={appearance?.color}
                            icon={appearance?.icon}
                            merchantLogoUrl={merchantLogo(
                              appearance?.merchantId,
                            )}
                            size="sm"
                          />
                          <span>{rowval}</span>
                        </a>
                      {:else if item instanceof Amount || item instanceof Decimal}
                        {$ctx.money(item)}
                      {:else if item instanceof Date || item instanceof DateTime}
                        {formatDate(
                          item instanceof DateTime ? item.toJSDate() : item,
                        )}
                      {:else}
                        <span class:whitespace-pre={lines > 1}>{rowval}</span>
                      {/if}
                    </div>
                  {/each}
                {:else if value instanceof Date || value instanceof DateTime}
                  {formatDate(
                    value instanceof DateTime ? value.toJSDate() : value,
                  )}
                {:else if value instanceof Amount || value instanceof Decimal}
                  {value instanceof Decimal && value.eq(0)
                    ? ""
                    : $ctx.money(value)}
                {:else}
                  {@const rowval = stringify(value)}
                  <span class:whitespace-pre={countLines(rowval) > 1}
                    >{rowval}</span
                  >
                {/if}
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell
              colspan={Math.max(columns.values.length, 1)}
              class="h-24 text-center font-sans text-sm text-muted-foreground"
            >
              No results.
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
      {#if $queryResult.error}
        <Table.Footer
          class="bg-destructive/10 text-destructive"
          data-query-error-footer
        >
          <Table.Row class="hover:bg-transparent">
            <Table.Cell
              colspan={Math.max(columns.values.length, 1)}
              class="px-4 py-3"
            >
              <div class="flex items-start gap-2" role="alert">
                <TriangleAlert
                  class="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div class="min-w-0">
                  <p class="text-xs font-medium">Could not run query</p>
                  <p
                    class="mt-0.5 break-words font-mono text-[11px] leading-snug opacity-90"
                  >
                    {$queryResult.error}
                  </p>
                </div>
              </div>
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      {/if}
    </Table.Root>
  </div>
  {#if $data.length > PAGE_SIZES[0]}
    <div
      class="mt-3 flex flex-col gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-query-pagination
    >
      <span class="text-sm text-muted-foreground"
        >Showing {pageStart + 1}&ndash;{pageEnd} of {$data.length}</span
      >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex items-center gap-2">
          <span
            class="text-sm text-muted-foreground"
            id="query-table-page-size-label">Rows per page</span
          >
          <Select.Root
            type="single"
            value={String(pageSize)}
            onValueChange={setPageSize}
          >
            <Select.Trigger
              aria-labelledby="query-table-page-size-label"
              class="h-8 w-20 font-mono text-sm tabular-nums"
              data-query-page-size
            >
              {pageSize}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each PAGE_SIZES as size (size)}
                  <Select.Item value={String(size)} label={`${size} records`}>
                    {size}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        </div>
        {#if pageCount > 1}
          <PagePagination
            {page}
            {pageCount}
            ariaLabel="Query result pages"
            onPageChange={(nextPage) => (page = nextPage)}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
