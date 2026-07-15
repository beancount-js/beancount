import {
  categoryAccountsForSource,
  FilesystemIngestionStore,
} from "@beancount-js/server";

export { categoryAccountsForSource };

const store = new FilesystemIngestionStore();

export function serverIngestion() {
  return store;
}
