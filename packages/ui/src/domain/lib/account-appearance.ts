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

// Cache resolved merchant metadata per controller, never across project authorities.
import type { BeancountController } from "../../controller";
import { ingestionPath } from "../ingestion/api";
const merchantRequests = new WeakMap<
  BeancountController,
  Map<string, Promise<Map<string, string>>>
>();
export function merchantLogosForController(
  controller: BeancountController,
  projectId: string,
) {
  let requests = merchantRequests.get(controller);
  if (!requests) {
    requests = new Map();
    merchantRequests.set(controller, requests);
  }
  const existing = requests.get(projectId);
  if (existing) return existing;
  const request = controller.actions
    .request(ingestionPath(projectId, "/merchants"))
    .then(async (response) => {
      if (!response.ok) return new Map<string, string>();
      const merchants = (await response.json()) as {
        merchantId: string;
        logoUrl?: string;
      }[];
      return new Map(
        merchants.flatMap((merchant) =>
          merchant.logoUrl
            ? [[merchant.merchantId, merchant.logoUrl] as const]
            : [],
        ),
      );
    })
    .catch(() => new Map<string, string>());
  requests.set(projectId, request);
  return request;
}
