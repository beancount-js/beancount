import { BrowserWorkspaceAdapter } from "@beancount-js/web";

let instance: BrowserWorkspaceAdapter | undefined;

/** Shared browser workspace across root → /{projectId}/ navigations. */
export function getWebWorkspace() {
  if (!instance) instance = new BrowserWorkspaceAdapter();
  return instance;
}
