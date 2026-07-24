import {
  categoryAccountsForSource,
  FilesystemIngestionStore,
  FilesystemReconciliationStore,
} from "@beancount-js/server";
import { serverWorkspace } from "./workspace";

export { categoryAccountsForSource };

let store: FilesystemIngestionStore | undefined;
let reconciliationStore: FilesystemReconciliationStore | undefined;

export function serverIngestion() {
  if (!store) {
    store = new FilesystemIngestionStore({
      resolveProjectRoot: async (projectId) => {
        const workspace = await serverWorkspace();
        return workspace.projectRoot(projectId);
      },
    });
  }
  return store;
}

export function serverReconciliations() {
  if (!reconciliationStore) {
    reconciliationStore = new FilesystemReconciliationStore(
      async (projectId) => {
        const workspace = await serverWorkspace();
        return workspace.projectRoot(projectId);
      },
    );
  }
  return reconciliationStore;
}
