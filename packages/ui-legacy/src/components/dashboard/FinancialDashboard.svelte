<script lang="ts">
  import * as ScrollArea from "../shadcn/scroll-area";
  import * as Select from "../shadcn/select";
  import SegmentedControl from "../forms/SegmentedControl.svelte";
  import ContentScrollArea from "../layout/ContentScrollArea.svelte";
  import DashboardDonut, {
    type DashboardDonutCategory,
  } from "./DashboardDonut.svelte";
  import DashboardFlow from "./DashboardFlow.svelte";
  import DashboardLine, {
    type DashboardLinePoint,
    type DashboardTrendTone,
  } from "./DashboardLine.svelte";
  import DashboardSection from "./DashboardSection.svelte";
  import DashboardTreeTable from "./DashboardTreeTable.svelte";
  import type { DashboardFlowCategory } from "./dashboard-flow";
  import type { DashboardTreeNode } from "./dashboard-tree-table";

  export type FinancialDashboardOption = {
    value: string;
    label: string;
  };

  export type FinancialDashboardMetric = {
    id: string;
    label: string;
    valueLabel: string;
    /** Use a direction only when the value itself communicates a trend. */
    trend?: "up" | "down";
    tone?: DashboardTrendTone;
    changeLabel?: string;
    changeDescription?: string;
  };

  export type FinancialDashboardOutflow = DashboardDonutCategory & {
    /** A display-ready percentage or relative contribution. */
    shareLabel: string;
  };

  export type FinancialDashboardAccountGroup = {
    id: string;
    title: string;
    nodes: readonly DashboardTreeNode[];
    emptyLabel?: string;
    viewAllLabel?: string;
  };

  export type FinancialDashboardNetWorth = {
    valueLabel: string;
    change: number;
    changeLabel: string;
    changeDescription?: string;
    trendTone?: DashboardTrendTone;
    points: readonly DashboardLinePoint[];
  };

  export type FinancialDashboardSectionId =
    | "cash-flow"
    | "outflows"
    | "balance-sheet"
    | "net-worth";

  /**
   * A display-model dashboard composition. The application supplies already
   * selected, formatted financial data and remains responsible for all data
   * derivation, routing, persistence, and callbacks.
   */
  let {
    eyebrow = "Overview",
    title = "Financial dashboard",
    period,
    periodOptions = [],
    currency,
    currencyOptions = [],
    valuation,
    valuationOptions = [],
    metrics = [],
    inflows = [],
    outflows = [],
    accountGroups = [],
    netWorth,
    valueFormatter = (value) => String(value),
    onPeriodChange,
    onCurrencyChange,
    onValuationChange,
    onSectionOpenChange,
    onFlowCategorySelect,
    onOutflowFocus,
    onOutflowSelect,
    onAccountSelect,
    onAccountGroupSelect,
  }: {
    eyebrow?: string;
    title?: string;
    period?: string;
    periodOptions?: readonly FinancialDashboardOption[];
    currency?: string;
    currencyOptions?: readonly FinancialDashboardOption[];
    valuation?: string;
    valuationOptions?: readonly FinancialDashboardOption[];
    metrics?: readonly FinancialDashboardMetric[];
    inflows?: readonly DashboardFlowCategory[];
    outflows?: readonly FinancialDashboardOutflow[];
    accountGroups?: readonly FinancialDashboardAccountGroup[];
    netWorth?: FinancialDashboardNetWorth;
    valueFormatter?: (value: number) => string;
    onPeriodChange?: (value: string) => void;
    onCurrencyChange?: (value: string) => void;
    onValuationChange?: (value: string) => void;
    onSectionOpenChange?: (
      section: FinancialDashboardSectionId,
      open: boolean,
    ) => void;
    onFlowCategorySelect?: (category: DashboardFlowCategory) => void;
    onOutflowFocus?: (category: DashboardDonutCategory) => void;
    onOutflowSelect?: (category: FinancialDashboardOutflow) => void;
    onAccountSelect?: (
      node: DashboardTreeNode,
      group: FinancialDashboardAccountGroup,
    ) => void;
    onAccountGroupSelect?: (group: FinancialDashboardAccountGroup) => void;
  } = $props();

  let sectionOpen = $state<Record<FinancialDashboardSectionId, boolean>>({
    "cash-flow": true,
    outflows: true,
    "balance-sheet": true,
    "net-worth": true,
  });

  const valuationLabels = $derived(
    Object.fromEntries(
      valuationOptions.map((option) => [option.value, option.label]),
    ),
  );

  function optionLabel(
    value: string | undefined,
    options: readonly FinancialDashboardOption[],
  ): string {
    return (
      options.find((option) => option.value === value)?.label ?? value ?? ""
    );
  }

  function setSectionOpen(section: FinancialDashboardSectionId, open: boolean) {
    sectionOpen = { ...sectionOpen, [section]: open };
    onSectionOpenChange?.(section, open);
  }
