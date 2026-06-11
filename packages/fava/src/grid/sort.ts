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
import { type Writable } from "svelte/store";
import { getNumber } from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/beancount";

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

export function useSortableTable(
  head: HTMLElement,
  sortOrder: Writable<SortType>,
) {
  const headers = head.querySelectorAll("span[data-sort]");
  const orders: Record<string, SortOrder> = {
    asc: "desc",
    desc: "none",
    none: "asc",
  };
  const elements: Record<string, Element> = {};

  headers.forEach((header) => {
    const type = header.getAttribute("data-sort") || "text";
    const name = header.getAttribute("data-sort-name");
    const order = header.getAttribute("data-order");
    if (!name) {
      throw new Error(`Table has invalid header: ${head.innerHTML}.`);
    }
    elements[name] = header;

    if (!order) {
      header.setAttribute("data-order", "none");
    }

    const sort = (order: SortOrder) => {
      header.setAttribute("data-order", order);
      sortOrder.update((prev) => {
        const sorted = { ...prev };
        sorted[name] = { type, order };
        for (const [key, value] of Object.entries(sorted)) {
          const el = elements[key];
          if (el) {
            el.setAttribute("data-order", value.order);
          }
          if (value.order === "none") {
            delete sorted[key];
          }
        }
        return sorted;
      });
    };

    header.addEventListener("click", () => {
      const order =
        orders[header.getAttribute("data-order") ?? "none"] ?? "none";
      sort(order);
    });
  });
}
