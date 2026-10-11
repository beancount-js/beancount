import { getContext } from "svelte";
import type { BeancountController } from "./contracts";
export const BeancountControllerKey = Symbol("beancount-controller");
export function useBeancountController() {
  return getContext<BeancountController>(BeancountControllerKey);
}
