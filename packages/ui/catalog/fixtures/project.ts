import type { ProjectSnapshot } from "@beancount-js/workspace";
export const NOW = "2024-12-31T12:00:00Z";
export const demoLedger = `option "title" "Example Ledger"
option "operating_currency" "GBP"
2024-01-01 open Assets:Checking GBP
2024-01-01 open Assets:Savings GBP
2024-01-01 open Equity:Opening GBP
2024-01-01 open Income:Salary GBP
2024-01-01 open Expenses:Food GBP
2024-01-01 open Expenses:Rent GBP
2024-01-01 * "Opening balance"
  Assets:Checking 1000 GBP
  Equity:Opening -1000 GBP
2024-02-01 * "Example employer" "Salary"
  Assets:Checking 3000 GBP
  Income:Salary -3000 GBP
2024-02-02 * "Example landlord" "Rent"
  Expenses:Rent 900 GBP
  Assets:Checking -900 GBP
2024-02-03 * "Example shop" "Groceries" #food
  Expenses:Food 120 GBP
  Assets:Checking -120 GBP
2024-03-01 * "Example employer" "Salary"
  Assets:Checking 3000 GBP
  Income:Salary -3000 GBP
2024-03-02 * "Savings transfer"
  Assets:Savings 500 GBP
  Assets:Checking -500 GBP
`;
export function demoProject(
  id = "example",
  contents = demoLedger,
): ProjectSnapshot {
  return {
    project: {
      version: 1,
      id,
      name: id === "example" ? "Example Ledger" : "Second Project",
      entryFile: "main.beancount",
      createdAt: NOW,
      updatedAt: NOW,
    },
    ledgerFiles: [
      { path: "main.beancount", contents },
      {
        path: "empty.beancount",
        contents:
          'option "title" "Empty Ledger"\noption "operating_currency" "GBP"\n',
      },
    ],
    resources: [],
    revisions: [
      { path: "main.beancount", revision: "1", updatedAt: NOW },
      { path: "empty.beancount", revision: "1", updatedAt: NOW },
    ],
    issues: [],
    envKeys: ["EXAMPLE_API_TOKEN"],
  };
}
