import { getContext, tick, type Component, type ComponentType } from "svelte";
import type { Unsubscriber } from "svelte/motion";
import {
  derived,
  writable,
  type Readable,
  type Writable,
  get,
} from "svelte/store";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import { URLPattern } from "urlpattern-polyfill";
import {
  buildLedgerHref,
  ledgerStemForPath,
  parseLedgerAndView,
  resolveLedgerPath,
  splitViewAndQuery,
} from "../lib/ledger-route";
import { getStudioRouteEnv, setStudioRouteEnv } from "../lib/studio-route-env";

export interface Route {
  path: string;
  element: ComponentType<Component>;
}

export interface RouteProperties {
  path: string;
  element?: ComponentType<Component>;
  query: Record<string, string>;
  params: Record<string, string | undefined>;
}

export interface RouterContext {
  router: Router;
  history: HistoryManager;
  activeRoute: Writable<RouteProperties>;
  push: (path: string) => void;
  isActive: Readable<(path: string) => boolean>;
  routerLink: (el: HTMLElement) => { destroy: () => void };
  destroy?: () => void;
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
      this.activeRoute.set(this.historyStack[this.currentIndex]);
    }
  }

  pushState(state: RouteProperties) {
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

function pathnameToViewPath(pathname: string): {
  viewPath: string;
  query: Record<string, string>;
  params: Record<string, string>;
  ledgerStem: string;
} | null {
  const segments = pathname.split("/").filter(Boolean);
  // /{projectId}/ledger/...
  const ledgerIndex = segments.indexOf("ledger");
  if (ledgerIndex < 0 || ledgerIndex >= segments.length - 1) return null;
  const rest = segments.slice(ledgerIndex + 1);
  const parsed = parseLedgerAndView(rest);
  if (!parsed) return null;
  return {
    viewPath: parsed.viewPath,
    query: {},
    params: parsed.params,
    ledgerStem: parsed.ledgerStem,
  };
}

export class Router {
  private routes: Array<{ route: Route; pattern: URLPattern }> = [];
  private subscribers: Array<Unsubscriber> = [];
  private syncingFromPage = false;
  private suppressStateWatch = false;
  readonly navigating: Writable<{ from: string; to: string } | null> =
    writable(null);

  constructor(
    readonly state: Writable<string>,
    readonly history: HistoryManager,
  ) {}

  push(path: string) {
    path = normalizePath(path);
    const value = get(this.state);
    if (value !== path) {
      this.state.set(path);
    } else {
      // Same view path — still sync the browser URL (ledger stem may have changed).
      void this.set(path, true);
    }
  }

  createRouter(routes: Array<Route>) {
    this.routes = routes.map((route) => {
      return { route, pattern: new URLPattern({ pathname: route.path }) };
    });
    const watcher = this.state.subscribe((path) => {
      if (this.suppressStateWatch) return;
      void this.set(path, false);
    });
    this.subscribers.push(watcher);
  }

  private matchRoute(path: string): RouteProperties | null {
    path = normalizePath(path);
    for (const route of this.routes) {
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
          path: found.pathname.input,
          element: route.route.element,
          query,
          params: found.pathname.groups,
        };
      }
    }
    return null;
  }

  async set(
    path: string,
    replace: boolean = false,
    options: { syncBrowser?: boolean } = {},
  ) {
    path = normalizePath(path);
    const props =
      this.matchRoute(path) ??
      ({
        path: "/404",
        query: {},
        params: { path },
      } satisfies RouteProperties);

    // Drop legacy ledger query — ledger lives in the pathname now
    const { ledger: _legacyLedger, ...query } = props.query;
    const nextProps = { ...props, query };

    replace
      ? this.history.replaceState(nextProps)
      : this.history.pushState(nextProps);

    const shouldSync = options.syncBrowser !== false && !this.syncingFromPage;
    if (shouldSync) {
      await this.syncBrowserUrl(nextProps, replace);
    }
  }

  private async syncBrowserUrl(props: RouteProperties, replace: boolean) {
    const env = getStudioRouteEnv();
    if (!env.projectId || !env.ledgerStem || typeof window === "undefined") {
      return;
    }
    const href = buildLedgerHref(
      env.projectId,
      env.ledgerStem,
      props.path,
      props.query,
    );
    const current = `${window.location.pathname}${window.location.search}`;
    const normalizedCurrent = current.endsWith("/")
      ? current
      : `${current.split("?")[0]}/`.replace(/\/+$/, "/") +
        (window.location.search || "");
    if (href === current || href === normalizedCurrent) return;
    await goto(href, {
      replaceState: replace,
      keepFocus: true,
      noScroll: true,
    });
  }

  /** Apply the current SvelteKit page URL onto the in-app router. */
  applyPageUrl(pathname: string, searchParams: URLSearchParams) {
    const parsed = pathnameToViewPath(pathname);
    if (!parsed) return;

    const env = getStudioRouteEnv();
    const resolved =
      resolveLedgerPath(parsed.ledgerStem, env.availableLedgers) ??
      (env.availableLedgers.includes(parsed.ledgerStem)
        ? parsed.ledgerStem
        : env.ledgerPath);
    if (resolved) {
      setStudioRouteEnv({
        ledgerPath: resolved,
        ledgerStem: ledgerStemForPath(resolved, env.availableLedgers),
      });
    }

    const query: Record<string, string> = {};
    for (const [key, value] of searchParams) {
      if (key !== "ledger") query[key] = value;
    }

    let viewWithQuery = parsed.viewPath;
    const search = new URLSearchParams(query).toString();
    if (search) viewWithQuery = `${parsed.viewPath}?${search}`;

    this.syncingFromPage = true;
    this.suppressStateWatch = true;
    try {
      const props =
        this.matchRoute(viewWithQuery) ??
        ({
          path: parsed.viewPath,
          query,
          params: parsed.params,
        } satisfies RouteProperties);
      // Merge account params from path parse
      props.params = { ...props.params, ...parsed.params };
      props.query = { ...props.query, ...query };
      this.history.replaceState(props);
      this.state.set(search ? `${parsed.viewPath}?${search}` : parsed.viewPath);
    } finally {
      this.suppressStateWatch = false;
      this.syncingFromPage = false;
    }
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
  path: string = "/dashboard",
): RouterContext {
  let bootstrap = path;
  if (typeof window !== "undefined") {
    const fromPage = pathnameToViewPath(window.location.pathname);
    if (fromPage) {
      const search = window.location.search.replace(/^\?/, "");
      bootstrap = search ? `${fromPage.viewPath}?${search}` : fromPage.viewPath;
    }
  }
  const { viewPath, query } = splitViewAndQuery(bootstrap);
  const initialPath =
    Object.keys(query).length > 0
      ? `${viewPath}?${new URLSearchParams(query)}`
      : viewPath;
  const state = writable<string>(initialPath);

  const activeRoute = writable<RouteProperties>({
    path: viewPath,
    query,
    params: {},
  });
  const router = new Router(state, new HistoryManager(activeRoute));
  router.createRouter(routes);
  // Hydrate in-memory route without rewriting the browser URL (page store owns it).
  void router.set(initialPath, true, { syncBrowser: false });

  let pageUnsub: Unsubscriber | undefined;
  if (typeof window !== "undefined") {
    pageUnsub = page.subscribe(($page) => {
      router.applyPageUrl($page.url.pathname, $page.url.searchParams);
    });
  }

  const isActive = derived(activeRoute, ($activeRoute) => {
    return (routePath: string): boolean => {
      routePath = normalizePath(routePath);
      const active = normalizePath($activeRoute.path);
      return (
        active === routePath || (routePath && active.startsWith(routePath))
      );
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
      const target = closest(evt.target as HTMLElement | null);
      if (target?.tagName.toLowerCase() === "a") {
        const url = target.getAttribute("href") || "";
        // External or already path-based ledger links: let the browser / SvelteKit handle
        if (
          url.startsWith("http") ||
          url.startsWith("/api") ||
          (url.startsWith("/") && url.includes("/ledger/"))
        ) {
          return;
        }
        router.updateState(normalizePath(url));
        evt.preventDefault();
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
    activeRoute: router.activeRoute,
    isActive,
    push: (routePath: string) => {
      router.push(routePath);
    },
    routerLink,
    destroy: () => {
      pageUnsub?.();
      router.destroy();
    },
  };
}

export function useNavigation(): RouterContext {
  return getContext<RouterContext>(RouterKey);
}
