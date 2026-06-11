import alasql from "alasql";
import { CaseInsensitiveMap } from "../core/utils";
import { QueryVisitor } from "./Visitor";

const arrayColumns = new Set([
  "directives.tags",
  "directives.links",
  "directives.accounts",
  "transactions.tags",
  "transactions.links",
  "transactions.accounts",
  "postings.tags",
  "postings.links",
  "postings.accounts",
  "postings.other_accounts",
  "tags",
  "links",
  "accounts",
  "other_accounts",
]);

function clone(obj) {
  return Object.assign(Object.create(Object.getPrototypeOf(obj)), obj);
}

export class Query {
  sourceTableId = "";
  aliases = new CaseInsensitiveMap();
  statements = [];
  stack = [];
  state = { tableid: "", skip: false };

  constructor(tableid = "postings", aliases = {}, columns = {}) {
    this.sourceTableId = tableid ?? "postings";
    this.columns = columns;
    for (const [key, value] of Object.entries(aliases || {})) {
      if (typeof value === "function") {
        this.aliases.set(key, value);
      } else {
        this.aliases.set(key, (entity, state) => {
          entity[state.column] = value;
        });
      }
    }
  }

  get tableid() {
    return this.state.tableid || this.sourceTableId;
  }

  parse(qs) {
    this.qs = qs;
    const ast = alasql.parse(qs);
    const visitor = new QueryVisitor(ast, {
      enter: this.enter.bind(this),
      leave: this.leave.bind(this),
    });
    return ast;
  }

  enter(stmt, state) {
    if (
      stmt.funcid === "account_sortkey" &&
      stmt.args?.length == 1 &&
      stmt.args[0].columnid === "account"
    ) {
      stmt = new alasql.yy.Column({
        columnid: "account_sortkey",
        tableid: "postings",
        as: stmt.as,
      });
      state.parent[state.key] = stmt;
    }

    if (stmt.left && stmt.right && stmt.op) {
      this.enterOp(stmt, state);
    }

    if (stmt instanceof alasql.yy.Select) {
      this.enterSelect(stmt, state);
    } else if (stmt instanceof alasql.yy.Column) {
      this.enterColumn(stmt, state);
    }

    if (stmt.funcid || stmt.aggregatorid) {
      this.processColumn(stmt, state);
    }
  }

