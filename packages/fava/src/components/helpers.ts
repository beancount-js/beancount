import { derived, writable, type Readable, type Writable } from "svelte/store";
import { useContext } from "../context";
import type { Filter } from "@beancount-js/filters";
import type { LedgerData } from "../core/ledger";
import {
  Amount,
  Balance,
  Close,
  Conversion,
  CounterInventory,
  Cost,
  Decimal,
  isDescendantOf,
  isInstanceOf,
  isValidNumber,
  matchesAccount,
  Open,
  Pad,
  Position,
  resolveMissing,
  Transaction,
  type CostSpec,
  type Directive,
  type Directives,
  type MissingType,
} from "@beancount-js/beancount";
import { formatDate } from "@beancount-js/parser";
import { useCtx } from "../stores/format";
import { RecordInventory } from "@beancount-js/beancount";

export function useLedger(filter?: Filter): Readable<LedgerData> {
  const { ledgerData, predicate } = useContext();
  return derived([ledgerData, predicate], ([$ledgerData, $predicate]) => {
    let data = $ledgerData;
    if ($predicate?.predicate) {
      data = data.filter($predicate.predicate);
    }
    if (filter) {
      data = data.filter(filter);
    }
    return data;
  });
}

export function chunk<T>(arr: Array<T>, size: number): Array<Array<T>> {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_v, i) =>
    arr.slice(i * size, i * size + size),
  );
}

export function accountChanges(
  transaction: Transaction,
  account: string,
  conversion: Conversion,
): Record<string, number> {
  const inventory = new CounterInventory();
  transaction.postings.forEach((posting) => {
    if (account === "" || isDescendantOf(account, posting.account)) {
      inventory.add(posting.units, posting.cost);
    }
  });
  return inventory.toRecord(conversion);
}

export function accountBalances(
  directives: Directives,
  account: string,
  conversion: Conversion,
): Record<
  string,
  { balance: Record<string, number>; changes: Record<string, number> }
> {
  const inventory = new CounterInventory();
  const data: Record<
    string,
    { balance: Record<string, number>; changes: Record<string, number> }
  > = {};
  directives.forEach((directive) => {
    if (directive instanceof Transaction) {
      directive.postings.forEach((posting) => {
        if (account === "" || isDescendantOf(account, posting.account)) {
          inventory.add(posting.units, posting.cost);
        }
        data[directive.id] = {
          balance: inventory.toRecord(conversion),
          changes: accountChanges(directive, posting.account, conversion),
        };
      });
    }
  });
  return data;
}

export type UseTableProperties = {
  data: Readable<LedgerData>;
  height: number;
  font: string;
  ledger: {
    balances: Record<string, Record<string, number>>;
    changes: Record<string, Record<string, number>>;
  };
  types: Array<
    | typeof Transaction
    | typeof Pad
    | typeof Balance
    | typeof Open
    | typeof Close
  >;
  account: string;
  sizer: (directive: Directive) => number;
};

