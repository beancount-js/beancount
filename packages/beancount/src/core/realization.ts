import {
  type Account,
  type Directive,
  type Directives,
  Transaction,
  TxnPosting,
} from "./data";
import { Inventory } from "./inventory";

/**
 * A realized account, inserted in a tree, that contains the list of realized
 * entries.
 */
export class RealAccount {
  readonly children: Record<string, RealAccount> = {};

  /**
   * @param account A string, the full name of the corresponding account.
   * @param txnPostings A list of postings associated with this accounting (does
   *   not include the postings of children accounts).
   * @param balance The final balance of the list of postings associated with
   *   this account.
   */
  constructor(
    readonly account: string,
    readonly txnPostings: Array<TxnPosting> = [],
    readonly balance: Inventory = new Inventory(),
  ) {}

  get(name: string) {
    const components = name.split(":");
    let account: RealAccount = this;
    components.forEach((component) => {
      if (!account) return;
      account = account.children[component];
    });
    return account;
  }

  put(key: string, value: RealAccount) {
    if (!value.account.endsWith(key)) {
      throw new Error(
        `RealAccount name '${value.account}' inconsistent with key: '${key}'`,
      );
    }
    this.children[key] = value;
  }

  getOrCreate(name: Account): RealAccount {
    let account: RealAccount = this;
    const components = name.split(":");
    const path: Array<string> = [];
    let child: RealAccount;
    components.forEach((component) => {
      path.push(component);
      child = account.get(component);
      if (!child) {
        child = new RealAccount(path.join(":"));
        account.put(component, child);
      }
      account = child;
    });
    return account;
  }

  contains(name: string) {
    return this.get(name) ? true : false;
  }

  get empty() {
    return Object.keys(this.children).length == 0;
  }

  *traverse(leafOnly: boolean = false): Generator<RealAccount> {
    if (leafOnly) {
      if (this.empty) {
        yield this;
      } else {
        for (const [key, child] of Object.entries(this.children)) {
          for (let subChild of child.traverse(leafOnly)) {
            yield subChild;
          }
        }
      }
    } else {
      yield this;
      for (const [key, child] of Object.entries(this.children)) {
        for (let subChild of child.traverse(leafOnly)) {
          yield subChild;
        }
      }
    }
  }

  /**
   * Compute the total balance of this account and all its subaccounts.
   *
   * @param leafOnly A boolean flag, true if we should yield only leaves.
   * @returns An Inventory.
   */
  computeBalance(leafOnly: boolean = false): Inventory {
    const inventory = new Inventory();
    [...this.traverse(leafOnly)].forEach((it) => {
      inventory.addInventory(it.balance);
    });
    return inventory;
  }
}

export function getOrCreateAccount(
  account: RealAccount,
  name: Account,
): RealAccount {
  const components = name.split(":");
  const path: Array<string> = [];
  let child!: RealAccount;
  components.forEach((component) => {
    path.push(component);
    child = account.get(component);
    if (!child) {
      child = new RealAccount(path.join(":"));
      account.children[component] = child;
    }
    account = child;
  });
  return child;
}

export class RealAccounts {
  pathNames(account: string) {
    const paths = new Set<string>();
    const parts = account.split(":");
    for (var i = 0; i <= parts.length; i++) {
      const key = parts.slice(0, i).join(":");
      paths.add(key);
    }
    return [...paths];
  }
}

/**
 * Create lists of postings and balances by account.
 *
 * This routine aggregates postings and entries grouping them by account name.
 * The resulting lists contain postings in-lieu of Transaction directives, but
 * the other directives are stored as entries. This yields a list of postings or
 * other entries by account. All references to accounts are taken into account.
 *
 * @param entries A list of directives.
 * @returns A mapping of account name to list of TxnPosting instances or
 *   non-Transaction directives, sorted in the same order as the entries.
 */
export function entriesByAccount(
  entries: Directives,
): Record<string, Array<Directive | TxnPosting>> {
  const txnPostings: Record<string, Array<Directive | TxnPosting>> = {};
  entries.forEach((entry) => {
    if (entry instanceof Transaction) {
      entry.postings.forEach((posting) => {
        txnPostings[posting.account] ||= [];
        txnPostings[posting.account].push(new TxnPosting(entry, posting));
      });
    } else {
      entry.accounts.forEach((account) => {
        txnPostings[account] ||= [];
        txnPostings[account].push(entry);
      });
    }
  });
  return txnPostings;
}
