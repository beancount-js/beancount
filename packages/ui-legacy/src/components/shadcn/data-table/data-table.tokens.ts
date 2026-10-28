export const data_tableTokenNames = {
  background: "--ui-data-table-background",
  foreground: "--ui-data-table-foreground",
  borderColor: "--ui-data-table-border-color",
  radius: "--ui-data-table-radius",
} as const;

export type DataTableToken =
  (typeof data_tableTokenNames)[keyof typeof data_tableTokenNames];