  leave(stmt, state) {
    if (stmt.left && stmt.right && stmt.op) {
      this.leaveOp(stmt, state);
    }
    if (stmt instanceof alasql.yy.Select) {
      this.leaveSelect(stmt, state);
    }

    if (stmt.as) {
      const value = stmt.as.toString().replaceAll(/(^['"`])|(['"`]$)/g, "");
      stmt.as = `[${value}]`;
    }
  }

  processColumn(stmt, state) {
    if (stmt.funcid && this.aliases.has(`fn.${stmt.funcid}`)) {
      this.aliases.get(`fn.${stmt.funcid}`)(stmt, { column: "funcid" });
    }

    if (stmt.aggregatorid && this.aliases.has(`agg.${stmt.aggregatorid}`)) {
      this.aliases.get(`agg.${stmt.aggregatorid}`)(stmt, {
        column: "aggregatorid",
      });
    }
  }

  enterColumn(stmt, state) {
    const node = this.peek();

    if (
      stmt.columnid &&
      this.tableid &&
      !stmt.tableid &&
      !node.alias.source[stmt.columnid]
    ) {
      stmt.tableid = this.tableid;
    }

    const id = this.columnId(stmt);
    if (stmt.as) {
      node.alias.source[stmt.as] = stmt;
      node.alias.target[id] = stmt.as;
    }
    const match =
      state.path.match(/^\/statements\/[^/]+\/([^/]+)\/\d+$/) ||
      state.path.match(/^\/statements\/[^/]+\/(order)\/\d+\/expression$/);
    if (match && match[1]) {
      node.columns[match[1]] ||= {};
      node.columns[match[1]][id] = stmt;
    }
  }

  columnId(stmt) {
    return `${stmt.tableid || ""}.${stmt.columnid || ""}`.replace(/^\./, "");
  }

  peek() {
    return (
      this.stack[this.stack.length - 1] || {
        columns: { columns: {}, group: {}, sort: {} },
        alias: { source: {}, target: {} },
      }
    );
  }

  visitOrderBy(stmt, top) {
    if (top.columns.order) {
      const missing = [];
      stmt.removeColumns ||= [];

      for (const [key, value] of Object.entries(top.columns.order)) {
        if (top.alias.target[key]) {
          value.tableid = undefined;
          value.columnid = top.alias.target[key];
        } else if (!top.columns.columns[key] && !top.alias.source[key]) {
          missing.push(value);
          top.columns.columns[key] = value;
        }
      }
      if (missing.length) {
        stmt.columns.push(...missing);
        stmt.removeColumns.push(...missing);
      }
    }
  }

  isAggregator(stmt) {
    if (stmt.aggregatorid) {
      return true;
    }

    if (Array.isArray(stmt.args)) {
      return stmt.args.some((it) => this.isAggregator(it));
    }

    if (stmt.expression) {
      return this.isAggregator(stmt.expression);
    }
    return false;
  }

  visitGroupBy(stmt, top) {
    top.columns.group ||= {};
    (stmt.group || []).forEach((it, i) => {
      if (it.value && typeof it.value === "number") {
        stmt.group[i] = clone(stmt.columns[i]);
      }
    });

    if (stmt.columns.some((it) => this.isAggregator(it))) {
      stmt.group ||= [];
      for (const [key, value] of Object.entries(top.columns.columns)) {
        if (!(top.columns.group[key] || top.columns.group[value.as])) {
          const updated = clone(value);
          stmt.group.push(updated);
          top.columns.group[key] = updated;
        }
      }

      stmt.columns.forEach((column) => {
        if (
          !this.isAggregator(column) &&
          !(column instanceof alasql.yy.Column)
        ) {
          stmt.group.push(clone(column));
        }
      });
    }

    for (const [key, value] of Object.entries(top.columns.group)) {
      const col = top.alias.source[key];
      if (col) {
        value.tableid = col.tableid;
        value.columnid = col.columnid;
      }
    }
  }

  enterSelect(stmt, state) {
    this.stack.push({
      columns: { columns: {}, group: {}, sort: {} },
      alias: { source: {}, target: {} },
    });
    if (!stmt.from?.length) {
      stmt.from ||= [];
      stmt.from.push(new alasql.yy.Table({ tableid: "postings" }));
    }
  }

  leaveOp(op, state) {
    if (op.left.columnid === "date" && op.right.funcid === "_minus") {
      const date = op.right
        .toString()
        .replace(/[^0-9]/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .replaceAll(" ", "-")
        .replace(/-(\d)-/, "-0$1-")
        .replace(/-(\d)$/, "-0$1");
      // op.right = new alasql.yy.Op({
      //   dbtypeid: "date",
      //   right: new alasql.yy.Expression({expression: new alasql.yy.StringValue({value: date})})
      // });
    }
  }

  enterOp(op, state) {
    const id = this.columnId(op.right);

    if (
      ["IN", "NOT IN", "=", "!="].includes(op.op) &&
      arrayColumns.has(id) &&
      !op.allsome
    ) {
      if (["IN", "NOT IN"].includes(op.op)) {
        op.op = op.op === "IN" ? "=" : "!=";
      }
      op.allsome = "ANY";
      op.right = [op.right];
    }
    if (["-", "*", "/", "+"].includes(op.op)) {
      const funcs = {
        "-": "_minus",
        "+": "_plus",
        "*": "_mul",
        "/": "safediv",
      };
      state.parent[state.key] = new alasql.yy.FuncValue({
        funcid: funcs[op.op],
        args: [op.left, op.right],
        as: `${op.as ?? op.toString()}`,
      });
    }
  }

  leaveSelect(stmt, state) {
    const top = this.peek();
    if (stmt.columns && stmt.columns.length == 1) {
      const col = stmt.columns[0];
      const columns = this.columns[this.columnId(col)];
      if (columns && columns.length) {
        top.columns.columns = {};
        stmt.columns = [];
        columns.forEach((k) => {
          const value = new alasql.yy.Column({
            columnid: k,
            tableid: col.tableid,
          });
          top.columns.columns[this.columnId(value)] = value;
          stmt.columns.push(value);
        });
      }
    }

    if (this.state.skip) {
      return;
    }
    this.visitOrderBy(stmt, top);
    this.visitGroupBy(stmt, top);
  }

  withState(props, cb) {
    this.state = { ...this.state, ...props };
    try {
      const resp = cb();
      this.state = {};
      return resp;
    } catch (e) {
      this.state = {};
      throw e;
    }
  }

  query(qs) {
    this.state = {};
    qs = qs
      .replaceAll(
        /((date\s+[!=<>]+\s+)([`'"]\d\d\d\d-\d\d-\d\d['`"]))/gim,
        "$2 date($3)",
      )
      .replaceAll(
        /((date\s+[!=<>]+\s+)(\d\d\d\d-\d\d-\d\d))/gim,
        "$2 date('$3')",
      )
      .replaceAll(/(?<!_)(value|only)\s*\(/gim, "_$1(");

    const from = qs.match(/FROM/i);
    const where = qs.match(
      /(WHERE|(LEFT|RIGHT|INNER|OUTER)?\s*JOIN|GROUP\s+BY|ORDER\s+BY|LIMIT)/i,
    );
    if (from && where) {
      let start = this.withState({ skip: true }, () =>
        this.toQuery(
          qs.substring(0, from.index) +
            "\nFROM postings\nJOIN transactions ON transactions.id = postings.transaction_id",
          "postings",
        ),
      );
      start +=
        "\nWHERE " + qs.substring(from.index + from[0].length, where.index);
      start = this.withState({ skip: true }, () =>
        this.toQuery(start, "transactions"),
      );
      if (where[0].toUpperCase() == "WHERE") {
        start += " AND " + qs.substring(where.index + 5);
      } else {
        start += " " + qs.substring(where.index);
      }
      qs = this.toQuery(start);
    } else if (from) {
      let start = this.withState({ skip: true }, () =>
        this.toQuery(
          qs.substring(0, from.index) +
            "\nFROM postings\nJOIN transactions ON transactions.id = postings.transaction_id",
          "postings",
        ),
      );
      const predicate = qs.substring(from.index + from[0].length);
      if (predicate) {
        start += " WHERE " + predicate;
      }
      qs = this.toQuery(start, "transactions");
    }
    return this.toQuery(qs);
  }

  toQuery(value, tableid = "") {
    return this.withState({ tableid }, () => {
      let qs = value;
      if (typeof value === "string") {
        const ast = this.parse(value);
        qs = ast.toString();

        ast.statements.forEach((stmt) => {
          if (stmt.removeColumns?.length) {
            qs = qs.replace(
              /FROM/,
              "REMOVE COLUMNS " + stmt.removeColumns.join(",") + " \nFROM",
            );
          }
        });
      }
      return qs;
    });
  }
}
