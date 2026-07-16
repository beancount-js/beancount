import {
  type Account,
  type Directive,
  type Directives,
  type Posting,
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
    readonly txnPostings: Array<Directive | TxnPosting> = [],
    readonly balance: Inventory = new Inventory(),
  ) {}

  get(name: string) {
    const components = name.split(":");
    // eslint-disable-next-line  @typescript-eslint/no-this-alias
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
    // eslint-disable-next-line  @typescript-eslint/no-this-alias
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
        for (const child of Object.values(this.children).sort((left, right) =>
          left.account.localeCompare(right.account),
        )) {
          for (const subChild of child.traverse(leafOnly)) {
            yield subChild;
          }
        }
      }
    } else {
      yield this;
      for (const child of Object.values(this.children).sort((left, right) =>
        left.account.localeCompare(right.account),
      )) {
        for (const subChild of child.traverse(leafOnly)) {
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
    for (let i = 0; i <= parts.length; i++) {
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

export type AccountEntry = Directive | TxnPosting;

/** Compute the inventory resulting from the postings in an account entry list. */
export function computePostingsBalance(
  entries: readonly AccountEntry[],
): Inventory {
  const balance = new Inventory();
  for (const entry of entries) {
    if (entry instanceof TxnPosting) {
      balance.addPosting(entry.posting);
    }
  }
  return balance;
}

/** Build a realization tree from directives, optionally creating empty roots. */
export function realize(
  entries: Directives,
  minimumAccounts: readonly Account[] = [],
  computeBalances: boolean = true,
): RealAccount {
  const root = new RealAccount("");
  for (const [account, accountEntries] of Object.entries(
    entriesByAccount(entries),
  )) {
    const realized = root.getOrCreate(account);
    realized.txnPostings.push(...accountEntries);
    if (computeBalances) {
      realized.balance.addInventory(computePostingsBalance(accountEntries));
    }
  }
  for (const account of minimumAccounts) {
    root.getOrCreate(account);
  }
  return root;
}

/** Return every entry under an account, in deterministic account-tree order. */
export function getPostings(account: RealAccount): AccountEntry[] {
  return [...account.traverse()].flatMap((node) => node.txnPostings);
}

/**
 * Keep accounts that satisfy a predicate and their ancestors, preserving the
 * original account entries and balances.
 */
export function filterRealAccounts(
  account: RealAccount,
  predicate: (account: RealAccount) => boolean,
): RealAccount | null {
  const filtered = new RealAccount(
    account.account,
    [...account.txnPostings],
    account.balance.copy(),
  );
  for (const [name, child] of Object.entries(account.children)) {
    const retained = filterRealAccounts(child, predicate);
    if (retained) filtered.put(name, retained);
  }
  return Object.keys(filtered.children).length || predicate(account)
    ? filtered
    : null;
}

export type BalanceIteration = [
  entry: Directive | Transaction,
  postings: Posting[],
  change: Inventory,
  balance: Inventory,
];

/**
 * Group account entries by parent directive while yielding their running
 * balance. Input must be in non-decreasing directive-date order.
 */
export function* iterateWithBalance(
  accountEntries: readonly AccountEntry[],
): Generator<BalanceIteration> {
  let previousDate: number | null = null;
  const running = new Inventory();
  let group:
    | { entry: Directive | Transaction; postings: Posting[] }
    | undefined;

  const flush = function* () {
    if (!group) return;
    const change = new Inventory();
    group.postings.forEach((posting) => change.addPosting(posting));
    running.addInventory(change);
    yield [
      group.entry,
      group.postings,
      change,
      running.copy(),
    ] as BalanceIteration;
  };

  for (const accountEntry of accountEntries) {
    const entry =
      accountEntry instanceof TxnPosting ? accountEntry.txn : accountEntry;
    const date = entry.date?.toMillis() ?? Number.NEGATIVE_INFINITY;
    if (previousDate !== null && date < previousDate) {
      throw new Error("Account entries must be sorted by date");
    }
    previousDate = date;

    if (group && group.entry !== entry) {
      yield* flush();
      group = undefined;
    }
    group ??= { entry, postings: [] };
    if (accountEntry instanceof TxnPosting) {
      group.postings.push(accountEntry.posting);
    }
  }
  yield* flush();
}

/** Return the last transactional posting or account directive, if present. */
export function findLastActivePosting(
  accountEntries: readonly AccountEntry[],
): AccountEntry | null {
  return accountEntries.at(-1) ?? null;
}
