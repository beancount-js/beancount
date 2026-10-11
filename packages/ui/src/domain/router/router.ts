import { derived, get, type Writable } from "svelte/store";
import { useBeancountController } from "../../controller/context";
import type {
  BeancountControllerActions,
  BeancountRoute,
} from "../../controller/contracts";
export function createControllerNavigation(
  activeRoute: Writable<BeancountRoute>,
  actions: BeancountControllerActions,
) {
  const router = {
    activeRoute,
    push: actions.navigate,
    updateState: actions.navigate,
    set: actions.navigate,
  };
  return {
    router,
    activeRoute,
    push: actions.navigate,
    isActive: derived(
      activeRoute,
      (route) => (path: string) =>
        route.path === path || route.path.startsWith(path + "/"),
    ),
    history: {
      activeRoute,
      back: actions.back,
      forward: actions.forward,
      updateState({ params }: { params: Record<string, string | undefined> }) {
        const current = get(activeRoute);
        const qs = new URLSearchParams(current.query);
        for (const [key, value] of Object.entries(params)) {
          if (value) qs.set(key, value);
          else qs.delete(key);
        }
        actions.navigate(current.path + (qs.size ? "?" + qs : ""));
      },
    },
  };
}
export function useNavigation() {
  return useBeancountController().navigation;
}
