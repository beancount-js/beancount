import { FilesystemRulesStore } from "@beancount-js/server";
import { serverIngestion } from "./ingestion";
import { serverWorkspace } from "./workspace";

let store: FilesystemRulesStore | undefined;

export function serverRules() {
  if (!store) {
    store = new FilesystemRulesStore({
      resolveProjectRoot: async (projectId) => {
        const workspace = await serverWorkspace();
        return workspace.projectRoot(projectId);
      },
      ingestionStore: serverIngestion(),
    });
  }
  return store;
}
