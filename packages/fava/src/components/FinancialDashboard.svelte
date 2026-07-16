<script lang="ts">
  import { ArrowDownRight, ArrowUpRight } from "lucide-svelte";
  import { conversionLabel, type Conversion } from "@beancount-js/beancount";

  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  import DashboardDonut from "./dashboard/DashboardDonut.svelte";
  import DashboardFlow from "./dashboard/DashboardFlow.svelte";
  import DashboardLine from "./dashboard/DashboardLine.svelte";
  import DashboardSection from "./dashboard/DashboardSection.svelte";
  import DashboardTreeTable from "./dashboard/DashboardTreeTable.svelte";
  import {
    createDashboardData,
    dashboardDefaultCurrency,
    dashboardCurrencies,
    dashboardPeriodComparisonLabels,
    dashboardPeriodLabels,
    type DashboardPeriod,
  } from "./dashboard/model";
  import { urlForAccount } from "../helpers";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";

  const { ledgerData, ledgerOptions, conversion, operatingCurrency } =
    useContext();
  const ctx = useCtx();

  const periods: DashboardPeriod[] = ["ytd", "1y", "3y", "all"];
  let period: DashboardPeriod = "ytd";
  let selectedCurrency = "";

  $: currencies = dashboardCurrencies($ledgerData);
  $: defaultCurrency = dashboardDefaultCurrency(currencies, $operatingCurrency);
  $: if (!selectedCurrency || !currencies.includes(selectedCurrency)) {
    selectedCurrency = defaultCurrency;
  }
  $: dashboard = createDashboardData(
    $ledgerData,
    $ledgerOptions,
    $conversion,
    period,
    selectedCurrency,
  );

  function updateConversion(value: string | string[] | undefined) {
    if (typeof value === "string") {
      conversion.set(value as Conversion);
    }
  }

  function updateCurrency(value: string | string[] | undefined) {
    if (typeof value === "string") selectedCurrency = value;
  }

  function updatePeriod(value: string) {
    period = value as DashboardPeriod;
  }
</script>

