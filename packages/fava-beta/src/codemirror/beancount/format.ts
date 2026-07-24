import type { EditorView } from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import type { ChangeSpec, EditorState } from "@codemirror/state";
import type { SyntaxNode, Tree } from "@lezer/common";
import { Text } from "@beancount-js/parser";
import { beancountLanguage } from "@beancount-js/codemirror-lang-beancount";

const parser = beancountLanguage.parser;

interface Marker {
  from: number;
  to: number;
}

interface AlignMarker extends Marker {
  value: number | string;
}

type Elements = {
  prev: Marker;
  current: Marker;
  line: Marker;
};

export function numberWithCommas(x: string | number) {
  if (
    !x
      .toString()
      .trim()
      .match(/^-?[0-9,. ]+$/)
  ) {
    return x;
  }
  const parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function normalizeNumber(x: string) {
  if (!x.trim().match(/^[0-9,. ]+$/)) {
    return x;
  }

  const prefix = x.trim().startsWith("-") ? "-" : "";
  const parts = x
    .replace(/[^0-9\\.]+/, "")
    .trim()
    .split(".", 2);
  parts[0] = parts[0].replace(/^0+/, "");
  if (!parts[0]) {
    parts[0] = "0";
  }
  if (parts.length == 1) {
    return prefix + parts[0];
  }
  const decimal = parts[1];
  parts[1] = parts[1].replace(/0+$/, "");
  if (decimal.length == 2) {
    parts[1] = decimal;
  } else if (decimal && !parts[1].length) {
    parts[1] = decimal.substring(0, 2);
  }

  if (parts[1].length == 1) {
    parts[1] = parts[1] + "0";
  }
  return prefix + parts.join(".");
}

export function nodeCount(node: SyntaxNode, name: string) {
  let count = 0;
  node
    .toTree()
    .cursor()
    .iterate((node) => {
      if (node.name === name) {
        count++;
      }
    });

  return count;
}

function alignAmountsAndCurrency(state: EditorState): Array<AlignMarker> {
  const columns: Record<
    string,
    {
      max: number;
      nodes: Array<Elements>;
    }
  > = {
    number: { max: 0, nodes: [] },
    accountName: { max: 0, nodes: [] },
    options: { max: 0, nodes: [] },
  };
  const markers: Array<AlignMarker> = [];
  let hasError = false;

  const tree =
    ensureSyntaxTree(state, state.doc.length, 5000)! ?? syntaxTree(state);
  tree.cursor().iterate((node) => {
    const line = state.doc.lineAt(node.from);
    let prev = node.node.prevSibling;
    const next = node.node.nextSibling;

    if (node.type.isError) {
      hasError = true;
    }

    if (hasError) {
      return false;
    }

    if (
      prev &&
      next &&
      node.node.parent?.name === "NumberExpr" &&
      ["PLUS", "MINUS", "SLASH", "ASTERISK"].includes(node.name)
    ) {
      const value = " " + state.sliceDoc(node.from, node.to).trim() + " ";
      if (next.from - prev.to != 3) {
        markers.push({ from: prev.to, to: next.from, value });
      }
    }
    if (node.name === "Attribute") {
      const parent = node.node.parent?.parent?.name;
      if (parent) {
        const value = parent === "Posting" ? 4 : 2;
        if (node.from - line.from !== value) {
          markers.push({ from: line.from, to: node.from, value });
        }
      }
    } else if (node.name === "Date" && next) {
      const parent = node.node.parent?.parent?.name;
      if (next.from - node.to != 1) {
        markers.push({ from: node.to, to: next.from, value: 1 });
      }
      if (parent === "Journal" && line.from - node.from != 0) {
        markers.push({ from: line.from, to: node.from, value: 0 });
      }
    } else if (node.name === "Posting") {
      if (node.from - line.from != 2) {
        markers.push({ from: line.from, to: node.from, value: 2 });
      }
    } else if (node.name === "Transaction") {
      if (node.from - line.from != 0) {
        markers.push({ from: line.from, to: node.from, value: 0 });
      }
    } else if (
      node.name === "Flag" &&
      node.node.parent?.name === "Transaction"
    ) {
      if (next && next.from - node.to != 1) {
        markers.push({ from: node.to, to: next.from, value: 1 });
      }
    } else if (prev && ["AccountName", "Currency"].includes(node.name)) {
      if (
        [
          "BALANCE",
          "CLOSE",
          "OPEN",
          "PAD",
          "NOTE",
          "DOCUMENT",
          "PRICE",
        ].includes(prev.name)
      ) {
        const value = 9 - (prev.to - prev.from);
        if (value > 0 && prev.to + value !== node.from) {
          markers.push({ from: prev.to, to: node.from, value });
        }
      } else if (prev.name === "AccountName") {
        const diff = prev.to - line.from + 2;
        if (diff > columns.accountName.max) {
          columns.accountName.max = diff;
        }
        columns.accountName.nodes.push({
          prev: { from: prev.from, to: prev.to },
          current: { from: node.from, to: node.to },
          line: { from: line.from, to: line.to },
        });
      }
    } else if (node.name === "NumberExpr") {
      if (next?.name === "Currency") {
        if (next.from - node.to != 1) {
          markers.push({ from: node.to, to: next.from, value: 1 });
        }
      }

      if (!prev && node.node.parent?.name === "Amount") {
        prev = node.node.parent?.prevSibling;
      }

      if (
        !prev?.name ||
        !["AccountName", "Currency"].includes(prev.name) ||
        next?.name !== "Currency"
      ) {
        return;
      }

      const value = state.sliceDoc(node.from, node.to);
      const normalizedValue = numberWithCommas(normalizeNumber(value));
      if (value !== normalizedValue) {
        markers.push({
          from: node.from,
          to: node.to,
          value: normalizedValue,
        });
      }

      const delta = nodeCount(node.node, "Number") > 1 ? 4 : 0;
      columns.number.nodes.push({
        prev: { from: prev.from, to: prev.to },
        current: { from: node.from, to: node.to + delta },
        line: { from: line.from, to: line.to },
      });
      const diff = prev.to + (node.to - node.from) - line.from + 2 + delta;
      if (diff > columns.number.max) {
        columns.number.max = diff;
      }
    } else if (node.name === "Currencies") {
      if (prev?.name !== "AccountName") {
        return;
      }

      columns.number.nodes.push({
        prev: { from: prev.from, to: prev.to },
        current: { from: node.from, to: node.to - 1 - (node.to - node.from) },
        line: { from: line.from, to: line.to },
      });
      const diff = prev.to + (node.to - node.from) - line.from;
      if (diff > columns.number.max) {
        columns.number.max = diff;
      }
    }
  });

  if (hasError) {
    return [];
  }

  Object.keys(columns).forEach((key) => {
    const { max, nodes } = columns[key];
    if (key === "number") {
      nodes.forEach(({ prev, current, line }) => {
        const value = line.from + max - prev.to - (current.to - current.from);
        if (prev.to + value == current.from) {
          return;
        }
        markers.push({ from: prev.to, to: current.from, value });
      });
    } else if (key === "accountName") {
      nodes.forEach(({ prev, current, line }) => {
        const value = line.from + max - prev.to;
        if (prev.to + value == current.from) {
          return;
        }
        markers.push({ from: prev.to, to: current.from, value });
      });
    }
  });
  return markers;
}

function alignValues(tree: Tree, doc: Text): Array<AlignMarker> {
  const columns: Record<
    string,
    {
      max: number;
      nodes: Array<Elements>;
    }
  > = {
    number: { max: 0, nodes: [] },
    accountName: { max: 0, nodes: [] },
    options: { max: 0, nodes: [] },
  };
  const markers: Array<AlignMarker> = [];
  let hasError = false;

  tree.cursor().iterate((node) => {
    const line = doc.lineAt(node.from);
    let prev = node.node.prevSibling;
    const next = node.node.nextSibling;

    if (node.type.isError) {
      hasError = true;
    }

    if (hasError) {
      return false;
    }

    if (
      prev &&
      next &&
      node.node.parent?.name === "NumberExpr" &&
      ["PLUS", "MINUS", "SLASH", "ASTERISK"].includes(node.name)
    ) {
      const value = " " + doc.sliceString(node.from, node.to).trim() + " ";
      if (next.from - prev.to != 3) {
        markers.push({ from: prev.to, to: next.from, value });
      }
    }
    if (node.name === "Attribute") {
      const parent = node.node.parent?.parent?.name;
      if (parent) {
        const value = parent === "Posting" ? 4 : 2;
        if (node.from - line.from !== value) {
          markers.push({ from: line.from, to: node.from, value });
        }
      }
    } else if (node.name === "Date" && next) {
      const parent = node.node.parent?.parent?.name;
      if (next.from - node.to != 1) {
        markers.push({ from: node.to, to: next.from, value: 1 });
      }
      if (parent === "Journal" && line.from - node.from != 0) {
        markers.push({ from: line.from, to: node.from, value: 0 });
      }
    } else if (node.name === "Posting") {
      if (node.from - line.from != 2) {
        markers.push({ from: line.from, to: node.from, value: 2 });
      }
    } else if (node.name === "Transaction") {
      if (node.from - line.from != 0) {
        markers.push({ from: line.from, to: node.from, value: 0 });
      }
    } else if (
      node.name === "Flag" &&
      node.node.parent?.name === "Transaction"
    ) {
      if (next && next.from - node.to != 1) {
        markers.push({ from: node.to, to: next.from, value: 1 });
      }
    } else if (prev && ["AccountName", "Currency"].includes(node.name)) {
      if (
        [
          "BALANCE",
          "CLOSE",
          "OPEN",
          "PAD",
          "NOTE",
          "DOCUMENT",
          "PRICE",
        ].includes(prev.name)
      ) {
        const value = 9 - (prev.to - prev.from);
        if (value > 0 && prev.to + value !== node.from) {
          markers.push({ from: prev.to, to: node.from, value });
        }
      } else if (prev.name === "AccountName") {
        const diff = prev.to - line.from + 2;
        if (diff > columns.accountName.max) {
          columns.accountName.max = diff;
        }
        columns.accountName.nodes.push({
          prev: { from: prev.from, to: prev.to },
          current: { from: node.from, to: node.to },
          line: { from: line.from, to: line.to },
        });
      }
    } else if (node.name === "NumberExpr") {
      if (next?.name === "Currency") {
        if (next.from - node.to != 1) {
          markers.push({ from: node.to, to: next.from, value: 1 });
        }
      }

      if (!prev && node.node.parent?.name === "Amount") {
        prev = node.node.parent?.prevSibling;
      }

      if (
        !prev?.name ||
        !["AccountName", "Currency"].includes(prev.name) ||
        next?.name !== "Currency"
      ) {
        return;
      }

      const value = doc.sliceString(node.from, node.to);
      const normalizedValue = numberWithCommas(normalizeNumber(value));
      if (value !== normalizedValue) {
        markers.push({
          from: node.from,
          to: node.to,
          value: normalizedValue,
        });
      }

      const delta = nodeCount(node.node, "Number") > 1 ? 4 : 0;
      columns.number.nodes.push({
        prev: { from: prev.from, to: prev.to },
        current: { from: node.from, to: node.to + delta },
        line: { from: line.from, to: line.to },
      });
      const diff = prev.to + (node.to - node.from) - line.from + 2 + delta;
      if (diff > columns.number.max) {
        columns.number.max = diff;
      }
    } else if (node.name === "Currencies") {
      if (prev?.name !== "AccountName") {
        return;
      }

      columns.number.nodes.push({
        prev: { from: prev.from, to: prev.to },
        current: { from: node.from, to: node.to - 1 - (node.to - node.from) },
        line: { from: line.from, to: line.to },
      });
      const diff = prev.to + (node.to - node.from) - line.from;
      if (diff > columns.number.max) {
        columns.number.max = diff;
      }
    }
  });

  if (hasError) {
    return [];
  }

  Object.keys(columns).forEach((key) => {
    const { max, nodes } = columns[key];
    if (key === "number") {
      nodes.forEach(({ prev, current, line }) => {
        const value = line.from + max - prev.to - (current.to - current.from);
        if (prev.to + value == current.from) {
          return;
        }
        markers.push({ from: prev.to, to: current.from, value });
      });
    } else if (key === "accountName") {
      nodes.forEach(({ prev, current, line }) => {
        const value = line.from + max - prev.to;
        if (prev.to + value == current.from) {
          return;
        }
        markers.push({ from: prev.to, to: current.from, value });
      });
    }
  });
  return markers;
}

export interface BeanCountFormatConfig {
  spacer: string;
  max: number;
  depth: number;
}

export function formatLedger(
  view: EditorView,
  config: BeanCountFormatConfig = { spacer: " ", max: 60, depth: 0 },
) {
  const start = new Date();
  const changes: Array<ChangeSpec> = [];
  alignAmountsAndCurrency(view.state).forEach((marker) => {
    if (typeof marker.value === "number") {
      changes.push({
        from: marker.from,
        to: marker.to,
        insert: config.spacer.repeat(marker.value),
      });
    } else {
      changes.push({
        from: marker.from,
        to: marker.to,
        insert: marker.value,
      });
    }
  });

  if (changes.length) {
    view.dispatch({ changes, userEvent: "beancount.lint.amounts" });
  }

  if (config.depth == 0 && changes.length) {
    return formatLedger(view, { ...config, depth: 1 });
  }

  const end = new Date();
  console.log(
    `Beancount:Format ${changes.length} change(s) in ${end.getTime() - start.getTime()} ms`,
  );
}

export function beancountFormat(
  content: string | Text,
  config: BeanCountFormatConfig = { spacer: " ", max: 60, depth: 0 },
): string {
  if (typeof content === "string") {
    return beancountFormat(Text.of(content.split("\n")));
  }

  const tree = parser.configure({ strict: false }).parse(content.toString());
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  alignValues(tree, content).forEach((marker) => {
    if (typeof marker.value === "number") {
      changes.push({
        from: marker.from,
        to: marker.to,
        insert: config.spacer.repeat(marker.value),
      });
    } else {
      changes.push({
        from: marker.from,
        to: marker.to,
        insert: marker.value,
      });
    }
  });

  changes.sort((a, b) => {
    return a.from - b.from || a.to - b.to || a.insert.length - b.insert.length;
  });

  let doc: Text = content;
  let delta: number = 0;
  const cache = new Set<string>();
  const changeSet = changes.filter((change) => {
    const key = `${change.from}:${change.to}:${change.insert}`;
    if (cache.has(key)) {
      return false;
    }
    cache.add(key);
    return true;
  });

  changeSet.forEach((change) => {
    doc = doc.replace(
      change.from + delta,
      change.to + delta,
      Text.of(change.insert.split("\n")),
    );
    delta += change.insert.length - (change.to - change.from);
  });

  if (changeSet.length && config.depth < 20) {
    return beancountFormat(doc, { ...config, depth: config.depth + 1 });
  }

  return doc.toString();
}
