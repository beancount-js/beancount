import type { Icon } from "lucide-svelte";
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
  Edit,
} from "lucide-svelte";
import { urlForAccount } from "./helpers";
export interface MenuItem {
  name: string;
  path: string;
  // variant: Variant;
  badge?: string;
  icon: typeof Icon;
}

export const MainNav: Array<MenuItem> = [
  {
    name: "Editor",
    path: "/editor",
    icon: Edit,
  },
  {
    name: "Income Statement",
    path: "/income_statement",
    icon: Wallet,
  },
  {
    name: "Balance Sheet",
    path: "/balance_sheet",
    icon: Scale,
  },
  {
    name: "Trial Balance",
    path: "/trial_balance",
    icon: Weight,
  },
  { name: "Journal", path: "/journal", icon: NotebookText },
  {
    name: "Holdings",
    path: "/holdings",
    icon: ChartArea,
  },
  {
    name: "Statistics",
    path: "/statistics",
    icon: ChartPie,
  },
  {
    name: "Query",
    path: "/query",
    icon: Search,
  },
];

const icons: Record<string, typeof Icon> = {
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
    icon: icons[account] ?? Tags,
  };
}
