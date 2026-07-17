import type { MonzoAccount } from "./types";

function titleCase(value: string) {
  return value
    .replace(/^uk_/, "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(
      (part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`,
    )
    .join(" ");
}

function accountKind(account: MonzoAccount) {
  if (
    account.isFlex ||
    account.productType === "flex" ||
    account.accountType === "uk_monzo_flex"
  ) {
    return "Flex";
  }
  if (account.accountType === "uk_prepaid") return "Prepaid";
  if (account.accountType === "uk_loan" || account.productType === "loan") {
    return "Loan";
  }
  if (
    account.accountType === "uk_retail_joint" ||
    account.ownerType === "joint"
  ) {
    return "Joint";
  }
  if (account.accountType === "uk_retail" || account.ownerType === "personal") {
    return "Personal";
  }
  return titleCase(account.accountType ?? account.productType ?? "");
}

function ukAccountDetails(account: MonzoAccount) {
  const candidates = [
    { sortCode: account.sortCode, accountNumber: account.accountNumber },
    account.paymentDetails,
  ];
  for (const candidate of candidates) {
    const sortCode = candidate?.sortCode;
    const accountNumber = candidate?.accountNumber;
    if (!sortCode || !accountNumber) continue;
    if (!/^\d{6}$/.test(sortCode) || !/^\d+$/.test(accountNumber)) continue;
    return `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4)} · ${accountNumber}`;
  }
  return undefined;
}

/** Build a stable, human-readable label without exposing Monzo's raw description. */
export function monzoAccountDisplayName(account: MonzoAccount) {
  const kind = accountKind(account) || "Monzo Account";
  const details = ukAccountDetails(account);
  return details && (kind === "Personal" || kind === "Joint")
    ? `${kind} · ${details}`
    : kind;
}