</script>

<ContentScrollArea contentClass="scroll-container">
  <main class="cn-dashboard-financialdashboard-153-1">
    <header class="cn-dashboard-financialdashboard-155-1">
      <div>
        <p class="cn-dashboard-financialdashboard-159-1">
          {eyebrow}
        </p>
        <h1 class="cn-dashboard-financialdashboard-163-1">
          {title}
        </h1>
      </div>
      <div class="cn-dashboard-financialdashboard-167-1">
        {#if periodOptions.length && period}
          <Select.Root
            type="single"
            value={period}
            onValueChange={(value) => {
              if (typeof value === "string") onPeriodChange?.(value);
            }}
          >
            <Select.Trigger
              class="cn-dashboard-financialdashboard-177-1"
              aria-label="Dashboard period"
            >
              {optionLabel(period, periodOptions)}
            </Select.Trigger>
            <Select.Content aria-label="Dashboard period options">
              <Select.Group>
                {#each periodOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        {/if}

        {#if currencyOptions.length > 1 && currency}
          <Select.Root
            type="single"
            value={currency}
            onValueChange={(value) => {
              if (typeof value === "string") onCurrencyChange?.(value);
            }}
          >
            <Select.Trigger
              class="cn-dashboard-financialdashboard-203-1"
              aria-label="Display currency"
            >
              {optionLabel(currency, currencyOptions)}
            </Select.Trigger>
            <Select.Content aria-label="Display currency options">
              <Select.Group>
                {#each currencyOptions as option (option.value)}
                  <Select.Item value={option.value} label={option.label}>
                    {option.label}
                  </Select.Item>
                {/each}
              </Select.Group>
            </Select.Content>
          </Select.Root>
        {:else if currency}
          <span class="cn-dashboard-financialdashboard-220-1">
            {currency}
          </span>
        {/if}

        {#if valuation && valuationOptions.length >= 2 && valuationOptions.length <= 3}
          <SegmentedControl
            value={valuation}
            options={valuationOptions.map((option) => option.value)}
            labels={valuationLabels}
            ariaLabel="Dashboard valuation"
            onChange={(value) => onValuationChange?.(value)}
          />
        {/if}
      </div>
    </header>

    <section
      class="cn-dashboard-financialdashboard-239-1"
      aria-label="Period summary"
    >
      {#each metrics as metric (metric.id)}
        <article class="cn-dashboard-financialdashboard-243-1">
          <p class="cn-dashboard-financialdashboard-245-1">
            {metric.label}
          </p>
          <p
            class:positive={metric.tone === "positive"}
            class:negative={metric.tone === "negative"}
            class="cn-dashboard-financialdashboard-252-1"
          >
            {#if metric.trend === "up"}
              <span aria-hidden="true">↗</span>
            {:else if metric.trend === "down"}
              <span aria-hidden="true">↘</span>
            {/if}
            {metric.valueLabel}
          </p>
          {#if metric.changeLabel}
            <p
              class:positive={metric.tone === "positive"}
              class:negative={metric.tone === "negative"}
              class="cn-dashboard-financialdashboard-265-1"
            >
              {metric.changeLabel}
              {#if metric.changeDescription}
                <span class="cn-dashboard-financialdashboard-269-1">
                  {metric.changeDescription}
                </span>
              {/if}
            </p>
          {/if}
        </article>
      {:else}
        <p class="cn-dashboard-financialdashboard-277-1">
          No summary is available for this period.
        </p>
      {/each}
    </section>

    <div class="cn-dashboard-financialdashboard-283-1">
      <DashboardSection
        id="financial-dashboard-cash-flow"
        title="Cash flow"
        eyebrow={optionLabel(period, periodOptions)}
        open={sectionOpen["cash-flow"]}
        onOpenChange={(open) => setSectionOpen("cash-flow", open)}
      >
        <DashboardFlow
          {inflows}
          {outflows}
          {valueFormatter}
          onCategorySelect={(category) => onFlowCategorySelect?.(category)}
        />
      </DashboardSection>

      <DashboardSection
        id="financial-dashboard-outflows"
        title="Outflows"
        eyebrow="Where money went"
        open={sectionOpen.outflows}
        onOpenChange={(open) => setSectionOpen("outflows", open)}
      >
        <div class="cn-dashboard-financialdashboard-307-1">
          <DashboardDonut
            categories={outflows}
            {valueFormatter}
            onCategoryFocus={(category) => onOutflowFocus?.(category)}
          />
          <ScrollArea.Root
            orientation="horizontal"
            class="cn-dashboard-financialdashboard-316-1"
          >
            <div
              class="cn-dashboard-financialdashboard-319-1"
              data-dashboard-outflow-table
            >
              <div class="cn-dashboard-financialdashboard-323-1">
                <span>Category</span>
                <span class="cn-dashboard-financialdashboard-326-1">Share</span>
                <span class="cn-dashboard-financialdashboard-327-1">Value</span>
              </div>
              {#each outflows as category (category.id)}
                <button
                  type="button"
                  class="cn-dashboard-financialdashboard-332-1"
                  disabled={!onOutflowSelect}
                  onclick={() => onOutflowSelect?.(category)}
                >
                  <span class="cn-dashboard-financialdashboard-337-1">
                    <span
                      class="cn-dashboard-financialdashboard-340-1"
                      style={`background: ${category.color}`}
                      aria-hidden="true"
                    ></span>
                    <span class="cn-dashboard-financialdashboard-344-1">
                      {category.label}
                    </span>
                  </span>
                  <span class="cn-dashboard-financialdashboard-349-1">
                    <span class="cn-dashboard-financialdashboard-351-1"
                      >Share
                    </span>{category.shareLabel}
                  </span>
                  <span class="cn-dashboard-financialdashboard-354-1">
                    {category.valueLabel ?? valueFormatter(category.value)}
                  </span>
                </button>
              {:else}
                <p class="cn-dashboard-financialdashboard-360-1">
                  No outflows match this period.
                </p>
              {/each}
            </div>
          </ScrollArea.Root>
        </div>
      </DashboardSection>

      <DashboardSection
        id="financial-dashboard-balance-sheet"
        title="Balance sheet"
        eyebrow="Current position"
        open={sectionOpen["balance-sheet"]}
        onOpenChange={(open) => setSectionOpen("balance-sheet", open)}
      >
        <div class="cn-dashboard-financialdashboard-376-1">
          {#each accountGroups as group (group.id)}
            <DashboardTreeTable
              nodes={group.nodes}
              title={group.title}
              emptyLabel={group.emptyLabel}
              viewAllLabel={group.viewAllLabel}
              {valueFormatter}
              onNodeSelect={(node) => onAccountSelect?.(node, group)}
              onViewAll={onAccountGroupSelect
                ? () => onAccountGroupSelect(group)
                : undefined}
            />
          {:else}
            <p class="cn-dashboard-financialdashboard-390-1">
              No balance-sheet accounts match this period.
            </p>
          {/each}
        </div>
      </DashboardSection>

      <DashboardSection
        id="financial-dashboard-net-worth"
        title="Net worth"
        eyebrow="Trend"
        open={sectionOpen["net-worth"]}
        onOpenChange={(open) => setSectionOpen("net-worth", open)}
      >
        {#if netWorth}
          <div class="cn-dashboard-financialdashboard-406-1">
            <div>
              <p class="cn-dashboard-financialdashboard-410-1">
                {netWorth.valueLabel}
              </p>
            </div>
            <p
              class:positive={netWorth.trendTone === "positive"}
              class:negative={netWorth.trendTone === "negative"}
              class="cn-dashboard-financialdashboard-418-1"
            >
              {netWorth.changeLabel}
              {#if netWorth.changeDescription}
                <span class="cn-dashboard-financialdashboard-422-1">
                  {netWorth.changeDescription}
                </span>
              {/if}
            </p>
          </div>
          <DashboardLine
            points={netWorth.points}
            change={netWorth.change}
            trendTone={netWorth.trendTone}
            {valueFormatter}
          />
        {:else}
          <p class="cn-dashboard-financialdashboard-435-1">
            No net-worth trend is available for this period.
          </p>
        {/if}
      </DashboardSection>
    </div>
  </main>
</ContentScrollArea>

<style>
  .positive {
    color: var(--success-foreground);
  }

  .negative {
    color: var(--destructive);
  }
</style>
