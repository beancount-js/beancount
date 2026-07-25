import {
  renderComponent,
  renderSnippet,
} from "@lapis/ui/shadcn/data-table";
import {
  Balance,
  Close,
  Custom,
  DirectiveBase,
  Open,
  Pad,
  Query,
  Transaction,
} from "@beancount-js/beancount";
import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import { DateTime } from "luxon";
import { formatDate } from "@beancount-js/parser";
import { urlForAccount } from "../../helpers";

const accountSnippet = createRawSnippet<[DirectiveBase]>((getDirective) => {
  const directive = getDirective();
  return {
    render: () => {
      if (directive instanceof Transaction) {
        return directive.payee
          ? `<span><strong>${directive.payee}</strong> <span>${directive.narration}</span></span>`
          : `<span>${directive.narration}</span>`;
      } else if (directive instanceof Open || directive instanceof Balance) {
        return `<a href="${urlForAccount(directive.account)}" class="cn-beta-components-journal-table-columns-30-1">${directive.account}</a>`;
      }
      return "<span></span>";
    },
  };
});

const typeAlias: Record<string, string> = {
  balance: "Bal",
};

export const columns: ColumnDef<DirectiveBase>[] = [
  {
    accessorKey: "date",
    cell: ({ cell }) => formatDate(cell.getValue<DateTime>()),
    header: "Date",
  },
  {
    accessorKey: "flag",
    accessorFn: (row) => {
      if (row instanceof Transaction) {
        return row.flag;
      }
      return typeAlias[row.directiveType] ?? row.directiveType;
    },
    header: "F",
  },
  {
    accessorKey: "account",
    header: "Account",
    accessorFn: (row) => row,
    cell: ({ row }) => {
      return renderSnippet(accountSnippet, row.getValue("account"));
    },
  },
];