export function useTable(props: Partial<UseTableProperties> = {}) {
  const { data, height, ledger, types, font } = {
    data: props.data ?? useContext().ledgerData,
    height: props.height ?? 22,
    font: props.font ?? "0.8rem monospace",
    ledger: props.ledger ?? { changes: {}, balances: {} },
    types: props.types ?? [Transaction, Pad, Balance, Open, Close],
  } as UseTableProperties;

  const toggled = writable<Set<string>>(new Set<string>());
  const ctx = useCtx();
  const { conversion } = useContext();
  return derived(
    [data, ctx, toggled, conversion],
    ([$ledgerData, $ctx, $toggled, $conversion]) => {
      const directives = $ledgerData.directives
        .filter((it) => isInstanceOf(it, ...types))
        .reverse();

      const costValues = (cost: Cost | CostSpec | MissingType) => {
        const values: Array<string> = [];
        cost = resolveMissing(cost);
        if (cost && cost instanceof Cost) {
          values.push($ctx.money(cost.amount));
          values.push(formatDate(resolveMissing(cost.date)));
          values.push(cost.label);
        }
        return values.filter((it) => it?.trim()).map((it) => it.trim());
      };

      const getSize = (index: number) => {
        const record = directives[index];
        let size = height;
        const bal = Object.keys(
          ledger.balances[formatDate(record.date)] || {},
        ).length;

        if (record instanceof Transaction) {
          const change = Object.keys(
            accountChanges(record, props.account || "", $conversion),
          ).length;
          const max = Math.max(
            bal,
            change,
            Math.ceil(record.postings.length / 10),
          );
          if (max > 1) {
            size += (max - 1) * height;
          }

          if (record.tags.length) {
            size += height + 5;
          }

          if (record.links.length) {
            size += height;
          }

          if (record.postings && $toggled.has(record.id)) {
            size += record.postings.length * height;
            record.postings.forEach((p) => {
              const values = costValues(p.cost);
              if (values.length > 1) {
                size += (values.length - 1) * height;
              }
            });
          }
        } else {
          if (bal > 1) {
            size += (bal - 1) * height;
          }
        }
        if (index === directives.length - 1) {
          size += 350;
        }
        return size;
      };

      const columnSizes = (): Record<string, string> => {
        const sizes: Record<string, number> = {
          account: 20,
          flag: 4,
          units: 10,
          cost: 10,
          price: 15,
          date: 10,
        };
        directives.forEach((directive) => {
          directive.accounts.forEach((acc) => {
            if (acc.length > sizes.account) {
              sizes.account = acc.length;
            }
          });

          if (directive instanceof Transaction) {
            for (const [currency, units] of Object.entries(
              accountChanges(directive, props.account || "", $conversion),
            )) {
              const value = $ctx.money(units, currency).length;
              if (value > sizes.cost) {
                sizes.cost = value;
              }
            }

            for (const [currency, units] of Object.entries(
              ledger.balances[formatDate(directive.date)] || {},
            )) {
              const value = $ctx.money(units, currency).length;
              if (value > sizes.price) {
                sizes.price = value;
              }
            }

            if ($toggled.has(directive.id)) {
              directive.postings.forEach((posting) => {
                costValues(posting.cost).forEach((value) => {
                  if (value.length > sizes.cost) {
                    sizes.cost = value.length;
                  }
                });
                let value = $ctx.money(posting.price);
                if (value.length > sizes.price) {
                  sizes.price = value.length;
                }
                value = $ctx.money(posting.units);
                if (value.length > sizes.units) {
                  sizes.units = value.length;
                }
              });
            }
          } else if (directive instanceof Balance) {
            const value = $ctx.money(directive.amount);
            if (value.length > sizes.units) {
              sizes.units = value.length;
            }
          }
        });

        const response: Record<string, string> = {};
        Object.keys(sizes).forEach((k) => {
          const size = parseInt((sizes[k] * 0.7).toFixed(2));
          response[k] = size > 0 ? `${size}rem` : "auto";
        });

        return response;
      };

      return {
        toggled,
        directives,
        costValues,
        getSize,
        sizes: columnSizes(),
      };
    },
  );
}

export type ColumnDef = {
  id: string;
  name: string;
  style: string;
  class: string[];
  type: string;
};

function getCircularReplacer() {
  const ancestors: Array<unknown> = [];
  return function (_key: string, value: unknown) {
    if (typeof value !== "object" || value === null) {
      return value;
    }
    while (ancestors.length > 0 && ancestors.at(-1) !== this) {
      ancestors.pop();
    }
    if (ancestors.includes(value)) {
      return "[Circular]";
    }
    ancestors.push(value);
    return value;
  };
}

export function stringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (value instanceof Position) {
    if (value.cost) {
      return (value.units.toString() + "\n" + value.cost.toString()).trim();
    }
    return value.units.toString();
  }

  if (Array.isArray(value)) {
    return value
      .map((it) => stringify(it))
      .join("\n")
      .replace(/\s+$/, "");
  }

  const response = value.toString() ?? "";

  if (response === {}.toString()) {
    return JSON.stringify(value, getCircularReplacer(), 4);
  }
  return response.replace(/\s+$/, "");
}

export interface Columns {
  ids: string[];
  definition: Record<string, ColumnDef>;
  values: ColumnDef[];
}

