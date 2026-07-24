import { validatedLocalStorageSyncedStore } from "../lib/store";
import { importData, type ImportData } from "./schema";

export const importerStore = validatedLocalStorageSyncedStore<ImportData>(
  "ledger-importer",
  () => [],
  importData,
);
