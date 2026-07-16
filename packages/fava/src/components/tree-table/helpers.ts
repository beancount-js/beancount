import { getContext, setContext } from "svelte";
import { derived, type Readable, type Writable } from "svelte/store";
import type { AccountTreeNode } from "../../lib/models";
import { useContext } from "../../context";
import type { DateTime } from "luxon";

const key = Symbol("tree-table");

export function isEmpty(obj: Record<string, unknown>): boolean {
  return Object.keys(obj).length === 0;
}

interface TreeTableContext {
  /** The accounts for which the decsendants are currently hidden. */
  readonly toggled: Writable<ReadonlySet<string>>;
  /** The accounts that should not be shown. */
  readonly notShown: Readable<ReadonlySet<string>>;
  collapseAll: () => void;
}

export const setTreeTableContext = (ctx: TreeTableContext): TreeTableContext =>
  setContext(key, ctx);

export const getTreeTableContext = (): TreeTableContext => getContext(key);

/** Recursively build set of accounts that should not be shown. */
export function useGetNotShown() {
  const { ledgerOptions, accounts, isClosedAccount } = useContext();
  return derived(
    [ledgerOptions, accounts, isClosedAccount],
    ([$ledgerOptions, $accounts, $isClosedAccount]) =>
      (node: AccountTreeNode, end: DateTime | null): Set<string> => {
        const {
          fava: {
            show_accounts_with_zero_balance,
            show_accounts_with_zero_transactions,
            show_closed_accounts,
          },
        } = $ledgerOptions;
        const notShown = new Set<string>();
        const shouldShowRecursive = (n: AccountTreeNode): boolean => {
          if (
            // We need to evaluate this for all descendants recursively
            // the .map().some() ensures it does not short-circuit
            n.children.map(shouldShowRecursive).some((b) => b) ||
            !isEmpty(n.balanceChildren)
          ) {
            return true;
          }
          if (
            !$accounts.includes(n.account) ||
            (!show_closed_accounts && $isClosedAccount(n.account, end)) ||
            (!show_accounts_with_zero_balance && isEmpty(n.balance)) ||
            (!show_accounts_with_zero_transactions && !n.hasTxns)
          ) {
            notShown.add(n.account);
            return false;
          }
          return true;
        };
        shouldShowRecursive(node);
        return notShown;
      },
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
