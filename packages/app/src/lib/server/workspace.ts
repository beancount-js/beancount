import { FilesystemWorkspaceAdapter } from "@beancount-js/server";

const adapter = new FilesystemWorkspaceAdapter();
let openedRoot: string | undefined;

export async function serverWorkspace() {
  const root = process.env.BEANCOUNT_STUDIO_PROJECT_ROOT;
  if (root && openedRoot !== root) {
    await adapter.openProject(root, process.env.BEANCOUNT_STUDIO_ENTRY_FILE);
    openedRoot = root;
  }
  return adapter;
}
