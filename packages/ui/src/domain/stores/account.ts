import { derived } from "svelte/store";
import { useContext } from "../context";

/** Whether an account should be collapsed in the account trees. */
export function useCollapseAccount() {
  const { ledgerOptions } = useContext();
  return derived(ledgerOptions, ($ledgerOptions) => {
    const matchers = $ledgerOptions.fava.collapse_pattern.map(
      (p) => new RegExp(p),
    );
    return (name: string) => matchers.some((p) => p.test(name));
  });
}

/** Whether the balances for an account should be inverted. */

export function useInvertAccount() {
  const { ledgerOptions } = useContext();
  return derived(
    [ledgerOptions],
    ([$ledgerOptions]): ((name: string) => boolean) =>
      $ledgerOptions.fava.invert_income_liabilities_equity
        ? (name) =>
            name.startsWith($ledgerOptions.beancount.name_assets) ||
            name.startsWith($ledgerOptions.beancount.name_liabilities) ||
            name.startsWith($ledgerOptions.beancount.name_equity) ||
            name === "Net Profit"
        : () => false,
  );
}
