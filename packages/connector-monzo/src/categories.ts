import type {
  ProviderCategory,
  ProviderCategoryDefinition,
} from "@beancount-js/beangulp";

export const MONZO_PROVIDER_CATEGORIES: readonly ProviderCategoryDefinition[] =
  [
    { code: "general", label: "General" },
    { code: "eating_out", label: "Eating out" },
    { code: "expenses", label: "Expenses" },
    { code: "transport", label: "Transport" },
    { code: "cash", label: "Cash" },
    { code: "bills", label: "Bills" },
    { code: "entertainment", label: "Entertainment" },
    { code: "shopping", label: "Shopping" },
    { code: "holidays", label: "Holidays" },
    { code: "groceries", label: "Groceries" },
    { code: "mondo", label: "Top ups" },
  ];

const byCode = new Map(
  MONZO_PROVIDER_CATEGORIES.map((category) => [category.code, category]),
);

function labelForUnknownCode(code: string) {
  return code
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

export function monzoProviderCategory(
  value: unknown,
): ProviderCategory | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLowerCase();
  if (!code) return undefined;
  const known = byCode.get(code);
  return {
    provider: "monzo",
    code,
    label: known?.label ?? labelForUnknownCode(code),
  };
}
