import {
  filterLedger,
  LoadError,
  type LoadProps,
} from "@beancount-js/beancount";
import { LedgerData, LedgerSource } from "../core/ledger.js";
import { FilterState } from "./filter.svelte";
import type { Options } from "../context";
import { MainNav, type MenuItem } from "../menu";
import { getContext, setContext } from "svelte";
import ShieldX from "lucide-svelte/icons/shield-x";
import { RouterState } from "../router/router.svelte.js";
import type { Route } from "../router/router.js";
import { useFormatter } from "$lib/format.js";
import { Tree } from "../core/tree.js";
import type { AccountTreeNode } from "../core/account.js";
import { isEmpty } from "lodash";
import type { DateTime } from "luxon";

type Getter<T> = () => T;

export type LedgerStateProps = {
  contents: Getter<string>;
  setContents: (contents: string) => void;
  path: string;
  routes: Array<Route>;
  loadProps?: Partial<LoadProps>;
};

export type MenuCategory = {
  name: string;
  items: Array<MenuItem>;
  badge?: string;
};

export class LedgerState {
  setContents: LedgerStateProps["setContents"];
  sidebar: Array<MenuCategory> = $state([
    { name: "Application", items: MainNav },
  ]);
  contents: string = $state("");
  readonly navigation: RouterState = new RouterState();

  readonly source = $derived.by(
    () => new LedgerSource(this.contents, this.props.loadProps),
  );
  readonly filter: FilterState = new FilterState();
  readonly options: Options = $derived(this.source.options);
  readonly data: LedgerData = $derived.by(() => {
    if (!this.filter.filter) {
      return this.source.data;
    }

    const errors = [...this.filter.errors];
    const [directives, filterErrors] = filterLedger(
      this.source.directives,
      this.filter.filter,
    );
    errors.push(...filterErrors);
    return this.source.data.copy({
      directives,
      errors: [...this.source.errors, ...errors.map((it) => new LoadError(it))],
    });
  });

  readonly tree: Tree = $derived(new Tree({entries: this.data.directives}));

  isClosedAccount = $derived.by(() => {
     return (account: string, date?: DateTime | null) => {
        const closeDate = this.data.accountDetails[account]?.closeDate;
        if (!closeDate) {
          return false;
        }
        return !date ? true : closeDate < date;
     }
  });

  notShown = $derived.by(() => {
    return (node: AccountTreeNode, end?: DateTime | null):  ReadonlySet<string>  => {
      const notShown = new Set<string>();
      const {
        fava: {
          show_accounts_with_zero_balance,
          show_accounts_with_zero_transactions,
          show_closed_accounts,
        },
      } = this.options;
      const accounts = this.data.accounts;
      const shouldShowRecursive = (n: AccountTreeNode): boolean => {
        if (
          // We need to evaluate this for all descendants recursively
          // the .map().some() ensures it does not short-circuit
          n.children.map(shouldShowRecursive).some((b: AccountTreeNode) => b) ||
          !isEmpty(n.balanceChildren)
        ) {
          return true;
        }
        if (
          !accounts.includes(n.account) ||
          (!show_closed_accounts && this.isClosedAccount(n.account, end)) ||
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
    };
  })

  readonly menu = $derived.by(() => {
    const values = [...this.sidebar];
    if (!values.length) {
      values.push({ name: "Application", items: [] });
    }

    if (this.data.errors.length) {
      const items = values[0].items.filter((it) => it.path !== "/errors");
      items.push({
        name: "Errors",
        path: "/errors",
        icon: ShieldX,
        badge: `${this.data.errors.length}`,
      });
      values[0].items = items;
    } else {
      const items = values[0].items.filter((it) => it.path !== "/errors");
      values[0].items = items;
    }

    return values;
  });

  readonly operatingCurrency = $derived.by(() => {
    return [...this.data.options.beancount.operating_currency].sort();
  });

  readonly collapseAccount = $derived.by(() => {
    const matchers = this.options.fava.collapse_pattern.map(
      (p) => new RegExp(p),
    );
    return (name: string) => matchers.some((p) => p.test(name));
  });

  readonly formatter = $derived.by(() => {
    return useFormatter(
      this.options.ledger.incognito,
      this.options.fava.locale,
      {},
    );
  });

  constructor(readonly props: LedgerStateProps) {
    this.setContents = (value) => {
      props.setContents(value);
      this.contents = value;
    };
    this.contents = props.contents();
    this.navigation.create(props.routes, props.path);
  }

  set ledgerSource(value: LedgerSource) {
    this.setContents(value.toString());
  }

  invertAccount(name: string) {
    return (
      this.options.fava.invert_income_liabilities_equity &&
      (name.startsWith(this.options.beancount.name_assets) ||
        name.startsWith(this.options.beancount.name_liabilities) ||
        name.startsWith(this.options.beancount.name_equity) ||
        name === "Net Profit")
    );
  }

  currencyName(name: string) {
    return name;
  }
}

const SYMBOL_KEY = "beancount";

/**
 * Instantiates a new `LedgerState` instance and sets it in the context.
 *
 * @param props The constructor props for the `LedgerState` class.
 * @returns The `LedgerState` instance.
 */
export function setLedger(props: LedgerStateProps): LedgerState {
  return setContext(Symbol.for(SYMBOL_KEY), new LedgerState(props));
}

/**
 * Retrieves the `LedgerState` instance from the context. This is a class
 * instance, so you cannot destructure it.
 *
 * @returns The `LedgerState` instance.
 */
export function useLedger(): LedgerState {
  return getContext(Symbol.for(SYMBOL_KEY));
}
