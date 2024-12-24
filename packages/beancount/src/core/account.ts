import { DateTime } from "luxon";
import { Close, Directives, Open } from "./data";

/**
 * Check whether an account is a descendant of another.
 *
 * @param name - An account name.
 * @param of - The possible ancestor
 */
export function isDescendantOf(parent: string, child: string): boolean {
  return child === parent || parent == "" || child.startsWith(`${parent}:`);
}

export function parent(account: string) {
  const idx = account.lastIndexOf(":");
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
