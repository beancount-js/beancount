import type { Context } from "./Context";

let activeContext: Context | null = null;

export function setActiveContext(context: Context | null) {
  activeContext = context;
}

export function getActiveContext(): Context | null {
  return activeContext;
}