<ContentScrollArea contentClass="scroll-container">
  <main class="mx-auto w-full max-w-[1440px] px-4 pb-7 pt-5 md:px-6 lg:px-8">
    <header
      class="mb-6 flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div>
        <p
          class="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          Overview
        </p>
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Financial dashboard
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Select.Root type="single" value={period} onValueChange={updatePeriod}>
          <Select.Trigger
            class="h-8 w-36 text-xs font-medium"
            aria-label="Dashboard period"
          >
            {dashboardPeriodLabels[period]}
          </Select.Trigger>
          <Select.Content>
            <Select.Group>
              {#each periods as option}
                <Select.Item
                  value={option}
                  label={dashboardPeriodLabels[option]}
                >
                  {dashboardPeriodLabels[option]}
                </Select.Item>
              {/each}
            </Select.Group>
          </Select.Content>
        </Select.Root>
        {#if currencies.length > 1}
          <Select.Root
            type="single"
            value={selectedCurrency}
            onValueChange={updateCurrency}
          >
            <Select.Trigger
              class="h-8 w-24 text-xs font-medium"
              aria-label="Display currency"
            >
              {dashboard.currency}
            </Select.Trigger>
            <Select.Content>
              <Select.Group>
                {#each currencies as currency}
                  <Select.Item value={currency} label={currency}>
                    {currency}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        {:else if dashboard.currency}
          <span
            class="rounded-md border border-border bg-muted/55 px-3 py-2 font-mono text-xs text-foreground"
          >
            {dashboard.currency}
          </span>
        {/if}
        <ToggleGroup.Root
          type="single"
          aria-label="Valuation method"
          value={$conversion}
          onValueChange={updateConversion}
          class="!gap-0 rounded-lg border border-border bg-muted/65 p-1"
        >
          <ToggleGroup.Item
            value="AT_COST"
            class="!h-6 !min-w-0 !px-2.5 text-xs text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >At Cost</ToggleGroup.Item
          >
          <ToggleGroup.Item
            value="AT_VALUE"
            class="!h-6 !min-w-0 !px-2.5 text-xs text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >At Market Value</ToggleGroup.Item
          >
          <ToggleGroup.Item
            value="UNITS"
            class="!h-6 !min-w-0 !px-2.5 text-xs text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
            >Units</ToggleGroup.Item
          >
        </ToggleGroup.Root>
      </div>
    </header>

    <section
      class="mb-6 grid gap-px overflow-hidden rounded-xl border border-border/80 bg-border/80 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Period summary"
    >
      <div class="bg-card px-5 py-4">
        <p
          class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Income
        </p>
        <p
          class="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground"
        >
          {$ctx.amount(dashboard.income, dashboard.currency)}
        </p>
      </div>
      <div class="bg-card px-5 py-4">
        <p
          class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Outflows
        </p>
        <p
          class="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground"
        >
          {$ctx.amount(dashboard.expenses, dashboard.currency)}
        </p>
      </div>
      <div class="bg-card px-5 py-4">
        <p
          class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Net cash flow
        </p>
        <p
          class:positive={dashboard.cashFlow >= 0}
          class:negative={dashboard.cashFlow < 0}
          class="mt-2 flex items-center gap-1.5 font-mono text-xl font-semibold tabular-nums"
        >
          {#if dashboard.cashFlow >= 0}
            <ArrowUpRight class="size-4" aria-hidden="true" />
          {:else}
            <ArrowDownRight class="size-4" aria-hidden="true" />
          {/if}
          {$ctx.amount(dashboard.cashFlow, dashboard.currency)}
        </p>
      </div>
      <div class="bg-card px-5 py-4">
        <p
          class="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Net worth
        </p>
        <p
          class="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground"
        >
          {$ctx.amount(dashboard.netWorth, dashboard.currency)}
        </p>
        <p
          class:positive={dashboard.netWorthChange >= 0}
          class:negative={dashboard.netWorthChange < 0}
          class="mt-1 font-mono text-xs tabular-nums"
        >
          {$ctx.amount(dashboard.netWorthChange, dashboard.currency)} in this period
        </p>
      </div>
    </section>

    <div class="grid gap-6">
      <DashboardSection
        id="dashboard-cash-flow"
        title="Cash flow"
        eyebrow={dashboardPeriodLabels[period]}
      >
        <DashboardFlow
          inflows={dashboard.inflows}
          outflows={dashboard.outflows}
          currency={dashboard.currency}
          formatter={$ctx.amount}
        />
      </DashboardSection>

      <DashboardSection
        id="dashboard-outflows"
        title="Outflows"
        eyebrow="Where money went"
      >
        <div
          class="grid divide-y divide-border/80 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)] lg:divide-x lg:divide-y-0"
        >
          <DashboardDonut
            categories={dashboard.expenseCategories}
            currency={dashboard.currency}
            formatter={$ctx.amount}
          />
          <div class="p-4 sm:p-5">
            <div
              class="mb-2 grid grid-cols-[minmax(0,1fr)_5.5rem_9rem] gap-4 border-b border-border/80 px-2 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
            >
              <span>Category</span><span class="text-right">Share</span><span
                class="text-right">Value</span
              >
            </div>
            {#if dashboard.expenseCategories.length}
              {#each dashboard.expenseCategories as category (category.account)}
                <a
                  href={category.account === "Other"
                    ? undefined
                    : urlForAccount(category.account)}
                  class="grid grid-cols-[minmax(0,1fr)_5.5rem_9rem] items-center gap-4 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/65"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <span
                      class="size-2.5 shrink-0 rounded-full"
                      style={`background: ${category.color}`}
                    ></span>
                    <span class="break-words font-medium text-foreground"
                      >{category.account}</span
                    >
                  </span>
                  <span
                    class="text-right font-mono text-xs tabular-nums text-muted-foreground"
                  >
                    {dashboard.expenses
                      ? ((category.value / dashboard.expenses) * 100).toFixed(1)
                      : "0.0"}%
                  </span>
                  <span
                    class="text-right font-mono text-sm tabular-nums text-foreground"
                    >{$ctx.amount(category.value, dashboard.currency)}</span
                  >
                </a>
              {/each}
            {:else}
              <p class="px-2 py-6 text-sm text-muted-foreground">
                No outflows match this period.
              </p>
            {/if}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        id="dashboard-balance-sheet"
        title="Balance sheet"
        eyebrow="Current position"
      >
        <div class="grid gap-8 p-4 sm:p-6">
          <DashboardTreeTable
            title="Assets"
            href={urlForAccount($ledgerOptions.beancount.name_assets)}
            tree={dashboard.assets}
            currency={dashboard.currency}
            formatter={$ctx.amount}
          />
          <DashboardTreeTable
            title="Liabilities"
            href={urlForAccount($ledgerOptions.beancount.name_liabilities)}
            tree={dashboard.liabilities}
            currency={dashboard.currency}
            formatter={$ctx.amount}
          />
          <DashboardTreeTable
            title="Equity"
            href={urlForAccount($ledgerOptions.beancount.name_equity)}
            tree={dashboard.equity}
            currency={dashboard.currency}
            formatter={$ctx.amount}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        id="dashboard-net-worth"
        title="Net worth"
        eyebrow="Trend"
      >
        <div
          class="border-b border-border/80 px-5 py-4 sm:flex sm:items-end sm:justify-between"
        >
          <div>
            <p
              class="font-mono text-2xl font-semibold tabular-nums text-foreground"
            >
              {$ctx.amount(dashboard.netWorth, dashboard.currency)}
            </p>
            <p class="mt-1 text-sm text-muted-foreground">
              Valued {conversionLabel($conversion).toLowerCase()}.
            </p>
          </div>
          <p
            class:positive={dashboard.netWorthChange >= 0}
            class:negative={dashboard.netWorthChange < 0}
            class="mt-2 font-mono text-sm tabular-nums sm:mt-0 sm:text-right"
          >
            {$ctx.amount(dashboard.netWorthChange, dashboard.currency)}
            {#if dashboard.netWorthChangePercent !== null}
              ({dashboard.netWorthChangePercent.toFixed(1)}%)
            {/if}
            <span class="block font-sans text-xs text-muted-foreground">
              {dashboardPeriodComparisonLabels[period]}
            </span>
          </p>
        </div>
        <DashboardLine
          points={dashboard.netWorthPoints}
          currency={dashboard.currency}
          change={dashboard.netWorthChange}
          formatter={$ctx.amount}
        />
      </DashboardSection>
    </div>
  </main>
</ContentScrollArea>

<style>
  .positive {
    color: var(--chart-2);
  }

  .negative {
    color: var(--destructive);
  }
</style>
