import type { ColumnDef } from "@tanstack/table-core";

type FavaError = {
  message: string;
  lineno: string;
};

export const columns: ColumnDef<FavaError>[] = [
  {
    accessorKey: "lineno",
    header: "Line",
  },
  {
    accessorKey: "message",
    header: "Message",
  },
];