export function getCellType(obj: unknown) {
  if (obj == null || obj === undefined) {
    return "";
  }

  if (Array.isArray(obj) && obj.length) {
    return getCellType(obj.find((it) => it));
  }

  if (obj instanceof Date) {
    return "date";
  }

  if (
    obj instanceof Position ||
    obj instanceof Amount ||
    obj instanceof Decimal
  ) {
    return "amount";
  }

  if (typeof obj === "number" || isValidNumber(obj?.toString() || "")) {
    return "number";
  }

  if (obj instanceof RecordInventory) {
    return "inventory";
  }

  if (matchesAccount(obj)) {
    return "account";
  }

  return "text";
}

export function useDataset(
  data: Readable<Array<Record<string, unknown>>>,
  props: Partial<{
    columns: ColumnDef[];
    inventoryClass: string;
    height: number;
    font: string;
    padding: number;
    width: number;
  }> = {},
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    context.font = props.font ?? "0.8rem monospace";
  }
  const ctx = useCtx();
  return derived([data, ctx], ([$data, $ctx]) => {
    const inventoryClass = props.inventoryClass ?? "text-right";
    const columnDefs = props.columns ?? [];
    const height = props.height ?? 22;
    const padding = props.padding ?? 0;
    const width = props.width ?? 18;
    const columns: Columns = { ids: [], definition: {}, values: [] };
    let maxHeight = height * 2;

    if (!columnDefs.length && $data.length && $data[0]) {
      columnDefs.push(
        ...Object.keys($data[0]).map((it) => {
          return { name: it, id: it, style: "", class: [], type: "text" };
        }),
      );
    }

    const getSize = (index: number) => {
      const record = $data[index];
      let size = height;
      const multiColumn = columns.ids
        .map((it) => record[it])
        .map((it) => {
          return stringify(it).split("\n").length;
        });
      if (multiColumn.length) {
        const max = Math.max(...multiColumn);
        if (max > 1) {
          size += (max - 1) * height;
        }
      }

      if (index === $data.length - 1) {
        size += padding;
      }
      return size;
    };

    const columnSize: Record<string, string> = {};
    columnDefs.forEach((column) => {
      columns.ids.push(column.id);
      columns.definition[column.id] = column;
      columnSize[column.id] = column.name;
    });
    columns.values.push(...columnDefs);

    const numeric: Record<string, number> = {};
    $data.forEach((row, i) => {
      maxHeight += getSize(i);
      columnDefs.forEach((col) => {
        const key = col.id;
        const rowvalue = row[key];
        if (rowvalue === null || rowvalue === undefined) {
          return;
        }

        const type = getCellType(rowvalue);
        if (type && type !== "text") {
          col.type = type;
        }
        if (["amount", "inventory"].includes(col.type)) {
          if (inventoryClass && !col.class.includes(inventoryClass)) {
            col.class.push(inventoryClass);
          }
        }

        if (rowvalue instanceof RecordInventory) {
          for (const [currency, amount] of Object.entries(rowvalue.value)) {
            const value = $ctx.amount(amount as number, currency);
            if (value.length > columnSize[key].length) {
              columnSize[key] = value;
            }
          }
        } else {
          let value = stringify(rowvalue);
          if (value.includes("\n")) {
            value = value
              .split("\n")
              .sort((a: string, b: string) => b.length - a.length)[0];
          }
          if (isValidNumber(value)) {
            numeric[key] ||= 0;
            numeric[key] += 1;
          }

          if (value.length > columnSize[key].length) {
            columnSize[key] = value;
          }
        }
      });
    });

    maxHeight -= padding;

    Object.keys(numeric).forEach((k) => {
      if (numeric[k] / $data.length > 0.5) {
        if (
          inventoryClass &&
          !columns.definition[k].class.includes(inventoryClass)
        ) {
          columns.definition[k].class.push(inventoryClass);
        }
      }
    });

    Object.keys(columnSize).forEach((k) => {
      if (context) {
        const metrics = context.measureText("XX" + columnSize[k] + "XX");
        columns.definition[k].style =
          `width: ${Math.min(metrics.width + width, 1000)}px`;
        return;
      }
      const size = parseInt((columnSize[k].length * 0.6).toFixed(2));
      columns.definition[k].style =
        size > 0 ? `width: ${size}rem` : "width: auto";
    });

    return {
      maxHeight,
      columns,
      getSize,
    };
  });
}
