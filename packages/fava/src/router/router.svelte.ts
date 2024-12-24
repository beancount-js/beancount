import { URLPattern } from "urlpattern-polyfill";
import {
  HistoryManager,
  normalizePath,
  type Route,
  type RouteProperties,
} from "./router";
import NotFound from "./NotFound.svelte";

type ActiveRoute = {
  route: Route;
  properties: RouteProperties;
};

type RouteConfig = Array<{ route: Route; pattern: URLPattern }>;

const NOT_FOUND: ActiveRoute = Object.freeze({
  route: Object.freeze({
    path: "/404",
    component: NotFound,
  }),
  properties: Object.freeze({
    path: "/404",
    params: {},
    query: {},
  }),
});

function findRoute(
  path: string,
  routes: RouteConfig,
  props: Partial<RouteProperties> = {},
): ActiveRoute {
  path = normalizePath(path);
  for (const route of routes) {
    const href = `ledger:${path}`;
    const found = route.pattern.exec(href);
    if (found) {
      const query: Record<string, string> = {};
      if (found.search.input) {
        for (const [key, value] of new URLSearchParams(found.search.input)) {
          query[key] = value;
        }
      }
      return {
        route: route.route,
        properties: {
          path: found.pathname.input,
          query,
          params: found.pathname.groups,
          ...props,
        },
      };
    }
  }
  return NOT_FOUND;
}

export class RouterState {
  routes: Array<{ route: Route; pattern: URLPattern }> = $state([]);
  activeRoute: ActiveRoute = $state(NOT_FOUND);

  private historyManager: HistoryManager = new HistoryManager((props) => {
    const current = JSON.stringify(this.activeRoute?.properties);
    const incoming = JSON.stringify(props);
    if (current === incoming) {
      return;
    }
    this.activeRoute = findRoute(props.path, this.routes, props);
    window.history.replaceState({}, "", `${props.path}`);
  });

  push(path: string, props: Partial<RouteProperties> = {}) {
    this.historyManager.pushState({params: {}, query: {}, ...props, path});
  }

  create(routes: Array<Route>, path: string = "/") {
    this.routes = routes.map((route) => {
      return { route, pattern: new URLPattern({ pathname: route.path }) };
    });
    if (path) {
      this.set(path, true);
    }
  }

  set(path: string, replace: boolean = false) {
    const route = findRoute(path, this.routes);
    if (route) {
      replace
        ? this.historyManager.replaceState(route.properties)
        : this.historyManager.pushState(route.properties);
    }
  }

  pushState(state: RouteProperties) {
    this.historyManager.pushState(state);
  }

  replaceState(state: RouteProperties) {
    this.historyManager.replaceState(state);
  }

  go(steps: number = 0) {
    this.historyManager.go(steps);
  }

  forward() {
    this.historyManager.forward();
  }

  back() {
    this.historyManager.back();
  }

  get history() {
    return this.historyManager.history;
  }

  async updateState(path: string) {
    let url = normalizePath(path);
    if (url.startsWith("?")) {
      const value = this.activeRoute.route.path;
      url = `${value.replace(/\/$/, "")}${url}`;
    }
    this.push(url);
  }

  get routerLink() {
    return this.routerLinkDirective.bind(this);
  }

  routerLinkDirective(el: HTMLElement) {
    const that = this;
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
        that.updateState(normalizePath(url));
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
  }
}
