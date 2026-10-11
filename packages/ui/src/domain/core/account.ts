import type { DateTime } from "luxon";
import type { TreeNode } from "../lib/tree";

export type AccountTreeNode = TreeNode<{
  readonly account: string;
  readonly children: Array<AccountTreeNode>;
  readonly balance: Record<string, number>;
  readonly balanceChildren: Record<string, number>;
  readonly cost: Record<string, number>;
  readonly costChildren: Record<string, number>;
  hasTxns: boolean;
}>;

export interface AccountBudget {
  budget: Record<string, number>;
  budgetChildren: Record<string, number>;
}

export interface AccountDetails {
  account: string;
  openDate: DateTime;
  closeDate?: DateTime;
  currencies: Array<string>;
  lastEntry: { date: DateTime; hash: string };
}
