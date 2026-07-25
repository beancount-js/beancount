import { derived, type Readable } from "svelte/store";
import { formatDate, Decimal, isValidNumber } from "@beancount-js/parser";
import { DateTime } from "luxon";
import {
  Amount,
  Inventory,
  matchesAccount,
  Position,
} from "@beancount-js/beancount";
import { useCtx } from "../stores/format";

export type ColumnDef = {
  id: string;
  name: string;
  style: string;
  class: string[];
  type: string;
};

function getCircularReplacer() {
  const ancestors: Array<any> = [];
  return function (key: string, value: any) {
    if (typeof value !== "object" || value === null) {
      return value;
    }
    // `this` is the object that value is contained in,
    // i.e., its direct parent.
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

export function stringify(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  if (value instanceof DateTime) {
    return value.toISODate() ?? "";
  }

  if (value instanceof Position) {
    if (value.cost) {
      return (value.units.toString() + "\n" + value.cost.toString()).trim();
    }
    return value.units.toString();
  }

  if (value instanceof Inventory) {
    return [...value.values()]
      .map((position) => stringify(position))
      .join("\n")
      .replace(/\s+$/, "");
  }

  if (Array.isArray(value)) {
    return value
      .map((it: any) => stringify(it))
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

export function getCellType(obj: any) {
  if (obj == null || obj === undefined) {
    return "";
  }

  if (Array.isArray(obj) && obj.length) {
    return getCellType(obj.find((it) => it));
  }

  if (obj instanceof Date) {
    return "date";
  }

  if (obj instanceof DateTime) {
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

  if (obj instanceof Inventory) {
    return "inventory";
  }

  if (matchesAccount(obj)) {
    return "account";
  }

  return "text";
}

export function useDataset(
  data: Readable<Array<any>>,
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
    const inventoryClass = props.inventoryClass ?? "cn-beta-inventory-value";
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
          if (inventoryClass && !col.class.contains(inventoryClass)) {
            col.class.push(inventoryClass);
          }
        }

        if (rowvalue instanceof Inventory) {
          for (const position of rowvalue.values()) {
            const value = $ctx.money(position.units);
            if (value.length > columnSize[key].length) {
              columnSize[key] = value;
            }
          }
        } else {
          let value = stringify(rowvalue);
          if (value.contains("\n")) {
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
          !columns.definition[k].class.contains(inventoryClass)
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
