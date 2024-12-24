import type { Component } from "svelte";
import { useLedger } from "../context/ledger.svelte";
import type { RouterState } from "./router.svelte";

export interface Route {
  path: string;
  component: Component;
}

export interface RouteProperties {
  path: string;
  query: Record<string, string>;
  params: Record<string, string | undefined>;
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

export class HistoryManager {
  private historyStack: RouteProperties[] = [];
  private currentIndex: number = -1;
  private maxSize: number;

  constructor(
    readonly updater: (props: RouteProperties) => void,
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
    this.updateState(route);
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
      this.updater(this.historyStack[this.currentIndex]);
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

export function useNavigation(): RouterState {
  const ledger = useLedger();
  return ledger.navigation;
}
