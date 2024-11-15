import {
  getContext,
  tick,
  type ComponentType,
  type SvelteComponent,
} from "svelte";
import type { Unsubscriber } from "svelte/motion";
import {
  derived,
  writable,
  type Readable,
  type Writable,
  get,
} from "svelte/store";
import { URLPattern } from "urlpattern-polyfill";

export interface Route {
  path: string;
  element: ComponentType<SvelteComponent>;
}

export interface RouteProperties {
  path: string;
  element?: ComponentType<SvelteComponent>;
  query: Record<string, string>;
  params: Record<string, string | undefined>;
}

export interface RouterContext {
  router: Router;
  history: HistoryManager;
  push: (path: string) => void;
  isActive: Readable<(path: string) => boolean>;
  routerLink: (el: HTMLElement) => any;
}

export const RouterKey = Symbol("routerContext");

export function normalizePath(path: string): string {
  path = decodeURI(path)
    .trim()
    .replace(/(^[#/]+)|(\/+$)/g, "");
  if (!path.startsWith("?")) {
    path = "/" + path;
  }
  return path;
}

class HistoryManager {
  private historyStack: RouteProperties[] = [];
  private currentIndex: number = -1;
  private maxSize: number;

  constructor(
    readonly activeRoute: Writable<RouteProperties>,
    maxSize: number = 20,
  ) {
    this.maxSize = maxSize;
  }

  private limitStackSize() {
    while (this.historyStack.length > this.maxSize) {
      this.historyStack.shift();
      this.currentIndex--;
    }
  }

  private refresh() {
    if (this.currentIndex < 0 || !this.historyStack[this.currentIndex]) {
      return;
    }
    const route = this.historyStack[this.currentIndex];
    this.activeRoute.set(route);
    this.updateButtons();
  }

  updateState(
    state: Partial<{
      query: Record<string, string>;
      params: Record<string, string | undefined>;
    }>,
  ) {
    if (this.historyStack.length && this.historyStack[this.currentIndex]) {
      this.historyStack[this.currentIndex] = {
        ...this.historyStack[this.currentIndex],
        ...state,
      };
    }
  }

  pushState(state: RouteProperties) {
    // Clear forward history if we're adding a new state
    this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
    this.historyStack.push(state);
    this.currentIndex++;
    this.limitStackSize();
    this.refresh();
  }

  replaceState(state: RouteProperties) {
    if (this.currentIndex >= 0) {
      this.historyStack[this.currentIndex] = state;
      this.refresh();
    } else {
      this.pushState(state);
    }
  }

  updateButtons() {
    const navButtons = document.querySelectorAll(
      "div[data-type=ledger-preview] .view-header-nav-buttons button.clickable-icon",
    );
    navButtons.forEach((button: Element, i) => {
      if (i == 0) {
        button.setAttribute(
          "aria-disabled",
          (this.currentIndex === 0).toString(),
        );
      } else if (i == 1) {
        button.setAttribute(
          "aria-disabled",
          (this.currentIndex === this.historyStack.length - 1).toString(),
        );
      }
    });
  }

  go(steps: number) {
    const newIndex = this.currentIndex + steps;
    if (newIndex >= 0 && newIndex < this.historyStack.length) {
      this.currentIndex = newIndex;
      this.limitStackSize();
      this.refresh();
    }
  }

  forward() {
    this.go(1);
  }

  back() {
    this.go(-1);
  }

  onPopState(callback: (event: { state: any }) => void) {}

  get history() {
    return {
      length: this.historyStack.length,
      state:
        this.currentIndex >= 0 ? this.historyStack[this.currentIndex] : null,
      currentState: () =>
        this.currentIndex >= 0 ? this.historyStack[this.currentIndex] : null,
    };
  }
}

export class Router {
  private stack: Array<RouteProperties> = [];
  private routes: Array<{ route: Route; pattern: URLPattern }> = [];
  private subscribers: Array<Unsubscriber> = [];
  readonly navigating: Writable<{ from: string; to: string } | null> =
    writable();

  constructor(
    readonly state: Writable<string>,
    readonly history: HistoryManager,
  ) {}

  push(path: string) {
    path = normalizePath(path);
    const value = get(this.state);
    if (value !== path) {
      this.state.set(path);
    }
  }

  createRouter(routes: Array<Route>) {
    this.routes = routes.map((route) => {
      return { route, pattern: new URLPattern({ pathname: route.path }) };
    });
    const watcher = this.state.subscribe(this.set.bind(this));
    this.subscribers.push(watcher);
  }

  set(path: string, replace: boolean = false) {
    for (const route of this.routes) {
      const href = `obsidian:${path}`;
      const found = route.pattern.exec(href);
      if (found) {
        const query: Record<string, string> = {};
        if (found.search.input) {
          for (const [key, value] of new URLSearchParams(found.search.input)) {
            query[key] = value;
          }
        }
        const props: RouteProperties = {
          path: found.pathname.input,
          element: route.route.element,
          query,
          params: found.pathname.groups,
        };
        replace
          ? this.history.replaceState(props)
          : this.history.pushState(props);
        return;
      }
    }

    this.history.pushState({
      path: "/404",
      query: {},
      params: {
        path,
      },
    });
  }

  get activeRoute() {
    return this.history.activeRoute;
  }

  async updateState(path: string) {
    let url = normalizePath(path);
    if (url.startsWith("?")) {
      const value = get(this.history.activeRoute);
      url = `${value.path.replace(/\/$/, "")}${url}`;
    }
    this.navigating.set({ from: get(this.state), to: path });
    this.state.set(url);
    tick().then(() => {
      this.navigating.set(null);
    });
  }

  destroy() {
    this.subscribers.forEach((it) => it());
    this.subscribers = [];
  }
}

export function createRouter(
  routes: Array<Route>,
  path: string = "/",
): RouterContext {
  const state = writable<string>(path);

  const activeRoute = writable<RouteProperties>({
    path,
    query: {},
    params: {},
  });
  const router = new Router(state, new HistoryManager(activeRoute));
  router.createRouter(routes);
  router.set(path, true);

  const isActive = derived(activeRoute, ($activeRoute) => {
    return (path: string): boolean => {
      path = normalizePath(path);
      const active = normalizePath($activeRoute.path);
      return active === path || (path && active.startsWith(path)) || false;
    };
  });

  const routerLink = (el: HTMLElement) => {
    function closest(
      target: HTMLElement | null,
      depth: number = 0,
      max: number = 5,
    ): HTMLElement | null {
      if (!target) {
        return null;
      }

      if (target.tagName.toLowerCase() === "a") {
        return target;
      }

      if (depth > max) {
        return null;
      }

      return closest(target.parentElement, depth + 1, max);
    }

    async function go(evt: MouseEvent) {
      let target = closest(evt.target as HTMLElement | null);
      if (!target) {
        return;
      }

      if (target && target.tagName.toLowerCase() === "a") {
        const url = target.getAttribute("href") || "";
        router.updateState(normalizePath(url));
        evt.preventDefault();
        return;
      }
    }
    el.addEventListener("click", go);
    return {
      destroy() {
        el.removeEventListener("click", go);
      },
    };
  };

  return {
    router,
    history: router.history,
    isActive,
    push: (path: string) => {
      router.push(path);
    },
    routerLink,
  };
}

export function useNavigation(): RouterContext {
  return getContext<RouterContext>(RouterKey);
}
