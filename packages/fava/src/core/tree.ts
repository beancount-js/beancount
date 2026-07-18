import { parent } from "$lib/accounts";
import { stratify } from "$lib/tree";
import {
  Amount,
  Conversion,
  CounterInventory,
  DefaultMap,
  InventoryKey,
  Open,
  Transaction,
  type BeancountOptions,
  type ConversionContext,
  type Directives,
} from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/parser";
import type { AccountTreeNode } from "./account";

export interface BalanceRecord {
  account: string;
  balance: Record<string, number>;
  balanceChildren: Record<string, number>;
  children: Array<BalanceRecord>;
}

function extractCurrencies(record: BalanceRecord) {
  const currencies: Array<String> = [];
  currencies.push(...Object.keys(record.balance));
  currencies.push(...Object.keys(record.balanceChildren));
  record.children.forEach((it) => {
    currencies.push(...extractCurrencies(it));
  });
  return [...new Set(currencies)];
}

export class TreeNode {
  constructor(
    readonly account: string,
    readonly children: Array<TreeNode> = [],
    readonly balance: CounterInventory = new CounterInventory(),
    readonly balanceChildren: CounterInventory = new CounterInventory(),
    public hasTxns: boolean = false,
  ) {}

  get accounts(): Array<string> {
    const accounts = new Set<string>();
    accounts.add(this.account);
    this.children.forEach((child) => {
      child.accounts.forEach((it) => accounts.add(it));
    });
    return [...accounts];
  }

  reduce<T>(reducer: (node: TreeNode) => T): T {
    return reducer(this);
  }

  toRecord(
    conversion: Conversion = Conversion.AT_COST,
    context: Partial<ConversionContext> = {},
  ): BalanceRecord {
    return {
      account: this.account,
      balance: this.balance.toRecord(conversion, context),
      balanceChildren: this.balanceChildren.toRecord(conversion, context),
      children: this.children.map((it) => it.toRecord(conversion, context)),
    };
  }

  copy(
    data: Partial<{
      account: string;
      children: Array<TreeNode>;
      balance: CounterInventory;
      balanceChildren: CounterInventory;
      hasTxns: boolean;
    }> = {},
  ): TreeNode {
    return new TreeNode(
      data.account === undefined ? this.account : data.account,
      data.children === undefined
        ? this.children.map((it) => it.copy())
        : data.children,
      data.balance === undefined ? this.balance.copy() : data.balance,
      data.balanceChildren === undefined
        ? this.balanceChildren.copy()
        : data.balanceChildren,
      data.hasTxns === undefined ? this.hasTxns : data.hasTxns,
    );
  }
}

export class Tree extends DefaultMap<string, TreeNode> {
  constructor(
    opts: Partial<{
      entries: Directives;
      accounts: Array<string>;
      values: Array<[string, TreeNode]>;
      frozen: boolean;
    }> = {},
  ) {
    super((key: string, map: DefaultMap<string, TreeNode>) => {
      if (opts.frozen) {
        throw new Error(`Invalid key: ${key}`);
      }
      const node = new TreeNode(key);
      if (key) {
        const ancestor = parent(key);
        map.get(ancestor).children.push(node);
      }
      return node;
    }, opts.values);
    this.insert("");
    if (opts.accounts) {
      opts.accounts.forEach((it) => this.get(it));
    }

    if (opts.entries) {
      const accountBalances = new DefaultMap<string, CounterInventory>(
        () => new CounterInventory(),
      );
      opts.entries.forEach((entry) => {
        if (entry instanceof Open) {
          this.insert(entry.account);
        } else if (entry instanceof Transaction) {
          entry.postings.forEach((posting) => {
            accountBalances
              .get(posting.account)
              .add(posting.units, posting.cost);
          });
        }
      });

      for (const [key, balance] of accountBalances.entries()) {
        this.insertBalance(key, balance);
      }
    }
  }

  get root() {
    return this.get("");
  }

  currencies(
    conversion?: Conversion,
    context: Partial<ConversionContext> = {},
  ) {
    return extractCurrencies(this.root.toRecord(conversion, context));
  }

  copy() {
    return new Tree({
      values: [...this.entries()].map(([k, v]) => [k, v.copy()]),
    });
  }

  get accounts() {
    return [...this.keys()].sort();
  }

  *ancestors(account: string): Generator<TreeNode> {
    while (account) {
      account = parent(account);
      yield this.get(account);
    }
  }

  insertBalance(account: string, balance: CounterInventory) {
    const node = this.get(account);
    node.balance.addInventory(balance);
    node.balanceChildren.addInventory(balance);
    node.hasTxns = true;
    for (const parent of this.ancestors(account)) {
      parent.balanceChildren.addInventory(balance);
    }
  }

  netProfit(account: string, options: BeancountOptions) {
    const income = this.get(options.name_income);
    const expenses = this.get(options.name_expenses);
    const node = new Tree();
    node.insertBalance(
      account,
      income.balanceChildren.plus(expenses.balanceChildren),
    );
    return node.get(account);
  }

  cap(account: string, options: BeancountOptions) {
    const entries: Array<[InventoryKey, Decimal]> = [];

    const costings = this.get("").balanceChildren.reduce((key, value) => {
      const cost = key.cost?.amount;
      if (cost) {
        return cost.mul(value.toString());
      }
      return new Amount(value, key.currency);
    });
    for (const [currency, amount] of costings.entries()) {
      entries.push([
        new InventoryKey(currency),
        new Decimal(amount.units.toString()),
      ]);
    }

    const conversions = new CounterInventory(entries);
    // Add conversions
    this.insertBalance(
      `${options.name_equity}:${options.account_current_conversions}`,
      conversions,
    );
    // Insert unrealized gains.
    this.insertBalance(
      `${options.name_equity}:${account}`,
      this.get("").balanceChildren.neg(),
    );
    // Transfer Income and Expenses
    this.insertBalance(
      `${options.name_equity}:${options.account_current_earnings}`,
      this.get(options.name_income).balanceChildren,
    );
    this.insertBalance(
      `${options.name_equity}:${options.account_current_earnings}`,
      this.get(options.name_expenses).balanceChildren,
    );
    return this;
  }
}

export function createNode(tree: Tree, account: string) {
  return stratify(
    tree.get(account).accounts,
    (id) => id,
    (name) => {
      const node = tree.get(name);
      const entity: AccountTreeNode = {
        children: [],
        account: name,
        balance: node.balance.toRecord(),
        balanceChildren: node.balanceChildren.toRecord(),
        cost: {},
        costChildren: {},
        hasTxns: node.hasTxns,
      };
      return entity;
    },
  );
}
