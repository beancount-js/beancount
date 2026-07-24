import { accountOpenClose, type Directives } from "@beancount-js/beancount";
import { derived, type Readable } from "svelte/store";

import type { LedgerData } from "../core/ledger";

export type AccountAppearance = {
  color: string;
  icon: string;
  merchantId?: string;
};

const accountAppearanceStores = new WeakMap<
  Readable<LedgerData>,
  Readable<Map<string, AccountAppearance>>
>();

export function accountAppearances(
  directives: Directives,
): Map<string, AccountAppearance> {
  return new Map(
    Object.entries(accountOpenClose(directives)).flatMap(([account, state]) => {
      const open = state.open;
      if (!open) return [];
      const merchantId = open.meta.merchant_id;
      return [
        [
          account,
          {
            color: typeof open.meta.color === "string" ? open.meta.color : "",
            icon: typeof open.meta.icon === "string" ? open.meta.icon : "",
            merchantId: typeof merchantId === "string" ? merchantId : undefined,
          },
        ],
      ];
    }),
  );
}

/** Reuses one open-account metadata map for all account links in a ledger. */
export function accountAppearanceStore(ledgerData: Readable<LedgerData>) {
  const existing = accountAppearanceStores.get(ledgerData);
  if (existing) return existing;

  const appearances = derived(ledgerData, ($ledgerData) =>
    accountAppearances($ledgerData.directives),
  );
  accountAppearanceStores.set(ledgerData, appearances);
  return appearances;
}
