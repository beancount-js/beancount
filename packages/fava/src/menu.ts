import type { ComponentType } from "svelte";
import type { Icon } from "lucide-svelte";
import { type VariantProps } from "tailwind-variants";
import {
  Wallet,
  Scale,
  Weight,
  NotebookText,
  BadgeDollarSign,
  BadgeMinus,
  BadgePlus,
  BadgeInfo,
  BadgePercent,
  Tags,
  ListTree,
  Search,
  ChartArea,
  ChartPie,
} from "lucide-svelte";
import type { buttonVariants } from "$lib/components/ui/button";
import { urlForAccount } from "./helpers";
type Variant = VariantProps<typeof buttonVariants>["variant"];
export interface MenuItem {
  name: string;
  path: string;
  variant: Variant;
  label?: string;
  icon: ComponentType<Icon>;
}

export const MainNav: Array<MenuItem> = [
  {
    name: "Income Statement",
    path: "/income_statement",
    variant: "ghost",
    icon: Wallet,
  },
  {
    name: "Balance Sheet",
    path: "/balance_sheet",
    variant: "ghost",
    icon: Scale,
  },
  {
    name: "Trial Balance",
    path: "/trial_balance",
    variant: "ghost",
    icon: Weight,
  },
  { name: "Journal", path: "#/journal", variant: "ghost", icon: NotebookText },
  {
    name: "Holdings",
    path: "/holdings",
    variant: "ghost",
    icon: ChartArea,
  },
  {
    name: "Statistics",
    path: "/statistics",
    variant: "ghost",
    icon: ChartPie,
  },
  {
    name: "Query",
    path: "/query",
    variant: "ghost",
    icon: Search,
  },
];

const icons: Record<string, ComponentType<Icon>> = {
  "": ListTree,
  Assets: BadgePercent,
  Equity: BadgeDollarSign,
  Expenses: BadgeMinus,
  Income: BadgePlus,
  Liabilities: BadgeInfo,
};

export function accountIcon(account: string) {
  return icons[account];
}

export function menuItemFor(account: string): MenuItem {
  return {
    name: account || "Accounts",
    path: urlForAccount(account),
    variant: "ghost",
    icon: icons[account] ?? Tags,
  };
}
