<script lang="ts">
  import { urlForAccount } from "../../helpers";
  import DashboardDonut, {
    type DashboardDonutCategory,
  } from "@beancount-js/ui/dashboard/DashboardDonut.svelte";
  import type { DashboardCategory } from "./model";

  let {
    categories = [],
    currency = "",
    formatter = (value, currencyCode) => `${value} ${currencyCode}`,
    onCategoryFocus = () => {},
    onCategorySelect = () => {},
  }: {
    categories?: readonly DashboardCategory[];
    currency?: string;
    /** Render amounts with the app's formatting utility. */
    formatter?: (value: number, currency: string) => string;
    /** Report hovered/focused categories without owning routing. */
    onCategoryFocus?: (category: DashboardCategory) => void;
    /** Report activated categories so the application can navigate. */
    onCategorySelect?: (category: DashboardCategory) => void;
  } = $props();

  const uiCategories: DashboardDonutCategory[] = $derived(
    categories
      .filter((category) => Number.isFinite(category.value) && category.value > 0)
      .map((category) => ({
        id: category.account,
        label: category.label,
        value: category.value,
        valueLabel: formatter(category.value, currency),
        color: category.color,
      })),
  );

  function withDomainCategory(
    category: DashboardDonutCategory,
  ): DashboardCategory | undefined {
    return categories.find((entry) => entry.account === category.id);
  }

  function handleCategoryFocus(category: DashboardDonutCategory) {
    const domainCategory = withDomainCategory(category);
    if (!domainCategory) return;
    onCategoryFocus(domainCategory);
  }

  function handleCategorySelect(category: DashboardDonutCategory) {
    const domainCategory = withDomainCategory(category);
    if (!domainCategory) return;
    onCategorySelect(domainCategory);
    if (domainCategory.account !== "Other") {
      window.location.href = urlForAccount(domainCategory.account);
    }
  }
</script>

<DashboardDonut
  categories={uiCategories}
  ariaLabel="Outflows by account"
  emptyLabel="No outflows in this period."
  valueFormatter={(value) => formatter(value, currency)}
  onCategoryFocus={handleCategoryFocus}
  onCategorySelect={handleCategorySelect}
/>
