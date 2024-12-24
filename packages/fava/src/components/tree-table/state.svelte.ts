import type { TreeNode } from "$lib/tree";
import { getContext, setContext } from "svelte";
import { useLedger } from "../../context/ledger.svelte";

export type TreeTableProps = {
  nodes(): Array<string>;
};

export type AccountTreeNode = TreeNode<{
  readonly account: string;
  readonly children: Array<AccountTreeNode>;
  readonly balance: Record<string, number>;
  readonly balanceChildren: Record<string, number>;
  readonly cost: Record<string, number>;
  readonly costChildren: Record<string, number>;
  hasTxns: boolean;
}>;

export class TreeTableState {
  /** The accounts for which the decsendants are currently hidden. */
  toggled: ReadonlySet<string> = $state(new Set());
  /** The accounts that should not be shown. */
  notShown: ReadonlySet<string> = $state(new Set());

  constructor(readonly props: TreeTableProps) {}

  isToggled(account: string) {
    return this.toggled.has(account);
  }

  clearToggled() {
    this.toggled = new Set();
  }

  collapseAll() {
    this.toggled = new Set(this.props.nodes());
  }
}

const SYMBOL_KEY = "tree-table";

/**
 * Instantiates a new `TreeTableState` instance and sets it in the context.
 *
 * @param props The constructor props for the `TreeTableState` class.
 * @returns The `TreeTableState` instance.
 */
export function setTreeTableContext(props: TreeTableProps): TreeTableState {
  return setContext(Symbol.for(SYMBOL_KEY), new TreeTableState(props));
}

/**
 * Retrieves the `TreeTableState` instance from the context. This is a class
 * instance, so you cannot destructure it.
 *
 * @returns The `TreeTableState` instance.
 */
export function useTreeTable() {
  return getContext<ReturnType<typeof setTreeTableContext>>(
    Symbol.for(SYMBOL_KEY),
  );
}

/** Determine the accounts that should initially be collapsed. */
export function getCollapsed(
  root: AccountTreeNode,
  $collapseAccount: (s: string) => boolean,
): Set<string> {
  const s = new Set<string>();
  const getCollapsedRecursive = ({ children, account }: AccountTreeNode) => {
    if (children.length && $collapseAccount(account)) {
      s.add(account);
    }
    children.forEach(getCollapsedRecursive);
  };
  getCollapsedRecursive(root);
  return s;
}

export function getAllNodes(root: AccountTreeNode): Set<string> {
  const s = new Set<string>();
  const getCollapsedRecursive = ({ children, account }: AccountTreeNode) => {
    if (children.length) {
      s.add(account);
    }
    children.forEach(getCollapsedRecursive);
  };
  getCollapsedRecursive(root);
  return s;
}
