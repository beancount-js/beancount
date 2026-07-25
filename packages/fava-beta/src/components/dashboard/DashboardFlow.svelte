<script lang="ts">
  import { urlForAccount } from "../../helpers";
  import DashboardFlow, {
    type DashboardFlowCategory,
  } from "@lapis/ui/dashboard/DashboardFlow.svelte";
  import {
    dashboardFlowDeficitAccount,
    dashboardFlowSurplusAccount,
  } from "./geometry";
  import type { DashboardCategory } from "./model";

  type FlowSide = "in" | "out";

  let {
    inflows = [],
    outflows = [],
    currency = "",
    formatter = (value, currencyCode) => `${value} ${currencyCode}`,
    onCategoryFocus = () => {},
    onCategorySelect = () => {},
  }: {
    inflows?: readonly DashboardCategory[];
    outflows?: readonly DashboardCategory[];
    currency?: string;
    formatter?: (value: number, currency: string) => string;
    /** Report focused flow categories without owning routing. */
    onCategoryFocus?: (
      category: DashboardCategory,
      side: FlowSide,
    ) => void;
    /** Report activated flow categories so the application can navigate. */
    onCategorySelect?: (
      category: DashboardCategory,
      side: FlowSide,
    ) => void;
  } = $props();

  const uiInflowCategories = $derived(
    inflows
      .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
      .map((entry) => ({
        id: entry.account,
        label: entry.label,
        value: entry.value,
        color: entry.color,
        valueLabel: formatter(entry.value, currency),
      })),
  );

  const uiOutflowCategories = $derived(
    outflows
      .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
      .map((entry) => ({
        id: entry.account,
        label: entry.label,
        value: entry.value,
        color: entry.color,
        valueLabel: formatter(entry.value, currency),
      })),
  );

  function domainCategory(
    category: DashboardFlowCategory,
  ): DashboardCategory | undefined {
    return [...inflows, ...outflows].find((entry) => entry.account === category.id);
  }

  function canNavigate(category: DashboardCategory) {
    return ![
      "Other",
      dashboardFlowDeficitAccount,
      dashboardFlowSurplusAccount,
    ].includes(category.account);
  }

  function handleCategoryFocus(category: DashboardFlowCategory, side: FlowSide) {
    const domain = domainCategory(category);
    if (domain) onCategoryFocus(domain, side);
  }

  function handleCategorySelect(category: DashboardFlowCategory, side: FlowSide) {
    const domain = domainCategory(category);
    if (domain) {
      onCategorySelect(domain, side);
      if (canNavigate(domain)) {
        window.location.href = urlForAccount(domain.account);
      }
    }
  }
</script>

<DashboardFlow
  inflows={uiInflowCategories}
  outflows={uiOutflowCategories}
  emptyLabel="No cash-flow activity matches this period."
  valueFormatter={(value) => formatter(value, currency)}
  onCategoryFocus={handleCategoryFocus}
  onCategorySelect={handleCategorySelect}
/>
