/**
 * Sorting of tables and the journal.
 *
 * Only clicking on headers that have a data-sort attribute will have an effect.
 * The currently supported values for `data-sort` are:
 *
 * - 'string': Case-insensitive string comparison.
 * - 'num': Clean and parse to float.
 *
 * For the tables that are rendered in Svelte components, the logic necessary
 * for sorting is also provided here (SortColumn and Sorter)
 */

import { permute } from "d3-array";
import { DateTime } from "luxon";
import { get, type Writable } from "svelte/store";
import { Amount } from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/parser";

export type SortOrder = "asc" | "desc" | "none";
type SortDirection = 1 | -1;

export const sortDirection = (o: SortOrder): SortDirection =>
  o === "asc" ? 1 : -1;

export type SortType = Record<
  string,
  {
    type: string;
    order: SortOrder;
  }
>;

const collator = Intl.Collator();
/** A compare function for strings using the default browser locale. */
const compareStrings = collator.compare.bind(collator);

/**
 * A column that can be used for sorting in some data.
 *
 * The data is simply an array of values, and this specifies a getter to be used
 * to sort by this column. On sorting, this getter will be invoked once per
 * element.
 */
export interface SortColumn<T = unknown> {
  /** The name of this column, usually to be used as a header in the table. */
  readonly name: string;

  /** Sort the data in the given direction. */
  sort(data: readonly T[], direction: SortDirection): readonly T[];
}

/**
 * A sorter of tabular data, is specified by a SortColumn and an order to sort
 * by.
 */
export class Sorter<T = unknown> {
  constructor(
    readonly column: SortColumn<T>,
    readonly order: SortOrder,
  ) {}

  /** Get a new sorter by switching to a possibly different column. */
  switchColumn(column: SortColumn<T>): Sorter<T> {
    if (column === this.column) {
      return new Sorter(column, this.order === "asc" ? "desc" : "asc");
    }
    return new Sorter(column, "asc");
  }

  /** Sort the data. */
  sort(data: readonly T[]): readonly T[] {
    return this.column.sort(data, sortDirection(this.order));
  }
}

/**
 * Sort array with provided value getter and compare function. Calls the value
 * getter only once per element.
 */
function sortInternal<T, U>(
  data: readonly T[],
  value: (row: T) => Array<U>,
  comparators: Array<{
    compare: (a: U, b: U) => number;
    direction: SortDirection;
  }>,
) {
  const indices = Uint32Array.from(data, (_d, i) => i);
  const values = data.map(value);
  // values and indices are of the same length (as data), so this is safe
  indices.sort((a, b) => {
    const va = values[a];
    const vb = values[b];
    for (let i = 0; i < comparators.length; i++) {
      const cmp = comparators[i];
      const result = cmp.direction * cmp.compare(va[i], vb[i]);
      if (result) {
        return result;
      }
    }
    return 0;
  });
  return permute(data, indices);
}

function nullWrapper(cmp: (a: any, b: any) => number) {
  return (a: any, b: any) => {
    if (a === b) {
      return 0;
    } else if (a === null || a === undefined) {
      return 1;
    } else if (b === null || b === undefined) {
      return -1;
    }
    return cmp(a, b);
  };
}

function dateMillis(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value instanceof DateTime) {
    return value.toMillis();
  }
  if (typeof value === "string") {
    return new Date(value).getTime();
  }
  return 0;
}

function getNumber(value: unknown): Decimal | null {
  if (value instanceof Decimal) {
    return value;
  }
  if (value instanceof Amount) {
    return value.units;
  }
  if (typeof value === "number" || typeof value === "string") {
    try {
      return new Decimal(value);
    } catch {
      return null;
    }
  }
  return null;
}

function getComparator(type: string): (a: any, b: any) => number {
  if (type === "amount" || type === "number") {
    return (a, b) => {
      const na = getNumber(a) ?? Decimal.ZERO;
      const nb = getNumber(b) ?? Decimal.ZERO;
      return na.minus(nb).number;
    };
  } else if (type === "date") {
    return (a, b) => dateMillis(a) - dateMillis(b);
  }
  return (a, b) => compareStrings(a?.toString() || "", b?.toString() || "");
}

export function sortDataset<T>(
  data: readonly T[],
  sort: SortType,
  handler?: (row: any, key: string) => any,
): T[] {
  sort = sort || {};
  if (!handler) {
    handler = (row: any, key: string) => row[key];
  }
  const keys = Object.keys(sort).filter((k) => sort[k].order !== "none");
  if (!keys.length) {
    return [...data];
  }
  return sortInternal(
    data,
    (row: any) => keys.map((k) => handler(row, k) ?? row[k]),
    keys.map((k) => ({
      compare: nullWrapper(getComparator(sort[k].type)),
      direction: sortDirection(sort[k].order),
    })),
  );
}

/** Svelte action: keyboard parity, reactive sort state, late columns and cleanup. */
export function useSortableTable(
  head: HTMLElement,
  sortOrder: Writable<SortType>,
) {
  const bindings = new Map<HTMLElement, () => void>();
  const orders: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };
  function synchronize() {
    const state = get(sortOrder);
    for (const header of bindings.keys()) {
      const order = state[header.dataset.sortName!]?.order ?? "none";
      header.dataset.order = order;
      const control =
        header.querySelector<HTMLElement>("[data-sort-control]") ?? header;
      control.dataset.order = order;
      control.setAttribute("aria-pressed", String(order !== "none"));
      const description = {
        none: "unsorted",
        asc: "ascending",
        desc: "descending",
      }[order];
      control.setAttribute(
        "aria-label",
        `${header.textContent?.trim() || header.dataset.sortName}: sort ${description}`,
      );
    }
  }
  function scan() {
    for (const [header, cleanup] of bindings) {
      if (!head.contains(header)) {
        cleanup();
        bindings.delete(header);
      }
    }
    for (const header of head.querySelectorAll<HTMLElement>(
      "span[data-sort]",
    )) {
      if (bindings.has(header)) continue;
      if (!header.dataset.sortName)
        throw new Error("Table header has no sort name.");
      const control =
        header.querySelector<HTMLElement>("[data-sort-control]") ?? header;
      control.setAttribute("role", "button");
      control.tabIndex = 0;
      const activate = () => {
        const name = header.dataset.sortName!;
        sortOrder.update((previous) => {
          const order = orders[previous[name]?.order ?? "none"];
          const next = {
            ...previous,
            [name]: { type: header.dataset.sort || "text", order },
          };
          if (order === "none") delete next[name];
          return next;
        });
      };
      const keyboard = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      };
      control.addEventListener("click", activate);
      control.addEventListener("keydown", keyboard);
      bindings.set(header, () => {
        control.removeEventListener("click", activate);
        control.removeEventListener("keydown", keyboard);
      });
    }
    synchronize();
  }
  let unsubscribe = sortOrder.subscribe(synchronize);
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(head, { childList: true, subtree: true });
  return {
    update(next: Writable<SortType>) {
      unsubscribe();
      sortOrder = next;
      unsubscribe = sortOrder.subscribe(synchronize);
      scan();
    },
    destroy() {
      unsubscribe();
      observer.disconnect();
      for (const cleanup of bindings.values()) cleanup();
      bindings.clear();
    },
  };
}
