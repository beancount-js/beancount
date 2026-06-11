import type { TreeNode } from "../lib/tree";
import type { HierarchyNode } from "d3-hierarchy";
import { hierarchy as d3Hierarchy } from "d3-hierarchy";
import { sum } from "d3-array";

/** The data for a single account in a d3-hierarchy. */
export type AccountHierarchyDatum = TreeNode<{
  readonly account: string;
  readonly balance: Record<string, number>;
  readonly dummy: boolean;
}>;

export type AccountHierarchyInputDatum = TreeNode<{
  readonly account: string;
  readonly balance: Record<string, number>;
}>;

/** A d3-hierarchy node for an account. */
export type AccountHierarchyNode = HierarchyNode<AccountHierarchyDatum>;

/**
 * Add internal nodes as dummy leaf nodes to their own children.
 *
 * In the treemap, we only render leaf nodes, so for accounts that have both
 * children and a balance, we want to duplicate them as leaf nodes.
 */
export function addInternalNodesAsLeaves({
  account,
  balance,
  children,
}: AccountHierarchyInputDatum): AccountHierarchyDatum {
  if (children.length) {
    const c = children.map(addInternalNodesAsLeaves);
    c.push({ account, balance, children: [], dummy: true });
    return { account, balance: {}, children: c, dummy: false };
  }
  return { account, balance, children: [], dummy: false };
}

export class HierarchyChart {
  readonly type = "hierarchy";

  constructor(
    readonly name: string,
    readonly data: ReadonlyMap<string, AccountHierarchyNode>,
  ) {}
}

export function hierarchyFromParsedData(
  label: string,
  data: AccountHierarchyInputDatum,
  currencies: Array<string> = ["GBP", "USD"],
): HierarchyChart {
  const root = addInternalNodesAsLeaves(data);
  return new HierarchyChart(
    label,
    new Map(
      currencies
        .map((currency) => {
          const r = d3Hierarchy<AccountHierarchyDatum>(root);
          const root_balance = sum(
            r.descendants(),
            (n) => n.data.balance[currency] ?? 0,
          );
          // depending on the balance for this currency in the root,
          // build the tree either for all positive values or all negative values
          const sign = root_balance ? Math.sign(root_balance) : 1;
          r.sum(
            (d) => sign * Math.max(sign * (d.balance[currency] ?? 0), 0),
          ).sort((a, b) => sign * ((b.value ?? 0) - (a.value ?? 0)));
          return [currency, r] as const;
        })
        .filter(([, h]) => h.value),
    ),
  );
}
