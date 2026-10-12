import {
  accountOpenClose,
  type Directives,
  type Open,
} from "@beancount-js/beancount";

type ConfiguredSource = {
  sourceAccount?: string;
  accounts?: readonly { sourceAccount?: string }[];
};

export type OtherLedgerAccount = {
  name: string;
  open: Open;
};

export type OtherLedgerAccountGroup = {
  label: string;
  accounts: OtherLedgerAccount[];
};

const ACCOUNT_GROUPS = [
  "Assets",
  "Liabilities",
  "Income",
  "Expenses",
  "Equity",
  "Other",
] as const;

function accountGroupLabel(account: string) {
  const root = account.split(":", 1)[0];
  return ACCOUNT_GROUPS.includes(root as (typeof ACCOUNT_GROUPS)[number])
    ? root
    : "Other";
}

function configuredAccounts(sources: readonly ConfiguredSource[]) {
  const accounts = new Set<string>();
  for (const source of sources) {
    const sourceAccount = source.sourceAccount?.trim();
    if (sourceAccount) accounts.add(sourceAccount);
    for (const account of source.accounts ?? []) {
      const linkedAccount = account.sourceAccount?.trim();
      if (linkedAccount) accounts.add(linkedAccount);
    }
  }
  return accounts;
}

/**
 * Accounts represented by an open directive but not assigned to an ingestion
 * source. These remain ledger-owned and can be edited through their directive.
 */
export function groupOtherLedgerAccounts(
  directives: Directives,
  sources: readonly ConfiguredSource[],
): OtherLedgerAccountGroup[] {
  const configured = configuredAccounts(sources);
  const groups = new Map<string, OtherLedgerAccount[]>();
  for (const label of ACCOUNT_GROUPS) groups.set(label, []);

  for (const [name, lifecycle] of Object.entries(
    accountOpenClose(directives),
  )) {
    if (!lifecycle.open || configured.has(name)) continue;
    const label = accountGroupLabel(name);
    groups.get(label)!.push({ name, open: lifecycle.open });
  }

  return ACCOUNT_GROUPS.map((label) => ({
    label,
    accounts: [...(groups.get(label) ?? [])].sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
  })).filter((group) => group.accounts.length > 0);
}
