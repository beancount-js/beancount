import { renderComponent, renderSnippet } from "$lib/components/ui/data-table";
import {
  isDirective,
  Posting,
  type LedgerError,
} from "@beancount-js/beancount";
import type { ColumnDef } from "@tanstack/table-core";
import { createRawSnippet } from "svelte";
import Highlighter from "../Highlighter.svelte";
import { parser } from "@beancount-js/codemirror-lang-beancount";

export const columns: ColumnDef<LedgerError>[] = [
  {
    accessorKey: "context",
    header: "Line",
    cell: ({ row }) => {
      const linenoSnippet = createRawSnippet<[string]>((getLineNo) => {
        const lineno = getLineNo();
        return {
          render: () =>
            lineno
              ? `
          <span>
            <a href='/editor?line=${lineno}'>${lineno}</a>
          </span>
          `
              : "<span>-</span>",
        };
      });

      const context = row.getValue<Record<string, unknown>>("context") ?? {};
      let lineno: string = (context.lineno || context.line || "").toString();
      if (!lineno) {
        const directive = context.directive;
        if (isDirective(directive)) {
          lineno = directive.lineno.toString();
        } else if (directive instanceof Posting) {
          lineno = directive.meta["lineno"]?.toString() ?? "";
        }
      }

      return renderSnippet(linenoSnippet, lineno || "-");
    },
  },
  {
    accessorKey: "message",
    header: "Message",
  },
  {
    header: "Entity",
    cell: ({ row }) => {
      const context = row.getValue<Record<string, unknown>>("context") ?? {};
      let code: string = "";
      const directive = context.directive;
      if (isDirective(directive)) {
        code = directive.toString();
      } else if (directive instanceof Posting) {
        code = directive.toString();
      }
      return renderComponent(Highlighter, { code, parser: parser });
    },
  },
];
