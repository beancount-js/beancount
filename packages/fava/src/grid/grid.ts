import { derived, type Readable } from "svelte/store";
import { useCtx } from "../stores/format";
import { formatDate } from "@beancount-js/parser";
import { DateTime } from "luxon";
import { Inventory, Position } from "@beancount-js/beancount";

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

function rawStringify(value: any): string {
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

  if (Array.isArray(value)) {
    return value
      .map((it: any) => stringify(it))
      .join("\n")
      .replace(/\s+$/, "");
  }

  const response = value.toString();

  if (response === {}.toString()) {
    return JSON.stringify(value, getCircularReplacer(), 4);
  }
  return response.replace(/\s+$/, "");
}

export function stringify(value: any): string {
  return rawStringify(value).trim().replace(/\s+$/, "");
}

export interface Column<T> {
  id: string;
  name: string;
  type: string;
  sortable?: boolean;
  class?: string;
  value: (row: T, state?: string) => any;
}

export function useDataset<T>(
  data: Readable<Array<any>>,
  props: Partial<{
    columns: Column<T>[];
    height: number;
    font: string;
    padding: number;
    width: number;
    heightDiff: number;
  }> = {},
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    context.font = props.font ?? "0.8rem monospace";
  }
  const ctx = useCtx();
  return derived([data, ctx], ([$data, $ctx]) => {
    const columnDefs = props.columns ?? [];
    const height = props.height ?? 22;
    const padding = props.padding ?? 0;
    const width = props.width ?? 18;
    const heightDiff = props.heightDiff ?? 0;
    const columns: Column<T>[] = props.columns ?? [];
    let maxHeight = height * 2;

    const getSize = (index: number, includePadding: boolean = true) => {
      if (!$data.length) {
        return 0;
      }

      const record = $data[index];
      let size = height;
      const multiColumn = columns
        .map((it) => it.value(record))
        .map((it) => {
          return stringify(it).split("\n").length;
        });

      if (multiColumn.length) {
        const max = Math.max(...multiColumn);
        if (max > 1) {
          size += (max - 1) * height;
        }
      }

      if (includePadding && index === $data.length - 1) {
        size += padding;
      }
      return size + heightDiff;
    };

    const columnSize: Record<string, string> = {};
    columnDefs.forEach((column) => {
      columnSize[column.id] = column.name;
    });

    $data.forEach((row, i) => {
      maxHeight += getSize(i);
      columnDefs.forEach((col) => {
        const key = col.id;
        const rowvalue = col.value(row);
        if (rowvalue === null || rowvalue === undefined) {
          return;
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
          if (value.includes("\n")) {
            value = value
              .split("\n")
              .sort((a: string, b: string) => b.length - a.length)[0];
          }

          if (value.length > columnSize[key].length) {
            columnSize[key] = value;
          }
        }
      });
    });

    const styles: Record<string, string> = {};
    const widths: Record<string, number> = {};

    Object.keys(columnSize).forEach((k) => {
      if (context) {
        const metrics = context.measureText("XX" + columnSize[k] + "XX");
        styles[k] = `width: ${Math.min(metrics.width + width, 1000)}px; `;
        widths[k] = Math.min(metrics.width + width, 1000);
        return;
      }
      const size = parseInt((columnSize[k].length * 0.6).toFixed(2));
      styles[k] = size > 0 ? `width: ${size}rem; ` : "width: auto; ";
    });

    return {
      styles,
      widths,
      maxHeight,
      columns,
      getSize,
    };
  });
}
