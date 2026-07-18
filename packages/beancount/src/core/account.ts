import { DateTime } from "luxon";
import { Close, Open } from "./data";
import type { Directives } from "./data";

export const ACCOUNT_SEPARATOR = ":";

const ROOT_COMPONENT = /^\p{Lu}[\p{L}\p{Nd}-]*$/u;
const LEAF_COMPONENT = /^(?:\p{Lu}|\p{Nd})[\p{L}\p{Nd}-]*$/u;

/** Check whether a component is valid as the root of an account name. */
export function isValidRoot(value: unknown): value is string {
  return typeof value === "string" && ROOT_COMPONENT.test(value);
}

/** Check whether a component is valid below an account root. */
export function isValidLeaf(value: unknown): value is string {
  return typeof value === "string" && LEAF_COMPONENT.test(value);
}

/** Check whether a value is a complete, hierarchical account name. */
export function isValidAccount(value: unknown): value is string {
  if (typeof value !== "string") return false;

  const components = value.split(ACCOUNT_SEPARATOR);
  return (
    components.length > 1 &&
    isValidRoot(components[0]) &&
    components.slice(1).every(isValidLeaf)
  );
}

export function joinAccount(...components: string[]): string {
  return components.join(ACCOUNT_SEPARATOR);
}

export function splitAccount(account: string): string[] {
  return account.split(ACCOUNT_SEPARATOR);
}

export function accountLeaf(account: string): string {
  return splitAccount(account).at(-1) ?? "";
}

export function accountRoot(account: string): string {
  return splitAccount(account)[0] ?? "";
}

export function sansRoot(account: string): string {
  return splitAccount(account).slice(1).join(ACCOUNT_SEPARATOR);
}

/**
 * True if `component` appears as a contiguous account component sequence
 * (beancount.core.account.has_component). Matches both single components
 * (`Cash` in `Assets:Cash`) and multi-component prefixes (`Assets:Cash` in
 * `Assets:Cash:Wallet`).
 */
export function hasAccountComponent(
  account: string,
  component: string,
): boolean {
  if (!component) return false;
  const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|:)${escaped}(?::|$)`).test(account);
}

/** Return the longest shared hierarchy prefix for the supplied account names. */
export function commonAccountPrefix(accounts: readonly string[]): string {
  if (accounts.length === 0) return "";

  const first = splitAccount(accounts[0]);
  const common = first.filter((component, index) =>
    accounts.every((account) => splitAccount(account)[index] === component),
  );
  return joinAccount(...common);
}

/** Create a predicate which matches an account and all of its descendants. */
export function parentMatcher(parentAccount: string) {
  return (account: string) => isDescendantOf(parentAccount, account);
}

/** Iterate from an account to its root, including both endpoints. */
export function* accountParents(account: string): Generator<string> {
  for (let current = account; current; current = parent(current)) {
    yield current;
  }
}

/**
 * Check whether an account is a descendant of another.
 *
 * @param name - An account name.
 * @param of - The possible ancestor
 */
export function isDescendantOf(parent: string, child: string): boolean {
  return (
    child === parent ||
    parent === "" ||
    child.startsWith(`${parent}${ACCOUNT_SEPARATOR}`)
  );
}

export function matchesAccount(account: unknown): account is string {
  return typeof account === "string" && isValidAccount(account.trim());
}

export function parent(account: string) {
  const idx = account.lastIndexOf(ACCOUNT_SEPARATOR);
  if (idx !== -1) {
    return account.substring(0, idx);
  }
  return "";
}

interface AccountOpenCloseProps {
  open: Open | null;
  close: Close | null;
  updatedAt: DateTime;
}

export function accountOpenClose(
  entries: Directives,
): Record<string, AccountOpenCloseProps> {
  const map: Record<string, AccountOpenCloseProps> = {};
  entries.forEach((entry) => {
    if (entry instanceof Open) {
      map[entry.account] ||= { open: null, close: null, updatedAt: entry.date };
      const eixisting = map[entry.account];
      if (eixisting.open && eixisting.open.date <= entry.date) {
        return;
      }
      map[entry.account].open = entry;
      map[entry.account].updatedAt = entry.date;
    } else if (entry instanceof Close) {
      map[entry.account] ||= { open: null, close: null, updatedAt: entry.date };
      const eixisting = map[entry.account];
      if (eixisting.close && eixisting.close.date <= entry.date) {
        return;
      }
      map[entry.account].close = entry;
      map[entry.account].updatedAt = entry.date;
    } else {
      const date = entry.date;
      if (date) {
        entry.accounts.forEach((account) => {
          if (map[account] && map[account].updatedAt < date) {
            map[account].updatedAt = date;
          }
        });
      }
    }
  });
  return map;
}
